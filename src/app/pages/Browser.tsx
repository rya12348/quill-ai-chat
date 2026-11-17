import { ArrowLeft, ArrowRight, Bot, Code2, ExternalLink, Globe2, Loader2, Monitor, Play, Plus, RefreshCw, Search, Square, Timer, X } from 'lucide-react'
import { startTransition, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { answerVisibleFact, answerVisibleSchedule, cleanPageAnswer, directActionLead, directBrowserAction, directBrowserLead, directBrowserTask, directElementAction, directFindLink, directFormFill, directPageSearch, directQuestionAnswer, directSearchAnswer, directSearchOpen, directSiteLookup, directSiteSearch, firstContentLink, isDocumentWritingTask, isSameBrowserSite, directPageEdit, isPageEditingTask, isSimulationTask, isSpreadsheetChartTask, isSpreadsheetDataTask, looksLikeRefusal, PAGE_ANSWER_UNAVAILABLE } from '../../shared/browser'

/** A signed-out Google app usually bounces to accounts.google.com, and
 * Classroom bounces to its marketing page. Both mean the task cannot continue
 * until the person signs in, so do not spend planner calls on them. */
function googleSignInRequired(target: string, landed: string): boolean {
  try {
    const wanted = new URL(target)
    const actual = new URL(landed)
    if (/accounts\.google\.com$/i.test(actual.hostname)) return true
    return /classroom\.google\.com$/i.test(wanted.hostname) && /edu\.google\.com$/i.test(actual.hostname)
  } catch {
    return false
  }
}

/** A1, B1, …, Z1, AA1 for the planner's chart range. */
function firstSearchResult(elements: BrowserElement[], query = ''): BrowserElement | null {
  const needle = query.toLowerCase()
  const candidates = elements.filter((element) => {
    // Google renders a result title as a role=link container, not always an
    // <a>; use the URL printed in its label when href is absent.
    const href = element.href || /https?:\/\/\S+/i.exec(element.label)?.[0] || ''
    const linkLike = element.tag === 'a' || element.role === 'link' || /https?:\/\//i.test(element.label)
    if (!linkLike || !href || element.label.trim().length < 4) return false
    // Hidden duplicates (YouTube keeps several zero-size anchors for each
    // video) must not win the first-result click.
    if (element.rect.width <= 0 || element.rect.height <= 0) return false
    if (/^(?:more\s+results?|images?|videos?|news|shopping|maps?)\b/i.test(element.label.trim())) return false
    // Google redacts result text and wraps links in /goto?url= on automated
    // sessions. That anchor is the first organic result even though its host
    // is google.com; clicking it resolves to the real destination.
    const googleResult = /(?:^|\/)goto\?url=/i.test(href)
    if (!googleResult) {
      if (!/^https?:\/\//i.test(href)) return false
      try {
        const host = new URL(href).hostname
        if (/(?:^|\.)(?:google|googleadservices|gstatic|googleusercontent)\.com$/i.test(host)) return false
      } catch {
        return false
      }
    }
    return true
  })
  // Prefer the result named by the query; fall back to the first external
  // result when the query is only part of the result label.
  const needleWord = needle.split(/\s+/)[0] || ''
  return (
    candidates.find((element) => needle && element.label.toLowerCase().includes(needle)) ??
    candidates.find((element) => needleWord && element.label.toLowerCase().includes(needleWord)) ??
    candidates.find((element) => !/youtube\.com$/i.test((() => { try { return new URL(element.href || /https?:\/\/\S+/i.exec(element.label)?.[0] || '').hostname } catch { return '' } })())) ??
    candidates[0] ??
    null
  )
}

function sheetColumnName(count: number): string {
  let value = Math.max(1, Math.min(20, count))
  let name = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    value = Math.floor((value - 1) / 26)
  }
  return name
}
import type { BrowserAction, BrowserActResponse, BrowserElement, BrowserHistoryEntry, BrowserInspectResponse, BrowserInspectResult, BrowserScreen, BrowserSessionResponse, BrowserTab, BrowserViewState, BrowserWriteResponse } from '../../shared/types'
import { BrandArt } from '../components/BrandArt'
import { Mark } from '../components/Shell'
import { api, ApiError } from '../lib/api'
import { cx } from '../lib/cx'
import { localBrowser } from '../lib/local-browser'

type BrowserStatus = 'checking' | 'idle' | 'starting' | 'ready' | 'unconfigured' | 'quota'
type BrowserViewport = { width: number; height: number }
type LogEntry = { role: 'you' | 'stet' | 'action' | 'error'; text: string; thinking?: string; thoughts?: string[]; detail?: string; at: number }
type ActionMarker = { x: number; y: number; label: string; viewport: BrowserViewState['snapshot']['viewport'] }
type BrowserSheetResponse = { state: BrowserViewState; rows: number; columns: number; lane?: string; chart?: boolean }

// A browser session starts on a neutral page. The previous Sheets start page
// anchored unrelated tasks (Classroom, docs, ordinary sites) to a spreadsheet.
const DEFAULT_URL = 'https://www.google.com/'
const MAX_STEPS = 60
// A long course or a many-page form can need more than one round. The plan,
// notes and scratchpad carry over, so the second round continues the task
// instead of restarting it.
const MAX_ROUNDS = 2
const MAX_ACTIONS = MAX_STEPS * MAX_ROUNDS
// There is deliberately no overall task clock: a slow page or a multi-field
// form must not be cut off just because a fixed wall-clock budget expired.
// Each planner call still has a transport backstop, and the Worker switches
// lanes long before this; ordinary commands stay on the direct path.
// A ceiling, not a delay: fast plans still return in seconds, while a hard
// step the worker escalates to a strong reasoner is allowed to finish.
// Covers the first normal pass, the automatic normal retry, and the stronger
// recovery pass without aborting the recovery while it is still healthy.
const PLAN_TIMEOUT_MS = 190_000
// The browser keeps its plan, notes and scratchpad on the device so closing a
// popup or reloading the page does not erase what the agent already learned.
const BROWSER_MEMORY_KEY = 'ink.browser.memory.v1'
function saveBrowserMemory(memory: { task: string; plan: string[]; notes: string[]; script: string }) {
  try {
    if (!memory.task.trim()) return
    localStorage.setItem(
      BROWSER_MEMORY_KEY,
      JSON.stringify({ ...memory, script: memory.script.slice(0, 12_000), at: Date.now() }),
    )
  } catch {
    // Storage can be full or disabled; memory is an optimization, not a need.
  }
}
/** A completion message is a report, not a page dump. The planner sometimes
 * pastes the whole snapshot into done; keep the first few sentences. */
function cleanDoneMessage(message: string): string {
  const text = message.trim()
  if (text.length <= 600) return text
  const sentences = text.match(/[^.!?]+[.!?]+/g)?.slice(0, 3).join(' ').trim() ?? ''
  const short = sentences.length >= 80 ? sentences : text.slice(0, 500).trim()
  return short.endsWith('.') ? short : `${short}…`
}
function loadBrowserMemory(): { task: string; plan: string[]; notes: string[]; script: string } | null {
  try {
    const raw = localStorage.getItem(BROWSER_MEMORY_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Record<string, unknown>
    if (typeof value.task !== 'string' || !value.task.trim()) return null
    if (Date.now() - Number(value.at ?? 0) > 24 * 60 * 60 * 1_000) return null
    return {
      task: value.task,
      plan: Array.isArray(value.plan) ? value.plan.filter((item): item is string => typeof item === 'string').slice(0, 8) : [],
      notes: Array.isArray(value.notes) ? value.notes.filter((item): item is string => typeof item === 'string').slice(-8) : [],
      script: typeof value.script === 'string' ? value.script : '',
    }
  } catch {
    return null
  }
}
const SESSION_CHECK_MS = 60_000
const SESSION_ENDED = 'This browser session ended. Start a new one; your Google sign-in is saved.'

/** A click-and-report task whose answer is the click's destination. */
function asksForDestination(task: string): boolean {
  const asks =
    /\b(?:what|which)\s+(?:page|site|url|website)\b[\s\S]*\b(?:open|opens|opened|lead|leads|go|goes)\b/i.test(task) ||
    /\bwhere\s+(?:does|do|did)\b[\s\S]*\b(?:go|lead)\b/i.test(task)
  if (!asks) return false
  // If the sentence asks for more work after the destination, do not stop at
  // the click. The normal loop can still handle that larger task.
  return !/\b(?:then|after that)\b[\s\S]*\b(?:fill|type|click|search|open|go\s+to|buy|submit|select|choose|download|upload|send|book|add|delete|save|copy|paste|summari[sz]e|read|describe|explain|compare|extract|check)\b/i.test(
    task,
  )
}

/** A click/open followed only by a request to read the resulting page. */
function asksForAnswerAfterAction(task: string): boolean {
  const parts = task.split(/\b(?:then|and)\b/i)
  if (parts.length < 2) return false
  if (!/^\s*(?:open|click|tap|go\s+to|visit)\b/i.test(parts[0])) return false
  const tail = parts.slice(1).join(' and ')
  if (!/\b(?:tell|show|report|read|summari[sz]e|what|which|who|when|where|why|how)\b/i.test(tail)) return false
  // If another page action remains after the answer clause, keep the planner.
  return !/\b(?:click|tap|open|go\s+to|navigate|visit|fill|type|search|select|choose|submit|upload|download|scroll|press|buy|book|order|sign\s+in|log\s+in|delete|remove|add|save|send|compare|apply|checkout|play|pause|next|previous|back|forward|reload)\b/i.test(
    tail,
  )
}

/** A due/deadline question can be answered by comparing visible dates. */
function asksForSchedule(task: string): boolean {
  return /\b(?:due|deadline|assignments?|homework|to-?do)\b/i.test(task)
}

/** A task whose answer has to come from reading the page, not from the action. */
function asksForPageAnswer(task: string): boolean {
  return (
    /\?/.test(task) ||
    /\b(?:tell|report|read|summari[sz]e|answer|describe|explain|compare|extract|list|what|which|who|when|where|why|how|check whether|whether)\b/i.test(
      task,
    )
  )
}

/** A repeated browser job should start as one page program, not a chain of
 * planner calls. Video-question work is the clearest case, but the same intent
 * applies to quizzes, lessons and worksheets. */
function prefersPageScript(task: string): boolean {
  const repeated = /\b(?:every|all|each|rows?|table|pages?|items?|questions?|fields?|entries|list)\b/i.test(task)
  const work = /\b(?:answer|solve|complete|watch|finish|do|fill|submit|extract|collect|read|list|copy|download|open|compare|summari[sz]e)\b/i.test(task)
  return (
    (/\b(?:videos?|quiz(?:zes)?|questions?|worksheets?|lessons?|flashcards?|courses?|modules?|training)\b/i.test(task) &&
      /\b(?:answer|solve|complete|watch|finish|do|every|all|each|questions?)\b/i.test(task)) ||
    (repeated && work)
  )
}

/** A page-answer response that is safe to show, or an empty string. */
function usablePageAnswer(raw: string): string {
  const answer = cleanPageAnswer(raw)
  return answer === PAGE_ANSWER_UNAVAILABLE ? '' : answer
}

/** A question that still needs the browser to click, navigate or type first. */
function needsPageAction(task: string, afterNavigation = false): boolean {
  // “Answer every question” on a quiz, worksheet or lesson is not a request for
  // a chat answer: the answers have to be entered on the page, and the video
  // may need to be resumed between them. Keep genuine reading questions such
  // as “what is the answer to question 1?” on the fast read-only lane.
  if (
    /\b(?:answer|solve|respond\s+to|complete|finish|do)\b[\s\S]{0,80}\b(?:every|all|each|the|these|those)\s+(?:questions?|quiz|test|exercise|assignment)\b/i.test(task) ||
    /\b(?:answer|solve)\b[\s\S]{0,40}\bquestions\b/i.test(task)
  ) {
    return true
  }
  if (
    /\b(?:click|open|go\s+to|navigate|visit|fill|type|search|select|choose|submit|upload|download|scroll|press|buy|book|order|sign\s+in|log\s+in|sign\s+up|delete|remove|add|save|send|compare|apply|checkout|play|pause|next|previous|back|forward|reload)\b/i.test(
      task,
    )
  ) {
    return true
  }
  // Due work, grades and schedules live behind a section on the account page.
  // Once this run has already opened the named site, read what it landed on
  // before spending planner steps to rediscover a section that is already there.
  return !afterNavigation && /\b(?:due|deadline|assignments?|homework|to-?do|grades?|gradebook|schedule|timetable)\b/i.test(task)
}

/** YouTube result labels append the duration; the title should not. */
function cleanVideoLabel(value: string): string {
  return value
    .replace(/\s+\d+\s+(?:hours?|minutes?|seconds?)(?:,\s*\d+\s+(?:minutes?|seconds?))?\s*$/i, '')
    .trim()
}

/** Only a task that is genuinely one page action may use a direct click to finish. */
function isSingleActionInstruction(task: string): boolean {
  const cleaned = task.trim().replace(/[.!?]+$/, '')
  if (/\b(?:and|then)\b/i.test(cleaned)) return false
  if (/^(?:make|create|build|write|draft|compose|research|design|develop|prepare|produce|plan|compare|summari[sz]e|find|answer|solve|complete|finish)\b/i.test(cleaned)) return false
  return /^(?:click|tap|press|open|go\s+to|visit|launch|scroll|reload|refresh|go\s+back|back|forward|type|enter|select|choose|check|uncheck|hover|focus|drag)\b/i.test(cleaned)
}

/** Finish a purely imperative task without paying for a final model round trip. */
function completionMessage(task: string): string {
  const lower = task.toLowerCase()
  if (/\b(?:fill|submit|form|checkout|order|apply)\b/.test(lower)) return 'Done — the form was filled and submitted.'
  if (/\bsearch\b/.test(lower)) return 'Done — the search was submitted.'
  return 'Done — the requested browser steps are complete.'
}

/** Find the element a planner action is aimed at, when it names one. */
function targetElement(action: BrowserAction, elements: BrowserElement[]): BrowserElement | null {
  const selector =
    action.type === 'fill'
      ? action.fields[0]?.selector
      : action.type === 'drag'
        ? action.fromSelector
        : 'selector' in action
          ? action.selector
          : undefined
  if (!selector) return null
  const id = /data-stet-id="([^"]+)"/.exec(selector)?.[1]
  return id ? elements.find((element) => element.id === id) ?? null : null
}

function actionLabel(action: BrowserAction, elements: BrowserElement[] = []): string {
  const target = targetElement(action, elements)
  const name =
    action.type === 'type' && target?.inputType === 'text' && target.value && target.value === target.label
      ? target.placeholder || 'the text field'
      : target?.label || target?.placeholder || target?.tag
  const typed = action.type === 'type' ? action.text.length > 80 ? `${action.text.slice(0, 77)}…` : action.text : ''
  switch (action.type) {
    case 'click':
      return name ? `Click “${name}”` : action.selector ? 'Click the page element' : `Click ${Math.round(action.x ?? 0)}, ${Math.round(action.y ?? 0)}`
    case 'findLink':
      return `Find “${action.text}”`
    case 'hover':
      return name ? `Hover over “${name}”` : action.selector ? 'Hover over the page element' : `Hover ${Math.round(action.x ?? 0)}, ${Math.round(action.y ?? 0)}`
    case 'drag':
      return 'Drag the page element'
    case 'focus':
      return name ? `Focus “${name}”` : 'Focus the page element'
    case 'type':
      return name ? `Type “${typed}” into “${name}”` : `Type “${typed}”`
    case 'fill':
      return `Fill ${action.fields.length} field${action.fields.length === 1 ? '' : 's'}`
    case 'select':
      return name ? `Choose “${action.value}” in “${name}”` : `Choose “${action.value}”`
    case 'check':
      return `${action.checked ? 'Check' : 'Uncheck'} ${name ? `“${name}”` : 'the box'}`
    case 'press':
      return `Press ${action.modifiers?.length ? `${action.modifiers.join('+')}+` : ''}${action.key}`
    case 'scroll':
      return `Scroll ${(action.y ?? 400) > 0 ? 'down' : 'up'}`
    case 'navigate':
      return `Open ${action.url}`
    case 'back':
      return 'Back'
    case 'forward':
      return 'Forward'
    case 'reload':
      return 'Reload page'
    case 'wait':
      return `Wait ${action.ms}ms`
    case 'waitFor':
      return action.state === 'time'
        ? `Wait ${Math.round((action.timeoutMs ?? 0) / 1_000)}s`
        : action.state === 'attention'
          ? 'Wait for a video question or pause'
          : `Wait for ${action.selector || action.text || 'the video'} to become ${action.state || 'visible'}`
    case 'questionLoop':
      return 'Run the question script'
    case 'inspect':
      return action.selector ? `Inspect ${action.selector}` : 'Inspect the page'
    case 'screenshot':
      return 'Capture the page'
    case 'style':
      return 'Apply a style change to the page'
    case 'evaluate':
      return 'Run a page action'
    case 'ask':
      return 'Ask'
    case 'done':
      return 'Done'
    default:
      return 'Page action'
  }
}

/** Screen position for the soft action halo over the live view. */
function markerFor(action: BrowserAction, state: BrowserViewState): ActionMarker | null {
  const marksTarget =
    action.type === 'click' ||
    action.type === 'type' ||
    action.type === 'hover' ||
    action.type === 'focus' ||
    action.type === 'fill' ||
    action.type === 'select' ||
    action.type === 'check' ||
    action.type === 'drag'
  if (!marksTarget) return null
  const target = targetElement(action, state.snapshot.elements)
  if (target?.offscreen) return null
  const point = action.type === 'click' || action.type === 'hover' ? action : null
  const x = target ? target.rect.x + target.rect.width / 2 : point?.x
  const y = target ? target.rect.y + target.rect.height / 2 : point?.y
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return {
    x: Math.max(0, Math.min(state.snapshot.viewport.width, Number(x))),
    y: Math.max(0, Math.min(state.snapshot.viewport.height, Number(y))),
    label: actionLabel(action, state.snapshot.elements),
    viewport: state.snapshot.viewport,
  }
}

function stateDetail(state: BrowserViewState): string {
  return `${state.title || 'Page'} · ${state.url}`
}

/** Menus and panels change the interactive state even when top copy does not. */
function elementSignature(state: BrowserViewState): string {
  return state.snapshot.elements
    .map(
      (element) =>
        `${element.tag}|${element.role}|${element.label}|${element.value || ''}|${element.checked ?? ''}|${element.expanded ?? ''}|${element.offscreen ? 1 : 0}`,
    )
    .join('\n')
}

function formatDuration(ms: number): string {
  return ms < 1_000 ? `${Math.max(1, Math.round(ms))}ms` : `${(ms / 1_000).toFixed(1)}s`
}

function messageFor(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.code === 'browser_timeout') return 'The cloud browser took too long to respond. It was retried once; press Start browser to try again.'
    if (cause.code === 'browser_signin') return cause.message
    if (cause.status === 0) return 'Ink lost its connection to the cloud browser. Check your connection and try again.'
    return cause.message || 'The browser could not complete that step.'
  }
  if (cause instanceof DOMException && (cause.name === 'AbortError' || cause.name === 'TimeoutError')) {
    return 'That step took longer than expected. The page is still open — try again.'
  }
  if (cause instanceof TypeError && /fetch|network|load failed/i.test(cause.message)) {
    return 'Ink could not reach the browser service. Check your connection and try again.'
  }
  return cause instanceof Error ? cause.message : 'The browser could not complete that step.'
}

function isSessionLoss(cause: unknown): boolean {
  return cause instanceof ApiError && (cause.code === 'session_expired' || cause.code === 'no_session')
}

/** A planner deadline is recoverable: retry once with the fast pass instead of ending the run. */
function isPlanTimeout(cause: unknown): boolean {
  return (
    (cause instanceof ApiError && (cause.code === 'browser_plan_timeout' || cause.code === 'browser_plan_unavailable')) ||
    (cause instanceof DOMException && cause.name === 'TimeoutError')
  )
}

