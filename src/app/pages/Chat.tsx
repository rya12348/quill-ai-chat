import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Download, FileSpreadsheet, Folder, FolderX, Hammer, Layers, MessageCircle, Search, Share2, ShieldCheck, Sparkles } from 'lucide-react'

import { BRAND, DEFAULT_MODEL, MAX_ATTACHMENTS, MAX_ATTACHMENT_TOTAL_BYTES, MODELS, SUGGESTIONS } from '../../shared/config'
import type { Conversation, Message, ModeUsage, ReasoningEffort } from '../../shared/types'
import { Composer, type ComposerToggle } from '../components/Composer'
import { AssistantMessage, UserMessage } from '../components/Message'
import { ShareDialog } from '../components/ShareDialog'
import { Badge, Menu, Spinner, useToast } from '../components/ui'
import { ApiError, useConversation, useMe, useMessageFeedback, useModels, useProjects, useSetConversationModel, useSetConversationProject } from '../lib/api'
import { untilLabel } from '../lib/format'
import { AttachmentError, clipboardFiles, readAttachment, type PendingAttachment } from '../lib/attachments'
import { buildDataset, isDataFile, readDataFile } from '../lib/dataset'
import { getDataset, putDataset } from '../lib/dataset-store'
import { setOffline, useOffline } from '../lib/offline'
import { clearPendingMessage, draftKey, queueMessage, readDraft, usePendingMessage, writeDraft } from '../lib/outbox'
import { dismissTurn, settleAnalysis, startTurn, useTurn } from '../lib/turn'

const MODEL_KEY = 'model'
const EFFORT_KEY = 'effort:level'

