/* passionLife service worker。BUILD_ID 与 sw-manifest.json 由构建脚本在产物中生成。 */
const CACHE_PREFIX = 'passionlife'
const BUILD_ID = '__BUILD_ID__'
const CACHE_NAME = CACHE_PREFIX + '-' + BUILD_ID
const SCOPE = self.registration.scope
const MANIFEST_URL = new URL('sw-manifest.json', SCOPE).href
const SHELL_URL = new URL('index.html', SCOPE).href
const ROOT_URL = new URL('./', SCOPE).href

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const response = await fetch(MANIFEST_URL, { cache: 'no-store' })
    if (!response.ok) throw new Error('precache manifest unavailable')
    const manifest = await response.json()
    const urls = [ROOT_URL, ...(manifest.files || []).map((file) => new URL(file, SCOPE).href)]
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll([...new Set(urls)])
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of clients) client.postMessage({ type: 'OFFLINE_READY' })
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    const cached = await cache.match(request)
    if (cached) return cached
    if (request.mode === 'navigate') {
      const shell = (await cache.match(SHELL_URL)) || (await cache.match(ROOT_URL))
      if (shell) return shell
    }
    try {
      const response = await fetch(request)
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone())
      return response
    } catch (error) {
      if (request.mode === 'navigate') {
        const shell = (await cache.match(SHELL_URL)) || (await cache.match(ROOT_URL))
        if (shell) return shell
      }
      throw error
    }
  })())
})
