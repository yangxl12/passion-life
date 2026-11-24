import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/today' },
    { path: '/today', name: 'today', component: () => import('../views/TodayView.vue') },
    { path: '/goals', name: 'goals', component: () => import('../views/GoalsView.vue') },
    { path: '/goals/:id', name: 'goal-detail', component: () => import('../views/GoalDetailView.vue') },
    { path: '/records', name: 'records', component: () => import('../views/RecordsView.vue') },
    { path: '/notes/:id', name: 'note-detail', component: () => import('../views/NoteDetailView.vue') },
    { path: '/tasks/:id', name: 'task-detail', component: () => import('../views/TaskDetailView.vue') },
    { path: '/action/:id', name: 'action', component: () => import('../views/ActionView.vue') },
    { path: '/footprints', name: 'footprints', component: () => import('../views/FootprintsView.vue') },
    { path: '/review', name: 'review', component: () => import('../views/ReviewView.vue') },
    { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/today' }
  ],
  scrollBehavior: () => ({ top: 0 })
})

export default router
