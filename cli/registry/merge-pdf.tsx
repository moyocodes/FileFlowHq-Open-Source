'use client'

import { useState } from 'react'
import { mergePdfs, formatBytes } from '@fileflowhq/tools'
import { FileDrop, downloadBlob, ffButton } from './file-drop'

/** Merge PDFs in a chosen order, in the browser. Built with @fileflowhq/tools. */
export function MergePdf() {
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  const move = (i: number, by: number) =>
    setFiles((list) => {
      const next = [...list]
      const j = i + by
      if (j < 0 || j >= next.length) return list
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      downloadBlob(await mergePdfs(files, { onProgress: setProgress }), 'merged.pdf')
    } catch {
      setError('One of the files could not be read as a PDF. It may be corrupted or encrypted.')
    } finally {
      setBusy(false)
      setProgress(0)
    }
  }

  return (
    <div className="space-y-4">
      <FileDrop accept=".pdf,application/pdf" multiple onFiles={(f) => setFiles((list) => [...list, ...f])}>
        <span className="font-medium">Drop PDFs here</span>
        <span className="text-neutral-500">or click to add</span>
      </FileDrop>

      {files.length > 0 && (
        <ol className="space-y-1 text-sm">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 dark:bg-neutral-800">
              <span className="w-5 text-neutral-500">{i + 1}.</span>
              <span className="min-w-0 flex-1 truncate">
                {f.name} · {formatBytes(f.size)}
              </span>
              <button type="button" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0} className="px-1 disabled:opacity-30">
                ↑
              </button>
              <button type="button" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === files.length - 1} className="px-1 disabled:opacity-30">
                ↓
              </button>
              <button type="button" aria-label="Remove" onClick={() => setFiles((list) => list.filter((_, k) => k !== i))} className="px-1">
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}

      <button type="button" className={ffButton} disabled={files.length < 2 || busy} onClick={run}>
        {busy ? `Merging… ${Math.round(progress * 100)}%` : `Merge ${files.length || ''} PDFs`}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
