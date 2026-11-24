import { CACHE_PREFIX } from '../db'
import type { useAppStore } from '../stores/app'

type Store = ReturnType<typeof useAppStore>

/** 注册 SW、标记离线就绪、在写完草稿后才提示刷新。 */
export function setupPWA(store: Store, onUpdate: () => void): void {
  if (!('serviceWorker' in navigator)) return
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return

  // 项目页 /<repo>/ 下也要拿到正确的 scope；不依赖 document.baseURI 是否带 fragment。
  const scopePath = location.pathname.endsWith('/')
    ? location.pathname
    : location.pathname.replace(/\/[^/]*$/, '/')
  const base = new URL(scopePath, location.origin)
  const swUrl = new URL('sw.js', base).href

  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as { type?: string } | undefined
    if (data?.type === 'OFFLINE_READY') void store.updatePrefs({ offlineReady: true })
  })

  navigator.serviceWorker.ready
    .then(async (registration) => {
      if (await hasCache()) void store.updatePrefs({ offlineReady: true })
      await store.refreshPersistence()
      void registration.update()
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing
        if (!worker) return
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) onUpdate()
        })
      })
    })
    .catch(() => {
      /* 离线或不支持时静默降级，主流程不依赖 SW */
    })

  navigator.serviceWorker.register(swUrl, { scope: base.pathname }).catch(() => {
    /* 注册失败不影响离线使用已有缓存 */
  })
}

async function hasCache(): Promise<boolean> {
  try {
    const keys = await caches.keys()
    return keys.some((key) => key.startsWith(CACHE_PREFIX))
  } catch {
    return false
  }
}

export async function applyUpdate(): Promise<void> {
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    location.reload()
  })
  const registration = await navigator.serviceWorker.getRegistration()
  if (registration?.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' })
  else location.reload()
}
