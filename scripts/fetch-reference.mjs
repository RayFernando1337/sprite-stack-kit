#!/usr/bin/env node
// Downloads the public, published build of Dash's "fighter" demo into reference/ so you can
// read it and run it locally. Nothing is fetched that a browser does not already load when it
// opens the page, and no sign-in is involved.
//
//   node scripts/fetch-reference.mjs                 # code and assets → reference/creativedash-fighter
//   node scripts/fetch-reference.mjs --no-assets     # code only (skips about 2.5 MB of images and sound)
//   node scripts/fetch-reference.mjs --out /tmp/ref  # somewhere else
//
// The files belong to their author. reference/ is git-ignored: study them, do not publish them.
// See docs/getting-the-source.md.

import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i < 0 ? fallback : args[i + 1]
}
const site = new URL(flag('site', 'https://fly.ui8.dev/'))
const sharePage = flag('page', 'https://forge.ui8.ai/share/frag_1eb8944c-57b1-42ca-a909-5c2d7e517c24')
const shareApi = flag('share', 'https://forge.ui8.ai/api/v1/fragments/frag_1eb8944c-57b1-42ca-a909-5c2d7e517c24/share')
const out = resolve(root, flag('out', 'reference/creativedash-fighter'))
const withAssets = !args.includes('--no-assets')

const CODE = /\.(js|mjs|ts|tsx|jsx)$/i
const TEXT = /\.(html|js|mjs|ts|tsx|jsx|css|json|txt|md|svg)$/i
const queue = []
const seen = new Set()
const saved = []
const problems = []
const notes = []
let skipped = 0
let revision = null

/**
 * Queue an address on the published site. Anything on another site (React, Forge's host
 * script) is left alone. `saveAs` is where the file goes when that differs from its address.
 */
function want(address, from, { optional = false, saveAs = null } = {}) {
  let url
  try {
    url = new URL(address, from)
  } catch {
    return
  }
  if (url.origin !== site.origin) return
  const wrapper = url.searchParams.has('module')
  const path = saveAs ?? (url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname)
  const key = wrapper ? `module ${url.pathname}` : path
  if (seen.has(key)) return
  seen.add(key)
  queue.push({ url, wrapper, optional, path })
}

const local = (spec) => spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/')

function follow(text, url, path) {
  if (path.endsWith('.html')) {
    for (const m of text.matchAll(/\b(?:src|href)="([^"]+)"/g)) if (local(m[1])) want(m[1], url)
    return
  }
  if (!CODE.test(path)) return
  // static imports, side-effect imports and dynamic imports
  for (const m of text.matchAll(/\bfrom\s*["']([^"']+)["']/g)) if (local(m[1])) want(m[1], url)
  for (const m of text.matchAll(/\bimport\s*["']([^"']+)["']/g)) if (local(m[1])) want(m[1], url)
  for (const m of text.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) if (local(m[1])) want(m[1], url)
  // Forge's entry module lists each component and the stylesheet as data
  for (const m of text.matchAll(/"(?:entry|stylesheet)":"([^"]+)"/g)) want(m[1], url)
  const rev = text.match(/"revision":(\d+)/)
  if (rev && path.endsWith('/main.tsx')) revision = Number(rev[1])
  // build scripts the comments mention (how the models and sounds were made), and what those
  // scripts import; kept if they are public
  for (const m of text.matchAll(/\btools\/[\w.-]+\.mjs\b/g)) want(`/${m[0]}`, url, { optional: true })
}

async function get(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'sprite-stack-kit fetch-reference' },
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim())
  return response
}

async function save(path, bytes, url) {
  const file = resolve(join(out, path))
  if (!file.startsWith(out + sep)) throw new Error(`refusing to write outside ${out}: ${path}`)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, bytes)
  const entry = { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), url: String(url) }
  saved.push(entry)
  return entry
}

async function take({ url, wrapper, optional, path }) {
  const asset = !wrapper && !TEXT.test(path)
  if (asset && !withAssets) {
    skipped++
    return
  }
  let response
  try {
    response = await get(url)
  } catch (error) {
    if (optional) notes.push(`${path}: ${error.message}`)
    else problems.push(`${path}: ${error.message}`)
    return
  }
  if (wrapper) {
    // `sound.mp3?v=…&module` is a one-line module that exports the asset's real address. The
    // asset is saved under the address the code imports it by, so the copy runs unchanged.
    const text = await response.text()
    for (const m of text.matchAll(/new URL\(\s*["']([^"']+)["']/g)) want(m[1], url, { saveAs: url.pathname })
    return
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  await save(decodeURIComponent(path).replace(/^\/+/, ''), bytes, url)
  if (!asset) follow(bytes.toString('utf8'), url, path)
}

async function drain() {
  while (queue.length) await Promise.all(queue.splice(0, 6).map(take))
}

console.log(`Fetching ${site.href} → ${out}`)
want('/', site)
want('/package.json', site, { optional: true })
await drain()

// The share API describes the project: its controls, default values and every asset. Assets
// that no module imports (the artwork the models were cut from) are fetched from that list.
try {
  const response = await get(shareApi)
  const bytes = Buffer.from(await response.arrayBuffer())
  await save('share-metadata.json', bytes, shareApi)
  const listed = JSON.parse(bytes.toString('utf8')).fragment?.assets ?? []
  for (const asset of listed) {
    want(`/assets/${asset.logicalPath}?v=${asset.sha256}`, site, { optional: true, saveAs: `/${asset.logicalPath}` })
  }
  await drain()
  for (const asset of listed) {
    const have = saved.find((f) => f.path === asset.logicalPath)
    if (have && have.sha256 !== asset.sha256) notes.push(`${asset.logicalPath}: differs from the share page's current version`)
  }
} catch (error) {
  problems.push(`share metadata: ${error.message}`)
}

saved.sort((a, b) => a.path.localeCompare(b.path))
const fetchedAt = new Date().toISOString()
const manifest = { source: site.href, sharePage, fetchedAt, revision, files: saved }
const notice = `# Third-party reference material

These files are the public, published build of "fighter" by Dash (@creativedash on X),
downloaded from ${site.href} on ${fetchedAt.slice(0, 10)} by \`scripts/fetch-reference.mjs\`${revision ? ` (published revision ${revision})` : ''}.

They are here for private study. They are not part of sprite-stack-kit and its license does
not cover them. No license was published with them, so:

- do not commit or redistribute them (this folder is git-ignored)
- do not copy code, art or sound from them into your own project

To build on Dash's project itself, sign in to Forge and press Remix:
${sharePage}

To run this copy locally: \`npm run reference\`, then open the address it prints.
`
await mkdir(out, { recursive: true })
await writeFile(join(out, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n')
await writeFile(join(out, 'NOTICE.md'), notice)

const total = saved.reduce((sum, f) => sum + f.bytes, 0)
console.log(`Saved ${saved.length} files, ${(total / 1024).toFixed(0)} KB${revision ? `, published revision ${revision}` : ''}.`)
if (skipped) console.log(`Skipped ${skipped} assets (--no-assets).`)
for (const n of notes) console.log(`note: ${n}`)
if (problems.length) {
  console.error(`\n${problems.length} file(s) could not be fetched:`)
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
