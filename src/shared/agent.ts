// Pure Agent helpers shared by the Worker and the tests. The planner's reply
// is untrusted model output, so it is parsed into a small, bounded plan here;
// the run's user-facing receipt is built here too.

import { AGENT_MAX_STEPS, AGENT_MAX_TOOL_STEPS } from './config'
import type { AgentInfo, AgentStep, AgentTool, ProofInfo } from './types'

export type AgentPlanStep = Pick<AgentStep, 'tool' | 'title' | 'instruction'>

const DEFAULT_TITLES: Record<AgentTool, string> = {
  research: 'Research the web',
  build: 'Build the artifact',
  canvas: 'Make a study set',
  proof: 'Verify the result',
  answer: 'Write the answer',
}

const TOOL_LABELS: Record<AgentTool, string> = {
  research: 'Research',
  build: 'Build',
  canvas: 'Study',
  proof: 'Proof',
  answer: 'Answer',
}

export function agentToolLabel(tool: AgentTool): string {
  return TOOL_LABELS[tool]
}

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''

// A lane can answer HTTP 200 with its quota notice in the content. That is not
// an answer: the Agent skips that lane and tries the next one. Kept narrow so
// a real answer about quotas is not mistaken for one.
const PROVIDER_LIMIT =
  /(?:prevent abuse of free resources|free quota after recharging|console\.aihubmix\.com\/topup|accounts that have not been recharged|exceeded your current quota|check your plan and billing|(?:daily|free|monthly) quota (?:has been |was )?(?:exceeded|exhausted))/i

export function isProviderLimitText(text: string): boolean {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length < 800 && PROVIDER_LIMIT.test(clean)
}

