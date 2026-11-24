<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { Goal } from '../types'
import { useAppStore } from '../stores/app'
import { diffDays, formatDate } from '../logic/date'

const props = defineProps<{ goal: Goal }>()
const store = useAppStore()
const router = useRouter()

const list = computed(() => store.tasksOf(props.goal.id))
const undone = computed(() => list.value.filter((t) => t.status !== 'done'))
const doneCount = computed(() => list.value.length - undone.value.length)
const next = computed(() => undone.value[0] ?? null)
const lastProgress = computed(() => {
  const dates = store.actions
    .filter((a) => a.valid && a.goalId === props.goal.id && a.result !== 'abandoned')
    .map((a) => a.localDate)
    .sort()
  const last = dates[dates.length - 1]
  if (!last) return '还没有推进记录'
  const days = diffDays(last, store.today)
  if (days === 0) return '今天推进过'
  if (days === 1) return '昨天推进过'
  return `上次推进 ${formatDate(last, false)}`
})
</script>

<template>
  <div class="card" role="button" tabindex="0" @click="router.push(`/goals/${goal.id}`)" @keydown.enter="router.push(`/goals/${goal.id}`)">
    <div style="display: flex; align-items: center; gap: 8px">
      <span class="dot" :style="{ background: goal.color, marginTop: 0 }"></span>
      <div class="strong" style="font-size: 16px; flex: 1">{{ goal.name }}</div>
      <span v-if="goal.status !== 'active'" class="tag">{{ goal.status === 'paused' ? '已暂停' : '已完成' }}</span>
      <span class="muted">›</span>
    </div>
    <div class="row-meta" style="margin-top: 8px">
      {{ lastProgress }} · 已完成 {{ doneCount }} / {{ list.length }} 项
    </div>
    <div v-if="next" class="banner" style="margin-top: 12px">
      <span class="tiny">下一步：{{ next.smallestStep || next.title }}</span>
    </div>
    <div v-else-if="list.length" class="tiny muted" style="margin-top: 10px">任务都做完了，回去核对成功标准。</div>
    <div v-else class="tiny muted" style="margin-top: 10px">还没有任务，打开添加第一步。</div>
  </div>
</template>
