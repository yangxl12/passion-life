<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { CONTENT_VERSION } from '../types'
import type { Database, Tone } from '../types'
import { QUOTES, QUOTE_BY_ID } from '../data/quotes'
import type { BackupValidation } from '../logic/backup'

const store = useAppStore()
const router = useRouter()
const fileInput = ref<HTMLInputElement | null>(null)
const fileError = ref('')
const preview = ref<BackupValidation | null>(null)
const restoreData = ref<Database | null>(null)
const restoreOpen = ref(false)
const confirmed = ref(false)
const installOpen = ref(false)

const tones: { value: Tone; label: string }[] = [
  { value: 'plain', label: '平实' },
  { value: 'energetic', label: '有冲劲' },
  { value: 'gentle', label: '温和' },
  { value: 'off', label: '关闭' }
]
const favorites = computed(() => store.prefs.favoriteQuoteIds
  .map((id) => QUOTE_BY_ID.get(id))
  .filter((q): q is NonNullable<typeof q> => Boolean(q)))
const hidden = computed(() => store.prefs.hiddenQuoteIds
  .map((id) => QUOTE_BY_ID.get(id))
  .filter((q): q is NonNullable<typeof q> => Boolean(q)))
const currentCounts = computed(() => ({
  goals: store.goals.length,
  tasks: store.tasks.length,
  ideas: store.ideas.length,
  actions: store.actions.length
}))
const lastExport = computed(() => store.prefs.lastExportAt
  ? new Date(store.prefs.lastExportAt).toLocaleString('zh-CN')
  : '还没有导出过')
const previewPrimary = computed(() => {
  const id = preview.value?.data?.prefs.primaryTaskId
  return store.tasks.find((t) => t.id === id)?.title ?? '无'
})
const previewSample = computed(() => preview.value?.data?.ideas[0]?.text?.slice(0, 40) || '（备份中没有想法）')

function pickFile(): void {
  fileError.value = ''
  fileInput.value?.click()
}

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  let raw: unknown
  try {
    raw = JSON.parse(await file.text()) as unknown
  } catch {
    fileError.value = '备份已损坏：不是有效的 JSON，原数据未改动。'
    return
  }
  const result = store.inspectBackup(raw)
  if (!result.ok || !result.data) {
    fileError.value = `备份已拒绝：${result.error ?? '内容不完整'}，原数据未改动。`
    return
  }
  preview.value = result
  restoreData.value = result.data
  confirmed.value = false
  restoreOpen.value = true
}

