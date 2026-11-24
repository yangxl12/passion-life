/** 未提交草稿：localStorage 同步写入；即使存储失败也保留在内存中，切换页面不丢。 */
const KEY = 'passionlife-drafts-v1'

let memory: Record<string, string> = {}
try {
  const raw = localStorage.getItem(KEY)
  if (raw) memory = JSON.parse(raw) as Record<string, string>
} catch {
  memory = {}
}

export function getDraft(key: string): string {
  return memory[key] ?? ''
}

export function setDraft(key: string, value: string): void {
  if (value) memory[key] = value
  else delete memory[key]
  try {
    localStorage.setItem(KEY, JSON.stringify(memory))
  } catch {
    /* 配额不足时保留内存副本，不阻断输入 */
  }
}

export function clearDraft(key: string): void {
  setDraft(key, '')
}
