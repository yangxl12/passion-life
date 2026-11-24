<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import TaskRow from '../components/TaskRow.vue'
import AddTaskSheet from '../components/AddTaskSheet.vue'
import Sheet from '../components/Sheet.vue'
import { formatDate } from '../logic/date'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const id = computed(() => String(route.params.id ?? ''))
const goal = computed(() => store.goals.find((g) => g.id === id.value) ?? null)
const list = computed(() => store.tasksOf(id.value))
const undone = computed(() => list.value.filter((t) => t.status !== 'done'))
const next = computed(() => undone.value[0] ?? null)
const relatedIdeas = computed(() => store.ideas.filter((i) => i.goalId === id.value))
const records = computed(() => store.actions
  .filter((a) => a.goalId === id.value && a.valid && a.result !== 'abandoned')
  .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0)))

const editOpen = ref(false)
const addOpen = ref(false)
const completeOpen = ref(false)
const deleteOpen = ref(false)
const deleteMode = ref<'keep' | 'delete'>('keep')
const form = reactive({ name: '', outcome: '', reason: '', targetDate: '' })

function openEdit(): void {
  const g = goal.value
  if (!g) return
  form.name = g.name
  form.outcome = g.outcome
  form.reason = g.reason
  form.targetDate = g.targetDate ?? ''
  editOpen.value = true
}

async function saveEdit(): Promise<void> {
  if (!form.name.trim()) return
  const ok = await store.updateGoal(id.value, {
    name: form.name.trim(),
    outcome: form.outcome,
    reason: form.reason,
    targetDate: form.targetDate || null
  })
  if (ok) editOpen.value = false
}

async function confirmComplete(convert: boolean): Promise<void> {
  if (convert) {
    for (const task of undone.value) await store.updateTask(task.id, { goalId: null }, '')
  }
  await store.setGoalStatus(id.value, 'done')
  completeOpen.value = false
}