function jsonBody(raw: string): Record<string, unknown> | undefined {
  const fenced = /```(?:json)?[ \t]*\n([\s\S]*?)```/i.exec(raw)?.[1]
  const text = (fenced ?? raw).trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

/** One tool step per kind, then exactly one answer step, within the cap. */
export function normalizeAgentPlan(plan: AgentPlanStep[]): AgentPlanStep[] {
  const tools: AgentPlanStep[] = []
  const seen = new Set<AgentTool>()
  for (const step of plan) {
    if (step.tool === 'answer' || seen.has(step.tool)) continue
    seen.add(step.tool)
    tools.push(step)
    if (tools.length >= AGENT_MAX_TOOL_STEPS) break
  }
  const answer = plan.find((step) => step.tool === 'answer')
  const steps = [
    ...tools,
    {
      tool: 'answer' as const,
      title: answer?.title || DEFAULT_TITLES.answer,
      instruction: answer?.instruction || 'Write the final answer to the goal using what the steps found.',
    },
  ]
  return steps.slice(0, AGENT_MAX_STEPS)
}

/** Parses a planner reply into a bounded plan, or undefined so a fallback runs. */
export function parseAgentPlan(raw: string): AgentPlanStep[] | undefined {
  const body = jsonBody(raw)
  if (!body) return undefined
  const rows = Array.isArray(body.steps) ? body.steps : Array.isArray(body.plan) ? body.plan : []
  const planned: AgentPlanStep[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const tool = item.tool
    if (tool !== 'research' && tool !== 'build' && tool !== 'canvas' && tool !== 'proof' && tool !== 'answer') continue
    const instruction = clean(item.instruction ?? item.task ?? item.prompt, 700)
    const title = clean(item.title ?? item.label, 80) || DEFAULT_TITLES[tool]
    if (tool !== 'answer' && !instruction) continue
    planned.push({ tool, title, instruction })
  }
  return planned.length ? normalizeAgentPlan(planned) : undefined
}

/**
 * The deterministic plan for a run. Clear requests route straight to the right
 * tool, so Agent never waits on a model just to decide what to do. Anything
 * else goes straight to the answer.
 */
export function fallbackAgentPlan(question: string): AgentPlanStep[] {
  const text = question.replace(/\s+/g, ' ').trim()
  const lower = text.toLowerCase()
  const wantsCanvas = /\b(flashcards?|quiz|practice questions|study set|memorize|memorise|revise)\b/.test(lower)
  const wantsBuild = /\b(build|make|create|design|code|develop|generate)\b[\s\S]{0,60}\b(page|site|website|web page|web app|game|tool|app|form|dashboard|landing page|html|calculator|tracker|proxy|server|api|endpoint|script|extension|clone)\b/.test(lower)
  const wantsResearch = /\b(research|sources?|citations?|latest|current|news|price|pricing|market|release date|who won|what happened|compare|according to)\b/.test(lower)
  // Research is only added before an artifact when the request asks for facts
  // that need looking up. "A bakery page with prices" should go straight to
  // Build; "the latest AI news page" should research first.
  const explicitResearch = /\b(research|sources?|citations?|latest|current|news|release date|who won|what happened|according to)\b/.test(lower)
  // Proof is an independent check, not a synonym for "answer carefully". Plan
  // it only when the person explicitly asks for verification or debugging.
  const wantsProof = /\b(verify|verification|double[- ]check|proof|prove|validate|check (?:my|this|the)|is this (?:correct|right)|debug|test this|test my)\b/.test(lower)
  const artifact: AgentPlanStep | undefined = wantsCanvas
    ? { tool: 'canvas', title: 'Make a study set', instruction: text }
    : wantsBuild
      ? { tool: 'build', title: 'Build the page or tool', instruction: text }
      : undefined
  const steps: AgentPlanStep[] = []
  if (artifact) {
    if (explicitResearch) steps.push({ tool: 'research', title: 'Research the web', instruction: text })
    steps.push(artifact)
  } else if (wantsResearch) {
    steps.push({ tool: 'research', title: 'Research the web', instruction: text })
  } else if (wantsProof) {
    steps.push({ tool: 'proof', title: 'Verify the result', instruction: text })
  }
  steps.push({
    tool: 'answer',
    title: 'Write the answer',
    instruction: 'Write the final answer to the goal using what the steps found.',
  })
  return steps
}

/** The artifact a request clearly asks to make, if any. */
export function artifactPlanStep(question: string): AgentPlanStep | undefined {
  return fallbackAgentPlan(question).find((step) => step.tool === 'build' || step.tool === 'canvas')
}

/**
 * A plan may answer a clear artifact request directly. If it did, put the
 * matching tool step back in front of the answer: "make a proxy" should build
 * something, not just describe one.
 */
export function ensureArtifactPlan(question: string, plan: AgentPlanStep[]): AgentPlanStep[] {
  const artifact = artifactPlanStep(question)
  if (!artifact) return plan
  // A direct "make me X" does not need a web report first. Research takes a
  // long time and can exhaust the lanes the build itself needs, so keep it only
  // when the request explicitly asks for sources or current information.
  const asksResearch = /\b(research|sources?|cite|citations?|latest|current|news|market|pricing|price|who won|what happened)\b/i.test(question)
  let tools = plan.filter((step) => step.tool !== 'answer')
  if (!asksResearch) tools = tools.filter((step) => step.tool !== 'research')
  if (!tools.some((step) => step.tool === artifact.tool)) tools = [artifact, ...tools]
  const answer = plan.find((step) => step.tool === 'answer')
  return normalizeAgentPlan([...tools, ...(answer ? [answer] : [])])
}

// A lane can answer with a status word, an apology, or a refusal instead of
// the answer. Those are not usable replies, especially when real tools ran.
const UNUSABLE_ANSWER =
  /^(?:sorry|i can'?t|i cannot|i'?m unable(?: to)?|i am unable(?: to)?|unable to|no|nope|running|please wait|one moment|thinking)[.!…]*$/i

export function isUsableAgentAnswer(text: string, substantive = false): boolean {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return false
  if (isProviderLimitText(clean)) return false
  if (UNUSABLE_ANSWER.test(clean)) return false
  // A run that used a real tool must explain what it produced, not return a stub.
  if (substantive && clean.length < 40) return false
  return true
}

/** Why proof output cannot become the final answer, if it cannot. */
export function proofAnswerIssue(
  proof: Pick<ProofInfo, 'status' | 'checks'>,
  text: string,
): 'no-checks' | 'unusable' | undefined {
  if (proof.status === 'checking') return undefined
  if (!proof.checks.length) return 'no-checks'
  if (!isUsableAgentAnswer(text, false)) return 'unusable'
  return undefined
}

/** A short, user-safe summary of what the run actually did. */
/**
 * A local plan handles clear requests. A long, ambiguous decision can fool the
 * keyword heuristic (for example "build a Shopify app or a service" is not a
 * request to generate an app), so let the model planner route those cases.
 */
export function shouldPlanWithModel(question: string, plan: AgentPlanStep[]): boolean {
  const text = question.replace(/\s+/g, ' ').trim()
  if (text.length < 25) return false
  const decision = /\b(?:should (?:i|we)|whether|decide|decision|compare|figure out|evaluate|recommend|roadmap|trade-?offs?)\b/i.test(text)
  if (decision) return true
  if (plan.some((step) => step.tool !== 'answer')) return false
  if (text.length < 90) return false
  return /\b(?:plan|strategy|research|find out|put together|help me|analy[sz]e|approach)\b/i.test(text)
}

const DECISION_START = /^\s*(?:should|would|could|can)\s+(?:i|we)\b|\bwhat\s+should\s+(?:i|we)\b|\bwhether\s+(?:i|we)\b|\bdecide\s+(?:whether|if)\b/i
const EXPLICIT_RESEARCH = /\b(?:research|sources?|cite|citations?|latest|current|currently|news|prices?|pricing|market\s+data|look\s+up|who\s+won|what\s+happened)\b/i
const EXPLICIT_ARTIFACT = /\b(?:build|make|create|design)\s+(?:me|us)\b|\b(?:show|give)\s+me\s+(?:a|an)\s+(?:page|site|website|web\s+app|app|game|tool|mockup|dashboard)\b/i

/**
 * A personal decision is not a request to build a product or run a web
 * research report. The model planner can over-read words like "build" and
 * "app" in "should I build an app or a service"; this keeps that turn honest
 * unless the person explicitly asks for research or an artifact.
 */
export function correctDecisionPlan(question: string, plan: AgentPlanStep[]): AgentPlanStep[] {
  const text = question.replace(/\s+/g, ' ').trim()
  if (!DECISION_START.test(text) || EXPLICIT_ARTIFACT.test(text)) return plan
  const tools = plan.filter(
    (step) =>
      step.tool === 'answer' ||
      (step.tool === 'research' && EXPLICIT_RESEARCH.test(text)) ||
      (step.tool === 'proof' && /\b(?:verify|double[- ]check|proof|prove|validate|debug)\b/i.test(text)),
  )
  return normalizeAgentPlan(tools)
}

const SMALL_TALK = /^(?:(?:hi|hello|hey|yo|sup)(?: there)?|good (?:morning|afternoon|evening)|how are you(?: doing)?|how'?s it going|what'?s up|thanks(?: you)?|thank you|ok(?:ay)?|cool|nice|great|bye|goodbye|what can you do|who are you|help)[!.?…\s]*$/i
const BUILD_REQUEST = /\b(?:build|make|create|design|code|develop|generate)\b[\s\S]{0,60}\b(?:page|site|website|web\s+page|web\s+app|game|tool|app|form|dashboard|landing\s+page|html|calculator|tracker|proxy|server|api|endpoint|script|extension|clone)\b/i
/**
 * A request that names the artifact first: "A page for a jazz club: four shows…".
 *
 * It has no verb, so BUILD_REQUEST missed it, and the route then treated the
 * request as an edit of whatever page was saved from an earlier turn — the agent
 * spent its first minute reading a bakery page it was not asked about. The
 * preposition keeps this narrow: "the page is slow" is not a new page.
 */
const BUILD_ARTIFACT =
  /^\s*(?:a|an|the|my)\b[\w\s'’-]{0,26}?\b(?:page|site|website|web\s*app|app|game|tool|dashboard)\s+(?:for|about|that|to|with|where|selling|showcasing)\b/i
const CANVAS_REQUEST = /\b(?:flashcards?|quiz|practice questions|study set|memorize|memorise|revise|test me)\b/i

// Tool words are normalized before intent checks so a typo does not silently
// drop the request into plain chat. The vocabulary is intentionally limited to
// tool-related words; ordinary prose is left alone.
const TOOL_VOCABULARY = [
  'build',
  'research',
  'analyze',
  'analyse',
  'study',
  'flashcard',
  'flashcards',
  'quiz',
  'practice',
  'questions',
  'agent',
  'advisor',
  'proof',
  'verify',
  'validate',
  'choose',
  'decide',
  'browser',
  'humanizer',
  'humanize',
  'canvas',
  'summarize',
  'spreadsheet',
  'dataset',
]

/** Levenshtein with an adjacent transposition, for common typing mistakes. */
function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j += 1) rows[0]![j] = j
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      rows[i]![j] = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i]![j] = Math.min(rows[i]![j]!, rows[i - 2]![j - 2]! + 1)
      }
    }
  }
  return rows[a.length]![b.length]!
}

