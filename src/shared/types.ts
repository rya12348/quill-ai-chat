// Types shared by the Worker (src/worker) and the app (src/app).

export type Role = 'user' | 'assistant'

/** How much reasoning a turn may spend. */
export type ReasoningEffort = 'low' | 'default' | 'max'

/** A named container for related conversations. */
export interface Project {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  conversationCount: number
  /** Added to every reply in chats that belong to this project. */
  instructions?: string
}

export interface Conversation {
  id: string
  title: string
  model: string
  createdAt: number
  updatedAt: number
  projectId: string | null
  /** The single emoji reaction attached to this chat, when set. */
  reaction?: string | null
}

export type FeedbackRating = 'up' | 'down'

/** The condensed memory kept for turns outside the recent-message window. */
export interface ConversationMemory {
  summary: string
  /** Timestamp of the newest message already folded in. */
  coveredThrough: number
  updatedAt: number
}

/** Files a person can attach to one message. */
export type AttachmentKind = 'image' | 'text'

/** An attachment as the browser sends it to the Worker. */
export interface AttachmentInput {
  name: string
  mime: string
  size: number
  kind: AttachmentKind
  /** Base64 image data URL for images; decoded text for text files. */
  data: string
  /** A small browser-generated image preview, kept out of the prompt. */
  thumbnail?: string
}

/** Attachment metadata stored with a message. Image bytes stay on the server. */
export interface MessageAttachment {
  id: string
  name: string
  mime: string
  size: number
  kind: AttachmentKind
  /** Set for images (served bytes) and links (the attached web address). */
  url?: string
  /** A smaller image representation; falls back to url for older attachments. */
  thumbnailUrl?: string
  /** Authenticated route that returns the original stored file. */
  downloadUrl?: string
}

export interface Source {
  title: string
  url: string
  snippet?: string
  /** Publication/update time when the source exposed one. */
  publishedAt?: number
}

export type ProofStatus = 'checking' | 'verified' | 'warning' | 'failed' | 'unverified'
export type ProofCheckStatus = 'pass' | 'fail' | 'unknown'
export type ProofKind = 'code' | 'math' | 'research' | 'structured' | 'general'

/** One check Proof ran (or could not run) for a reply. */
export interface ProofCheck {
  id: string
  label: string
  status: ProofCheckStatus
  critical: boolean
  /** A short, user-safe explanation. No stdout, page bodies or secrets. */
  detail?: string
}

/** What Proof actually checked. This replaces a model-reported confidence. */
export interface ProofInfo {
  status: ProofStatus
  kind: ProofKind
  checks: ProofCheck[]
  /** Candidate rounds used, including repairs. */
  attempts: number
  /** Candidate artifacts considered. */
  candidates: number
  /** Tests were checked against deliberately wrong implementations. */
  mutants: { total: number; killed: number } | null
  /** Display names only, never keys. */
  models: string[]
  asOf: number
  /** Why the outcome is unverified or failed, in a few words. */
  reason?: string
}

export type ResearchClaimStatus = 'supported' | 'single-source' | 'unsupported'

/** One key finding in a research report, with the sources it cites. */
export interface ResearchClaim {
  id: string
  text: string
  sourceUrls: string[]
  status: ResearchClaimStatus
}

/** What Research checked for one reply. Citations, not universal truth. */
export interface ResearchInfo {
  status: ProofStatus
  question: string
  queries: string[]
  /** URLs in citation order; [1] is sourceOrder[0]. */
  sourceOrder: string[]
  claims: ResearchClaim[]
  counts: { sources: number; supported: number; singleSource: number; unsupported: number; conflicts: number }
  models: string[]
  asOf: number
  reason?: string
  /** True when this is a document written from general knowledge, not a report. */
  document?: boolean
}

/** A profile of a dataset. The rows stay in the browser; only this shape is sent. */
export interface DatasetInput {
  id: string
  name: string
  mime: string
  size: number
  rows: number
  columns: string[]
  /** Header plus a small number of rows; never the whole file. */
  sample: string
}