/** Treat the address bar like a browser: URLs navigate, words search. */
function addressTarget(raw: string): string {
  const value = String(raw ?? '').trim()
  if (!value) return DEFAULT_URL
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return value
  const looksLikeHost =
    /^localhost(?::\d+)?(?:[/?#]|$)/i.test(value) ||
    /^[\w-]+(?:\.[\w-]+)+(?:[/:?#]|$)/.test(value)
  if (!looksLikeHost || /\s/.test(value)) {
    return `https://duckduckgo.com/?q=${encodeURIComponent(value)}`
  }
  return `https://${value}`
}

/** Add Steel's documented interactive flag without disturbing signed query data. */
function interactiveLiveUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.searchParams.set('interactive', 'true')
    return parsed.toString()
  } catch {
    return url
  }
}

/** Match the remote Chrome window to the pane the person will actually use. */
function viewportForPane(element: HTMLElement | null): BrowserViewport | undefined {
  if (!element) return undefined
  const style = window.getComputedStyle(element)
  const width = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  const height = element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 32
  if (width < 240 || height < 200) return undefined
  const aspect = Math.min(2.2, Math.max(0.5, width / height))
  let remoteWidth = Math.round(Math.sqrt(1_000_000 * aspect))
  let remoteHeight = Math.round(remoteWidth / aspect)
  if (remoteHeight > 1_080) {
    remoteHeight = 1_080
    remoteWidth = Math.round(remoteHeight * aspect)
  }
  return {
    width: Math.round(remoteWidth / 2) * 2,
    height: Math.round(remoteHeight / 2) * 2,
  }
}

// A cosmetic simulation often gets the labels right but leaves the lock icon,
// overlay or greyed-out filter behind. This runs after every simulation and
// removes those affordances without touching the site's data.
const SIMULATION_CLEANUP = [
  "(() => {",
  "  const style = document.createElement('style');",
  "  style.setAttribute('data-stet-simulation', 'unlocked');",
  "  style.textContent = [",
  "    '[class*=\"lock-icon\" i], [class*=\"lockIcon\" i], [class*=\"lock-overlay\" i], [class*=\"lockOverlay\" i], [class*=\"lock-badge\" i], [class*=\"lockBadge\" i], [class~=\"lock\" i], [data-testid*=\"lock\" i], [aria-label*=\"lock\" i], [title*=\"lock\" i] { display: none !important; visibility: hidden !important; }',",
  "    '[class*=\"locked\" i] { filter: none !important; opacity: 1 !important; }',",
  "    '[class*=\"card\" i], [class*=\"item\" i], [class*=\"tile\" i], [class*=\"product\" i] { filter: none !important; opacity: 1 !important; }',",
  "    '[class*=\"locked\" i]::before, [class*=\"locked\" i]::after, [class*=\"card\" i]::before, [class*=\"card\" i]::after, [class*=\"tile\" i]::before, [class*=\"tile\" i]::after { content: none !important; display: none !important; }',",
  "  ].join('\\n');",
  "  document.head.appendChild(style);",
  "  let removed = 0;",
  "  for (const el of document.querySelectorAll('[class]')) {",
  "    const tokens = [...el.classList].filter((name) => /lock/i.test(name) && !/block|clock|unlock/i.test(name));",
  "    if (!tokens.length) continue;",
  "    const small = el.clientWidth <= 48 && el.clientHeight <= 48;",
  "    const overlay = /icon|overlay|badge|indicator|padlock/i.test(tokens.join(' ')) || (small && tokens.some((name) => /lock(?:$|[-_])/i.test(name) && !/locked/i.test(name)));",
  "    if (el instanceof HTMLElement && (overlay || ['IMG', 'SVG', 'I'].includes(el.tagName))) {",
  "      el.style.display = 'none'; el.style.visibility = 'hidden'; removed += 1;",
  "    } else if (el instanceof HTMLElement) {",
  "      el.style.filter = 'none'; el.style.opacity = '1'; removed += 1;",
  "    }",
  "  }",
  "  return { removed };",
  "})();",
].join('\n')

// A guaranteed cosmetic result for a “mock account / unlock everything”
// request on any site. The free coder can take 40+ seconds or return no code
// at all; this keeps the page-level simulation instant, labeled and reversible.
const MOCK_ACCOUNT_SIMULATION = [
  "(() => {",
  "  const OLD = document.getElementById('ink-site-mock'); if (OLD) OLD.remove();",
  "  const style = document.createElement('style'); style.id = 'ink-site-mock-style';",
  "  style.textContent = '[class*=\"lock\" i], [class*=\"locked\" i], [aria-label*=\"lock\" i], [title*=\"lock\" i] { display: none !important; } [class*=\"blook\" i], [class*=\"card\" i] { filter: none !important; opacity: 1 !important; }'; ",
  "  document.head.appendChild(style);",
  "  const host = location.hostname.replace(/^www\\./i, '');",
  "  const site = (document.title.split(/[|–—:]/)[0] || host).trim().slice(0, 40);",
  "  const heading = site + ' Collection';",
  "  const username = 'mock_' + (host.split('.')[0] || 'student').replace(/[^a-z0-9]/g, '') + '_' + String(Math.floor(1000 + Math.random() * 9000));",
  "  const names = ['Starter','Bronze','Silver','Gold','Platinum','Diamond','Ruby','Emerald','Sapphire','Obsidian','Cosmic','Legendary','Mythic','Rare','Epic','Elite','Prime','Nova','Lunar','Solar','Frost','Ember','Ocean','Storm'];",
  "  const colors = names.map((_, i) => 'hsl(' + Math.round((i * 137.5) % 360) + ' 70% 55%)');",
  "  const wrap = document.createElement('div'); wrap.id = 'ink-site-mock';",
  "  wrap.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483646;background:#eef2ff;display:block;overflow:auto;padding:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;';",
  "  const card = document.createElement('div');",
  "  card.style.cssText = 'width:100%;min-height:100vh;overflow:auto;background:#f8fafc;color:#0f172a;border-radius:0;padding:24px 32px;box-shadow:none;';",
  "  card.innerHTML = '<div style=\"display:flex;justify-content:space-between;align-items:center;gap:12px\"><div><div style=\"font-size:11px;font-weight:800;letter-spacing:.14em;color:#64748b\">MOCK ACCOUNT</div><h2 style=\"margin:4px 0 0;font-size:28px\">' + heading + '</h2></div><span style=\"background:#dcfce7;color:#166534;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:800\">ALL UNLOCKED</span></div><p style=\"margin:12px 0 18px;color:#475569;font-size:14px\">A visual mock only. No real ' + host + ' account or data was changed.</p><div id=\"ink-site-grid\" style=\"display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px\"></div><button type=\"button\" style=\"margin-top:18px;border:0;border-radius:10px;background:#0f172a;color:white;padding:10px 14px;font-weight:700;cursor:pointer\">Exit mock</button>'; ",
  "  const nav = document.createElement('div');",
  "  nav.style.cssText = 'display:flex;align-items:center;gap:16px;padding:0 0 18px;margin-bottom:18px;border-bottom:1px solid #cbd5e1;';",
  "  nav.innerHTML = '<strong style=\"font-size:20px\">' + site + '</strong><span style=\"color:#475569\">Dashboard</span><span style=\"margin-left:auto;font-weight:700\">' + username + '</span>';",
  "  card.prepend(nav);",
  "  document.documentElement.style.overflow = 'hidden'; document.body.style.overflow = 'hidden';",
  "  const profile = document.createElement('div');",
  "  profile.style.cssText = 'display:flex;align-items:center;gap:10px;margin:14px 0 4px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;background:white;';",
  "  profile.innerHTML = '<div style=\"width:36px;height:36px;border-radius:999px;background:#0f172a;color:white;display:grid;place-items:center;font-weight:800\">MS</div><div><strong>' + username + '</strong><div style=\"font-size:11px;color:#64748b\">Mock account</div></div>';",
  "  card.querySelector('h2').insertAdjacentElement('afterend', profile);",
  "  const grid = card.querySelector('#ink-site-grid');",
  "  names.forEach((name, i) => { const tile = document.createElement('div'); tile.style.cssText = 'border:1px solid #e2e8f0;border-radius:14px;padding:10px;background:white;text-align:center;'; tile.innerHTML = '<div style=\"height:52px;border-radius:10px;background:' + colors[i] + ';display:grid;place-items:center;font-size:24px\">★</div><div style=\"margin-top:7px;font-size:12px;font-weight:700\">' + name + '</div><div style=\"font-size:10px;color:#16a34a;font-weight:700\">UNLOCKED</div>'; grid.appendChild(tile); });",
  "  wrap.appendChild(card); document.body.appendChild(wrap);",
  "  const keep = () => { if (!document.getElementById('ink-site-mock')) document.body.appendChild(wrap); for (const el of document.querySelectorAll('a,button')) { if (/^(log in|sign up)$/i.test((el.textContent || '').trim())) el.style.display = 'none'; } };",
  "  keep();",
  "  const observer = new MutationObserver(keep);",
  "  observer.observe(document.documentElement, { childList: true, subtree: true });",
  "  setTimeout(() => observer.disconnect(), 60000);",
  "  card.querySelector('button').addEventListener('click', () => { observer.disconnect(); document.documentElement.style.overflow = ''; document.body.style.overflow = ''; wrap.remove(); });",
  "  return { mockAccount: true, username, site: host, unlocked: names.length, panel: true };",
  "})();",
].join('\n')

export function Browser() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<BrowserStatus>('checking')
  const [session, setSession] = useState<BrowserSessionResponse | null>(null)
  const [addressValue, setAddressValue] = useState(() => searchParams.get('url') || DEFAULT_URL)
  // A local action response that is missing a URL must never blank the address
  // state; rendering that as undefined used to crash the whole page at
  // address.trim(). Keep the state a string at the boundary.
  const address = typeof addressValue === 'string' ? addressValue : ''
  const setAddress = (value: string | undefined | null) => setAddressValue(typeof value === 'string' ? value : '')
  const [task, setTask] = useState('')
  const [script, setScript] = useState('')
  const [view, setView] = useState<BrowserViewState | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [quotaProvider, setQuotaProvider] = useState<'browserbase' | 'hyperbrowser'>('browserbase')
  const [checkNonce, setCheckNonce] = useState(0)
  const [phase, setPhase] = useState('')
  const [stepNumber, setStepNumber] = useState(0)
  // A task that only reads information needs a durable answer, not just a
  // line that scrolls away inside the step-by-step activity feed.
  const [answer, setAnswer] = useState('')
  const [marker, setMarker] = useState<ActionMarker | null>(null)
  const [lastAction, setLastAction] = useState('')
  const [screen, setScreen] = useState<BrowserScreen | null>(null)
  const [screenError, setScreenError] = useState('')
  const [screenNonce, setScreenNonce] = useState(0)
  const [liveNonce, setLiveNonce] = useState(0)
  const [liveFrame, setLiveFrame] = useState<{ width: number; height: number } | null>(null)
  // Prefer the provider's live player when the session exposes one. The old
  // screenshot fallback refreshed every 1.2s, which made Chrome look like it
  // ran at 1 FPS. The snapshot stays underneath as a loading frame and the
  // header toggle can still switch back if a provider player fails.
  const [showLive, setShowLive] = useState(true)
  const [liveReady, setLiveReady] = useState(false)
  const [tabs, setTabs] = useState<BrowserTab[]>([])
  const [tabBusy, setTabBusy] = useState(false)
  const [clock, setClock] = useState(() => Date.now())
  const [devOpen, setDevOpen] = useState(false)
  const [selector, setSelector] = useState('body')
  const [inspection, setInspection] = useState<BrowserInspectResult | null>(null)
  const [codeMode, setCodeMode] = useState<'javascript' | 'css'>('javascript')
  const [code, setCode] = useState('')
  const [devBusy, setDevBusy] = useState(false)
  const [devError, setDevError] = useState('')
  const [askBuffyBusy, setAskBuffyBusy] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const agentMemory = useRef<{ task: string; plan: string[]; notes: string[] }>({
    task: '',
    plan: [],
    notes: [],
  })
  const clearAgentMemory = (options?: { keepScript?: boolean }) => {
    agentMemory.current = { task: '', plan: [] as string[], notes: [] as string[] }
    if (!options?.keepScript) setScript('')
    try {
      localStorage.removeItem(BROWSER_MEMORY_KEY)
    } catch {
      // Nothing to clear.
    }
  }
  // Restore the last unfinished task after a reload or a closed popup. The
  // saved record is removed as soon as a run finishes, so this only brings
  // back work that was interrupted.
  useEffect(() => {
    const saved = loadBrowserMemory()
    if (!saved) return
    agentMemory.current = { task: saved.task, plan: saved.plan, notes: saved.notes }
    setTask(saved.task)
    setScript(saved.script)
  }, [])
  const markerTimer = useRef<number | null>(null)
  const browserSectionRef = useRef<HTMLElement | null>(null)
  const liveStageRef = useRef<HTMLDivElement | null>(null)
  const logRef = useRef<HTMLDivElement | null>(null)
  const screenRef = useRef<HTMLImageElement | null>(null)
  const addressRef = useRef<HTMLInputElement | null>(null)
  const busyRef = useRef(false)
  const clickBusy = useRef(false)
  const typeBuffer = useRef('')
  const typeTimer = useRef<number | null>(null)
  const keyChain = useRef<Promise<void>>(Promise.resolve())
  const hiddenAt = useRef<number | null>(null)
  busyRef.current = busy
  const liveView = Boolean(session?.liveUrl) && showLive
  const liveSrc = session?.liveUrl ? interactiveLiveUrl(session.liveUrl) : null

  const append = (entry: Omit<LogEntry, 'at'>) => {
    setLog((items) => [...items.slice(-60), { ...entry, at: Date.now() }])
  }

  const flashMarker = (next: ActionMarker | null) => {
    if (markerTimer.current !== null) window.clearTimeout(markerTimer.current)
    setMarker(next)
    if (next) setLastAction(next.label)
    markerTimer.current = next ? window.setTimeout(() => setMarker(null), 5_000) : null
  }

  // The live-view iframe keeps its last frame after the remote browser ends.
  // Without this reset it becomes a black panel with a stale page title and a
  // misleading “Live” badge, so treat an ended session as an ended session.
  const endLiveSession = () => {
    setSession(null)
    setView(null)
    setStatus('idle')
    setError(SESSION_ENDED)
    setPhase('')
    setStepNumber(0)
    setAnswer('')
    setLastAction('')
    flashMarker(null)
  }

  const handleSessionLoss = (cause: unknown): boolean => {
    if (!isSessionLoss(cause)) return false
    endLiveSession()
    return true
  }

  useEffect(() => () => {
    if (markerTimer.current !== null) window.clearTimeout(markerTimer.current)
  }, [])

  useEffect(() => {
    // Start on the provider's live player when there is one. The old snapshot
    // default polled a fresh screenshot every 1.2s, which looked like 1 FPS.
    // The header toggle still switches to the snapshot if a player fails.
    setShowLive(true)
    setLiveReady(false)
    setTabs([])
  }, [session?.sessionId])

  // The live viewer still shows one surface, but the cloud browser can have
  // several real tabs. Keep a small strip in sync so a task can leave pages
  // open without the person losing access to them.
  useEffect(() => {
    if (!session) return
    let cancelled = false
    let checking = false
    const load = async (force = false) => {
      // The first read must run even when the panel is mounted in a background
      // tab, otherwise the strip stays empty until the person switches to it.
      if (checking || busyRef.current || (!force && document.visibilityState === 'hidden')) return
      checking = true
      try {
        const next = await api<{ tabs: BrowserTab[] }>('/browser/tabs')
        if (!cancelled) setTabs(next.tabs)
      } catch (cause) {
        if (!cancelled) handleSessionLoss(cause)
      } finally {
        checking = false
      }
    }
    void load(true)
    const timer = window.setInterval(() => void load(), 20_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionId])

  // A WebRTC stream often dies while Ink is in a background browser tab. When
  // the person comes back, remount the viewer instead of leaving a dead frame
  // that says the session ended even though the cloud browser is still alive.
  useEffect(() => {
    if (!session?.liveUrl) return
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
        return
      }
      const away = hiddenAt.current ? Date.now() - hiddenAt.current : 0
      hiddenAt.current = null
      if (away > 20_000 && showLive) {
        setLiveReady(false)
        setLiveNonce((value) => value + 1)
        setScreenNonce((value) => value + 1)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [session?.sessionId, session?.liveUrl, showLive])

  useEffect(() => {
    if (!liveView || liveReady) return
    // A blocked third-party frame can otherwise leave a blank pane forever.
    // Fall back to the same-origin screenshot after giving the viewer a beat.
    const timer = window.setTimeout(() => setShowLive(false), 8_000)
    return () => window.clearTimeout(timer)
  }, [liveView, liveReady, session?.liveUrl])

  // Steel fullscreen always streams a 16:9 screen. Center that screen inside
  // the available pane instead of letting the player add black bars around it.
  useEffect(() => {
    if (!liveView) return
    const element = liveStageRef.current
    if (!element) return
    const update = () => {
      const rect = element.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) return
      const width = Math.min(rect.width, (rect.height * 16) / 9)
      const height = (width * 9) / 16
      setLiveFrame((current) =>
        current && Math.abs(current.width - width) < 1 ? current : { width, height },
      )
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [liveView, session?.sessionId])

  useEffect(() => {
    if (!session?.expiresAt) return
    setClock(Date.now())
    const timer = window.setInterval(() => setClock(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [session?.expiresAt])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    let checking = false
    const check = async () => {
      if (checking || document.visibilityState === 'hidden') return
      checking = true
      try {
        const next = await api<BrowserSessionResponse>('/browser/session')
        if (!cancelled) {
          // A new live-view URL on every poll would reload the iframe and blink
          // the remote screen black. Keep the URL that is already mounted; only
          // refresh the keep-alive metadata for the same session.
          setSession((current) =>
            current && current.sessionId === next.sessionId
              ? {
                  ...current,
                  expiresAt: next.expiresAt ?? current.expiresAt,
                  ...(next.liveUrl ? { liveUrl: next.liveUrl } : {}),
                }
              : next,
          )
        }
      } catch (cause) {
        if (!cancelled) handleSessionLoss(cause)
      } finally {
        checking = false
      }
    }
    const timer = window.setInterval(() => void check(), SESSION_CHECK_MS)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // Re-check only when a different session starts; the periodic check updates
    // the live-view URL without restarting the interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionId])

  // The provider's live view is an external iframe and its URL can be blocked
  // by network filters. Pull frames from the remote Chrome through Ink
  // instead, so the visible surface stays same-origin.
  useEffect(() => {
    if (!session) {
      setScreen(null)
      setScreenError('')
      return
    }
    let cancelled = false
    const controller = new AbortController()
    let checking = false
    let stopped = false
    let timer: number | null = null
    const schedule = (delay: number) => {
      if (stopped) return
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(() => void tick(), delay)
    }
    const tick = async (force = false) => {
      if (stopped) return
      const editingLocally =
        document.activeElement instanceof HTMLElement &&
        Boolean(document.activeElement.closest('[data-browser-local-input]'))
      if (
        checking ||
        (!force &&
          (document.visibilityState === 'hidden' ||
            !document.hasFocus() ||
            (editingLocally && !busyRef.current)))
      ) {
        // The live iframe is the primary surface. Do not poll screenshots in
        // the background just to refresh metadata; each frame costs a Worker
        // request against the site's daily hosting allowance.
        if (!liveView) schedule(350)
        return
      }
      checking = true
      try {
        const next = await api<BrowserScreen>('/browser/screen', { signal: controller.signal })
        if (cancelled) return
        // Screen frames are large. A transition keeps the address bar and task
        // textarea responsive while the new image is decoded, and identical
        // frames do not cause a needless re-render.
        startTransition(() => {
          setScreen((current) =>
            current &&
            current.image === next.image &&
            current.url === next.url &&
            current.title === next.title &&
            current.viewport.width === next.viewport.width &&
            current.viewport.height === next.viewport.height
              ? current
              : next,
          )
          setView((current) => {
            if (!current) return current
            const url = next.url || current.url
            const title = next.title || current.title
            return url === current.url && title === current.title ? current : { ...current, url, title }
          })
        })
        setScreenError('')
        // Never overwrite a URL the person is still typing.
        if (next.url && document.activeElement !== addressRef.current) setAddress(next.url)
      } catch (cause) {
        if (cancelled) return
        if (isSessionLoss(cause)) {
          endLiveSession()
        } else {
          setScreenError(messageFor(cause))
        }
      } finally {
        checking = false
        // One warm frame is enough while the provider's live viewer owns the
        // screen. The snapshot path keeps polling, but at a sustainable pace
        // instead of several requests a second.
        if (!liveView) schedule(1_200)
      }
    }
    void tick(true)
    // The live viewer covers the visual stream. A warm frame gives the fallback
    // something to show, but it is captured once per action rather than polled.
    // Polling pauses while a local field is edited so typing always wins.
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !liveView) void tick()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stopped = true
      cancelled = true
      controller.abort()
      if (timer !== null) window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionId, screenNonce, liveView])

  useEffect(() => {
    const element = logRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [log, phase, busy])

  useEffect(() => {
    const previous = document.title
    document.title = 'Browser · Ink'
    let cancelled = false
    api<BrowserSessionResponse>('/browser/session')
      .then((next) => {
        if (cancelled) return
        setSession(next)
        setView(next.state)
        setAddress(next.state.url)
        setStatus('ready')
      })
      .catch((cause) => {
        if (cancelled) return
        if (cause instanceof ApiError && cause.status === 404) {
          setStatus('idle')
          return
        }
        if (cause instanceof ApiError && cause.status === 503) {
          if (cause.code === 'browser_quota') setQuotaProvider(cause.provider === 'hyperbrowser' ? 'hyperbrowser' : 'browserbase')
          setStatus(cause.code === 'browser_quota' ? 'quota' : 'unconfigured')
          setError(cause.code === 'browser_quota' ? '' : cause.message)
          return
        }
        setStatus('idle')
        setError(messageFor(cause))
      })
    return () => {
      cancelled = true
      document.title = previous
    }
  }, [checkNonce])

  const start = async (event?: FormEvent) => {
    event?.preventDefault()
    if (busy || (status === 'unconfigured' && !localBrowser.connected())) return
    const target = addressTarget(address)
    setBusy(true)
    setStatus('starting')
    setError('')
    setPhase('Starting browser')
    setStepNumber(0)
    setLastAction('')
    // Give the remote Chrome the same shape as the pane it will fill. The
    // player keeps a fixed aspect ratio, so a mismatched pane shows wide black
    // bands around what should look like an ordinary browser window.
    const viewport = viewportForPane(browserSectionRef.current)
    try {
      const launch = () =>
        api<BrowserSessionResponse>('/browser/session', {
          method: 'POST',
          json: { url: target, ...(viewport ? { viewport } : {}) },
        })
      let next: BrowserSessionResponse
      try {
        next = await launch()
      } catch (cause) {
        // The provider occasionally accepts a session and then fails to attach
        // its first page. One automatic retry turns that transient 502 into a
        // working browser instead of a red error the person has to clear.
        const transient =
          !session &&
          cause instanceof ApiError &&
          (cause.status === 502 ||
            cause.status === 504 ||
            cause.code === 'browser_timeout' ||
            cause.code === 'browser_service_error')
        if (!transient) throw cause
        setPhase('Browser did not attach — retrying…')
        await new Promise((resolve) => setTimeout(resolve, 1_200))
        next = await launch()
      }
      setSession(next)
      setView(next.state)
      setAddress(next.state.url)
      setStatus('ready')
      append({ role: 'action', text: `Started ${next.state.title || next.state.url}`, detail: next.state.url })
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 503) {
        if (cause.code === 'browser_quota') setQuotaProvider(cause.provider === 'hyperbrowser' ? 'hyperbrowser' : 'browserbase')
        setStatus(cause.code === 'browser_quota' ? 'quota' : 'unconfigured')
        setError(cause.code === 'browser_quota' ? '' : messageFor(cause))
      } else {
        setStatus(session ? 'ready' : 'idle')
        setError(messageFor(cause))
      }
    } finally {
      setBusy(false)
      setPhase('')
    }
  }

  const openWebsite = async (event?: FormEvent) => {
    event?.preventDefault()
    if (busy || status === 'unconfigured' || status === 'quota') return
    if (!session) {
      await start()
      return
    }
    const target = addressTarget(address)
    // A navigate only needs to start the page load. Reading a full DOM
    // snapshot here made every URL change wait for the page's slowest round
    // trip; the live frame reports the new title and URL a moment later.
    addressRef.current?.blur()
    setBusy(true)
    setError('')
    setPhase(`Opening ${target}`)
    try {
      await api<{ ok?: boolean }>('/browser/act', {
        method: 'POST',
        json: { action: { type: 'navigate', url: target }, read: false },
      })
      setAddress(target)
      setLastAction(`Open ${target}`)
      setLiveReady(false)
      setLiveNonce((value) => value + 1)
      setScreenNonce((value) => value + 1)
      window.setTimeout(() => void syncLocation(), 850)
      append({ role: 'action', text: `Open ${target}`, detail: target })
    } catch (cause) {
      if (!handleSessionLoss(cause)) setError(messageFor(cause))
    } finally {
      setBusy(false)
      setPhase('')
    }
  }

  const refresh = async () => {
    if (!session || busy) return
    setBusy(true)
    setError('')
    setPhase('Refreshing page')
    try {
      const next = await api<BrowserViewState>('/browser/state', { method: 'POST' })
      setView(next)
      setAddress(next.url)
      setScreenNonce((value) => value + 1)
    } catch (cause) {
      if (!handleSessionLoss(cause)) setError(messageFor(cause))
    } finally {
      setBusy(false)
      setPhase('')
    }
  }

  // Navigation actions return before a redirect or client-side route settles.
  // Read the location once after that beat so the address bar and title reflect
  // the page the browser actually landed on, without a full-screen refresh.
  const refreshTabs = async () => {
    try {
      const next = await api<{ tabs: BrowserTab[] }>('/browser/tabs')
      setTabs(next.tabs)
    } catch (cause) {
      handleSessionLoss(cause)
    }
  }

  const syncLocation = async () => {
    try {
      const next = await api<BrowserViewState>('/browser/state', { method: 'POST' })
      setView(next)
      setAddress(next.url)
      setScreenNonce((value) => value + 1)
      // Navigation can change the active tab's title and URL. Keep the strip
      // correct immediately instead of waiting for its next poll.
      void refreshTabs()
      return next
    } catch (cause) {
      handleSessionLoss(cause)
      return undefined
    }
  }

  const tabAction = async (action: 'new' | 'switch' | 'close', targetId?: string) => {
    if (!session || tabBusy || busy) return
    setTabBusy(true)
    setError('')
    try {
      const next = await api<{ state: BrowserViewState }>('/browser/tabs', {
        method: 'POST',
        json: { action, ...(targetId ? { targetId } : {}) },
      })
      setView(next.state)
      setAddress(next.state.url)
      setTabs((current) => {
        if (action === 'close') return current.filter((tab) => tab.id !== targetId)
        if (action === 'switch') return current.map((tab) => ({ ...tab, active: tab.id === targetId }))
        return current
      })
      setLastAction(action === 'new' ? 'New tab' : action === 'close' ? 'Closed tab' : 'Switched tab')
      setLiveReady(false)
      setLiveNonce((value) => value + 1)
      setScreenNonce((value) => value + 1)
      void refreshTabs()
    } catch (cause) {
      if (!handleSessionLoss(cause)) {
        setError(messageFor(cause))
        // The tab may have disappeared since the last poll. Re-read the strip
        // instead of leaving a phantom tab on screen.
        void refreshTabs()
      }
    } finally {
      setTabBusy(false)
    }
  }

  const control = async (action: BrowserAction, label: string) => {
    if (!session || busy) return
    setBusy(true)
    setError('')
    setPhase(label)
    try {
      await api('/browser/act', { method: 'POST', json: { action, read: false } })
      setLastAction(label)
      // A back/forward/reload may land on a new tab or a new document. Remount
      // the interactive viewer so it never keeps showing the previous page.
      setLiveReady(false)
      setLiveNonce((value) => value + 1)
      setScreenNonce((value) => value + 1)
      window.setTimeout(() => void syncLocation(), 850)
    } catch (cause) {
      // Back on the first page is a no-op in a normal browser, not an error.
      if (!(cause instanceof ApiError && cause.code === 'browser_history')) {
        if (!handleSessionLoss(cause)) setError(messageFor(cause))
      }
    } finally {
      setBusy(false)
      setPhase('')
    }
  }

  const [localBusy, setLocalBusy] = useState(false)

  const startLocal = async () => {
    if (busy || localBusy) return
    setLocalBusy(true)
    setError('')
    try {
      const connected = await localBrowser.connect()
      if (!connected) {
        // A bridge can be alive while rejecting this page's origin (for
        // example, an ngrok preview URL). Distinguish that from a stopped
        // bridge instead of telling the person to start something already up.
        const alive = await fetch('http://127.0.0.1:8765/health', { signal: AbortSignal.timeout(2_000) })
          .then((response) => response.ok)
          .catch(() => false)
        throw new Error(
          alive
            ? 'The local bridge is running, but this page’s address is not on its allowlist. Open Ink from its production address, or add this origin to scripts/local-bridge.mjs and restart it.'
            : 'The local bridge is not running. Restart npm run dev, or run node scripts/local-bridge.mjs.',
        )
      }
      await start()
    } catch (cause) {
      setStatus('idle')
      setError(cause instanceof Error ? cause.message : 'Local Chrome could not connect.')
    } finally {
      setLocalBusy(false)
    }
  }

  const end = async () => {
    if (!session || busy) return
    setBusy(true)
    setError('')
    setPhase('Closing session')
    setLastAction('')
    flashMarker(null)
    try {
      await api('/browser/session', { method: 'DELETE' })
      setSession(null)
      setView(null)
      setStatus('idle')
      setLog([])
    } catch (cause) {
      if (!handleSessionLoss(cause)) setError(messageFor(cause))
    } finally {
      setBusy(false)
      setPhase('')
      setStepNumber(0)
    }
  }

  const enqueueKey = (task: () => Promise<void>) => {
    keyChain.current = keyChain.current.then(task).catch(() => undefined)
  }

  const waitForClick = async () => {
    for (let attempt = 0; attempt < 25 && clickBusy.current; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 40))
    }
  }

  const flushTypedText = async () => {
    if (typeTimer.current !== null) {
      window.clearTimeout(typeTimer.current)
      typeTimer.current = null
    }
    await waitForClick()
    const text = typeBuffer.current
    if (!text) return
    typeBuffer.current = ''
    try {
      await api<{ ok?: boolean }>('/browser/act', {
        method: 'POST',
        json: { action: { type: 'type', text }, read: false },
      })
      // Show the typed text on the next frame instead of waiting for the
      // regular one-second tick.
      setScreenNonce((value) => value + 1)
    } catch (cause) {
      if (!handleSessionLoss(cause)) setError(messageFor(cause))
    }
  }

  const queueText = (text: string) => {
    typeBuffer.current += text
    if (typeTimer.current !== null) window.clearTimeout(typeTimer.current)
    // Small batches keep typing responsive without one request per character.
    typeTimer.current = window.setTimeout(() => {
      typeTimer.current = null
      enqueueKey(flushTypedText)
    }, 120)
  }

  const queuePress = (key: string, modifiers: ('Alt' | 'Ctrl' | 'Meta' | 'Shift')[] = []) => {
    if (typeTimer.current !== null) {
      window.clearTimeout(typeTimer.current)
      typeTimer.current = null
    }
    enqueueKey(async () => {
      await flushTypedText()
      try {
        await api<{ ok?: boolean }>('/browser/act', {
          method: 'POST',
          json: { action: { type: 'press', key, ...(modifiers.length ? { modifiers } : {}) }, read: false },
        })
        setScreenNonce((value) => value + 1)
      } catch (cause) {
        if (!handleSessionLoss(cause)) setError(messageFor(cause))
      }
    })
  }

  const typeOnScreen = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!session || busy) return
    const modifiers: ('Alt' | 'Ctrl' | 'Meta' | 'Shift')[] = []
    if (event.ctrlKey) modifiers.push('Ctrl')
    if (event.metaKey) modifiers.push('Meta')
    if (event.altKey) modifiers.push('Alt')
    if (event.shiftKey) modifiers.push('Shift')
    if (event.ctrlKey || event.metaKey) {
      const key = event.key.toLowerCase()
      // Let the local browser keep its own tabs/window shortcuts.
      if (['a', 'c', 'x', 'z', 'y'].includes(key)) {
        event.preventDefault()
        queuePress(event.key, modifiers)
      }
      return
    }
    if (event.altKey) return
    if (event.key.length === 1) {
      event.preventDefault()
      queueText(event.key)
      return
    }
    const named: Record<string, string> = {
      Enter: 'Enter',
      Backspace: 'Backspace',
      Tab: 'Tab',
      Escape: 'Escape',
      Delete: 'Delete',
      ArrowUp: 'ArrowUp',
      ArrowDown: 'ArrowDown',
      ArrowLeft: 'ArrowLeft',
      ArrowRight: 'ArrowRight',
      Home: 'Home',
      End: 'End',
      PageUp: 'PageUp',
      PageDown: 'PageDown',
    }
    const key = named[event.key]
    if (!key) return
    event.preventDefault()
    queuePress(key, event.shiftKey ? ['Shift'] : [])
  }

  const pasteOnScreen = (event: React.ClipboardEvent<HTMLElement>) => {
    const text = event.clipboardData.getData('text')
    if (!text || !session || busy) return
    event.preventDefault()
    queueText(text)
  }

  const scrollScreen = async (event: React.WheelEvent<HTMLElement>) => {
    if (!session || busy) return
    event.preventDefault()
    try {
      await api('/browser/act', {
        method: 'POST',
        json: { action: { type: 'scroll', x: event.deltaX, y: event.deltaY }, read: false },
      })
      setScreenNonce((value) => value + 1)
    } catch (cause) {
      if (!handleSessionLoss(cause)) setError(messageFor(cause))
    }
  }

  const clickScreen = async (event: React.MouseEvent<HTMLElement>) => {
    if (!session || busy || clickBusy.current || !screen) return
    event.currentTarget.focus()
    const image = screenRef.current
    if (!image) return
    const rect = image.getBoundingClientRect()
    const vw = Math.max(1, screen.viewport.width)
    const vh = Math.max(1, screen.viewport.height)
    const scale = Math.min(rect.width / vw, rect.height / vh)
    const x = Math.round((event.clientX - rect.left - (rect.width - vw * scale) / 2) / scale)
    const y = Math.round((event.clientY - rect.top - (rect.height - vh * scale) / 2) / scale)
    if (x < 0 || y < 0 || x > vw || y > vh) return
    clickBusy.current = true
    setError('')
    try {
      // Dispatch only. The live frame is the expensive read; let the next
      // screen frame report the new URL and title instead of blocking on it.
      await api<{ ok?: boolean }>('/browser/act', {
        method: 'POST',
        json: { action: { type: 'click', x, y }, read: false },
      })
      setScreenNonce((value) => value + 1)
      // Navigation or a menu can take a beat to paint. One extra frame shortly
      // after the click hides that gap without waiting for the next interval.
      window.setTimeout(() => setScreenNonce((value) => value + 1), 300)
    } catch (cause) {
      if (!handleSessionLoss(cause)) setError(messageFor(cause))
    } finally {
      clickBusy.current = false
    }
  }

  const inspectElement = async () => {
    if (!session || busy || devBusy) return
    setDevBusy(true)
    setDevError('')
    try {
      const result = await api<BrowserInspectResponse>('/browser/inspect', {
        method: 'POST',
        json: { ...(selector.trim() ? { selector: selector.trim() } : {}) },
      })
      setInspection(result.inspect)
      setView(result.state)
      setAddress(result.state.url)
      setLastAction(`Inspected ${result.inspect.tag}`)
      append({
        role: 'action',
        text: `Inspected ${result.inspect.selector}`,
        detail: `${result.inspect.matched} match${result.inspect.matched === 1 ? '' : 'es'} · ${result.inspect.tag}`,
      })
    } catch (cause) {
      if (!handleSessionLoss(cause)) setDevError(messageFor(cause))
    } finally {
      setDevBusy(false)
    }
  }

  // Hand the readable page to Buffy Chat instead of making the person copy it.
  // The context is one-shot: Chat removes it from sessionStorage after opening.
  const askBuffyAboutPage = async () => {
    if (!session || askBuffyBusy) return
    setAskBuffyBusy(true)
    setError('')
    try {
      const result = await api<BrowserInspectResponse>('/browser/inspect', {
        method: 'POST',
        json: { selector: 'body' },
      })
      const text = (result.inspect.text || result.state.snapshot.text || '').replace(/\u0000/g, '').trim()
      if (!text) throw new Error('This page has no readable text to send.')
      sessionStorage.setItem(
        'buffy:chat:page-context:v1',
        JSON.stringify({
          url: result.state.url || address,
          title: result.state.title || view?.title || '',
          text: text.slice(0, 12_000),
        }),
      )
      navigate('/buffy?page=1')
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setAskBuffyBusy(false)
    }
  }

  const runCode = async () => {
    const source = code.trim()
    if (!source || !session || busy || devBusy) return
    setDevBusy(true)
    setDevError('')
    try {
      const next = await api<BrowserViewState>('/browser/act', {
        method: 'POST',
        json: {
          action:
            codeMode === 'css'
              ? { type: 'style', css: source }
              : { type: 'evaluate', expression: source },
        },
      })
      setView(next)
      setAddress(next.url)
      setLastAction(codeMode === 'css' ? 'Applied CSS' : 'Ran JavaScript')
      append({
        role: 'action',
        text: codeMode === 'css' ? 'Applied custom CSS' : 'Ran custom JavaScript',
        detail: next.title || next.url,
      })
    } catch (cause) {
      if (!handleSessionLoss(cause)) setDevError(messageFor(cause))
    } finally {
      setDevBusy(false)
    }
  }

  const run = async () => {
    const instruction = task.trim()
    if (!instruction || !session || busy) return
    setBusy(true)
    setError('')
    setPhase('Reading the page…')
    setStepNumber(0)
    setAnswer('')
    append({ role: 'you', text: instruction })
    const controller = new AbortController()
    abort.current = controller
    const history: BrowserHistoryEntry[] = log
      .filter((item) => item.role === 'action')
      .slice(-10)
      .map((item) => ({ action: item.text, result: item.detail || '' }))
    // A compound task can navigate before planning. Keep that exact state so
    // the planner does not start from the stale pre-navigation snapshot.
    let leadState: BrowserViewState | null = null
    let lookupFailed = false
    // The agent keeps its own plan and working notes between steps. These are
    // not scripted task rules; they are the model's durable context so it can
    // change course without forgetting what it already learned.
    // Only carry the scratchpad forward for the same task. A new instruction
    // starts with a clean program instead of running old code by accident.
    const resumingTask = agentMemory.current.task === instruction
    if (!resumingTask) agentMemory.current = { task: instruction, plan: [], notes: [] }
    let agentPlan: string[] = [...agentMemory.current.plan]
    let agentNotes: string[] = [...agentMemory.current.notes]
    let agentScript = resumingTask ? script : ''
    // A new task must not show or reuse the previous task's program.
    if (!resumingTask) setScript('')
    saveBrowserMemory({ task: instruction, plan: agentPlan, notes: agentNotes, script: agentScript })
    const blockedActions = new Set<string>()
    let blockedRepeats = 0
    let emptyPlans = 0
    let clarifyAsks = 0
    let completionAudits = 0
    let stuckRecoveries = 0
    let reflections = 0
    // Blocked actions belong to the page they failed on. After a navigation, or
    // after a popup closes and the target returns to the main tab, those ids
    // are stale. Keeping them made the agent refuse to click a button it had
    // never actually tried on this page, then give up.
    let blockedPageKey = ''
    const syncPageBlocks = (state: BrowserViewState) => {
      const key = `${state.url}|${state.title}`
      if (blockedPageKey && blockedPageKey !== key) {
        blockedActions.clear()
        stalledActions.clear()
        failedActions.clear()
        blockedRepeats = 0
        emptyPlans = 0
      }
      blockedPageKey = key
    }
    // A quick sheet fill can be followed by one chart-planning pass. Keep the
    // task here so the destination opener does not send us back to A1.
    let sheetChartTask: string | null = null

    // “Search Google for X and tell me the answer” is a search plus one page
    // read. Do both directly instead of paying two planner calls.
    const answerSearch = directSearchAnswer(instruction) ?? directQuestionAnswer(instruction)
    if (answerSearch) {
      const startedAt = Date.now()
      const label = `Searching Google for “${answerSearch.query}”`
      setPhase(label)
      try {
        const results = await api<BrowserViewState>('/browser/act', {
          method: 'POST',
          signal: controller.signal,
          json: { action: { type: 'navigate', url: answerSearch.url }, read: true },
        })
        leadState = results
        setView(results)
        setAddress(results.url)
        setScreenNonce((value) => value + 1)
        setLastAction(label)
        append({ role: 'action', text: label, detail: `Direct search · ${formatDuration(Date.now() - startedAt)} · ${results.url}` })
        if ((results.snapshot.text ?? '').trim().length >= 160) {
          setPhase('Reading the results…')
          const result = await api<{ answer?: string }>('/browser/answer', {
            method: 'POST',
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5_000)]),
            json: {
              task: instruction,
              snapshot: { ...results.snapshot, text: results.snapshot.text.slice(0, 3_000) },
            },
          })
          const answer = usablePageAnswer(result.answer || '')
          if (answer) {
            append({ role: 'stet', text: answer })
            setAnswer(answer)
            clearAgentMemory()
            abort.current = null
            setBusy(false)
            setPhase('')
            setStepNumber(0)
            flashMarker(null)
            return
          }
        }
      } catch (cause) {
        if (controller.signal.aborted) throw cause
        if (isSessionLoss(cause)) throw cause
        append({ role: 'stet', text: `The direct search did not answer (${messageFor(cause)}); continuing with the browser agent.` })
      }
    }

    // A web search plus “open the first result and read the title” is fully
    // deterministic. Skip the planner: navigation, one result click and one
    // state read finish in seconds and cannot drift onto the wrong element.
    const fastSearch = directSearchOpen(instruction)
    if (fastSearch) {
      const startedAt = Date.now()
      setPhase(`Searching for “${fastSearch.query}”`)
      try {
        await api<{ ok?: boolean }>('/browser/act', {
          method: 'POST',
          signal: controller.signal,
          json: { action: { type: 'navigate', url: fastSearch.url }, read: false },
        })
        let next = await api<BrowserViewState>('/browser/state', { method: 'POST', signal: controller.signal })
        setView(next)
        setAddress(next.url)
        setScreenNonce((value) => value + 1)
        append({
          role: 'action',
          text: `Searched the web for “${fastSearch.query}”`,
          detail: `Direct search · ${formatDuration(Date.now() - startedAt)} · ${next.url}`,
        })
        let result = firstSearchResult(next.snapshot.elements, fastSearch.query)
        // Google paints the shell before the organic results. Poll briefly so
        // the direct path does not give up while the result list is still
        // rendering and hand a 0.7s search to a 3s planner.
        const resultDeadline = Date.now() + 3_000
        while (!result && Date.now() < resultDeadline) {
          await new Promise((resolve) => setTimeout(resolve, 180))
          next = await api<BrowserViewState>('/browser/state', { method: 'POST', signal: controller.signal })
          setView(next)
          setAddress(next.url)
          result = firstSearchResult(next.snapshot.elements, fastSearch.query)
        }
        if (result) {
          const clickAt = Date.now()
          const opened = await api<BrowserViewState>('/browser/act', {
            method: 'POST',
            signal: controller.signal,
            json: { action: { type: 'click', selector: `[data-stet-id="${result.id}"]` }, read: true },
          })
          setView(opened)
          setAddress(opened.url)
          setScreenNonce((value) => value + 1)
          const title = (opened.title || '').trim()
          if (title) {
            append({
              role: 'action',
              text: `Opened ${result.label.slice(0, 90)}`,
              detail: `First result · ${formatDuration(Date.now() - clickAt)} · ${opened.url}`,
            })
            const answer = fastSearch.answerTitle ? `The page title is: ${title}` : `Opened ${title}`
            append({ role: 'stet', text: answer })
            setAnswer(answer)
            setLastAction(`Opened ${result.label.slice(0, 60)}`)
            setBusy(false)
            setPhase('')
            setStepNumber(0)
            abort.current = null
            flashMarker(null)
            return
          }
        }
        append({ role: 'stet', text: 'The search results are open, but the first result could not be opened directly; continuing.' })
      } catch (cause) {
        if (controller.signal.aborted) {
          append({ role: 'error', text: 'Stopped.' })
          abort.current = null
          setBusy(false)
          setPhase('')
          return
        }
        if (handleSessionLoss(cause)) {
          append({ role: 'error', text: SESSION_ENDED })
          abort.current = null
          setBusy(false)
          setPhase('')
          return
        }
        append({ role: 'stet', text: `The direct search did not work (${messageFor(cause)}); continuing with the browser agent.` })
      }
    }

    // Writing a document is one generation and one deterministic insert, not a
    // planner call per click. This is the fast path behind “write an essay”.
    // A spreadsheet fill is the same shape: one small generation call and one
    // native keyboard run, never a planner call per cell.
    if (isSpreadsheetDataTask(instruction, view?.url)) {
      let sheetFallback = false
      setPhase('Writing the table…')
      try {
        const startedAt = Date.now()
        const next = await api<BrowserSheetResponse>('/browser/sheet', {
          method: 'POST',
          signal: controller.signal,
          json: { task: instruction },
        })
        setView(next.state)
        setAddress(next.state.url)
        setScreenNonce((value) => value + 1)
        // A Sheet can open from a new tab or carry a stale tab-strip title.
        void refreshTabs()
        setLastAction(`Filled ${next.rows} rows`)
        append({
          role: 'stet',
          text: `Filled the sheet with ${next.rows} rows and ${next.columns} columns.`,
          thoughts: [
            'This is a table request, so I skipped the step-by-step planner.',
            next.lane === 'Local sales table'
              ? 'I built the sales table locally, then filled it into A1 one cell at a time.'
              : 'I generated the table in one model call, then filled it into A1 one cell at a time.',
            `Saved in ${next.state.title || 'the spreadsheet'}.`,
          ],
        })
        append({
          role: 'action',
          text: `Filled ${next.rows} rows × ${next.columns} columns`,
          detail: `Quick sheet · ${formatDuration(Date.now() - startedAt)}${next.lane ? ` · ${next.lane}` : ''} · ${next.state.url}`,
        })
        if (isSpreadsheetChartTask(instruction)) {
          const range = `A1:${sheetColumnName(next.columns)}${next.rows}`
          if (next.chart) {
            append({ role: 'action', text: 'Created the chart', detail: `Direct chart · ${range} · ${next.state.url}` })
            setLastAction('Created the chart')
          } else {
            sheetChartTask = `Create a chart from the data in ${range}. The sheet is already filled; do not retype any data. Select ${range} and use Insert > Chart.`
            leadState = next.state
            agentNotes = [
              ...agentNotes,
              `The sheet is already filled through ${range}; create the chart without retyping data.`,
            ].slice(-8)
            agentMemory.current.notes = agentNotes
            append({ role: 'stet', text: 'The table is filled. Creating the chart now.' })
          }
        }
      } catch (cause) {
        if (controller.signal.aborted) {
          append({ role: 'error', text: 'Stopped.' })
        } else if (handleSessionLoss(cause)) {
          append({ role: 'error', text: SESSION_ENDED })
        } else {
          const message = messageFor(cause)
          // The sheet path may have navigated to Google's sign-in page before
          // it stopped. Refresh the live frame so the person can actually sign
          // in there instead of looking at the previous page.
          setScreenNonce((value) => value + 1)
          if (cause instanceof ApiError && cause.code === 'browser_signin') {
            setLastAction('Google sign-in required')
            setError('')
            append({
              role: 'stet',
              text: `Google is asking you to sign in. Sign in in the ${session?.sessionId === 'local' ? 'local Chrome window' : 'live view'}, then press Run — the task and spreadsheet are still here.`,
            })
            return
          }
          // A dedicated shortcut is an optimization, not a dead end. Keep the
          // session, clear the error and let the general agent try the same
          // task from the page it actually reached.
          setError('')
          append({ role: 'stet', text: `The direct sheet path could not finish (${message}). Continuing with the general browser agent.` })
          sheetFallback = true
          lookupFailed = true
          leadState = null
        }
      } finally {
        if (!sheetFallback && !sheetChartTask) {
          abort.current = null
          setBusy(false)
          setPhase('')
          setStepNumber(0)
          flashMarker(null)
        }
      }
      if (!sheetFallback && !sheetChartTask) return
      setPhase(sheetChartTask ? 'Creating the chart…' : 'Trying the general browser agent…')
    }

    if (isDocumentWritingTask(instruction, view?.url)) {
      let documentFallback = false
      setPhase('Writing the document in Google Docs…')
      try {
        const startedAt = Date.now()
        const next = await api<BrowserWriteResponse>('/browser/write', {
          method: 'POST',
          signal: controller.signal,
          json: { task: instruction },
        })
        setView(next.state)
        setAddress(next.state.url)
        // The local document path brings Chrome to the front, which blurs the
        // Ink tab. Force one fresh frame here; the normal focus-gated poller
        // would otherwise leave the previous page in the live screen.
        setScreenNonce((value) => value + 1)
        // Docs creates a new page target, so the tab strip title is stale until
        // it is re-read from the newly followed tab.
        void refreshTabs()
        setLastAction(`Wrote ${next.words} words`)
        append({
          role: 'stet',
          text: `I wrote it in Google Docs — ${next.words} words.`,
          thoughts: [
            'This is a document request, so I skipped the step-by-step planner.',
            'I generated the document in one model call, then typed it into the editor.',
            `Saved in ${next.state.title || 'the document'}.`,
          ],
        })
        append({
          role: 'action',
          text: `Wrote ${next.words} words`,
          detail: `Quick write · ${formatDuration(Date.now() - startedAt)} · ${next.state.url}`,
        })
      } catch (cause) {
        if (controller.signal.aborted) {
          append({ role: 'error', text: 'Stopped.' })
        } else if (handleSessionLoss(cause)) {
          append({ role: 'error', text: SESSION_ENDED })
        } else {
          const message = messageFor(cause)
          if (cause instanceof ApiError && cause.code === 'browser_signin') {
            setScreenNonce((value) => value + 1)
            setLastAction('Google sign-in required')
            setError('')
            append({
              role: 'stet',
              text: `Google is asking you to sign in. Sign in in the ${session?.sessionId === 'local' ? 'local Chrome window' : 'live view'}, then press Run — the task and document are still here.`,
            })
            return
          }
          // The document writer is a shortcut too. If Docs is unavailable or
          // the page changes under it, hand the task to the general agent with
          // the current page state instead of stopping the run.
          setError('')
          append({ role: 'stet', text: `The direct document path could not finish (${message}). Continuing with the general browser agent.` })
          documentFallback = true
          lookupFailed = true
          leadState = null
        }
      } finally {
        if (!documentFallback) {
          abort.current = null
          setBusy(false)
          setPhase('')
          setStepNumber(0)
          flashMarker(null)
        }
      }
      if (!documentFallback) return
      setPhase('Trying the general browser agent…')
    }

    // “Search for X” on a site that already has a search box should search
    // that site, not leave for a web search. A direct open intentionally skips
    // a full page read, so if the URL and snapshot disagree, read the new page
    // once before deciding whether it has a search box.
    let searchState = view
    if (searchState && /^(?:search|look\s+up|google)\b/i.test(instruction) && searchState.snapshot.url !== searchState.url) {
      try {
        searchState = await api<BrowserViewState>('/browser/state', {
          method: 'POST',
          signal: controller.signal,
        })
        setView(searchState)
        setAddress(searchState.url)
      } catch (cause) {
        if (controller.signal.aborted) throw cause
      }
    }
    const pageSearch = directPageSearch(instruction, searchState?.snapshot.elements ?? [])
    if (pageSearch?.type === 'type') {
      const label = `Searching for “${pageSearch.text}”`
      setPhase(label)
      try {
        const startedAt = Date.now()
        await api<{ ok?: boolean }>('/browser/act', {
          method: 'POST',
          signal: controller.signal,
          json: { action: pageSearch, read: false },
        })
        setScreenNonce((value) => value + 1)
        setLastAction(label)
        append({
          role: 'stet',
          text: `Searching this site for “${pageSearch.text}”.`,
          thoughts: ['The page already exposes a search box.', 'I typed the query and submitted it with native input; no planner call was needed.'],
        })
        append({ role: 'action', text: label, detail: `Direct page search · ${formatDuration(Date.now() - startedAt)}` })
        window.setTimeout(() => void syncLocation(), 450)
        abort.current = null
        setBusy(false)
        setPhase('')
        setStepNumber(0)
        flashMarker(null)
        return
      } catch (cause) {
        if (controller.signal.aborted) {
          append({ role: 'error', text: 'Stopped.' })
          abort.current = null
          setBusy(false)
          setPhase('')
          return
        }
        if (handleSessionLoss(cause)) {
          append({ role: 'error', text: SESSION_ENDED })
          abort.current = null
          setBusy(false)
          setPhase('')
          return
        }
        append({ role: 'stet', text: `The site search did not work (${messageFor(cause)}); trying a web search.` })
      }
    }

    // “Search Wikipedia for Ada Lovelace and tell me when she was born” is an
    // article lookup, not a search-results scan. Open the article directly and
    // read it; this avoids the result page, a result click and three planner
    // calls for a question the article already answers.
    const siteSearch = directSiteSearch(instruction)
    // Search engines can take the query in the URL. Skip the box, the submit
    // and the extra page read, then answer from the results that load.
    if (siteSearch?.searchUrl) {
      try {
        const label = `Searching ${siteSearch.site} for “${siteSearch.query}”`
        setPhase(label)
        const startedAt = Date.now()
        const resultsState = await api<BrowserViewState>('/browser/act', {
          method: 'POST',
          signal: controller.signal,
          json: { action: { type: 'navigate', url: siteSearch.searchUrl }, read: true },
        })
        setView(resultsState)
        setAddress(resultsState.url)
        leadState = resultsState
        setScreenNonce((value) => value + 1)
        setLastAction(label)
        append({ role: 'action', text: label, detail: `Direct search · ${formatDuration(Date.now() - startedAt)} · ${siteSearch.searchUrl}` })
        // “Tell me the first result title” is already on the results page.
        if (
          siteSearch.followUp &&
          /\b(?:first|top)\s+(?:result|video|link|item)\b[\s\S]*\b(?:title|name|headline)\b|\b(?:title|name|headline)\b[\s\S]*\b(?:first|top)\s+(?:result|video|link|item)\b/i.test(
            siteSearch.followUp,
          )
        ) {
          const findTitleLink = (elements: BrowserElement[]) =>
            elements.find(
              (element) =>
                /\/watch\?/.test(element.href || '') &&
                !element.offscreen &&
                element.label.trim().length >= 12 &&
                // Duration-only anchors read “1:00:17 Now playing” and pass a
                // plain length filter. They are not the video title.
                !/^[\d:]+\s+(?:now playing|watch)\b/i.test(element.label.trim()) &&
                element.rect.width > 0 &&
                element.rect.height > 0,
            ) ??
            firstSearchResult(elements, siteSearch.query) ??
            firstContentLink(elements)
          let titleState = resultsState
          let link = findTitleLink(titleState.snapshot.elements)
          const titleDeadline = Date.now() + 3_500
          while (!link?.label && Date.now() < titleDeadline) {
            await new Promise((resolve) => window.setTimeout(resolve, 250))
            try {
              titleState = await api<BrowserViewState>('/browser/state', { method: 'POST', signal: controller.signal })
              setView(titleState)
              setAddress(titleState.url)
              link = findTitleLink(titleState.snapshot.elements)
            } catch (cause) {
              if (controller.signal.aborted) throw cause
              if (isSessionLoss(cause)) throw cause
              break
            }
          }
          if (link?.label) {
            const displayTitle = /youtube/i.test(siteSearch.site) ? cleanVideoLabel(link.label) : link.label.trim()
            const answer = `The first result is: ${displayTitle}`
            append({ role: 'stet', text: answer })
            setAnswer(answer)
            clearAgentMemory()
            abort.current = null
            setBusy(false)
            setPhase('')
            setStepNumber(0)
            flashMarker(null)
            return
          }
        }
        if (siteSearch.followUp && /\b(?:open|click|tap)\s+(?:the\s+)?(?:first|top)\s+(?:result|video|link|item)\b/i.test(siteSearch.followUp)) {
          setPhase('Opening the first result…')
          let landed = resultsState
          const deadline = Date.now() + 5_000
          while (Date.now() < deadline) {
            const video = landed.snapshot.elements.find((element) => {
              const href = element.href || ''
              return (
                /\/watch\?/.test(href) &&
                !element.offscreen &&
                element.rect.width > 0 &&
                element.rect.height > 0 &&
                // Sponsored cards use a short “Watch” link before the first
                // organic video title. Real result titles are longer.
                element.label.trim().length >= 12
              )
            })
            const link = video ?? firstContentLink(landed.snapshot.elements)
            if (link) {
              try {
                const before = Date.now()
                // A result click does not need to wait for the destination's
                // full load. The frame follows the navigation; returning here
                // removes the 1–2s page-load wait from every YouTube run.
                await api('/browser/act', {
                  method: 'POST',
                  signal: controller.signal,
                  json: { action: { type: 'click', selector: `[data-stet-id="${link.id}"]` }, read: false },
                })
                setAddress(link.href || resultsState.url)
                setScreenNonce((value) => value + 1)
                // YouTube exposes the same video through a short duration link
                // and a longer title link. Report the title, not “1:05:19 Now
                // playing”, while still clicking whichever link resolved first.
                const titleLabel = landed.snapshot.elements
                  .filter((item) => item.href === link.href && item.rect.width > 0 && item.rect.height > 0)
                  .map((item) => (/youtube/i.test(siteSearch.site) ? cleanVideoLabel(item.label) : item.label.trim()))
                  .sort((a, b) => b.length - a.length)[0]
                const answer = `Opened the first result: ${(titleLabel || link.label || link.href || resultsState.url).trim()}`
                append({ role: 'action', text: `Opened ${(titleLabel || link.label).slice(0, 80)}`, detail: `First result · ${formatDuration(Date.now() - before)} · ${link.href || resultsState.url}` })
                append({ role: 'stet', text: answer })
                setAnswer(answer)
                clearAgentMemory()
                abort.current = null
                setBusy(false)
                setPhase('')
                setStepNumber(0)
                flashMarker(null)
                return
              } catch (cause) {
                if (controller.signal.aborted) throw cause
                if (isSessionLoss(cause)) throw cause
              }
            }
            await new Promise((resolve) => window.setTimeout(resolve, 300))
            landed = await api<BrowserViewState>('/browser/state', { method: 'POST', signal: controller.signal })
            setView(landed)
            setAddress(landed.url)
          }
        }
        if (siteSearch.followUp && asksForPageAnswer(siteSearch.followUp) && (resultsState.snapshot.text ?? '').trim().length >= 160) {
          setPhase('Reading the page…')
          const result = await api<{ answer?: string }>('/browser/answer', {
            method: 'POST',
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5_000)]),
            json: {
              task: `${siteSearch.query} — ${siteSearch.followUp}`,
              snapshot: { ...resultsState.snapshot, text: resultsState.snapshot.text.slice(0, 3_000) },
            },
          })
          const answer = usablePageAnswer(result.answer || '')
          if (answer) {
            append({ role: 'stet', text: answer })
            setAnswer(answer)
            clearAgentMemory()
            abort.current = null
            setBusy(false)
            setPhase('')
            setStepNumber(0)
            flashMarker(null)
            return
          }
        } else if (!siteSearch.followUp) {
          abort.current = null
          setBusy(false)
          setPhase('')
          setStepNumber(0)
          flashMarker(null)
          return
        }
      } catch (cause) {
        if (controller.signal.aborted) throw cause
        if (isSessionLoss(cause)) throw cause
        // Fall through to the normal site search/planner with the page open.
      }
    }
    const wikiArticleUrl =
      siteSearch?.followUp && /wikipedia/i.test(siteSearch.site)
        ? `https://en.wikipedia.org/wiki/${encodeURIComponent(siteSearch.query.replace(/\s+/g, '_'))}`
        : ''
    if (siteSearch && wikiArticleUrl) {
      let articleState = view
      try {
        const label = `Reading Wikipedia for “${siteSearch.query}”`
        setPhase(label)
        if (!isSameBrowserSite(view?.url, wikiArticleUrl)) {
          const startedAt = Date.now()
          articleState = await api<BrowserViewState>('/browser/act', {
            method: 'POST',
            signal: controller.signal,
            json: { action: { type: 'navigate', url: wikiArticleUrl }, read: true },
          })
          setView(articleState)
          setAddress(articleState.url)
          leadState = articleState
          setScreenNonce((value) => value + 1)
          append({ role: 'action', text: `Opened ${label}`, detail: `Direct article · ${formatDuration(Date.now() - startedAt)} · ${wikiArticleUrl}` })
        }
        if (articleState && (articleState.snapshot.text ?? '').trim().length >= 160) {
          // Birth years are visible in the article's first paragraph/infobox.
          // Extract them locally instead of paying a 15-second model round trip.
          const visibleFact = answerVisibleFact(instruction, articleState.snapshot.text || '')
          if (visibleFact) {
            append({ role: 'stet', text: visibleFact })
            setAnswer(visibleFact)
            setLastAction(`Found ${visibleFact}`)
            clearAgentMemory()
            abort.current = null
            setBusy(false)
            setPhase('')
            setStepNumber(0)
            flashMarker(null)
            return
          }
          setPhase('Reading the article…')
          const result = await api<{ answer?: string }>('/browser/answer', {
            method: 'POST',
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5_000)]),
            json: {
              // Keep the subject in the question; “what year was she born”
              // loses the person's name on a page full of dates.
              task: `${siteSearch.query} — ${siteSearch.followUp}`,
              snapshot: { ...articleState.snapshot, text: articleState.snapshot.text.slice(0, 3_000) },
            },
          })
          const answer = usablePageAnswer(result.answer || '')
          if (answer) {
            append({ role: 'stet', text: answer })
            setAnswer(answer)
            clearAgentMemory()
            abort.current = null
            setBusy(false)
            setPhase('')
            setStepNumber(0)
            flashMarker(null)
            return
          }
        }
      } catch (cause) {
        if (controller.signal.aborted) throw cause
        if (isSessionLoss(cause)) throw cause
        // Fall through to the normal site path/planner with the article open.
      }
    }
    if (siteSearch) {
      let searchState = view
      let searchSubmitted = false
      try {
        if (!isSameBrowserSite(view?.url, siteSearch.url)) {
          const label = `Opening ${siteSearch.site}`
          setPhase(label)
          const startedAt = Date.now()
          searchState = await api<BrowserViewState>('/browser/act', {
            method: 'POST',
            signal: controller.signal,
            json: { action: { type: 'navigate', url: siteSearch.url }, read: true },
          })
          setView(searchState)
          setAddress(searchState.url)
          setScreenNonce((value) => value + 1)
          setLastAction(label)
          append({ role: 'action', text: label, detail: `Direct open · ${formatDuration(Date.now() - startedAt)} · ${siteSearch.url}` })
        } else if (searchState && searchState.snapshot.url !== searchState.url) {
          searchState = await api<BrowserViewState>('/browser/state', { method: 'POST', signal: controller.signal })
          setView(searchState)
          setAddress(searchState.url)
        }
        let searchAction = directPageSearch(`search for ${siteSearch.query}`, searchState?.snapshot.elements ?? [])
        if (!searchAction) {
          // Heavy sites such as YouTube hydrate their header after the first
          // read. One short refresh avoids leaving for a web search.
          await new Promise((resolve) => window.setTimeout(resolve, 450))
          try {
            searchState = await api<BrowserViewState>('/browser/state', { method: 'POST', signal: controller.signal })
            setView(searchState)
            setAddress(searchState.url)
            searchAction = directPageSearch(`search for ${siteSearch.query}`, searchState?.snapshot.elements ?? [])
          } catch (cause) {
            if (controller.signal.aborted) throw cause
            if (isSessionLoss(cause)) throw cause
          }
        }
        if (searchAction?.type === 'type') {
          const label = `Searching ${siteSearch.site} for “${siteSearch.query}”`
          setPhase(label)
          const startedAt = Date.now()
          await api<{ ok?: boolean }>('/browser/act', {
            method: 'POST',
            signal: controller.signal,
            json: { action: searchAction, read: false },
          })
          setScreenNonce((value) => value + 1)
          setLastAction(label)
          append({ role: 'stet', text: `${label}.`, thoughts: ['The site has its own search box.', 'I typed the query and submitted it with native input; no planner call was needed.'] })
          append({ role: 'action', text: label, detail: `Direct site search · ${formatDuration(Date.now() - startedAt)}` })
          searchSubmitted = true
          if (!siteSearch.followUp) {
            window.setTimeout(() => void syncLocation(), 450)
            abort.current = null
            setBusy(false)
            setPhase('')
            setStepNumber(0)
            flashMarker(null)
            return
          }
          // “Search YouTube for cats and open the first result” needs the
          // result click, not an answer from the results page. Keep that
          // follow-up on the native path too.
          const wantsFirstResult = /\b(?:open|click|tap)\s+(?:the\s+)?(?:first|top)\s+(?:result|video|link|item)\b/i.test(siteSearch.followUp)
          // “Tell me the first result title” is answered by the results page;
          // opening the result first costs a navigation and can lose the list.
          const wantsResultTitle =
            !wantsFirstResult &&
            /\b(?:first|top)\s+(?:result|video|link|item)\b[\s\S]*\b(?:title|name|headline)\b|\b(?:title|name|headline)\b[\s\S]*\b(?:first|top)\s+(?:result|video|link|item)\b/i.test(
              siteSearch.followUp,
            )
          // The search is also the first half of an answer request. Wait for
          // the results page, then read it on the fast answer lane instead of
          // sending the whole task back through the planner.
          if (asksForPageAnswer(siteSearch.followUp) || wantsFirstResult) {
            setPhase('Reading the page…')
            let landed: BrowserViewState | null = searchState
            const previousUrl = searchState?.url
            const deadline = Date.now() + 3_500
            while (Date.now() < deadline) {
              await new Promise((resolve) => window.setTimeout(resolve, 300))
              try {
                landed = await api<BrowserViewState>('/browser/state', { method: 'POST', signal: controller.signal })
                setView(landed)
                setAddress(landed.url)
                setScreenNonce((value) => value + 1)
                if ((landed.snapshot.text ?? '').trim().length >= 160 && landed.url !== previousUrl) break
              } catch (cause) {
                if (controller.signal.aborted) throw cause
                if (isSessionLoss(cause)) throw cause
                break
              }
            }
            if (landed && (landed.snapshot.text ?? '').trim().length >= 160) {
              // Search-result snippets are often too terse for the answer lane
              // (it may correctly say the birth year is not visible there).
              // Open the first result that matches the query, then answer from
              // the article itself.
              // Site searches stay on one host (all YouTube results point at
              // youtube.com), so the web-search “prefer another host” rule
              // would reject every video. Fall back to the first substantial
              // content link on the results page.
              const resultLink = wantsResultTitle
                ? null
                : firstSearchResult(landed.snapshot.elements, siteSearch.query) ?? firstContentLink(landed.snapshot.elements)
              if (resultLink) {
                try {
                  const opened = await api<BrowserViewState>('/browser/act', {
                    method: 'POST',
                    signal: controller.signal,
                    json: { action: { type: 'click', selector: `[data-stet-id="${resultLink.id}"]` }, read: true },
                  })
                  landed = opened
                  setView(opened)
                  setAddress(opened.url)
                  setScreenNonce((value) => value + 1)
                  await new Promise((resolve) => window.setTimeout(resolve, 350))
                  if (/\b(?:title|headline)\b/i.test(siteSearch.followUp || '') && (opened.title || '').trim()) {
                    const answer = `The page title is: ${(opened.title || '').trim()}`
                    append({ role: 'stet', text: answer })
                    setAnswer(answer)
                    clearAgentMemory()
                    abort.current = null
                    setBusy(false)
                    setPhase('')
                    setStepNumber(0)
                    flashMarker(null)
                    return
                  }
                  if (wantsFirstResult && !asksForPageAnswer(siteSearch.followUp)) {
                    const answer = `Opened the first result: ${(resultLink.label || opened.title || opened.url).trim()}`
                    append({ role: 'stet', text: answer })
                    setAnswer(answer)
                    clearAgentMemory()
                    abort.current = null
                    setBusy(false)
                    setPhase('')
                    setStepNumber(0)
                    flashMarker(null)
                    return
                  }
                } catch (cause) {
                  if (controller.signal.aborted) throw cause
                  if (isSessionLoss(cause)) throw cause
                  // Keep the results page; the answer lane can still try it.
                }
              }
              try {
                const result = await api<{ answer?: string }>('/browser/answer', {
                  method: 'POST',
                  signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5_000)]),
                  // The opening paragraphs contain the answer for ordinary
                  // lookup questions; sending a full article gives slow lanes
                  // more text to process and delays the fallback.
                  json: { task: siteSearch.followUp, snapshot: { ...landed.snapshot, text: landed.snapshot.text.slice(0, 3_000) } },
                })
                const answer = usablePageAnswer(result.answer || '')
                if (answer) {
                  append({ role: 'stet', text: answer })
                  setAnswer(answer)
                  clearAgentMemory()
                  abort.current = null
                  setBusy(false)
                  setPhase('')
                  setStepNumber(0)
                  flashMarker(null)
                  return
                }
                // Search results often show only a snippet (for example a
                // birth year), not the answer itself. Open the top result that
                // starts with the query and read the article before paying for
                // a planner round trip.
                const lowerQuery = siteSearch.query.toLowerCase()
                const topResult = landed.snapshot.elements.find(
                  (element) =>
                    (element.role === 'link' || element.tag === 'a') &&
                    element.label.toLowerCase().startsWith(lowerQuery) &&
                    !element.href?.includes('/search'),
                )
                if (topResult) {
                  setPhase('Opening the top result…')
                  const clicked = await api<BrowserViewState>('/browser/act', {
                    method: 'POST',
                    signal: controller.signal,
                    json: { action: { type: 'click', selector: `[data-stet-id="${topResult.id}"]` }, read: true },
                  })
                  setView(clicked)
                  setAddress(clicked.url)
                  setScreenNonce((value) => value + 1)
                  if ((clicked.snapshot.text ?? '').trim().length >= 160) {
                    const second = await api<{ answer?: string }>('/browser/answer', {
                      method: 'POST',
                      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(75_000)]),
                      json: { task: siteSearch.followUp, snapshot: clicked.snapshot },
                    })
                    const secondAnswer = usablePageAnswer(second.answer || '')
                    if (secondAnswer) {
                      append({ role: 'stet', text: secondAnswer })
                      setAnswer(secondAnswer)
                      clearAgentMemory()
                      abort.current = null
                      setBusy(false)
                      setPhase('')
                      setStepNumber(0)
                      flashMarker(null)
                      return
                    }
                  }
                }
              } catch (cause) {
                if (controller.signal.aborted) throw cause
                if (isSessionLoss(cause)) throw cause
              }
            }
            setPhase('')
            append({ role: 'stet', text: `Searched ${siteSearch.site} for “${siteSearch.query}”, but could not answer from the page; continuing.` })
          }
        }
        if (!searchSubmitted) append({ role: 'stet', text: `${siteSearch.site} did not expose a search box; using a web search for “${siteSearch.query}”.` })
      } catch (cause) {
        if (controller.signal.aborted) {
          append({ role: 'error', text: 'Stopped.' })
          abort.current = null
          setBusy(false)
          setPhase('')
          return
        }
        if (handleSessionLoss(cause)) {
          append({ role: 'error', text: SESSION_ENDED })
          abort.current = null
          setBusy(false)
          setPhase('')
          return
        }
        append({ role: 'stet', text: `I couldn't use ${siteSearch.site}'s search box (${messageFor(cause)}); using a web search.` })
      }
      // The site path is an optimization. If it could not use a site field,
      // finish with the same direct web search as a plain “search for X”. A
      // completed search with an unreadable follow-up falls through to the
      // planner instead of navigating away from the results.
      if (!searchSubmitted) {
        try {
          const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(siteSearch.query)}`
          const startedAt = Date.now()
          const fallbackState = await api<BrowserViewState>('/browser/act', {
            method: 'POST',
            signal: controller.signal,
            json: { action: { type: 'navigate', url }, read: Boolean(siteSearch.followUp) },
          })
          setAddress(url)
          if (siteSearch.followUp) {
            setView(fallbackState)
            leadState = fallbackState
          }
          setScreenNonce((value) => value + 1)
          setLastAction(`Searching the web for “${siteSearch.query}”`)
          append({ role: 'action', text: `Searching the web for “${siteSearch.query}”`, detail: `Direct search · ${formatDuration(Date.now() - startedAt)} · ${url}` })
          if (siteSearch.followUp && asksForPageAnswer(siteSearch.followUp) && (fallbackState.snapshot.text ?? '').trim().length >= 160) {
            setPhase('Reading the page…')
            const result = await api<{ answer?: string }>('/browser/answer', {
              method: 'POST',
              signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5_000)]),
              json: {
                task: `${siteSearch.query} — ${siteSearch.followUp}`,
                snapshot: { ...fallbackState.snapshot, text: fallbackState.snapshot.text.slice(0, 3_000) },
              },
            })
            const answer = usablePageAnswer(result.answer || '')
            if (answer) {
              append({ role: 'stet', text: answer })
              setAnswer(answer)
              clearAgentMemory()
              abort.current = null
              setBusy(false)
              setPhase('')
              setStepNumber(0)
              flashMarker(null)
              return
            }
          }
          abort.current = null
          setBusy(false)
          setPhase('')
          setStepNumber(0)
          flashMarker(null)
          return
        } catch (cause) {
          if (controller.signal.aborted) throw cause
          if (isSessionLoss(cause)) throw cause
        }
      }
    }

    // Opening a known destination or running a plain web search does not need
    // a model or a page snapshot. This is the low-latency path behind “open
    // gmail”, “search for cats” and “open google and search for cats”.
    const direct = directBrowserTask(instruction)
    if (direct) {
      let directFallback = false
      const searching = direct.kind === 'search'
      const label = searching ? `Searching the web for “${direct.query}”` : `Opening ${direct.target}`
      if (!searching && isSameBrowserSite(view?.url, direct.url)) {
        append({
          role: 'stet',
          text: `${direct.target} is already open.`,
          thoughts: [`The current tab is already on ${direct.target}.`, 'No navigation or model call is needed.'],
        })
        abort.current = null
        setBusy(false)
        setPhase('')
        return
      }
      setPhase(label)
      try {
        const startedAt = Date.now()
        await api<{ ok?: boolean }>('/browser/act', {
          method: 'POST',
          signal: controller.signal,
          json: { action: { type: 'navigate', url: direct.url }, read: false },
        })
        const actMs = Date.now() - startedAt
        setAddress(direct.url)
        setView((current) => (current ? { ...current, url: direct.url, title: direct.target } : current))
        setScreenNonce((value) => value + 1)
        setLastAction(label)
        append({
          role: 'stet',
          text: searching ? `Searching the web for “${direct.query}”.` : `Opening ${direct.target}.`,
          thoughts: searching
            ? [`The task is a plain web search for “${direct.query}”.`, 'DuckDuckGo results can be opened directly, so I skipped the planner and the search-box round trip.', `Navigating the current tab to ${direct.url}.`]
            : [`The task names ${direct.target} as the destination.`, 'This is a known address, so I skipped the planner and page read.', `Navigating the current tab to ${direct.url}.`],
        })
        append({ role: 'action', text: label, detail: `Direct ${searching ? 'search' : 'open'} · ${formatDuration(actMs)} · ${direct.url}` })
        // “Open Hacker News and tell me the top story” is already complete once
        // the destination loads. Read it once and answer instead of paying for
        // a planner call that only repeats the navigation.
        if (!searching && asksForPageAnswer(instruction)) {
          try {
            const opened = await api<BrowserViewState>('/browser/state', { method: 'POST', signal: controller.signal })
            setView(opened)
            setAddress(opened.url)
            if ((opened.snapshot.text ?? '').trim().length >= 160) {
              const visibleFact = answerVisibleFact(instruction, opened.snapshot.text || '')
              if (visibleFact) {
                append({ role: 'stet', text: visibleFact })
                setAnswer(visibleFact)
                setLastAction(`Found ${visibleFact}`)
                clearAgentMemory()
                abort.current = null
                setBusy(false)
                setPhase('')
                setStepNumber(0)
                flashMarker(null)
                return
              }
              setPhase('Reading the page…')
              const result = await api<{ answer?: string }>('/browser/answer', {
                method: 'POST',
                signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5_000)]),
                json: { task: instruction, snapshot: { ...opened.snapshot, text: opened.snapshot.text.slice(0, 3_000) } },
              })
              const answer = usablePageAnswer(result.answer || '')
              if (answer) {
                append({ role: 'stet', text: answer })
                setAnswer(answer)
                clearAgentMemory()
                abort.current = null
                setBusy(false)
                setPhase('')
                setStepNumber(0)
                flashMarker(null)
                return
              }
            }
          } catch (cause) {
            if (controller.signal.aborted) throw cause
            // The answer lane is an optimization; keep the direct open.
          }
        }
        // The direct open is intentionally not followed by a page read. Refresh
        // the snapshot in the background so the next command has real elements.
        window.setTimeout(() => void syncLocation(), 450)
      } catch (cause) {
        if (controller.signal.aborted) {
          append({ role: 'error', text: 'Stopped.' })
        } else if (handleSessionLoss(cause)) {
          append({ role: 'error', text: SESSION_ENDED })
        } else {
          const message = messageFor(cause)
          // A direct navigation is an optimization too. If the destination
          // rejects it, keep the session and let the agent route there itself.
          setError('')
          append({ role: 'stet', text: `The direct ${searching ? 'search' : 'open'} did not work (${message}). Continuing with the general browser agent.` })
          directFallback = true
          lookupFailed = true
          leadState = null
        }
      } finally {
        if (!directFallback) {
          abort.current = null
          setBusy(false)
          setPhase('')
          setStepNumber(0)
          flashMarker(null)
        }
      }
      if (!directFallback) return
      setPhase('Trying the general browser agent…')
    }

    // “Open my assignment in Google Classroom” is a navigation plus a link
    // scan. Do it directly instead of asking a planner to rediscover the site,
    // serialize a plan and choose the same link seven to fourteen seconds later.
    const siteLookup = directSiteLookup(instruction)
    if (siteLookup) {
      try {
        let state = view
        if (!isSameBrowserSite(view?.url, siteLookup.url)) {
          const label = `Opening ${siteLookup.site}`
          setPhase(label)
          const startedAt = Date.now()
          state = await api<BrowserViewState>('/browser/act', {
            method: 'POST',
            signal: controller.signal,
            json: { action: { type: 'navigate', url: siteLookup.url }, read: true },
          })
          setView(state)
          leadState = state
          setAddress(state.url)
          setScreenNonce((value) => value + 1)
          setLastAction(label)
          append({ role: 'action', text: label, detail: `Direct open · ${formatDuration(Date.now() - startedAt)} · ${siteLookup.url}` })
        }
        if (state && googleSignInRequired(siteLookup.url, state.url)) {
          const message = `${siteLookup.site} needs you to sign in in the live view. Once you are signed in, press Run and I will open it directly.`
          append({ role: 'stet', text: message })
          setAnswer(message)
          abort.current = null
          setBusy(false)
          setPhase('')
          setStepNumber(0)
          flashMarker(null)
          return
        }
        const label = `Finding ${siteLookup.query}`
        setPhase(label)
        const startedAt = Date.now()
        const next = await api<BrowserViewState>('/browser/act', {
          method: 'POST',
          signal: controller.signal,
          json: { action: { type: 'findLink', text: siteLookup.query }, read: true },
        })
        setView(next)
        leadState = next
        setAddress(next.url)
        setScreenNonce((value) => value + 1)
        setLastAction(label)
        append({
          role: 'stet',
          text: `Opened “${siteLookup.query}” in ${siteLookup.site}.`,
          thoughts: ['The destination was a known site, so I opened it directly.', 'The item was resolved by scanning the page links; no planner call was needed.'],
        })
        append({ role: 'action', text: label, detail: `Direct link scan · ${formatDuration(Date.now() - startedAt)} · ${stateDetail(next)}` })
        const answer = `Opened “${siteLookup.query}” in ${siteLookup.site}.`
        setAnswer(answer)
        clearAgentMemory()
        abort.current = null
        setBusy(false)
        setPhase('')
        setStepNumber(0)
        flashMarker(null)
        return
      } catch (cause) {
        if (controller.signal.aborted) throw cause
        if (isSessionLoss(cause)) throw cause
        append({
          role: 'stet',
          text: `I couldn't open “${siteLookup.query}” directly in ${siteLookup.site}; continuing with the browser agent.`,
        })
        lookupFailed = true
        leadState = null
      }
    }

    // A longer instruction can still name its starting site. Open that site
    // first, then let the planner work from the real page instead of spending
    // a step rediscovering where the task begins. This is generic: any known
    // site or public URL works, not just Google apps.
    const lead = sheetChartTask ? null : directBrowserLead(instruction)
    // Once the starting site is open, plan the remaining work only. Keeping
    // “go to X” in the planner task makes it navigate back to X after a click,
    // undoing its own progress.
    let planningTask = sheetChartTask ?? instruction
    if (lead && isSameBrowserSite(view?.url, lead.url)) planningTask = lead.rest
    if (lead && !isSameBrowserSite(view?.url, lead.url)) {
      const label = `Opening ${lead.target}`
      setPhase(label)
      try {
        const startedAt = Date.now()
        const next = await api<BrowserViewState>('/browser/act', {
          method: 'POST',
          signal: controller.signal,
          json: { action: { type: 'navigate', url: lead.url }, read: true },
        })
        planningTask = lead.rest
        setView(next)
        leadState = next
        setAddress(next.url)
        setScreenNonce((value) => value + 1)
        setLastAction(label)
        append({
          role: 'stet',
          text: `Starting at ${lead.target}.`,
          thoughts: ['The task names its starting site before the remaining work.', `I opened ${lead.url} directly, so the planner can start from the real page.`],
        })
        append({
          role: 'action',
          text: label,
          detail: `Direct open · ${formatDuration(Date.now() - startedAt)} · ${lead.url}`,
        })
        if (googleSignInRequired(lead.url, next.url)) {
          setLastAction('Google sign-in required')
          setError('')
          append({
            role: 'stet',
            text: 'Google is asking you to sign in. Sign in in the live view, then press Run — the task is still here.',
          })
          abort.current = null
          setBusy(false)
          setPhase('')
          flashMarker(null)
          return
        }
        agentNotes = [
          ...agentNotes,
          `The task's starting site (${lead.url}) is already open. Continue from the current page; do not navigate back to it unless the task explicitly asks.`,
        ].slice(-8)
        agentMemory.current.notes = agentNotes
      } catch (cause) {
        if (controller.signal.aborted) {
          append({ role: 'error', text: 'Stopped.' })
          abort.current = null
          setBusy(false)
          setPhase('')
          return
        }
        if (handleSessionLoss(cause)) {
          append({ role: 'error', text: SESSION_ENDED })
          abort.current = null
          setBusy(false)
          setPhase('')
          return
        }
        // The destination failed to load, but the current page is still a
        // valid place for the planner to continue.
        append({ role: 'stet', text: `I couldn't open ${lead.target}; continuing from the current page.` })
      }
    }

    // A compound instruction often starts with an action the page already
    // exposes. Run those leading native actions immediately instead of paying
    // a model round trip for every field or click. Stop as soon as the next
    // clause needs a real planning decision.
    let actionState = leadState ?? view
    let nativeSteps = 0
    // A navigation can return before the destination has finished exposing its
    // controls. Refresh once before giving up on native actions; otherwise a
    // simple multi-field form falls through to the slow planner even though the
    // destination is already open.
    if (actionState && !actionState.snapshot.elements.length) {
      try {
        const refreshed = await api<BrowserViewState>('/browser/state', {
          method: 'POST',
          signal: controller.signal,
        })
        actionState = refreshed
        leadState = refreshed
      } catch (refreshCause) {
        if (controller.signal.aborted) throw refreshCause
        if (isSessionLoss(refreshCause)) throw refreshCause
      }
    }
    for (let directSteps = 0; directSteps < 6 && actionState; directSteps += 1) {
      const nextDirect = directActionLead(planningTask, actionState.snapshot.elements)
      if (!nextDirect) break
      const directLabel = actionLabel(nextDirect.action, actionState.snapshot.elements)
      // The last action is a form submit. Waiting for the destination page is
      // unnecessary: the click already happened, and a slow POST response can
      // otherwise add seconds to a task that is already finished. The live
      // frame follows the navigation while the answer is returned immediately.
      const terminalSubmit =
        !nextDirect.rest &&
        nextDirect.action.type === 'click' &&
        /\b(?:submit|send)\b/i.test(directLabel)
      setPhase(directLabel)
      try {
        const startedAt = Date.now()
        let next: BrowserViewState
        try {
          next = await api<BrowserViewState>('/browser/act', {
            method: 'POST',
            signal: controller.signal,
            json: { action: nextDirect.action, read: !terminalSubmit },
          })
        } catch (first) {
          if (controller.signal.aborted || isSessionLoss(first)) throw first
          // A transient page/CDP error should not send a one-click task back
          // through the planner. Retry the same native action once.
          await new Promise((resolve) => setTimeout(resolve, 350))
          next = await api<BrowserViewState>('/browser/act', {
            method: 'POST',
            signal: controller.signal,
            json: { action: nextDirect.action, read: !terminalSubmit },
          })
        }
        if (terminalSubmit) {
          nativeSteps += 1
          setLastAction(directLabel)
          history.push({ action: directLabel, result: 'Submitted' })
          append({ role: 'stet', text: directLabel })
          append({ role: 'action', text: directLabel, detail: `Native submit · ${formatDuration(Date.now() - startedAt)} · Sent` })
          setScreenNonce((value) => value + 1)
          setLiveReady(false)
          setLiveNonce((value) => value + 1)
          const answer = completionMessage(instruction)
          append({ role: 'stet', text: answer })
          setAnswer(answer)
          clearAgentMemory()
          abort.current = null
          setBusy(false)
          setPhase('')
          setStepNumber(0)
          flashMarker(null)
          return
        }
        const navigated = next.url !== actionState.url
        actionState = next
        leadState = next
        nativeSteps += 1
        setView(next)
        setAddress(next.url)
        setScreenNonce((value) => value + 1)
        if (navigated) {
          setLiveReady(false)
          setLiveNonce((value) => value + 1)
        }
        setLastAction(directLabel)
        history.push({ action: directLabel, result: stateDetail(next) })
        append({ role: 'stet', text: directLabel })
        append({ role: 'action', text: directLabel, detail: `Native step · ${formatDuration(Date.now() - startedAt)} · ${stateDetail(next)}` })
        planningTask = nextDirect.rest
        if (
          navigated &&
          (nextDirect.action.type === 'click' || nextDirect.action.type === 'findLink') &&
          asksForDestination(instruction)
        ) {
          const answer = `${next.title || 'The page'} — ${next.url}`
          append({ role: 'stet', text: `The click opened ${answer}.` })
          setAnswer(answer)
          clearAgentMemory()
          abort.current = null
          setBusy(false)
          setPhase('')
          setStepNumber(0)
          flashMarker(null)
          return
        }
      } catch (cause) {
        if (controller.signal.aborted) throw cause
        if (isSessionLoss(cause)) throw cause
        // The clause did not resolve cleanly. Keep the session and let the
        // planner handle the whole remaining instruction instead of failing.
        append({ role: 'stet', text: `That native step didn't work: ${messageFor(cause)}. Continuing with the browser agent.` })
        break
      }
    }
    // A navigation can finish before the new document has a title. Give it one
    // short beat and read the state again; this is much cheaper than sending
    // the title request to a planner just because the first snapshot was early.
    if (nativeSteps > 0 && actionState && /\b(?:title|headline)\b/i.test(planningTask) && !(actionState.title || '').trim()) {
      await new Promise((resolve) => setTimeout(resolve, 350))
      try {
        const refreshed = await api<BrowserViewState>('/browser/state', {
          method: 'POST',
          signal: controller.signal,
        })
        actionState = refreshed
        leadState = refreshed
        setView(refreshed)
        setAddress(refreshed.url)
      } catch (cause) {
        if (controller.signal.aborted) throw cause
      }
    }
    // “Open the top story, then tell me its title” is answered by the page the
    // native click just opened. Do not spend a model call re-reading a title
    // that is already in the snapshot.
    if (nativeSteps > 0 && actionState && /\b(?:title|headline)\b/i.test(planningTask)) {
      const pageTitle = (actionState.title || '').trim()
      if (pageTitle) {
        const answer = `The page title is: ${pageTitle}`
        append({ role: 'stet', text: answer })
        setAnswer(answer)
        clearAgentMemory()
        abort.current = null
        setBusy(false)
        setPhase('')
        setStepNumber(0)
        flashMarker(null)
        return
      }
    }
    if (nativeSteps > 0 && !planningTask.trim()) {
      const answer = completionMessage(instruction)
      append({ role: 'stet', text: answer })
      setAnswer(answer)
      clearAgentMemory()
      abort.current = null
      setBusy(false)
      setPhase('')
      setStepNumber(0)
      flashMarker(null)
      return
    }

    // Classroom calls its assignment inbox “To-do”. If the person is already
    // there, a generic “open my assignment” is a link scan, not a planner step;
    // “open my math assignment” becomes a search for the Math class.
    const onClassroom = /classroom\.google\.com/i.test(leadState?.url || view?.url || '')
    if (onClassroom) {
      if (/^(?:open|find|locate|show\s+me)\s+(?:the\s+|my\s+)?(?:assignments?|homework|to-?do|work|tasks?)$/i.test(planningTask)) {
        planningTask = 'open To-do'
      } else {
        planningTask = planningTask.replace(/\s+(?:assignments?|homework|tasks?|work)$/i, '').trim() || planningTask
      }
    }

    // Finding a named assignment or link is a DOM scan, not a planning
    // problem. Try the fast path first; if the page does not expose it yet,
    // fall through to the planner so it can navigate the site's own menus.
    const lookup = directFindLink(planningTask)
    if (lookup) {
      setPhase(`Finding ${lookup.query}…`)
      try {
        const startedAt = Date.now()
        const next = await api<BrowserViewState>('/browser/act', {
          method: 'POST',
          signal: controller.signal,
          json: { action: lookup.action, read: true },
        })
        setView(next)
        leadState = next
        setAddress(next.url)
        setScreenNonce((value) => value + 1)
        setLastAction(`Found ${lookup.query}`)
        append({
          role: 'stet',
          text: `Found “${lookup.query}” and opened it.`,
          thoughts: ['I searched every link and button on the page, including below the fold.', 'The matching link was opened directly; no planner call was needed.'],
        })
        append({
          role: 'action',
          text: `Opened ${lookup.query}`,
          detail: `Direct link scan · ${formatDuration(Date.now() - startedAt)}`,
        })
        if (lookup.complete) {
          abort.current = null
          setBusy(false)
          setPhase('')
          setStepNumber(0)
          flashMarker(null)
          return
        }
      } catch (cause) {
        if (controller.signal.aborted) {
          append({ role: 'error', text: 'Stopped.' })
          abort.current = null
          setBusy(false)
          setPhase('')
          return
        }
        if (handleSessionLoss(cause)) {
          append({ role: 'error', text: SESSION_ENDED })
          abort.current = null
          setBusy(false)
          setPhase('')
          return
        }
        lookupFailed = true
        blockedActions.add(JSON.stringify(lookup.action))
        agentNotes = [...agentNotes, `No link matching “${lookup.query}” was found on ${view?.url || 'the current page'}; use the site navigation or search.`].slice(-8)
        agentMemory.current.notes = agentNotes
        history.push({ action: `Find “${lookup.query}”`, result: 'No matching link was found.' })
        append({ role: 'stet', text: `I couldn't see “${lookup.query}” yet; looking around the page.` })
      }
    }

    // Scrolls and key presses need neither a page snapshot nor a model call.
    // Keep them on the same direct path as a known URL so they feel immediate.
    const latestElements = (leadState ?? view)?.snapshot.elements ?? []
    const instantAction =
      directBrowserAction(planningTask) ??
      directFormFill(planningTask, latestElements) ??
      (isSingleActionInstruction(planningTask) ? directElementAction(planningTask, latestElements) : null)
    if (instantAction) {
      const label = actionLabel(instantAction, latestElements)
      const destination = asksForDestination(instruction)
      const needsModel = !destination && asksForPageAnswer(instruction)
      let instantRecovered = false
      setPhase(label)
      try {
        const startedAt = Date.now()
        await api<{ ok?: boolean }>('/browser/act', {
          method: 'POST',
          signal: controller.signal,
          json: { action: instantAction, read: false },
        })
        const actMs = Date.now() - startedAt
        setScreenNonce((value) => value + 1)
        setLastAction(label)
        append({
          role: 'stet',
          text: `${label}.`,
          thoughts: ['This is a single, unambiguous page action.', 'It resolves against the current snapshot and needs no planner model, so it runs directly in the browser.'],
        })
        append({ role: 'action', text: label, detail: `Direct action · ${formatDuration(actMs)}` })
        // A direct click or typing step can navigate or reveal a new panel.
        // Refresh in the background so the address bar and next instruction
        // see the result without blocking this action.
        if (
          instantAction.type === 'click' ||
          instantAction.type === 'type' ||
          instantAction.type === 'check' ||
          instantAction.type === 'back' ||
          instantAction.type === 'forward' ||
          instantAction.type === 'reload'
        ) {
          window.setTimeout(() => void syncLocation(), 450)
        }
      } catch (cause) {
        if (controller.signal.aborted) {
          append({ role: 'error', text: 'Stopped.' })
        } else if (handleSessionLoss(cause)) {
          append({ role: 'error', text: SESSION_ENDED })
        } else {
          const message = messageFor(cause)
          append({
            role: 'stet',
            text: `That direct step didn't work: ${message}. I’m re-reading the page and trying another route.`,
          })
          append({ role: 'action', text: `${label} failed`, detail: message })
          history.push({ action: `${label} (failed)`, result: message })
          blockedActions.add(JSON.stringify(instantAction))
          agentNotes = [...agentNotes, `${label} failed: ${message}. Try a different target.`].slice(-8)
          agentMemory.current.notes = agentNotes
          lookupFailed = true
          instantRecovered = true
        }
      } finally {
        if (!instantRecovered && !needsModel) {
          abort.current = null
          setBusy(false)
          setPhase('')
          setStepNumber(0)
          flashMarker(null)
        }
      }
      if (!instantRecovered) {
        if (destination) {
          const next = await syncLocation()
          const answer = next ? `${next.title || 'The page'} — ${next.url}` : `${view?.title || 'The page'} — ${view?.url || ''}`
          append({ role: 'stet', text: `The click opened ${answer}.` })
          setAnswer(answer)
          clearAgentMemory()
          abort.current = null
          setBusy(false)
          setPhase('')
          setStepNumber(0)
          flashMarker(null)
          return
        }
        if (!needsModel) {
          const answer = completionMessage(instruction)
          append({ role: 'stet', text: answer })
          setAnswer(answer)
          clearAgentMemory()
          abort.current = null
          setBusy(false)
          setPhase('')
          setStepNumber(0)
          flashMarker(null)
          return
        }
        agentNotes = [...agentNotes, 'A direct step already ran; use the current page to answer without repeating it.'].slice(-8)
        agentMemory.current.notes = agentNotes
      }
    }

    // A read-only page question does not need the tool-planning prompt, the
    // element list or a multi-step loop. Answer it from the page text on the
    // fastest lane, and only fall back to the planner if the page cannot answer.
    let answerState = leadState ?? view
    // A site that was already open counts as navigated too: the person can ask
    // “what do I have due today?” again while Classroom is still on screen.
    const answerAfterLead = Boolean(leadState) || Boolean(lead && isSameBrowserSite(view?.url, lead.url))
    if (answerState && asksForPageAnswer(planningTask) && !needsPageAction(planningTask, answerAfterLead)) {
      setPhase('Reading the page…')
      // A freshly opened app page can return its shell before its content is
      // ready. Wait until the page text stops growing, or a bounded deadline.
      if (answerAfterLead) {
        let lastLength = (answerState.snapshot.text ?? '').trim().length
        let stable = 0
        const readyBy = Date.now() + 2_500
        while (Date.now() < readyBy && stable < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 250))
          try {
            const next = await api<BrowserViewState>('/browser/state', {
              method: 'POST',
              signal: AbortSignal.any([controller.signal, AbortSignal.timeout(3_000)]),
            })
            const length = (next.snapshot.text ?? '').trim().length
            stable = length === lastLength && length >= 160 ? stable + 1 : 0
            lastLength = length
            answerState = next
            setView(next)
            setAddress(next.url)
            setScreenNonce((value) => value + 1)
          } catch (cause) {
            if (controller.signal.aborted) throw cause
            if (isSessionLoss(cause)) throw cause
            break
          }
        }
      }
      // A visible due list is a date comparison. Answer it locally so a slow
      // model lane cannot guess today’s date or leak a reasoning trace.
      if (asksForSchedule(planningTask)) {
        let scheduled = answerVisibleSchedule(answerState.snapshot.text ?? '')
        if (!scheduled) {
          // The home page often exposes only a “Due soon” heading. Open the
          // site’s actual To-do/upcoming view and read dated work there instead
          // of asking a model to infer today’s date from a heading.
          const labels = [
            /^to-?do\b/i,
            /^view\s+to-?do\b/i,
            /^due\s+soon\b/i,
            /^upcoming\b/i,
            /\bto-?do\b/i,
          ]
          const elements = answerState.snapshot.elements
          const candidates = labels
            .map((label) => elements.find((element) => label.test(element.label.trim())))
            .filter((element): element is NonNullable<typeof element> => Boolean(element))
          for (const candidate of candidates.slice(0, 3)) {
            setPhase(`Opening ${candidate.label}…`)
            try {
              const opened = await api<BrowserViewState>('/browser/act', {
                method: 'POST',
                signal: controller.signal,
                json: { action: { type: 'click', selector: `[data-stet-id="${candidate.id}"]` }, read: true },
              })
              setView(opened)
              setAddress(opened.url)
              setScreenNonce((value) => value + 1)
              await new Promise((resolve) => window.setTimeout(resolve, 500))
              answerState = await api<BrowserViewState>('/browser/state', {
                method: 'POST',
                signal: AbortSignal.any([controller.signal, AbortSignal.timeout(4_000)]),
              })
              setView(answerState)
              setAddress(answerState.url)
              setScreenNonce((value) => value + 1)
              scheduled = answerVisibleSchedule(answerState.snapshot.text ?? '')
              if (scheduled) break
            } catch (cause) {
              if (controller.signal.aborted) throw cause
              if (isSessionLoss(cause)) throw cause
            }
          }
        }
        if (scheduled) {
          append({ role: 'stet', text: scheduled })
          setAnswer(scheduled)
          clearAgentMemory()
          abort.current = null
          setBusy(false)
          setPhase('')
          setStepNumber(0)
          flashMarker(null)
          return
        }
      }
      if (!asksForSchedule(planningTask) && (answerState.snapshot.text ?? '').trim().length >= 160) {
        let answer = ''
        for (let attempt = 0; attempt < 2 && !answer; attempt += 1) {
          try {
            const result = await api<{ answer?: string }>('/browser/answer', {
              method: 'POST',
              signal: AbortSignal.any([controller.signal, AbortSignal.timeout(6_000)]),
              json: { task: planningTask, snapshot: answerState.snapshot },
            })
            answer = usablePageAnswer(result.answer || '')
          } catch (cause) {
            if (controller.signal.aborted) throw cause
            // An empty or unavailable page-answer lane is not a task failure.
            // The normal browser agent below can still navigate and read.
          }
          // An app shell can answer “not visible” before its widgets render.
          // Read once more after a short settle before paying for the planner.
          if (!answer && attempt === 0 && answerAfterLead) {
            await new Promise((resolve) => window.setTimeout(resolve, 700))
            try {
              answerState = await api<BrowserViewState>('/browser/state', {
                method: 'POST',
                signal: AbortSignal.any([controller.signal, AbortSignal.timeout(3_000)]),
              })
              setView(answerState)
              setAddress(answerState.url)
              setScreenNonce((value) => value + 1)
            } catch (cause) {
              if (controller.signal.aborted) throw cause
              if (isSessionLoss(cause)) throw cause
              break
            }
          }
        }
        if (answer) {
          append({ role: 'stet', text: answer })
          setAnswer(answer)
          clearAgentMemory()
          abort.current = null
          setBusy(false)
          setPhase('')
          setStepNumber(0)
          flashMarker(null)
          return
        }
      }
    }

    // The worker already races several lanes and has its own per-lane deadline.
    // Do not turn a stalled request into an unbounded wait in the browser UI.
    const planWithRetry = (payload: Record<string, unknown>, signal: AbortSignal): Promise<BrowserActResponse> =>
      api<BrowserActResponse>('/browser/plan', {
        method: 'POST',
        signal: AbortSignal.any([signal, AbortSignal.timeout(PLAN_TIMEOUT_MS)]),
        json: payload,
      })

    let reachedEnd = false
    // Editing is a coding job: a dedicated coder writes the page program
    // instead of asking the action planner to squeeze JavaScript into JSON.
    const editingTask = isPageEditingTask(instruction)
    const simulationTask = isSimulationTask(instruction)
    // Course lessons, quizzes, forms and repeated row/item work are exactly
    // what a page program is for. Send these straight to the coder instead of
    // spending one planner round trip per click.
    const codeFirstTask = !editingTask && !simulationTask && prefersPageScript(planningTask)
    let simulationHtml = ''
    let ranMockSimulation = false
    const failedActions = new Map<string, number>()
    const stalledActions = new Map<string, number>()
    try {
      // The session screen already contains a fresh snapshot. Reusing it saves a
      // full page read when the person gives the next instruction immediately.
      const recent = lookupFailed ? null : leadState ?? (view && Date.now() - view.snapshot.at < 5_000 ? view : null)
      let current = recent ?? (await api<BrowserViewState>('/browser/state', { method: 'POST', signal: controller.signal }))
      setView(current)
      setAddress(current.url)
      syncPageBlocks(current)
      setPhase(recent ? 'Using the current page…' : 'Page loaded.')

      // When something fails, think about why before trying again. The reviewer
      // proposes genuinely different routes, and those become working notes for
      // the next plan instead of a slightly changed repeat of the same idea.
      const reflectOn = async (attempt: string, result: string): Promise<boolean> => {
        if (reflections >= 2) return false
        reflections += 1
        setPhase('Working out why that failed…')
        try {
          const verdict = await api<{ diagnosis?: string; options?: string[] }>('/browser/reflect', {
            method: 'POST',
            signal: controller.signal,
            json: {
              task: instruction,
              attempt: attempt.slice(0, 300),
              result: result.slice(0, 1_200),
              snapshot: current.snapshot,
              notes: agentNotes,
            },
          })
          const options = (verdict.options ?? []).filter(Boolean).slice(0, 3)
          if (!verdict.diagnosis && !options.length) return false
          append({
            role: 'stet',
            text: `That didn't produce the result. ${verdict.diagnosis || 'Trying a different approach.'}`,
            ...(options.length ? { thoughts: options } : {}),
          })
          agentNotes = [
            ...agentNotes,
            `Reflection: ${verdict.diagnosis || 'the last attempt failed'}. Different routes to try: ${options.join(' | ') || 'use a different tool or target'}.`,
          ].slice(-8)
          agentMemory.current.notes = agentNotes
          saveBrowserMemory({ task: instruction, plan: agentPlan, notes: agentNotes, script: agentScript })
          return true
        } catch {
          return false
        }
      }
      for (let step = 0; step < MAX_ACTIONS; step += 1) {
        if (controller.signal.aborted) break
        const roundStep = step % MAX_STEPS
        if (roundStep === 0 && step > 0) {
          append({
            role: 'stet',
            text: `Continuing with another ${MAX_STEPS} actions. My plan, notes and scratchpad carry over, so this is the same task, not a restart.`,
          })
        }
        setStepNumber(roundStep + 1)
        setPhase('Choosing the next step…')
        const blockedPage = /\b(?:rate[\s-]*limit|too many requests|captcha|verify you are human|access denied|403 forbidden|429|not able to serve|requests? this quickly|unusual traffic|slow down)\b/i.test(current.snapshot.text)
        if (blockedPage && !agentNotes.some((note) => note.startsWith('This page is showing'))) {
          agentNotes = [
            ...agentNotes,
            'This page is showing a rate-limit or verification wall. Reloading it will not help; wait for the site, use another route, or stop and tell the person.',
          ].slice(-8)
          agentMemory.current.notes = agentNotes
        }
        const planStartedAt = Date.now()
        const planPayload = {
          task: planningTask,
          step: roundStep,
          maxSteps: MAX_STEPS,
          url: current.url,
          title: current.title,
          snapshot: current.snapshot,
          ...(current.screenshot ? { screenshot: current.screenshot } : {}),
          ...(current.inspect ? { inspect: current.inspect } : {}),
          ...(current.observation ? { observation: current.observation } : {}),
          ...(agentPlan.length ? { plan: agentPlan.slice(0, 8) } : {}),
          ...(agentNotes.length ? { notes: agentNotes.slice(-8) } : {}),
          ...(blockedActions.size ? { blocked: [...blockedActions].slice(-8) } : {}),
          ...(blockedActions.size ? { recovering: true } : {}),
          ...(agentScript ? { script: agentScript } : {}),
          ...(prefersPageScript(planningTask) && !editingTask && !simulationTask ? { codeFirst: true } : {}),
          history: history.slice(-10),
        }
        let planned: BrowserActResponse | null = null
        // A plain page edit runs before planning: it is a few lines of DOM
        // code, so waiting on a model only makes a fast native edit slow.
        const directEdit = editingTask ? directPageEdit(instruction, current.snapshot.elements) : null
        if (directEdit) {
          planned = { action: directEdit, say: 'Edit the page', plan: ['Edit the page directly.'], lane: 'Page edit' }
        }
        // A cosmetic simulation is a page-code job, not an action-planning
        // job. The action planner often cannot express “make it look like …”
        // as valid JSON and burns its whole window; go straight to the coder
        // that already knows how to inspect the markup and rewrite the DOM.
        if (simulationTask && !planned && step === 0) {
          planned = {
            action: { type: 'inspect' },
            say: instruction,
            plan: ['Inspect the real page markup.', 'Apply the requested visual state in code.', 'Verify the visible result.'],
            lane: 'Simulation',
          }
        }
        if (codeFirstTask && !planned && step === 0) {
          planned = {
            action: { type: 'inspect' },
            say: instruction,
            plan: ['Read the page once.', 'Write one program for the whole repeated job.', 'Run it and verify the result.'],
            lane: 'Code-first',
          }
        }
        try {
          planned ??= await planWithRetry(planPayload, controller.signal)
        } catch (cause) {
          if (controller.signal.aborted || isSessionLoss(cause) || !isPlanTimeout(cause)) throw cause
          // A first planner window can expire while a free lane is still
          // warming up. Pressing Run used to be what rescued it because Run
          // starts with the normal fast planner again, while the old automatic
          // retry jumped straight to the slow "recovering" reasoner. Repeat
          // the normal pass here, with a short pause, so the first Run behaves
          // like the successful second click. Only escalate to the strong
          // recovery pass after that normal retry has also missed.
          setPhase('Retrying automatically…')
          await new Promise((resolve) => setTimeout(resolve, 800))
          try {
            planned = await planWithRetry(planPayload, controller.signal)
          } catch (retryCause) {
            if (controller.signal.aborted || isSessionLoss(retryCause) || !isPlanTimeout(retryCause)) throw retryCause
            setPhase('Trying the stronger planner…')
            await new Promise((resolve) => setTimeout(resolve, 1_200))
            try {
              planned = await planWithRetry({ ...planPayload, recovering: true }, controller.signal)
            } catch (finalCause) {
              if (controller.signal.aborted || isSessionLoss(finalCause)) throw finalCause
              // Do not turn a slow planner into a dead chat. Keep the page, the
              // task and the session; the person can press Run immediately.
              append({
                role: 'stet',
                text: 'The browser AI is still taking too long to answer. The page and task are still open — press Run to try this step again.',
              })
              setPhase('')
              setStepNumber(0)
              reachedEnd = true
              break
            }
          }
        }
        if (!planned) {
          reachedEnd = true
          break
        }
        const planMs = Date.now() - planStartedAt
        if (!planned.action) {
          emptyPlans += 1
          if (emptyPlans >= 2) {
            const message = 'The planner returned no usable next step. The page is still open; tell me what to try next.'
            append({ role: 'stet', text: message })
            setAnswer(message)
            reachedEnd = true
            break
          }
          append({ role: 'stet', text: 'The planner returned no action; re-reading the page and trying once more.' })
          continue
        }
        if (planned.plan?.length) {
          agentPlan = planned.plan.slice(0, 8)
          agentMemory.current.plan = agentPlan
        }
        if (planned.note) {
          agentNotes = [...agentNotes, planned.note].slice(-8)
          agentMemory.current.notes = agentNotes
        }
        const label = actionLabel(planned.action, current.snapshot.elements)
        // The scratchpad is whatever page code the agent last wrote, captured
        // before it runs so a thrown error can be repaired next step.
        if (planned.action.type === 'evaluate') {
          agentScript = planned.action.expression
          setScript(agentScript)
          saveBrowserMemory({ task: instruction, plan: agentPlan, notes: agentNotes, script: agentScript })
        }
        const planMeta = {
          ...(planned.thinking ? { thinking: planned.thinking } : {}),
          ...(planned.thoughts?.length ? { thoughts: planned.thoughts } : {}),
          ...(planned.lane ? { detail: `Planned by ${planned.lane}` } : {}),
        }
        // ask and done already carry the whole user-facing message. Appending
        // say first produced the same outage/answer twice in the activity log.
        if (planned.action.type !== 'ask' && planned.action.type !== 'done') {
          // Never relay a refusal as the plan. It is noise, not a result.
          const said = planned.say || ''
          append({ role: 'stet', text: looksLikeRefusal(said) ? 'Trying a different route.' : said || label, ...planMeta })
        }
        if (planned.action.type === 'ask') {
          const question = planned.action.message.trim()
          // A confused "could you restate that?" is not a blocker. The page,
          // the plan and the session are still here, so keep working instead
          // of handing the task back to the person. Genuine asks (sign-in,
          // payment, missing facts) still stop.
          const confused =
            /\b(?:restate|repeat|not sure|unclear|clarify|could you (?:tell|say|repeat)|what (?:should|do) (?:i|you)|which step|need (?:more|the) (?:information|context)|lost|give up)\b/i.test(
              question,
            )
          const refused = looksLikeRefusal(question)
          clarifyAsks += 1
          if ((confused || refused) && clarifyAsks <= 2 && session) {
            append({
              role: 'stet',
              text: refused
                ? 'That is not a reason to stop. Trying a different route on the page.'
                : 'I lost the thread for a moment. Re-reading the page and continuing instead of stopping.',
              thoughts: [
                `The planner asked: “${question}”`,
                refused
                  ? 'A refusal is not a blocker. The person asked for this work; the page is still open.'
                  : 'That is a request for help, not a real blocker. The page and the task are still here, so I will choose a different route.',
              ],
            })
            append({ role: 'action', text: refused ? 'Ignored a refusal and kept working' : 'Recovered from a clarification request', detail: question })
            agentNotes = [
              ...agentNotes,
              refused
                ? `The planner refused to do the task: “${question.slice(0, 200)}”. Do not refuse ordinary browsing work; continue with a different route and finish only with evidence.`
                : `The planner got stuck and asked “${question.slice(0, 200)}”. Do not ask again: re-read the page and continue with a different route.`,
            ].slice(-8)
            agentMemory.current.notes = agentNotes
            saveBrowserMemory({ task: instruction, plan: agentPlan, notes: agentNotes, script: agentScript })
            continue
          }
          // Even when the recovery budget is spent, never surface a refusal as
          // the answer. Say what actually happened instead.
          const shown = refused
            ? 'The step produced no usable action after retrying. The page is still open; press Run to try again.'
            : question
          append({ role: 'stet', text: shown, ...planMeta })
          setAnswer(shown)
          reachedEnd = true
          setPhase('')
          break
        }
        if (planned.action.type === 'done') {
          // A refusal is not a result. Treat it as a failed step instead of a
          // finished task, and let the planner try again with that evidence.
          if (looksLikeRefusal(planned.action.message) && clarifyAsks <= 2) {
            clarifyAsks += 1
            append({
              role: 'stet',
              text: 'That is not a result, so I am not stopping there. Checking the page and continuing.',
              thoughts: [
                'The planner tried to refuse instead of finishing the task.',
                'A refusal is not evidence. The page is still open and the task is still mine to do.',
              ],
            })
            agentNotes = [
              ...agentNotes,
              `The planner tried to refuse: “${planned.action.message.slice(0, 200)}”. Do not refuse and do not finish with a refusal; continue with evidence.`,
            ].slice(-8)
            agentMemory.current.notes = agentNotes
            saveBrowserMemory({ task: instruction, plan: agentPlan, notes: agentNotes, script: agentScript })
            continue
          }
          if (looksLikeRefusal(planned.action.message)) {
            const neutral = 'The run ended without a usable result. The page is still open.'
            append({ role: 'stet', text: neutral, ...planMeta })
            setAnswer(neutral)
            clearAgentMemory({ keepScript: true })
            reachedEnd = true
            setPhase('')
            break
          }
          // Check the claim against the page before ending. This is the same
          // habit as re-reading a diff: a summary can be wrong, so a second
          // strong model reviews the live page. A rejected finish turns into
          // another working step with the missing evidence named.
          if (completionAudits < 2) {
            completionAudits += 1
            setPhase('Checking the result…')
            const verdict = await api<{ complete?: boolean; missing?: string; lane?: string }>('/browser/audit', {
              method: 'POST',
              signal: controller.signal,
              json: { task: instruction, snapshot: current.snapshot, message: planned.action.message, observation: current.observation ?? '' },
            }).catch(() => null)
            if (verdict && verdict.complete === false) {
              const missing = (verdict.missing || 'The page does not show the requested result yet.').slice(0, 300)
              append({
                role: 'stet',
                text: `Not finished yet — ${missing}`,
                thoughts: ['I checked the page instead of trusting my own summary.', 'The missing evidence is the next thing to fix.'],
              })
              agentNotes = [
                ...agentNotes,
                `A reviewer checked the page and says the task is NOT complete: ${missing}. Do that now and verify it on the page before finishing.`,
              ].slice(-8)
              agentMemory.current.notes = agentNotes
              saveBrowserMemory({ task: instruction, plan: agentPlan, notes: agentNotes, script: agentScript })
              setPhase('Fixing what the review found…')
              continue
            }
          }
          const report = cleanDoneMessage(planned.action.message)
          append({ role: 'stet', text: report, ...planMeta })
          setAnswer(report)
          // Keep the finished program visible as evidence of what ran, but do
          // not restore it as unfinished work on the next visit.
          clearAgentMemory({ keepScript: true })
          reachedEnd = true
          setPhase('')
          break
        }
        // Do not execute an action the run already proved inert. A planner
        // that repeats a stale click should be forced to re-plan with the
        // blocked-action evidence, not allowed to burn another step on it.
        const plannedKey = JSON.stringify(planned.action)
        if (blockedActions.has(plannedKey) && !['wait', 'waitFor', 'scroll', 'screenshot', 'inspect'].includes(planned.action.type)) {
          blockedRepeats += 1
          append({
            role: 'stet',
            text: 'That step already did nothing. I’m re-reading the page instead of repeating it.',
            thoughts: ['The same action is already in the blocked list.', 'A different target or route is needed before the page can make progress.'],
          })
          setPhase('Trying another route…')
          if (blockedRepeats >= 2) {
            // Two dead routes is evidence, not the end. Force one more attempt
            // with the failed actions named, and let the planner's automatic
            // escalation pick a stronger model for the new route.
            if (stuckRecoveries < 2) {
              stuckRecoveries += 1
              blockedRepeats = 0
              append({
                role: 'stet',
                text: 'That route is exhausted. Re-reading the page and trying a genuinely different one.',
                thoughts: ['The same dead action came back twice.', 'A different target, keyboard route, page script or navigation is required.'],
              })
              agentNotes = [
                ...agentNotes,
                'Two different attempts did nothing. Do not repeat the blocked actions. Re-read the page and choose a genuinely different route: another element, keyboard input, page code, the site search, an embedded-frame URL, Back or Reload.',
              ].slice(-8)
              agentMemory.current.notes = agentNotes
              saveBrowserMemory({ task: instruction, plan: agentPlan, notes: agentNotes, script: agentScript })
              setPhase('Trying a different route…')
              continue
            }
            const message = 'The browser kept choosing steps that had already failed, so I stopped repeating them. The page is still open; tell me a different next step.'
            append({ role: 'stet', text: message })
            setAnswer(message)
            reachedEnd = true
            setPhase('')
            break
          }
          continue
        }
        let runAction: BrowserAction = planned.action
        let runLabel = label
        if (editingTask || codeFirstTask) {
          // A plain edit that the page itself can express does not need a model
          // at all, so no provider can refuse it. More complex code and all
          // cosmetic simulations go to the dedicated coder below.
          const direct = editingTask ? directPageEdit(instruction, current.snapshot.elements) : null
          if (direct) {
            runAction = direct
            runLabel = 'Edit the page'
            if (direct.type === 'evaluate') {
              agentScript = direct.expression
              setScript(agentScript)
              saveBrowserMemory({ task: instruction, plan: agentPlan, notes: agentNotes, script: agentScript })
            }
          } else if (simulationTask && /\baccount\b/i.test(instruction)) {
            runAction = { type: 'evaluate', expression: MOCK_ACCOUNT_SIMULATION }
            runLabel = 'Run page code'
            agentScript = MOCK_ACCOUNT_SIMULATION
            ranMockSimulation = true
            setScript(agentScript)
            saveBrowserMemory({ task: instruction, plan: agentPlan, notes: agentNotes, script: agentScript })
          } else if (simulationTask || codeFirstTask || planned.action.type === 'evaluate') {
            setPhase(simulationTask ? 'Making it look right…' : 'Writing the code…')
            // A visual simulation needs the real markup: locked states live in
            // classes, overlays and counters that the element list does not
            // carry. Read it once, then let the coder edit the rendered state.
            if (simulationTask && !simulationHtml) {
              const inspected = await api<{ html?: string }>('/browser/inspect', {
                method: 'POST',
                signal: controller.signal,
                json: { selector: 'body' },
              }).catch(() => null)
              simulationHtml = inspected?.html ?? ''
            }
            const improved = await api<{ code?: string }>('/browser/code', {
              method: 'POST',
              signal: controller.signal,
              json: {
                task: instruction,
                snapshot: current.snapshot,
                instruction: planned.say || label,
                seed: planned.action.type === 'evaluate' ? planned.action.expression : '',
                simulation: simulationTask,
                html: simulationHtml,
              },
            }).catch(() => null)
            if (improved?.code) {
              // Run the lock cleanup first: coder bodies often end in a return,
              // so anything appended after them would never execute.
              const code = simulationTask ? `${SIMULATION_CLEANUP}\n;${improved.code}` : improved.code
              runAction = { type: 'evaluate', expression: code }
              runLabel = 'Run page code'
              agentScript = code
              setScript(agentScript)
              saveBrowserMemory({ task: instruction, plan: agentPlan, notes: agentNotes, script: agentScript })
            }
          }
        }
        setPhase(runLabel)
        flashMarker(markerFor(runAction, current))
        const actStartedAt = Date.now()
        let next: BrowserViewState
        try {
          next = await api<BrowserViewState>('/browser/act', {
            method: 'POST',
            signal: controller.signal,
            json: { action: runAction },
          })
        } catch (cause) {
          if (controller.signal.aborted) throw cause
          if (isSessionLoss(cause)) throw cause
          // A form submit can navigate before the action response arrives. If
          // the URL moved, the click did land; do not report the element that
          // the new page intentionally removed as a failed action.
          let recoveredAfterNavigation: BrowserViewState | null = null
          try {
            recoveredAfterNavigation = await api<BrowserViewState>('/browser/state', {
              method: 'POST',
              signal: controller.signal,
            })
          } catch (refreshCause) {
            if (controller.signal.aborted) throw refreshCause
            if (isSessionLoss(refreshCause)) throw refreshCause
          }
          if (
            recoveredAfterNavigation &&
            recoveredAfterNavigation.url !== current.url &&
            ['click', 'select', 'check', 'fill', 'press'].includes(runAction.type)
          ) {
            current = recoveredAfterNavigation
            setView(recoveredAfterNavigation)
            setAddress(recoveredAfterNavigation.url)
            syncPageBlocks(recoveredAfterNavigation)
            setLiveReady(false)
            setLiveNonce((value) => value + 1)
            setScreenNonce((value) => value + 1)
            setLastAction(label)
            history.push({ action: label, result: stateDetail(recoveredAfterNavigation) })
            append({
              role: 'action',
              text: label,
              detail: `Step ${roundStep + 1} · thought ${formatDuration(planMs)} · acted ${formatDuration(Date.now() - actStartedAt)} · ${stateDetail(recoveredAfterNavigation)}`,
            })
            setPhase('Checking the page…')
            continue
          }
          // A selector can be stale, a page can move under a click, or a single
          // page action can fail after earlier steps succeeded. Keep the run
          // and give the planner the failure as evidence for its next choice.
          const failure = messageFor(cause)
          const actionKey = JSON.stringify(runAction)
          const failures = (failedActions.get(actionKey) ?? 0) + 1
          failedActions.set(actionKey, failures)
          blockedActions.add(actionKey)
          agentNotes = [
            ...agentNotes,
            `${runLabel} failed: ${failure}. Try a different target or tool; do not repeat it.`,
          ].slice(-8)
          agentMemory.current.notes = agentNotes
          if (runAction.type === 'evaluate') {
            agentNotes = [
              ...agentNotes,
              `The last script threw: ${failure.slice(0, 400)}. Fix that code and run the corrected version; do not fall back to clicking.`,
            ].slice(-8)
            agentMemory.current.notes = agentNotes
            saveBrowserMemory({ task: instruction, plan: agentPlan, notes: agentNotes, script: agentScript })
          }
          flashMarker(null)
          setLastAction(`${label} didn't work`)
          if (failures >= 4) {
            append({
              role: 'stet',
              text: `“${label}” has failed four times, so this particular route is not working. The page is still open. I can keep the session and you can tell me a different target, or I can ask the page for another route.`,
              thoughts: [
                `The same step failed four times: ${failure}`,
                'I have changed the page state and tried the planner between attempts. Continuing to repeat this exact action would not be progress.',
              ],
            })
            reachedEnd = true
            setPhase('')
            break
          }
          append({
            role: 'stet',
            text: `That step didn't work: ${failure}`,
            thoughts: [
              'The browser is still open, so this is a recoverable step failure.',
              'I will re-read the page and change the target or tool instead of ending the run.',
            ],
          })
          append({ role: 'action', text: `${runLabel} failed`, detail: failure })
          history.push({ action: `${runLabel} (failed)`, result: failure })
          try {
            const refreshed = await api<BrowserViewState>('/browser/state', {
              method: 'POST',
              signal: controller.signal,
            })
            current = refreshed
            setView(refreshed)
            setAddress(refreshed.url)
            syncPageBlocks(refreshed)
            setScreenNonce((value) => value + 1)
          } catch (refreshCause) {
            if (controller.signal.aborted) throw refreshCause
            if (isSessionLoss(refreshCause)) throw refreshCause
            // Keep the last known state; the next plan can still be useful.
          }
          if ((runAction.type === 'evaluate' || runAction.type === 'style' || failures >= 2) && !controller.signal.aborted) {
            await reflectOn(`${runLabel}: ${JSON.stringify(runAction).slice(0, 220)}`, failure)
          }
          setPhase('Trying another route…')
          continue
        }
        const actMs = Date.now() - actStartedAt
        const previous = current
        const navigated = next.url !== current.url
        const pageChanged =
          navigated ||
          next.title !== previous.title ||
          next.snapshot.text.slice(0, 400) !== previous.snapshot.text.slice(0, 400) ||
          elementSignature(next) !== elementSignature(previous) ||
          JSON.stringify(next.snapshot.media) !== JSON.stringify(previous.snapshot.media)
        current = next
        setView(next)
        setAddress(next.url)
        syncPageBlocks(next)
        // A click can open a new tab or replace the document. Reconnect the
        // interactive viewer when the URL changes so it never keeps showing
        // the page the agent just left.
        if (navigated) {
          setLiveReady(false)
          setLiveNonce((value) => value + 1)
        }
        setScreenNonce((value) => value + 1)
        setPhase('Checking the page…')
        const detail = stateDetail(next)
        const resultDetail = next.observation ? `${detail} — ${next.observation}` : detail
        history.push({ action: runLabel, result: resultDetail })
        // Carry the question script's handled answers into the next plan. The
        // final report otherwise tends to repeat only the last visible answer
        // (for example “Q2: ?”) even though the script already solved it.
        if (runAction.type === 'questionLoop' && next.observation) {
          try {
            const report = JSON.parse(next.observation) as { report?: { question?: string; answer?: string }[] }
            const handled = (report.report ?? [])
              .filter((entry) => entry.answer)
              .map((entry) => `${entry.answer}${entry.question ? ` (${entry.question.slice(0, 80)})` : ''}`)
            if (handled.length) {
              agentNotes = [...agentNotes, `Question script answers: ${handled.join('; ')}.`].slice(-8)
              agentMemory.current.notes = agentNotes
              saveBrowserMemory({ task: instruction, plan: agentPlan, notes: agentNotes, script: agentScript })
            }
          } catch {
            // A plain-text observation is still useful as history; it just has
            // no structured answer list to carry forward.
          }
        }
        append({ role: 'action', text: runLabel, detail: `Step ${roundStep + 1} · thought ${formatDuration(planMs)} · acted ${formatDuration(actMs)} · ${resultDetail}` })
        if (ranMockSimulation) {
          const host = (() => { try { return new URL(next.url).hostname.replace(/^www\./i, '') } catch { return 'the site' } })()
          const answer = `Prepared a visual mock on ${host}: a mock account collection showing everything unlocked. No real account or site data was changed.`
          append({ role: 'stet', text: answer })
          setAnswer(answer)
          clearAgentMemory({ keepScript: true })
          reachedEnd = true
          setPhase('')
          break
        }
        // “Open this and tell me its title” is already complete when the click
        // lands. The snapshot title is the answer; do not send another planner
        // request just to read it back.
        const landedOnSearchResults = /\/(?:search|results)(?:[/?#]|$)|[?&](?:q|query|search)=/i.test(next.url)
        if (
          navigated &&
          !landedOnSearchResults &&
          (planned.action.type === 'click' || planned.action.type === 'findLink' || planned.action.type === 'navigate') &&
          /\b(?:title|headline)\b/i.test(planningTask) &&
          (next.title || '').trim()
        ) {
          const answer = `The page title is: ${(next.title || '').trim()}`
          append({ role: 'stet', text: answer })
          setAnswer(answer)
          clearAgentMemory()
          reachedEnd = true
          setPhase('')
          break
        }
        // “Open this and tell me what it says” is already complete after the
        // click. Answer from the destination page instead of paying for another
        // planner step just to inspect the page it just opened.
        if (
          navigated &&
          (planned.action.type === 'click' || planned.action.type === 'findLink') &&
          asksForAnswerAfterAction(planningTask) &&
          (next.snapshot.text ?? '').trim().length >= 160
        ) {
          setPhase('Reading the page…')
          try {
            const result = await api<{ answer?: string }>('/browser/answer', {
              method: 'POST',
              signal: AbortSignal.any([controller.signal, AbortSignal.timeout(75_000)]),
              json: { task: planningTask, snapshot: next.snapshot },
            })
            const answer = usablePageAnswer(result.answer || '')
            if (answer) {
              append({ role: 'stet', text: answer })
              setAnswer(answer)
              clearAgentMemory()
              reachedEnd = true
              setPhase('')
              break
            }
          } catch (cause) {
            if (controller.signal.aborted) throw cause
            // The answer path is an optimization. Fall through to the planner
            // if the page cannot answer or the lane is unavailable.
          }
        }
        // A successful call that changes nothing is still a dead end. Detect
        // the second identical no-op and stop instead of spending model calls
        // on the same reload/click until the step limit.
        const noProgressAction = !['wait', 'waitFor', 'scroll', 'screenshot', 'inspect'].includes(planned.action.type)
        if (noProgressAction && !pageChanged) {
          const actionKey = JSON.stringify(planned.action)
          const stalls = (stalledActions.get(actionKey) ?? 0) + 1
          stalledActions.set(actionKey, stalls)
          if (stalls >= 2) {
            // Two identical no-ops is the point to think, not the point to
            // stop. Ask for a diagnosis and different routes, then continue.
            blockedActions.add(actionKey)
            const recovered = await reflectOn(label, 'The page did not change after this action twice.')
            if (recovered && !controller.signal.aborted) {
              stalledActions.delete(actionKey)
              setPhase('Trying a different approach…')
              continue
            }
            const message = `The page did not change after “${label}” twice, so I stopped repeating it. The page is still open; tell me a different next step or try another site.`
            append({ role: 'stet', text: message })
            setAnswer(message)
            reachedEnd = true
            setPhase('')
            break
          }
          blockedActions.add(actionKey)
          agentNotes = [...agentNotes, `“${label}” did not change the page. Do not repeat it; choose a different target or route.`].slice(-8)
          agentMemory.current.notes = agentNotes
        }
        // “Click X and tell me what page opens” is answered by the click's own
        // destination. Exploring that page would be a different task, so stop
        // with the title and URL instead of letting the planner wander.
        if (
          navigated &&
          (planned.action.type === 'click' || planned.action.type === 'findLink') &&
          asksForDestination(planningTask)
        ) {
          const answer = `${next.title || 'The page'} — ${next.url}`
          append({
            role: 'stet',
            text: `The click opened ${answer}.`,
            thoughts: ['The requested click changed the page.', 'The new title and URL are the answer to “what page opens”, so there is nothing left to explore.'],
          })
          setAnswer(answer)
          clearAgentMemory()
          reachedEnd = true
          setPhase('')
          break
        }
        // A shortcut may complete a simple task, but it must say so explicitly.
        // Otherwise the next planning step gets to verify the page and continue.
        if (planned.complete === true) {
          reachedEnd = true
          break
        }
      }
      if (!reachedEnd && !controller.signal.aborted) {
        append({
          role: 'stet',
          text: `I used all ${MAX_ACTIONS} actions and the task is not finished. The page, my plan and the scratchpad are saved — press Run and I will continue from here.`,
        })
      }
    } catch (cause) {
      if (controller.signal.aborted) {
        append({ role: 'error', text: 'Stopped.' })
      } else if (handleSessionLoss(cause)) {
        append({ role: 'error', text: SESSION_ENDED })
      } else {
          const message = messageFor(cause)
          setError(message)
          append({
            role: 'error',
            text: `${message}${session ? ' The browser is still open — press Run to continue from this page.' : ''}`,
          })
      }
    } finally {
      abort.current = null
      setBusy(false)
      setPhase('')
      setStepNumber(0)
      flashMarker(null)
    }
  }

  const stop = () => {
    setPhase('Stopping…')
    abort.current?.abort()
  }

  const remainingMinutes = session?.expiresAt ? Math.max(0, Math.ceil((session.expiresAt - clock) / 60_000)) : null
  const quotaPlan = quotaProvider === 'hyperbrowser' ? 'Hyperbrowser' : 'Browserbase'
  const quotaPlansUrl = quotaProvider === 'hyperbrowser' ? 'https://www.hyperbrowser.ai/pricing' : 'https://www.browserbase.com/plans'
  const showBrowserArt = !error && status !== 'unconfigured' && status !== 'quota'
  const markerLayer = marker ? (
    <div
      data-browser-marker={marker.label}
      className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${(marker.x / Math.max(1, marker.viewport.width)) * 100}%`,
        top: `${(marker.y / Math.max(1, marker.viewport.height)) * 100}%`,
      }}
    >
      <span className="browser-halo" />
      <span className="browser-halo-dot" />
    </div>
  ) : null

  return (
    <main className="flex min-h-dvh flex-col bg-bg text-fg md:h-dvh md:overflow-hidden">
      <header className="sticky top-0 z-30 flex min-h-16 shrink-0 flex-wrap items-center gap-2 border-b border-line bg-bg px-3 py-1.5 md:h-16 md:flex-nowrap md:px-4 md:py-0">
        <Link to="/" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-tile px-2 text-[13px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg" aria-label="Back to Ink">
          <ArrowLeft className="size-3.5" />
          Ink
        </Link>
        <div className="hidden min-w-[130px] items-center gap-2 sm:flex">
          <Mark size={22} />
          <span className="font-display text-[16px] font-semibold">Browser</span>
        </div>
        {!session ? (
        <form onSubmit={(event) => void openWebsite(event)} className="flex min-w-[130px] flex-1 items-center gap-1.5 rounded-tile border border-line bg-surface px-2 shadow-sm sm:min-w-[220px]">
          <Globe2 className="size-3.5 shrink-0 text-faint" />
          <input
            ref={addressRef}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            data-browser-local-input
            aria-label="Website address"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void openWebsite()
              }
            }}
            placeholder="Enter a URL or search"
            className="h-10 min-w-0 flex-1 bg-transparent text-[13.5px] text-fg outline-none placeholder:text-faint"
          />
          <button
            type="submit"
            disabled={busy || status === 'unconfigured' || status === 'quota' || status === 'checking'}
            aria-label={session ? 'Open website in this browser' : 'Start browser'}
            className="grid size-7 shrink-0 place-items-center rounded-[7px] text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRight className="size-3.5" />}
          </button>
        </form>
        ) : null}
        {liveView ? <div className="min-w-0 flex-1" aria-hidden="true" /> : null}
        <button
          type="button"
          onClick={() => void askBuffyAboutPage()}
          disabled={!session || askBuffyBusy}
          title="Open Buffy Chat with this page attached"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-tile border border-line bg-surface px-2.5 text-[12.5px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
        >
          {askBuffyBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Bot className="size-3.5" />}
          <span className="hidden sm:inline">Ask Buffy</span>
        </button>
        <Link to="/browser/agent" className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-tile border border-accent/30 bg-accent/5 px-2.5 text-[12.5px] font-medium text-accent transition-colors hover:bg-accent/10">
          <Bot className="size-3.5" />
          Agent
        </Link>
        <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[12px] font-medium ${status === 'ready' ? 'border-line bg-surface text-muted' : status === 'unconfigured' || status === 'quota' ? 'border-warning/30 bg-warning/10 text-warning' : 'border-line bg-surface text-faint'}`}>
          {status === 'ready' ? (session?.sessionId === 'local' ? 'Local Chrome' : 'Connected') : status === 'starting' || status === 'checking' ? 'Starting' : status === 'quota' ? 'No time left' : status === 'unconfigured' ? 'Unavailable' : 'Ready'}
        </span>
        <button
          type="button"
          onClick={() => document.getElementById('browser-tasks')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          aria-label="Open AI task panel"
          className="inline-flex h-8 shrink-0 items-center rounded-tile border border-line bg-surface px-2.5 text-[12.5px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg md:hidden"
        >
          Tasks
        </button>
        {remainingMinutes !== null ? (
          <span
            title="Time left in this browser session"
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] font-medium ${remainingMinutes <= 3 ? 'text-warning' : 'text-faint'}`}
          >
            <Timer className="size-3" />
            {remainingMinutes}m
          </span>
        ) : null}
        {session ? (
          <>
            {session.liveUrl ? (
              <button
                type="button"
                onClick={() => {
                  setShowLive((value) => !value)
                  setLiveReady(false)
                  setScreenNonce((value) => value + 1)
                }}
                aria-pressed={liveView}
                title={liveView ? 'Use the fallback screenshot view' : 'Use the interactive live view'}
                className="inline-flex h-8 shrink-0 items-center rounded-tile border border-line bg-surface px-2.5 text-[12.5px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                {liveView ? 'Snapshot' : 'Live view'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                // A Steel player can drop its stream while the cloud session is
                // still alive. Changing the key remounts the iframe, which
                // reconnects to the same live URL; only bumping screenNonce
                // refreshed the fallback screenshot and left the dead frame up.
                if (session?.sessionId === 'local') void localBrowser.connect()
                setLiveReady(false)
                setLiveNonce((value) => value + 1)
                setScreenNonce((value) => value + 1)
              }}
              title="Reconnect the live screen"
              aria-label="Reconnect live screen"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-tile border border-line bg-surface px-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <RefreshCw className="size-3.5" />
              <span className="hidden text-[12.5px] font-medium sm:inline">Reconnect</span>
            </button>
            <button
              type="button"
              onClick={() => void end()}
              disabled={busy}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-tile px-2 text-[12.5px] font-medium text-faint transition-colors hover:bg-surface-2 hover:text-danger disabled:opacity-40"
            >
              Close
            </button>
          </>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
        <section ref={browserSectionRef} className="flex min-h-[320px] flex-1 flex-col bg-surface-2 p-2.5 md:min-h-0 md:p-3" aria-label="Browser">
          {session ? (
            <>
              <div className="mb-1.5 flex h-8 shrink-0 items-center gap-1 overflow-x-auto rounded-tile border border-line bg-surface px-1.5" aria-label="Browser tabs">
                {tabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={cx(
                      'group flex h-6 max-w-[210px] shrink-0 items-center rounded-[7px] text-[12px] transition-colors',
                      tab.active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => void tabAction('switch', tab.id)}
                      disabled={tabBusy || busy}
                      title={`${tab.title || 'New tab'} — ${tab.url}`}
                      aria-current={tab.active ? 'page' : undefined}
                      className="min-w-0 truncate px-2 py-1 text-left disabled:opacity-50"
                    >
                      {tab.title || tab.url || 'New tab'}
                    </button>
                    {tabs.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => void tabAction('close', tab.id)}
                        disabled={tabBusy || busy}
                        title={`Close ${tab.title || 'tab'}`}
                        aria-label={`Close ${tab.title || 'tab'}`}
                        className="mr-1 grid size-5 shrink-0 place-items-center rounded-[5px] opacity-60 hover:bg-black/10 hover:opacity-100 disabled:opacity-30"
                      >
                        <X className="size-3" />
                      </button>
                    ) : null}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => void tabAction('new')}
                  disabled={tabBusy || busy}
                  title="New tab"
                  aria-label="New tab"
                  className="grid size-6 shrink-0 place-items-center rounded-[7px] text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-40"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              <div className="mb-2 flex h-9 shrink-0 items-center gap-1 rounded-tile border border-line bg-surface px-1.5 shadow-sm" aria-label="Browser navigation">
                <button
                  type="button"
                  aria-label="Back"
                  title="Back"
                  onClick={() => void control({ type: 'back' }, 'Back')}
                  disabled={busy}
                  className="grid size-7 shrink-0 place-items-center rounded-[7px] text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-30"
                >
                  <ArrowLeft className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Forward"
                  title="Forward"
                  onClick={() => void control({ type: 'forward' }, 'Forward')}
                  disabled={busy}
                  className="grid size-7 shrink-0 place-items-center rounded-[7px] text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-30"
                >
                  <ArrowRight className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Reload page"
                  title="Reload page"
                  onClick={() => void control({ type: 'reload' }, 'Reload page')}
                  disabled={busy}
                  className="grid size-7 shrink-0 place-items-center rounded-[7px] text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-30"
                >
                  <RefreshCw className="size-3.5" />
                </button>
                <form onSubmit={(event) => void openWebsite(event)} className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[7px] border border-line bg-surface-2 px-2">
                  <Globe2 className="size-3.5 shrink-0 text-faint" />
                  <input
                    ref={addressRef}
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void openWebsite()
                      }
                    }}
                    data-browser-local-input
                    aria-label="Address"
                    placeholder="Enter a URL or search"
                    className="h-7 min-w-0 flex-1 bg-transparent text-[12px] text-fg outline-none placeholder:text-faint"
                  />
                  <button
                    type="submit"
                    aria-label="Open address"
                    disabled={busy || !address.trim()}
                    className="grid size-6 shrink-0 place-items-center rounded-[6px] text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-30"
                  >
                    <ArrowRight className="size-3" />
                  </button>
                </form>
                <span className="hidden max-w-[180px] shrink-0 truncate px-1 text-[11px] text-faint sm:block" title={view?.title || ''}>
                  {view?.title || 'Live Chrome'}
                </span>
              </div>
              <div
                ref={liveStageRef}
                className={cx(
                  'relative min-h-0 flex-1 overflow-hidden',
                  liveView && liveSrc
                    ? 'flex items-center justify-center bg-surface-2'
                    : 'rounded-[12px] border border-line bg-white shadow-card',
                )}
              >
              {liveView && liveSrc ? (
                <div
                  className="relative overflow-hidden rounded-[12px] border border-line bg-white shadow-card"
                  style={liveFrame ?? { width: '100%', height: '100%' }}
                >
                  {screen ? (
                    <img
                      src={screen.image}
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      decoding="async"
                      className={cx(
                        'pointer-events-none absolute inset-0 m-auto max-h-full max-w-full object-contain transition-opacity duration-200',
                        liveReady ? 'opacity-0' : 'opacity-100',
                      )}
                    />
                  ) : null}
                  <iframe
                    key={`${liveSrc}:${liveNonce}`}
                    src={liveSrc}
                    title={`Live view of ${view?.title || view?.url || 'the cloud browser'}`}
                    className={cx(
                      'absolute inset-0 z-10 h-full w-full border-0 bg-transparent transition-opacity duration-200',
                      liveReady ? 'opacity-100' : 'pointer-events-none opacity-0',
                    )}
                    allow="clipboard-read; clipboard-write; fullscreen"
                    onLoad={() => setLiveReady(true)}
                    onError={() => {
                      setShowLive(false)
                      setLiveReady(false)
                    }}
                  />
                  {!liveReady ? (
                    <button
                      type="button"
                      aria-label="Click or type in the browser"
                      onClick={clickScreen}
                      onKeyDown={typeOnScreen}
                      onPaste={pasteOnScreen}
                      onWheel={scrollScreen}
                      className="absolute inset-0 z-20 cursor-crosshair bg-transparent focus:outline-none"
                    />
                  ) : null}
                  {!liveReady ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center p-2">
                      <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-muted shadow-card">
                        <Loader2 className="size-4 animate-spin text-accent" />
                        Connecting live view…
                      </p>
                    </div>
                  ) : null}
                  {markerLayer}
                </div>
              ) : screen ? (
                <>
                  <img
                    ref={screenRef}
                    src={screen.image}
                    alt={`Live screen of ${screen.title || screen.url || 'the browser'}`}
                    draggable={false}
                    decoding="async"
                    className="pointer-events-none absolute inset-0 m-auto max-h-full max-w-full object-contain"
                  />
                  <button
                    type="button"
                    aria-label="Click or type in the browser"
                    onClick={(event) => void clickScreen(event)}
                    onKeyDown={typeOnScreen}
                    onPaste={pasteOnScreen}
                    onWheel={(event) => void scrollScreen(event)}
                    className="absolute inset-0 z-10 cursor-crosshair bg-transparent focus:outline-none"
                  />
                  {markerLayer}
                </>
              ) : (
                <div className="grid h-full min-h-[280px] place-items-center bg-surface-2 p-6 text-center">
                  {screenError ? (
                    <p className="max-w-[340px] text-[12px] leading-relaxed text-danger">{screenError}</p>
                  ) : (
                    <p className="inline-flex items-center gap-2 text-[12px] text-faint">
                      <Loader2 className="size-4 animate-spin" />
                      Connecting live screen…
                    </p>
                  )}
                </div>
              )}
              </div>
              <div className="mt-2 flex h-6 shrink-0 items-center px-0.5 text-[11.5px] text-muted" aria-live={busy ? 'polite' : undefined}>
                {busy ? (
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Loader2 className="size-3 shrink-0 animate-spin text-accent" />
                    <span className="truncate">{phase || 'Working…'}</span>
                    {stepNumber ? <span className="shrink-0 text-faint">· {stepNumber}/{MAX_STEPS}</span> : null}
                  </div>
                ) : lastAction ? (
                  <div className="truncate">
                    <span className="font-semibold text-accent">Last action</span> · {lastAction}
                  </div>
                ) : null}
                {busy ? (
                  <button
                    type="button"
                    onClick={stop}
                    className="ml-auto inline-flex h-6 shrink-0 items-center gap-1 rounded-[6px] border border-line bg-surface px-2 text-[11px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                  >
                    <Square className="size-2.5 fill-current" />
                    Stop
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-[12px] border border-line bg-surface shadow-card">
              <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line bg-surface-2/70 px-3">
                <span className="flex items-center gap-1" aria-hidden="true">
                  <span className="size-1.5 rounded-full bg-line-strong" />
                  <span className="size-1.5 rounded-full bg-line-strong" />
                  <span className="size-1.5 rounded-full bg-line-strong" />
                </span>
                <span className="ml-1 h-4 w-px bg-line" aria-hidden="true" />
                <div className="flex min-w-0 items-center gap-1.5 rounded-t-[7px] border border-line border-b-surface bg-surface px-2.5 py-1 text-[11.5px] text-muted">
                  <Globe2 className="size-3" />
                  <span className="truncate">New tab</span>
                </div>
                <span className="ml-auto text-[11.5px] text-faint">Ink live screen</span>
              </div>
              <div className="flex flex-1 flex-col gap-6 px-6 py-8 md:px-10 lg:py-10 xl:flex-row xl:items-start xl:justify-between xl:gap-8">
                <div className={cx('order-2 max-w-[496px] xl:order-1', !showBrowserArt && 'xl:mx-auto')}>
                  <h1 className="font-display text-[34px] font-medium leading-[1.06] tracking-[-0.03em] md:text-[40px]">
                    {status === 'quota' ? 'Browser time used up' : status === 'unconfigured' ? 'Browser unavailable' : status === 'checking' ? 'Checking session…' : 'Open a browser'}
                  </h1>
                  <p className="mt-2.5 max-w-[430px] text-[14px] leading-relaxed text-muted">
                    {status === 'quota'
                      ? quotaProvider === 'hyperbrowser'
                        ? 'This shared browser’s included time is used up. The owner can upgrade the plan or replace the server key.'
                        : 'This shared browser’s monthly hour is used up. The owner can upgrade the plan or replace the server key.'
                      : status === 'unconfigured'
                        ? 'The hosted browser is not available right now. Try again in a moment.'
                        : status === 'checking'
                          ? 'Looking for an open session.'
                          : 'A real Chrome session with a saved profile.'}
                  </p>
                  {status === 'quota' ? (
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <a
                        href={quotaPlansUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center gap-1.5 rounded-tile bg-accent px-3.5 text-[13px] font-medium text-bg transition-opacity hover:opacity-90"
                      >
                        View {quotaPlan} plans
                        <ExternalLink className="size-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setError('')
                          void start()
                        }}
                        disabled={busy}
                        className="inline-flex h-9 items-center gap-1.5 rounded-tile border border-line bg-surface px-3.5 text-[13px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40"
                      >
                        <RefreshCw className="size-3" />
                        Try again
                      </button>
                    </div>
                  ) : status === 'unconfigured' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setStatus('checking')
                        setError('')
                        setCheckNonce((value) => value + 1)
                      }}
                      className="mt-6 inline-flex h-10 items-center gap-1.5 rounded-tile bg-accent px-4 text-[13.5px] font-medium text-bg shadow-[inset_0_1px_0_rgb(255_255_255/0.16)] transition-colors hover:bg-accent-strong"
                    >
                      <RefreshCw className="size-3.5" />
                      Try again
                    </button>
                  ) : status === 'checking' ? null : (
                    <button
                      type="button"
                      onClick={() => void start()}
                      disabled={busy || !address.trim()}
                      className="mt-6 inline-flex h-10 items-center gap-1.5 rounded-tile bg-accent px-4 text-[13.5px] font-medium text-bg shadow-[inset_0_1px_0_rgb(255_255_255/0.16)] transition-opacity hover:bg-accent-strong disabled:opacity-30"
                    >
                      <Play className="size-3 fill-current" />
                      Start browser
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void startLocal()}
                    disabled={busy || localBusy || !address.trim()}
                    className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-tile border border-line bg-surface px-4 text-[13.5px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40"
                  >
                    {localBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Monitor className="size-3.5" />}
                    Use local Chrome
                  </button>
                  <p className="mt-2 max-w-[520px] text-[12px] leading-relaxed text-faint">
                    Runs a separate Chrome window on this computer for local speed and its own saved Google sign-in. The bridge starts with the dev server; you can also run <code className="rounded bg-surface-2 px-1 py-0.5 text-[11px]">node scripts/local-bridge.mjs</code> yourself.
                  </p>
                  {error && status !== 'unconfigured' && status !== 'quota' ? <p role="alert" className="mt-3 rounded-control border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed text-danger">{error}</p> : null}
                  <dl className="mt-6 grid max-w-[520px] gap-4 border-t border-line pt-4 sm:grid-cols-3">
                    {[
                      ['Forms and portals', 'Applications, invoices, checkout.'],
                      ['Research and reading', 'Pages, PDFs, dashboards, long threads.'],
                      ['Repeatable flows', 'Sign in, fill, submit, download.'],
                    ].map(([title, detail]) => (
                      <div key={title}>
                        <dt className="text-[12.5px] font-medium text-fg">{title}</dt>
                        <dd className="mt-1 text-[11.5px] leading-snug text-faint">{detail}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                {showBrowserArt ? (
                  <figure className="order-1 w-[248px] shrink-0 xl:order-2 xl:w-[272px]">
                    <BrandArt variant="landscape" className="w-full" />
                  </figure>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-surface-2/40 px-3 py-2 text-[12px] text-faint">
                <span>Separate Chrome profile</span>
                <span>Native mouse &amp; keyboard input</span>
              </div>
            </div>
          )}
        </section>

        <aside
          id="browser-tasks"
          className="flex w-full shrink-0 scroll-mt-20 flex-col overflow-y-auto border-t border-line bg-bg md:min-h-0 md:w-[320px] md:border-l md:border-t-0 xl:w-[350px] 2xl:w-[370px]"
          aria-label="Browser controls"
        >
          <div className="border-b border-line px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-[19px] font-semibold tracking-[-0.02em]">AI task</h2>
                <p className="mt-1 text-[11.5px] leading-snug text-faint">Tell Ink what to do in the browser on the left.</p>
              </div>
              <button type="button" onClick={() => void refresh()} disabled={!session || busy} aria-label="Refresh page view" className="grid size-7 place-items-center rounded-tile text-faint transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40">
                <RefreshCw className="size-3.5" />
              </button>
            </div>
            <textarea
              value={task}
              onChange={(event) => setTask(event.target.value)}
              data-browser-local-input
              disabled={!session}
              placeholder="e.g. What do I have due today, fill out this form, or compare these two pages"
              rows={3}
              className="mt-3 block w-full resize-none rounded-[10px] border border-line bg-surface px-3.5 py-3 text-[13.5px] leading-relaxed text-fg outline-none placeholder:text-faint focus:border-accent/50 disabled:opacity-50"
            />
            <div className="mt-2 flex items-center gap-2">
              {busy ? (
                <button type="button" onClick={stop} className="inline-flex h-9 items-center gap-1.5 rounded-tile bg-accent px-3.5 text-[12.5px] font-medium text-bg">
                  <Square className="size-3 fill-current" />
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void run()}
                  disabled={!session || !task.trim()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-tile bg-accent px-3.5 text-[12.5px] font-medium text-bg transition-opacity hover:bg-accent-strong disabled:opacity-30"
                >
                  <Play className="size-3 fill-current" />
                  Run
                </button>
              )}
              <span className="text-[11.5px] text-faint">{MAX_ACTIONS} actions max</span>
            </div>
            {error && session ? <p role="alert" className="mt-2 text-[11.5px] leading-relaxed text-danger">{error}</p> : null}
            {busy ? (
              <div aria-live="polite" className="mt-2 flex items-start gap-2 rounded-[8px] bg-surface-2 px-2.5 py-2 text-[11.5px] leading-snug text-muted">
                <Loader2 className="mt-0.5 size-3 shrink-0 animate-spin text-accent" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-fg">{phase || 'Working…'}</span>
                  {stepNumber ? <span className="block text-faint">Step {stepNumber} of {MAX_STEPS}</span> : null}
                </span>
              </div>
            ) : null}
          </div>

          {answer ? (
            <div role="status" aria-live="polite" className="border-b border-line px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">Ink’s answer</p>
                <button
                  type="button"
                  onClick={() => setAnswer('')}
                  aria-label="Dismiss answer"
                  className="grid size-5 place-items-center rounded-[5px] text-faint transition-colors hover:bg-surface-2 hover:text-fg"
                >
                  <X className="size-3" />
                </button>
              </div>
              <p className="mt-1.5 max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-fg">{answer}</p>
            </div>
          ) : null}

          {script ? (
            <div className="border-b border-line px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">Scratchpad</p>
                <button
                  type="button"
                  onClick={() => {
                    setScript('')
                    saveBrowserMemory({ task, plan: agentMemory.current.plan, notes: agentMemory.current.notes, script: '' })
                  }}
                  className="text-[11px] text-faint transition-colors hover:text-fg"
                >
                  Clear
                </button>
              </div>
              <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-[8px] bg-surface-2 p-2 font-mono text-[11px] leading-relaxed text-muted">{script}</pre>
            </div>
          ) : null}

          <div className="border-b border-line px-4 py-2.5">
            <button
              type="button"
              onClick={() => setDevOpen((value) => !value)}
              aria-expanded={devOpen}
              className="flex w-full items-center justify-between gap-2 rounded-tile text-left text-[12.5px] font-medium text-muted transition-colors hover:text-fg"
            >
              <span className="inline-flex items-center gap-1.5">
                <Code2 className="size-3.5 text-accent" />
                Inspect &amp; code
              </span>
              <span className="text-[11.5px] font-normal text-faint">{devOpen ? 'Hide' : 'Open'}</span>
            </button>
            {devOpen ? (
              <div className="mt-2 space-y-2">
                <div className="flex gap-1.5">
                  <input
                    value={selector}
                    onChange={(event) => setSelector(event.target.value)}
                    aria-label="CSS selector to inspect"
                    placeholder="body, #main, .card (blank = whole page)"
                    className="h-8 min-w-0 flex-1 rounded-[7px] border border-line bg-surface px-2 text-[12px] text-fg outline-none placeholder:text-faint focus:border-line-strong"
                  />
                  <button
                    type="button"
                    onClick={() => void inspectElement()}
                    disabled={!session || busy || devBusy}
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[7px] border border-line bg-surface px-2 text-[11.5px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40"
                  >
                    {devBusy ? <Loader2 className="size-3 animate-spin" /> : <Search className="size-3" />}
                    Inspect
                  </button>
                </div>
                {inspection ? (
                  <div className="overflow-hidden rounded-[8px] border border-line bg-surface">
                    <div className="flex items-center justify-between gap-2 border-b border-line px-2 py-1.5 text-[11px]">
                      <span className="truncate font-medium text-fg">
                        {inspection.tag} <span className="font-normal text-faint">{inspection.selector}</span>
                      </span>
                      <span className="shrink-0 text-faint">{inspection.matched} match{inspection.matched === 1 ? '' : 'es'}</span>
                    </div>
                    <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all p-2 font-mono text-[11px] leading-relaxed text-muted">{inspection.html || '(empty)'}</pre>
                    <pre className="max-h-20 overflow-auto whitespace-pre-wrap border-t border-line px-2 py-1.5 font-mono text-[11px] leading-relaxed text-faint">{inspection.styles}</pre>
                  </div>
                ) : (
                  <p className="text-[11.5px] leading-snug text-faint">Inspect an element to see its HTML and computed styles. Ink can use the same inspection when it codes a change.</p>
                )}
                <div className="flex items-center gap-1.5">
                  <select
                    value={codeMode}
                    onChange={(event) => setCodeMode(event.target.value === 'css' ? 'css' : 'javascript')}
                    aria-label="Code language"
                    className="h-8 rounded-[7px] border border-line bg-surface px-1.5 text-[11.5px] text-muted outline-none focus:border-line-strong"
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="css">CSS</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void runCode()}
                    disabled={!session || busy || devBusy || !code.trim()}
                    className="inline-flex h-8 items-center gap-1 rounded-[7px] bg-accent px-2.5 text-[11.5px] font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-30"
                  >
                    <Play className="size-3 fill-current" />
                    Run
                  </button>
                  <span className="text-[11px] text-faint">live page only</span>
                </div>
                <textarea
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  disabled={!session}
                  rows={4}
                  spellCheck={false}
                  placeholder={codeMode === 'css' ? 'body { background: #14532d; color: white; }' : "document.querySelector('h1').textContent = 'Hello'"}
                  className="block w-full resize-y rounded-[8px] border border-line bg-surface px-2 py-2 font-mono text-[11.5px] leading-relaxed text-fg outline-none placeholder:text-faint focus:border-line-strong disabled:opacity-50"
                />
                {devError ? <p role="alert" className="text-[11.5px] leading-snug text-danger">{devError}</p> : null}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <p className="text-[12px] font-medium text-muted">Activity</p>
            <span className="text-[11.5px] text-faint">
              {log.filter((entry) => entry.role === 'action').length} {log.filter((entry) => entry.role === 'action').length === 1 ? 'action' : 'actions'}
            </span>
          </div>
          <div ref={logRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {log.length ? (
              <div className="space-y-3">
                {log.map((entry, index) => (
                  <div key={`${entry.at}-${index}`} className={entry.role === 'you' ? 'text-right' : ''}>
                    <p className={`text-[11.5px] font-semibold uppercase tracking-[0.1em] ${entry.role === 'you' ? 'text-faint' : entry.role === 'error' ? 'text-danger' : entry.role === 'action' ? 'text-accent' : 'text-faint'}`}>
                      {entry.role === 'you' ? 'You' : entry.role === 'stet' ? 'Ink' : entry.role === 'action' ? 'Action' : 'Error'}
                    </p>
                    <p className={`mt-1 whitespace-pre-wrap text-[12px] leading-relaxed ${entry.role === 'you' ? 'inline-block max-w-[92%] rounded-[10px] bg-surface-2 px-3 py-2 text-left text-fg' : entry.role === 'error' ? 'text-danger' : 'text-fg'}`}>{entry.text}</p>
                    {entry.thoughts?.length ? (
                      <div className="mt-1.5 border-l-2 border-line pl-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">Working notes</p>
                        <ol className="mt-1 space-y-1 text-[11.5px] leading-snug text-muted">
                          {entry.thoughts.map((thought, thoughtIndex) => (
                            <li key={`${entry.at}-${thoughtIndex}`} className="flex gap-1.5">
                              <span className="shrink-0 text-accent/80">{thoughtIndex + 1}.</span>
                              <span>{thought}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : entry.thinking ? (
                      <p className="mt-1.5 border-l-2 border-line pl-2 text-[11.5px] italic leading-snug text-faint">
                        <span className="font-medium not-italic text-muted">Thinking: </span>
                        {entry.thinking}
                      </p>
                    ) : null}
                    {entry.detail ? <p className="mt-1 break-all text-[11.5px] leading-snug text-faint">{entry.detail}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Globe2 className="mx-auto size-5 text-faint" />
                <p className="mx-auto mt-2 max-w-[240px] text-[11.5px] leading-relaxed text-faint">Browser actions and working notes will appear here.</p>
              </div>
            )}
          </div>
          <div className="border-t border-line px-4 py-2.5 text-[11.5px] leading-relaxed text-faint">
{session?.sessionId === 'local'
  ? 'Running in your local Chrome. Sign in there once when Google asks; clicks, typing and scrolling use native input.'
  : 'A real Chrome session. Sign in from the live view when a site needs it; clicks, typing and scrolling use native input.'}
          </div>
        </aside>
      </div>
    </main>
  )
}
