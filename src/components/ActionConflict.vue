<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { ui } from '../logic/ui'
import { proceedStart } from '../logic/navigation'
import Sheet from './Sheet.vue'

const store = useAppStore()
const router = useRouter()
const progressText = ref('')
const showProgress = ref(false)

const openTask = computed(() => store.tasks.find((t) => t.id === ui.pendingStart?.openTaskId) ?? null)
const nextTask = computed(() => store.tasks.find((t) => t.id === ui.pendingStart?.taskId) ?? null)

function close(): void {
  ui.pendingStart = null
  progressText.value = ''
  showProgress.value = false
}

async function continueOriginal(): Promise<void> {
  const id = ui.pendingStart?.openTaskId
  close()
  if (id) await router.push(`/action/${id}`)
}

async function finishAndSwitch(withProgress: boolean): Promise<void> {
  if (withProgress && !progressText.value.trim()) return
  const ok = await store.finishAction({
    result: withProgress ? 'progress' : 'abandoned',
    progressText: progressText.value,
    nextStep: ''
  })
  if (!ok) return
  const target = ui.pendingStart?.taskId
  close()
  if (target) await proceedStart(target)
}
</script>

<template>
  <Sheet
    v-if="ui.pendingStart"
    title="还有一件事没收尾"
    :desc="`「${openTask?.title ?? '上次的事'}」正在进行中。继续它，或先收尾再切换。`"
    @close="close"
  >
    <div class="card" style="margin-bottom: 14px">
      <div class="tiny muted">想切换到</div>
      <div class="strong" style="margin-top: 4px">{{ nextTask?.title }}</div>
    </div>

    <template v-if="showProgress">
      <label class="field">
        <span class="field-label">刚才做到了哪一步？（写一句就行）</span>
        <textarea v-model="progressText" class="textarea" rows="3" placeholder="输入已定，下一步补错误返回"></textarea>
      </label>
    </template>

    <div class="list" style="gap: 8px">
      <button class="btn btn-block btn-dark" @click="continueOriginal">继续原任务</button>
      <button v-if="!showProgress" class="btn btn-block" @click="showProgress = true">记一句进展后切换</button>
      <button v-else class="btn btn-block btn-primary" :disabled="!progressText.trim()" @click="finishAndSwitch(true)">保存进展并切换</button>
      <button class="btn btn-block btn-ghost" @click="finishAndSwitch(false)">直接收尾并切换（不计成果）</button>
    </div>

    <template #footer>
      <button class="btn btn-ghost btn-block" @click="close">取消</button>
    </template>
  </Sheet>
</template>