export type AnalysisStatus = 'checking' | 'verified' | 'warning' | 'failed' | 'unverified'

/** What the browser's Python runner did for one Analyze reply. */
export interface AnalysisInfo {
  status: AnalysisStatus
  question: string
  /** The browser-local dataset handle used to rerun the same code. */
  datasetId: string
  fileName: string
  /** The generated Python source, shown to the reader for inspection. */
  code: string
  /** Captured stdout, when the code printed something. */
  stdout?: string
  /** A PNG data URL, when the code drew a chart. */
  chart?: string
  /** A short, user-safe execution error. */
  error?: string
  rows: number
  columns: string[]
  models: string[]
  asOf: number
  reason?: string
}

/** The browser runs this job; the Worker never executes generated code. */
export type AnalysisJob = {
  messageId: string
  question: string
  code: string
  datasetId: string
}

/** One executed action in a Buffy Code agent-mode turn. */
export interface TaskStep {
  tool: string
  /** A person-readable one-liner, such as `run_command: npm test`. */
  label: string
  status: 'done' | 'error'
  /** Trimmed output, for the timeline. */
  detail: string
  ms: number
  call: number
}

/** The sandbox reports what happened when it ran the analysis code. */
export type AnalysisRunResult = {
  ok: boolean
  stdout?: string
  chart?: string
  error?: string
  loadError?: string
}

/** One document of a multi-page build, already secured for the preview. */
export interface BuildPage {
  /** The file name, such as index.html or menu.html. */
  name: string
  html: string
}

/** One deterministic check on a generated page. */
export type BuildCheckStatus = 'pass' | 'warn' | 'fail'

export interface BuildCheck {
  id: string
  label: string
  status: BuildCheckStatus
  detail?: string
}

/** The result of running page checks and an independent review on a build. */
export interface BuildVerification {
  status: 'verified' | 'warning'
  checks: BuildCheck[]
  /** The independent reviewer, when one returned a usable verdict. */
  reviewer?: string
  /** A repair pass changed the selected draft. */
  repaired: boolean
  /** A compact spec was produced before the draft. */
  spec: boolean
  score: number
  asOf: number
}

/** A generated page, or a live site shown through the preview proxy. */
export interface BuildInfo {
  /** The multi-file workspace behind this project, when it has one. */
  files?: { path: string; content: string }[]
  status: 'ready' | 'warning'
  /** A self-contained page, a live page fetched through the proxy, or an agent task. */
  kind?: 'page' | 'embed' | 'task'
  /**
   * Agent mode: what it did, in order. A task result carries these instead of a
   * page, which is why `kind: 'task'` never has to pretend to be a website.
   */
  steps?: TaskStep[]
  title: string
  /** The generated document. For a live site this is a small download note. */
  html: string
  /** The extra documents of a multi-page site; html is always the first page. */
  pages?: BuildPage[]
  /** The original address of a live-site preview. */
  sourceUrl?: string
  /** Token-scoped, same-origin URL that serves the live page. */
  proxyUrl?: string
  /** A game or tool whose scripts should start as soon as it renders. */
  interactive?: boolean
  /** What a real build/test run in the sandbox reported, when one was configured. */
  sandbox?: {
    status: 'pass' | 'fail' | 'error' | 'skipped'
    command: string
    output: string
    exitCode: number | null
    durationMs: number
    reason?: string
  }
  models: string[]
  asOf: number
  reason?: string
  /** What the quality loop actually checked before showing the page. */
  verification?: BuildVerification
}

/** A standalone Web Proxy session, backed by a token-scoped capability. */
export interface ProxySession {
  /** The public page after redirects. */
  url: string
  title: string
  /** Same-origin path that serves the live page through the proxy. */
  proxyPath: string
}

