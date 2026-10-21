'use client'

import { useState } from 'react'
import { extractPages, getPdfPageCount, splitPdf, zipFiles, stripExtension } from '@fileflowhq/tools'
import { FileDrop, downloadBlob, ffButton } from './file-drop'

/** Extract a page range, or split every page into its own PDF (zipped). Built with @fileflowhq/tools. */
export function SplitPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [pages, setPages] = useState(0)
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pick = async ([f]: File[]) => {
    setError('')
    try {
      const count = await getPdfPageCount(f)
      setFile(f)
      setPages(count)
      setFrom(1)
      setTo(count)
    } catch {
      setError(`Couldn't read "${f.name}". It may be corrupted or encrypted.`)
    }
  }

  const work = async (job: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await job()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const base = file ? stripExtension(file.name) : 'document'
  const field = 'w-20 rounded-lg border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700'

  return (
    <div className="space-y-4">
      <FileDrop accept=".pdf,application/pdf" onFiles={pick}>
        {file ? (
          <span>
            {file.name} · {pages} pages
          </span>
        ) : undefined}
      </FileDrop>

      {file && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-neutral-500">Pages</span>
            <input type="number" min={1} max={pages} value={from} onChange={(e) => setFrom(Number(e.target.value))} className={field} aria-label="From page" />
            <span>to</span>
            <input type="number" min={from} max={pages} value={to} onChange={(e) => setTo(Number(e.target.value))} className={field} aria-label="To page" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={ffButton}
              disabled={busy}
              onClick={() => work(async () => downloadBlob(await extractPages(file, { from, to }), `${base}-pages-${from}-${to}.pdf`))}
            >
              Extract pages {from}–{to}
            </button>
            <button
              type="button"
              className={ffButton}
              disabled={busy || pages < 2}
              onClick={() =>
                work(async () => {
                  const parts = await splitPdf(file)
                  downloadBlob(await zipFiles(parts.map((blob, i) => ({ name: `${base}-page-${i + 1}.pdf`, blob }))), `${base}-pages.zip`)
                })
              }
            >
              Split every page (.zip)
            </button>
          </div>
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
