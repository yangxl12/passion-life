<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { requestStart } from '../logic/navigation'
import Sheet from '../components/Sheet.vue'
import { formatDuration, formatTime } from '../logic/date'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const id = computed(() => String(route.params.id ?? ''))
const task = computed(() => store.tasks.find((t) => t.id === id.value) ?? null)
const goal = computed(() => store.goals.find((g) => g.id === task.value?.goalId) ?? null)
const action = computed(() => store.openAction)
const inProgress = computed(() => Boolean(action.value && action.value.taskId === id.value))

const now = ref(Date.now())
let ticker: number | undefined
function startTicker(): void {
  if (ticker) return
  ticker = window.setInterval(() => { now.value = Date.now() }, 1000)
}
function stopTicker(): void {
  if (ticker) {
    window.clearInterval(ticker)
    ticker = undefined
  }
}
onUnmounted(stopTicker)

const remaining = computed(() => store.prefs.timerEndsAt ? Math.max(0, store.prefs.timerEndsAt - now.value) : 0)
const timerRunning = computed(() => store.prefs.timerEndsAt !== null && remaining.value > 0)
const timerDone = computed(() => store.prefs.timerEndsAt !== null && remaining.value === 0)

// 只在倒计时进行中每秒刷新；无计时或已归零时挂起，避免页面停留期间空转
watch(remaining, (value) => {
  if (value > 0) startTicker()
  else {
    now.value = Date.now()
    stopTicker()
  }
}, { immediate: true })

const progressOpen = ref(false)
const progressText = ref('')
const nextStep = ref('')
const resultText = ref('')
const saving = ref(false)

async function finish(result: 'progress' | 'complete' | 'abandoned'): Promise<void> {
  if (saving.value) return
  if (result === 'progress' && !progressText.value.trim()) return
  saving.value = true
  const label = task.value?.title ?? '这一步'
  const progress = progressText.value.trim()
  const ok = await store.finishAction({
    result,
    progressText: progressText.value,
    nextStep: nextStep.value
  })
  saving.value = false
  if (!ok) return
  progressOpen.value = false
  progressText.value = ''
  nextStep.value = ''
  if (result === 'abandoned') {
    await router.push('/today')
    return
  }
  resultText.value = result === 'progress'
    ? `${label} · ${progress}`
    : `${goal.value?.name ?? '独立待办'} · ${label} 已完成`
}

function startHere(): void {
  requestStart(id.value)
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <button class="back-btn" aria-label="返回，保留现场" @click="router.back()">‹</button>
      <div class="page-sub" style="flex: 1; text-align: center; margin: 0">退出会保留现场</div>
      <div style="width: 44px"></div>
    </div>

    <template v-if="task">
      <div v-if="resultText" class="card banner-accent">
        <div class="tiny muted">刚才留下的成果</div>
        <div class="strong" style="font-size: 18px; margin: 8px 0 14px">{{ resultText }}</div>
        <div class="btn-row">
          <button class="btn btn-sm btn-primary" @click="router.push('/footprints')">查看成果原文</button>
          <button class="btn btn-sm" @click="router.push('/today')">回今日</button>
        </div>
      </div>

      <template v-if="!resultText && inProgress">
        <div class="tiny muted">{{ goal?.name ?? '独立待办' }} · {{ action?.startedAt ? `${formatTime(action.startedAt)} 开始` : '' }}</div>
        <h1 class="page-title" style="margin-top: 6px; overflow-wrap: anywhere">{{ task.title }}</h1>

        <div class="card" style="margin-top: 16px">
          <div class="tiny muted">当前这一步</div>
          <div style="font-size: 18px; margin-top: 6px">{{ task.smallestStep || '打开材料，先做一个能看见结果的小动作。' }}</div>
          <div v-if="task.planWhen && task.planThen" class="banner" style="margin-top: 12px">当 {{ task.planWhen }}，我就 {{ task.planThen }}</div>
        </div>

        <div class="card" style="margin-top: 12px">
          <div class="section-head" style="margin-bottom: 8px">
            <h2 class="section-title">五分钟启动（可选）</h2>
            <span class="section-hint">不开计时也能完成</span>
          </div>
          <div v-if="timerRunning || timerDone" class="stat-num" style="font-variant-numeric: tabular-nums">{{ formatDuration(remaining) }}</div>
          <p v-if="timerDone" class="tiny" style="color: var(--accent)">五分钟到了。继续做，或现在收尾记一句成果。</p>
          <div class="btn-row" style="margin-top: 12px">
            <button v-if="!timerRunning && !timerDone" class="btn btn-sm" @click="store.setTimer(5)">启动五分钟</button>
            <template v-else-if="timerRunning">
              <button class="btn btn-sm" @click="store.setTimer(null)">取消计时</button>
            </template>
            <template v-else>
              <button class="btn btn-sm btn-primary" @click="store.setTimer(null)">继续做</button>
              <button class="btn btn-sm" @click="progressOpen = true">收尾记一句</button>
            </template>
          </div>
          <p class="tiny muted" style="margin: 10px 0 0">计时归零不会自动完成任务，也不把离开时长算作专注成果。</p>
        </div>

        <div class="btn-row" style="margin-top: 20px">
          <button class="btn btn-primary" @click="progressOpen = true">有进展</button>
          <button class="btn" @click="finish('complete')">完成任务</button>
        </div>
        <button class="btn btn-ghost btn-sm" style="margin-top: 12px" @click="finish('abandoned')">放弃这次（不计成果）</button>
      </template>

      <div v-else-if="!resultText" class="empty">
        <div class="empty-title">这一步还没开始</div>
        <div class="tiny">锁屏或刷新后，已保存的起始时间会自动恢复。</div>
        <button class="btn btn-primary btn-sm" style="margin-top: 14px" @click="startHere">开始这一步</button>
      </div>
    </template>
    <div v-else class="empty"><div class="empty-title">任务不存在</div></div>

    <Sheet v-if="progressOpen" title="记下这一步" desc="写一句具体进展；下一步可选，明天从这句继续。" @close="progressOpen = false">
      <label class="field">
        <span class="field-label">做到了什么</span>
        <textarea v-model="progressText" class="textarea" rows="3" placeholder="输入已定，下一步补错误返回"></textarea>
      </label>
      <label class="field">
        <span class="field-label">下次从哪继续（可选）</span>
        <input v-model="nextStep" class="input" placeholder="补上失败时的返回值" />
      </label>
      <p class="tiny muted">保存后本次行动结束，任务仍回到待做；完成数不会变。</p>
      <template #footer>
        <button class="btn" @click="progressOpen = false">返回</button>
        <button class="btn btn-primary" :disabled="!progressText.trim() || saving" @click="finish('progress')">保存进展</button>
      </template>
    </Sheet>
  </div>
</template>
