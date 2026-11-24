<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useAppStore } from '../stores/app'
import { closeQuickAdd, ui, type QuickType } from '../logic/ui'
import { clearDraft, getDraft, setDraft } from '../logic/drafts'
import Sheet from './Sheet.vue'

const store = useAppStore()
const text = ref('')
const inputEl = ref<HTMLTextAreaElement | null>(null)
const saving = ref(false)
const scheduleToday = ref(false)

watch(() => ui.quickOpen, async (open) => {
  if (!open) return
  text.value = ui.quickPreset || getDraft('quick')
  scheduleToday.value = false
  await nextTick()
  inputEl.value?.focus()
})

function onInput(): void {
  setDraft('quick', text.value)
}

function switchType(type: QuickType): void {
  ui.quickType = type
  inputEl.value?.focus()
}

async function save(): Promise<void> {
  if (!text.value.trim() || saving.value) return
  saving.value = true
  const value = text.value
  const ok = ui.quickType === 'idea'
    ? Boolean(await store.createIdea(value))
    : Boolean(await store.createStandaloneTodo(value, scheduleToday.value ? store.today : null))
  saving.value = false
  if (!ok) return // 写入失败时输入与草稿都保留
  clearDraft('quick')
  text.value = ''
  closeQuickAdd()
}

function close(): void {
  setDraft('quick', text.value)
  closeQuickAdd()
}
</script>

<template>
  <Sheet v-if="ui.quickOpen" title="记一笔" desc="先存下来，用途晚点再决定。" @close="close">
    <div class="btn-row" style="margin-bottom: 12px">
      <button class="chip" :class="{ active: ui.quickType === 'idea' }" @click="switchType('idea')">想法</button>
      <button class="chip" :class="{ active: ui.quickType === 'todo' }" @click="switchType('todo')">待办</button>
    </div>

    <label class="field">
      <span class="field-label">{{ ui.quickType === 'idea' ? '想到什么就写什么' : '要做的事' }}</span>
      <textarea
        ref="inputEl"
        v-model="text"
        class="textarea"
        rows="4"
        :placeholder="ui.quickType === 'idea' ? '文件预览可以记住上次滚动位置' : '把这份草稿补完'"
        @input="onInput"
      ></textarea>
    </label>

    <button v-if="ui.quickType === 'todo'" class="chip" :class="{ active: scheduleToday }" @click="scheduleToday = !scheduleToday">
      {{ scheduleToday ? '✓ 同时排到今天' : '同时排到今天' }}
    </button>

    <p class="tiny muted" style="margin: 12px 0 0">
      内容只存在本机。保存后回到当前页面，不会打断你正在做的事。
    </p>

    <template #footer>
      <button class="btn" @click="close">稍后</button>
      <button class="btn btn-primary" :disabled="!text.trim() || saving" @click="save">
        {{ saving ? '保存中…' : '保存' }}
      </button>
    </template>
  </Sheet>
</template>