/** A page element the Browser agent can address without guessing a selector. */
export interface BrowserElement {
  /** Short-lived id assigned by the bridge during the last snapshot. */
  id: string
  tag: string
  role: string
  label: string
  value?: string
  placeholder?: string
  /** HTML input type, so buttons are not mistaken for editable fields. */
  inputType?: string
  href?: string
  /** Visible choices for a native select, so arbitrary forms can be filled. */
  options?: { label: string; value: string }[]
  checked?: boolean
  required?: boolean
  disabled?: boolean
  /** A native select or ARIA combobox is currently open. */
  expanded?: boolean
  /** The list a combobox controls, when the page exposes it. */
  ariaControls?: string
  /** Browser autocomplete hint, such as email, street-address or off. */
  autocomplete?: string
  /** True when the element is in the document but outside the current viewport. */
  offscreen?: boolean
  rect: { x: number; y: number; width: number; height: number }
}

/** A video or audio element the planner can wait on without polling a model. */
export interface BrowserMedia {
  kind: 'video' | 'audio'
  duration: number
  currentTime: number
  paused: boolean
  ended: boolean
}

/** The compact, untrusted page state sent to the Browser planner. */
export interface BrowserSnapshot {
  url: string
  title: string
  text: string
  viewport: { width: number; height: number; scrollX: number; scrollY: number; pageHeight: number }
  active: string
  elements: BrowserElement[]
  media: BrowserMedia[]
  /** Visible headings give the planner a cheap map of the page sections. */
  headings?: { level: number; text: string }[]
  /** Embedded documents that may hold the real task, such as an LMS player. */
  frames?: { url: string; title: string; visible: boolean; rect: { x: number; y: number; width: number; height: number } }[]
  at: number
}

/** What an inspect step learned about one page element, or the whole page. */
export interface BrowserInspectResult {
  selector: string
  tag: string
  matched: number
  html: string
  text: string
  styles: string
}

/** One screen of a cloud browser session, shown inside the Browser workspace. */
export interface BrowserViewState {
  url: string
  title: string
  screenshot?: string
  snapshot: BrowserSnapshot
  /** Present after an inspect step so the next planner step can use it. */
  inspect?: BrowserInspectResult
  /** Result of the last code/inspection action, for the agent to reason from. */
  observation?: string
}

export interface BrowserInspectResponse {
  state: BrowserViewState
  inspect: BrowserInspectResult
}

/** One instruction the cloud browser can execute against the live page. */
export type BrowserAction =
  | { type: 'click'; x?: number; y?: number; selector?: string }
  | { type: 'findLink'; text: string }
  | { type: 'hover'; x?: number; y?: number; selector?: string }
  | { type: 'drag'; fromSelector: string; toSelector: string }
  | { type: 'focus'; selector: string }
  | { type: 'type'; text: string; selector?: string; submit?: boolean }
  | { type: 'fill'; fields: { selector: string; value: string }[]; submit?: boolean }
  | { type: 'select'; selector: string; value: string }
  | { type: 'check'; selector: string; checked: boolean }
  | { type: 'press'; key: string; modifiers?: ('Alt' | 'Ctrl' | 'Meta' | 'Shift')[] }
  | { type: 'scroll'; x?: number; y?: number }
  | { type: 'navigate'; url: string }
  | { type: 'back' }
  | { type: 'forward' }
  | { type: 'reload' }
  | { type: 'wait'; ms: number }
  | { type: 'waitFor'; selector?: string; text?: string; state?: 'visible' | 'hidden' | 'ended' | 'attention' | 'time'; timeoutMs?: number }
  | { type: 'questionLoop'; answers: { question: string; answer: string }[]; timeoutMs?: number }
  | { type: 'inspect'; selector?: string }
  | { type: 'screenshot' }
  | { type: 'style'; css: string }
  | { type: 'evaluate'; expression: string }
  | { type: 'ask'; message: string }
  | { type: 'done'; message: string }

export interface BrowserHistoryEntry {
  action: string
  result: string
}

