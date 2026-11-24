import type { QuoteKind, QuoteScene, Tone } from '../types'

export interface Quote {
  id: string
  kind: QuoteKind
  text: string
  originalText: string
  author: string
  source: string
  sourceNote: string
  language: string
  translation: 'none' | 'self' | 'paraphrase'
  rationale: string
  scenes: QuoteScene[]
  tones: Tone[]
  actionLabel: string
}

const SCENE_RATIONALE: Record<QuoteScene, string> = {
  start: '把大目标落到当下能动手的第一步（实施意图）',
  choose: '减少同时推进的事项，帮助做出眼前取舍',
  persist: '把注意力放回可重复的小动作，而不是结果',
  setback: '允许中断后重新进入，不否定已有进展',
  finish: '把完成转成可回看的具体成果（进展监测）',
  restart: '给出重新进入的入口，不制造积压感'
}

type Extra = Partial<Pick<Quote, 'originalText' | 'sourceNote' | 'language' | 'translation' | 'rationale' | 'actionLabel'>>

/** 可核查出处的引文：优先公版原作，外文为自译/意译并明确标记。 */
function classic(
  id: string,
  text: string,
  author: string,
  source: string,
  scenes: QuoteScene[],
  tones: Tone[],
  actionLabel: string,
  extra: Extra = {}
): Quote {
  return {
    id,
    kind: 'classic',
    text,
    originalText: extra.originalText ?? text,
    author,
    source,
    sourceNote: extra.sourceNote ?? '公版原作，中文原文',
    language: extra.language ?? 'zh',
    translation: extra.translation ?? 'none',
    rationale: extra.rationale ?? SCENE_RATIONALE[scenes[0] ?? 'start'],
    scenes,
    tones,
    actionLabel: extra.actionLabel ?? actionLabel
  }
}

/** 原创行动提示，与引文分别标记，不含署名。 */
function original(id: string, text: string, scenes: QuoteScene[], actionLabel: string): Quote {
  return {
    id,
    kind: 'original',
    text,
    originalText: text,
    author: 'passionLife',
    source: '原创行动提示',
    sourceNote: '本应用原创，无外部出处',
    language: 'zh',
    translation: 'none',
    rationale: SCENE_RATIONALE[scenes[0] ?? 'start'],
    scenes,
    tones: ['plain', 'energetic', 'gentle'],
    actionLabel
  }
}

const ALL: Tone[] = ['plain', 'energetic', 'gentle']
const E: Tone[] = ['plain', 'energetic']
const G: Tone[] = ['plain', 'gentle']

