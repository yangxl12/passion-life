<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const items = [
  { path: '/today', label: '今日', key: 'today' },
  { path: '/goals', label: '目标', key: 'goals' },
  { path: '/records', label: '记录', key: 'records' }
]

function active(path: string): boolean {
  if (path === '/today') return route.path === '/today'
  if (path === '/goals') return route.path.startsWith('/goals') || route.path.startsWith('/tasks')
  return route.path.startsWith('/records') || route.path.startsWith('/notes')
}
</script>

<template>
  <nav class="nav" aria-label="主导航">
    <div class="nav-inner">
      <router-link
        v-for="item in items"
        :key="item.key"
        :to="item.path"
        class="nav-item"
        :class="{ active: active(item.path) }"
      >
        <span class="nav-icon" aria-hidden="true">
          <svg v-if="item.key === 'today'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <circle cx="12" cy="12" r="8.2" /><path d="M12 7.4v4.9l3.2 2" />
          </svg>
          <svg v-else-if="item.key === 'goals'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.6" /><circle cx="12" cy="12" r="1" fill="currentColor" />
          </svg>
          <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <path d="M5 5.5h14M5 10h14M5 14.5h9M5 19h6" />
          </svg>
        </span>
        <span>{{ item.label }}</span>
      </router-link>
      <div class="nav-spacer" aria-hidden="true"></div>
    </div>
  </nav>
</template>
