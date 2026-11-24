<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

withDefaults(defineProps<{ title: string; desc?: string }>(), { desc: '' })
const emit = defineEmits<{ close: [] }>()

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.stopPropagation()
    emit('close')
  }
}

let unlockScroll = false

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  // 引用计数：多个 Sheet 叠加时，最后一个关闭才恢复背景滚动
  const count = Number(document.documentElement.dataset.sheetCount ?? '0') + 1
  document.documentElement.dataset.sheetCount = String(count)
  if (count === 1) {
    document.documentElement.style.overflow = 'hidden'
    unlockScroll = true
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  const count = Math.max(0, Number(document.documentElement.dataset.sheetCount ?? '0') - 1)
  if (count === 0) delete document.documentElement.dataset.sheetCount
  else document.documentElement.dataset.sheetCount = String(count)
  if (unlockScroll && count === 0) {
    document.documentElement.style.overflow = ''
    unlockScroll = false
  }
})
</script>

<template>
  <div class="sheet-mask" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-handle"></div>
      <h2 class="sheet-title">{{ title }}</h2>
      <p v-if="desc" class="sheet-desc">{{ desc }}</p>
      <slot />
      <div class="sheet-footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>
