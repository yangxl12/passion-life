<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { QuoteScene } from '../types'
import { useAppStore } from '../stores/app'
import { QUOTES, KIND_LABEL } from '../data/quotes'
import { pickQuote, quoteKindNote } from '../logic/quotes'
import type { Quote } from '../data/quotes'

const props = withDefaults(defineProps<{
  scene: QuoteScene
  meaning?: string
  hint?: string
}>(), { meaning: '', hint: '' })

const emit = defineEmits<{ act: [label: string] }>()
const store = useAppStore()
const quote = ref<Quote | null>(null)
const expanded = ref(false)
const forceVisible = ref(false)
const showMeaning = ref(false)
const fallback = QUOTES.find((q) => q.id === 'o01') ?? QUOTES[0]!

const visible = computed(() => store.prefs.showInspiration || forceVisible.value)
const favorite = computed(() => (quote.value ? store.prefs.favoriteQuoteIds.includes(quote.value.id) : false))
const detail = computed(() => (quote.value ? quoteKindNote(quote.value) : ''))

function load(manual = false): void {
  const picked = pickQuote({ scene: props.scene, prefs: store.prefs, date: store.today, manual })
  quote.value = picked ?? (manual ? fallback : null)
  expanded.value = false
  if (picked && !manual) void store.recordQuote(picked.id, props.scene)
}

function request(): void {
  forceVisible.value = true
  showMeaning.value = Boolean(props.meaning.trim())
  load(true)
}

function collapse(): void {
  forceVisible.value = false
  showMeaning.value = false
  void store.updatePrefs({ showInspiration: false })
}

function restore(): void {
  void store.updatePrefs({ showInspiration: true })
  load()
}

function change(): void {
  load(true)
}

onMounted(() => load())
watch(
  () => [props.scene, store.prefs.tone, store.prefs.showInspiration, store.prefs.hiddenQuoteIds.join(','), store.prefs.dailyQuote?.quoteId],
  () => { if (!forceVisible.value) load() }
)
</script>

<template>
  <div>
    <div v-if="!visible" class="quote-actions" style="justify-content: space-between">
      <button class="chip" @click="request">给我点动力</button>
      <button v-if="!store.prefs.showInspiration" class="chip" @click="restore">重新显示激励</button>
    </div>

    <div v-else class="quote">
      <div v-if="showMeaning && meaning" class="banner banner-accent" style="margin-bottom: 14px">
        <div>
          <div class="tiny muted">你当初写下的理由</div>
          <div style="margin-top: 4px">{{ meaning }}</div>
        </div>
        <button class="btn btn-sm btn-light" @click="emit('act', '开始'); showMeaning = false">开始下一步</button>
      </div>

      <div class="tiny muted" style="letter-spacing: 1px">
        {{ quote?.kind === 'classic' ? '一句可以带走的话' : '行动提示' }}
        <span class="tag" style="margin-left: 6px">{{ quote ? KIND_LABEL[quote.kind] : '' }}</span>
      </div>
      <div class="quote-text" style="margin-top: 8px">{{ quote?.text ?? '现在只做能看见结果的那一步。' }}</div>
      <div class="quote-by">— {{ quote?.author ?? 'passionLife' }}</div>

      <div v-if="expanded && quote" class="quote-detail">
        <div>{{ detail }}</div>
        <div v-if="quote.originalText !== quote.text" style="margin-top: 6px">原文：{{ quote.originalText }}</div>
        <div style="margin-top: 6px">使用依据：{{ quote.rationale }}</div>
      </div>

      <div class="quote-actions">
        <button class="btn btn-sm btn-primary" @click="emit('act', quote?.actionLabel ?? '开始')">
          {{ quote?.actionLabel ?? '开始' }}
        </button>
        <button v-if="hint" class="btn btn-sm btn-ghost" @click="emit('act', '换小一步')">{{ hint }}</button>
        <button class="chip" :class="{ active: favorite }" @click="quote && store.toggleFavorite(quote.id)">
          {{ favorite ? '★ 已收藏' : '☆ 收藏' }}
        </button>
        <button class="chip" @click="expanded = !expanded">{{ expanded ? '收起出处' : '出处' }}</button>
        <button class="chip" @click="change">换一条</button>
        <button class="chip" @click="quote && store.hideQuote(quote.id)">少看这类</button>
        <button class="chip" @click="collapse">收起</button>
      </div>
    </div>
  </div>
</template>
