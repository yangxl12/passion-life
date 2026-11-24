import type { ActionRecord, Database, Goal, Idea, Prefs, Task } from '../types'
import { CONTENT_VERSION } from '../types'

export const DB_NAME = 'passionlife-local'
export const CACHE_PREFIX = 'passionlife'
const DB_VERSION = 1
const STORE_NAMES = ['goals', 'tasks', 'ideas', 'actions', 'meta'] as const
export type StoreName = (typeof STORE_NAMES)[number]

export class ConflictError extends Error {
  constructor(message = '数据已被另一处修改，请复制输入后重试') {
    super(message)
    this.name = 'ConflictError'
  }
}

export class DatabaseError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = 'DatabaseError'
  }
}

export function defaultPrefs(): Prefs {
  return {
    id: 'prefs',
    primaryTaskId: null,
    openActionId: null,
    timerEndsAt: null,
    tone: 'plain',
    favoriteQuoteIds: [],
    hiddenQuoteIds: [],
    quoteHistory: [],
    dailyQuote: null,
    showInspiration: true,
    restartCardDismissedOn: null,
    challengeDismissedOn: null,
    weeklyReviews: [],
    lastExportAt: null,
    contentVersion: CONTENT_VERSION,
    offlineReady: false,
    persistence: 'unknown',
    rev: 0
  }
}

let dbPromise: Promise<IDBDatabase> | null = null

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new DatabaseError('当前浏览器不支持 IndexedDB'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      for (const name of STORE_NAMES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' })
      }
      request.transaction?.objectStore('meta').put(defaultPrefs())
    }
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => db.close()
      resolve(db)
    }
    request.onerror = () => reject(new DatabaseError('数据库打开失败', request.error))
    request.onblocked = () => reject(new DatabaseError('数据库被其他标签页占用，请关闭其他标签页后重试'))
  }).catch((err: unknown) => {
    dbPromise = null
    throw err
  })
  return dbPromise
}

function asPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('事务写入失败'))
    tx.onabort = () => reject(tx.error ?? new Error('事务已中止'))
  })
}

export async function loadAll(): Promise<Database> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAMES, 'readonly')
  const [goals, tasks, ideas, actions, prefs] = await Promise.all([
    asPromise(tx.objectStore('goals').getAll() as IDBRequest<Goal[]>),
    asPromise(tx.objectStore('tasks').getAll() as IDBRequest<Task[]>),
    asPromise(tx.objectStore('ideas').getAll() as IDBRequest<Idea[]>),
    asPromise(tx.objectStore('actions').getAll() as IDBRequest<ActionRecord[]>),
    asPromise(tx.objectStore('meta').get('prefs') as IDBRequest<Prefs | undefined>)
  ])
  return {
    goals,
    tasks,
    ideas,
    actions,
    prefs: prefs ?? defaultPrefs()
  }
}

export interface Versioned {
  id: string
  rev: number
}

export type Entity = Goal | Task | Idea | ActionRecord | Prefs

export interface BatchOp {
  store: StoreName
  value: Entity
}

export interface RemoveOp {
  store: StoreName
  id: string
}

/** 唯一写入口：修订号校验 + 增删都在同一个事务里，失败整体回滚。 */
export async function writeBatch(ops: BatchOp[], removals: RemoveOp[] = []): Promise<Entity[]> {
  if (!ops.length && !removals.length) return []
  const db = await openDB()
  const stores = [...new Set([...ops.map((o) => o.store), ...removals.map((r) => r.store)])] as StoreName[]
  const tx = db.transaction(stores, 'readwrite')
  // 事务监听器必须同步注册：请求回调之后再注册会错过 oncomplete，Promise 永远悬空。
  const completed = transactionDone(tx).then(() => true, () => false)
  let conflicted = false

  // store 里的对象是 Vue 响应式代理，IndexedDB 的 structured clone 不接受 Proxy；先转成纯数据。
  const cleanOps = ops.map((op) => ({
    store: op.store,
    value: JSON.parse(JSON.stringify(op.value)) as Entity
  }))

  // 关键：put 必须在 get 的 onsuccess 回调内部同步发起。
  // 事务在事件回调返回后就失活，任何 await / microtask 之后的 put 都会抛错或静默丢写。
  const writes = cleanOps.map((op) => new Promise<Entity>((resolve, reject) => {
    const os = tx.objectStore(op.store)
    const request = os.get(op.value.id) as IDBRequest<Entity | undefined>
    request.onsuccess = () => {
      const existing = request.result
      if (existing && existing.rev !== op.value.rev) {
        conflicted = true
        try { tx.abort() } catch { /* 事务可能已结束 */ }
        reject(new ConflictError())
        return
      }
      const next = { ...op.value, rev: (existing?.rev ?? 0) + 1 }
      try {
        os.put(next)
        resolve(next)
      } catch (error) {
        try { tx.abort() } catch { /* 事务可能已结束 */ }
        reject(error)
      }
    }
    request.onerror = () => reject(request.error ?? new Error('读取当前修订号失败'))
  }))
  for (const removal of removals) tx.objectStore(removal.store).delete(removal.id)

  const next = await Promise.all(writes).catch((error: unknown) => {
    if (conflicted) throw new ConflictError()
    throw error
  })
  if (!await completed) throw new DatabaseError('事务写入失败，原数据未改动')
  return next
}

/** 全量替换：单个事务内完成，失败自动回滚，原库不受影响。 */
export async function replaceAll(data: Database): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAMES, 'readwrite')
  const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
  for (const name of STORE_NAMES) tx.objectStore(name).clear()
  for (const goal of data.goals) tx.objectStore('goals').put(plain(goal))
  for (const task of data.tasks) tx.objectStore('tasks').put(plain(task))
  for (const idea of data.ideas) tx.objectStore('ideas').put(plain(idea))
  for (const action of data.actions) tx.objectStore('actions').put(plain(action))
  tx.objectStore('meta').put(plain(data.prefs))
  await transactionDone(tx)
}

export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function checkPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persisted) return false
    return await navigator.storage.persisted()
  } catch {
    return false
  }
}
