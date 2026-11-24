<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import QuoteCard from '../components/QuoteCard.vue'
import TaskRow from '../components/TaskRow.vue'
import Sheet from '../components/Sheet.vue'
import { requestStart } from '../logic/navigation'
import { sceneForToday } from '../logic/quotes'
import { completedToday } from '../logic/selection'
import { formatDate } from '../logic/date'
import { openQuickAdd } from '../logic/ui'
import { clearDraft, getDraft, setDraft } from '../logic/drafts'
import type { Task } from '../types'

const store = useAppStore()
const router = useRouter()

// 第一次打开：只给一个输入框
const firstText = ref(getDraft('first'))
const brandNew = computed(() => store.goals.length === 0 && store.tasks.length === 0 && store.ideas.length === 0)
const showFirstInput = computed(() => brandNew.value && !store.selection.task)

async function createFirst(): Promise<void> {
  const value = firstText.value.trim()
  if (!value) return
  const task = await store.createTask({ title: value })
  if (!task) return
  await store.setPrimary(task.id)
  clearDraft('first')
  firstText.value = ''
}

const current = computed(() => store.selection.task)
const openAction = computed(() => store.openAction)
const currentGoal = computed(() => (current.value ? store.goals.find((g) => g.id === current.value?.goalId) ?? null : null))
const heroLabel = computed(() => {
  switch (store.selection.reason) {
    case 'open': return '上次没做完 · 接着走'
    case 'primary': return '今天第一件事'
    case 'scheduled': return '今天已安排'
    case 'suggested': return '可以先从这件开始'
    default: return ''
  }
})
const stepText = computed(() => {
  const task = current.value
  if (!task) return ''
  if (task.smallestStep) return task.smallestStep
  if (task.planWhen && task.planThen) return `当${task.planWhen}，我就${task.planThen}`
  return '还没写，点「轻一点」把它缩到几分钟能做完'
})
const scene = computed(() => sceneForToday(
  Boolean(openAction.value),
  store.reschedule.length > 0,
  store.week.progressDates.includes(store.today)
))
const todayDone = computed(() => completedToday(store.data, store.today))
const doneElsewhere = computed(() => todayDone.value
  .filter((id) => !store.agenda.some((t) => t.id === id))
  .map((id) => store.tasks.find((t) => t.id === id))
  .filter((t): t is Task => Boolean(t)))

function begin(): void {
  const task = current.value
  if (!task) return
  if (store.selection.reason === 'open') void router.push(`/action/${task.id}`)
  else requestStart(task.id)
}

async function completeCurrent(): Promise<void> {
  if (!current.value) return
  await store.completeTask(current.value.id)
}

// 轻一点：保留原任务，只改眼前一步
const lightOpen = ref(false)
const lightStep = ref('')
function openLight(preset = ''): void {
  lightStep.value = preset || current.value?.smallestStep || ''
  lightOpen.value = true
}

async function saveLight(startFive = false): Promise<void> {
  const task = current.value
  const step = lightStep.value.trim()
  if (!task || !step) return
  const ok = await store.updateTask(task.id, { smallestStep: step }, '这一步已改小')
  if (!ok) return
  lightOpen.value = false
  if (!startFive) return
  if (openAction.value && openAction.value.taskId !== task.id) {
    requestStart(task.id)
    return
  }
  const started = await store.startAction(task.id)
  if (!started) return
  await store.setTimer(5)
  await router.push(`/action/${task.id}`)
}

// 换一件：只有一个首要，原项留在今日清单
const switchOpen = ref(false)
const candidates = computed(() => {
  const activeGoals = new Set(store.activeGoals.map((g) => g.id))
  return store.tasks
    .filter((t) => t.status !== 'done' && t.id !== current.value?.id && (!t.goalId || activeGoals.has(t.goalId)))
    .sort((a, b) => Number(Boolean(b.scheduledDate)) - Number(Boolean(a.scheduledDate)) || a.order - b.order)
    .slice(0, 24)
})

async function switchTo(id: string): Promise<void> {
  const oldId = store.prefs.primaryTaskId
  if (oldId && oldId !== id) {
    const old = store.tasks.find((t) => t.id === oldId)
    if (old && !old.scheduledDate) await store.scheduleTask(oldId, store.today, '原首要已留在今日清单')
  }
  await store.setPrimary(id)
  switchOpen.value = false
}

// 待重新安排
const rescheduleTarget = ref<Task | null>(null)
const customDate = ref(store.today)
function openReschedule(task: Task): void {
  rescheduleTarget.value = task
  customDate.value = store.today
}
async function moveTask(date: string | null, label: string): Promise<void> {
  const task = rescheduleTarget.value
  if (!task) return
  const ok = await store.scheduleTask(task.id, date, label)
  if (ok) rescheduleTarget.value = null
}

// 重新启动卡
const showRestart = computed(() => store.silent >= 3
  && Boolean(store.lastStep)
  && store.prefs.restartCardDismissedOn !== store.today)
const restartTask = computed(() => store.tasks.find((t) => t.id === store.lastStep?.taskId) ?? null)

