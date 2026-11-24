<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import TaskRow from '../components/TaskRow.vue'
import Sheet from '../components/Sheet.vue'
import type { Idea } from '../types'
import { openQuickAdd } from '../logic/ui'

const store = useAppStore()
const router = useRouter()
const tab = ref<'idea' | 'todo'>('idea')
const query = ref('')
const filter = ref<'all' | 'standalone' | 'linked'>('all')

const keyword = computed(() => query.value.trim().toLowerCase())
const ideas = computed(() => [...store.ideas]
  .filter((i) => !keyword.value || i.text.toLowerCase().includes(keyword.value))
  .sort((a, b) => b.updatedAt - a.updatedAt))
const todos = computed(() => store.tasks
  .filter((t) => t.status !== 'done')
  .filter((t) => filter.value === 'all' || (filter.value === 'standalone' ? !t.goalId : Boolean(t.goalId)))
  .filter((t) => !keyword.value || `${t.title} ${t.smallestStep}`.toLowerCase().includes(keyword.value))
  .sort((a, b) => b.updatedAt - a.updatedAt))
const doneTodos = computed(() => store.tasks
  .filter((t) => t.status === 'done')
  .filter((t) => !keyword.value || `${t.title} ${t.smallestStep}`.toLowerCase().includes(keyword.value))
  .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)))

const convertTarget = ref<Idea | null>(null)
const convertTitle = ref('')
const convertGoalId = ref<string | null>(null)
const editTarget = ref<Idea | null>(null)
const editText = ref('')

function openConvert(idea: Idea): void {
  if (idea.taskId) {
    void router.push(`/tasks/${idea.taskId}`)
    return
  }
  convertTarget.value = idea
  convertTitle.value = idea.text.split('\n')[0]?.slice(0, 40) ?? ''
  convertGoalId.value = idea.goalId
}

async function doConvert(): Promise<void> {
  const idea = convertTarget.value
  if (!idea) return
  const task = await store.convertIdeaToTask(idea.id, convertTitle.value, convertGoalId.value)
  if (!task) return
  convertTarget.value = null
  await router.push(`/tasks/${task.id}`)
}

function openEdit(idea: Idea): void {
  editTarget.value = idea
  editText.value = idea.text
}

async function saveEdit(): Promise<void> {
  const idea = editTarget.value
  if (!idea || !editText.value.trim()) return
  const ok = await store.updateIdea(idea.id, { text: editText.value })
  if (ok) editTarget.value = null
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">记录</h1>
        <p class="page-sub">先存下来，晚点再决定用途。</p>
      </div>
      <button class="btn btn-sm btn-primary" @click="openQuickAdd(tab)">＋ 记一笔</button>
    </div>

    <div class="btn-row" style="margin-bottom: 12px">
      <button class="chip" :class="{ active: tab === 'idea' }" @click="tab = 'idea'">想法 {{ store.ideas.length }}</button>
      <button class="chip" :class="{ active: tab === 'todo' }" @click="tab = 'todo'">待办 {{ store.tasks.filter(t => t.status !== 'done').length }}</button>
    </div>

    <input v-model="query" class="input" type="search" placeholder="搜索标题与正文" />

    <template v-if="tab === 'todo'">
      <div class="btn-row" style="margin: 12px 0">
        <button class="chip" :class="{ active: filter === 'all' }" @click="filter = 'all'">全部</button>
        <button class="chip" :class="{ active: filter === 'standalone' }" @click="filter = 'standalone'">独立</button>
        <button class="chip" :class="{ active: filter === 'linked' }" @click="filter = 'linked'">有关联目标</button>
      </div>
    </template>

    <section class="section" style="margin-top: 16px">
      <template v-if="tab === 'idea'">
        <div v-if="ideas.length" class="list">
          <div v-for="idea in ideas" :key="idea.id" class="row">
            <div class="row-main" role="button" tabindex="0" @click="router.push(`/notes/${idea.id}`)" @keydown.enter="router.push(`/notes/${idea.id}`)">
              <div class="row-title" style="white-space: pre-wrap">{{ idea.text }}</div>
              <div class="row-meta">
                <span v-if="idea.goalId" class="tag">{{ store.goalName(idea.goalId) }}</span>
                <span v-if="idea.taskId" class="tag tag-ok">已转待办</span>
                {{ new Date(idea.updatedAt).toLocaleDateString('zh-CN') }}
              </div>
            </div>
            <div class="row-actions">
              <button class="btn btn-sm" @click.stop="openEdit(idea)">编辑</button>
              <button class="btn btn-sm" @click.stop="openConvert(idea)">{{ idea.taskId ? '打开任务' : '转待办' }}</button>
            </div>
          </div>
        </div>
        <div v-else class="empty">
          <div class="empty-title">{{ keyword ? '没找到相关内容' : '还没有想法' }}</div>
          <div class="tiny">想到什么先记一句，不用分类。</div>
          <button v-if="!keyword" class="btn btn-sm btn-primary" style="margin-top: 12px" @click="openQuickAdd('idea')">记下第一件事</button>
        </div>
      </template>

      <template v-else>
        <div v-if="todos.length" class="list">
          <TaskRow v-for="task in todos" :key="task.id" :task="task" show-schedule />
        </div>
        <div v-else class="empty"><div class="empty-title">这里没有待办</div><div class="tiny">可以从任意页面点右下角的 ＋ 添一条。</div></div>
        <div v-if="doneTodos.length" style="margin-top: 24px">
          <div class="section-head"><h2 class="section-title">已完成</h2><span class="section-hint">可撤销</span></div>
          <div class="list"><TaskRow v-for="task in doneTodos" :key="task.id" :task="task" /></div>
        </div>
      </template>
    </section>

    <Sheet v-if="convertTarget" title="转为待办" desc="确认行动标题，原文会原样保留。" @close="convertTarget = null">
      <div class="card" style="margin-bottom: 14px">
        <div class="tiny muted">原文</div>
        <div style="margin-top: 4px; white-space: pre-wrap">{{ convertTarget.text }}</div>
      </div>
      <label class="field">
        <span class="field-label">行动标题</span>
        <input v-model="convertTitle" class="input" />
      </label>
      <label class="field">
        <span class="field-label">归属目标（可选）</span>
        <select v-model="convertGoalId" class="select">
          <option :value="null">不归属，先当独立待办</option>
          <option v-for="goal in store.activeGoals" :key="goal.id" :value="goal.id">{{ goal.name }}</option>
        </select>
      </label>
      <template #footer>
        <button class="btn" @click="convertTarget = null">取消</button>
        <button class="btn btn-primary" :disabled="!convertTitle.trim()" @click="doConvert">确认转待办</button>
      </template>
    </Sheet>

    <Sheet v-if="editTarget" title="编辑原文" desc="编辑原文不会覆盖已转出的任务。" @close="editTarget = null">
      <label class="field">
        <span class="field-label">正文</span>
        <textarea v-model="editText" class="textarea" rows="5"></textarea>
      </label>
      <template #footer>
        <button class="btn" @click="editTarget = null">取消</button>
        <button class="btn btn-primary" :disabled="!editText.trim()" @click="saveEdit">保存</button>
      </template>
    </Sheet>
  </div>
</template>
