'use client'

import { useState } from 'react'
import { compressImage, formatBytes, stripExtension } from '@fileflowhq/tools'
import { FileDrop, downloadBlob, ffButton } from './file-drop'

const TARGETS = [50, 100, 200, 500, 1024] // KB

/** Compress an image to a chosen size, in the browser. Built with @fileflowhq/tools. */
export function CompressImage({ defaultKb = 200 }: { defaultKb?: number }) {
  const [file, setFile] = useState<File | null>(null)
  const [kb, setKb] = useState(defaultKb)
  const [result, setResult] = useState<{ blob: Blob; hit: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      setResult(await compressImage(file, kb * 1024))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const ext = result?.blob.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'

  return (
    <div className="space-y-4">
      <FileDrop accept="image/*,.heic,.heif" onFiles={([f]) => (setFile(f), setResult(null))}>
        {file ? (
          <span>
            {file.name} · {formatBytes(file.size)}
          </span>
        ) : undefined}
      </FileDrop>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-neutral-500">Target size</span>
        {TARGETS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setKb(t)}
            className={`rounded-full px-3 py-1 ${kb === t ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'}`}
          >
            {t >= 1024 ? `${t / 1024} MB` : `${t} KB`}
          </button>
        ))}
        <input
          type="number"
          min={10}
          value={kb}
          onChange={(e) => setKb(Math.max(10, Number(e.target.value) || 10))}
          className="w-24 rounded-lg border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
          aria-label="Target size in KB"
        />
        <span className="text-neutral-500">KB</span>
      </div>

      <button type="button" className={ffButton} disabled={!file || busy} onClick={run}>
        {busy ? 'Compressing…' : 'Compress'}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && file && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>
            {formatBytes(file.size)} → <b>{formatBytes(result.blob.size)}</b>
            {!result.hit && <span className="text-amber-600"> (smallest possible)</span>}
          </span>
          <button type="button" className={ffButton} onClick={() => downloadBlob(result.blob, `${stripExtension(file.name)}-compressed.${ext}`)}>
            Download
          </button>
        </div>
      )}
    </div>
  )
}
