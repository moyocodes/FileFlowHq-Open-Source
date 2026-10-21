#!/usr/bin/env node
/**
 * npx fileflowhq add compress-image merge-pdf
 *
 * Copies ready-made React components into your project (you own and can edit them),
 * and installs @fileflowhq/tools, which does the actual file work in the browser.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const registry = JSON.parse(readFileSync(join(ROOT, 'registry/registry.json'), 'utf8'))
const cwd = process.cwd()

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[22m`,
  dim: (s) => `\x1b[2m${s}\x1b[22m`,
  green: (s) => `\x1b[32m${s}\x1b[39m`,
  yellow: (s) => `\x1b[33m${s}\x1b[39m`,
  red: (s) => `\x1b[31m${s}\x1b[39m`,
}

const HELP = `${c.bold('fileflowhq')}: add private, in-browser file tools to your React app

Usage
  npx fileflowhq add <component...>   copy components into your project
  npx fileflowhq add --all            copy every component
  npx fileflowhq list                 show available components

Options
  --path <dir>     where to put the files (default: src/components/fileflowhq or components/fileflowhq)
  --overwrite      replace files that already exist
  --no-install     don't install @fileflowhq/tools
  --js             write .jsx even if the project uses TypeScript

Docs: https://github.com/moyocodes/FileFlowHq-Open-Source/tree/main/cli`

function parseArgs(argv) {
  const opts = { _: [], install: true }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--path') opts.path = argv[++i]
    else if (a === '--overwrite') opts.overwrite = true
    else if (a === '--no-install') opts.install = false
    else if (a === '--all') opts.all = true
    else if (a === '--js') opts.js = true
    else if (a === '-h' || a === '--help') opts.help = true
    else opts._.push(a)
  }
  return opts
}

function list() {
  console.log(c.bold('Available components\n'))
  for (const [name, item] of Object.entries(registry)) {
    if (name === 'file-drop') continue
    console.log(`  ${c.green(name.padEnd(16))} ${item.description}`)
  }
  console.log(`\n${c.dim('Add one with:')} npx fileflowhq add compress-image`)
}

/** The requested components plus everything they depend on, dependencies first. */
function resolve(names) {
  const out = []
  const visit = (name) => {
    if (out.includes(name)) return
    const item = registry[name]
    if (!item) throw new Error(`Unknown component "${name}". Run "npx fileflowhq list" to see them all.`)
    item.registryDependencies.forEach(visit)
    out.push(name)
  }
  names.forEach(visit)
  return out
}

function packageManager() {
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return ['pnpm', ['add']]
  if (existsSync(join(cwd, 'yarn.lock'))) return ['yarn', ['add']]
  if (existsSync(join(cwd, 'bun.lockb')) || existsSync(join(cwd, 'bun.lock'))) return ['bun', ['add']]
  return ['npm', ['install']]
}

function hasDependency(name) {
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'))
    return Boolean(pkg.dependencies?.[name] || pkg.devDependencies?.[name])
  } catch {
    return false
  }
}

const toPascal = (name) => name.replace(/(^|-)(\w)/g, (_, __, ch) => ch.toUpperCase())

function add(opts) {
  if (!existsSync(join(cwd, 'package.json'))) {
    console.error(c.red('No package.json here. Run this in the root of your React project.'))
    process.exit(1)
  }
  const wanted = opts.all ? Object.keys(registry).filter((n) => n !== 'file-drop') : opts._
  if (wanted.length === 0) {
    console.error(c.red('Name at least one component, e.g. npx fileflowhq add compress-image'))
    list()
    process.exit(1)
  }

  const names = resolve(wanted)
  const ts = !opts.js && existsSync(join(cwd, 'tsconfig.json'))
  const dir = join(cwd, opts.path ?? (existsSync(join(cwd, 'src')) ? 'src/components/fileflowhq' : 'components/fileflowhq'))
  mkdirSync(dir, { recursive: true })

  for (const name of names) {
    const item = registry[name]
    const source = ts ? join(ROOT, 'registry', item.file) : join(ROOT, 'registry-jsx', item.file.replace(/\.tsx$/, '.jsx'))
    const target = join(dir, ts ? item.file : item.file.replace(/\.tsx$/, '.jsx'))
    const shown = relative(cwd, target)
    if (existsSync(target) && !opts.overwrite) {
      console.log(`  ${c.yellow('skip')}   ${shown} ${c.dim('(exists, use --overwrite to replace)')}`)
      continue
    }
    writeFileSync(target, readFileSync(source, 'utf8'))
    console.log(`  ${c.green('added')}  ${shown}`)
  }

  if (opts.install && !hasDependency('@fileflowhq/tools')) {
    const [pm, args] = packageManager()
    console.log(`\n${c.dim(`Installing @fileflowhq/tools with ${pm}…`)}`)
    const res = spawnSync(pm, [...args, '@fileflowhq/tools'], { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
    if (res.status !== 0) console.log(c.yellow(`Install failed. Run it yourself: ${pm} ${args.join(' ')} @fileflowhq/tools`))
  }

  const first = wanted[0]
  const folder = relative(cwd, dir).replace(/\\/g, '/')
  console.log(`
${c.bold('Done.')} The components are in ${folder}/. Import them relative to your file, e.g. from src/App:

  import { ${toPascal(first)} } from './${folder.replace(/^src\//, '')}/${first}'

  <${toPascal(first)} />
${c.dim('\nComponents are styled with Tailwind CSS. The files are yours: edit them freely.')}`)
}

const opts = parseArgs(process.argv.slice(2))
const [command] = opts._.splice(0, 1)

try {
  if (opts.help || !command) console.log(HELP)
  else if (command === 'list') list()
  else if (command === 'add') add(opts)
  else {
    console.error(c.red(`Unknown command "${command}".\n`))
    console.log(HELP)
    process.exit(1)
  }
} catch (err) {
  console.error(c.red(err.message))
  process.exit(1)
}
