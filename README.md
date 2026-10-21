# @fileflowhq/tools

The file tools behind [FileFlowHQ](https://fileflowhq.com), for your own apps. These are private, client-side file tools: **nothing is uploaded**. Everything runs in the user's browser, in a worker, or in Node.

- **Images:** convert (JPEG, PNG, WebP, AVIF), resize, compress to a target size, HEIC/HEIF input
- **PDF:** merge, extract pages, split, compress, PDF → images, images → PDF
- **Data:** CSV ⇄ JSON
- **Zip:** bundle many outputs into one download

```bash
npm install @fileflowhq/tools
```

## Where each tool runs

| Tool | Browser | Worker | Node |
| --- | :-: | :-: | :-: |
| `csvToJson`, `jsonToCsv`, `parseCsv` | ✅ | ✅ | ✅ |
| `mergePdfs`, `extractPages`, `splitPdf`, `getPdfPageCount` | ✅ | ✅ | ✅ |
| `zipFiles` | ✅ | ✅ | ✅ |
| `convertImage`, `compressImage`, `getImageSize` | ✅ | ✅ (OffscreenCanvas) | — |
| `imagesToPdf` | ✅ | ✅ | JPEG/PNG only |
| `pdfToImages`, `compressPdf` | ✅ | ✅ | — |

## Usage

### Images

```js
import { convertImage, compressImage } from '@fileflowhq/tools'

// PNG/HEIC/anything the browser reads → WebP, at most 1600px wide
const webp = await convertImage(file, { format: 'webp', quality: 0.85, maxWidth: 1600 })

// Compress to at most 100 KB (lowers quality first, then resolution)
const { blob, hit } = await compressImage(file, 100 * 1024)
if (!hit) console.log('Could not reach 100 KB; this is the smallest result.')
```

- **Output formats:** `jpeg`, `png`, `webp` and `avif`. Browsers differ in what they can **encode**: AVIF only works in Chromium, and older Safari can't encode WebP. When the browser can't encode a format, the call throws instead of silently returning a PNG.
- **HEIC (iPhone photos):** Safari decodes HEIC natively. For other browsers, install the optional decoder and it's used automatically:

```bash
npm install heic-to
```

### PDF

```js
import { mergePdfs, extractPages, splitPdf, imagesToPdf } from '@fileflowhq/tools'

const merged = await mergePdfs([pdfA, pdfB])                   // Blob, in order
const pages = await extractPages(merged, { from: 2, to: 5 })   // 1-based, inclusive
const picked = await extractPages(merged, { pages: [7, 1] })   // any order
const singles = await splitPdf(merged)                         // Blob[] (one per page)
const scan = await imagesToPdf([photo1, photo2], { pageSize: 'a4', margin: 24 })
```

Inputs can be a `Blob`/`File`, `ArrayBuffer` or `Uint8Array`. Internal "go to page" links keep working after merge, extract and split.

### PDF rendering: PDF → images, compress PDF

These use [pdf.js](https://mozilla.github.io/pdf.js/). Tell it where its worker file is, once:

```js
import { setPdfWorker, pdfToImages, compressPdf } from '@fileflowhq/tools'

// Vite
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
setPdfWorker(worker)

// webpack 5 / others
setPdfWorker(new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString())

const images = await pdfToImages(pdf, { format: 'png', scale: 2 }) // scale 2 ≈ 144 dpi
const { blob, hit } = await compressPdf(pdf, 1024 * 1024)          // aim for 1 MB
```

`compressPdf` renders each page and re-encodes it as JPEG, so **the text layer is lost**: the text can't be selected or searched afterwards. That's the same trade-off every browser-side PDF compressor makes. Links are recreated.

### CSV ⇄ JSON

```js
import { csvToJson, jsonToCsv } from '@fileflowhq/tools'

csvToJson('name,age\nAda,36')          // [{ name: 'Ada', age: '36' }]
jsonToCsv([{ a: 1 }, { a: 2, b: 'x' }]) // 'a,b\n1,\n2,x'
jsonToCsv(rows, { delimiter: ';' })
```

The parser handles quoted fields, escaped quotes, commas and newlines inside quotes, and CRLF line endings. Values stay strings.

### Zip

```js
import { zipFiles } from '@fileflowhq/tools'

const zip = await zipFiles(images.map((blob, i) => ({ name: `page-${i + 1}.png`, blob })))
```

Duplicate names are renamed (`a.png`, `a-2.png`).

### Progress

Long-running PDF tools take `onProgress(fraction)`, where `fraction` goes from 0 to 1:

```js
await mergePdfs(files, { onProgress: (f) => (bar.value = f) })
```

## Smaller imports

The package has no side effects and is tree-shakeable. You can also import only part of it:

```js
import { csvToJson } from '@fileflowhq/tools/data'
import { mergePdfs } from '@fileflowhq/tools/pdf'
```

## Try it without code

Every tool is free to use at **[fileflowhq.com](https://fileflowhq.com)**, along with a Chrome extension and full in-browser editors.

## Contributing

Issues and pull requests are welcome at [github.com/moyocodes/FileFlowHq-Open-Source](https://github.com/moyocodes/FileFlowHq-Open-Source).

```bash
git clone https://github.com/moyocodes/FileFlowHq-Open-Source.git
cd FileFlowHq-Open-Source
npm install
npm test        # runs the tests that work in Node (CSV/JSON, PDF, zip)
```

The image and PDF-rendering tools need a browser, so test changes to them in Chrome, Safari and Firefox.

## Publishing to npm (maintainers)

One-time setup:

1. Create the free organisation **fileflowhq** on [npmjs.com](https://www.npmjs.com/) (avatar → **Add Organization**). This reserves the `@fileflowhq/...` name.
2. In a terminal, run `npm login` and sign in with that npm account.

Each release:

1. Bump the version in `package.json`, following semver: `npm version patch` for fixes, `minor` for new tools, `major` for breaking changes.
2. Run `npm test`.
3. Run `npm publish`. `publishConfig.access` is already `public`, which scoped packages need.
4. Push the commit and tag: `git push --follow-tags`.

Anyone can then install it with `npm install @fileflowhq/tools`.

## License

MIT © James Moyosore (FileFlowHQ). Built on [pdf-lib](https://github.com/Hopding/pdf-lib) (MIT), [pdf.js](https://github.com/mozilla/pdf.js) (Apache-2.0) and [JSZip](https://github.com/Stuk/jszip) (MIT/GPLv3).
