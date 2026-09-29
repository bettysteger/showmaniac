/*
 * Stream proxy for the player of the app: the video player of the TV (AVPlay) only loads
 * addresses with an IP address, this proxy runs on a computer in the home network and loads
 * video files and streams from their real address for the TV.
 *   node samsung-tv/tools/proxy.mjs
 *
 *   GET /stream?url=<address>[&referer=<address>]
 *
 * HLS playlists (.m3u8) are rewritten, so segments, keys and sub playlists also go through the
 * proxy. Range requests are passed on, so seeking in video files works.
 *
 * HLS streams in fMP4 (#EXT-X-MAP) are repackaged to MPEG-TS with ffmpeg (-c copy, nothing is
 * encoded again): measured on a Samsung QN85B (Tizen 6.5), AVPlay hangs while preparing fMP4 with
 * video and audio in one file, and rejects fMP4 of the types iso5/iso6. MPEG-TS plays.
 *   GET /ts?url=<segment>&init=<init segment>[&referer=<address>]
 * Without ffmpeg (FFMPEG=path to use another one) the segments are passed on unchanged.
 * A segment is only sent when it is downloaded and repackaged completely, so the next segments
 * (PREFETCH, default 20, about 2 minutes) are prepared meanwhile: otherwise the TV
 * waits for every segment. They are downloaded in order, at most MAX_DOWNLOADS (default 2) at
 * once; the segment the TV waits for starts at once: measured with a streaming server, 6 downloads at once
 * delivered almost nothing for 20 seconds and the next segment came fifth.
 *
 * Everyone in the home network can use it, do not make the port reachable from the internet.
 */
import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'
import { Readable } from 'node:stream'
import { spawn, spawnSync } from 'node:child_process'

const port = Number(process.env.PORT) || 5181
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
const PASS_ON = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']
const FFMPEG = process.env.FFMPEG || 'ffmpeg'
const canRepackage = spawnSync(FFMPEG, ['-version'], { stdio: 'ignore' }).status === 0
const INIT_CACHE_SIZE = 20
const PREFETCH = process.env.PREFETCH === undefined ? 20 : Number(process.env.PREFETCH)
const TS_CACHE_SIZE = PREFETCH + 5 // about 6 MB each, 150 MB with 20
const REPORT_EVERY = 10 // seconds
const MAX_DOWNLOADS = Number(process.env.MAX_DOWNLOADS) || 2

function headersFor(referer) {
  const headers = { 'user-agent': USER_AGENT }
  if (referer) {
    headers.referer = referer
    headers.origin = new URL(referer).origin
  }
  return headers
}

function log(status, type, size, url, note) {
  // status, type and size show whether the server delivered a video or e.g. an error page
  console.log(`${status} ${type || '-'} ${size ? size + ' bytes' : ''} ${url}${note ? ` (${note})` : ''}`)
}

function seconds(since) {
  return ((Date.now() - since) / 1000).toFixed(1) + ' s'
}

function isPlaylist(url, type) {
  return /mpegurl/i.test(type || '') || /\.m3u8$/i.test(url.pathname)
}

/** Address of the proxy for another address, relative, so it works with any host the TV used */
function proxied(address, base, referer) {
  const url = new URL(address, base).href
  return '/stream?url=' + encodeURIComponent(url) + (referer ? '&referer=' + encodeURIComponent(referer) : '')
}

/**
 * fMP4 playlist: the init segment (#EXT-X-MAP) is left out, every segment is fetched together
 * with it and repackaged to MPEG-TS. Byte ranges would need more work, those stay fMP4.
 */