export const QUOTES: Quote[] = [
  // 开工 · 8
  classic('q01', '不积跬步，无以至千里。', '荀子', '《荀子·劝学》', ['start', 'persist'], E, '拆出第一步'),
  classic('q02', '千里之行，始于足下。', '老子', '《道德经·第六十四章》', ['start'], ALL, '开始'),
  classic('q03', '譬如为山，未成一篑，止，吾止也。', '孔子及弟子', '《论语·子罕》', ['start', 'persist'], G, '开始'),
  classic('q04', '工欲善其事，必先利其器。', '孔子及弟子', '《论语·卫灵公》', ['start', 'choose'], ALL, '开始'),
  classic('q05', '为之，则难者亦易矣；不为，则易者亦难矣。', '彭端淑', '《为学一首示子侄》', ['start', 'setback'], E, '开始'),
  classic('q06', '道虽迩，不行不至；事虽小，不为不成。', '荀子', '《荀子·修身》', ['start'], ALL, '开始'),
  classic('q07', '志不立，天下无可成之事。', '王守仁', '《传习录》', ['start', 'choose'], E, '开始'),
  classic('q08', '做得好，胜过说得好。', '本杰明·富兰克林', '《穷理查年鉴》（Poor Richard’s Almanack）', ['start', 'finish'], E, '开始', {
    originalText: 'Well done is better than well said.',
    language: 'en',
    translation: 'self',
    sourceNote: '公版原作，自译'
  }),

  // 取舍 · 8
  classic('q09', '天下难事必作于易，天下大事必作于细。', '老子', '《道德经·第六十三章》', ['choose', 'start'], ALL, '换小一步'),
  classic('q10', '博观而约取，厚积而薄发。', '苏轼', '《稼说送张琥》', ['choose', 'persist'], G, '换小一步'),
  classic('q11', '吾生也有涯，而知也无涯。', '庄子', '《庄子·养生主》', ['choose'], G, '换一件'),
  classic('q12', '水之积也不厚，则其负大舟也无力。', '庄子', '《庄子·逍遥游》', ['choose', 'persist'], G, '换小一步'),
  classic('q13', '纸上得来终觉浅，绝知此事要躬行。', '陆游', '《冬夜读书示子聿》', ['choose', 'start'], E, '开始'),
  classic('q14', '循序而渐进，熟读而精思。', '朱熹', '《读书之要》', ['choose', 'persist'], ALL, '换小一步'),
  classic('q15', '凡人作一事，便须全副精神注在此一事，首尾不懈。', '曾国藩', '《曾国藩家书》', ['choose', 'finish'], E, '继续这件'),
  classic('q16', '有些事在我们能力之内，有些不在。', '爱比克泰德', '《手册》（Enchiridion）第 1 节', ['choose', 'setback'], G, '换小一步', {
    originalText: 'Some things are in our control and others not.',
    language: 'grc/en',
    translation: 'paraphrase',
    sourceNote: '公版原作，据英译本意译'
  }),

  // 坚持 · 8
  classic('q17', '锲而不舍，金石可镂。', '荀子', '《荀子·劝学》', ['persist'], E, '继续这件'),
  classic('q18', '不积小流，无以成江海。', '荀子', '《荀子·劝学》', ['persist', 'start'], ALL, '继续这件'),
  classic('q19', '天行健，君子以自强不息。', '先秦典籍', '《周易·乾卦·象传》', ['persist', 'restart'], E, '继续这件'),
  classic('q20', '士不可以不弘毅，任重而道远。', '孔子及弟子', '《论语·泰伯》', ['persist'], E, '继续这件'),
  classic('q21', '人一能之，己百之；人十能之，己千之。', '先秦典籍', '《礼记·中庸》', ['persist'], G, '继续这件'),
  classic('q22', '咬定青山不放松，立根原在破岩中。', '郑燮', '《竹石》', ['persist', 'setback'], E, '继续这件'),
  classic('q23', '路漫漫其修远兮，吾将上下而求索。', '屈原', '《离骚》', ['persist'], E, '继续这件'),
  classic('q24', '古之立大事者，不惟有超世之才，亦必有坚忍不拔之志。', '苏轼', '《晁错论》', ['persist', 'finish'], G, '继续这件'),

  // 受挫 · 8
  classic('q25', '山重水复疑无路，柳暗花明又一村。', '陆游', '《游山西村》', ['setback', 'restart'], G, '换小一步'),
  classic('q26', '长风破浪会有时，直挂云帆济沧海。', '李白', '《行路难·其一》', ['setback', 'restart'], E, '继续这件'),
  classic('q27', '竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。', '苏轼', '《定风波·莫听穿林打叶声》', ['setback'], G, '继续这件'),
  classic('q28', '人谁无过？过而能改，善莫大焉。', '左丘明', '《左传·宣公二年》', ['setback', 'restart'], G, '接着做'),
  classic('q29', '过而不改，是谓过矣。', '孔子及弟子', '《论语·卫灵公》', ['setback'], E, '换小一步'),
  classic('q30', '亡羊而补牢，未为迟也。', '先秦典籍', '《战国策·楚策四》', ['setback', 'restart'], ALL, '接着做'),
  classic('q31', '力不足者，中道而废，今女画。', '孔子及弟子', '《论语·雍也》', ['setback', 'start'], G, '换小一步'),
  classic('q32', '我们在想象中受的苦，往往多于现实。', '塞涅卡', '《道德书简》第 13 封', ['setback', 'start'], G, '开始', {
    originalText: 'We suffer more often in imagination than in reality.',
    language: 'la/en',
    translation: 'paraphrase',
    sourceNote: '公版原作，据通行英译本意译'
  }),

  // 收尾 · 8
  classic('q33', '靡不有初，鲜克有终。', '先秦典籍', '《诗经·大雅·荡》', ['finish', 'persist'], G, '记下成果'),
  classic('q34', '慎终如始，则无败事。', '老子', '《道德经·第六十四章》', ['finish'], ALL, '记下成果'),
  classic('q35', '尽吾志也而不能至者，可以无悔矣。', '王安石', '《游褒禅山记》', ['finish', 'setback'], G, '记下成果'),
  classic('q36', '苟日新，日日新，又日新。', '先秦典籍', '《礼记·大学》引汤之盘铭', ['finish', 'restart'], E, '记下成果'),
  classic('q37', '桃李不言，下自成蹊。', '司马迁', '《史记·李将军列传》', ['finish'], G, '记下成果'),
  classic('q38', '究天人之际，通古今之变，成一家之言。', '司马迁', '《报任安书》', ['finish', 'persist'], E, '记下成果'),
  classic('q39', '有志者事竟成也。', '范晔', '《后汉书·耿弇传》', ['finish', 'restart'], E, '记下成果'),
  classic('q40', '挡路的东西，也能变成路。', '马可·奥勒留', '《沉思录》第五卷', ['finish', 'setback'], G, '记下成果', {
    originalText: 'The impediment to action advances action; what stands in the way becomes the way.',
    language: 'grc/en',
    translation: 'paraphrase',
    sourceNote: '公版原作，据通行英译本意译'
  }),

  // 重新开始 · 8
  classic('q41', '往者不可谏，来者犹可追。', '孔子及弟子', '《论语·微子》', ['restart', 'setback'], G, '接着做'),
  classic('q42', '穷则变，变则通，通则久。', '先秦典籍', '《周易·系辞下》', ['restart', 'choose'], ALL, '换一件'),
  classic('q43', '沉舟侧畔千帆过，病树前头万木春。', '刘禹锡', '《酬乐天扬州初逢席上见赠》', ['restart', 'setback'], G, '接着做'),
  classic('q44', '老骥伏枥，志在千里；烈士暮年，壮心不已。', '曹操', '《龟虽寿》', ['restart', 'persist'], E, '接着做'),
  classic('q45', '明日复明日，明日何其多。', '文嘉', '《明日歌》', ['restart', 'start'], E, '开始'),
  classic('q46', '临渊羡鱼，不如退而结网。', '班固', '《汉书·董仲舒传》', ['restart', 'start'], ALL, '开始'),
  classic('q47', '其实地上本没有路，走的人多了，也便成了路。', '鲁迅', '《故乡》', ['restart', 'start'], E, '开始'),
  classic('q48', '并非生命太短，而是我们浪费了太多。', '塞涅卡', '《论生命之短暂》第 1 章', ['restart', 'choose'], G, '开始', {
    originalText: 'It is not that we have a short time to live, but that we waste a lot of it.',
    language: 'la/en',
    translation: 'self',
    sourceNote: '公版原作，自译'
  }),

  // 原创行动提示 · 12
  original('o01', '打开昨天的草稿，只改一处。', ['start', 'restart'], '开始'),
  original('o02', '写下这次的输入和输出，不用管出错怎么办。', ['start'], '开始'),
  original('o03', '只做能看见结果的那一步。', ['start', 'choose'], '开始'),
  original('o04', '现在只留一件事，其余先放进记录。', ['choose'], '换一件'),
  original('o05', '把这一步改到五分钟能做完。', ['choose', 'setback'], '换小一步'),
  original('o06', '今天做过的，写一句留下来。', ['finish'], '记下成果'),
  original('o07', '先跑一次，跑不通也算有了结果。', ['start', 'setback'], '开始'),
  original('o08', '接着上次写的那句话往下写。', ['restart'], '接着做'),
  original('o09', '别清空清单，只挑一件放今天。', ['restart', 'choose'], '换一件'),
  original('o10', '做不动的时候，把动作再缩小一半。', ['setback', 'persist'], '换小一步'),
  original('o11', '给这一步留一句下一步，明天就不用重新想。', ['finish', 'persist'], '记下成果'),
  original('o12', '关掉之前，写下你刚才实际做到的那件事。', ['finish', 'setback'], '记下成果')
]

export const QUOTE_BY_ID = new Map(QUOTES.map((q) => [q.id, q]))

export const SCENE_LABEL: Record<QuoteScene, string> = {
  start: '开工',
  choose: '取舍',
  persist: '坚持',
  setback: '受挫',
  finish: '收尾',
  restart: '重新开始'
}

export const KIND_LABEL: Record<QuoteKind, string> = {
  classic: '引文',
  original: '原创提示',
  user: '我的摘录'
}
