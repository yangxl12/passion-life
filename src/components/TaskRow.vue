<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { Task } from '../types'
import { useAppStore } from '../stores/app'
import { requestStart } from '../logic/navigation'
import { formatDate } from '../logic/date'

const props = withDefaults(defineProps<{
  task: Task
  showGoal?: boolean
  showSchedule?: boolean
}>(), { showGoal: true, showSchedule: false })

const store = useAppStore()
const router = useRouter()
const goal = computed(() => store.goals.find((g) => g.id === props.task.goalId) ?? null)
const isPrimary = computed(() => store.prefs.primaryTaskId === props.task.id)

function open(): void {
  void router.push(`/tasks/${props.task.id}`)
}
</script>

<template>
  <div class="row" :class="{ done: task.status === 'done' }">
    <span v-if="goal" class="dot" :style="{ background: goal.color }"></span>
    <div class="row-main" role="button" tabindex="0" @click="open" @keydown.enter="open">
      <div class="row-title">{{ task.title }}</div>
      <div class="row-meta">
        <span v-if="showGoal && goal">{{ goal.name }} · </span>
        <span v-if="!goal">独立待办 · </span>
        <span v-if="isPrimary" class="tag tag-accent">今日首要</span>
        <span v-if="task.status === 'doing'" class="tag tag-ok">进行中</span>
        <span v-if="task.scheduledDate" class="tag">{{ formatDate(task.scheduledDate, false) }} 安排</span>
        <span v-if="task.dueDate" class="tag">截止 {{ formatDate(task.dueDate, false) }}</span>
        <span>{{ task.status === 'done' ? '已完成' : task.smallestStep ? `下一步：${task.smallestStep}` : '待做' }}</span>
      </div>
    </div>
    <div class="row-actions">
      <button v-if="task.status === 'done'" class="btn btn-sm btn-ghost" @click.stop="store.undoComplete(task.id)">撤销</button>
      <template v-else>
        <button
          v-if="showSchedule && task.scheduledDate !== store.today"
          class="chip"
          @click.stop="store.scheduleTask(task.id, store.today, '已排到今天')"
        >今天</button>
        <button class="btn btn-sm" @click.stop="requestStart(task.id)">开始</button>
        <button class="btn btn-sm btn-ghost" aria-label="完成任务" @click.stop="store.completeTask(task.id)">✓</button>
      </template>
    </div>
  </div>
</template>
