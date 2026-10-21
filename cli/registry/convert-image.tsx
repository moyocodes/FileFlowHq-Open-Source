'use client'

import { useState } from 'react'
import { convertImage, formatBytes, stripExtension, type ImageFormat } from '@fileflowhq/tools'
import { FileDrop, downloadBlob, ffButton } from './file-drop'

const FORMATS: ImageFormat[] = ['jpeg', 'png', 'webp', 'avif']

/** Convert images between JPEG, PNG, WebP and AVIF (HEIC in), in the browser. Built with @fileflowhq/tools. */
export function ConvertImage({ defaultFormat = 'webp' }: { defaultFormat?: ImageFormat }) {
  const [files, setFiles] = useState<File[]>([])
  const [format, setFormat] = useState<ImageFormat>(defaultFormat)
  const [quality, setQuality] = useState(0.9)
  const [results, setResults] = useState<{ name: string; blob: Blob }[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    setBusy(true)
    setError('')
    setResults([])
    const ext = format === 'jpeg' ? 'jpg' : format
    try {
      const out = []
      for (const f of files) out.push({ name: `${stripExtension(f.name)}.${ext}`, blob: await convertImage(f, { format, quality }) })
      setResults(out)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <FileDrop accept="image/*,.heic,.heif" multiple onFiles={(f) => (setFiles(f), setResults([]))}>
        {files.length ? <span>{files.length} image{files.length > 1 ? 's' : ''} selected</span> : undefined}
      </FileDrop>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-neutral-500">Format</span>
          <select value={format} onChange={(e) => setFormat(e.target.value as ImageFormat)} className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700">
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        {format !== 'png' && (
          <label className="flex items-center gap-2">
            <span className="text-neutral-500">Quality</span>
            <input type="range" min={0.4} max={1} step={0.05} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
            <span>{Math.round(quality * 100)}%</span>
          </label>
        )}
      </div>

      <button type="button" className={ffButton} disabled={!files.length || busy} onClick={run}>
        {busy ? 'Converting…' : 'Convert'}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {results.length > 0 && (
        <ul className="space-y-2 text-sm">
          {results.map((r) => (
            <li key={r.name} className="flex items-center justify-between gap-3">
              <span>
                {r.name} · {formatBytes(r.blob.size)}
              </span>
              <button type="button" className={ffButton} onClick={() => downloadBlob(r.blob, r.name)}>
                Download
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
