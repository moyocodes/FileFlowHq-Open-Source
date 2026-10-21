import JSZip from 'jszip'

/**
 * Bundle files into one zip Blob. Duplicate names get a suffix ("page.png", "page-2.png").
 * @param {Array<{ name: string, blob: Blob | Uint8Array | ArrayBuffer | string }>} files
 */
export async function zipFiles(files) {
  const zip = new JSZip()
  const usedNames = new Set()
  for (const { name, blob } of files) {
    const dot = name.lastIndexOf('.')
    const base = dot > 0 ? name.slice(0, dot) : name
    const extension = dot > 0 ? name.slice(dot) : ''
    let uniqueName = name
    let suffix = 2
    while (usedNames.has(uniqueName)) uniqueName = `${base}-${suffix++}${extension}`
    usedNames.add(uniqueName)
    zip.file(uniqueName, blob)
  }
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip' })
}
