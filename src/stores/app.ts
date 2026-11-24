import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  checkPersistence,
  ConflictError,
  defaultPrefs,
  loadAll,
  replaceAll,
  requestPersistence,
  writeBatch,
  type BatchOp,
  type RemoveOp,
  type Versioned
} from '../db'
import type {
  ActionRecord,
  ActionResult,
  Database,
  Goal,
  GoalStatus,
  Idea,
  Prefs,
  QuoteScene,
  Task,
  Tone
} from '../types'
import { CONTENT_VERSION } from '../types'
import { localDate, uid } from '../logic/date'
import { markQuoteVisit } from '../logic/quotes'
import {
  lastNextStep,
  needsReschedule,
  selectTodayTask,
  silentDays,
  todayAgenda,
  weekStats
} from '../logic/selection'
import { buildBackup, validateBackup, type BackupValidation } from '../logic/backup'

export interface ToastMessage {
  id: number
  text: string
  kind: 'ok' | 'error' | 'info'
  actionLabel?: string
  action?: () => void
}

export interface GoalInput {
  name: string
  outcome?: string
  reason?: string
  targetDate?: string | null
}

export interface TaskInput {
  goalId?: string | null
  title: string
  smallestStep?: string
  planWhen?: string
  planThen?: string
  scheduledDate?: string | null
  dueDate?: string | null
}

const GOAL_COLORS = ['#C9593B', '#8A6B3F', '#4C6B63', '#6B6089', '#A45570', '#3E6B8A']

function upsert<T extends { id: string }>(list: T[], value: T): void {
  const index = list.findIndex((item) => item.id === value.id)
  if (index >= 0) list.splice(index, 1, value)
  else list.push(value)
}

function drop<T extends { id: string }>(list: T[], id: string): void {
  const index = list.findIndex((item) => item.id === id)
  if (index >= 0) list.splice(index, 1)
}