export interface BrowserActResponse {
  say: string
  /** A short, user-visible reason for choosing the next action. */
  thinking?: string
  /** Concrete observations and working notes for the current step. */
  thoughts?: string[]
  /** The agent's current short plan for the task. */
  plan?: string[]
  /** A durable working note the agent wants to carry into later steps. */
  note?: string
  /** The last script the agent wrote and ran, kept on its scratchpad. */
  script?: string
  /** True when the planner believes this action completes the task. */
  complete?: boolean
  action: BrowserAction
  lane?: string
}

/** One real browser tab in the cloud browser. */
export interface BrowserTab {
  id: string
  title: string
  url: string
  active: boolean
}

/** The live cloud browser created for the signed-in person. */
export interface BrowserSessionResponse {
  sessionId: string
  expiresAt?: number
  /** Provider-hosted interactive viewer, used for the low-latency live pane. */
  liveUrl?: string
  /**
   * The shape of the streamed screen, when it is not the page's own viewport.
   *
   * A headful session streams its whole window, chrome included, so the pane has
   * to keep the window's aspect or every pointer lands somewhere else.
   */
  window?: { width: number; height: number }
  state: BrowserViewState
}

/** A same-origin screen capture of the remote browser. */
export interface BrowserScreen {
  image: string
  url: string
  title: string
  viewport: { width: number; height: number }
  at: number
}

/** The result of the one-call document writer. */
export interface BrowserWriteResponse {
  state: BrowserViewState
  words: number
  lane?: string
}

/** One flashcard in a Canvas deck. */
export interface CanvasCard {
  front: string
  back: string
}

/** One multiple-choice question. `answer` indexes `choices`. */
export interface CanvasQuestion {
  question: string
  choices: string[]
  answer: number
  explanation?: string
}

/** A study set generated by Canvas mode: a flashcard deck or a practice quiz. */
export interface CanvasInfo {
  status: 'ready' | 'warning'
  kind: 'flashcards' | 'quiz'
  title: string
  cards?: CanvasCard[]
  questions?: CanvasQuestion[]
  models: string[]
  asOf: number
  reason?: string
}

/** A flashcard's Smart Review schedule. A zero interval means it is new. */
export interface ReviewSchedule {
  intervalDays: number
  ease: number
  repetitions: number
  lapses: number
}

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

/** One due flashcard, joined to the saved deck that owns it. */
export interface ReviewCard extends ReviewSchedule {
  messageId: string
  cardIndex: number
  front: string
  back: string
  deckTitle: string
  conversationId: string
  conversationTitle: string
  dueAt: number
}

export interface ReviewSummary {
  due: number
  total: number
  reviewedToday: number
  nextDueAt: number | null
}

export interface ReviewQueue {
  items: ReviewCard[]
  totalDue: number
  deckTitle?: string
}

export interface ReviewRatingResult extends ReviewSchedule {
  dueAt: number
  summary: ReviewSummary
}

/** A saved Build, Analyze, Canvas or Research result, as the library index reports it. */
export type ArtifactKind = 'build' | 'analysis' | 'canvas' | 'research'
export type ArtifactStatus = 'ready' | 'warning' | 'checking' | 'verified' | 'failed' | 'unverified'
export interface ArtifactSummary {
  messageId: string
  conversationId: string
  conversationTitle: string
  kind: ArtifactKind
  title: string
  detail: string
  status: ArtifactStatus
  createdAt: number
  /** Kept at the top of the library by the person who made it. */
  pinned?: boolean
  /** The project of the chat that produced it, when it has one. */
  projectId?: string | null
}

/** The browser runs this job; the Worker never executes generated code. */
export type ProofCandidate = { label: string; code: string; text: string }

export type ProofJob = {
  messageId: string
  round: number
  question: string
  tests: string
  candidates: ProofCandidate[]
  mutants: string[]
  models: string[]
}

export type ProofRun = { target: 'candidate' | 'mutant'; index: number; ok: boolean; error?: string }
export type ProofRunReport = { runs: ProofRun[]; loadError?: string }

