import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { Bot, Brain, ClipboardList, Compass, Download, FileSpreadsheet, FileText, Folder, FolderX, Globe2, Hammer, Layers, Menu as MenuIcon, MessageCircle, Monitor, Search, Share2, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react'

import { CHAT_REACTIONS, DEFAULT_MODEL, MAX_ATTACHMENTS, MAX_ATTACHMENT_TOTAL_BYTES, MAX_CONTEXT_MESSAGES, MODELS, SUGGESTIONS } from '../../shared/config'
import { modelDisplayName } from '../../shared/model-display'
import { estimateConversationTokens, estimateTokens } from '../../shared/tokens'
import { suggestToolMode, type SuggestedToolMode } from '../../shared/agent'
import type { Conversation, Message, ModeUsage, ReasoningEffort } from '../../shared/types'
import { BrandArt } from '../components/BrandArt'
import { Composer, type ComposerToggle } from '../components/Composer'
import { AssistantMessage, UserMessage } from '../components/Message'
import { MemoryPanel } from '../components/MemoryPanel'
import { Mark, useMobileNav } from '../components/Shell'
import { ShareDialog } from '../components/ShareDialog'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button, Dialog, Menu, Spinner, useToast } from '../components/ui'
import { ApiError, useConversation, useMe, useMessageFeedback, useModels, useProjects, useProviders, useReviewSummary, useSetConversationModel, useSetConversationProject, useSetConversationReaction } from '../lib/api'
import { cx } from '../lib/cx'
import { untilLabel } from '../lib/format'
import { resolvePresetModel, type ModelChoice, type ModelPreset } from '../lib/model-presets'
import { AttachmentError, clipboardFiles, readAttachment, type PendingAttachment } from '../lib/attachments'
import { briefFromConversation } from '../lib/buffy-brief'
import { buildDataset, isDataFile, readDataFile } from '../lib/dataset'
import { getDataset, putDataset } from '../lib/dataset-store'
import { checkConnection } from '../lib/offline'
import { draftKey, readDraft, takeLegacyPendingMessage, writeDraft } from '../lib/outbox'
import { dismissTurn, refreshConversationTitle, settleAnalysis, startTurn, useTurn } from '../lib/turn'

// Versioned so the new mid-list default reaches people who had the old first model saved.
const MODEL_KEY = 'model:v2'
const MODEL_PRESET_KEY = 'model:preset:v2'
const EFFORT_KEY = 'effort:level'

type TaskId = 'advisor' | 'agent' | 'research' | 'analyze' | 'build' | 'canvas'

const TASK_MODE_PREFIX = 'stet:task-mode:'

const CHAT_PLACEHOLDER_PROMPTS = [
  'Summarize this document in five bullets',
  'Compare two vendors and cite the sources',
  'Turn these notes into a project brief',
  'Build a one-page site for my idea',
  'Make flashcards from this chapter',
  'Chart the trend in this spreadsheet',
]

const MODE_SUGGESTION_COPY: Record<SuggestedToolMode, { label: string; title: string; description: string; icon: LucideIcon }> = {
  research: {
    label: 'Research',
    title: 'Want sources for this?',
    description: 'Research mode searches the web and cites its findings.',
    icon: Search,
  },
  analyze: {
    label: 'Analyze',
    title: 'Want to analyze the data?',
    description: 'Analyze mode runs Python on a CSV, TSV or XLSX file.',
    icon: FileSpreadsheet,
  },
  build: {
    label: 'Build',
    title: 'Want this built?',
    description: 'Build mode makes the page, tool or app.',
    icon: Hammer,
  },
  canvas: {
    label: 'Study',
    title: 'Want this as a study set?',
    description: 'Study mode turns your request into flashcards or a quiz.',
    icon: Layers,
  },
  agent: {
    label: 'Agent',
    title: 'Want this handled end to end?',
    description: 'Agent mode plans the steps and uses the right tools.',
    icon: Bot,
  },
  advisor: {
    label: 'Advisor',
    title: 'Want a decision brief?',
    description: 'Advisor mode weighs the options and makes a recommendation.',
    icon: Compass,
  },
  proof: {
    label: 'Proof',
    title: 'Want this checked?',
    description: 'Proof mode verifies code, math and dates before you rely on it.',
    icon: ShieldCheck,
  },
}

function readTaskMode(id: string | undefined): TaskId | null {
  if (!id || typeof localStorage === 'undefined') return null
  try {
    const value = localStorage.getItem(`${TASK_MODE_PREFIX}${id}`)
    return value === 'advisor' || value === 'agent' || value === 'research' || value === 'analyze' || value === 'build' || value === 'canvas' ? value : null
  } catch {
    return null
  }
}

function writeTaskMode(id: string | undefined, mode: TaskId | null) {
  if (!id || typeof localStorage === 'undefined') return
  try {
    if (mode) localStorage.setItem(`${TASK_MODE_PREFIX}${id}`, mode)
    else localStorage.removeItem(`${TASK_MODE_PREFIX}${id}`)
  } catch {
    /* storage can be unavailable; the mode still works for this visit */
  }
}

