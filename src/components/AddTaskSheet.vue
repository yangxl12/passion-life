<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '../stores/app'
import type { Task } from '../types'
import Sheet from './Sheet.vue'

const props = defineProps<{ goalId: string | null }>()
const emit = defineEmits<{ close: []; created: [task: Task] }>()
const store = useAppStore()
const title = ref('')
const step = ref('')
const planWhen = ref('')
const planThen = ref('')
const scheduleToday = ref(false)
const saving = ref(false)

const isFirst = computed(() => store.tasks.filter((t) => t.goalId === props.goalId).length === 0)

async function submit(): Promise<void> {
  if (!title.value.trim() || saving.value) return
  saving.value = true
  const task = await store.createTask({
    goalId: props.goalId,
    title: title.value,
    smallestStep: step.value,
    planWhen: planWhen.value,
    planThen: planThen.value,
    scheduledDate: scheduleToday.value ? store.today : null
  })
  saving.value = false
  if (!task) return
  title.value = ''
  step.value = ''
  planWhen.value = ''
  planThen.value = ''
  scheduleToday.value = false
  emit('created', task)
}
</script>

<template>
  <Sheet title="添加任务" :desc="isFirst ? '第一项任务：写下结果，再拆出眼前一步。' : '写下要交付的结果，不写也可以先存。'" @close="emit('close')">
    <label class="field">
      <span class="field-label">任务标题</span>
      <input v-model="title" class="input" placeholder="完成第一条工具调用" @keydown.enter="submit" />
    </label>
    <label class="field">
      <span class="field-label">最小一步（可后补）</span>
      <input v-model="step" class="input" placeholder="写下工具的输入和输出" />
    </label>

    <div v-if="isFirst" class="card" style="margin-bottom: 14px">
      <div class="tiny muted">情境计划 · 自愿填写，下次进入原样显示</div>
      <label class="field" style="margin-top: 10px; margin-bottom: 8px">
        <span class="field-label">当［什么情境］</span>
        <input v-model="planWhen" class="input" placeholder="晚饭后坐到书桌前" />
      </label>
      <label class="field" style="margin-bottom: 0">
        <span class="field-label">我就［做什么］</span>
        <input v-model="planThen" class="input" placeholder="打开项目，跑一次示例" />
      </label>
    </div>

    <button class="chip" :class="{ active: scheduleToday }" @click="scheduleToday = !scheduleToday">
      {{ scheduleToday ? '✓ 同时排到今天' : '同时排到今天' }}
    </button>

    <template #footer>
      <button class="btn" @click="emit('close')">取消</button>
      <button class="btn btn-primary" :disabled="!title.trim() || saving" @click="submit">保存任务</button>
    </template>
  </Sheet>
</template>