export type TeamConfidence = 'high' | 'medium' | 'low'

/** What the free team did for one reply. Display names only, never keys. */
export interface TeamInfo {
  /** The drafters, the referee and the verifier. */
  models: string[]
  /** How many independent drafts reached the referee. */
  drafts: number
  /** The referee produced a usable review. */
  reviewed: boolean
  /** The lanes whose drafts reached the referee, in selection order. */
  drafters?: string[]
  /** The lane that planned, merged and repaired the final answer. */
  referee?: string
  /** The independent lane that checked the finished answer. */
  verifier?: string
  /** A second strong model checked the final answer. */
  verified?: boolean
  /** The verifier flagged a defect and the referee attempted a repair. */
  repaired?: boolean
  confidence: TeamConfidence
}

export type AgentTool = 'research' | 'build' | 'canvas' | 'proof' | 'answer'
export type AgentStepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'failed'

/** One planned step of an Agent run. */
export interface AgentStep {
  id: string
  tool: AgentTool
  title: string
  /** The self-contained task given to this tool. */
  instruction: string
  status: AgentStepStatus
  startedAt?: number
  finishedAt?: number
  /** Model display name used for this step, when it ran. */
  model?: string
  /** A short result note, such as "5 sources · 4 supported". */
  detail?: string
  /** The saved reply that carries this step's artifact. */
  artifactMessageId?: string
}

/** The plan, progress and receipt of one Agent run. */
export interface AgentInfo {
  goal: string
  status: 'planning' | 'running' | 'done' | 'partial' | 'failed'
  steps: AgentStep[]
  /** Plain-language summary of what actually happened. */
  receipt: string
  /** Display names only, never keys. */
  models: string[]
  asOf: number
  reason?: string
}

export interface Message {
  id: string
  conversationId: string
  role: Role
  content: string
  model: string | null
  /** True when generation stopped before the model finished. */
  interrupted: boolean
  createdAt: number
  /** Reasoning the model exposed before its answer. */
  reasoning?: string
  /** How long the model reasoned before the first answer token, in ms. */
  reasoningMs?: number
  /** Web results retrieved for this reply, when search ran. */
  sources?: Source[]
  /** The free team's check, when Team mode produced this reply. */
  team?: TeamInfo
  /** What Proof checked for this reply, when Proof mode produced it. */
  proof?: ProofInfo
  /** What Research checked for this reply, when Research mode produced it. */
  research?: ResearchInfo
  /** What the browser ran for this reply, when Analyze mode produced it. */
  analysis?: AnalysisInfo
  /** The generated page, when Build mode produced it. */
  build?: BuildInfo
  /** The generated study set, when Canvas mode produced it. */
  canvas?: CanvasInfo
  /** The orchestrated run, when Agent mode produced this reply. */
  agent?: AgentInfo
  /** The person's rating of this reply. */
  feedback?: FeedbackRating
  /** Files the person attached to this user message. */
  attachments?: MessageAttachment[]
}

export interface UserSettings {
  instructions: string
}

/** A message in a public, read-only shared conversation. No ids or feedback. */
export interface SharedMessage {
  role: Role
  content: string
  model: string | null
  modelName?: string
  interrupted: boolean
  createdAt: number
  reasoning?: string
  reasoningMs?: number
  sources?: Source[]
  team?: TeamInfo
  proof?: ProofInfo
  research?: ResearchInfo
  analysis?: AnalysisInfo
  build?: BuildInfo
  canvas?: CanvasInfo
  agent?: AgentInfo
  attachments?: MessageAttachment[]
}

/** The only conversation data a share token exposes. */
export interface SharedConversation {
  title: string
  model: string
  modelName?: string
  createdAt: number
  updatedAt: number
  messages: SharedMessage[]
}

export type ProviderStatus = 'healthy' | 'degraded' | 'down' | 'unknown'

export type LaneBilling = 'free' | 'paid' | 'trial' | 'local'

