// The pdf.js worker, shipped inside this package. render.js starts it with
// `new Worker(new URL('./pdf.worker.js', import.meta.url), { type: 'module' })`, a pattern Vite,
// webpack 5, Rollup and Parcel bundle automatically. pdfjs-dist resolves from this package's own
// dependencies, so apps don't need to install it or configure anything.
import 'pdfjs-dist/build/pdf.worker.min.mjs'
