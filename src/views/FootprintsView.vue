<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { addDays, formatDate } from '../logic/date'
import type { ActionRecord } from '../types'

const store = useAppStore()
const router = useRouter()
const scope = ref<'week' | 'all'>('week')
const selectedDate = ref<string | null>(null)

const inScope = (record: ActionRecord): boolean => {
  if (scope.value === 'all') return true
  return record.localDate >= store.week.start && record.localDate <= addDays(store.week.start, 6)
}
const records = computed(() => store.actions
  .filter((a) => a.valid && a.result !== 'abandoned' && a.result !== null && inScope(a))
  .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0)))
const shown = computed(() => selectedDate.value
  ? records.value.filter((a) => a.localDate === selectedDate.value)
  : records.value)
const progress = computed(() => shown.value.filter((a) => a.result === 'progress'))
const completed = computed(() => shown.value.filter((a) => a.result === 'complete'))
const dateChips = computed(() => {
  const days = Array.from({ length: 7 }, (_, i) => addDays(store.week.start, i))
  const extra = [...new Set(records.value.map((a) => a.localDate))].filter((d) => !days.includes(d))
  return [...days, ...extra]
})
const byGoal = computed(() => {
  const map = new Map<string, ActionRecord[]>()
  for (const record of progress.value) {
    const key = record.goalName || '独立待办'
    map.set(key, [...(map.get(key) ?? []), record])
  }
  return [...map.entries()]
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <button class="back-btn" aria-label="返回" @click="router.back()">‹</button>
      <div style="flex: 1"><h1 class="page-title">足迹</h1><p class="page-sub">看得到具体变化，不靠计数撑场面。</p></div>
    </div>

    <div class="stat-grid">
      <div class="stat"><div class="stat-num">{{ store.week.progressDays }}</div><div class="stat-label">本周推进天数</div></div>
      <div class="stat"><div class="stat-num">{{ store.week.completedTasks }}</div><div class="stat-label">本周完成任务</div></div>
    </div>
    <p class="tiny muted" style="margin: 8px 0 0">推进天数按记录当时的本地日期去重，同日多项算一天；周一为一周起点。</p>

    <div class="btn-row" style="margin-top: 18px">
      <button class="chip" :class="{ active: scope === 'week' }" @click="scope = 'week'; selectedDate = null">本周</button>
      <button class="chip" :class="{ active: scope === 'all' }" @click="scope = 'all'; selectedDate = null">全部</button>
      <button class="chip" @click="router.push('/review')">写周回顾 ›</button>
    </div>

    <section class="section">
      <div class="section-head"><h2 class="section-title">按日期回看</h2><span class="section-hint">点一天筛选</span></div>
      <div class="btn-row">
        <button
          v-for="day in dateChips"
          :key="day"
          class="chip"
          :class="{ active: selectedDate === day }"
          @click="selectedDate = selectedDate === day ? null : day"
        >
          {{ formatDate(day, false) }}{{ records.some(r => r.localDate === day) ? ' ·' : '' }}
        </button>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2 class="section-title">按目标排列的进展原文</h2><span class="section-hint">{{ progress.length }} 条</span></div>
      <div v-if="byGoal.length" class="list">
        <div v-for="[name, list] in byGoal" :key="name" class="card">
          <div class="strong" style="margin-bottom: 10px">{{ name }}</div>
          <div class="timeline">
            <div v-for="record in list" :key="record.id" class="timeline-item">
              <div class="tiny muted">{{ record.localDate }} · {{ record.taskTitle }}</div>
              <div>{{ record.progressText }}</div>
              <div v-if="record.nextStep" class="tiny muted">下一步：{{ record.nextStep }}</div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="empty"><div class="empty-title">这段时间还没有进展原文</div><div class="tiny">在行动页点「有进展」写一句，就会留在这里。</div></div>
    </section>

    <section v-if="completed.length" class="section">
      <div class="section-head"><h2 class="section-title">完成事件</h2><span class="section-hint">{{ completed.length }} 条</span></div>
      <div class="list">
        <div v-for="record in completed" :key="record.id" class="row">
          <div class="row-main">
            <div class="row-title">{{ record.taskTitle }}</div>
            <div class="row-meta">{{ record.goalName }} · {{ record.localDate }}</div>
          </div>
          <span class="tag tag-ok">完成</span>
        </div>
      </div>
    </section>
  </div>
</template>
