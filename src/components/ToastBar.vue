<script setup lang="ts">
import { useAppStore } from '../stores/app'

const store = useAppStore()

function runAction(): void {
  const message = store.toast
  message?.action?.()
  store.dismissToast()
}
</script>

<template>
  <div v-if="store.toast" class="toast" :class="store.toast.kind" role="status" aria-live="polite">
    <span>{{ store.toast.text }}</span>
    <button v-if="store.toast.action" @click="runAction">{{ store.toast.actionLabel }}</button>
    <button v-else aria-label="关闭提示" @click="store.dismissToast()">×</button>
  </div>
</template>
