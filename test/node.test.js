import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument, PDFName } from 'pdf-lib'
import JSZip from 'jszip'
import * as tools from '../src/index.js'

const { csvToJson, jsonToCsv, parseCsv, mergePdfs, extractPages, splitPdf, getPdfPageCount, zipFiles, formatBytes } = tools

test('the whole package imports in Node', () => {
  for (const name of ['convertImage', 'compressImage', 'pdfToImages', 'compressPdf', 'imagesToPdf', 'setPdfWorker']) {
    assert.equal(typeof tools[name], 'function', name)
  }
})

test('csv: quoted fields, escaped quotes, CRLF', () => {
  assert.deepEqual(parseCsv('a,b\r\n"x, y","he said ""hi"""\n'), [['a', 'b'], ['x, y', 'he said "hi"']])
  assert.deepEqual(csvToJson('name,age\nAda,36\nAlan,41'), [{ name: 'Ada', age: '36' }, { name: 'Alan', age: '41' }])
  assert.throws(() => csvToJson(''), /empty/)
})

test('json → csv round trip, union of keys, objects and strings accepted', () => {
  const csv = jsonToCsv([{ a: 1, b: 'x,y' }, { a: 2, c: 'he said "hi"' }])
  assert.equal(csv, 'a,b,c\n1,"x,y",\n2,,"he said ""hi"""')
  assert.deepEqual(csvToJson(csv), [{ a: '1', b: 'x,y', c: '' }, { a: '2', b: '', c: 'he said "hi"' }])
  assert.equal(jsonToCsv('{"k":"v"}'), 'k\nv')
  assert.equal(jsonToCsv([{ a: 1 }], { delimiter: ';' }), 'a\n1')
})

async function pdfWithPages(n, size = 200) {
  const doc = await PDFDocument.create()
  for (let i = 0; i < n; i++) doc.addPage([size + i, size])
  return new Blob([await doc.save()], { type: 'application/pdf' })
}

test('merge, extract, split PDFs', async () => {
  const merged = await mergePdfs([await pdfWithPages(2), await pdfWithPages(3)])
  assert.equal(merged.type, 'application/pdf')
  assert.equal(await getPdfPageCount(merged), 5)

  const middle = await extractPages(merged, { from: 2, to: 4 })
  assert.equal(await getPdfPageCount(middle), 3)
  const picked = await extractPages(merged, { pages: [5, 1] })
  const doc = await PDFDocument.load(await picked.arrayBuffer())
  assert.deepEqual(doc.getPages().map((p) => p.getWidth()), [202, 200])
  await assert.rejects(extractPages(merged, { pages: [9] }), /out of range/)

  const parts = await splitPdf(merged, { pagesPerFile: 2 })
  assert.deepEqual(await Promise.all(parts.map(getPdfPageCount)), [2, 2, 1])
})

test('merge keeps internal links pointing at the merged pages', async () => {
  const src = await PDFDocument.create()
  src.addPage([100, 100])
  src.addPage([100, 100])
  const link = src.context.register(src.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [0, 0, 10, 10], Dest: [src.getPage(1).ref, 'Fit'] }))
  src.getPage(0).node.set(PDFName.of('Annots'), src.context.obj([link]))
  const merged = await mergePdfs([await pdfWithPages(1), new Uint8Array(await src.save())])
  const out = await PDFDocument.load(await merged.arrayBuffer())
  const annot = out.context.lookup(out.getPage(1).node.Annots().get(0))
  assert.equal(annot.get(PDFName.of('Dest')).get(0).toString(), out.getPage(2).ref.toString())
})

test('zip dedupes names', async () => {
  const zip = await zipFiles([{ name: 'a.txt', blob: 'one' }, { name: 'a.txt', blob: 'two' }])
  const files = Object.keys((await JSZip.loadAsync(await zip.arrayBuffer())).files)
  assert.deepEqual(files, ['a.txt', 'a-2.txt'])
})

test('formatBytes', () => {
  assert.equal(formatBytes(0), '0 B')
  assert.equal(formatBytes(1536000), '1.5 MB')
})