export function Chat() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const selectedProjectId = searchParams.get('project')
  const navigate = useNavigate()
  const client = useQueryClient()
  const toast = useToast()
  const { data: me } = useMe()
  const { data: models } = useModels()
  const { data: health } = useProviders()
  const turn = useTurn()
  // While a reply is streaming, startTurn owns the cache. Once the chat is
  // idle, poll the saved conversation so another tab or device appears without
  // a manual browser reload.
  const page = useConversation(id, { refetchInterval: turn ? false : 4_000 })
  const { data: projectData } = useProjects()
  const projects = projectData?.items ?? []
  const setConversationModel = useSetConversationModel()
  const setConversationProject = useSetConversationProject()
  const feedback = useMessageFeedback()
  const draftStoreKey = draftKey(id)
  const [draft, setDraft] = useState(() => readDraft(draftStoreKey) || takeLegacyPendingMessage(id) || '')
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [filePickerRequest, setFilePickerRequest] = useState(0)
  const [composerFocusRequest, setComposerFocusRequest] = useState(0)
  const [newModel, setNewModel] = useState(() => localStorage.getItem(MODEL_KEY) ?? DEFAULT_MODEL)
  // A just-picked model must win over the conversation row until the
  // set-model mutation refreshes it. Without this, selecting Gemini in an
  // existing chat could still send the previous model while the pill already
  // showed Gemini.
  const [modelOverride, setModelOverride] = useState<string | null>(null)
  const [modelPreset, setModelPreset] = useState<ModelChoice>(() => {
    const saved = localStorage.getItem(MODEL_PRESET_KEY)
    return saved === 'auto' || saved === 'fast' || saved === 'best' || saved === 'manual' ? saved : 'manual'
  })
  // Switching conversations abandons the local picker override; the stored
  // conversation model becomes the source of truth again.
  useEffect(() => setModelOverride(null), [id])
  // A new chat starts in plain Chat only. Modes are opt-in, and a mode chosen
  // in one conversation should not silently carry into the next new chat.
  const [proof, setProof] = useState(() => Boolean(id) && localStorage.getItem('proof') === 'on')
  const [blend, setBlend] = useState(() => Boolean(id) && localStorage.getItem('blend') === 'on')
  // A task mode belongs to one conversation. It is saved under that chat's id
  // so a reload keeps a Build/Study/Research follow-up, but opening another
  // chat can never inherit the previous chat's mode and spend its allowance.
  const [taskMode, setTaskMode] = useState<TaskId | null>(() => readTaskMode(id))
  const research = taskMode === 'research'
  const analyze = taskMode === 'analyze'
  const build = taskMode === 'build'
  const canvas = taskMode === 'canvas'
  const agentMode = taskMode === 'agent'
  const advisorOn = taskMode === 'advisor'
  const [effort, setEffort] = useState<ReasoningEffort>(() => {
    const saved = localStorage.getItem(EFFORT_KEY)
    return saved === 'low' || saved === 'default' || saved === 'max' ? saved : 'default'
  })
  const [shareOpen, setShareOpen] = useState(false)
  const [toolPrompt, setToolPrompt] = useState<{ content: string; mode: SuggestedToolMode } | null>(null)
  const [queuedToolSend, setQueuedToolSend] = useState<{ content: string; mode: SuggestedToolMode } | null>(null)
  const skipToolSuggestion = useRef(false)
  const queuedSendActive = useRef(false)
  const sendingKey = useRef<string | null>(null)
  const failedSend = useRef<{
    clientMessageId: string
    content: string
    conversationId: string | undefined
    projectId: string | undefined
    model: string
    strategy: string
    effort: ReasoningEffort
    attachmentKey: string
  } | null>(null)
  // The conversation this page created from "/", so it keeps showing the
  // reply during the moment between the server naming it and the URL changing.
  const owned = useRef<string | null>(null)
  const lastConversationId = useRef(id)
  useEffect(() => {
    const changed = lastConversationId.current !== id
    lastConversationId.current = id
    if (id) {
      if (changed) setTaskMode(readTaskMode(id))
      return
    }
    // Landing on a fresh chat is always Chat only, even if the previous chat
    // used Deep, Proof, Build or another mode.
    setTaskMode(null)
    setProof(false)
    setBlend(false)
    try {
      localStorage.setItem('proof', 'off')
      localStorage.setItem('blend', 'off')
    } catch {
      /* storage can be unavailable; the in-memory state is still Chat only */
    }
  }, [id])
  const draftKeyRef = useRef(draftStoreKey)
  useEffect(() => {
    if (draftKeyRef.current === draftStoreKey) return
    draftKeyRef.current = draftStoreKey
    setDraft(readDraft(draftStoreKey) || takeLegacyPendingMessage(id) || '')
  }, [draftStoreKey, id])
  useEffect(() => {
    writeDraft(draftKeyRef.current, draft)
  }, [draft])
  // A remix from the Library opens a new chat with its instruction already in
  // the composer, so it can be edited before it is sent.
  const location = useLocation()
  const remixDraft = (location.state as { remixDraft?: unknown } | null)?.remixDraft
  useEffect(() => {
    if (typeof remixDraft !== 'string' || !remixDraft.trim()) return
    setDraft(remixDraft)
    navigate(location.pathname + location.search, { replace: true, state: null })
  }, [remixDraft, location.pathname, location.search, navigate])
  useEffect(() => {
    setAttachments([])
  }, [draftStoreKey])
  // The slider uses a fresh key so the new control starts at Default once, then
  // remembers changes. Clear the old Team, Think and segmented-Effort switches
  // so they cannot keep influencing a later send invisibly.
  useEffect(() => {
    localStorage.setItem(EFFORT_KEY, effort)
    localStorage.removeItem('effort')
    localStorage.removeItem('team')
    localStorage.removeItem('think')
  }, [effort])

  const openCreated = useCallback(
    (created: Conversation) => {
      // A task chosen on Home belongs to the conversation it creates. Store it
      // under that id before navigation so a remount restores the same mode.
      if (taskMode) writeTaskMode(created.id, taskMode)
      owned.current = created.id
      const projectQuery = selectedProjectId ? `?project=${encodeURIComponent(selectedProjectId)}` : ''
      navigate(`/c/${created.id}${projectQuery}`, { replace: true })
      void client.invalidateQueries({ queryKey: ['projects'] })
    },
    [client, navigate, selectedProjectId, taskMode],
  )

  const conversation = page.data?.conversation
  const currentProject = conversation?.projectId ? projects.find((project) => project.id === conversation.projectId) : undefined
  const saved = page.data?.messages ?? []
  const availableModels = models?.items ?? MODELS.map((m) => ({ ...m, available: true }))
  // `/api/models` can include a useful disabled row (for example DeepSeek 4.1
  // before a provider key is added). Never send a disabled id to the server.
  const usableModels = availableModels.filter((model) => model.available)
  // Presets should not send people to a lane whose last check failed. The
  // picker has the same health data; this keeps the resolved id in step with it.
  const healthyModels = health
    ? usableModels.filter((candidate) => {
        const lanes = health.items.filter((item) => item.model === candidate.id)
        if (!lanes.length) return health.mode !== 'api' || !health.items[0] || health.items[0].status !== 'down'
        return lanes.some(
          (lane) =>
            lane.status !== 'down' &&
            lane.lastErrorCode !== 'invalid_key' &&
            lane.lastErrorCode !== 'unavailable' &&
            lane.lastErrorCode !== 'empty' &&
            lane.lastErrorCode !== 'quota',
        )
      })
    : availableModels
  // Health is authoritative for anything the composer can send. `/api/models`
  // still describes the catalogue, so a temporarily busy model stays usable;
  // a quota-exhausted or dead one does not.
  const selectableModels = healthyModels.length ? healthyModels : usableModels
  const presetModels = selectableModels
  // A fresh local install starts on the free Buffy lane when the bridge is
  // advertised. The full agent stays one click away for anyone with credits.
  // In a hosted deployment there is no bridge, so never fall through to a
  // paid row: the no-credit lanes must be the default.
  const freeModels = selectableModels.filter((model) => !('billing' in model) || model.billing !== 'paid')
  const fallbackModel =
    selectableModels.find((model) => model.id === 'buffy-lite') ??
    selectableModels.find((model) => model.id === 'buffy') ??
    freeModels[0] ??
    selectableModels[Math.floor((selectableModels.length - 1) / 2)] ??
    selectableModels[0]
  const selectedModel = selectableModels.some((m) => m.id === newModel) ? newModel : fallbackModel?.id ?? DEFAULT_MODEL
  const mine = turn !== null && (turn.conversationId === (id ?? null) || (id === undefined && turn.conversationId === owned.current))
  const busy = mine && turn.status !== 'error'
  const mode = me?.capabilities.mode
  const modes = me?.usage.modes
  const researchLeft = modeLeft(modes?.research)
  const analyzeLeft = modeLeft(modes?.analyze)
  const buildLeft = modeLeft(modes?.build)
  const canResearch = me?.capabilities.research === true
  // A mode with no allowance left cannot stay selected: sending would be refused.
  const researchOn = research && canResearch && researchLeft !== 0
  const canAnalyze = me?.capabilities.analyze === true
  const analyzeOn = analyze && canAnalyze && analyzeLeft !== 0
  const canBuild = me?.capabilities.build === true
  const buildOn = build && canBuild && buildLeft !== 0
  const canCanvas = me?.capabilities.canvas === true
  const canvasOn = canvas && canCanvas
  const canAgent = me?.capabilities.agent === true
  const canAdvisor = me?.capabilities.ai === true && mode !== 'api'
  const agentOn = agentMode && canAgent
  const strategy: 'proof' | 'blend' | 'fast' | 'research' | 'analyze' | 'build' | 'canvas' | 'agent' | 'advisor' =
    agentOn ? 'agent' : advisorOn ? 'advisor' : buildOn ? 'build' : analyzeOn ? 'analyze' : researchOn ? 'research' : canvasOn ? 'canvas' : proof ? 'proof' : blend ? 'blend' : 'fast'
  const modeLabel =
    strategy === 'agent'
      ? 'Agent'
      : strategy === 'advisor'
        ? 'Advisor'
      : strategy === 'proof'
        ? 'Proof'
        : strategy === 'research'
          ? 'Research'
          : strategy === 'analyze'
            ? 'Analyze'
            : strategy === 'build'
              ? 'Build'
              : strategy === 'canvas'
                ? 'Study'
                : strategy === 'blend'
                  ? 'Deep'
                  : 'Chat'
  const presetModel = resolvePresetModel(modelPreset, strategy, presetModels)
  const conversationModel =
    conversation?.model && selectableModels.some((m) => m.id === conversation.model) ? conversation.model : null
  const model =
    presetModel ??
    (modelOverride && selectableModels.some((m) => m.id === modelOverride) ? modelOverride : conversationModel ?? selectedModel)
  // Fast is the plain chat: hide exposed reasoning, including older replies,
  // until an advanced mode is selected. The model can still reason internally.
  const showReasoning = strategy !== 'fast'
  const limitReached = me ? me.usage.used >= me.usage.limit && !busy : false
  const canOfferMode = (candidate: SuggestedToolMode) => {
    if (candidate === 'research') return canResearch && researchLeft !== 0
    if (candidate === 'analyze') return canAnalyze && analyzeLeft !== 0
    if (candidate === 'build') return canBuild && buildLeft !== 0
    if (candidate === 'canvas') return canCanvas
    if (candidate === 'agent') return canAgent
    if (candidate === 'proof') return me?.capabilities.mode === 'public'
    return canAdvisor
  }

  const addFiles = useCallback(
    (files: File[]) => {
      if (researchOn) {
        toast('Research is web-only in this version. Ask a text question without attachments.', 'danger')
        return
      }
      if (buildOn) {
        toast('Build is text-only. Describe the page without attachments.', 'danger')
        return
      }
      if (agentOn) {
        toast('Agent is text-only in this version. Describe the goal without attachments.', 'danger')
        return
      }
      if (canvasOn) {
        toast('Canvas is text-only. Describe the topic without attachments.', 'danger')
        return
      }
      let candidates = files
      if (analyzeOn) {
        candidates = files.filter((file) => isDataFile(file.name)).slice(0, 1)
        if (!candidates.length) {
          toast('Analyze needs a CSV, TSV or XLSX file.', 'danger')
          return
        }
        if (attachments.length >= 1) {
          toast('Analyze uses one CSV or TSV at a time.', 'danger')
          return
        }
        if (files.length > 1) toast('Analyze uses one file at a time; only the first table was added.')
      }
      const slots = (analyzeOn ? 1 : MAX_ATTACHMENTS) - attachments.length
      if (slots <= 0) {
        toast(analyzeOn ? 'Analyze uses one table at a time.' : `You can attach up to ${MAX_ATTACHMENTS} files.`, 'danger')
        return
      }
      if (!analyzeOn && files.length > slots) toast(`Only ${slots} more ${slots === 1 ? 'file fits' : 'files fit'}.`)
      void (async () => {
        const next = [...attachments]
        let failure: string | null = null
        let notice: string | null = null
        for (const file of candidates.slice(0, slots)) {
          try {
            const attachment = analyzeOn ? await readDataFile(file) : await readAttachment(file)
            if (attachment.notice) notice ??= attachment.notice
            const total = next.reduce((sum, item) => sum + item.size, 0) + attachment.size
            if (total > MAX_ATTACHMENT_TOTAL_BYTES) {
              failure = 'Those attachments are too large together. Try fewer or smaller files.'
              break
            }
            next.push(attachment)
          } catch (error) {
            failure = error instanceof AttachmentError ? error.message : 'Could not read that file.'
            break
          }
        }
        if (next.length > attachments.length) setAttachments(next)
        if (failure) toast(failure, 'danger')
        else if (notice) toast(notice)
      })()
    },
    [agentOn, analyzeOn, attachments, buildOn, researchOn, toast],
  )

  const addLink = useCallback(
    (raw: string) => {
      if (attachments.length >= MAX_ATTACHMENTS) {
        toast(`You can attach up to ${MAX_ATTACHMENTS} items.`, 'danger')
        return
      }
      const url = raw.trim()
      let host = 'link'
      try {
        if (/\s/.test(url) || !/^https?:\/\//i.test(url)) return
        const parsed = new URL(url)
        if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') return
        host = parsed.hostname.replace(/^www\./i, '') || 'link'
      } catch {
        return
      }
      const attachment: PendingAttachment = {
        id: crypto.randomUUID(),
        name: host,
        mime: 'text/uri-list',
        size: new TextEncoder().encode(url).byteLength,
        kind: 'text',
        data: url,
      }
      setAttachments((current) => [...current, attachment])
    },
    [attachments.length, toast],
  )

  // Pasting a screenshot should work even when focus is on the page rather
  // than the textarea. The composer handles pastes aimed at its textarea; this
  // catch-all deliberately leaves every other editable field alone.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      const files = clipboardFiles(event.clipboardData)
      if (!files.length) return
      event.preventDefault()
      if (busy || limitReached) return
      addFiles(files)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [addFiles, busy, limitReached, toast])

  const send = useCallback(
    async (content: string) => {
      content = content.trim()
      const outgoing = attachments
      if (!content && !outgoing.length) return
      if (analyzeOn && !outgoing[0]) {
        toast('Attach one CSV, TSV or XLSX file to use Analyze.', 'danger')
        return
      }
      if (buildOn && !content) {
        toast('Describe the page you want to build.', 'danger')
        return
      }
      if (buildOn && outgoing.length) {
        toast('Build is text-only. Remove the attachment first.', 'danger')
        return
      }
      if (canvasOn && outgoing.length) {
        toast('Canvas is text-only. Remove the attachment first.', 'danger')
        return
      }
      if (agentOn && outgoing.length) {
        toast('Agent is text-only in this version. Remove the attachment first.', 'danger')
        return
      }
      if (agentOn && !content) {
        toast('Describe the goal you want Agent to work on.', 'danger')
        return
      }
      if (skipToolSuggestion.current) {
        skipToolSuggestion.current = false
      } else if (!busy && !limitReached && strategy === 'fast' && !taskMode && !proof && !blend) {
        const suggested = suggestToolMode(content, {
          hasAttachments: outgoing.length > 0,
          hasDataAttachment: outgoing.some((attachment) => isDataFile(attachment.name)),
        })
        if (suggested && canOfferMode(suggested)) {
          setToolPrompt({ content, mode: suggested })
          return
        }
      }
      const projectId = !id ? selectedProjectId ?? undefined : undefined
      const attachmentKey = outgoing.map((attachment) => attachment.id).join('|')
      const submissionKey = `${id ?? 'new'}|${content}|${attachmentKey}`
      // A second submit of the same message before React paints the busy state
      // must not start a second turn with a second id.
      if (sendingKey.current === submissionKey) return
      sendingKey.current = submissionKey
      const previous = failedSend.current
      const clientMessageId =
        previous &&
        previous.content === content &&
        previous.conversationId === id &&
        previous.projectId === projectId &&
        previous.model === model &&
        previous.strategy === strategy &&
        previous.effort === effort &&
        previous.attachmentKey === attachmentKey
          ? previous.clientMessageId
          : crypto.randomUUID()
      failedSend.current = null
      let dataset = outgoing[0]?.dataset
      if (analyzeOn && outgoing[0]) {
        try {
          dataset ??= buildDataset(outgoing[0].name, outgoing[0].mime, outgoing[0].size, outgoing[0].data)
          await putDataset(dataset, outgoing[0].data)
        } catch (error) {
          sendingKey.current = null
          toast(error instanceof Error ? error.message : 'Could not read that table.', 'danger')
          return
        }
      }
      const request = {
        conversationId: id,
        projectId,
        content,
        ...(analyzeOn && dataset
          ? { dataset }
          : outgoing.length
            ? {
                attachments: outgoing.map((attachment) => ({
                  name: attachment.name,
                  mime: attachment.mime,
                  size: attachment.size,
                  kind: attachment.kind,
                  data: attachment.data,
                })),
              }
            : {}),
        model,
        strategy,
        effort,
        clientMessageId,
      }
      // Always try the request. `navigator.onLine` is only a hint and can be
      // false while the network is usable, so refusing here stranded Build,
      // Research and Agent sends behind a stale browser flag.
      setDraft('')
      setAttachments([])
      let started = false
      const rememberFailedSend = () => {
        failedSend.current = {
          clientMessageId,
          content,
          conversationId: id,
          projectId,
          model,
          strategy,
          effort,
          attachmentKey,
        }
      }
      try {
        await startTurn(client, request, { onConversation: openCreated, onStarted: () => { started = true } })
      } catch (error) {
        if (error instanceof ApiError && (error.code === 'offline' || error.status === 0)) {
          void checkConnection()
          if (!started) {
            rememberFailedSend()
            setDraft(content)
            setAttachments(outgoing)
          }
          toast(
            outgoing.length
              ? 'Could not send the attachment. Check your connection and try again.'
              : 'Could not send the message. Check your connection and try again.',
            'danger',
          )
          return
        }
        if (error instanceof ApiError && error.code === 'duplicate') {
          if (error.conversationId) navigate(`/c/${error.conversationId}`, { replace: true })
          else if (id) void client.invalidateQueries({ queryKey: ['conversation', id] })
          toast('That message was already sent.')
          return
        }
        if (!started) {
          rememberFailedSend()
          setDraft(content)
          setAttachments(outgoing)
        }
        if (error instanceof ApiError && (error.code === 'limit' || error.code?.endsWith('_limit'))) void client.invalidateQueries({ queryKey: ['me'] })
        toast(error instanceof Error ? error.message : 'Could not send this message', 'danger')
      } finally {
        if (sendingKey.current === submissionKey) sendingKey.current = null
      }
    },
    [agentOn, analyzeOn, attachments, blend, buildOn, busy, canOfferMode, client, effort, id, limitReached, model, navigate, openCreated, proof, researchOn, selectedProjectId, strategy, taskMode, toast],
  )

  const regenerate = useCallback(async (retryModel?: string) => {
    if (!id) return
    try {
      await startTurn(client, { conversationId: id, regenerate: true, model: retryModel ?? model, strategy, effort })
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not regenerate', 'danger')
    }
  }, [client, effort, id, model, strategy, toast])

  const rerunAnalysis = useCallback(
    async (message: Message) => {
      const info = message.analysis
      if (!info) return
      const stored = await getDataset(info.datasetId)
      if (!stored) {
        toast('This CSV is not saved in this browser. Attach it again to rerun.', 'danger')
        return
      }
      try {
        const response = await fetch(`/api/analysis/${message.id}/rerun`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        })
        if (!response.ok) throw new Error('Could not start the rerun.')
        const body = (await response.json()) as { job?: import('../../shared/types').AnalysisJob }
        if (!body.job) throw new Error('This analysis cannot rerun.')
        await client.invalidateQueries({ queryKey: ['conversation', message.conversationId] })
        await settleAnalysis(client, message.conversationId, body.job)
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Could not rerun this analysis.', 'danger')
      }
    },
    [client, toast],
  )

  const changeModel = (next: string) => {
    setModelPreset('manual')
    localStorage.setItem(MODEL_PRESET_KEY, 'manual')
    setModelOverride(next)
    setNewModel(next)
    localStorage.setItem(MODEL_KEY, next)
    if (conversation) setConversationModel.mutate({ id: conversation.id, model: next })
  }

  const changePreset = (next: ModelPreset) => {
    setModelPreset(next)
    localStorage.setItem(MODEL_PRESET_KEY, next)
  }

  /** One task mode at a time; choosing a task retires Proof and Deep. */
  const selectTaskMode = (next: TaskId | null) => {
    setTaskMode(next)
    writeTaskMode(id, next)
    if (!next) return
    setProof(false)
    setBlend(false)
    localStorage.setItem('proof', 'off')
    localStorage.setItem('blend', 'off')
  }

  const toggleProof = () => {
    const next = !proof
    setProof(next)
    localStorage.setItem('proof', next ? 'on' : 'off')
    if (next) {
      setBlend(false)
      localStorage.setItem('blend', 'off')
      selectTaskMode(null)
    }
  }

  const toggleBlend = () => {
    const next = !blend
    setBlend(next)
    localStorage.setItem('blend', next ? 'on' : 'off')
    if (next) {
      setProof(false)
      localStorage.setItem('proof', 'off')
      selectTaskMode(null)
    }
  }

  const toggleResearch = () => {
    if (!canResearch || researchLeft === 0) return
    const next = research ? null : 'research'
    selectTaskMode(next)
    if (next) setAttachments([])
  }

  const toggleAnalyze = () => {
    if (!canAnalyze || analyzeLeft === 0) return
    const next = analyze ? null : 'analyze'
    selectTaskMode(next)
    if (next) setAttachments((current) => current.filter((attachment) => isDataFile(attachment.name)).slice(0, 1))
  }

  const toggleBuild = () => {
    if (!canBuild || buildLeft === 0) return
    const next = taskMode === 'build' ? null : 'build'
    selectTaskMode(next)
    if (next) setAttachments([])
  }

  const toggleCanvas = () => {
    if (!canCanvas) return
    const next = canvas ? null : 'canvas'
    selectTaskMode(next)
    if (next) setAttachments([])
  }

  const toggleAgent = () => {
    if (!canAgent) return
    const next = agentMode ? null : 'agent'
    selectTaskMode(next)
    if (next) setAttachments([])
  }

  const toggleAdvisor = () => {
    if (!canAdvisor) return
    selectTaskMode(advisorOn ? null : 'advisor')
  }

  const toggleChatOnly = () => {
    selectTaskMode(null)
    setProof(false)
    setBlend(false)
    localStorage.setItem('proof', 'off')
    localStorage.setItem('blend', 'off')
  }

  const changeEffort = (next: ReasoningEffort) => {
    setEffort(next)
    localStorage.setItem(EFFORT_KEY, next)
  }

  const chooseSuggestion = (prompt: string) => {
    setDraft(prompt)
    setComposerFocusRequest((request) => request + 1)
  }

  const composerTools: ComposerToggle[] =
    mode !== 'api'
      ? [
          {
            id: 'chat',
            label: 'Chat only',
            description: 'One direct answer, with no extra mode.',
            pressed: !proof && !blend && !researchOn && !analyzeOn && !buildOn && !canvasOn && !agentOn && !advisorOn,
            onClick: toggleChatOnly,
            icon: MessageCircle,
            title: 'No extra mode',
          },
          {
            id: 'proof',
            label: 'Proof',
            description: 'Checks code, math and dates.',
            pressed: proof,
            onClick: toggleProof,
            icon: ShieldCheck,
            title: 'Independent checks before the answer is trusted.',
          },
          {
            id: 'deep',
            label: 'Deep',
            description: 'Extra drafts and review when needed.',
            pressed: blend,
            onClick: toggleBlend,
            icon: Sparkles,
            title: 'Extra drafts and a review for hard questions.',
          },
          ...(canAdvisor
            ? [{
                id: 'advisor',
                label: 'Advisor',
                description: 'Makes a hard decision with a recommendation.',
                pressed: advisorOn,
                onClick: toggleAdvisor,
                icon: Compass,
                title: 'A decision brief: options, trade-offs, a recommendation and the cheapest test.',
              }]
            : []),
          ...(canAgent
            ? [{
                id: 'agent',
                label: 'Agent',
                description: 'Plans, uses every text tool and checks its work.',
                pressed: agentOn,
                onClick: toggleAgent,
                icon: Bot,
                title: 'Plan a goal, run Research, Build, Study or Proof, review the answer, then report what actually happened.',
              }]
            : []),
          ...(canResearch
            ? [{
                id: 'research',
                label: 'Research',
                description: 'Searches the web and cites sources.',
                pressed: researchOn,
                note: modeNote(modes?.research),
                disabled: researchLeft === 0,
                onClick: toggleResearch,
                icon: Search,
                title: 'A cited web report with claim checks.',
              }]
            : []),
          ...(canAnalyze
            ? [{
                id: 'analyze',
                label: 'Analyze',
                description: 'Runs Python on your table.',
                pressed: analyzeOn,
                note: modeNote(modes?.analyze),
                disabled: analyzeLeft === 0,
                onClick: toggleAnalyze,
                icon: FileSpreadsheet,
                title: 'Run Python on one CSV, TSV or XLSX in the browser.',
              }]
            : []),
          ...(canCanvas
            ? [{
                id: 'canvas',
                label: 'Study',
                description: 'Makes flashcards or a quiz.',
                pressed: canvasOn,
                onClick: toggleCanvas,
                icon: Layers,
                title: 'Turn a topic or your notes into a flashcard deck or practice quiz.',
              }]
            : []),
          ...(canBuild
            ? [{
                id: 'build',
                label: 'Build',
                description: 'Makes a page, tool or game.',
                pressed: buildOn,
                note: modeNote(modes?.build),
                disabled: buildLeft === 0,
                onClick: toggleBuild,
                icon: Hammer,
                title: 'Create a page or tool, or preview a live site.',
              }]
            : []),
          {
            id: 'browser',
            label: 'Browser',
            description: 'Operates a real, signed-in tab.',
            pressed: false,
            onClick: () => navigate('/browser'),
            icon: Globe2,
            title: 'Open the Browser workspace and operate a real site tab.',
          },
        ]
      : []

  const activeTask: 'chat' | TaskId = agentOn ? 'agent' : advisorOn ? 'advisor' : buildOn ? 'build' : analyzeOn ? 'analyze' : researchOn ? 'research' : canvasOn ? 'canvas' : 'chat'
  const unavailableTasks: Partial<Record<TaskId, string>> = {
    ...(!canResearch ? { research: 'Not available' } : researchLeft === 0 ? { research: 'Used up today' } : {}),
    ...(!canAnalyze ? { analyze: 'Not available' } : analyzeLeft === 0 ? { analyze: 'Used up today' } : {}),
    ...(!canBuild ? { build: 'Not available' } : buildLeft === 0 ? { build: 'Used up today' } : {}),
    ...(!canCanvas ? { canvas: 'Not available' } : {}),
    ...(!canAdvisor ? { advisor: 'Not available' } : {}),
    ...(!canAgent ? { agent: 'Not available' } : {}),
  }

  const assignProject = (projectId: string | null) => {
    if (!conversation) return
    setConversationProject.mutate(
      { id: conversation.id, projectId },
      {
        onSuccess: () => toast(projectId ? 'Chat added to project' : 'Chat removed from project'),
        onError: () => toast('Could not move this chat', 'danger'),
      },
    )
  }

  const projectItems = conversation
    ? [
        ...(currentProject ? [{ label: 'Remove from project', icon: <FolderX />, onSelect: () => assignProject(null) }] : []),
        ...projects.map((project) => ({ label: project.name, icon: <Folder />, onSelect: () => assignProject(project.id) })),
      ]
    : []

  // What the thread shows: the saved messages, plus the turn in flight. While
  // regenerating, saved replies after the last question are hidden.
  let messages: Message[] = saved
  if (mine && turn && !turn.userMessage) {
    const lastUser = [...saved].reverse().find((m) => m.role === 'user')
    if (lastUser) messages = saved.filter((m) => m.createdAt <= lastUser.createdAt)
  }
  const pendingUser = mine && turn?.userMessage && !messages.some((m) => m.id === turn.userMessage!.id) ? turn.userMessage : null
  // Small, approximate context hint for the composer. Provider-reported usage
  // is not available on every free lane, so count the visible conversation and
  // the draft instead of showing a precise bill.
  const estimatedTokens =
    estimateConversationTokens(messages) +
    (pendingUser ? estimateTokens(pendingUser.content) : 0) +
    (turn?.text ? estimateTokens(turn.text) : 0) +
    (draft ? estimateTokens(draft) : 0)
  // Time from the question to its answer, for the receipt above each reply.
  const elapsedFor = (message: Message): number | undefined => {
    const index = messages.findIndex((item) => item.id === message.id)
    for (let previous = index - 1; previous >= 0; previous -= 1) {
      if (messages[previous].role === 'user') return Math.max(0, message.createdAt - messages[previous].createdAt)
    }
    return undefined
  }
  const lastSavedAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const hasSavedAssistant = messages.some((message) => message.role === 'assistant' && message.content.trim())
  const conversationId = conversation?.id
  // New chats get a title after their first reply; this also backfills an
  // existing chat the first time it is opened. The server ignores a title that
  // is no longer the first-message placeholder, so manual names stay put.
  useEffect(() => {
    if (!conversationId || !hasSavedAssistant) return
    void refreshConversationTitle(client, conversationId)
  }, [client, conversationId, hasSavedAssistant])
  const empty = messages.length === 0 && !mine && (!id || page.isSuccess)
  // The tool chooser runs before the request leaves Chat. It only offers modes
  // that are available to this account, and the person can still send as chat.
  const toolCopy = toolPrompt ? MODE_SUGGESTION_COPY[toolPrompt.mode] : null
  const closeToolPrompt = () => setToolPrompt(null)
  const acceptToolPrompt = () => {
    if (!toolPrompt) return
    const { content, mode } = toolPrompt
    setToolPrompt(null)
    if (mode === 'proof') {
      setProof(true)
      setBlend(false)
      localStorage.setItem('proof', 'on')
      localStorage.setItem('blend', 'off')
      selectTaskMode(null)
    } else {
      selectTaskMode(mode)
      if (mode === 'analyze') {
        const data = attachments.filter((attachment) => isDataFile(attachment.name)).slice(0, 1)
        setAttachments(data)
        setDraft(content)
        setComposerFocusRequest((request) => request + 1)
        if (data.length) {
          setQueuedToolSend({ content, mode })
        } else {
          setFilePickerRequest((request) => request + 1)
          toast('Analyze mode is on. Attach a CSV, TSV or XLSX, then press Send.')
        }
        return
      }
      if (mode !== 'advisor') setAttachments([])
    }
    setDraft(content)
    setComposerFocusRequest((request) => request + 1)
    setQueuedToolSend({ content, mode })
  }
  const sendToolPromptAsChat = () => {
    if (!toolPrompt) return
    const content = toolPrompt.content
    setToolPrompt(null)
    skipToolSuggestion.current = true
    void send(content)
  }
  useEffect(() => {
    if (!queuedToolSend || queuedSendActive.current) return
    const ready = queuedToolSend.mode === 'proof' ? proof : taskMode === queuedToolSend.mode
    if (!ready) return
    queuedSendActive.current = true
    setQueuedToolSend(null)
    skipToolSuggestion.current = true
    void send(queuedToolSend.content).finally(() => {
      queuedSendActive.current = false
    })
  }, [proof, queuedToolSend, send, taskMode])
  const labelFor = (modelId: string | null | undefined) => modelDisplayName(modelId, models?.items)

  const exportChat = () => {
    if (!messages.length) return
    const title = conversation?.title ?? 'Ink chat'
    const parts = [`# ${title}`, '']
    for (const message of messages) {
      parts.push(message.role === 'user' ? '## You' : '## Ink', '', message.content)
      if (message.attachments?.length) {
        parts.push('', ...message.attachments.map((attachment) => `- ${attachment.kind === 'image' ? 'Image' : 'File'}: ${attachment.name}`))
      }
      if (message.analysis) {
        const analysis = message.analysis
        parts.push('', `### Analyze · ${analysis.status}`, analysis.reason ? `_${analysis.reason}_` : '')
        if (analysis.stdout) parts.push('', '```text', analysis.stdout, '```')
        parts.push('', '```python', analysis.code, '```')
      }
      if (message.build) {
        parts.push('', `### Build · ${message.build.title}`)
        const buildPages = message.build.pages?.length
          ? message.build.pages
          : [{ name: `${message.build.title}.html`, html: message.build.html }]
        for (const page of buildPages) {
          parts.push('', `#### ${page.name}`, '', '```html', page.html, '```')
        }
      }
      if (message.canvas) {
        const canvas = message.canvas
        parts.push('', `### Canvas · ${canvas.title}`)
        if (canvas.cards?.length) parts.push('', ...canvas.cards.map((card) => `- ${card.front} — ${card.back}`))
        if (canvas.questions?.length) {
          parts.push('', ...canvas.questions.map((question, index) => `${index + 1}. ${question.question} — ${question.choices[question.answer]}`))
        }
      }
      if (message.research) {
        const research = message.research
        parts.push('', `### Research · ${research.status}`, research.reason ? `_${research.reason}_` : '')
        if (research.claims.length) {
          parts.push('', ...research.claims.map((claim) => `- ${claim.text} (${claim.status}; ${claim.sourceUrls.join(', ')})`))
        }
      }
      if (message.sources?.length) {
        parts.push('', '### Sources', ...message.sources.map((source) => `- [${source.title}](${source.url})`))
      }
      parts.push('')
    }
    const blob = new Blob([parts.join('\n')], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const name = title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'stet-chat'
    link.href = url
    link.download = `${name}.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Follow the reply as it streams, unless the reader has scrolled up.
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const onScroll = () => {
    const el = scroller.current
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }
  useEffect(() => {
    const el = scroller.current
    // Leave the empty state alone: scrolling it to the bottom hides the heading.
    if (el && stick.current && messages.length > 0) el.scrollTop = el.scrollHeight
  }, [messages.length, pendingUser, turn?.text, turn?.reasoning, turn?.statusText, id])
  useEffect(() => {
    stick.current = true
  }, [id])
  // Opening an artifact from the library lands on the reply that made it,
  // rather than at the bottom of the conversation.
  useEffect(() => {
    if (!page.data) return
    const hash = window.location.hash
    if (!hash.startsWith('#message-')) return
    const timer = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'center' }), 80)
    return () => window.clearTimeout(timer)
  }, [id, page.data])

  if (id && page.isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatHeader title="Chat" />
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      </div>
    )
  }
  if (id && page.error) {
    // A cached read that the service worker could not satisfy is different
    // from a chat that was deleted: say so, and offer a retry.
    const unavailableOffline =
      page.error instanceof ApiError && (page.error.code === 'offline' || page.error.status === 503)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatHeader title="Chat" />
        <div className="grid flex-1 place-items-center p-6 text-center">
          <div>
            <p className="text-[15px] font-medium">{unavailableOffline ? 'Not available offline' : 'This chat is not here any more.'}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">
              {unavailableOffline ? 'Open this conversation once while you are online and it will be kept for offline reading.' : 'It may have been deleted.'}
            </p>
            {unavailableOffline ? (
              <button type="button" onClick={() => void page.refetch()} className="mt-2 text-[14px] text-muted underline underline-offset-2 hover:text-fg">
                Try again
              </button>
            ) : (
              <button type="button" onClick={() => navigate('/')} className="mt-2 text-[14px] text-muted underline underline-offset-2 hover:text-fg">
                Start a new one
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatHeader
        title={conversation?.title ?? ''}
        mode={mode !== 'api' ? modeLabel : undefined}
        actions={
          <>
            {conversation && projectItems.length > 0 && (
              <Menu
                align="end"
                trigger={
                  <button
                    type="button"
                    aria-label="Move chat to a project"
                    title={currentProject ? `Project: ${currentProject.name}` : 'Move chat to a project'}
                    className="inline-flex h-9 max-w-[170px] shrink-0 items-center gap-1.5 rounded-tile px-2.5 text-[13.5px] text-faint transition-colors hover:bg-surface-2 hover:text-fg"
                  >
                    <Folder className="size-3.5 shrink-0" />
                    <span className="hidden truncate sm:inline">{currentProject?.name ?? 'Project'}</span>
                  </button>
                }
                items={projectItems}
              />
            )}
            {conversation && <ChatReaction conversation={conversation} />}
            {conversation && (
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                aria-label="Share chat"
                title="Share this read-only chat"
                className="grid size-8 shrink-0 place-items-center rounded-tile text-faint transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <Share2 className="size-3.5" />
              </button>
            )}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const draft = briefFromConversation([...messages, ...(pendingUser ? [pendingUser] : [])])
                  if (!draft.goal && !draft.plan) return
                  navigate('/buffy', { state: { briefDraft: draft } })
                }}
                aria-label="Turn this chat into a build brief"
                title="Turn this chat into a build brief in Buffy"
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-tile px-2 text-[12.5px] text-faint transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <ClipboardList className="size-3.5" />
                <span className="hidden sm:inline">Brief</span>
              </button>
            )}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={exportChat}
                aria-label="Export chat"
                title="Export as Markdown"
                className="grid size-8 shrink-0 place-items-center rounded-tile text-faint transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <Download className="size-3.5" />
              </button>
            )}
            <ThemeToggle className="retro-hide" />
          </>
        }
      />

      <div ref={scroller} onScroll={onScroll} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div className={cx('mx-auto w-full px-4 pb-6 pt-2 md:px-6', empty ? 'flex min-h-full max-w-[1040px] flex-col' : 'max-w-[760px]')}>
          {conversation && messages.length > MAX_CONTEXT_MESSAGES ? <MemoryPanel conversationId={conversation.id} /> : null}
          {empty ? (
            <EmptyState
              disabled={limitReached}
              activeTask={activeTask}
              unavailable={unavailableTasks}
              showTasks={mode !== 'api'}
              onChatOnly={toggleChatOnly}
              onSuggestion={chooseSuggestion}
              onTask={(task) => {
                if (task === 'advisor') {
                  if (!canAdvisor || advisorOn) return
                  toggleAdvisor()
                  return
                }
                if (task === 'agent') {
                  if (!canAgent || agentOn) return
                  toggleAgent()
                  return
                }
                if (task === 'research') {
                  if (!canResearch || researchLeft === 0 || researchOn) return
                  toggleResearch()
                  return
                }
                if (task === 'analyze') {
                  if (!canAnalyze || analyzeLeft === 0) return
                  if (!analyzeOn) toggleAnalyze()
                  setFilePickerRequest((request) => request + 1)
                  return
                }
                if (task === 'build') {
                  if (!canBuild || buildLeft === 0 || buildOn) return
                  toggleBuild()
                  return
                }
                if (!canCanvas || canvasOn) return
                toggleCanvas()
              }}
            />
          ) : (
            <div className="space-y-7">
              {messages.map((message) =>
                message.role === 'user' ? (
                  <UserMessage key={message.id} content={message.content} attachments={message.attachments} />
                ) : (
                  <AssistantMessage
                    key={message.id}
                    content={message.content}
                    reasoning={showReasoning ? message.reasoning : undefined}
                    reasoningMs={showReasoning ? message.reasoningMs : undefined}
                    showThoughts={showReasoning}
                    sources={message.sources}
                    team={message.team}
                    proof={message.proof}
                    research={message.research}
                    analysis={message.analysis}
                    build={message.build}
                    canvas={message.canvas}
                    agent={message.agent}
                    elapsedMs={elapsedFor(message)}
                    model={labelFor(message.model)}
                    interrupted={message.interrupted}
                    messageId={message.id}
                    feedback={message.feedback}
                    onFeedback={(rating) =>
                      feedback.mutate({ id: message.id, rating }, { onError: () => toast('Could not save feedback', 'danger') })
                    }
                    onRegenerate={!message.analysis && message.id === lastSavedAssistant?.id && !mine ? regenerate : undefined}
                    onRerun={message.analysis ? () => void rerunAnalysis(message) : undefined}
                  />
                ),
              )}
              {pendingUser && <UserMessage key={pendingUser.id} content={pendingUser.content} attachments={pendingUser.attachments} />}
              {mine && turn && (
                <>
                  {turn.notice ? (
                    <p role="status" className="rounded-control bg-surface-2 px-4 py-2.5 text-[12.5px] leading-relaxed text-warning">
                      {turn.notice}
                    </p>
                  ) : null}
                  <AssistantMessage
                  key={turn.assistantMessageId ?? 'pending'}
                  content={turn.text}
                  reasoning={showReasoning ? turn.reasoning : undefined}
                  showThoughts={showReasoning}
                  sources={turn.sources}
                  team={turn.team}
                  proof={turn.proof}
                  research={turn.research}
                  analysis={turn.analysis}
                  build={turn.build}
                  canvas={turn.canvas}
                  agent={turn.agent}
                  elapsedMs={turn.userMessage ? Date.now() - turn.userMessage.createdAt : undefined}
                  statusText={turn.statusText}
                  statusLog={turn.statusLog}
                  model={labelFor(turn.model)}
                  streaming={turn.status !== 'error'}
                  error={turn.status === 'error' ? turn.error : null}
                    onRetry={() => {
                      dismissTurn()
                      // A failed model should not be retried into the same wall.
                      // Move to the next healthy model when one is available.
                      const fallback = presetModels.find((candidate) => candidate.id !== model && candidate.available)?.id
                      if (fallback) changeModel(fallback)
                      void regenerate(fallback)
                    }}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[760px] px-4 pb-4 md:px-6 md:pb-6">
        {limitReached && me ? (
          <Notice>
            You have used today&apos;s {me.usage.limit} replies. More {untilLabel(me.usage.resetsAt)}.
          </Notice>
        ) : (
          <Composer
              value={draft}
              onChange={setDraft}
              attachments={attachments}
              tools={composerTools}
              replyUsage={me?.usage}
              tokenCount={estimatedTokens}
              model={model}
              onChangeModel={changeModel}
              modelPreset={modelPreset}
              onChangeModelPreset={changePreset}
              effort={mode === 'public' && me?.capabilities.reasoning ? effort : undefined}
              onChangeEffort={changeEffort}
              onAttach={addFiles}
              onAddLink={!taskMode ? addLink : undefined}
              openFilePicker={filePickerRequest}
              focusRequest={composerFocusRequest}
              onRemoveAttachment={(attachmentId) => setAttachments((current) => current.filter((item) => item.id !== attachmentId))}
              onSend={() => void send(draft)}
              onStop={() => turn?.stop()}
              busy={busy}
              placeholder={agentOn ? 'Describe a goal; Agent plans and runs the tools…' : advisorOn ? 'Describe the decision, your constraints and the deadline…' : buildOn ? 'Describe a site, landing page or tool — or paste a public site to show live…' : canvasOn ? 'What should the flashcards or quiz cover?' : analyzeOn ? 'Upload a table, then ask a question…' : researchOn ? 'Ask a question to research…' : 'Message'}
              placeholderPrompts={empty && !taskMode ? CHAT_PLACEHOLDER_PROMPTS : undefined}
              autoFocus
          />
        )}
      </div>
      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} conversationId={conversation?.id} />
      <Dialog
        open={toolPrompt !== null}
        onClose={closeToolPrompt}
        title={toolCopy ? `Use ${toolCopy.label}?` : 'Use a tool?'}
        description={toolCopy?.description}
        width={420}
        footer={
          <>
            <Button onClick={sendToolPromptAsChat}>Send as chat</Button>
            <Button variant="primary" onClick={acceptToolPrompt} data-autofocus>
              Use {toolCopy?.label ?? 'tool'}
            </Button>
          </>
        }
      >
        {toolPrompt ? (
          <div className="space-y-2.5">
            <p className="text-[13px] leading-relaxed text-muted">
              {toolPrompt.mode === 'analyze'
                ? 'Switch to Analyze and attach the table you want to inspect.'
                : 'Switch modes and send this request there.'}
            </p>
            <p className="rounded-control bg-surface-2/70 px-3 py-2.5 text-[12.5px] leading-relaxed text-faint">
              {toolPrompt.content.length > 180 ? `${toolPrompt.content.slice(0, 180).trimEnd()}…` : toolPrompt.content}
            </p>
          </div>
        ) : null}
      </Dialog>
    </div>
  )
}

/** Remaining uses of one free mode today, once the server has reported them. */
function modeLeft(usage?: ModeUsage): number | undefined {
  if (!usage || usage.unlimited) return undefined
  return Math.max(0, usage.limit - usage.used)
}

/** The allowance line in the Tools menu, e.g. "2 of 3 left today". */
function modeNote(usage?: ModeUsage): string | undefined {
  if (!usage) return undefined
  if (usage.unlimited) return 'Unlimited for owner'
  const left = Math.max(0, usage.limit - usage.used)
  return left > 0 ? `${left} of ${usage.limit} left today` : 'Used up today'
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-control bg-surface-2 px-4 py-3 text-center text-[14.5px] text-muted">{children}</p>
}

const CHAT_REACTION_NAMES: Record<string, string> = {
  '❤️': 'Love',
  '😂': 'Laugh',
  '👍': 'Like',
  '🔥': 'Fire',
  '😮': 'Wow',
  '🎉': 'Celebrate',
}

function ChatReaction({ conversation }: { conversation: Conversation }) {
  const setReaction = useSetConversationReaction()
  const toast = useToast()
  const choose = (reaction: string) => {
    setReaction.mutate(
      { id: conversation.id, reaction: conversation.reaction === reaction ? null : reaction },
      { onError: (error) => toast(error instanceof Error ? error.message : 'Could not save the reaction', 'danger') },
    )
  }
  return (
    <Menu
      align="end"
      trigger={
        <button
          type="button"
          aria-label={conversation.reaction ? `Chat reaction: ${conversation.reaction}` : 'React to this chat'}
          title={conversation.reaction ? 'Change or remove this chat reaction' : 'React to this chat'}
          className="grid size-8 shrink-0 place-items-center rounded-tile text-faint transition-colors hover:bg-surface-2 hover:text-fg"
        >
          {conversation.reaction ? (
            <span className="text-[15px] leading-none">{conversation.reaction}</span>
          ) : (
            <span className="text-[16px] leading-none" aria-hidden="true">☺</span>
          )}
        </button>
      }
      items={[
        ...CHAT_REACTIONS.map((reaction) => ({
          label: `${reaction}  ${CHAT_REACTION_NAMES[reaction]}${conversation.reaction === reaction ? ' ✓' : ''}`,
          onSelect: () => choose(reaction),
        })),
        ...(conversation.reaction ? [{ label: 'Remove reaction', onSelect: () => choose(conversation.reaction!) }] : []),
      ]}
    />
  )
}

function ChatHeader({
  title,
  mode,
  actions,
}: {
  title: string
  mode?: string
  actions?: ReactNode
}) {
  const openMenu = useMobileNav()
  return (
    <header className="flex h-14 shrink-0 items-center px-3 md:h-16 md:px-5">
      <div className="mx-auto flex min-w-0 w-full max-w-[712px] items-center gap-2">
        <button
          type="button"
          aria-label="Open menu"
          onClick={openMenu}
          className="-ml-2 grid size-9 shrink-0 place-items-center rounded-tile text-muted transition-colors hover:bg-surface-2 hover:text-fg md:hidden"
        >
          <MenuIcon className="size-5" />
        </button>
        <Mark size={22} className="md:hidden" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {title ? (
              <h1 className="truncate font-display text-[18px] font-semibold tracking-[-0.02em]">{title}</h1>
            ) : null}
            {mode && mode !== 'Chat' ? (
              <span
                className="inline-flex h-6 shrink-0 items-center rounded-full bg-surface-2 px-2.5 text-[11.5px] font-medium text-muted"
                title={`Current mode: ${mode}. Change it in Tools.`}
              >
                {mode}
              </span>
            ) : null}
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {actions ? <div className="flex shrink-0 items-center gap-0.5">{actions}</div> : null}
        </div>
        <Link
          to="/browser"
          aria-label="Open browser"
          title="Browser"
          className="ml-1 grid size-9 shrink-0 place-items-center rounded-tile text-muted transition-colors hover:bg-surface-2 hover:text-fg md:hidden"
        >
          <Monitor className="size-5" />
        </Link>
      </div>
    </header>
  )
}

function EmptyState({
  disabled,
  activeTask,
  unavailable,
  showTasks,
  onTask,
  onChatOnly,
  onSuggestion,
}: {
  disabled: boolean
  activeTask: 'chat' | TaskId
  unavailable: Partial<Record<TaskId, string>>
  showTasks: boolean
  onTask: (task: TaskId) => void
  onChatOnly: () => void
  onSuggestion: (prompt: string) => void
}) {
  const { data: review } = useReviewSummary()
  const tasks: { id: TaskId; title: string; description: string; icon: LucideIcon }[] = [
    { id: 'advisor', title: 'Advisor', description: 'Make a decision.', icon: Compass },
    { id: 'agent', title: 'Agent', description: 'Run a multi-step task.', icon: Bot },
    { id: 'research', title: 'Research', description: 'Search the web with sources.', icon: Search },
    { id: 'analyze', title: 'Analyze', description: 'Run Python on a spreadsheet.', icon: FileSpreadsheet },
    { id: 'build', title: 'Build', description: 'Make a page or small app.', icon: Hammer },
    { id: 'canvas', title: 'Study', description: 'Make flashcards or a quiz.', icon: Layers },
  ]
  return (
    <div className="mx-auto my-auto flex w-full max-w-[712px] flex-col items-center pb-4 pt-3">
      <div className="w-full">
        <div className="text-center">
      <div className="relative mx-auto mb-5 w-[280px] max-w-full md:w-[360px]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 bottom-0 h-14 rounded-full bg-[#a84914]/10 blur-2xl" />
        <BrandArt variant="horizon" className="relative w-full saturate-[1.05] drop-shadow-[0_10px_20px_rgba(92,52,33,0.14)]" />
      </div>
      <h1 className="text-balance font-display text-[44px] font-medium leading-[1.02] tracking-[-0.035em] md:text-[52px]">What can I help with?</h1>
      <div className="mt-6 grid w-full gap-2.5 min-[960px]:grid-cols-2">
        {SUGGESTIONS.map((prompt, index) => {
          const SuggestionIcon = [FileText, Search, FileSpreadsheet, Hammer][index] ?? Sparkles
          return (
            <button
              key={prompt}
              type="button"
              disabled={disabled}
              onClick={() => onSuggestion(prompt)}
              className="group flex min-h-[60px] items-center gap-3 rounded-card border border-line/90 bg-surface/45 px-4 py-3 text-left text-[14px] leading-snug text-muted transition-[border-color,background-color,color] hover:border-line-strong hover:bg-surface hover:text-fg disabled:pointer-events-none disabled:opacity-40"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-tile bg-surface-2 text-faint transition-colors group-hover:text-accent">
                <SuggestionIcon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">{prompt}</span>
            </button>
          )
        })}
      </div>
      {showTasks ? (
        <div className="mt-3 flex w-full flex-col items-center gap-1.5">
          <div className="flex flex-wrap items-center justify-center gap-1">
            {tasks.map((task) => {
              const reason = unavailable[task.id]
              const blocked = disabled || Boolean(reason)
              const active = activeTask === task.id
              const Icon = task.icon
              return (
                <button
                  key={task.id}
                  type="button"
                  disabled={blocked}
                  aria-pressed={active}
                  aria-label={`${task.description}${reason ? ` ${reason}` : ''}`}
                  title={`${task.description}${reason ? ` · ${reason}` : ''}`}
                  onClick={() => onTask(task.id)}
                  className={cx(
                    'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors',
                    active ? 'border-accent bg-accent text-bg shadow-[0_3px_10px_-4px_rgb(168_73_20/0.55)]' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-fg',
                    blocked && 'cursor-not-allowed opacity-40',
                  )}
                >
                  <Icon className="size-4" />
                  {task.title}
                </button>
              )
            })}
          </div>
          {review && review.due > 0 ? (
            <Link
              to="/review"
              className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted transition-colors hover:text-fg"
            >
              <Brain className="size-4 text-accent" />
              {review.due} card{review.due === 1 ? '' : 's'} due · Review
            </Link>
          ) : null}
          {activeTask !== 'chat' ? (
            <button
              type="button"
              onClick={onChatOnly}
              disabled={disabled}
              className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-faint underline-offset-2 transition-colors hover:text-fg hover:underline disabled:opacity-40"
            >
              <MessageCircle className="size-4" />
              Use chat only
            </button>
          ) : null}
        </div>
      ) : null}
        </div>
      </div>
    </div>
  )
}

