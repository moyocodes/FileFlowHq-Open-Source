'use client'

import { useState } from 'react'
import { csvToJson, jsonToCsv } from '@fileflowhq/tools'
import { downloadBlob, ffButton } from './file-drop'

/** Paste or type CSV or JSON and convert it the other way. Built with @fileflowhq/tools. */
export function CsvJson() {
  const [direction, setDirection] = useState<'csv-to-json' | 'json-to-csv'>('csv-to-json')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')

  const convert = () => {
    setError('')
    try {
      setOutput(direction === 'csv-to-json' ? JSON.stringify(csvToJson(input), null, 2) : jsonToCsv(input))
    } catch (e) {
      setOutput('')
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const toJson = direction === 'csv-to-json'
  const area = 'h-56 w-full rounded-xl border border-neutral-300 bg-transparent p-3 font-mono text-xs dark:border-neutral-700'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={ffButton} onClick={() => (setDirection(toJson ? 'json-to-csv' : 'csv-to-json'), setOutput(''))}>
          {toJson ? 'CSV → JSON' : 'JSON → CSV'} ⇄
        </button>
        <button type="button" className={ffButton} disabled={!input.trim()} onClick={convert}>
          Convert
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <textarea className={area} value={input} onChange={(e) => setInput(e.target.value)} placeholder={toJson ? 'name,age\nAda,36' : '[{"name":"Ada","age":36}]'} aria-label="Input" />
        <textarea className={area} value={output} readOnly placeholder="Result" aria-label="Output" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {output && (
        <button
          type="button"
          className={ffButton}
          onClick={() => downloadBlob(new Blob([output], { type: toJson ? 'application/json' : 'text/csv' }), toJson ? 'data.json' : 'data.csv')}
        >
          Download {toJson ? '.json' : '.csv'}
        </button>
      )}
    </div>
  )
}
