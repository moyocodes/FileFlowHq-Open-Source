import { PDFDocument } from 'pdf-lib'
import { remapInternalLinks } from './pdfLinks.js'
import { toBytes } from './util.js'

/*
 * PDF tools built on pdf-lib. Pure JavaScript: they work in browsers, workers and Node,
 * and nothing is uploaded anywhere.
 */

const pdfBlob = (bytes) => new Blob([bytes], { type: 'application/pdf' })

async function load(input) {
  return PDFDocument.load(await toBytes(input), { ignoreEncryption: true })
}

/**
 * Merge PDFs into one, in order. Internal "go to page" links keep working.
 * @param {Array<Blob|ArrayBuffer|Uint8Array>} inputs
 * @param {{ onProgress?: (fraction: number) => void }} [options]
 * @returns {Promise<Blob>}
 */
export async function mergePdfs(inputs, { onProgress } = {}) {
  if (!inputs || inputs.length === 0) throw new Error('Add at least one PDF to merge.')
  const outDoc = await PDFDocument.create()
  for (let i = 0; i < inputs.length; i++) {
    const srcDoc = await load(inputs[i])
    const indices = srcDoc.getPageIndices()
    const copied = await outDoc.copyPages(srcDoc, indices)
    copied.forEach((p) => outDoc.addPage(p))
    remapInternalLinks(srcDoc, indices, copied)
    onProgress?.((i + 1) / inputs.length)
  }
  return pdfBlob(await outDoc.save())
}

/** Total page count of a PDF. */
export async function getPdfPageCount(input) {
  return (await load(input)).getPageCount()
}

/**
 * Extract pages into a new PDF. Pages are 1-based.
 * @param {Blob|ArrayBuffer|Uint8Array} input
 * @param {{ from?: number, to?: number, pages?: number[] }} range  a range (inclusive), or an explicit page list
 * @returns {Promise<Blob>}
 */
export async function extractPages(input, { from = 1, to, pages } = {}) {
  const srcDoc = await load(input)
  const count = srcDoc.getPageCount()
  let indices
  if (pages?.length) {
    indices = pages.map((p) => p - 1)
  } else {
    const start = Math.max(1, Math.min(from, count))
    const end = Math.max(start, Math.min(to ?? count, count))
    indices = []
    for (let p = start; p <= end; p++) indices.push(p - 1)
  }
  if (indices.some((i) => i < 0 || i >= count)) throw new RangeError(`Page out of range: this PDF has ${count} pages.`)
  const outDoc = await PDFDocument.create()
  const copied = await outDoc.copyPages(srcDoc, indices)
  copied.forEach((p) => outDoc.addPage(p))
  remapInternalLinks(srcDoc, indices, copied)
  return pdfBlob(await outDoc.save())
}

/**
 * Split a PDF into one file per page (or per chunk of `pagesPerFile` pages).
 * @returns {Promise<Blob[]>}
 */
export async function splitPdf(input, { pagesPerFile = 1 } = {}) {
  const bytes = await toBytes(input)
  const count = await getPdfPageCount(bytes)
  const out = []
  for (let from = 1; from <= count; from += pagesPerFile) {
    out.push(await extractPages(bytes, { from, to: Math.min(count, from + pagesPerFile - 1) }))
  }
  return out
}
