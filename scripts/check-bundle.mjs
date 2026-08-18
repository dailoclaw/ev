import { readdir, stat } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'

const root = new URL('../dist/', import.meta.url)
const limits = new Map([
  ['.js', 300 * 1024],
  ['.css', 100 * 1024],
])
const violations = []

async function walk(directory) {
  for (const name of await readdir(directory)) {
    const path = join(directory, name)
    const info = await stat(path)
    if (info.isDirectory()) await walk(path)
    else {
      const limit = limits.get(extname(path))
      if (limit && info.size > limit) violations.push(`${relative(root.pathname, path)}: ${info.size} bytes > ${limit}`)
    }
  }
}

await walk(root.pathname)
if (violations.length) {
  console.error(`Bundle budget exceeded:\n${violations.join('\n')}`)
  process.exitCode = 1
} else {
  console.log('Bundle budget passed (JS <= 300 KiB, CSS <= 100 KiB per chunk).')
}
