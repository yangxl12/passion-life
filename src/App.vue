<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useAppStore } from './stores/app'
import { openQuickAdd, ui } from './logic/ui'
import { applyUpdate, setupPWA } from './logic/pwa'
import BottomNav from './components/BottomNav.vue'
import QuickAdd from './components/QuickAdd.vue'
import ToastBar from './components/ToastBar.vue'
import ActionConflict from './components/ActionConflict.vue'

const store = useAppStore()
let timer: number | undefined

function onVisible(): void {
  if (document.visibilityState === 'visible') store.refreshToday()
}

onMounted(async () => {
  await store.reload()
  setupPWA(store, () => {
    ui.updateAvailable = true
  })
  timer = window.setInterval(() => store.refreshToday(), 30000)
  document.addEventListener('visibilitychange', onVisible)
})

onUnmounted(() => {
  if (timer) window.clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisible)
})

async function refresh(): Promise<void> {
  await applyUpdate()
}
</script>

<template>
  <div class="app-shell">
    <div class="phone">
      <template v-if="store.fatalError">
        <div class="page">
          <div class="page-head"><h1 class="page-title">本地数据打不开</h1></div>
          <div class="card">
            <p class="strong">passionLife 无法读取这台设备上的 IndexedDB。</p>
            <p class="muted tiny">{{ store.fatalError }}</p>
            <p class="tiny">原数据没有被删除。可以先导出当前内存中的备份，再检查浏览器存储权限或关闭占用该页面的其他标签页。</p>
            <div class="btn-row" style="margin-top: 16px">
              <button class="btn btn-primary" @click="store.exportBackup()">导出当前数据</button>
              <button class="btn" @click="store.reload()">重试</button>
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="!store.ready">
        <div class="page">
          <div class="page-head"><h1 class="page-title">passionLife</h1></div>
          <div class="card">
            <p class="muted">正在打开本地数据…</p>
            <div class="banner" style="margin-top: 12px">所有内容只存在这台设备上。</div>
          </div>
        </div>
      </template>

      <template v-else>
        <div v-if="ui.updateAvailable" class="banner banner-accent" style="margin: 12px 20px 0">
          <span>新版本已就绪。先写完手上的内容，再刷新即可；数据不会丢。</span>
          <span class="btn-row" style="flex-shrink: 0">
            <button class="btn btn-sm btn-primary" @click="refresh">刷新</button>
            <button class="btn btn-sm btn-ghost" @click="ui.updateAvailable = false">稍后</button>
          </span>
        </div>

        <router-view v-slot="{ Component, route }">
          <transition name="page" mode="out-in">
            <component :is="Component" :key="route.fullPath" />
          </transition>
        </router-view>

        <BottomNav />
        <button class="fab" aria-label="记一笔" @click="openQuickAdd()">＋</button>
        <QuickAdd />
        <ActionConflict />
        <ToastBar />
      </template>
    </div>
  </div>
</template>