async function confirmRestore(): Promise<void> {
  if (!restoreData.value || !confirmed.value) return
  const ok = await store.applyBackup(restoreData.value)
  if (!ok) return
  restoreOpen.value = false
  preview.value = null
  restoreData.value = null
  await router.push('/today')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <button class="back-btn" aria-label="返回" @click="router.back()">‹</button>
      <div style="flex: 1"><h1 class="page-title">设置</h1><p class="page-sub">偏好即时生效，数据只在本机。</p></div>
    </div>

    <section>
      <div class="section-head"><h2 class="section-title">激励语气</h2><span class="section-hint">不会打断行动</span></div>
      <div class="btn-row">
        <button
          v-for="tone in tones"
          :key="tone.value"
          class="chip"
          :class="{ active: store.prefs.tone === tone.value }"
          @click="store.setTone(tone.value)"
        >{{ tone.label }}</button>
      </div>
      <p class="tiny muted" style="margin-top: 8px">内置 {{ QUOTES.length }} 条内容，其中引文按可核查出处收录、原创提示单独标记。内容版本 {{ store.prefs.contentVersion || CONTENT_VERSION }}。</p>
    </section>

    <section class="section">
      <div class="section-head"><h2 class="section-title">已收藏语句</h2><span class="section-hint">{{ favorites.length }} 条</span></div>
      <div v-if="favorites.length" class="list">
        <div v-for="quote in favorites" :key="quote.id" class="row">
          <div class="row-main">
            <div class="row-title">{{ quote.text }}</div>
            <div class="row-meta">{{ quote.author }} · {{ quote.source }}</div>
          </div>
          <div class="row-actions">
            <button class="btn btn-sm btn-ghost" @click="store.toggleFavorite(quote.id)">取消</button>
          </div>
        </div>
      </div>
      <div v-else class="empty"><div class="empty-title">还没有收藏</div><div class="tiny">在今日页的激励卡上点「☆ 收藏」。</div></div>
      <div v-if="hidden.length" style="margin-top: 16px">
        <div class="section-title">少看这类 · 可恢复</div>
        <div class="btn-row" style="margin-top: 10px">
          <button v-for="quote in hidden" :key="quote.id" class="chip" @click="store.unhideQuote(quote.id)">
            {{ quote.text.slice(0, 12) }}… ×
          </button>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2 class="section-title">安装与离线</h2></div>
      <div class="card">
        <div class="row-meta">
          离线状态：<span class="tag" :class="{ 'tag-ok': store.prefs.offlineReady }">{{ store.prefs.offlineReady ? '关键资源已缓存，可离线使用' : '正在准备或当前环境不支持' }}</span>
        </div>
        <div class="row-meta" style="margin-top: 8px">
          本机存储：仅当前浏览器、当前站点来源。浏览器清理数据、空间回收或更换域名都可能让数据不可见或丢失。
        </div>
        <div class="row-meta" style="margin-top: 8px">
          持久化申请：{{ store.prefs.persistence === 'granted' ? '已获准' : store.prefs.persistence === 'denied' ? '未获准' : '尚未申请' }}
        </div>
        <button class="btn btn-sm" style="margin-top: 12px" @click="store.applyPersistence()">申请持久化存储</button>
        <div class="divider"></div>
        <button class="btn btn-sm btn-ghost" style="text-align: left" @click="installOpen = !installOpen">
          {{ installOpen ? '收起安装说明' : '如何添加到主屏幕 ▸' }}
        </button>
        <div v-if="installOpen" class="tiny muted" style="margin-top: 8px; line-height: 1.8">
          Android Chrome：菜单 →「安装应用 / 添加到主屏幕」。<br />
          iOS Safari：分享 →「添加到主屏幕」。<br />
          首次联网加载完成、离线资源缓存成功后即可飞行模式使用。主流程不要求安装。
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2 class="section-title">导出与恢复</h2><span class="section-hint">最近导出 {{ lastExport }}</span></div>
      <div class="card">
        <p class="tiny" style="margin: 0 0 12px">
          备份是<strong>明文 UTF-8 JSON</strong>，包含目标、任务、想法、行动记录与偏好。请自己保管，不要放进公开仓库。
        </p>
        <div class="btn-row">
          <button class="btn btn-primary btn-sm" @click="store.exportBackup()">导出当前数据</button>
          <button class="btn btn-sm" @click="pickFile">从文件恢复</button>
        </div>
        <input ref="fileInput" type="file" accept="application/json,.json" style="display: none" @change="onFile" />
        <div v-if="fileError" class="banner" style="margin-top: 12px; background: var(--accent-soft)">{{ fileError }}</div>
        <div class="divider"></div>
        <div class="tiny muted">当前数据：目标 {{ currentCounts.goals }} · 任务 {{ currentCounts.tasks }} · 想法 {{ currentCounts.ideas }} · 行动记录 {{ currentCounts.actions }}</div>
      </div>
    </section>

    <section class="section">
      <div class="card">
        <div class="section-title">隐私</div>
        <p class="tiny muted" style="line-height: 1.8; margin: 8px 0 0">
          应用代码不发送个人内容、统计或诊断日志；不在 URL 里放标题与正文；不接第三方分析或远程语录 API。
          静态资源仍由托管方处理。换设备或换域名前，先从原环境导出，再到新环境恢复。
        </p>
      </div>
    </section>

    <div v-if="restoreOpen && preview" class="sheet-mask" @click.self="restoreOpen = false">
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-handle"></div>
        <h2 class="sheet-title">预览备份内容</h2>
        <p class="sheet-desc">恢复采用全量替换，会覆盖这台设备上的现有数据。</p>
        <div class="card">
          <div class="section-title">数量对比（新 / 现）</div>
          <div class="row-meta" style="margin-top: 8px">
            目标 {{ preview.counts?.goals }} / {{ currentCounts.goals }} ·
            任务 {{ preview.counts?.tasks }} / {{ currentCounts.tasks }} ·
            想法 {{ preview.counts?.ideas }} / {{ currentCounts.ideas }} ·
            行动记录 {{ preview.counts?.actions }} / {{ currentCounts.actions }}
          </div>
          <div class="divider"></div>
          <div class="tiny muted">备份导出时间 {{ preview.exportedAt ? new Date(preview.exportedAt).toLocaleString('zh-CN') : '未记录' }}</div>
          <div class="tiny muted">今日首要：{{ previewPrimary }}</div>
          <div class="tiny muted" style="margin-top: 8px">原文示例：{{ previewSample }}</div>
        </div>
        <div class="btn-row" style="margin: 14px 0">
          <button class="btn btn-sm" @click="store.exportBackup()">先导出现有数据</button>
        </div>
        <label class="chip" :class="{ active: confirmed }" style="width: 100%; justify-content: flex-start">
          <input v-model="confirmed" type="checkbox" style="margin-right: 8px" />
          我确认用备份全量替换现有数据
        </label>
        <div class="sheet-footer">
          <button class="btn" @click="restoreOpen = false">取消</button>
          <button class="btn btn-primary" :disabled="!confirmed" @click="confirmRestore">确认恢复</button>
        </div>
      </div>
    </div>
  </div>
</template>