export function normalizeToolTypos(value: string): string {
  const phrases = value
    .replace(/\bflash\s+cards?\b/gi, 'flashcards')
    .replace(/\bpractice\s+questions\b/gi, 'practice questions')
  return phrases.replace(/\b[a-z]{4,}\b/gi, (word) => {
    const lower = word.toLowerCase()
    if (TOOL_VOCABULARY.includes(lower)) return word
    let best = word
    let bestDistance = 2
    for (const term of TOOL_VOCABULARY) {
      if (Math.abs(term.length - lower.length) > 1) continue
      const distance = editDistance(lower, term)
      if (distance < bestDistance) {
        best = term
        bestDistance = distance
      }
    }
    return bestDistance <= 1 ? best : word
  })
}

const normalizedQuestion = (question: string) => normalizeToolTypos(question).replace(/\s+/g, ' ').trim()
const WRITING_ARTIFACT = /\b(?:irr|essays?|reports?|papers?|speeches?|paragraphs?|responses?|letters?|emails?|proposals?|thes(?:is|es)|dbq|leq|saq|outlines?|poems?|stor(?:y|ies)|narratives?)\b/i
const WRITING_ACTION = /\b(?:mock|sample|practice|draft|write|compose|create|make|generate|outline)\b/i
const WRITING_PAGE = /\b(?:page|site|website|web\s+app|app|game|tool|dashboard|form)\b/i
const CURRENT_FACTS = /\b(?:latest|newest|current|currently|today|this week|this month|news|prices?|pricing|cost|release|launch|who won|what happened|according to|look up|research the)\b/i
const ANALYZE_REQUEST = /\b(?:analy[sz]e|analysis|csv|tsv|xlsx|spreadsheet|dataset|data|rows|columns|correlat(?:e|ion)|chart|plot)\b/i