async function confirmDelete(): Promise<void> {
  const ok = await store.deleteGoal(id.value, deleteMode.value)
  if (ok) await router.push('/goals')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <button class="back-btn" aria-label="返回" @click="router.back()">‹</button>
      <div style="flex: 1"></div>
      <button class="btn btn-sm" @click="openEdit">编辑</button>
    </div>

    <template v-if="goal">
      <div style="display: flex; align-items: center; gap: 10px">
        <span class="dot" :style="{ background: goal.color, marginTop: 0, width: 12, height: 12 }"></span>
        <h1 class="page-title" style="font-size: 24px">{{ goal.name }}</h1>
      </div>

      <div class="card" style="margin-top: 16px">
        <div class="tiny muted">想达成的结果</div>
        <div style="margin-top: 4px">{{ goal.outcome || '还没写。做完之前补一句，方便核对。' }}</div>
        <div class="divider"></div>
        <div class="tiny muted">我的理由</div>
        <div style="margin-top: 4px">{{ goal.reason || '还没写。' }}</div>
        <div class="row-meta" style="margin-top: 10px">
          目标日 {{ goal.targetDate ? formatDate(goal.targetDate, false) : '未设' }} · 已完成 {{ list.length - undone.length }} / {{ list.length }} 项
        </div>
      </div>

      <div v-if="list.length && !undone.length && goal.status === 'active'" class="banner banner-accent" style="margin-top: 12px">
        <span>任务都做完了。核对一下成功标准，由你确认目标是否达成。</span>
        <button class="btn btn-sm btn-primary" @click="completeOpen = true">核对</button>
      </div>

      <section class="section">
        <div class="section-head">
          <h2 class="section-title">下一项任务</h2>
          <span class="section-hint">已完成 {{ list.length - undone.length }} / {{ list.length }} 项</span>
        </div>
        <div v-if="next" class="card">
          <div class="strong" style="font-size: 17px">{{ next.title }}</div>
          <div v-if="next.smallestStep" class="row-meta">下一步：{{ next.smallestStep }}</div>
          <div v-if="next.planWhen && next.planThen" class="banner" style="margin-top: 12px">
            当 {{ next.planWhen }}，我就 {{ next.planThen }}
          </div>
          <div class="btn-row" style="margin-top: 14px">
            <button class="btn btn-sm btn-primary" @click="router.push(`/tasks/${next.id}`)">打开</button>
            <button class="btn btn-sm" @click="store.scheduleTask(next.id, store.today, '已排到今天')">安排今天</button>
          </div>
        </div>
        <div v-else class="empty"><div class="empty-title">没有待做任务了</div></div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2 class="section-title">任务列表</h2>
          <button class="chip" @click="addOpen = true">＋ 添加任务</button>
        </div>
        <div v-if="list.length" class="list">
          <div v-for="(task, index) in list" :key="task.id">
            <TaskRow :task="task" :show-goal="false" show-schedule />
            <div v-if="list.length > 1" class="btn-row" style="margin: 6px 0 8px 4px">
              <button class="chip" :disabled="index === 0" aria-label="上移" @click="store.reorderTask(task.id, -1)">↑</button>
              <button class="chip" :disabled="index === list.length - 1" aria-label="下移" @click="store.reorderTask(task.id, 1)">↓</button>
            </div>
          </div>
        </div>
        <div v-else class="empty">
          <div class="empty-title">还没有任务</div>
          <button class="btn btn-sm btn-primary" style="margin-top: 12px" @click="addOpen = true">添加第一步</button>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2 class="section-title">这个目标的足迹</h2><span class="section-hint">{{ records.length }} 条</span></div>
        <div v-if="records.length" class="timeline">
          <div v-for="record in records.slice(0, 12)" :key="record.id" class="timeline-item">
            <div class="tiny muted">{{ record.localDate }} · {{ record.taskTitle }}</div>
            <div>{{ record.progressText || (record.result === 'complete' ? '完成任务' : '') }}</div>
            <div v-if="record.nextStep" class="tiny muted">下一步：{{ record.nextStep }}</div>
          </div>
        </div>
        <div v-else class="empty"><div class="empty-title">还没有推进记录</div></div>
      </section>

      <section class="section">
        <div class="section-head"><h2 class="section-title">目标操作</h2></div>
        <div class="btn-row">
          <button class="btn btn-sm" @click="store.setGoalStatus(id, goal.status === 'paused' ? 'active' : 'paused')">
            {{ goal.status === 'paused' ? '恢复' : '暂停' }}
          </button>
          <button class="btn btn-sm" @click="store.updateGoal(id, { archived: !goal.archived }, goal.archived ? '已取消归档' : '已归档')">
            {{ goal.archived ? '取消归档' : '归档' }}
          </button>
          <button class="btn btn-sm" @click="completeOpen = true">标记完成</button>
          <button class="btn btn-sm btn-ghost" @click="deleteOpen = true">删除</button>
        </div>
      </section>
    </template>

    <div v-else class="empty"><div class="empty-title">目标不存在</div><button class="btn btn-sm" style="margin-top: 12px" @click="router.push('/goals')">回到目标列表</button></div>

    <Sheet v-if="editOpen" title="编辑目标" @close="editOpen = false">
      <label class="field"><span class="field-label">名称</span><input v-model="form.name" class="input" /></label>
      <label class="field"><span class="field-label">成功标准</span><textarea v-model="form.outcome" class="textarea" rows="2"></textarea></label>
      <label class="field"><span class="field-label">我的理由</span><textarea v-model="form.reason" class="textarea" rows="2"></textarea></label>
      <label class="field"><span class="field-label">目标日</span><input v-model="form.targetDate" type="date" class="input" /></label>
      <template #footer>
        <button class="btn" @click="editOpen = false">取消</button>
        <button class="btn btn-primary" :disabled="!form.name.trim()" @click="saveEdit">保存</button>
      </template>
    </Sheet>

    <Sheet v-if="completeOpen" title="核对成功标准" desc="由你确认，系统不替你判定目标是否达成。" @close="completeOpen = false">
      <div class="card" style="margin-bottom: 14px">
        <div class="tiny muted">成功标准</div>
        <div style="margin-top: 4px">{{ goal?.outcome || '（未填写）' }}</div>
      </div>
      <div v-if="undone.length" class="banner" style="margin-bottom: 14px">
        <div>
          还有 {{ undone.length }} 项未完任务：
          <div v-for="task in undone" :key="task.id" class="tiny" style="margin-top: 4px">· {{ task.title }}</div>
        </div>
      </div>
      <p class="tiny muted">可以把未完任务转成独立待办，也可以保留在已完成目标下（保留项不再出现在首页推荐）。</p>
      <template #footer>
        <button v-if="undone.length" class="btn" @click="confirmComplete(true)">转出后完成</button>
        <button class="btn btn-primary" @click="confirmComplete(false)">直接标记完成</button>
      </template>
    </Sheet>

    <Sheet v-if="deleteOpen" title="删除目标" desc="先看影响，再决定任务的去留。" @close="deleteOpen = false">
      <div class="card" style="margin-bottom: 14px">
        <div>任务 {{ list.length }} 项 · 关联想法 {{ relatedIdeas.length }} 条 · 推进记录 {{ records.length }} 条</div>
        <p class="tiny muted" style="margin: 8px 0 0">行动记录按当时的快照保留，仍可在足迹里回看。</p>
      </div>
      <div class="btn-row" style="margin-bottom: 14px">
        <button class="chip" :class="{ active: deleteMode === 'keep' }" @click="deleteMode = 'keep'">任务保留为独立待办</button>
        <button class="chip" :class="{ active: deleteMode === 'delete' }" @click="deleteMode = 'delete'">连任务一起删除</button>
      </div>
      <template #footer>
        <button class="btn" @click="deleteOpen = false">取消</button>
        <button class="btn btn-primary" @click="confirmDelete">确认删除</button>
      </template>
    </Sheet>

    <AddTaskSheet v-if="addOpen" :goal-id="id" @close="addOpen = false" @created="addOpen = false" />
  </div>
</template>
