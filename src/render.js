import { PDFDocument, PDFName, PDFString } from 'pdf-lib'
import { canvasFitScale, canvasToBlob, createCanvas, releaseCanvas, toBytes } from './util.js'
import { IMAGE_FORMATS, compressImage, convertImage, loadImage } from './image.js'

/*
 * Tools that render PDF pages (pdfjs-dist) or draw images (canvas). Browser only.
 */

let pdfjsPromise = null
let workerSrc = null

/**
 * Point pdf.js at its worker file. Call once before using pdfToImages / compressPdf.
 * With Vite:    import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'; setPdfWorker(worker)
 * With webpack: setPdfWorker(new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString())
 */
export function setPdfWorker(src) {
  workerSrc = src
  if (pdfjsPromise) pdfjsPromise.then((lib) => (lib.GlobalWorkerOptions.workerSrc = src))
}

function pdfjs() {
  pdfjsPromise ??= import('pdfjs-dist').then((lib) => {
    if (workerSrc) lib.GlobalWorkerOptions.workerSrc = workerSrc
    return lib
  })
  return pdfjsPromise
}

async function renderPage(page, scale, background) {
  const viewport = page.getViewport({ scale })
  const s = canvasFitScale(viewport.width, viewport.height)
  const vp = s < 1 ? page.getViewport({ scale: scale * s }) : viewport
  const canvas = createCanvas(Math.floor(vp.width), Math.floor(vp.height))
  const ctx = canvas.getContext('2d')
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  await page.render({ canvasContext: ctx, viewport: vp }).promise
  return canvas
}

/**
 * Render every page of a PDF to an image.
 * @param {Blob|ArrayBuffer|Uint8Array} input
 * @param {{ format?: 'png'|'jpeg'|'webp', scale?: number, quality?: number, onProgress?: (f: number) => void }} [options]
 *        scale 2 ≈ 144 dpi (default), 3 ≈ 216 dpi
 * @returns {Promise<Blob[]>}  one image per page
 */
export async function pdfToImages(input, { format = 'png', scale = 2, quality = 0.92, onProgress } = {}) {
  const mime = IMAGE_FORMATS[format] || format
  const lib = await pdfjs()
  const pdf = await lib.getDocument({ data: await toBytes(input) }).promise
  const out = []
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const canvas = await renderPage(await pdf.getPage(i), scale, mime === 'image/png' ? null : '#FFFFFF')
      out.push(await canvasToBlob(canvas, mime, mime === 'image/png' ? undefined : quality))
      releaseCanvas(canvas)
      onProgress?.(i / pdf.numPages)
    }
  } finally {
    pdf.destroy()
  }
  return out
}

function addLinkAnnotation(outDoc, outPage, rect, action) {
  const { context } = outDoc
  const ref = context.register(context.obj({ Type: 'Annot', Subtype: 'Link', Rect: rect, Border: [0, 0, 0], ...action }))
  const existing = outPage.node.Annots()
  if (existing) existing.push(ref)
  else outPage.node.set(PDFName.of('Annots'), context.obj([ref]))
}

async function resolveDestPageIndex(pdf, dest) {
  try {
    const arr = typeof dest === 'string' ? await pdf.getDestination(dest) : dest
    if (!Array.isArray(arr) || arr.length === 0) return null
    const target = arr[0]
    return typeof target === 'number' ? target : await pdf.getPageIndex(target)
  } catch {
    return null
  }
}

/**
 * Compress a PDF to roughly `targetBytes` by rendering each page and re-encoding it as JPEG,
 * then rebuilding the PDF. Links are kept. Note: the text layer is lost (pages become images),
 * the same trade-off every browser-side "compress PDF" makes.
 * @returns {Promise<{ blob: Blob, hit: boolean }>}
 */