export function Chat() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const selectedProjectId = searchParams.get('project')
  const navigate = useNavigate()
  const client = useQueryClient()
  const toast = useToast()
  const { data: me } = useMe()
  const { data: models } = useModels()
  const page = useConversation(id)
  const { data: projectData } = useProjects()
  const projects = projectData?.items ?? []
  const turn = useTurn()
  const setConversationModel = useSetConversationModel()
  const setConversationProject = useSetConversationProject()
  const feedback = useMessageFeedback()
  const offline = useOffline()
  const pending = usePendingMessage()

  const draftStoreKey = draftKey(id)
  const [draft, setDraft] = useState(() => readDraft(draftStoreKey))
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [newModel, setNewModel] = useState(() => localStorage.getItem(MODEL_KEY) ?? DEFAULT_MODEL)
  const [proof, setProof] = useState(() => localStorage.getItem('proof') === 'on')
  const [blend, setBlend] = useState(() => localStorage.getItem('blend') !== 'off')
  const [research, setResearch] = useState(() => localStorage.getItem('research') === 'on')
  const [analyze, setAnalyze] = useState(() => localStorage.getItem('analyze') === 'on')
  const [build, setBuild] = useState(() => localStorage.getItem('build') === 'on')
  const [canvas, setCanvas] = useState(() => localStorage.getItem('canvas') === 'on')
  const [effort, setEffort] = useState<ReasoningEffort>(() => {
    const saved = localStorage.getItem(EFFORT_KEY)
    return saved === 'low' || saved === 'default' || saved === 'max' ? saved : 'default'
  })
  const [shareOpen, setShareOpen] = useState(false)
  // The conversation this page created from "/", so it keeps showing the
  // reply during the moment between the server naming it and the URL changing.
  const owned = useRef<string | null>(null)
  const draftKeyRef = useRef(draftStoreKey)
  useEffect(() => {
    if (draftKeyRef.current === draftStoreKey) return
    draftKeyRef.current = draftStoreKey
    setDraft(readDraft(draftStoreKey))
  }, [draftStoreKey])
  useEffect(() => {
    writeDraft(draftKeyRef.current, draft)
  }, [draft])
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
      owned.current = created.id
      const projectQuery = selectedProjectId ? `?project=${encodeURIComponent(selectedProjectId)}` : ''
      navigate(`/c/${created.id}${projectQuery}`, { replace: true })
      void client.invalidateQueries({ queryKey: ['projects'] })
    },
    [client, navigate, selectedProjectId],
  )

  const conversation = page.data?.conversation
  const currentProject = conversation?.projectId ? projects.find((project) => project.id === conversation.projectId) : undefined
  const saved = page.data?.messages ?? []
  const availableModels = models?.items ?? MODELS.map((m) => ({ ...m, available: true }))
  const selectedModel = availableModels.some((m) => m.id === newModel) ? newModel : availableModels[0]?.id ?? DEFAULT_MODEL
  const model = conversation?.model && availableModels.some((m) => m.id === conversation.model) ? conversation.model : selectedModel
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
  const strategy: 'proof' | 'blend' | 'fast' | 'research' | 'analyze' | 'build' | 'canvas' = buildOn ? 'build' : analyzeOn ? 'analyze' : researchOn ? 'research' : canvasOn ? 'canvas' : proof ? 'proof' : blend ? 'blend' : 'fast'
  // Fast is the plain chat: hide exposed reasoning, including older replies,
  // until an advanced mode is selected. The model can still reason internally.
  const showReasoning = strategy !== 'fast'
  const limitReached = me ? me.usage.used >= me.usage.limit && !busy : false
  const pendingHere = pending !== null && (pending.conversationId ?? null) === (id ?? null)

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
        for (const file of candidates.slice(0, slots)) {
          try {
            const attachment = analyzeOn ? await readDataFile(file) : await readAttachment(file)
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
      })()
    },
    [analyzeOn, attachments, buildOn, researchOn, toast],
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
      if (pending) {
        toast('A saved message is already waiting to send.', 'danger')
        return
      }
      addFiles(files)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [addFiles, busy, limitReached, pending, toast])

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
      if (pending) {
        toast('A saved message is already waiting to send.', 'danger')
        return
      }
      const clientMessageId = crypto.randomUUID()
      let dataset = outgoing[0]?.dataset
      if (analyzeOn && outgoing[0]) {
        try {
          dataset ??= buildDataset(outgoing[0].name, outgoing[0].mime, outgoing[0].size, outgoing[0].data)
          await putDataset(dataset, outgoing[0].data)
        } catch (error) {
          toast(error instanceof Error ? error.message : 'Could not read that table.', 'danger')
          return
        }
      }
      const request = {
        conversationId: id,
        projectId: !id ? selectedProjectId ?? undefined : undefined,
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
      const saveForRetry = () => {
        const stored = queueMessage({
          clientMessageId,
          conversationId: id ?? null,
          projectId: !id ? selectedProjectId ?? null : null,
          content,
          model,
          strategy,
          effort,
          reasoning: effort !== 'low',
          createdAt: Date.now(),
        })
        if (stored) {
          setDraft(content)
          toast("Saved. It will send when you're back online.")
        } else {
          toast('A saved message is already waiting to send.', 'danger')
        }
      }
      if (offline || !navigator.onLine) {
        if (researchOn || buildOn) {
          toast(`${buildOn ? 'Build' : 'Research'} needs a connection. Reconnect and try again.`, 'danger')
          return
        }
        if (outgoing.length) {
          toast('Attachments and datasets need a connection. Keep this page online and try again.', 'danger')
          return
        }
        saveForRetry()
        return
      }
      setDraft('')
      setAttachments([])
      let started = false
      try {
        await startTurn(client, request, { onConversation: openCreated, onStarted: () => { started = true } })
      } catch (error) {
        if (error instanceof ApiError && (error.code === 'offline' || error.status === 0)) {
          setOffline(true)
          saveForRetry()
          return
        }
        if (error instanceof ApiError && error.code === 'duplicate') {
          if (error.conversationId) navigate(`/c/${error.conversationId}`, { replace: true })
          else if (id) void client.invalidateQueries({ queryKey: ['conversation', id] })
          toast('That message was already sent.')
          return
        }
        if (!started) {
          setDraft(content)
          setAttachments(outgoing)
        }
        if (error instanceof ApiError && (error.code === 'limit' || error.code?.endsWith('_limit'))) void client.invalidateQueries({ queryKey: ['me'] })
        toast(error instanceof Error ? error.message : 'Could not send this message', 'danger')
      }
    },
    [analyzeOn, attachments, buildOn, client, effort, id, model, navigate, offline, openCreated, pending, researchOn, selectedProjectId, strategy, toast],
  )

  // A send saved while offline goes out once, when the browser is back online.
  // The server sees the same clientMessageId if this runs twice, so a reload
  // cannot create a duplicate turn.
  const flushing = useRef<string | null>(null)
  useEffect(() => {
    if (!pending || offline) return
    if ((pending.conversationId ?? null) !== (id ?? null)) return
    if (flushing.current === pending.clientMessageId) return
    const item = pending
    flushing.current = item.clientMessageId
    const clearDraftIfUnchanged = () => setDraft((current) => (current === item.content ? '' : current))
    void (async () => {
      try {
        await startTurn(
          client,
          {
            conversationId: item.conversationId ?? undefined,
            projectId: item.projectId ?? undefined,
            content: item.content,
            model: item.model,
            strategy: item.strategy,
            ...(item.effort ? { effort: item.effort } : { reasoning: item.reasoning }),
            clientMessageId: item.clientMessageId,
          },
          {
            onConversation: openCreated,
            onStarted: () => {
              clearPendingMessage(item.clientMessageId)
              clearDraftIfUnchanged()
            },
          },
        )
      } catch (error) {
        if (error instanceof ApiError && error.code === 'duplicate') {
          clearPendingMessage(item.clientMessageId)
          clearDraftIfUnchanged()
          if (error.conversationId && !item.conversationId) {
            navigate(`/c/${error.conversationId}`, { replace: true })
            void client.invalidateQueries({ queryKey: ['conversations'] })
          } else if (item.conversationId) {
            void client.invalidateQueries({ queryKey: ['conversation', item.conversationId] })
          }
          toast('That saved message was already sent.')
        } else if (error instanceof ApiError && (error.code === 'offline' || error.status === 0 || error.status === 503)) {
          setOffline(true)
        } else {
          clearPendingMessage(item.clientMessageId)
          setDraft(item.content)
          toast(error instanceof Error ? error.message : 'Could not send the saved message', 'danger')
        }
      } finally {
        flushing.current = null
      }
    })()
  }, [client, id, navigate, offline, openCreated, pending, toast])

  // A server restart or a flaky connection may not fire a browser `online`
  // event. While a send is waiting, a tiny health probe notices recovery and
  // lets the flush effect above run.
  useEffect(() => {
    if (!pending) return
    let stopped = false
    const probe = async () => {
      try {
        const response = await fetch('/api/health', { cache: 'no-store' })
        if (!stopped && response.ok && response.headers.get('x-quill-offline') !== '1') setOffline(false)
      } catch {
        /* still offline; the next interval tries again */
      }
    }
    void probe()
    const timer = window.setInterval(() => void probe(), 4_000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [pending])

  const regenerate = useCallback(async () => {
    if (!id) return
    try {
      await startTurn(client, { conversationId: id, regenerate: true, model, strategy, effort })
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
    if (conversation) setConversationModel.mutate({ id: conversation.id, model: next })
    else {
      setNewModel(next)
      localStorage.setItem(MODEL_KEY, next)
    }
  }

  const toggleProof = () => {
    const next = !proof
    setProof(next)
    localStorage.setItem('proof', next ? 'on' : 'off')
    if (next) {
      setBlend(false)
      localStorage.setItem('blend', 'off')
      setResearch(false)
      localStorage.setItem('research', 'off')
      setAnalyze(false)
      localStorage.setItem('analyze', 'off')
      setBuild(false)
      localStorage.setItem('build', 'off')
    }
  }

  const toggleBlend = () => {
    const next = !blend
    setBlend(next)
    localStorage.setItem('blend', next ? 'on' : 'off')
    if (next) {
      setProof(false)
      localStorage.setItem('proof', 'off')
      setResearch(false)
      localStorage.setItem('research', 'off')
      setAnalyze(false)
      localStorage.setItem('analyze', 'off')
      setBuild(false)
      localStorage.setItem('build', 'off')
    }
  }

  const toggleResearch = () => {
    if (!canResearch || researchLeft === 0) return
    const next = !research
    setResearch(next)
    localStorage.setItem('research', next ? 'on' : 'off')
    if (next) {
      setProof(false)
      setBlend(false)
      setAttachments([])
      setAnalyze(false)
      setBuild(false)
      localStorage.setItem('proof', 'off')
      localStorage.setItem('blend', 'off')
      localStorage.setItem('analyze', 'off')
      localStorage.setItem('build', 'off')
    }
  }

  const toggleAnalyze = () => {
    if (!canAnalyze || analyzeLeft === 0) return
    const next = !analyze
    setAnalyze(next)
    localStorage.setItem('analyze', next ? 'on' : 'off')
    if (next) {
      setProof(false)
      setBlend(false)
      setResearch(false)
      setBuild(false)
      setAttachments((current) => current.filter((attachment) => isDataFile(attachment.name)).slice(0, 1))
      localStorage.setItem('proof', 'off')
      localStorage.setItem('blend', 'off')
      localStorage.setItem('research', 'off')
      localStorage.setItem('build', 'off')
    }
  }

  const toggleBuild = () => {
    if (!canBuild || buildLeft === 0) return
    const next = !build
    setBuild(next)
    localStorage.setItem('build', next ? 'on' : 'off')
    if (next) {
      setProof(false)
      setBlend(false)
      setResearch(false)
      setAnalyze(false)
      setAttachments([])
      localStorage.setItem('proof', 'off')
      localStorage.setItem('blend', 'off')
      localStorage.setItem('research', 'off')
      localStorage.setItem('analyze', 'off')
    }
  }

  const toggleCanvas = () => {
    if (!canCanvas) return
    const next = !canvas
    setCanvas(next)
    localStorage.setItem('canvas', next ? 'on' : 'off')
    if (next) {
      setProof(false)
      setBlend(false)
      setResearch(false)
      setAnalyze(false)
      setBuild(false)
      setAttachments([])
      localStorage.setItem('proof', 'off')
      localStorage.setItem('blend', 'off')
      localStorage.setItem('research', 'off')
      localStorage.setItem('analyze', 'off')
      localStorage.setItem('build', 'off')
    }
  }

  // Only one advanced mode at a time: turning another one on retires Canvas.
  useEffect(() => {
    if (!canvas || (!proof && !blend && !researchOn && !analyzeOn && !buildOn)) return
    setCanvas(false)
    localStorage.setItem('canvas', 'off')
  }, [analyzeOn, blend, buildOn, canvas, proof, researchOn])

  const toggleChatOnly = () => {
    setProof(false)
    setBlend(false)
    setResearch(false)
    setAnalyze(false)
    setBuild(false)
    setCanvas(false)
    localStorage.setItem('proof', 'off')
    localStorage.setItem('blend', 'off')
    localStorage.setItem('research', 'off')
    localStorage.setItem('analyze', 'off')
    localStorage.setItem('build', 'off')
    localStorage.setItem('canvas', 'off')
  }

  const changeEffort = (next: ReasoningEffort) => {
    setEffort(next)
    localStorage.setItem(EFFORT_KEY, next)
  }

  const composerTools: ComposerToggle[] =
    mode !== 'api'
      ? [
          {
            id: 'chat',
            label: 'Chat only',
            description: 'One direct answer, with no extra mode.',
            pressed: !proof && !blend && !researchOn && !analyzeOn && !buildOn,
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
                label: 'Canvas',
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
        ]
      : []

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
  const lastSavedAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const empty = !id && messages.length === 0 && !mine
  const labelFor = (modelId: string | null | undefined) => (modelId && models?.items.find((model) => model.id === modelId)?.name) || modelId || ''

  const exportChat = () => {
    if (!messages.length) return
    const title = conversation?.title ?? 'Quill chat'
    const parts = [`# ${title}`, '']
    for (const message of messages) {
      parts.push(message.role === 'user' ? '## You' : '## Quill', '', message.content)
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
        parts.push('', `### Build · ${message.build.title}`, '', '```html', message.build.html, '```')
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
    const name = title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'quill-chat'
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
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [messages.length, pendingUser, turn?.text, turn?.reasoning, turn?.statusText, id])
  useEffect(() => {
    stick.current = true
  }, [id])

  if (id && page.isLoading) {
    return (
      <div className="grid flex-1 place-items-center">
        <Spinner />
      </div>
    )
  }
  if (id && page.error) {
    // A cached read that the service worker could not satisfy is different
    // from a chat that was deleted: say so, and offer a retry.
    const unavailableOffline =
      page.error instanceof ApiError && (page.error.code === 'offline' || page.error.status === 503)
    return (
      <div className="grid flex-1 place-items-center p-6 text-center">
        <div>
          <p className="text-[15px] font-medium">{unavailableOffline ? 'Not available offline' : 'This chat is not here any more.'}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            {unavailableOffline ? 'Open this conversation once while you are online and it will be kept for offline reading.' : 'It may have been deleted.'}
          </p>
          {unavailableOffline ? (
            <button type="button" onClick={() => void page.refetch()} className="mt-2 text-[13.5px] text-muted underline underline-offset-2 hover:text-fg">
              Try again
            </button>
          ) : (
            <button type="button" onClick={() => navigate('/')} className="mt-2 text-[13.5px] text-muted underline underline-offset-2 hover:text-fg">
              Start a new one
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 px-3 md:h-14 md:px-5">
        {mode === 'public' && <Badge className="hidden sm:inline-flex">{buildOn ? 'Build' : canvasOn ? 'Canvas' : analyzeOn ? 'Analyze' : researchOn ? 'Research' : proof ? 'Proof' : 'Free model'}</Badge>}
        {(conversation || messages.length > 0) && (
          <div className="ml-auto flex items-center gap-0.5">
            {conversation && projectItems.length > 0 && (
              <Menu
                align="end"
                trigger={
                  <button
                    type="button"
                    aria-label="Move chat to a project"
                    title={currentProject ? `Project: ${currentProject.name}` : 'Move chat to a project'}
                    className="inline-flex h-8 max-w-[150px] shrink-0 items-center gap-1.5 rounded-tile px-2 text-[12.5px] text-faint transition-colors hover:bg-surface-2 hover:text-fg"
                  >
                    <Folder className="size-3.5 shrink-0" />
                    <span className="hidden truncate sm:inline">{currentProject?.name ?? 'Project'}</span>
                  </button>
                }
                items={projectItems}
              />
            )}
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
                onClick={exportChat}
                aria-label="Export chat"
                title="Export as Markdown"
                className="grid size-8 shrink-0 place-items-center rounded-tile text-faint transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <Download className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      <div ref={scroller} onScroll={onScroll} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[760px] px-4 pb-6 pt-2 md:px-6">
          {empty ? (
            <EmptyState onPick={(text) => void send(text)} disabled={limitReached} buildOn={buildOn} canvasOn={canvasOn} />
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
                    sources={message.sources}
                    team={message.team}
                    proof={message.proof}
                    research={message.research}
                    analysis={message.analysis}
                    build={message.build}
                    canvas={message.canvas}
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
                  sources={turn.sources}
                  team={turn.team}
                  proof={turn.proof}
                  research={turn.research}
                  analysis={turn.analysis}
                  build={turn.build}
                  canvas={turn.canvas}
                  statusText={turn.statusText}
                  statusLog={turn.statusLog}
                  model={labelFor(turn.model)}
                  streaming={turn.status !== 'error'}
                  error={turn.status === 'error' ? turn.error : null}
                    onRetry={() => {
                      dismissTurn()
                      void regenerate()
                    }}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[760px] px-4 pb-4 md:px-6 md:pb-6">
        {pendingHere && (
          <p role="status" className="mb-2 rounded-control bg-surface-2 px-3 py-2 text-[12.5px] leading-relaxed text-muted">
            Draft saved offline. It will send automatically when you&apos;re back online.
          </p>
        )}
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
            model={model}
            onChangeModel={changeModel}
            effort={mode === 'public' && me?.capabilities.reasoning ? effort : undefined}
            onChangeEffort={changeEffort}
            onAttach={addFiles}
            onRemoveAttachment={(attachmentId) => setAttachments((current) => current.filter((item) => item.id !== attachmentId))}
            onSend={() => void send(draft)}
            onStop={() => turn?.stop()}
            busy={busy}
            placeholder={buildOn ? 'Describe a site, landing page or tool — or paste a public site to show live…' : canvasOn ? 'What should the flashcards or quiz cover?' : analyzeOn ? 'Upload a table, then ask a question…' : researchOn ? 'Ask a question to research…' : `Message ${BRAND}`}
            autoFocus
          />
        )}
      </div>
      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} conversationId={conversation?.id} />
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
  return <p className="rounded-control bg-surface-2 px-4 py-3 text-center text-[13.5px] text-muted">{children}</p>
}

function EmptyState({ onPick, disabled, buildOn, canvasOn }: { onPick: (text: string) => void; disabled: boolean; buildOn: boolean; canvasOn: boolean }) {
  const suggestions = buildOn
    ? [
        'Build a landing page for a neighborhood coffee shop',
        'Build a personal portfolio for a product designer',
        'Build a small budget calculator with a chart',
        'Show poki.com live inside a sandboxed page',
      ]
    : canvasOn
      ? [
          'Flashcards for the cell biology basics',
          'Make a quiz on the French Revolution for a high-school class',
          'Flashcards for common Spanish verbs in the present tense',
          'Quiz me on Python list comprehensions',
        ]
      : SUGGESTIONS
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="flex min-h-[52vh] flex-col items-center justify-end pb-8 text-center">
      <h1 className="text-balance text-[28px] font-semibold tracking-[-0.02em] md:text-[32px]">What can I help with?</h1>
      <p className="mt-2 max-w-[430px] text-balance text-[13.5px] leading-relaxed text-faint">
        Free models, no key needed. Proof runs independent tests; Research returns a cited web report; Analyze runs Python on your table in the browser; Build makes a page, tool or game, and can open a live site through a proxy; Canvas makes flashcards or a practice quiz; Deep adds drafts and review; Effort sets how much extra reasoning the model spends.
      </p>
      <ul className="mt-6 grid w-full gap-2 sm:grid-cols-2">
        {suggestions.map((text) => (
          <li key={text}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(text)}
              className="h-full w-full rounded-card border border-line bg-surface px-4 py-3 text-left text-[13.5px] leading-snug text-muted shadow-[0_1px_1px_rgb(27_26_23/0.03)] transition-[border-color,color,background-color] hover:border-line-strong hover:text-fg disabled:opacity-50"
            >
              {text}
            </button>
          </li>
        ))}
      </ul>
    </motion.div>
  )
}
