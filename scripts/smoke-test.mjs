/**
 * 无头浏览器冒烟测试：验证首屏、IndexedDB 事务写入、刷新持久化、行动收尾与 SW 预缓存。
 * 依赖：本机 Chrome/Edge + 已启动的 `npm run preview`。运行：npm run smoke
 * 可用环境变量：SMOKE_URL、CHROME_PATH、SMOKE_SHOT（截图输出路径）。
 */
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const URL = process.env.SMOKE_URL ?? 'http://127.0.0.1:4173/#/today'
const CHROME = process.env.CHROME_PATH
  ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const SHOT = process.env.SMOKE_SHOT ?? join(tmpdir(), 'passionlife-smoke.png')
const PORT = 9333
const profile = join(tmpdir(), `passionlife-smoke-${process.pid}`)
mkdirSync(profile, { recursive: true })

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
  '--disable-extensions', '--remote-allow-origins=*', '--window-size=390,844',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'
], { stdio: 'ignore' })

let ws
function cleanup() {
  try { ws?.close() } catch { /* ignore */ }
  chrome.kill()
}

async function waitEndpoint() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (res.ok) return
    } catch { /* still starting */ }
    await delay(250)
  }
  throw new Error('Chrome 调试端口未就绪')
}

let seq = 0
const pending = new Map()
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression, awaitPromise = false) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text + ' ' + (result.exceptionDetails.exception?.description ?? ''))
  }
  return result.result.value
}
async function waitText(text, timeout = 12000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const body = await evaluate('document.body.innerText')
    if (body.includes(text)) return body
    await delay(200)
  }
  throw new Error(`等待「${text}」超时。当前页面：\n${await evaluate('document.body.innerText')}`)
}
function check(label, condition, extra = '') {
  if (!condition) throw new Error(`✗ ${label} ${extra}`)
  console.log(`✓ ${label} ${extra}`)
}

