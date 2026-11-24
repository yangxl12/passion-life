import { reactive } from 'vue'

export type QuickType = 'idea' | 'todo'

export const ui = reactive({
  quickOpen: false,
  quickType: 'idea' as QuickType,
  quickPreset: '',
  updateAvailable: false,
  pendingStart: null as { taskId: string; openTaskId: string } | null
})

export function openQuickAdd(type: QuickType = 'idea', preset = ''): void {
  ui.quickType = type
  ui.quickPreset = preset
  ui.quickOpen = true
}

export function closeQuickAdd(): void {
  ui.quickOpen = false
  ui.quickPreset = ''
}
