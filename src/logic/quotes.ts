import type { Prefs, QuoteScene } from '../types'
import { QUOTES, QUOTE_BY_ID, type Quote } from '../data/quotes'
import { diffDays } from './date'

export function sceneForToday(hasOpenAction: boolean, hasOverdue: boolean, hasProgressToday: boolean): QuoteScene {
  if (hasOpenAction) return 'persist'
  if (hasOverdue) return 'restart'
  if (hasProgressToday) return 'finish'
  return 'start'
}

interface PickArgs {
  scene: QuoteScene
  prefs: Prefs
  date: string
  manual?: boolean
}

/** 同日同场景稳定；优先未展示与收藏；近七日尽量去重；池耗尽回退最久未展示。 */
export function pickQuote({ scene, prefs, date, manual = false }: PickArgs): Quote | null {
  if (!manual && (prefs.tone === 'off' || !prefs.showInspiration)) return null

  if (!manual && prefs.dailyQuote?.date === date && prefs.dailyQuote.scene === scene) {
    const pinned = QUOTE_BY_ID.get(prefs.dailyQuote.quoteId)
    if (pinned && !prefs.hiddenQuoteIds.includes(pinned.id)) return pinned
  }

  const pool = QUOTES.filter((q) => !prefs.hiddenQuoteIds.includes(q.id))
  if (!pool.length) return null

  const lastSeen = (id: string): number => {
    const visits = prefs.quoteHistory.filter((v) => v.quoteId === id)
    if (!visits.length) return 9999
    return Math.min(...visits.map((v) => diffDays(v.date, date)))
  }

  const scored = pool.map((q) => {
    const days = lastSeen(q.id)
    let score = 0
    if (q.scenes.includes(scene)) score += 100
    if (q.tones.includes(prefs.tone)) score += 30
    if (prefs.favoriteQuoteIds.includes(q.id)) score += 25
    if (q.kind === 'original') score += 5
    score += Math.min(days, 30) // 越久未展示越优先
    if (days >= 0 && days < 7) score -= 60 // 近七日尽量去重
    return { q, score }
  })

  scored.sort((a, b) => b.score - a.score || a.q.id.localeCompare(b.q.id))
  return scored[0]?.q ?? null
}

export function markQuoteVisit(prefs: Prefs, quoteId: string, scene: QuoteScene, date: string): Prefs {
  return {
    ...prefs,
    dailyQuote: { date, scene, quoteId },
    quoteHistory: [...prefs.quoteHistory, { quoteId, date, scene }].slice(-200)
  }
}

export function quoteKindNote(q: Quote): string {
  const bits = [q.author, q.source, q.sourceNote]
  if (q.translation === 'self') bits.push('中文自译')
  if (q.translation === 'paraphrase') bits.push('中文意译')
  return bits.filter(Boolean).join(' · ')
}
