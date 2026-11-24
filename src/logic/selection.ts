import type { ActionRecord, Database, Goal, Task } from '../types'
import { addDays, diffDays, localDate, weekStart } from './date'

export type SelectionReason = 'open' | 'primary' | 'scheduled' | 'suggested' | 'empty'

export interface TodaySelection {
  task: Task | null
  goal: Goal | null
  reason: SelectionReason
  openAction: ActionRecord | null
}

function usable(task: Task): boolean {
  return task.status !== 'done'
}

/** 首页选择规则：未收尾行动 > 手选今日首要 > 今天已安排第一项 > 建议最近推进目标 > 无候选。 */
export function selectTodayTask(data: Database, date: string): TodaySelection {
  const { goals, tasks, actions, prefs } = data
  const goalOf = (task: Task): Goal | null => goals.find((g) => g.id === task.goalId) ?? null
  const liveGoals = new Set(goals.filter((g) => g.status === 'active' && !g.archived).map((g) => g.id))

  const openAction = actions.find((a) => a.endedAt === null && a.id === prefs.openActionId)
    ?? actions.find((a) => a.endedAt === null)
    ?? null
  if (openAction) {
    const task = tasks.find((t) => t.id === openAction.taskId)
    if (task && usable(task)) return { task, goal: goalOf(task), reason: 'open', openAction }
  }

  const primary = tasks.find((t) => t.id === prefs.primaryTaskId && usable(t) && (!t.goalId || liveGoals.has(t.goalId)))
  if (primary) return { task: primary, goal: goalOf(primary), reason: 'primary', openAction: null }

  const scheduled = tasks
    .filter((t) => usable(t) && t.scheduledDate === date && (!t.goalId || liveGoals.has(t.goalId)))
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)[0]
  if (scheduled) return { task: scheduled, goal: goalOf(scheduled), reason: 'scheduled', openAction: null }

  const recentGoalIds = [...actions]
    .filter((a) => a.valid && a.goalId && a.result !== 'abandoned')
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((a) => a.goalId as string)
  const orderedGoalIds = [...new Set(recentGoalIds)].filter((id) => liveGoals.has(id))
  for (const id of orderedGoalIds) {
    const candidate = tasks
      .filter((t) => t.goalId === id && usable(t))
      .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)[0]
    if (candidate) return { task: candidate, goal: goalOf(candidate), reason: 'suggested', openAction: null }
  }
  for (const goal of goals.filter((g) => liveGoals.has(g.id)).sort((a, b) => a.order - b.order)) {
    const candidate = tasks
      .filter((t) => t.goalId === goal.id && usable(t))
      .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)[0]
    if (candidate) return { task: candidate, goal, reason: 'suggested', openAction: null }
  }

  const standalone = tasks.filter((t) => !t.goalId && usable(t) && !t.scheduledDate).sort((a, b) => a.order - b.order)[0]
  if (standalone) return { task: standalone, goal: null, reason: 'suggested', openAction: null }

  return { task: null, goal: null, reason: 'empty', openAction: null }
}

export function todayAgenda(data: Database, date: string, excludeTaskId: string | null): Task[] {
  return data.tasks
    .filter((t) => t.scheduledDate === date && t.id !== excludeTaskId)
    .sort((a, b) =>
      Number(a.status === 'done') - Number(b.status === 'done')
      || a.order - b.order
      || a.createdAt - b.createdAt
    )
}

/** 今天从任意入口完成任务的任务 ID（含未安排日期的今日首要）。 */
export function completedToday(data: Database, date: string): string[] {
  const ids = data.actions
    .filter((a) => a.valid && a.result === 'complete' && a.localDate === date)
    .map((a) => a.taskId)
  return [...new Set(ids)].filter((id) => data.tasks.some((t) => t.id === id && t.status === 'done'))
}

/** 昨天及以前未完成的安排，进入「待重新安排」，不自动挤占首页。 */
export function needsReschedule(data: Database, date: string): Task[] {
  return data.tasks
    .filter((t) => t.scheduledDate && t.scheduledDate < date && t.status !== 'done')
    .sort((a, b) => (b.scheduledDate ?? '').localeCompare(a.scheduledDate ?? ''))
}

export interface WeekStats {
  start: string
  progressDays: number
  completedTasks: number
  progressDates: string[]
  byGoal: { goalId: string | null; goalName: string; records: ActionRecord[] }[]
}

export function weekStats(data: Database, date: string): WeekStats {
  const start = weekStart(date)
  const inWeek = (day: string) => day >= start && day <= addDays(start, 6)
  const effective = data.actions.filter((a) => a.valid && a.result !== 'abandoned' && a.result !== null && inWeek(a.localDate))
  const progressDates = [...new Set(effective.map((a) => a.localDate))].sort()
  const completedTasks = new Set(
    data.actions
      .filter((a) => a.valid && a.result === 'complete' && inWeek(a.localDate))
      .map((a) => a.taskId)
  ).size

  const grouped = new Map<string, ActionRecord[]>()
  for (const record of effective.filter((a) => a.result === 'progress')) {
    const key = record.goalId ?? '__standalone__'
    const list = grouped.get(key) ?? []
    list.push(record)
    grouped.set(key, list)
  }
  const byGoal = [...grouped.entries()].map(([goalId, records]) => ({
    goalId: goalId === '__standalone__' ? null : goalId,
    goalName: records[0]?.goalName || '独立待办',
    records: records.sort((a, b) => b.startedAt - a.startedAt)
  }))

  return { start, progressDays: progressDates.length, completedTasks, progressDates, byGoal }
}

/** 连续「完整本地日」无有效推进：今天不计入，从昨天往前数。 */
export function silentDays(data: Database, date: string): number {
  const days = new Set(
    data.actions
      .filter((a) => a.valid && a.result !== 'abandoned' && a.result !== null)
      .map((a) => a.localDate)
  )
  let count = 0
  for (let i = 1; i <= 60; i++) {
    const day = addDays(date, -i)
    if (days.has(day)) break
    count++
  }
  return count
}

export function lastNextStep(data: Database): ActionRecord | null {
  return [...data.actions]
    .filter((a) => a.valid && a.result !== 'abandoned' && a.nextStep.trim())
    .sort((a, b) => b.endedAt! - a.endedAt!)[0] ?? null
}

export function dateFromTimestamp(ts: number): string {
  return localDate(new Date(ts))
}

export function daysSince(day: string, date: string): number {
  return diffDays(day, date)
}