try {
  await waitEndpoint()
  const target = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL)}`, { method: 'PUT' })
    .then((r) => r.json())
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  const runtimeErrors = []
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (msg.method === 'Runtime.exceptionThrown') {
      runtimeErrors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text)
    }
    if (!msg.id || !pending.has(msg.id)) return
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) reject(new Error(msg.error.message))
    else resolve(msg.result)
  })
  await send('Page.enable')
  await send('Runtime.enable')

  await waitText('今天想推进什么？')
  check('首屏渲染 / IndexedDB 打开成功', true)

  await evaluate(`(() => {
    const input = document.querySelector('input[placeholder="做出作品集首页"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '做出作品集首页');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`)
  await delay(150) // 等 Vue 更新按钮的 disabled 状态
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('设为今天第一件事')).click()`)
  await delay(1200)
  console.log('点击后 toast：', await evaluate(`document.querySelector('.toast')?.innerText ?? '(无)'`))
  console.log('运行时错误：', runtimeErrors.slice(0, 3))
  console.log('点击后统计：', await evaluate(`(async () => { const db = await new Promise(r => { const q = indexedDB.open('passionlife-local'); q.onsuccess = () => r(q.result); }); const tx = db.transaction('tasks'); return await new Promise(r => { const q = tx.objectStore('tasks').getAll(); q.onsuccess = () => r(q.result.length); }); })()`, true))
  await waitText('眼前这一步')
  check('新建任务 + 设为今日首要（事务写入成功）', true)

  const diag = await evaluate(`(async () => {
    const dbs = await indexedDB.databases();
    const db = await new Promise((res, rej) => { const r = indexedDB.open('passionlife-local'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const tx = db.transaction(['tasks', 'goals', 'meta'], 'readonly');
    const read = (store) => new Promise(res => { const q = tx.objectStore(store).getAll(); q.onsuccess = () => res(q.result.length); });
    return JSON.stringify({ dbs: dbs.map(d => d.name + ':v' + d.version), stores: [...db.objectStoreNames], tasks: await read('tasks'), goals: await read('goals'), meta: await read('meta') });
  })()`, true)
  console.log('诊断：', diag)
  const parsed = JSON.parse(diag)
  const taskCount = parsed.tasks
  check('IndexedDB 中确实有任务', taskCount === 1, `tasks=${taskCount}`)

  await send('Page.reload', { ignoreCache: true })
  await waitText('眼前这一步')
  check('刷新后内容仍在', true)

  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '开始').click()`)
  await waitText('五分钟启动')
  check('开始行动 → 行动页', true)

  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('有进展')).click()`)
  await waitText('做到了什么')
  await evaluate(`(() => {
    const area = document.querySelector('textarea[placeholder^="输入已定"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(area, '输入已定，下一步补错误返回');
    area.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`)
  await delay(150)
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('保存进展')).click()`)
  await waitText('刚才留下的成果')
  check('有进展：记下成果、任务未完成', true)

  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('回今日')).click()`)
  await waitText('本周推进')
  const stats = await evaluate(`[...document.querySelectorAll('.stat-num')].map(e => e.textContent.trim()).join(',')`)
  check('推进天数已计、完成数未变', stats === '1,0', `推进/完成=${stats}`)

  let caches = ''
  for (let i = 0; i < 20; i++) {
    caches = await evaluate('(async () => (await caches.keys()).join(","))()', true)
    if (caches.includes('passionlife')) break
    await delay(300)
  }
  check('Service Worker 预缓存就绪', caches.includes('passionlife'), caches)

  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  writeFileSync(SHOT, Buffer.from(shot.data, 'base64'))
  console.log(`截图：${SHOT}`)

  // 小屏 320px：不得出现横向溢出
  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 720, deviceScaleFactor: 1, mobile: true })
  await delay(350)
  const small = JSON.parse(await evaluate(`JSON.stringify({
    inner: window.innerWidth,
    scroll: document.documentElement.scrollWidth,
    primary: [...document.querySelectorAll('.btn-primary')].some(b => {
      const r = b.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.top >= 0 && r.bottom <= window.innerHeight;
    })
  })`))
  check('320px 小屏无横向溢出、主操作可见', small.inner === 320 && small.scroll <= 320 && small.primary,
    `inner=${small.inner} scroll=${small.scroll} primary=${small.primary}`)
  await send('Emulation.clearDeviceMetricsOverride')
  await delay(200)

  // 离线冷启动 + 离线写入（飞行模式下刷新、增、改都可用）
  await send('Network.enable')
  await send('Network.emulateNetworkConditions', {
    offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0
  })
  await send('Page.reload')
  await waitText('眼前这一步', 15000)
  check('飞行模式下冷启动仍能读取本地数据', true)
  await evaluate(`document.querySelector('button[aria-label="记一笔"]').click()`)
  await waitText('记一笔')
  await evaluate(`(() => {
    const area = document.querySelector('textarea[placeholder^="文件预览"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(area, '离线记下的一句话\\n第二行仍保留');
    area.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`)
  await delay(150)
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '保存').click()`)
  await delay(600)
  const offlineIdeas = await evaluate(`(async () => {
    const db = await new Promise(r => { const q = indexedDB.open('passionlife-local'); q.onsuccess = () => r(q.result); });
    return await new Promise(r => { const q = db.transaction('ideas').objectStore('ideas').getAll(); q.onsuccess = () => r(q.result.length); });
  })()`, true)
  check('离线状态可新增内容并落库', offlineIdeas === 1, `ideas=${offlineIdeas}`)
  await send('Network.emulateNetworkConditions', {
    offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1
  })

  // 备份往返：导出 → 校验 → 预览 → 全量恢复
  const downloads = join(tmpdir(), `passionlife-download-${process.pid}`)
  mkdirSync(downloads, { recursive: true })
  try {
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads })
  } catch {
    await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads })
  }
  await evaluate(`location.hash = '#/settings'`)
  await waitText('导出与恢复')
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('导出当前数据')).click()`)
  let backupPath = ''
  for (let i = 0; i < 40; i++) {
    const files = readdirSync(downloads).filter((name) => name.endsWith('.json'))
    if (files.length) { backupPath = join(downloads, files[0]); break }
    await delay(250)
  }
  check('导出生成 UTF-8 JSON 备份', Boolean(backupPath))
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'))
  check('备份含版本、任务与行动记录', backup.format === 'passionLife'
    && backup.version === 1
    && backup.data.tasks.length === 1
    && backup.data.actions.length === 1
    && Boolean(backup.data.prefs.primaryTaskId))

  const { root } = await send('DOM.getDocument')
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' })
  await send('DOM.setFileInputFiles', { files: [backupPath], nodeId })
  await waitText('预览备份内容')
  check('恢复前先预览数量', true)
  await evaluate(`document.querySelector('input[type=checkbox]').click()`)
  await delay(150)
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('确认恢复')).click()`)
  await waitText('眼前这一步')
  check('备份恢复后首页首要与任务一致', true)
  check('备份保留中文与换行原文', backup.data.ideas[0]?.text === '离线记下的一句话\n第二行仍保留')

  // 坏文件与过高版本必须被拒绝，且不能改动原库
  await evaluate(`location.hash = '#/settings'`)
  await waitText('导出与恢复')
  const badDir = join(tmpdir(), `passionlife-bad-${process.pid}`)
  mkdirSync(badDir, { recursive: true })
  const corruptPath = join(badDir, 'corrupt.json')
  const futurePath = join(badDir, 'future.json')
  writeFileSync(corruptPath, '{ 这不是 JSON', 'utf8')
  writeFileSync(futurePath, JSON.stringify({ ...backup, version: 999 }), 'utf8')
  async function feedBackup(path) {
    const { root } = await send('DOM.getDocument')
    const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' })
    await send('DOM.setFileInputFiles', { files: [path], nodeId })
    await delay(350)
    return evaluate(`[...document.querySelectorAll('.banner')].map(b => b.innerText).find(t => t.includes('备份')) ?? ''`)
  }
  const futureMsg = await feedBackup(futurePath)
  check('过高版本备份被拒绝', futureMsg.includes('备份已拒绝') && futureMsg.includes('v999'), futureMsg)
  const corruptMsg = await feedBackup(corruptPath)
  check('损坏 JSON 备份被拒绝', corruptMsg.includes('备份已损坏'), corruptMsg)
  const afterBad = await evaluate(`(async () => {
    const db = await new Promise(r => { const q = indexedDB.open('passionlife-local'); q.onsuccess = () => r(q.result); });
    const read = (s) => new Promise(r => { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => r(q.result.length); });
    return JSON.stringify({ tasks: await read('tasks'), ideas: await read('ideas'), actions: await read('actions') });
  })()`, true)
  check('坏文件未改动原库', afterBad === '{"tasks":1,"ideas":1,"actions":1}', afterBad)

  console.log('冒烟测试全部通过')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  cleanup()
}
