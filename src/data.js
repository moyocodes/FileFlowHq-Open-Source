/**
 * CSV ⇄ JSON. Pure JavaScript, works in browsers, workers and Node.
 */

/** Minimal RFC-4180-ish CSV parser: handles quoted fields and commas/newlines inside quotes. */
export function parseCsv(text, { delimiter = ',' } = {}) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

/** CSV text (first row = headers) → array of objects. Values stay strings. */
export function csvToJson(text, options) {
  const rows = parseCsv(text, options)
  if (rows.length === 0) throw new Error('That CSV appears to be empty.')
  const [header, ...body] = rows
  return body.map((r) => {
    const obj = {}
    header.forEach((key, i) => {
      obj[key.trim() || `column_${i + 1}`] = r[i] ?? ''
    })
    return obj
  })
}

function escapeCsvField(value, delimiter) {
  const str = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (str.includes(delimiter) || /["\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

/**
 * Array of objects (or a single object, or a JSON string of either) → CSV text.
 * Headers are the union of every object's keys, in first-seen order.
 */
export function jsonToCsv(data, { delimiter = ',' } = {}) {
  if (typeof data === 'string') data = JSON.parse(data)
  if (!Array.isArray(data)) {
    if (typeof data === 'object' && data !== null) data = [data]
    else throw new Error('JSON must be an array of objects (or a single object).')
  }
  if (data.length === 0) return ''

  const headerSet = new Set()
  data.forEach((row) => {
    if (typeof row === 'object' && row !== null) Object.keys(row).forEach((k) => headerSet.add(k))
  })
  const headers = Array.from(headerSet)
  const lines = [headers.map((h) => escapeCsvField(h, delimiter)).join(delimiter)]
  data.forEach((row) => {
    lines.push(headers.map((h) => escapeCsvField(row?.[h], delimiter)).join(delimiter))
  })
  return lines.join('\n')
}
