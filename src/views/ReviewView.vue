<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { formatDate } from '../logic/date'

const store = useAppStore()
const router = useRouter()
const week = computed(() => store.week.start)
const saved = computed(() => store.prefs.weeklyReviews.find((r) => r.week === week.value) ?? null)
const keep = ref('')
const next = ref('')

watch(saved, (value) => {
  keep.value = value?.keep ?? ''
  next.value = value?.next ?? ''
}, { immediate: true })

async function save(): Promise<void> {
  if (!keep.value.trim() && !next.value.trim()) return
  const ok = await store.saveWeeklyReview(week.value, keep.value, next.value)
  if (ok) await router.push('/footprints')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <button class="back-btn" aria-label="返回" @click="router.back()">‹</button>
      <div style="flex: 1"><h1 class="page-title">周回顾</h1><p class="page-sub">{{ formatDate(week, false) }} 起这一周 · 只问两个问题</p></div>
    </div>

    <div class="card">
      <div class="section-title">这一周留下的原文</div>
      <div v-if="store.week.byGoal.length" class="timeline" style="margin-top: 14px">
        <div v-for="group in store.week.byGoal" :key="group.goalName" class="timeline-item">
          <div class="tiny muted">{{ group.goalName }}</div>
          <div v-for="record in group.records.slice(0, 4)" :key="record.id" class="tiny">· {{ record.progressText }}</div>
        </div>
      </div>
      <p v-else class="tiny muted" style="margin-top: 10px">这周还没有进展原文。也可以凭印象写，不用凑数。</p>
      <div class="row-meta" style="margin-top: 12px">推进 {{ store.week.progressDays }} 天 · 完成 {{ store.week.completedTasks }} 项任务</div>
    </div>

    <label class="field" style="margin-top: 22px">
      <span class="field-label">哪一步最值得保留？</span>
      <textarea v-model="keep" class="textarea" rows="3" placeholder="工具调用的输入定下来了"></textarea>
    </label>
    <label class="field">
      <span class="field-label">下周先做什么？</span>
      <textarea v-model="next" class="textarea" rows="3" placeholder="补上失败时的返回值"></textarea>
    </label>

    <div class="btn-row">
      <button class="btn btn-primary" :disabled="!keep.trim() && !next.trim()" @click="save">保存周回顾</button>
      <button class="btn" @click="router.push('/footprints')">看足迹</button>
    </div>
  </div>
</template>