/** Greetings and quick acknowledgements should not trigger a mode's artifact. */
export function isSmallTalk(question: string): boolean {
  const text = question.replace(/\s+/g, ' ').trim()
  return text.length <= 80 && SMALL_TALK.test(text)
}

/** A request that clearly asks for a generated page, site, game, tool or app. */
export function isBuildRequest(question: string): boolean {
  const text = normalizedQuestion(question)
  return BUILD_REQUEST.test(text) || BUILD_ARTIFACT.test(text)
}

/**
 * A request that works on what already exists. BUILD_REQUEST is greedy — "make
 * sure the page still links it" is not a new project — so this wins when the
 * words name the current files, a file on disk, or an operation only an edit
 * can do.
 */
const EDIT_REQUEST =
  /\b(?:rename|instead of|replace|swap|move|extract|split|refactor|keep (?:it|the|that)|still (?:works?|links?|loads?|runs?)|existing|current (?:page|site|project|file|version)|this (?:page|site|project|file))\b|\b[\w-]+\.(?:html?|css|m?js|jsx|tsx?|json|svg)\b/i

export function isEditRequest(question: string): boolean {
  return EDIT_REQUEST.test(normalizedQuestion(question))
}

/** A request that clearly asks for flashcards or a quiz. */
export function isCanvasRequest(question: string): boolean {
  return CANVAS_REQUEST.test(normalizedQuestion(question))
}