function rewriteToTs(playlist, base, referer) {
  const map = playlist.match(/#EXT-X-MAP:[^\n]*URI="([^"]+)"/)
  const init = new URL(map[1], base).href
  const suffix = '&init=' + encodeURIComponent(init) + (referer ? '&referer=' + encodeURIComponent(referer) : '')
  const list = []
  let duration = 0

  const rewritten = playlist.split('\n').filter((line) => !line.startsWith('#EXT-X-MAP')).map((line) => {
    const text = line.trim()
    const extinf = text.match(/^#EXTINF:([\d.]+)/)
    if (extinf) { duration = Number(extinf[1]) }
    if (!text || text[0] === '#') { return line }
    const url = new URL(text, base).href
    list.push(url)
    durations.set(url, duration)
    return '/ts?url=' + encodeURIComponent(url) + suffix
  }).join('\n')

  // remembered to know which segments come next
  if (following.size > 20000) {
    following.clear()
    durations.clear()
  }
  list.forEach((url, index) => following.set(url, list.slice(index + 1, index + 1 + PREFETCH)))
  return rewritten
}

/** Points every address in a playlist to the proxy: lines with an address and URI="..." in tags */
function rewrite(playlist, base, referer) {
  if (canRepackage && /#EXT-X-MAP:/.test(playlist) && !/#EXT-X-BYTERANGE|BYTERANGE=/.test(playlist)) {
    return rewriteToTs(playlist, base, referer)
  }
  return playlist.split('\n').map((line) => {
    const text = line.trim()
    if (!text) { return line }
    if (text[0] !== '#') { return proxied(text, base, referer) }
    return line.replace(/URI="([^"]+)"/g, (match, address) => `URI="${proxied(address, base, referer)}"`)
  }).join('\n')
}

async function stream(request, response, params) {
  let url
  try {
    url = new URL(params.get('url'))
  } catch {
    return response.writeHead(400).end('url is missing or not an address')
  }
  if (!/^https?:$/.test(url.protocol)) { return response.writeHead(400).end('only http and https') }

  const referer = params.get('referer') || ''
  const headers = headersFor(referer)
  if (request.headers.range) { headers.range = request.headers.range }

  const controller = new AbortController()
  response.on('close', () => controller.abort()) // the TV stopped or seeked

  const upstream = await fetch(url, { headers, redirect: 'follow', signal: controller.signal })
  const type = upstream.headers.get('content-type')
  const finalUrl = new URL(upstream.url)

  log(upstream.status, type, upstream.headers.get('content-length'), url, request.headers.range)

  if (upstream.ok && isPlaylist(finalUrl, type)) {
    const playlist = rewrite(await upstream.text(), finalUrl.href, referer)
    return response.writeHead(200, { 'content-type': 'application/vnd.apple.mpegurl', 'cache-control': 'no-store' }).end(playlist)
  }

  const out = {}
  PASS_ON.forEach((name) => {
    const value = upstream.headers.get(name)
    if (value) { out[name] = value }
  })
  response.writeHead(upstream.status, out)
  if (!upstream.body || request.method === 'HEAD') { return response.end() }
  Readable.fromWeb(upstream.body).on('error', () => response.destroy()).pipe(response)
}

/*
 * Speed of the downloads of segments: each one and all together. If the total does not grow with
 * more downloads at the same time, the server (or the network) is the limit, not a single connection.
 */
const active = new Set() // running downloads, each knows how many ran at once at most
let received = 0 // bytes since the last report

setInterval(() => {
  if (!active.size && !received) { return }
  console.log(`  total ${(received / 1e6 / REPORT_EVERY).toFixed(2)} MB/s in the last ${REPORT_EVERY} s, ${active.size} downloads running, ${readyAhead()}`)
  received = 0
}, REPORT_EVERY * 1000).unref()

/*
 * Prefetched segments wait for a free slot, in order. The segment the TV waits for starts at once.
 */
const waiting = [] // { url, go }
let downloading = 0

function slot(url, urgent) {
  return new Promise((go) => {
    if (urgent || downloading < MAX_DOWNLOADS) {
      downloading++
      return go()
    }
    waiting.push({ url, go })
  })
}

function freeSlot() {
  const next = waiting.shift()
  if (next) {
    next.go() // the slot is passed on
  } else {
    downloading--
  }
}

/** The TV asks for a segment that is still waiting as a prefetch: it starts at once */
function hurry(url) {
  const index = waiting.findIndex((entry) => entry.url === url)
  if (index === -1) { return }
  downloading++
  waiting.splice(index, 1)[0].go()
}

async function download(url, headers, urgent) {
  await slot(url, urgent)
  try {
    return await load(url, headers)
  } finally {
    freeSlot()
  }
}

async function load(url, headers) {
  const start = Date.now()
  const self = { atOnce: 0 }
  active.add(self)
  active.forEach((other) => { other.atOnce = Math.max(other.atOnce, active.size) })
  try {
    const upstream = await fetch(url, { headers, redirect: 'follow' })
    const waited = (Date.now() - start) / 1000 // until the server answered
    const chunks = []
    for await (const chunk of upstream.body || []) {
      chunks.push(chunk)
      received += chunk.length
    }
    const data = Buffer.concat(chunks)
    const took = (Date.now() - start) / 1000
    const speed = data.length / 1e6 / Math.max(took - waited, 0.05)
    log(upstream.status, upstream.headers.get('content-type'), data.length, url,
      `download ${took.toFixed(1)} s: server answered after ${waited.toFixed(1)} s, then ${speed.toFixed(2)} MB/s, up to ${self.atOnce} at once`)
    if (!upstream.ok) { throw new Error(`${upstream.status} from ${url}`) }
    return data
  } finally {
    active.delete(self)
  }
}

/** Keeps the last results of a function, a failed one is tried again next time */
function cached(map, max, key, create) {
  if (map.has(key)) {
    const value = map.get(key)
    map.delete(key) // the newest entries are kept
    map.set(key, value)
    return value
  }
  if (map.size >= max) { map.delete(map.keys().next().value) }
  const value = create().catch((error) => {
    map.delete(key)
    throw error
  })
  map.set(key, value)
  return value
}

// the init segment is the same for all segments of a stream
const inits = new Map()
const segments = new Map()  // segment address: repackaged segment
const following = new Map() // segment address: addresses of the next segments
const durations = new Map() // segment address: seconds of video
const done = new Set()      // repackaged segments that are ready to send
let lastAsked = null        // the segment the TV asked for last

/*
 * How much video is ready after the segment the TV asked for last: if it shrinks while the TV plays,
 * the server delivers slower than the video plays. AVPlay keeps a little more in its own buffer.
 */
function readyAhead() {
  let secs = 0
  let count = 0
  for (const url of following.get(lastAsked) || []) {
    if (!done.has(url) || !segments.has(url)) { break }
    secs += durations.get(url) || 0
    count++
  }
  return `ready ahead of the TV: ${Math.round(secs)} s (${count} segments)`
}

function initSegment(url, headers) {
  return cached(inits, INIT_CACHE_SIZE, url, () => download(url, headers, true))
}

function repackaged(url, init, headers, urgent) {
  return cached(segments, TS_CACHE_SIZE, url, async () => {
    const [head, body] = await Promise.all([initSegment(init, headers), download(url, headers, urgent)])
    const start = Date.now()
    const data = await toTs(Buffer.concat([head, body]))
    console.log(`    repackaged in ${seconds(start)}`)
    if (done.size > 1000) { done.clear() }
    done.add(url)
    return data
  })
}

/** fMP4 (init segment + segment) to MPEG-TS, the time stamps are kept so the segments fit together */
function toTs(input) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-map', '0',
      '-c', 'copy', '-copyts', '-muxdelay', '0', '-muxpreload', '0', '-f', 'mpegts', 'pipe:1'])
    const out = []
    let errors = ''
    ffmpeg.stdout.on('data', (chunk) => out.push(chunk))
    ffmpeg.stderr.on('data', (chunk) => { errors += chunk })
    ffmpeg.on('error', reject)
    ffmpeg.on('close', (code) => code === 0 ? resolve(Buffer.concat(out)) : reject(new Error('ffmpeg: ' + errors.trim())))
    ffmpeg.stdin.on('error', () => { /* ffmpeg ended early, the error comes with close */ })
    ffmpeg.stdin.end(input)
  })
}

