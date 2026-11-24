<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import Sheet from '../components/Sheet.vue'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const id = computed(() => String(route.params.id ?? ''))
const idea = computed(() => store.ideas.find((i) => i.id === id.value) ?? null)
const linkedTask = computed(() => store.tasks.find((t) => t.id === idea.value?.taskId) ?? null)

const editOpen = ref(false)
const editText = ref('')
const goalOpen = ref(false)
const goalId = ref<string | null>(null)
const deleteOpen = ref(false)
const convertOpen = ref(false)
const convertTitle = ref('')
const convertGoalId = ref<string | null>(null)

async function saveText(): Promise<void> {
  if (!idea.value || !editText.value.trim()) return
  const ok = await store.updateIdea(id.value, { text: editText.value })
  if (ok) editOpen.value = false
}

async function saveGoal(): Promise<void> {
  const ok = await store.updateIdea(id.value, { goalId: goalId.value }, '归属已更新')
  if (ok) goalOpen.value = false
}

async function doConvert(): Promise<void> {
  if (!idea.value) return
  const task = await store.convertIdeaToTask(id.value, convertTitle.value, convertGoalId.value)
  if (!task) return
  convertOpen.value = false
  await router.push(`/tasks/${task.id}`)
}

async function remove(): Promise<void> {
  const ok = await store.deleteIdea(id.value)
  if (ok) await router.push('/records')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <button class="back-btn" aria-label="返回" @click="router.back()">‹</button>
      <div style="flex: 1"></div>
      <button class="btn btn-sm" @click="editOpen = true; editText = idea?.text ?? ''">编辑</button>
    </div>

    <template v-if="idea">
      <div class="section-title">想法 · 原文</div>
      <div class="card" style="margin-top: 10px; white-space: pre-wrap; font-size: 17px; line-height: 1.7">{{ idea.text }}</div>
      <div class="row-meta" style="margin-top: 10px">
        记于 {{ new Date(idea.createdAt).toLocaleString('zh-CN') }}
        <span v-if="idea.goalId" class="tag">{{ store.goalName(idea.goalId) }}</span>
      </div>

      <div v-if="linkedTask" class="banner banner-accent" style="margin-top: 18px">
        <div>
          <div class="tiny muted">关联任务</div>
          <div>{{ linkedTask.title }}</div>
        </div>
        <button class="btn btn-sm btn-primary" @click="router.push(`/tasks/${linkedTask.id}`)">打开</button>
      </div>

      <section class="section">
        <div class="section-head"><h2 class="section-title">操作</h2></div>
        <div class="btn-row">
          <button v-if="linkedTask" class="btn btn-sm btn-primary" @click="router.push(`/tasks/${linkedTask.id}`)">打开关联任务</button>
          <button v-else class="btn btn-sm btn-primary" @click="convertOpen = true; convertTitle = idea.text.split('\n')[0]?.slice(0, 40) ?? ''; convertGoalId = idea.goalId">转为待办</button>
          <button class="btn btn-sm" @click="goalOpen = true; goalId = idea.goalId">关联目标</button>
          <button class="btn btn-sm btn-ghost" @click="deleteOpen = true">删除</button>
        </div>
      </section>
    </template>
    <div v-else class="empty"><div class="empty-title">这条记录不存在</div><button class="btn btn-sm" style="margin-top: 12px" @click="router.push('/records')">回到记录</button></div>

    <Sheet v-if="editOpen" title="编辑原文" desc="编辑原文不会覆盖已转出的任务。" @close="editOpen = false">
      <label class="field"><span class="field-label">正文</span><textarea v-model="editText" class="textarea" rows="6"></textarea></label>
      <template #footer>
        <button class="btn" @click="editOpen = false">取消</button>
        <button class="btn btn-primary" :disabled="!editText.trim()" @click="saveText">保存</button>
      </template>
    </Sheet>

    <Sheet v-if="goalOpen" title="关联目标" desc="归属变更后，目标列表会立即更新。" @close="goalOpen = false">
      <label class="field">
        <span class="field-label">目标</span>
        <select v-model="goalId" class="select">
          <option :value="null">不归属目标</option>
          <option v-for="goal in store.activeGoals" :key="goal.id" :value="goal.id">{{ goal.name }}</option>
        </select>
      </label>
      <template #footer>
        <button class="btn" @click="goalOpen = false">取消</button>
        <button class="btn btn-primary" @click="saveGoal">保存</button>
      </template>
    </Sheet>

    <Sheet v-if="convertOpen" title="转为待办" desc="原文保留，并显示关联任务。" @close="convertOpen = false">
      <label class="field"><span class="field-label">行动标题</span><input v-model="convertTitle" class="input" /></label>
      <label class="field">
        <span class="field-label">归属目标（可选）</span>
        <select v-model="convertGoalId" class="select">
          <option :value="null">不归属</option>
          <option v-for="goal in store.activeGoals" :key="goal.id" :value="goal.id">{{ goal.name }}</option>
        </select>
      </label>
      <template #footer>
        <button class="btn" @click="convertOpen = false">取消</button>
        <button class="btn btn-primary" :disabled="!convertTitle.trim()" @click="doConvert">确认</button>
      </template>
    </Sheet>

    <Sheet v-if="deleteOpen" title="删除这条想法？" desc="删除后无法撤销，但不会删除已转出的任务。" @close="deleteOpen = false">
      <template #footer>
        <button class="btn" @click="deleteOpen = false">取消</button>
        <button class="btn btn-primary" @click="remove">确认删除</button>
      </template>
    </Sheet>
  </div>
</template>
