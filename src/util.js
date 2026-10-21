/** Human-readable byte formatting, e.g. 1536000 -> "1.5 MB" */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

/** Strip the extension off a filename, e.g. "photo.png" -> "photo" */
export function stripExtension(filename) {
  const idx = filename.lastIndexOf('.')
  return idx === -1 ? filename : filename.slice(0, idx)
}

/** Lower-case extension without the dot, e.g. "Photo.JPG" -> "jpg" */
export function getExtension(filename) {
  const idx = filename.lastIndexOf('.')
  return idx === -1 ? '' : filename.slice(idx + 1).toLowerCase()
}

/** Accepts a Blob/File, ArrayBuffer or typed array and returns a Uint8Array. */
export async function toBytes(input) {
  if (input instanceof Uint8Array) return input
  if (input instanceof ArrayBuffer) return new Uint8Array(input)
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  if (input && typeof input.arrayBuffer === 'function') return new Uint8Array(await input.arrayBuffer())
  throw new TypeError('Expected a Blob, File, ArrayBuffer or Uint8Array.')
}

/** Encode a canvas to a Blob, rejecting when the browser silently falls back to another format. */
export function canvasToBlob(canvas, mimeType, quality) {
  if (typeof canvas.convertToBlob === 'function') {
    // OffscreenCanvas (workers)
    return canvas.convertToBlob({ type: mimeType, quality }).then((blob) => checkType(blob, mimeType))
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Encoding failed. The image may be too large for this device.'))
        else checkType(blob, mimeType).then(resolve, reject)
      },
      mimeType,
      quality
    )
  })
}

function checkType(blob, mimeType) {
  // Safari returns a PNG for formats it can't encode (e.g. WebP/AVIF on older iOS).
  if (mimeType && blob.type !== mimeType) {
    const label = mimeType.replace('image/', '').toUpperCase()
    return Promise.reject(new Error(`This browser can't encode ${label}. Try PNG or JPEG.`))
  }
  return Promise.resolve(blob)
}

export function createCanvas(width, height) {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  throw new Error('No canvas available: image and PDF rendering tools need a browser (or a worker with OffscreenCanvas).')
}

/**
 * iOS Safari caps total canvas memory and frees canvases lazily. Shrinking a canvas to 0×0
 * releases its backing store at once.
 */
export function releaseCanvas(canvas) {
  if (!canvas) return
  canvas.width = 0
  canvas.height = 0
}

/** iOS refuses canvases over ~16.7M pixels; returns a scale (≤ 1) that keeps w×h under it. */
export const MAX_CANVAS_PIXELS = 16_000_000
export function canvasFitScale(width, height, maxPixels = MAX_CANVAS_PIXELS) {
  const area = width * height
  return area > maxPixels ? Math.sqrt(maxPixels / area) : 1
}
