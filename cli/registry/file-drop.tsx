'use client'

import { useRef, useState, type ReactNode } from 'react'

export type FileDropProps = {
  /** e.g. "image/*" or ".pdf,application/pdf" */
  accept?: string
  multiple?: boolean
  onFiles: (files: File[]) => void
  children?: ReactNode
  className?: string
}

/** Drag-and-drop area that also opens the file picker on click or Enter. */
export function FileDrop({ accept, multiple = false, onFiles, children, className = '' }: FileDropProps) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const take = (list: FileList | null) => {
    const files = Array.from(list ?? [])
    if (files.length) onFiles(multiple ? files : files.slice(0, 1))
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        take(e.dataTransfer.files)
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-8 text-center text-sm transition-colors ${
        over ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-neutral-300 hover:border-neutral-400 dark:border-neutral-700'
      } ${className}`}
    >
      {children ?? (
        <>
          <span className="font-medium">Drop {multiple ? 'files' : 'a file'} here</span>
          <span className="text-neutral-500">or click to choose</span>
        </>
      )}
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          take(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

/** Save a Blob to the user's device. */
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Shared button style for the FileFlowHQ components. */
export const ffButton =
  'inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-neutral-900'
