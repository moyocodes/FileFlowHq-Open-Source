import { canvasFitScale, canvasToBlob, createCanvas, getExtension, releaseCanvas } from './util.js'

/*
 * Image tools. They use the browser's own decoders and <canvas> encoders, so they run in
 * browsers (and workers with OffscreenCanvas), and the image never leaves the device.
 */

export const IMAGE_FORMATS = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
}

const LOSSY = ['image/jpeg', 'image/webp', 'image/avif']
const MIN_QUALITY = 0.1
const MAX_QUALITY = 0.92
const MIN_SIDE = 64

/** True for HEIC/HEIF files (iPhone photos), which most browsers can't decode. */
export function isHeic(file) {
  const ext = getExtension(file.name || '')
  return ext === 'heic' || ext === 'heif' || /^image\/hei[cf]/.test(file.type || '')
}

async function heicToJpeg(blob) {
  let mod
  try {
    mod = await import('heic-to')
  } catch {
    throw new Error('HEIC support needs the optional "heic-to" package: npm install heic-to')
  }
  return mod.heicTo({ blob, type: 'image/jpeg', quality: 0.92 })
}

/**
 * Decode an image Blob/File into an ImageBitmap. HEIC/HEIF is decoded natively where the
 * browser can (Safari) and otherwise through the optional "heic-to" package.
 */
export async function loadImage(blob) {
  try {
    return await createImageBitmap(blob)
  } catch (err) {
    if (!isHeic(blob)) throw new Error(`Could not read the image${blob.name ? ` "${blob.name}"` : ''}. It may be corrupted or unsupported.`)
  }
  return createImageBitmap(await heicToJpeg(blob))
}

function draw(bitmap, width, height, mime, background) {
  const canvas = createCanvas(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)))
  const ctx = canvas.getContext('2d')
  // JPEG has no alpha: transparent areas would turn black, so paint a background first.
  const fill = background ?? (mime === 'image/jpeg' ? '#FFFFFF' : null)
  if (fill) {
    ctx.fillStyle = fill
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas
}

function resolveMime(format) {
  const mime = IMAGE_FORMATS[String(format).toLowerCase()] || format
  if (!Object.values(IMAGE_FORMATS).includes(mime)) throw new Error(`Unsupported output format "${format}". Use jpeg, png, webp or avif.`)
  return mime
}

/**
 * Convert (and optionally resize) an image.
 * @param {Blob|File} input
 * @param {object} options
 * @param {'jpeg'|'jpg'|'png'|'webp'|'avif'} options.format  output format
 * @param {number} [options.quality=0.92]  0..1, for jpeg/webp/avif
 * @param {number} [options.maxWidth]  scale down to fit (keeps aspect ratio)
 * @param {number} [options.maxHeight]
 * @param {string} [options.background]  fill colour for transparent areas (default white for JPEG)
 * @returns {Promise<Blob>}
 */
export async function convertImage(input, { format, quality = MAX_QUALITY, maxWidth, maxHeight, background } = {}) {
  const mime = resolveMime(format)
  const bitmap = await loadImage(input)
  try {
    let scale = Math.min(1, maxWidth ? maxWidth / bitmap.width : 1, maxHeight ? maxHeight / bitmap.height : 1)
    scale *= canvasFitScale(bitmap.width * scale, bitmap.height * scale)
    const canvas = draw(bitmap, bitmap.width * scale, bitmap.height * scale, mime, background)
    try {
      return await canvasToBlob(canvas, mime, LOSSY.includes(mime) ? quality : undefined)
    } finally {
      releaseCanvas(canvas)
    }
  } finally {
    bitmap.close?.()
  }
}

/** Lowest-quality-that-fits search, then shrink the frame if even the lowest quality is too big. */
async function fitLossy(bitmap, mime, targetBytes, background) {
  let scale = canvasFitScale(bitmap.width, bitmap.height)
  let best = null
  for (let round = 0; round < 6; round++) {
    const canvas = draw(bitmap, bitmap.width * scale, bitmap.height * scale, mime, background)
    let lo = MIN_QUALITY
    let hi = MAX_QUALITY
    let fitting = null
    let smallest = null
    for (let i = 0; i < 7; i++) {
      const q = (lo + hi) / 2
      const blob = await canvasToBlob(canvas, mime, q)
      if (!smallest || blob.size < smallest.size) smallest = blob
      if (blob.size <= targetBytes) {
        fitting = blob
        lo = q
      } else {
        hi = q
      }
    }
    releaseCanvas(canvas)
    if (fitting) return { blob: fitting, hit: true }
    if (!best || smallest.size < best.size) best = smallest
    const next = scale * Math.min(0.9, Math.sqrt(targetBytes / smallest.size) * 0.95)
    if (bitmap.width * next < MIN_SIDE || bitmap.height * next < MIN_SIDE) break
    scale = next
  }
  return { blob: best, hit: false }
}

/** PNG has no quality setting, so the only lever is resolution. */
async function fitLossless(bitmap, mime, targetBytes, originalSize) {
  let scale = canvasFitScale(bitmap.width, bitmap.height)
  let size = originalSize
  let best = null
  for (let round = 0; round < 8; round++) {
    scale *= Math.min(0.92, Math.sqrt(targetBytes / size) * 0.97)
    if (bitmap.width * scale < MIN_SIDE || bitmap.height * scale < MIN_SIDE) break
    const canvas = draw(bitmap, bitmap.width * scale, bitmap.height * scale, mime)
    const blob = await canvasToBlob(canvas, mime)
    releaseCanvas(canvas)
    if (!best || blob.size < best.size) best = blob
    if (blob.size <= targetBytes) return { blob, hit: true }
    size = blob.size
  }
  return { blob: best, hit: false }
}

/**
 * Compress an image to at most `targetBytes` ("compress to 100 KB"). Lowers quality first,
 * then resolution. Best effort: if the target can't be reached, the smallest result is
 * returned with `hit: false`. It never returns something larger than the input.
 * @param {Blob|File} input
 * @param {number} targetBytes
 * @param {{ format?: 'jpeg'|'png'|'webp'|'avif', background?: string }} [options]  output format (default: same as input, PNG → JPEG)
 * @returns {Promise<{ blob: Blob, hit: boolean }>}
 */
export async function compressImage(input, targetBytes, { format, background } = {}) {
  const sameAsInput = Object.values(IMAGE_FORMATS).includes(input.type) ? input.type : 'image/jpeg'
  const mime = format ? resolveMime(format) : sameAsInput
  if (input.size <= targetBytes && input.type === mime) return { blob: input, hit: true }
  const bitmap = await loadImage(input)
  try {
    const out = LOSSY.includes(mime) ? await fitLossy(bitmap, mime, targetBytes, background) : await fitLossless(bitmap, mime, targetBytes, input.size)
    if (!out.blob) return { blob: input, hit: false }
    return input.type === mime && out.blob.size >= input.size ? { blob: input, hit: false } : out
  } finally {
    bitmap.close?.()
  }
}