/** The persisted health of one provider, as GET /api/providers reports it. */
export interface ProviderHealth {
  id: string
  name: string
  description: string
  /** The model id this provider serves, when it is one free lane. */
  model?: string
  /** The model family this lane belongs to, e.g. "Nemotron" or "GPT". */
  family?: string
  /** Whether this route is free, paid, trial credit or local. */
  billing?: LaneBilling
  status: ProviderStatus
  lastSuccessAt: number | null
  lastFailureAt: number | null
  lastError: string | null
  lastErrorCode: string | null
  latencyMs: number | null
  consecutiveFailures: number
  lastCheckedAt: number | null
  /** The earliest time an automatic probe may run again (persisted backoff). */
  nextProbeAt: number | null
}

export interface ModelInfo {
  id: string
  name: string
  description: string
  /** Whether the Freebuff API currently offers this model. */
  available: boolean
  /** One row per family in the picker: every provider of it shares this name. */
  family?: string
  /** True when routes for this family may spend paid credits. */
  billing?: LaneBilling
  /** Capability score; the picker lists strongest first. */
  strength?: number
}

/** One free mode's daily allowance, as GET /api/me reports it. */
export interface ModeUsage {
  used: number
  limit: number
  /** The server has lifted this mode's daily cap for the owner. */
  unlimited?: boolean
}

/** The shared daily reply allowance. */
export interface ReplyUsage {
  used: number
  limit: number
  resetsAt: number
}

export interface Me {
  user: { sub: string; name?: string; email?: string; picture?: string }
  capabilities: {
    /** An API key is configured on the server. Never the key itself. */
    ai: boolean
    /** api: the Freebuff API key answers. public: the free hosted lane answers. */
    mode: 'api' | 'public'
    /** The model answering on the free hosted lane, when mode is 'public'. */
    model?: string
    /** Web search is configured and runs automatically for current-facts questions. */
    search: boolean
    /** A free lane accepts an explicit reasoning effort. */
    reasoning: boolean
    /** The free-only Research mode is enabled for this deployment. */
    research: boolean
    /** The free-only Analyze mode is enabled for this deployment. */
    analyze: boolean
    /** The free-only Build mode is enabled for this deployment. */
    build: boolean
    /** Canvas (flashcards and quizzes) is available on the free hosted models. */
    canvas: boolean
    /** Agent can plan and run the free-mode tools on this deployment. */
    agent: boolean
    database: boolean
    auth: 'account' | 'freebuff' | 'development' | 'guest'
  }
  usage: ReplyUsage & {
    /** The separate free-mode caps, so a mode's remaining allowance is known before sending. */
    modes: { research: ModeUsage; analyze: ModeUsage; build: ModeUsage }
  }
}

/** Server-sent events on POST /api/chat. */
export type ChatEvent =
  | { type: 'start'; conversation: Conversation; userMessage: Message; assistantMessageId: string }
  | { type: 'reasoning'; text: string }
  | { type: 'sources'; sources: Source[] }
  | { type: 'delta'; text: string }
  | { type: 'status'; text: string }
  | { type: 'team'; team: TeamInfo }
  | { type: 'proof'; proof: ProofInfo; job?: ProofJob }
  | { type: 'research'; research: ResearchInfo }
  | { type: 'analysis'; analysis: AnalysisInfo; job?: AnalysisJob }
  | { type: 'build'; build: BuildInfo }
  | { type: 'canvas'; canvas: CanvasInfo }
  | { type: 'agent'; agent: AgentInfo }
  | { type: 'notice'; text: string }
  | { type: 'done'; message: Message; usage: Me['usage'] }
  | { type: 'error'; code: string; message: string }

export type HumanizerTone = 'natural' | 'casual' | 'professional' | 'warm'
export type HumanizerStrength = 'light' | 'balanced' | 'full'
export type HumanizerPurpose = 'auto' | 'email' | 'social' | 'essay' | 'note'
export type HumanizerLength = 'same' | 'tighter'