export async function compressPdf(input, targetBytes, { onProgress } = {}) {
  const bytes = await toBytes(input)
  const lib = await pdfjs()
  const pdf = await lib.getDocument({ data: bytes.slice() }).promise
  const pageBudget = targetBytes / pdf.numPages
  const outDoc = await PDFDocument.create()
  const internalLinks = []
  let hit = true

  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const canvas = await renderPage(page, 2, '#FFFFFF')
      const pageJpeg = await canvasToBlob(canvas, 'image/jpeg', 0.92)
      releaseCanvas(canvas)
      const fitted = await compressImage(pageJpeg, pageBudget, { format: 'jpeg' })
      if (!fitted.hit) hit = false

      const pt = page.getViewport({ scale: 1 })
      const img = await outDoc.embedJpg(await toBytes(fitted.blob))
      const outPage = outDoc.addPage([pt.width, pt.height])
      outPage.drawImage(img, { x: 0, y: 0, width: pt.width, height: pt.height })

      try {
        for (const a of await page.getAnnotations({ intent: 'display' })) {
          if (a.subtype !== 'Link' || !a.rect) continue
          const [x1, y1, x2, y2] = pt.convertToViewportRectangle(a.rect)
          const rect = [Math.min(x1, x2), pt.height - Math.max(y1, y2), Math.max(x1, x2), pt.height - Math.min(y1, y2)]
          if (a.url) addLinkAnnotation(outDoc, outPage, rect, { A: { Type: 'Action', S: 'URI', URI: PDFString.of(a.url) } })
          else if (a.dest) internalLinks.push({ outPage, rect, dest: a.dest })
        }
      } catch {
        // Links are best effort; never fail the compression over them.
      }
      onProgress?.(i / pdf.numPages)
    }

    const outPages = outDoc.getPages()
    for (const { outPage, rect, dest } of internalLinks) {
      const idx = await resolveDestPageIndex(pdf, dest)
      const target = idx != null ? outPages[idx] : null
      if (target) addLinkAnnotation(outDoc, outPage, rect, { Dest: [target.ref, 'Fit'] })
    }
  } finally {
    pdf.destroy()
  }

  const blob = new Blob([await outDoc.save()], { type: 'application/pdf' })
  if (blob.size >= bytes.byteLength) return { blob: new Blob([bytes], { type: 'application/pdf' }), hit: false }
  return { blob, hit }
}

const A4 = [595.28, 841.89]

/**
 * Build one PDF from images, one page per image, in order.
 * @param {Array<Blob|File>} images
 * @param {{ pageSize?: 'fit'|'a4', margin?: number, onProgress?: (f: number) => void }} [options]
 *        'fit' = each page is the image's size; 'a4' = image centred on an A4 page
 * @returns {Promise<Blob>}
 */
export async function imagesToPdf(images, { pageSize = 'fit', margin = 0, onProgress } = {}) {
  if (!images?.length) throw new Error('No images to add to the PDF.')
  const doc = await PDFDocument.create()
  for (let i = 0; i < images.length; i++) {
    const src = images[i]
    // pdf-lib embeds JPEG and PNG only; anything else (WebP, HEIC, …) is converted first.
    const keep = src.type === 'image/jpeg' || src.type === 'image/png'
    const blob = keep ? src : await convertImage(src, { format: 'png' })
    const data = await toBytes(blob)
    const img = blob.type === 'image/png' ? await doc.embedPng(data) : await doc.embedJpg(data)

    let [pw, ph] = pageSize === 'a4' ? (img.width > img.height ? [A4[1], A4[0]] : A4) : [img.width + margin * 2, img.height + margin * 2]
    const s = Math.min((pw - margin * 2) / img.width, (ph - margin * 2) / img.height, pageSize === 'a4' ? Infinity : 1)
    const w = img.width * s
    const h = img.height * s
    doc.addPage([pw, ph]).drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
    onProgress?.((i + 1) / images.length)
  }
  return new Blob([await doc.save()], { type: 'application/pdf' })
}

/** Width and height of an image in pixels. */
export async function getImageSize(input) {
  const bitmap = await loadImage(input)
  const size = { width: bitmap.width, height: bitmap.height }
  bitmap.close?.()
  return size
}