function restart(mode: 'continue' | 'smaller'): void {
  const task = restartTask.value
  void store.dismissRestartCard()
  if (mode === 'continue' && task) requestStart(task.id)
  else openLight(store.lastStep?.nextStep ?? '')
}

// 挑战模式：可拒绝，不叠加任务、不扣分
const challengeOpen = ref(false)
const showChallengeEntry = computed(() => Boolean(current.value) && store.prefs.challengeDismissedOn !== store.today)
function acceptChallenge(): void {
  challengeOpen.value = false
  const task = current.value
  if (task) requestStart(task.id)
}

function onQuoteAct(label: string): void {
  if (!current.value) {
    openQuickAdd('idea')
    return
  }
  if (label.includes('换一件')) switchOpen.value = true
  else if (label.includes('小') || label.includes('拆')) openLight()
  else begin()
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ formatDate(store.today) }}</h1>
        <p class="page-sub">打开时，选好眼下这一步。</p>
      </div>
      <button class="icon-btn" aria-label="设置" @click="router.push('/settings')">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M18 6l-1.4 1.4M7.4 16.6L6 18" />
        </svg>
      </button>
    </div>

    <!-- 无目标的新用户：一次输入即可开始 -->
    <div v-if="showFirstInput" class="card" style="margin-bottom: 16px">
      <div class="section-title">今天想推进什么？</div>
      <input
        v-model="firstText"
        class="input"
        style="margin-top: 10px"
        placeholder="做出作品集首页"
        @input="setDraft('first', firstText)"
        @keydown.enter="createFirst"
      />
      <p class="tiny muted" style="margin: 8px 0 14px">目标、日期和动机都可以后补。</p>
      <button class="btn btn-primary btn-block" :disabled="!firstText.trim()" @click="createFirst">设为今天第一件事</button>
      <button class="btn btn-ghost btn-block" style="margin-top: 8px" @click="openQuickAdd('idea')">只是先记个想法</button>
    </div>

    <!-- 当前行动 -->
    <div v-if="current" class="hero">
      <div class="hero-label">{{ heroLabel }}</div>
      <div v-if="currentGoal" class="hero-goal">{{ currentGoal.name }}</div>
      <h2 class="hero-title">{{ current.title }}</h2>
      <div class="hero-step">
        <span class="k">眼前这一步</span>
        {{ stepText }}
      </div>
      <div class="hero-actions">
        <button class="btn btn-light" @click="begin">{{ store.selection.reason === 'open' ? '继续' : '开始' }}</button>
        <button class="btn btn-light" @click="openLight()">轻一点</button>
        <button class="btn btn-light" @click="switchOpen = true">换一件</button>
      </div>
      <div style="margin-top: 12px; display: flex; gap: 12px">
        <button class="btn btn-sm btn-ghost" style="color: rgba(255,255,255,.85)" @click="completeCurrent">✓ 直接完成任务</button>
        <button class="btn btn-sm btn-ghost" style="color: rgba(255,255,255,.85)" @click="router.push(`/tasks/${current.id}`)">查看任务</button>
      </div>
    </div>

    <button v-if="todayDone.length" class="banner" style="margin-top: 14px; width: 100%; text-align: left" @click="router.push('/footprints')">
      <span>今天完成了 {{ todayDone.length }} 件事。看看足迹，也可以直接收工。</span>
      <span class="muted">›</span>
    </button>

    <!-- 连续三天以上没推进：只展示一次 -->
    <div v-if="showRestart" class="card banner-accent" style="margin-top: 14px">
      <div class="tiny muted">有几天没打开了，不用清空积压</div>
      <div class="strong" style="margin: 8px 0 4px">上次留下的下一步</div>
      <div>{{ store.lastStep?.nextStep || store.lastStep?.progressText }}</div>
      <div class="btn-row" style="margin-top: 14px">
        <button class="btn btn-sm btn-primary" :disabled="!restartTask" @click="restart('continue')">接着做</button>
        <button class="btn btn-sm" @click="restart('smaller')">换小一步</button>
        <button class="btn btn-sm btn-ghost" @click="store.dismissRestartCard()">关闭</button>
      </div>
    </div>

    <QuoteCard
      :scene="scene"
      :meaning="currentGoal?.reason ?? ''"
      hint="轻一点"
      @act="onQuoteAct"
    />

    <div class="btn-row" style="margin-top: 14px">
      <button class="chip" @click="openQuickAdd('idea')">＋ 随手记</button>
      <button v-if="showChallengeEntry" class="chip" @click="challengeOpen = true">挑战一下</button>
      <button class="chip" @click="router.push('/review')">周回顾</button>
    </div>

    <section class="section">
      <div class="section-head">
        <h2 class="section-title">今日其余安排</h2>
        <span class="section-hint">{{ store.agenda.length }} 项</span>
      </div>
      <div v-if="store.agenda.length" class="list">
        <TaskRow v-for="task in store.agenda" :key="task.id" :task="task" show-schedule />
      </div>
      <div v-else class="empty">
        <div class="empty-title">今天没有别的安排</div>
        <div class="tiny">够了，做完手上这件就可以收工。</div>
      </div>
    </section>

    <section v-if="doneElsewhere.length" class="section">
      <div class="section-head"><h2 class="section-title">今天已完成</h2><span class="section-hint">可撤销</span></div>
      <div class="list">
        <TaskRow v-for="task in doneElsewhere" :key="task.id" :task="task" />
      </div>
    </section>

    <section v-if="store.reschedule.length" class="section">
      <div class="section-head">
        <h2 class="section-title">待重新安排</h2>
        <span class="section-hint">不会挤占首页</span>
      </div>
      <div class="list">
        <div v-for="task in store.reschedule" :key="task.id" class="row">
          <div class="row-main">
            <div class="row-title">{{ task.title }}</div>
            <div class="row-meta">原安排 {{ task.scheduledDate && formatDate(task.scheduledDate, false) }}</div>
          </div>
          <div class="row-actions">
            <button class="btn btn-sm" @click="openReschedule(task)">重排</button>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2 class="section-title">本周推进</h2>
        <button class="chip" @click="router.push('/footprints')">查看足迹 ›</button>
      </div>
      <div class="stat-grid">
        <div class="stat">
          <div class="stat-num">{{ store.week.progressDays }}</div>
          <div class="stat-label">推进天数</div>
        </div>
        <div class="stat">
          <div class="stat-num">{{ store.week.completedTasks }}</div>
          <div class="stat-label">已完成任务</div>
        </div>
      </div>
      <div v-if="store.recentProgress.length" class="list" style="margin-top: 12px">
        <div v-for="item in store.recentProgress.slice(0, 2)" :key="item.id" class="row">
          <div class="row-main">
            <div class="row-title">{{ item.progressText }}</div>
            <div class="row-meta">{{ item.goalName }} · {{ item.localDate }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 轻一点 -->
    <Sheet v-if="lightOpen" title="把这一步变轻" desc="原任务不变，只改眼前要做的动作。" @close="lightOpen = false">
      <div class="card" style="margin-bottom: 14px">
        <div class="tiny muted">原任务</div>
        <div class="strong">{{ current?.title }}</div>
      </div>
      <label class="field">
        <span class="field-label">动词开头，五分钟能做完</span>
        <textarea v-model="lightStep" class="textarea" rows="3" placeholder="打开昨天的草稿，只改一处"></textarea>
      </label>
      <template #footer>
        <button class="btn" @click="saveLight(false)">只改这一步</button>
        <button class="btn btn-primary" :disabled="!lightStep.trim()" @click="saveLight(true)">直接启动五分钟</button>
      </template>
    </Sheet>

    <!-- 换一件 -->
    <Sheet v-if="switchOpen" title="换一件" desc="原首要会留在今日清单，不会丢。" @close="switchOpen = false">
      <div v-if="candidates.length" class="list">
        <button v-for="task in candidates" :key="task.id" class="row" style="text-align: left; width: 100%" @click="switchTo(task.id)">
          <div class="row-main">
            <div class="row-title">{{ task.title }}</div>
            <div class="row-meta">{{ store.goalName(task.goalId) }}</div>
          </div>
          <span class="muted">设为首要 ›</span>
        </button>
      </div>
      <div v-else class="empty"><div class="empty-title">没有别的候选</div><button class="btn btn-sm" style="margin-top: 12px" @click="switchOpen = false; openQuickAdd('todo')">记一件新的</button></div>
      <template #footer>
        <button class="btn btn-ghost btn-block" @click="switchOpen = false">取消</button>
      </template>
    </Sheet>

    <!-- 重新安排 -->
    <Sheet v-if="rescheduleTarget" title="重新安排" :desc="rescheduleTarget.title" @close="rescheduleTarget = null">
      <div class="btn-row" style="margin-bottom: 14px">
        <button class="btn btn-primary" @click="moveTask(store.today, '已移到今天')">放到今天</button>
        <button class="btn" @click="moveTask(null, '已移出日程')">移出日程</button>
      </div>
      <label class="field">
        <span class="field-label">另选日期</span>
        <input v-model="customDate" type="date" class="input" />
      </label>
      <template #footer>
        <button class="btn btn-primary btn-block" @click="moveTask(customDate, '已重新安排')">安排到这天</button>
      </template>
    </Sheet>

    <!-- 挑战一下 -->
    <Sheet v-if="challengeOpen" title="挑战一下" desc="一个可以拒绝的小挑战，不额外加任务，也不扣分。" @close="challengeOpen = false">
      <div class="card" style="margin-bottom: 14px">
        <div class="tiny muted">这次只做一件事</div>
        <div class="strong" style="font-size: 18px; margin-top: 6px">现在做出一个能展示的结果。</div>
        <p class="tiny muted" style="margin: 8px 0 0">做完在行动页留一句成果，就算完成。</p>
      </div>
      <template #footer>
        <button class="btn" @click="challengeOpen = false; store.dismissChallenge()">这次不用</button>
        <button class="btn btn-primary" :disabled="!current" @click="acceptChallenge">接下挑战</button>
      </template>
    </Sheet>
  </div>
</template>