async function ts(request, response, params) {
  const url = params.get('url')
  const init = params.get('init')
  if (!url || !init) { return response.writeHead(400).end('url and init are needed') }
  const headers = headersFor(params.get('referer') || '')

  const wasReady = done.has(url) && segments.has(url)
  lastAsked = url
  hurry(url)
  const data = repackaged(url, init, headers, true)
  console.log(`TV asks for ${url.split('/').pop()}: ${wasReady ? 'ready' : 'the TV waits'}, ${readyAhead()}`)
  // the next segments are prepared while the TV plays this one
  ;(following.get(url) || []).forEach((next) => {
    repackaged(next, init, headers).catch(() => { /* tried again when the TV asks for it */ })
  })
  const body = await data
  response.writeHead(200, { 'content-type': 'video/mp2t', 'content-length': body.length }).end(body)
}

const routes = { '/stream': stream, '/ts': ts }

createServer(async (request, response) => {
  const { pathname, searchParams } = new URL(request.url, 'http://proxy')
  response.setHeader('access-control-allow-origin', '*')

  if (!routes[pathname]) { return response.writeHead(404).end('Not found') }
  try {
    await routes[pathname](request, response, searchParams)
  } catch (error) {
    if (error.name === 'AbortError') { return }
    console.error(searchParams.get('url'), error.message)
    if (!response.headersSent) { response.writeHead(502) }
    response.end()
  }
}).listen(port, '0.0.0.0', () => {
  const addresses = Object.values(networkInterfaces()).flat()
    .filter((address) => address.family === 'IPv4' && !address.internal)
    .map((address) => `http://${address.address}:${port}`)
    .sort((a, b) => b.includes('192.168.') - a.includes('192.168.')) // the home network first, not Docker
  console.log(`Stream proxy: ${addresses.join(', ')}`)
  console.log(canRepackage ? 'fMP4 streams are repackaged to MPEG-TS' : `ffmpeg not found (${FFMPEG}), fMP4 streams are passed on unchanged`)
  console.log('Set TV_PROXY_URL in .env to this address, then run tools/install.sh')
})
