import type { BackupFile, Database, Goal, Idea, ActionRecord, Prefs, Task } from '../types'
import { BACKUP_VERSION, CONTENT_VERSION } from '../types'
import { defaultPrefs } from '../db'

export interface BackupValidation {
  ok: boolean
  data?: Database
  counts?: { goals: number; tasks: number; ideas: number; actions: number }
  exportedAt?: string | null
  error?: string
}

type Dict = Record<string, unknown>

function isObject(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

function hasId(value: unknown): value is Dict & { id: string } {
  return isObject(value) && isString(value.id) && value.id.length > 0
}

function normalizePrefs(raw: unknown): Prefs {
  const base = defaultPrefs()
  if (!isObject(raw)) return base
  const merged: Prefs = { ...base }
  const keys = Object.keys(base) as (keyof Prefs)[]
  for (const key of keys) {
    const value = raw[key]
    if (value === undefined || value === null) continue
    // 只接受与原字段同类型的值，避免坏文件把结构写歪
    const original = base[key]
    if (Array.isArray(original) && Array.isArray(value)) {
      ;(merged as unknown as Dict)[key] = value
    } else if (typeof original === 'number' && typeof value === 'number') {
      ;(merged as unknown as Dict)[key] = value
    } else if (typeof original === 'boolean' && typeof value === 'boolean') {
      ;(merged as unknown as Dict)[key] = value
    } else if (typeof original === 'string' && typeof value === 'string') {
      ;(merged as unknown as Dict)[key] = value
    } else if (original === null && typeof value === 'string') {
      ;(merged as unknown as Dict)[key] = value
    } else if (isObject(original) && isObject(value)) {
      ;(merged as unknown as Dict)[key] = value
    }
  }
  merged.id = 'prefs'
  merged.contentVersion = CONTENT_VERSION
  return merged
}

/** 校验格式版本、类型、唯一 ID 与引用；不修改任何数据。 */
export function validateBackup(raw: unknown): BackupValidation {
  if (!isObject(raw)) return { ok: false, error: '不是有效的 JSON 对象' }
  const file = raw as Partial<BackupFile>
  if (file.format !== 'passionLife') return { ok: false, error: '不是 passionLife 备份文件' }
  if (typeof file.version !== 'number' || !Number.isInteger(file.version)) {
    return { ok: false, error: '缺少有效的格式版本' }
  }
  if (file.version > BACKUP_VERSION) {
    return { ok: false, error: `备份版本 v${file.version} 高于当前支持的 v${BACKUP_VERSION}，请更新应用后重试` }
  }
  if (!isObject(file.data)) return { ok: false, error: '备份内容缺失' }

  const d = file.data as Dict
  for (const key of ['goals', 'tasks', 'ideas', 'actions'] as const) {
    if (!isArray(d[key])) return { ok: false, error: `${key} 数据格式错误` }
    for (const item of d[key] as unknown[]) {
      if (!hasId(item)) return { ok: false, error: `${key} 中存在缺少 ID 的记录` }
      if (typeof item.rev !== 'number' && key !== 'actions') {
        return { ok: false, error: `${key} 中存在缺少修订号的记录` }
      }
    }
  }

  const goals = d.goals as unknown as Goal[]
  const tasks = d.tasks as unknown as Task[]
  const ideas = d.ideas as unknown as Idea[]
  const actions = d.actions as unknown as ActionRecord[]

  const allIds = [...goals, ...tasks, ...ideas, ...actions].map((item) => item.id)
  if (new Set(allIds).size !== allIds.length) return { ok: false, error: '存在重复 ID，备份已损坏' }

  const goalIds = new Set(goals.map((g) => g.id))
  const taskIds = new Set(tasks.map((t) => t.id))
  const actionIds = new Set(actions.map((a) => a.id))
  for (const task of tasks) {
    if (task.goalId && !goalIds.has(task.goalId)) return { ok: false, error: `任务 ${task.id} 引用了不存在的目标` }
    if (task.completionEventId && !actionIds.has(task.completionEventId)) {
      return { ok: false, error: `任务 ${task.id} 引用了不存在的完成事件` }
    }
  }
  for (const idea of ideas) {
    if (idea.goalId && !goalIds.has(idea.goalId)) return { ok: false, error: `想法 ${idea.id} 引用了不存在的目标` }
    if (idea.taskId && !taskIds.has(idea.taskId)) return { ok: false, error: `想法 ${idea.id} 引用了不存在的任务` }
  }
  for (const action of actions) {
    if (!taskIds.has(action.taskId)) return { ok: false, error: `行动记录 ${action.id} 引用了不存在的任务` }
  }

  const prefs = normalizePrefs(d.prefs)
  if (prefs.primaryTaskId && !taskIds.has(prefs.primaryTaskId)) {
    return { ok: false, error: '今日首要引用了不存在的任务' }
  }
  if (prefs.openActionId && !actionIds.has(prefs.openActionId)) {
    prefs.openActionId = null
  }

  return {
    ok: true,
    data: { goals, tasks, ideas, actions, prefs },
    counts: { goals: goals.length, tasks: tasks.length, ideas: ideas.length, actions: actions.length },
    exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : null
  }
}

export function buildBackup(data: Database): BackupFile {
  return {
    format: 'passionLife',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      goals: data.goals,
      tasks: data.tasks,
      ideas: data.ideas,
      actions: data.actions,
      prefs: { ...data.prefs, id: 'prefs' }
    }
  }
}
