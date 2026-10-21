'use client'

import { useState } from 'react'
import { imagesToPdf } from '@fileflowhq/tools'
import { FileDrop, downloadBlob, ffButton } from './file-drop'

/** Combine images into one PDF, one page each, in the browser. Built with @fileflowhq/tools. */
export function ImagesToPdf() {
  const [files, setFiles] = useState<File[]>([])
  const [pageSize, setPageSize] = useState<'fit' | 'a4'>('a4')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      downloadBlob(await imagesToPdf(files, { pageSize, margin: pageSize === 'a4' ? 24 : 0 }), 'images.pdf')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <FileDrop accept="image/*,.heic,.heif" multiple onFiles={(f) => setFiles((list) => [...list, ...f])}>
        {files.length ? <span>{files.length} image{files.length > 1 ? 's' : ''} · click to add more</span> : undefined}
      </FileDrop>
      <div className="flex gap-2 text-sm">
        {(['a4', 'fit'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setPageSize(s)}
            className={`rounded-full px-3 py-1 ${pageSize === s ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'}`}
          >
            {s === 'a4' ? 'A4 pages' : 'Page fits image'}
          </button>
        ))}
        {files.length > 0 && (
          <button type="button" onClick={() => setFiles([])} className="ml-auto text-neutral-500 underline">
            Clear
          </button>
        )}
      </div>
      <button type="button" className={ffButton} disabled={!files.length || busy} onClick={run}>
        {busy ? 'Building PDF…' : 'Create PDF'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
