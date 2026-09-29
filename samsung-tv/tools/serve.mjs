/*
 * Serves the TV app for development in a desktop browser:
 *   node samsung-tv/tools/serve.mjs
 * Keys: arrows, enter, escape (back), p (play)
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const port = Number(process.env.PORT) || 5180
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.xml': 'application/xml'
}

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  const file = path.join(root, path.normalize(pathname === '/' ? '/index.html' : pathname))

  if (!file.startsWith(root + path.sep)) {
    response.writeHead(403).end()
    return
  }
  try {
    const content = await readFile(file)
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
    response.end(content)
  } catch {
    response.writeHead(404).end('Not found')
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`showmaniac TV: http://localhost:${port}`)
})
