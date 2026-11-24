import { useAppStore } from '../stores/app'
import router from '../router'
import { ui } from './ui'

/** 开始前统一处理「已有进行中任务」：先让用户选继续原任务，还是收尾再切换。 */
export function requestStart(taskId: string): void {
  const store = useAppStore()
  const open = store.openAction
  if (open && open.taskId !== taskId) {
    ui.pendingStart = { taskId, openTaskId: open.taskId }
    return
  }
  void proceedStart(taskId)
}

export async function proceedStart(taskId: string): Promise<void> {
  const store = useAppStore()
  const action = await store.startAction(taskId)
  if (action) await router.push(`/action/${taskId}`)
}
