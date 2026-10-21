export type BinaryInput = Blob | ArrayBuffer | Uint8Array
export type ImageFormat = 'jpeg' | 'jpg' | 'png' | 'webp' | 'avif'
type Progress = { onProgress?: (fraction: number) => void }

export function formatBytes(bytes: number): string
export function getExtension(filename: string): string
export function stripExtension(filename: string): string

export function parseCsv(text: string, options?: { delimiter?: string }): string[][]
export function csvToJson(text: string, options?: { delimiter?: string }): Record<string, string>[]
export function jsonToCsv(data: unknown, options?: { delimiter?: string }): string

export function mergePdfs(inputs: BinaryInput[], options?: Progress): Promise<Blob>
export function extractPages(input: BinaryInput, range: { from?: number; to?: number; pages?: number[] }): Promise<Blob>
export function splitPdf(input: BinaryInput, options?: { pagesPerFile?: number }): Promise<Blob[]>
export function getPdfPageCount(input: BinaryInput): Promise<number>

export function zipFiles(files: { name: string; blob: Blob | Uint8Array | ArrayBuffer | string }[]): Promise<Blob>

export const IMAGE_FORMATS: Record<ImageFormat, string>
export function isHeic(file: Blob & { name?: string }): boolean
export function loadImage(input: Blob): Promise<ImageBitmap>
export function convertImage(
  input: Blob,
  options: { format: ImageFormat; quality?: number; maxWidth?: number; maxHeight?: number; background?: string }
): Promise<Blob>
export function compressImage(
  input: Blob,
  targetBytes: number,
  options?: { format?: ImageFormat; background?: string }
): Promise<{ blob: Blob; hit: boolean }>
export function getImageSize(input: Blob): Promise<{ width: number; height: number }>

export function setPdfWorker(src: string): void
export function pdfToImages(
  input: BinaryInput,
  options?: { format?: 'png' | 'jpeg' | 'webp'; scale?: number; quality?: number } & Progress
): Promise<Blob[]>
export function compressPdf(input: BinaryInput, targetBytes: number, options?: Progress): Promise<{ blob: Blob; hit: boolean }>
export function imagesToPdf(images: Blob[], options?: { pageSize?: 'fit' | 'a4'; margin?: number } & Progress): Promise<Blob>
