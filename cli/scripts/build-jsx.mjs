/**
 * Builds registry-jsx/*.jsx from registry/*.tsx (types stripped, JSX kept) for projects without
 * TypeScript. Runs before every publish (prepublishOnly).
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transformSync } from 'esbuild'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(ROOT, 'registry')
const out = join(ROOT, 'registry-jsx')
rmSync(out, { recursive: true, force: true })
mkdirSync(out)

for (const file of readdirSync(src).filter((f) => f.endsWith('.tsx'))) {
  const { code } = transformSync(readFileSync(join(src, file), 'utf8'), { loader: 'tsx', jsx: 'preserve', format: 'esm', target: 'es2022' })
  // Keep Next.js's 'use client' as the first line whatever esbuild did with it.
  const body = code.replace(/^"use client";\n/, '')
  writeFileSync(join(out, file.replace(/\.tsx$/, '.jsx')), `'use client'\n\n${body}`)
  console.log(`registry-jsx/${file.replace(/\.tsx$/, '.jsx')}`)
}