/** A one-off style edit. The original draft is never returned or stored. */
export interface HumanizerResult {
  text: string
  tone: HumanizerTone
  strength: HumanizerStrength
  notice?: string
}

export type RoomVisibility = 'public' | 'private'

/** One room in the chat catalog. Password hashes never leave the Worker. */
export interface RoomSummary {
  id: string
  name: string
  visibility: RoomVisibility
  createdAt: number
  /** True when this account created the room. */
  createdByMe: boolean
  /** Public rooms are always open; private rooms open after a password or invite. */
  unlocked: boolean
  /** True when this account joined through an invite link rather than the password. */
  invited?: boolean
}

/** The rooms shown when chat opens: private rooms first, then public rooms. */
export interface RoomList {
  items: RoomSummary[]
  defaultRoomId: string
}

/** One person in the durable Ink directory. */
export interface RoomPerson {
  /** Public, stable Ink tag shown under the person's name. */
  id: string
  /** Current chat name, including a name the person changed. */
  name: string
  guest: boolean
  online: boolean
  /** Whether the viewer saved this person for quick room invites. */
  saved: boolean
  /** True when the viewer gave this person a private nickname. */
  renamed?: boolean
  /** The person's own chat name, so a rename can still be searched or reset. */
  originalName?: string
}

/** Everyone Ink has seen, available for direct room invitations. */
export interface RoomPeople {
  items: RoomPerson[]
  asOf: number
}

/** An unseen direct invitation to a private room. */
export interface RoomInvite {
  roomId: string
  roomName: string
  invitedAt: number
  inviterName: string
}

export interface RoomInvites {
  items: RoomInvite[]
  asOf: number
}

/** One emoji reaction attached to a room message. */
export interface RoomReaction {
  reaction: string
  count: number
  /** Whether the person reading this snapshot added that reaction. */
  mine: boolean
}

/** A message in a room. */
export interface RoomMessage {
  id: string
  room: string
  body: string
  /** Images, files and links shared with the room. */
  attachments?: MessageAttachment[]
  /** Reactions from everyone in the room, grouped by emoji. */
  reactions?: RoomReaction[]
  authorName: string
  /** A short one-way tag; the account id is never sent to the browser. */
  authorId: string
  /** A subtle owner marker; never sent for ordinary room members. */
  authorOwner?: boolean
  createdAt: number
}

/** The authoritative snapshot fetched before and after realtime connects. */
export interface RoomSnapshot {
  room: string
  name: string
  visibility: RoomVisibility
  createdByMe: boolean
  messages: RoomMessage[]
  /** Lets the browser label its own messages without exposing account ids. */
  viewerId: string
  /** The current name this person's messages show to everyone in the room. */
  viewerName: string
  /** Whether the reader's own name should carry the owner marker. */
  viewerOwner?: boolean
  asOf: number
}

/** The name shown beside a person's room messages. */
export interface RoomProfile {
  name: string
  viewerId: string
  /** Set when the name applies to another person in the room. */
  targetId?: string
}

/** A new message in a room this account can access. */
export interface RoomActivityItem extends RoomMessage {
  roomName: string
}

/** Recent room activity for notifications outside the open room. */
export interface RoomActivity {
  items: RoomActivityItem[]
  asOf: number
}

/** One UTC day of aggregate traffic. No individual visitor is exposed. */
export interface TrafficDay {
  day: string
  visitors: number
  views: number
}

export interface TrafficPage {
  path: string
  visitors: number
  views: number
}

export interface TrafficSummary {
  today: { visitors: number; views: number }
  /**
   * The last 7 UTC days. `returning` counts visitors in the window whose first
   * visit predates it (they came back unprompted); `retained` counts those also
   * seen in the 7 days before the window.
   */
  last7Days: { visitors: number; views: number; returning: number; retained: number }
  allTime: { visitors: number; views: number }
  days: TrafficDay[]
  topPages: TrafficPage[]
  updatedAt: number
}