export const useAppStore = defineStore('app', () => {
  const goals = ref<Goal[]>([])
  const tasks = ref<Task[]>([])
  const ideas = ref<Idea[]>([])
  const actions = ref<ActionRecord[]>([])
  const prefs = ref<Prefs>(defaultPrefs())
  const ready = ref(false)
  const fatalError = ref('')
  const toast = ref<ToastMessage | null>(null)
  const today = ref(localDate())
  let toastSeq = 0
  let toastTimer: ReturnType<typeof setTimeout> | null = null
  let actionLock = false

  function notify(text: string, kind: ToastMessage['kind'] = 'ok', actionLabel?: string, action?: () => void): void {
    toastSeq += 1
    toast.value = { id: toastSeq, text, kind, actionLabel, action }
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toast.value = null
    }, kind === 'error' ? 8000 : 3200)
  }

  function dismissToast(): void {
    toast.value = null
  }

  function apply(ops: BatchOp[], saved: Versioned[], removals: RemoveOp[]): void {
    ops.forEach((op, i) => {
      const value = saved[i]
      if (!value) return
      switch (op.store) {
        case 'goals':
          upsert(goals.value, value as unknown as Goal)
          break
        case 'tasks':
          upsert(tasks.value, value as unknown as Task)
          break
        case 'ideas':
          upsert(ideas.value, value as unknown as Idea)
          break
        case 'actions':
          upsert(actions.value, value as unknown as ActionRecord)
          break
        case 'meta':
          prefs.value = value as unknown as Prefs
          break
      }
    })
    for (const removal of removals) {
      switch (removal.store) {
        case 'goals':
          drop(goals.value, removal.id)
          break
        case 'tasks':
          drop(tasks.value, removal.id)
          break
        case 'ideas':
          drop(ideas.value, removal.id)
          break
        case 'actions':
          drop(actions.value, removal.id)
          break
      }
    }
  }

  /** 唯一写入口。失败绝不显示「已保存」，并提供重新加载入口（草稿在 localStorage，不受影响）。 */
  async function commit(
    ops: BatchOp[],
    options: { success?: string; removals?: RemoveOp[] } = {}
  ): Promise<boolean> {
    const removals = options.removals ?? []
    try {
      const saved = await writeBatch(ops, removals)
      apply(ops, saved, removals)
      if (options.success) notify(options.success)
      return true
    } catch (error) {
      const conflict = error instanceof ConflictError
      notify(conflict ? '编辑冲突，输入已保留' : '写入失败，输入已保留', 'error', '重新加载', () => {
        void reload()
      })
      return false
    }
  }

  async function reload(): Promise<void> {
    try {
      const data = await loadAll()
      goals.value = data.goals
      tasks.value = data.tasks
      ideas.value = data.ideas
      actions.value = data.actions
      prefs.value = { ...data.prefs, contentVersion: CONTENT_VERSION }
      ready.value = true
      fatalError.value = ''
    } catch (error) {
      fatalError.value = error instanceof Error ? error.message : '本地数据库无法打开'
      ready.value = false
    }
  }

  function refreshToday(): void {
    const value = localDate()
    if (value !== today.value) today.value = value
  }

  async function lock<T>(fn: () => Promise<T>): Promise<T | null> {
    if (actionLock) return null
    actionLock = true
    try {
      return await fn()
    } finally {
      actionLock = false
    }
  }

  const data = computed<Database>(() => ({
    goals: goals.value,
    tasks: tasks.value,
    ideas: ideas.value,
    actions: actions.value,
    prefs: prefs.value
  }))

  const openAction = computed<ActionRecord | null>(
    () => actions.value.find((a) => a.endedAt === null && a.id === prefs.value.openActionId)
      ?? actions.value.find((a) => a.endedAt === null)
      ?? null
  )
  const selection = computed(() => selectTodayTask(data.value, today.value))
  const agenda = computed(() => todayAgenda(data.value, today.value, selection.value.task?.id ?? null))
  const reschedule = computed(() => needsReschedule(data.value, today.value))
  const week = computed(() => weekStats(data.value, today.value))
  const silent = computed(() => silentDays(data.value, today.value))
  const lastStep = computed(() => lastNextStep(data.value))
  const activeGoals = computed(() => goals.value
    .filter((g) => g.status === 'active' && !g.archived)
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt))
  const recentProgress = computed(() => [...actions.value]
    .filter((a) => a.valid && a.result === 'progress')
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
    .slice(0, 4))
  const goalName = (goalId: string | null): string =>
    goals.value.find((g) => g.id === goalId)?.name ?? '独立待办'
  const tasksOf = (goalId: string): Task[] =>
    tasks.value.filter((t) => t.goalId === goalId).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)

  // ── 目标 ──────────────────────────────────────────────
  async function createGoal(input: GoalInput): Promise<Goal | null> {
    const name = input.name.trim()
    if (!name) return null
    const now = Date.now()
    const goal: Goal = {
      id: uid(),
      name,
      outcome: input.outcome?.trim() ?? '',
      reason: input.reason?.trim() ?? '',
      targetDate: input.targetDate ?? null,
      status: 'active',
      archived: false,
      color: GOAL_COLORS[goals.value.length % GOAL_COLORS.length] ?? '#C9593B',
      order: Math.max(0, ...goals.value.map((g) => g.order)) + 1,
      createdAt: now,
      updatedAt: now,
      rev: 0
    }
    const ok = await commit([{ store: 'goals', value: goal }], { success: '目标已保存' })
    return ok ? goals.value.find((g) => g.id === goal.id) ?? null : null
  }

  async function updateGoal(id: string, patch: Partial<Goal>, success = '已保存'): Promise<boolean> {
    const current = goals.value.find((g) => g.id === id)
    if (!current) return false
    return commit([{ store: 'goals', value: { ...current, ...patch, updatedAt: Date.now() } }], { success })
  }

  async function setGoalStatus(id: string, status: GoalStatus): Promise<boolean> {
    const labels: Record<GoalStatus, string> = { active: '目标已恢复', paused: '目标已暂停', done: '目标已完成' }
    return updateGoal(id, { status }, labels[status])
  }

  async function reorderGoal(id: string, direction: -1 | 1): Promise<boolean> {
    const list = activeGoals.value
    const index = list.findIndex((g) => g.id === id)
    const target = list[index + direction]
    if (index < 0 || !target) return false
    return commit([
      { store: 'goals', value: { ...list[index]!, order: target.order } },
      { store: 'goals', value: { ...target, order: list[index]!.order } }
    ])
  }

  /** 删除目标前由 UI 预览影响；默认把任务保留为独立待办，行动记录按快照保留。 */
  async function deleteGoal(id: string, mode: 'keep' | 'delete'): Promise<boolean> {
    const goal = goals.value.find((g) => g.id === id)
    if (!goal) return false
    const now = Date.now()
    const related = tasks.value.filter((t) => t.goalId === id)
    const relatedIdeas = ideas.value.filter((i) => i.goalId === id)
    const ops: BatchOp[] = []
    const removals: RemoveOp[] = [{ store: 'goals', id }]
    let prefsPatch: Partial<Prefs> | null = null
    if (related.some((t) => t.id === prefs.value.primaryTaskId)) {
      prefsPatch = { primaryTaskId: null }
    }
    if (mode === 'keep') {
      for (const task of related) ops.push({ store: 'tasks', value: { ...task, goalId: null, updatedAt: now } })
      for (const idea of relatedIdeas) ops.push({ store: 'ideas', value: { ...idea, goalId: null, updatedAt: now } })
    } else {
      for (const task of related) removals.push({ store: 'tasks', id: task.id })
      for (const idea of relatedIdeas) {
        ops.push({ store: 'ideas', value: { ...idea, goalId: null, taskId: null, updatedAt: now } })
      }
      // 连任务删除时，必须同步收尾属于这些任务的开放行动，否则 openActionId 悬空：
      // 之后开始任何新任务都会弹「还有一件事没收尾」，指向一个已不存在的幽灵任务。
      const open = openAction.value
      if (open && related.some((t) => t.id === open.taskId)) {
        ops.push({ store: 'actions', value: { ...open, endedAt: now, result: 'abandoned', valid: false } })
        prefsPatch = { ...(prefsPatch ?? {}), openActionId: null, timerEndsAt: null }
      }
    }
    if (prefsPatch) ops.push({ store: 'meta', value: { ...prefs.value, ...prefsPatch } })
    return commit(ops, { removals, success: '目标已删除' })
  }

  // ── 任务 ──────────────────────────────────────────────
  async function createTask(input: TaskInput): Promise<Task | null> {
    const title = input.title.trim()
    if (!title) return null
    const now = Date.now()
    const goalId = input.goalId ?? null
    const siblings = tasks.value.filter((t) => t.goalId === goalId)
    const task: Task = {
      id: uid(),
      goalId,
      title,
      smallestStep: input.smallestStep?.trim() ?? '',
      planWhen: input.planWhen?.trim() ?? '',
      planThen: input.planThen?.trim() ?? '',
      scheduledDate: input.scheduledDate ?? null,
      dueDate: input.dueDate ?? null,
      status: 'todo',
      order: Math.max(0, ...siblings.map((t) => t.order)) + 1,
      completedAt: null,
      completionEventId: null,
      createdAt: now,
      updatedAt: now,
      rev: 0
    }
    const ok = await commit([{ store: 'tasks', value: task }], { success: '已保存' })
    return ok ? tasks.value.find((t) => t.id === task.id) ?? null : null
  }

  async function updateTask(id: string, patch: Partial<Task>, success = '已保存'): Promise<boolean> {
    const current = tasks.value.find((t) => t.id === id)
    if (!current) return false
    return commit([{ store: 'tasks', value: { ...current, ...patch, updatedAt: Date.now() } }], { success })
  }

  async function setPrimary(id: string | null): Promise<boolean> {
    return commit([{ store: 'meta', value: { ...prefs.value, primaryTaskId: id } }], { success: '已设为今日第一件事' })
  }

  async function scheduleTask(id: string, date: string | null, success = '已安排'): Promise<boolean> {
    return updateTask(id, { scheduledDate: date }, success)
  }

  async function reorderTask(id: string, direction: -1 | 1): Promise<boolean> {
    const task = tasks.value.find((t) => t.id === id)
    if (!task) return false
    const list = tasks.value
      .filter((t) => t.goalId === task.goalId)
      .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
    const index = list.findIndex((t) => t.id === id)
    const target = list[index + direction]
    if (index < 0 || !target) return false
    return commit([
      { store: 'tasks', value: { ...list[index]!, order: target.order } },
      { store: 'tasks', value: { ...target, order: list[index]!.order } }
    ])
  }

  /** 有效完成事件唯一：重复点击、刷新、撤销与重开都只按当前有效事件计数。 */
  async function completeTask(id: string): Promise<boolean> {
    return (await lock(async () => {
      const task = tasks.value.find((t) => t.id === id)
      if (!task) return false
      if (task.status === 'done') return true
      const now = Date.now()
      const date = localDate()
      const open = openAction.value
      const goalLabel = goalName(task.goalId)
      const ops: BatchOp[] = []
      let completionId: string

      if (open && open.taskId === id) {
        completionId = open.id
        ops.push({ store: 'actions', value: { ...open, endedAt: now, result: 'complete', localDate: date, valid: true } })
      } else {
        completionId = uid()
        const event: ActionRecord = {
          id: completionId,
          taskId: id,
          goalId: task.goalId,
          goalName: goalLabel,
          taskTitle: task.title,
          startedAt: now,
          endedAt: now,
          result: 'complete',
          progressText: '',
          nextStep: '',
          localDate: date,
          valid: false,
          createdAt: now,
          rev: 0
        }
        ops.push({ store: 'actions', value: { ...event, valid: true } })
        if (open && open.taskId !== id) {
          ops.push({ store: 'actions', value: { ...open, endedAt: now, result: 'abandoned', valid: false } })
          const other = tasks.value.find((t) => t.id === open.taskId)
          if (other && other.status === 'doing') {
            ops.push({ store: 'tasks', value: { ...other, status: 'todo', updatedAt: now } })
          }
        }
      }
      ops.push({
        store: 'tasks',
        value: { ...task, status: 'done', completedAt: now, completionEventId: completionId, updatedAt: now }
      })
      ops.push({
        store: 'meta',
        value: {
          ...prefs.value,
          openActionId: null,
          timerEndsAt: null,
          primaryTaskId: prefs.value.primaryTaskId === id ? null : prefs.value.primaryTaskId
        }
      })
      return commit(ops, { success: '已完成任务' })
    })) ?? false
  }

  async function undoComplete(id: string): Promise<boolean> {
    const task = tasks.value.find((t) => t.id === id)
    if (!task || task.status !== 'done') return true
    const ops: BatchOp[] = [
      { store: 'tasks', value: { ...task, status: 'todo', completedAt: null, completionEventId: null, updatedAt: Date.now() } }
    ]
    const event = actions.value.find((a) => a.id === task.completionEventId)
    if (event) ops.push({ store: 'actions', value: { ...event, valid: false } })
    return commit(ops, { success: '已撤销完成' })
  }

  async function deleteTask(id: string): Promise<boolean> {
    const task = tasks.value.find((t) => t.id === id)
    if (!task) return false
    const ops: BatchOp[] = []
    const removals: RemoveOp[] = [{ store: 'tasks', id }]
    for (const idea of ideas.value.filter((i) => i.taskId === id)) {
      ops.push({ store: 'ideas', value: { ...idea, taskId: null, updatedAt: Date.now() } })
    }
    const open = openAction.value
    const nextPrefs: Prefs = {
      ...prefs.value,
      primaryTaskId: prefs.value.primaryTaskId === id ? null : prefs.value.primaryTaskId,
      openActionId: open?.taskId === id ? null : prefs.value.openActionId,
      timerEndsAt: open?.taskId === id ? null : prefs.value.timerEndsAt
    }
    if (open?.taskId === id) {
      ops.push({ store: 'actions', value: { ...open, endedAt: Date.now(), result: 'abandoned', valid: false } })
    }
    ops.push({ store: 'meta', value: nextPrefs })
    return commit(ops, { removals, success: '已删除' })
  }

  // ── 想法 / 速记 ────────────────────────────────────────
  async function createIdea(text: string, goalId: string | null = null): Promise<Idea | null> {
    const value = text.trim()
    if (!value) return null
    const now = Date.now()
    const idea: Idea = { id: uid(), text: value, goalId, taskId: null, createdAt: now, updatedAt: now, rev: 0 }
    const ok = await commit([{ store: 'ideas', value: idea }], { success: '想法已保存' })
    return ok ? ideas.value.find((i) => i.id === idea.id) ?? null : null
  }

  async function createStandaloneTodo(text: string, scheduledDate: string | null = null): Promise<Task | null> {
    return createTask({ title: text, scheduledDate })
  }

  async function updateIdea(id: string, patch: Partial<Idea>, success = '已保存'): Promise<boolean> {
    const current = ideas.value.find((i) => i.id === id)
    if (!current) return false
    return commit([{ store: 'ideas', value: { ...current, ...patch, updatedAt: Date.now() } }], { success })
  }

  async function deleteIdea(id: string): Promise<boolean> {
    return commit([], { removals: [{ store: 'ideas', id }], success: '已删除' })
  }

  /** 连点两次只产生一项任务；原文保留并显示关联任务。 */
  async function convertIdeaToTask(ideaId: string, title: string, goalId: string | null): Promise<Task | null> {
    return (await lock(async () => {
      const idea = ideas.value.find((i) => i.id === ideaId)
      if (!idea) return null
      if (idea.taskId) {
        const existing = tasks.value.find((t) => t.id === idea.taskId)
        if (existing) return existing
      }
      const now = Date.now()
      const siblings = tasks.value.filter((t) => t.goalId === goalId)
      const task: Task = {
        id: uid(),
        goalId,
        title: title.trim() || idea.text,
        smallestStep: '',
        planWhen: '',
        planThen: '',
        scheduledDate: null,
        dueDate: null,
        status: 'todo',
        order: Math.max(0, ...siblings.map((t) => t.order)) + 1,
        completedAt: null,
        completionEventId: null,
        createdAt: now,
        updatedAt: now,
        rev: 0
      }
      const ok = await commit([
        { store: 'tasks', value: task },
        { store: 'ideas', value: { ...idea, taskId: task.id, goalId, updatedAt: now } }
      ], { success: '已转为待办' })
      return ok ? task : null
    })) ?? null
  }

  // ── 行动 ──────────────────────────────────────────────
  async function startAction(taskId: string): Promise<ActionRecord | null> {
    return (await lock(async () => {
      const task = tasks.value.find((t) => t.id === taskId)
      if (!task || task.status === 'done') return null
      const open = openAction.value
      if (open && open.taskId === taskId) return open
      if (open) return null // UI 必须先让用户选择继续原任务或收尾
      const now = Date.now()
      const action: ActionRecord = {
        id: uid(),
        taskId,
        goalId: task.goalId,
        goalName: goalName(task.goalId),
        taskTitle: task.title,
        startedAt: now,
        endedAt: null,
        result: null,
        progressText: '',
        nextStep: '',
        localDate: localDate(),
        valid: false,
        createdAt: now,
        rev: 0
      }
      const ok = await commit([
        { store: 'actions', value: action },
        { store: 'tasks', value: { ...task, status: 'doing', updatedAt: now } },
        { store: 'meta', value: { ...prefs.value, openActionId: action.id, timerEndsAt: null, primaryTaskId: taskId } }
      ])
      return ok ? action : null
    })) ?? null
  }

  async function finishAction(input: {
    result: ActionResult
    progressText: string
    nextStep: string
  }): Promise<boolean> {
    return (await lock(async () => {
      const open = openAction.value
      if (!open) return false
      if (input.result === 'progress' && !input.progressText.trim()) return false
      const now = Date.now()
      const date = localDate()
      const task = tasks.value.find((t) => t.id === open.taskId)
      const ops: BatchOp[] = []
      const nextStep = input.nextStep.trim()
      ops.push({
        store: 'actions',
        value: {
          ...open,
          endedAt: now,
          result: input.result,
          progressText: input.progressText.trim(),
          nextStep,
          localDate: date,
          valid: input.result !== 'abandoned'
        }
      })
      if (task) {
        ops.push({
          store: 'tasks',
          value: input.result === 'complete'
            ? { ...task, status: 'done', completedAt: now, completionEventId: open.id, updatedAt: now }
            : { ...task, status: 'todo', smallestStep: nextStep || task.smallestStep, updatedAt: now }
        })
      }
      ops.push({
        store: 'meta',
        value: {
          ...prefs.value,
          openActionId: null,
          timerEndsAt: null,
          primaryTaskId: input.result === 'complete' && prefs.value.primaryTaskId === open.taskId
            ? null
            : prefs.value.primaryTaskId
        }
      })
      const label = input.result === 'progress' ? '进展已记下' : input.result === 'complete' ? '已完成任务' : '已退出行动'
      return commit(ops, { success: label })
    })) ?? false
  }

  async function setTimer(minutes: number | null): Promise<boolean> {
    return commit([{
      store: 'meta',
      value: { ...prefs.value, timerEndsAt: minutes === null ? null : Date.now() + minutes * 60000 }
    }])
  }

  // ── 偏好与内容 ─────────────────────────────────────────
  async function updatePrefs(patch: Partial<Prefs>, success?: string): Promise<boolean> {
    return commit([{ store: 'meta', value: { ...prefs.value, ...patch } }], { success })
  }

  async function setTone(tone: Tone): Promise<boolean> {
    return updatePrefs({ tone })
  }

  async function recordQuote(quoteId: string, scene: QuoteScene): Promise<boolean> {
    if (prefs.value.dailyQuote?.date === today.value && prefs.value.dailyQuote.quoteId === quoteId) return true
    return updatePrefs(markQuoteVisit(prefs.value, quoteId, scene, today.value))
  }

  async function toggleFavorite(quoteId: string): Promise<boolean> {
    const list = prefs.value.favoriteQuoteIds
    const next = list.includes(quoteId) ? list.filter((id) => id !== quoteId) : [...list, quoteId]
    return updatePrefs({ favoriteQuoteIds: next })
  }

  async function hideQuote(quoteId: string): Promise<boolean> {
    if (prefs.value.hiddenQuoteIds.includes(quoteId)) return true
    return updatePrefs({ hiddenQuoteIds: [...prefs.value.hiddenQuoteIds, quoteId] }, '以后少看这类')
  }

  async function unhideQuote(quoteId: string): Promise<boolean> {
    return updatePrefs({ hiddenQuoteIds: prefs.value.hiddenQuoteIds.filter((id) => id !== quoteId) })
  }

  async function dismissRestartCard(): Promise<boolean> {
    return updatePrefs({ restartCardDismissedOn: today.value })
  }

  async function dismissChallenge(): Promise<boolean> {
    return updatePrefs({ challengeDismissedOn: today.value })
  }

  async function saveWeeklyReview(week: string, keep: string, next: string): Promise<boolean> {
    const reviews = prefs.value.weeklyReviews.filter((r) => r.week !== week)
    reviews.push({ week, keep: keep.trim(), next: next.trim(), savedAt: Date.now() })
    return updatePrefs({ weeklyReviews: reviews }, '周回顾已保存')
  }

  async function markExported(): Promise<boolean> {
    return updatePrefs({ lastExportAt: Date.now() })
  }

  async function applyPersistence(): Promise<boolean> {
    const granted = await requestPersistence()
    await updatePrefs({ persistence: granted ? 'granted' : 'denied' })
    return granted
  }

  async function refreshPersistence(): Promise<void> {
    const persisted = await checkPersistence()
    if (persisted !== (prefs.value.persistence === 'granted')) {
      await updatePrefs({ persistence: persisted ? 'granted' : 'unknown' })
    }
  }

  // ── 备份 ──────────────────────────────────────────────
  function snapshot(): Database {
    return {
      goals: [...goals.value],
      tasks: [...tasks.value],
      ideas: [...ideas.value],
      actions: [...actions.value],
      prefs: { ...prefs.value }
    }
  }

  async function exportBackup(): Promise<boolean> {
    const file = buildBackup(snapshot())
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `passionLife-backup-${today.value}.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    await markExported()
    notify('备份已导出（明文 JSON）')
    return true
  }

  function inspectBackup(raw: unknown): BackupValidation {
    return validateBackup(raw)
  }

  /** 恢复为全量替换：单事务，失败保持原库。 */
  async function applyBackup(data: Database): Promise<boolean> {
    try {
      await replaceAll(data)
      await reload()
      notify('备份已恢复')
      return true
    } catch {
      notify('恢复失败，原数据未改动', 'error')
      return false
    }
  }

  return {
    goals, tasks, ideas, actions, prefs, ready, fatalError, toast, today,
    data, openAction, selection, agenda, reschedule, week, silent, lastStep,
    activeGoals, recentProgress, goalName, tasksOf,
    reload, refreshToday, notify, dismissToast,
    createGoal, updateGoal, setGoalStatus, reorderGoal, deleteGoal,
    createTask, createStandaloneTodo, updateTask, setPrimary, scheduleTask, reorderTask,
    completeTask, undoComplete, deleteTask,
    createIdea, updateIdea, deleteIdea, convertIdeaToTask,
    startAction, finishAction, setTimer,
    updatePrefs, setTone, recordQuote, toggleFavorite, hideQuote, unhideQuote,
    dismissRestartCard, dismissChallenge, saveWeeklyReview, markExported,
    applyPersistence, refreshPersistence,
    exportBackup, inspectBackup, applyBackup, snapshot
  }
})
