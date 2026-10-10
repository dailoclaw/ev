// Isolated production-build server; never used as a deployment server.
import { validationBackend } from './validation-backend.mjs'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'

let buildRevision = 'a'
const config = JSON.parse(await readFile('vercel.json', 'utf8'))
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.json': 'application/json' }
let revision = 0
createServer(async (request, response) => {
  try {
    if (await validationBackend(request, response)) return
    const path = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)
    if (path === '/__validation__/build' && request.method === 'POST') {
      const requested = new URL(request.url, 'http://127.0.0.1').searchParams.get('revision')
      if (requested !== 'a' && requested !== 'b') { response.writeHead(400); response.end(); return }
      buildRevision = requested
      revision = 0
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      response.end(JSON.stringify({ buildRevision }))
      return
    }
    if (path === '/__validation__/worker-revision' && request.method === 'POST') {
      revision++
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      response.end(JSON.stringify({ revision }))
      return
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end(); return }
    const headers = {}
    for (const rule of config.headers) {
      if (new RegExp(`^${rule.source}$`).test(path)) {
        for (const header of rule.headers) headers[header.key] = header.value
      }
    }
    const root = resolve('dist-validation', buildRevision)
    let file = resolve(root, `.${path === '/' ? '/index.html' : path}`)
    if (!file.startsWith(root + sep)) { response.writeHead(403); response.end(); return }
    try { if (!(await stat(file)).isFile()) throw new Error('Not a file') }
    catch {
      // Exercise the configured SPA rewrite rather than hiding missing-asset
      // mistakes behind a special case that the real host does not implement.
      const rewrite = config.rewrites.find(rule => new RegExp(`^${rule.source}$`).test(path))
      if (!rewrite) { response.writeHead(404, headers); response.end(); return }
      file = resolve(root, `.${rewrite.destination}`)
      if (!file.startsWith(root + sep)) { response.writeHead(403); response.end(); return }
    }
    headers['Content-Type'] = types[extname(file)] ?? 'application/octet-stream'
    let body = await readFile(file)
    if (path === '/sw.js') body = Buffer.concat([body, Buffer.from(`\n// validation worker revision ${revision}\n`)])
    response.writeHead(200, headers)
    response.end(request.method === 'HEAD' ? undefined : body)
  } catch { response.writeHead(500); response.end('Validation server error') }
}).listen(4174, '127.0.0.1', () => process.stdout.write('Production validation server listening on 4174\n'))
