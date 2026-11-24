<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import GoalCard from '../components/GoalCard.vue'
import AddTaskSheet from '../components/AddTaskSheet.vue'
import Sheet from '../components/Sheet.vue'

const store = useAppStore()
const router = useRouter()
const createOpen = ref(false)
const folded = ref(true)
const addForGoal = ref<string | null>(null)
const form = reactive({ name: '', outcome: '', reason: '', targetDate: '' })

const foldedGoals = computed(() => store.goals
  .filter((g) => g.status !== 'active' || g.archived)
  .sort((a, b) => a.order - b.order))

async function submit(): Promise<void> {
  if (!form.name.trim()) return
  const goal = await store.createGoal({
    name: form.name,
    outcome: form.outcome,
    reason: form.reason,
    targetDate: form.targetDate || null
  })
  if (!goal) return
  form.name = ''
  form.outcome = ''
  form.reason = ''
  form.targetDate = ''
  createOpen.value = false
  await router.push(`/goals/${goal.id}`)
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">目标</h1>
        <p class="page-sub">{{ store.activeGoals.length }} 个进行中 · 每个目标都有下一步</p>
      </div>
      <button class="btn btn-primary btn-sm" @click="createOpen = true">＋ 新建</button>
    </div>

    <div v-if="store.activeGoals.length" class="list">
      <div v-for="(goal, index) in store.activeGoals" :key="goal.id">
        <GoalCard :goal="goal" />
        <div class="btn-row" style="margin: 8px 0 14px 4px">
          <button v-if="!store.tasksOf(goal.id).length" class="btn btn-sm" @click="addForGoal = goal.id">添加第一步</button>
          <button v-else class="btn btn-sm btn-ghost" @click="router.push(`/goals/${goal.id}`)">查看任务 ›</button>
          <button class="chip" :disabled="index === 0" aria-label="上移" @click="store.reorderGoal(goal.id, -1)">↑</button>
          <button class="chip" :disabled="index === store.activeGoals.length - 1" aria-label="下移" @click="store.reorderGoal(goal.id, 1)">↓</button>
        </div>
      </div>
    </div>
    <div v-else class="empty">
      <div class="empty-title">还没有目标</div>
      <div class="tiny">可以直接去今日页记下一件事，也可以先建个目标。</div>
      <button class="btn btn-primary btn-sm" style="margin-top: 14px" @click="createOpen = true">新建目标</button>
    </div>

    <section v-if="foldedGoals.length" class="section">
      <button class="section-head" style="width: 100%; text-align: left" @click="folded = !folded">
        <h2 class="section-title">已暂停 / 已完成 / 已归档</h2>
        <span class="section-hint">{{ folded ? '展开' : '收起' }} · {{ foldedGoals.length }}</span>
      </button>
      <div v-if="!folded" class="list">
        <GoalCard v-for="goal in foldedGoals" :key="goal.id" :goal="goal" />
      </div>
    </section>

    <Sheet v-if="createOpen" title="新建目标" desc="名称必填，其余可以后补。" @close="createOpen = false">
      <label class="field">
        <span class="field-label">想达成什么</span>
        <input v-model="form.name" class="input" placeholder="做出可演示的 Agent 项目" @keydown.enter="submit" />
      </label>
      <label class="field">
        <span class="field-label">成功标准（怎么算做成）</span>
        <textarea v-model="form.outcome" class="textarea" rows="2" placeholder="能现场跑通一次工具调用"></textarea>
      </label>
      <label class="field">
        <span class="field-label">我的理由</span>
        <textarea v-model="form.reason" class="textarea" rows="2" placeholder="下次面试时，我想打开一个能跑的作品"></textarea>
        <span class="tiny muted">「给我点动力」会优先展示这句话，而不是名言。</span>
      </label>
      <label class="field">
        <span class="field-label">目标日（可选，和安排日期分开）</span>
        <input v-model="form.targetDate" type="date" class="input" />
      </label>
      <template #footer>
        <button class="btn" @click="createOpen = false">取消</button>
        <button class="btn btn-primary" :disabled="!form.name.trim()" @click="submit">保存目标</button>
      </template>
    </Sheet>

    <AddTaskSheet v-if="addForGoal" :goal-id="addForGoal" @close="addForGoal = null" @created="addForGoal = null" />
  </div>
</template>
