<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { requestStart } from '../logic/navigation'
import Sheet from '../components/Sheet.vue'
import { formatDate, formatTime } from '../logic/date'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const id = computed(() => String(route.params.id ?? ''))
const task = computed(() => store.tasks.find((t) => t.id === id.value) ?? null)
const goal = computed(() => store.goals.find((g) => g.id === task.value?.goalId) ?? null)
const relatedIdeas = computed(() => store.ideas.filter((i) => i.taskId === id.value))
const records = computed(() => store.actions
  .filter((a) => a.taskId === id.value && a.valid && a.result !== 'abandoned')
  .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0)))

const editOpen = ref(false)
const deleteOpen = ref(false)
const form = reactive({ title: '', smallestStep: '', planWhen: '', planThen: '', scheduledDate: '', dueDate: '', goalId: null as string | null })

function openEdit(): void {
  const t = task.value
  if (!t) return
  form.title = t.title
  form.smallestStep = t.smallestStep
  form.planWhen = t.planWhen
  form.planThen = t.planThen
  form.scheduledDate = t.scheduledDate ?? ''
  form.dueDate = t.dueDate ?? ''
  form.goalId = t.goalId
  editOpen.value = true
}

async function saveEdit(): Promise<void> {
  if (!form.title.trim()) return
  const ok = await store.updateTask(id.value, {
    title: form.title.trim(),
    smallestStep: form.smallestStep,
    planWhen: form.planWhen,
    planThen: form.planThen,
    scheduledDate: form.scheduledDate || null,
    dueDate: form.dueDate || null,
    goalId: form.goalId
  })
  if (ok) editOpen.value = false
}

async function remove(): Promise<void> {
  const ok = await store.deleteTask(id.value)
  if (ok) await router.push('/records')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <button class="back-btn" aria-label="返回" @click="router.back()">‹</button>
      <div style="flex: 1"></div>
      <button class="btn btn-sm" @click="openEdit">编辑</button>
    </div>

    <template v-if="task">
      <div class="tiny muted">{{ goal ? goal.name : '独立待办' }} · {{ task.status === 'done' ? '已完成' : task.status === 'doing' ? '进行中' : '待做' }}</div>
      <h1 class="page-title" style="margin-top: 6px; font-size: 25px; overflow-wrap: anywhere">{{ task.title }}</h1>

      <div class="card" style="margin-top: 16px">
        <div class="tiny muted">眼前这一步</div>
        <div style="margin-top: 4px">{{ task.smallestStep || '还没写。可以在编辑里补一句，或从今日页点「轻一点」。' }}</div>
        <div v-if="task.planWhen && task.planThen" class="banner" style="margin-top: 12px">
          当 {{ task.planWhen }}，我就 {{ task.planThen }}
        </div>
        <div class="row-meta" style="margin-top: 12px">
          安排 {{ task.scheduledDate ? formatDate(task.scheduledDate, false) : '未安排' }}
          <span v-if="task.dueDate"> · 截止 {{ formatDate(task.dueDate, false) }}</span>
        </div>
      </div>

      <div class="btn-row" style="margin-top: 16px">
        <button v-if="task.status !== 'done'" class="btn btn-primary btn-sm" @click="requestStart(task.id)">开始</button>
        <button v-if="task.status !== 'done'" class="btn btn-sm" @click="store.completeTask(task.id)">完成任务</button>
        <button v-else class="btn btn-sm" @click="store.undoComplete(task.id)">撤销完成</button>
        <button class="btn btn-sm" @click="store.setPrimary(task.id)">设为今日首要</button>
        <button class="btn btn-sm" @click="store.scheduleTask(task.id, store.today, '已排到今天')">安排今天</button>
        <button class="btn btn-sm" @click="store.scheduleTask(task.id, null, '已移出日程')">移出日程</button>
        <button class="btn btn-sm btn-ghost" @click="deleteOpen = true">删除</button>
      </div>

      <section v-if="relatedIdeas.length" class="section">
        <div class="section-head"><h2 class="section-title">来自这些想法</h2></div>
        <div class="list">
          <div v-for="idea in relatedIdeas" :key="idea.id" class="row">
            <div class="row-main" role="button" @click="router.push(`/notes/${idea.id}`)">
              <div class="row-title" style="white-space: pre-wrap">{{ idea.text }}</div>
              <div class="row-meta">点开看原文</div>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2 class="section-title">这一步的足迹</h2><span class="section-hint">{{ records.length }} 条</span></div>
        <div v-if="records.length" class="timeline">
          <div v-for="record in records" :key="record.id" class="timeline-item">
            <div class="tiny muted">{{ record.localDate }} {{ record.endedAt ? formatTime(record.endedAt) : '' }}</div>
            <div>{{ record.progressText || (record.result === 'complete' ? '完成任务' : '一次行动') }}</div>
            <div v-if="record.nextStep" class="tiny muted">下一步：{{ record.nextStep }}</div>
          </div>
        </div>
        <div v-else class="empty"><div class="empty-title">还没有推进记录</div></div>
      </section>
    </template>
    <div v-else class="empty"><div class="empty-title">任务不存在</div><button class="btn btn-sm" style="margin-top: 12px" @click="router.push('/today')">回到今日</button></div>

    <Sheet v-if="editOpen" title="编辑任务" desc="完整长标题会原样保留。" @close="editOpen = false">
      <label class="field"><span class="field-label">标题</span><textarea v-model="form.title" class="textarea" rows="2"></textarea></label>
      <label class="field"><span class="field-label">最小一步</span><input v-model="form.smallestStep" class="input" /></label>
      <div class="card" style="margin-bottom: 14px">
        <div class="tiny muted">实施意图 · 情境由你自己识别，无须后台监听</div>
        <label class="field" style="margin-top: 10px; margin-bottom: 8px"><span class="field-label">当［情境］</span><input v-model="form.planWhen" class="input" /></label>
        <label class="field" style="margin-bottom: 0"><span class="field-label">我就［动作］</span><input v-model="form.planThen" class="input" /></label>
      </div>
      <label class="field"><span class="field-label">归属目标</span>
        <select v-model="form.goalId" class="select">
          <option :value="null">独立待办</option>
          <option v-for="g in store.activeGoals" :key="g.id" :value="g.id">{{ g.name }}</option>
        </select>
      </label>
      <label class="field"><span class="field-label">安排日期</span><input v-model="form.scheduledDate" type="date" class="input" /></label>
      <label class="field"><span class="field-label">截止日期（与安排日期分开）</span><input v-model="form.dueDate" type="date" class="input" /></label>
      <template #footer>
        <button class="btn" @click="editOpen = false">取消</button>
        <button class="btn btn-primary" :disabled="!form.title.trim()" @click="saveEdit">保存</button>
      </template>
    </Sheet>

    <Sheet v-if="deleteOpen" title="删除任务？" desc="关联想法会保留原文、解除引用；历史成果按快照回看。" @close="deleteOpen = false">
      <template #footer>
        <button class="btn" @click="deleteOpen = false">取消</button>
        <button class="btn btn-primary" @click="remove">确认删除</button>
      </template>
    </Sheet>
  </div>
</template>
