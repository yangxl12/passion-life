export type ID = string
export type GoalStatus = 'active' | 'paused' | 'done'
export type TaskStatus = 'todo' | 'doing' | 'done'
export type Tone = 'plain' | 'energetic' | 'gentle' | 'off'
export type QuoteScene = 'start' | 'choose' | 'persist' | 'setback' | 'finish' | 'restart'
export type QuoteKind = 'classic' | 'original' | 'user'
export type ActionResult = 'progress' | 'complete' | 'abandoned'

export interface Goal {
  id: ID
  name: string
  outcome: string
  reason: string
  targetDate: string | null
  status: GoalStatus
  archived: boolean
  color: string
  order: number
  createdAt: number
  updatedAt: number
  rev: number
}

export interface Task {
  id: ID
  goalId: ID | null
  title: string
  smallestStep: string
  planWhen: string
  planThen: string
  scheduledDate: string | null
  dueDate: string | null
  status: TaskStatus
  order: number
  completedAt: number | null
  completionEventId: ID | null
  createdAt: number
  updatedAt: number
  rev: number
}

export interface Idea {
  id: ID
  text: string
  goalId: ID | null
  taskId: ID | null
  createdAt: number
  updatedAt: number
  rev: number
}

export interface ActionRecord {
  id: ID
  taskId: ID
  goalId: ID | null
  goalName: string
  taskTitle: string
  startedAt: number
  endedAt: number | null
  result: ActionResult | null
  progressText: string
  nextStep: string
  localDate: string
  valid: boolean
  createdAt: number
  rev: number
}

export interface QuoteVisit {
  quoteId: string
  date: string
  scene: QuoteScene
}

export interface Prefs {
  id: 'prefs'
  primaryTaskId: ID | null
  openActionId: ID | null
  timerEndsAt: number | null
  tone: Tone
  favoriteQuoteIds: string[]
  hiddenQuoteIds: string[]
  quoteHistory: QuoteVisit[]
  dailyQuote: { date: string; scene: QuoteScene; quoteId: string } | null
  showInspiration: boolean
  restartCardDismissedOn: string | null
  challengeDismissedOn: string | null
  weeklyReviews: { week: string; keep: string; next: string; savedAt: number }[]
  lastExportAt: number | null
  contentVersion: string
  offlineReady: boolean
  persistence: 'unknown' | 'granted' | 'denied'
  rev: number
}

export interface BackupFile {
  format: 'passionLife'
  version: number
  exportedAt: string
  data: {
    goals: Goal[]
    tasks: Task[]
    ideas: Idea[]
    actions: ActionRecord[]
    prefs: Prefs
  }
}

export interface Database {
  goals: Goal[]
  tasks: Task[]
  ideas: Idea[]
  actions: ActionRecord[]
  prefs: Prefs
}

export const BACKUP_VERSION = 1
export const CONTENT_VERSION = '2026-11-24.1'