const STUDY_ACTION = /\b(?:make|create|build|generate|give me|turn|convert|quiz me|test me|help me (?:study|revise|memorize|memorise)|i (?:need|want)|let'?s)\b/i
const STUDY_INFORMATIONAL = /^(?:what|how|why|when|where|who|which|explain|describe|tell me about|difference)\b/i

/**
 * A study request that should offer Study mode, not an informational question
 * about studying. This is deliberately narrower than isCanvasRequest: "what
 * are flashcards?" must not turn into a deck, while "make flashcards on ..."
 * should offer the mode.
 */
export function shouldSuggestCanvas(question: string): boolean {
  const text = normalizedQuestion(question)
  if (isSmallTalk(text) || !CANVAS_REQUEST.test(text) || STUDY_INFORMATIONAL.test(text)) return false
  if (STUDY_ACTION.test(text)) return true
  return /^(?:flashcards?|quiz|practice questions?|study set)\b/i.test(text)
}

export type SuggestedToolMode = 'research' | 'analyze' | 'build' | 'canvas' | 'agent' | 'advisor' | 'proof'

export const SUGGESTED_MODE_LABEL: Record<SuggestedToolMode, string> = {
  research: 'Research',
  analyze: 'Analyze',
  build: 'Build',
  canvas: 'Study',
  agent: 'Agent',
  advisor: 'Advisor',
  proof: 'Proof',
}

const ADVISOR_REQUEST = /\b(?:should i (?:choose|pick|buy|use|go with|take|accept|hire|invest|start|quit|move|switch|stay|wait)|help me (?:choose|decide)|which (?:one|option) (?:should|to (?:choose|pick)|is better)|which is better|pros and cons|make a decision|decide between|is it better to|what would you do|worth it)\b/i
const AGENT_REQUEST = /\b(?:multi[- ]step|end[- ]to[- ]end|workflow|plan (?:this|it|the task)|go and|handle (?:this|it) for me|do (?:this|it) end to end)\b/i
const ANALYZE_ACTION = /\b(?:analy[sz]e|analysis|chart|plot|compare|correlat(?:e|ion)|run|show|find)\b/i
const ANALYZE_DATA = /\b(?:csv|tsv|xlsx|spreadsheet|dataset|data set|rows|columns|correlat(?:e|ion)|table)\b|\b(?:this|the|my|attached)\s+data\b/i
const RESEARCH_REQUEST = /\b(?:research|look up|search (?:the )?web|find (?:sources?|out)|cite|citations?|according to|with sources|source list)\b/i
const RESEARCH_CURRENT = /\b(?:latest|newest|today|this week|this month|news|current events|prices?|pricing|release date|launched|who won|what happened|as of|recent)\b/i
const PROOF_REQUEST = /\b(?:prove|proof|verify|validate|double[- ]check|fact[- ]check|check (?:my|this|the) (?:code|math|work|answer))\b/i

export function shouldSuggestAdvisor(question: string): boolean {
  return !isSmallTalk(question) && ADVISOR_REQUEST.test(normalizedQuestion(question))
}

export function shouldSuggestAgent(question: string): boolean {
  const text = normalizedQuestion(question)
  if (isSmallTalk(text) || /^(?:what|how|why|explain|describe|tell me about)\b/i.test(text)) return false
  if (AGENT_REQUEST.test(text)) return true
  const actions = text.match(/\b(?:research|build|make|create|analyze|chart|summari[sz]e|find|draft|write|design)\b/gi)?.length ?? 0
  return actions >= 2 && /\b(?:then|after that|and then|followed by)\b/i.test(text)
}

export function shouldSuggestAnalyze(question: string, hasDataAttachment = false): boolean {
  const text = normalizedQuestion(question)
  if (isSmallTalk(text) || !ANALYZE_ACTION.test(text)) return false
  if (ANALYZE_DATA.test(text)) return true
  return hasDataAttachment && /\b(?:chart|plot|trend)\b/i.test(text)
}

export function shouldSuggestResearch(question: string): boolean {
  const text = normalizedQuestion(question)
  if (isSmallTalk(text)) return false
  if (isBuildRequest(text) || shouldSuggestCanvas(text) || shouldSuggestAdvisor(text)) return false
  return RESEARCH_CURRENT.test(text) || RESEARCH_REQUEST.test(text)
}

export function shouldSuggestProof(question: string): boolean {
  const text = normalizedQuestion(question)
  if (isSmallTalk(text) || /^(?:what|how|why|explain|describe|tell me about)\b/i.test(text)) return false
  return PROOF_REQUEST.test(text)
}

/** Returns the one mode that should be offered for a Chat-only request. */
export function suggestToolMode(
  question: string,
  options: { hasAttachments?: boolean; hasDataAttachment?: boolean } = {},
): SuggestedToolMode | null {
  const text = normalizedQuestion(question)
  if (isSmallTalk(text)) return null
  const hasAttachments = options.hasAttachments === true
  const hasDataAttachment = options.hasDataAttachment === true
  if (shouldSuggestAgent(text)) return hasAttachments ? null : 'agent'
  if (shouldSuggestAdvisor(text)) return 'advisor'
  if (isBuildRequest(text)) return hasAttachments ? null : 'build'
  if (shouldSuggestCanvas(text)) return hasAttachments ? null : 'canvas'
  if (shouldSuggestAnalyze(text, hasDataAttachment)) return hasAttachments && !hasDataAttachment ? null : 'analyze'
  if (shouldSuggestResearch(text)) return hasAttachments ? null : 'research'
  if (shouldSuggestProof(text)) return 'proof'
  return null
}

/**
 * A writing request asks for a document, not a live web report. "IRR" alone is
 * ambiguous with finance, so it needs AP Seminar/action context.
 */
export function isWritingRequest(question: string): boolean {
  const text = question.replace(/\s+/g, ' ').trim()
  if (isSmallTalk(text)) return false
  if (!WRITING_ARTIFACT.test(text) || WRITING_PAGE.test(text)) return false
  if (/^\s*(?:what|how|why|when|where|who)\b/i.test(text)) return false
  if (WRITING_ACTION.test(text)) return true
  return /\bap\s+seminar\b/i.test(text) && /\birr\b/i.test(text)
}

export function needsCurrentFacts(question: string): boolean {
  return CURRENT_FACTS.test(question.replace(/\s+/g, ' ').trim())
}

/**
 * Research mode should research questions, not force a report on a greeting or
 * a request that needs a different tool.
 */
export function isResearchIntent(question: string): boolean {
  const text = normalizedQuestion(question)
  if (isSmallTalk(text)) return false
  if (isBuildRequest(text) || isCanvasRequest(text)) return false
  if (isWritingRequest(text)) return true
  if (/\?\s*$/.test(text)) return true
  if (/^\s*(?:what|why|how|when|where|who|which|is|are|can|does|do|did|should|would|could)\b/i.test(text)) return true
  return /\b(?:research|sources?|latest|current|news|compare|according\s+to|find\s+out)\b/i.test(text)
}

// Buffy's full agent is expensive: it assembles the workspace tools before it
// writes a sentence. Only an explicit request to operate on the workspace, a
// file, a command, a test run, or a tool surface belongs on that path. A bare
// mention of "search", "test" or "code" is ordinary conversation.
const BUFFY_TOOL_WORK = [
  /\b(?:read|open|inspect|edit|change|modify|update|delete|rename|move|copy)\s+(?:the\s+|my\s+|this\s+|a\s+)?(?:[\w-]+\s+){0,2}(?:files?|folders?|director(?:y|ies)|repos?(?:itory)?|projects?|workspaces?|codebase)\b/i,
  /\b(?:write|create)\s+(?:the\s+|my\s+|this\s+|a\s+)?(?:[\w-]+\s+){0,2}(?:files?|folders?|director(?:y|ies)|repos?(?:itory)?|workspaces?|codebase)\b/i,
  /\b(?:read|open|inspect|edit|write|update|fix|run|test|debug|refactor|check|review)\s+(?:the\s+|my\s+|this\s+)?[`"']?(?:[\w.-]+\/)*[\w.-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|json|md|css|html|yml|yaml|toml|sh|rs|go|java|rb|php)\b/i,
  /\b(?:run|execute|test|debug|fix|refactor|check|review|verify)\s+(?:the\s+|my\s+|this\s+|a\s+)?(?:[\w-]+\s+){0,2}(?:code|codebase|repos?(?:itory)?|projects?|files?|tests?|test\s+suite|bugs?|scripts?|commands?|programs?|builds?)\b/i,
  /\b(?:use|open|launch|search|browse|look\s+up|find|read)\s+(?:the\s+|my\s+|this\s+|a\s+)?(?:[\w-]+\s+){0,2}(?:terminal|shell|browser|workspace|web|internet|online|docs?|documentation|google|site|page|files?|repos?(?:itory)?|codebase|code)\b/i,
  /(?:^\s*|\b(?:run|execute)\s+)(?:the\s+)?[`"']?(?:git|npm|pnpm|yarn|bun|npx)\s+(?:run|test|install|build|status|add|commit|push|pull|checkout|branch|diff|log|init|exec)\b/i,
  /\b(?:run|execute)\s+[`"']?(?:node|python|python3|pip|uv|cargo|go|make)\s+[`"']?[\w./-]+/i,
  /\b(?:install|update|remove)\s+(?:the\s+|my\s+|this\s+|a\s+)?(?:dependencies|packages?|node_modules)\b/i,
  /\b(?:commit|push|deploy)\s+(?:the\s+|my\s+|this\s+)?(?:changes?|code|branch|app|site|project)\b/i,
]

/** True only when Buffy is explicitly being asked to use its tools. */
export function needsBuffyTools(question: string): boolean {
  const text = question.replace(/\s+/g, ' ').trim()
  return BUFFY_TOOL_WORK.some((pattern) => pattern.test(text))
}

/** Analyze only runs when the message actually asks for data work. */
export function isAnalyzeIntent(question: string): boolean {
  const text = normalizedQuestion(question)
  if (isSmallTalk(text)) return false
  return ANALYZE_REQUEST.test(text)
}

/** A reviewer's strict verdict on the draft answer. */
export type AgentReview = { verdict: 'pass' | 'revise'; issues: string[] }

/** Parses a reviewer reply, or returns undefined so the draft stands. */
export function parseAgentReview(raw: string): AgentReview | undefined {
  const body = jsonBody(raw)
  if (!body) return undefined
  const verdict = body.verdict === 'revise' ? 'revise' : body.verdict === 'pass' ? 'pass' : undefined
  if (!verdict) return undefined
  const issues = Array.isArray(body.issues)
    ? body.issues
        .filter((issue): issue is string => typeof issue === 'string' && Boolean(issue.trim()))
        .map((issue) => issue.replace(/\s+/g, ' ').trim().slice(0, 240))
        .slice(0, 5)
    : []
  return { verdict, issues }
}

export function buildAgentReceipt(input: {
  status: AgentInfo['status']
  steps: AgentStep[]
  startedAt: number
  finishedAt: number
  reviewed?: boolean
  revised?: boolean
}): string {
  const tools = input.steps.filter((step) => step.tool !== 'answer')
  const done = tools.filter((step) => step.status === 'done')
  const failed = tools.filter((step) => step.status === 'failed')
  const skipped = tools.filter((step) => step.status === 'skipped')
  const head =
    input.status === 'partial' ? 'Run partly complete' : input.status === 'failed' ? 'Run failed' : 'Run complete'
  const parts: string[] = []
  if (tools.length) {
    parts.push(`${done.length}/${tools.length} tools ran`)
    for (const step of done) {
      if (step.detail) parts.push(`${agentToolLabel(step.tool)}: ${step.detail}`)
    }
    if (failed.length) parts.push(`${failed.length} failed`)
    if (skipped.length) parts.push(`${skipped.length} skipped`)
  } else {
    parts.push('Answered directly')
  }
  if (input.revised) parts.push('revised after review')
  else if (input.reviewed) parts.push('reviewed by a second model')
  const seconds = Math.max(0, Math.round((input.finishedAt - input.startedAt) / 1000))
  parts.push(`${seconds}s`)
  return `${head} · ${parts.join(' · ')}`.slice(0, 400)
}
