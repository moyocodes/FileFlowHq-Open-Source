'use client'

import { useState } from 'react'
import { pdfToImages, setPdfWorker, zipFiles, stripExtension } from '@fileflowhq/tools'
import { FileDrop, downloadBlob, ffButton } from './file-drop'

/**
 * Turn every page of a PDF into PNG or JPEG images (zipped). Built with @fileflowhq/tools.
 * The pdf.js worker is bundled with @fileflowhq/tools, so no setup is needed. Pass `workerSrc`
 * only to load a worker you host yourself.
 */
export function PdfToImages({ workerSrc }: { workerSrc?: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<'png' | 'jpeg'>('png')
  const [scale, setScale] = useState(2)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  const run = async () => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      if (workerSrc) setPdfWorker(workerSrc)
      const images = await pdfToImages(file, { format, scale, onProgress: setProgress })
      const base = stripExtension(file.name)
      const ext = format === 'jpeg' ? 'jpg' : 'png'
      if (images.length === 1) downloadBlob(images[0], `${base}.${ext}`)
      else downloadBlob(await zipFiles(images.map((blob, i) => ({ name: `${base}-page-${i + 1}.${ext}`, blob }))), `${base}-images.zip`)
    } catch (e) {
      setError(/password/i.test(String(e)) ? 'This PDF is password-protected.' : `Couldn't read "${file.name}".`)
    } finally {
      setBusy(false)
      setProgress(0)
    }
  }

  const select = 'rounded-lg border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700'

  return (
    <div className="space-y-4">
      <FileDrop accept=".pdf,application/pdf" onFiles={([f]) => setFile(f)}>
        {file ? <span>{file.name}</span> : undefined}
      </FileDrop>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <select value={format} onChange={(e) => setFormat(e.target.value as 'png' | 'jpeg')} className={select} aria-label="Image format">
          <option value="png">PNG</option>
          <option value="jpeg">JPG</option>
        </select>
        <select value={scale} onChange={(e) => setScale(Number(e.target.value))} className={select} aria-label="Resolution">
          <option value={1}>Standard (72 dpi)</option>
          <option value={2}>High (144 dpi)</option>
          <option value={3}>Print (216 dpi)</option>
        </select>
      </div>
      <button type="button" className={ffButton} disabled={!file || busy} onClick={run}>
        {busy ? `Rendering… ${Math.round(progress * 100)}%` : 'Convert to images'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
