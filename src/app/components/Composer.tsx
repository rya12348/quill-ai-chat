import { ArrowUp, Camera, Check, ChevronDown, FileText, Link2, Loader2, Paperclip, Plus, Square, Wrench, X, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'

import { MAX_MESSAGE_CHARS } from '../../shared/config'
import { formatTokenCount } from '../../shared/tokens'
import type { ReasoningEffort } from '../../shared/types'
import { cx } from '../lib/cx'
import { ATTACHMENT_ACCEPT, clipboardFiles, formatFileSize, MAX_ATTACHMENTS, type PendingAttachment } from '../lib/attachments'
import type { ModelChoice, ModelPreset } from '../lib/model-presets'
import { ModelPicker } from './ModelPicker'
import { Button, Dialog } from './ui'

export type ComposerToggle = {
  id: string
  label: string
  /** A short explanation that is always visible in the menu. */
  description: string
  pressed: boolean
  icon: LucideIcon
  onClick: () => void
  /** A short allowance note shown beside the label, e.g. "2 of 3 left today". */
  note?: string
  /** The mode's allowance is used up, so it cannot be selected. */
  disabled?: boolean
  /** Supplemental browser tooltip; the visible description is the real label. */
  title?: string
}

export function Composer({
  value,
  onChange,
  attachments,
  tools,
  replyUsage,
  tokenCount,
  model,
  onChangeModel,
  modelPreset,
  onChangeModelPreset,
  effort,
  onChangeEffort,
  onAttach,
  onAddLink,
  onRemoveAttachment,
  onSend,
  onStop,
  busy,
  disabled,
  openFilePicker,
  focusRequest,
  placeholder,
  placeholderPrompts,
  autoFocus,
}: {
  value: string
  onChange: (value: string) => void
  attachments: PendingAttachment[]
  /** All optional modes, grouped behind one menu. */
  tools?: ComposerToggle[]
  /** The shared daily reply allowance shown at the bottom of the menu. */
  replyUsage?: { used: number; limit: number }
  /** A rough token estimate for the conversation and current draft. */
  tokenCount?: number
  /** The selected model, shown in the compact composer toolbar. */
  model?: string
  onChangeModel?: (id: string) => void
  /** Auto/Fast/Best resolution policy, or manual selection. */
  modelPreset?: ModelChoice
  onChangeModelPreset?: (preset: ModelPreset) => void
  /** Reasoning budget for the free lanes. */
  effort?: ReasoningEffort
  onChangeEffort?: (effort: ReasoningEffort) => void
  onAttach: (files: File[]) => void
  /** Adds a web address as a text attachment when the host page supports it. */
  onAddLink?: (url: string) => void
  onRemoveAttachment: (id: string) => void
  onSend: () => void
  onStop: () => void
  /** A reply is being generated. */
  busy: boolean
  disabled?: boolean
  openFilePicker?: number
  /** Increment to move focus back into the textarea, e.g. after a starter prompt. */
  focusRequest?: number
  placeholder?: string
  /** Example prompts to type and delete while the composer is empty. */
  placeholderPrompts?: string[]
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const filePickerRequestRef = useRef(openFilePicker ?? 0)
  const focusRequestRef = useRef(0)
  const toolsRef = useRef<HTMLDivElement>(null)
  const toolsTriggerRef = useRef<HTMLButtonElement>(null)
  const attachRef = useRef<HTMLDivElement>(null)
  const attachTriggerRef = useRef<HTMLButtonElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const cameraRequestRef = useRef(0)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const [linkError, setLinkError] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [placeholderText, setPlaceholderText] = useState('')
  const [placeholderDeleting, setPlaceholderDeleting] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
  }, [value])
  useEffect(() => {
    setPlaceholderIndex(0)
    setPlaceholderText('')
    setPlaceholderDeleting(false)
  }, [placeholderPrompts])
  useEffect(() => {
    const prompts = placeholderPrompts?.filter((prompt) => prompt.length > 0) ?? []
    if (!prompts.length || value || disabled) return
    const prompt = prompts[placeholderIndex % prompts.length]
    if (!prompt) return
    let delay = placeholderDeleting ? 26 : 55
    if (!placeholderDeleting && placeholderText === prompt) delay = 1_600
    if (placeholderDeleting && placeholderText.length === 0) delay = 260
    const timer = window.setTimeout(() => {
      if (!placeholderDeleting) {
        if (placeholderText.length < prompt.length) {
          setPlaceholderText(prompt.slice(0, placeholderText.length + 1))
        } else {
          setPlaceholderDeleting(true)
        }
        return
      }
      if (placeholderText.length > 0) {
        setPlaceholderText(prompt.slice(0, placeholderText.length - 1))
        return
      }
      setPlaceholderDeleting(false)
      setPlaceholderIndex((index) => (index + 1) % prompts.length)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [disabled, placeholderDeleting, placeholderIndex, placeholderPrompts, placeholderText, value])
  useEffect(() => {
    // Focus without scrolling: the empty state sits above the composer, and
    // scrolling it out of view on load made the first screen look broken.
    if (autoFocus && !disabled) ref.current?.focus({ preventScroll: true })
  }, [autoFocus, disabled])
  useEffect(() => {
    if (!openFilePicker || openFilePicker === filePickerRequestRef.current) return
    filePickerRequestRef.current = openFilePicker
    if (!disabled && !busy) fileRef.current?.click()
  }, [openFilePicker, disabled, busy])
  useEffect(() => {
    if (!focusRequest || focusRequest === focusRequestRef.current) return
    focusRequestRef.current = focusRequest
    if (!disabled && !busy) ref.current?.focus()
  }, [focusRequest, disabled, busy])
  useEffect(() => {
    if (!toolsOpen) return
    const onDown = (event: MouseEvent) => {
      if (toolsRef.current?.contains(event.target as Node)) return
      setToolsOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setToolsOpen(false)
        toolsTriggerRef.current?.focus()
        return
      }
      const menu = toolsRef.current?.querySelector<HTMLElement>('[role="menu"]')
      if (!menu || !(event.target instanceof Node) || !menu.contains(event.target)) return
      const items = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]:not(:disabled)'))
      if (!items.length) return
      const current = items.indexOf(document.activeElement as HTMLButtonElement)
      let next: number
      switch (event.key) {
        case 'ArrowDown':
          next = current < 0 ? 0 : (current + 1) % items.length
          break
        case 'ArrowUp':
          next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length
          break
        case 'Home':
          next = 0
          break
        case 'End':
          next = items.length - 1
          break
        default:
          return
      }
      event.preventDefault()
      items[next]?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [toolsOpen])
  useEffect(() => {
    if (toolsOpen) toolsRef.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"]:not(:disabled)')?.focus()
  }, [toolsOpen])
  useEffect(() => {
    if (!attachOpen) return
    const onDown = (event: MouseEvent) => {
      if (attachRef.current?.contains(event.target as Node)) return
      setAttachOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setAttachOpen(false)
        attachTriggerRef.current?.focus()
        return
      }
      const menu = attachRef.current?.querySelector<HTMLElement>('[role="menu"]')
      if (!menu || !(event.target instanceof Node) || !menu.contains(event.target)) return
      const items = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'))
      if (!items.length) return
      const current = items.indexOf(document.activeElement as HTMLButtonElement)
      let next: number
      switch (event.key) {
        case 'ArrowDown':
          next = current < 0 ? 0 : (current + 1) % items.length
          break
        case 'ArrowUp':
          next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length
          break
        case 'Home':
          next = 0
          break
        case 'End':
          next = items.length - 1
          break
        default:
          return
      }
      event.preventDefault()
      items[next]?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [attachOpen])
  useEffect(() => {
    if (attachOpen) attachRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
  }, [attachOpen])
  useEffect(() => {
    if (disabled || busy || attachments.length >= MAX_ATTACHMENTS) setAttachOpen(false)
  }, [attachments.length, busy, disabled])
  useEffect(() => () => {
    cameraRequestRef.current += 1
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null
  }, [])
  useEffect(() => {
    const video = videoRef.current
    const stream = cameraStreamRef.current
    if (!cameraReady || !video || !stream) return
    video.srcObject = stream
    void video.play().catch(() => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null
      setCameraReady(false)
      setCameraError('The camera preview could not start. Choose a file instead.')
    })
  }, [cameraReady])
  const canSend = !disabled && !busy && (value.trim().length > 0 || attachments.length > 0) && value.length <= MAX_MESSAGE_CHARS
  const onFilesPicked = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    setAttachOpen(false)
    if (files.length) onAttach(files)
  }
  const closeCamera = () => {
    cameraRequestRef.current += 1
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null
    setCameraOpen(false)
    setCameraReady(false)
    setCameraError('')
  }
  const openCamera = async () => {
    setAttachOpen(false)
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraRef.current?.click()
      return
    }
    const request = ++cameraRequestRef.current
    setCameraOpen(true)
    setCameraReady(false)
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      if (request !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      cameraStreamRef.current = stream
      setCameraReady(true)
    } catch {
      if (request === cameraRequestRef.current) {
        setCameraError('Camera access was blocked or no camera is available. Choose a file instead.')
      }
    }
  }
  const takePhoto = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      setCameraError('Could not capture that photo. Choose a file instead.')
      return
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
          cameraStreamRef.current = null
          setCameraReady(false)
          setCameraError('Could not capture that photo. Choose a file instead.')
          return
        }
        const name = `photo-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}.jpg`
        onAttach([new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })])
        closeCamera()
      },
      'image/jpeg',
      0.9,
    )
  }
  const submitLink = () => {
    if (!onAddLink) return
    const value = linkValue.trim()
    if (!value) return
    if (/\s/.test(value)) {
      setLinkError('Enter a web address without spaces, such as example.com/article.')
      return
    }
    try {
      const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol')
      if (!url.hostname.includes('.') && url.hostname !== 'localhost') throw new Error('host')
      onAddLink(url.toString())
      setLinkOpen(false)
      setLinkValue('')
      setLinkError('')
    } catch {
      setLinkError('Enter a full web address, such as example.com/article.')
    }
  }
  const animatedPlaceholder = Boolean(placeholderPrompts?.length && !value)
  // "Chat only" is the absence of a tool, not an active mode. Keeping it quiet
  // leaves the composer's accent for the send action and real tool selection.
  const activeTool = tools?.find((tool) => tool.pressed && tool.id !== 'chat')
  const TriggerIcon = activeTool?.icon ?? Wrench
  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (canSend) onSend()
    }
  }
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = clipboardFiles(e.clipboardData)
    if (!files.length) return
    // A screenshot pasted as a file must not also become a data-URL in the
    // textarea. Text-only pastes still take the normal browser path.
    e.preventDefault()
    if (!disabled && !busy) onAttach(files)
  }
  const over = value.length > MAX_MESSAGE_CHARS
  return (
    <div className={cx('rounded-[20px] border border-line-strong/80 bg-surface shadow-composer transition-[box-shadow,border-color] focus-within:border-accent/40', disabled && 'opacity-70')}>
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-3" aria-label="Attachments">
          {attachments.map((attachment) =>
            attachment.kind === 'image' ? (
              <div key={attachment.id} className="group/attachment relative">
                <img
                  src={attachment.data}
                  alt={attachment.name}
                  title={attachment.name}
                  className="size-14 rounded-[10px] border border-line object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(attachment.id)}
                  aria-label={`Remove ${attachment.name}`}
                  className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-line bg-accent text-bg shadow-sm transition-transform hover:scale-105"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <span key={attachment.id} className="inline-flex max-w-[230px] items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1.5 text-[13px] text-muted" title={attachment.name}>
                {attachment.mime === 'text/uri-list' ? (
                  <Link2 className="size-3.5 shrink-0" />
                ) : (
                  <FileText className="size-3.5 shrink-0" />
                )}
                <span className="truncate">{attachment.name}</span>
                {attachment.mime === 'text/uri-list' ? null : (
                  <span className="shrink-0 text-faint">{formatFileSize(attachment.size)}</span>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(attachment.id)}
                  aria-label={`Remove ${attachment.name}`}
                  className="ml-0.5 grid size-4 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-surface hover:text-fg"
                >
                  <X className="size-3" />
                </button>
              </span>
            ),
          )}
        </div>
      )}
      <div className="relative">
        {animatedPlaceholder ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-4 right-4 top-4 truncate text-[16px] leading-[1.5] text-faint"
          >
            {placeholderText}
          </span>
        ) : null}
        <textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled}
          placeholder={animatedPlaceholder ? undefined : placeholder ?? 'Message'}
          aria-label="Message"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          className="scrollbar-thin block w-full resize-none bg-transparent px-4 pb-1.5 pt-4 text-[16px] leading-[1.5] text-fg placeholder:text-faint focus:outline-none"
        />
      </div>
      <div className="relative flex items-center justify-between px-1.5 pb-2">
        <div className="flex min-w-0 flex-wrap items-center gap-0.5 pr-1">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ATTACHMENT_ACCEPT}
            className="hidden"
            onChange={onFilesPicked}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onFilesPicked}
          />
          <div ref={attachRef} className="relative inline-flex">
            <button
              ref={attachTriggerRef}
              type="button"
              aria-haspopup="menu"
              aria-expanded={attachOpen}
              aria-label="Add an attachment"
              title="Add an image, file or photo"
              onClick={() => setAttachOpen((open) => !open)}
              disabled={disabled || busy || attachments.length >= MAX_ATTACHMENTS}
              className={cx('grid size-9 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-40', attachOpen ? 'bg-surface-2 text-fg' : 'text-faint hover:bg-surface-2 hover:text-fg')}
            >
              <Plus className="size-[19px]" />
            </button>
            {attachOpen && (
              <div role="menu" aria-label="Add an attachment" className="absolute bottom-full left-0 z-30 mb-2 w-[218px] overflow-hidden rounded-[14px] border border-line bg-surface p-1 shadow-pop">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAttachOpen(false)
                    fileRef.current?.click()
                  }}
                  className="flex w-full items-start gap-2.5 rounded-tile px-2.5 py-2 text-left text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                >
                  <Paperclip className="mt-0.5 size-4 shrink-0" />
                  <span>
                    <span className="block text-[13.5px] font-medium">Attach files</span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-faint">Images, PDFs and text</span>
                  </span>
                </button>
                {onAddLink ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAttachOpen(false)
                      setLinkOpen(true)
                    }}
                    className="flex w-full items-start gap-2.5 rounded-tile px-2.5 py-2 text-left text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                  >
                    <Link2 className="mt-0.5 size-4 shrink-0" />
                    <span>
                      <span className="block text-[13.5px] font-medium">Add a link</span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-faint">Include a web address</span>
                    </span>
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void openCamera()}
                  className="flex w-full items-start gap-2.5 rounded-tile px-2.5 py-2 text-left text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                >
                  <Camera className="mt-0.5 size-4 shrink-0" />
                  <span>
                    <span className="block text-[13.5px] font-medium">Take photo</span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-faint">Use your camera</span>
                  </span>
                </button>
              </div>
            )}
          </div>
          {tools?.length ? (
            <div ref={toolsRef} className="relative inline-flex">
              <button
                ref={toolsTriggerRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={toolsOpen}
                aria-label={activeTool ? `Tools, ${activeTool.label} selected` : 'Tools'}
                title={activeTool ? `Tools: ${activeTool.label}` : 'Tools'}
                onClick={() => setToolsOpen((open) => !open)}
                className={cx(
                  'inline-flex h-8 min-w-0 items-center gap-1 rounded-tile px-2.5 text-[13px] font-medium transition-colors',
                  toolsOpen ? 'bg-surface-2 text-fg' : activeTool ? 'bg-accent-soft text-accent hover:bg-accent-soft/80' : 'text-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                <TriggerIcon className="size-3.5 shrink-0" />
                <span className="max-w-[8.5rem] truncate">Tools{activeTool ? ` · ${activeTool.label}` : ''}</span>
                <ChevronDown className={cx('size-3 transition-transform', activeTool && !toolsOpen ? 'text-accent/60' : 'text-faint', toolsOpen && 'rotate-180')} />
              </button>
              {toolsOpen && (
                <div
                  role="menu"
                  aria-label="Tools"
                  className="scrollbar-thin absolute bottom-full left-0 z-30 mb-2 max-h-[min(70vh,30rem)] w-[292px] max-w-[calc(100vw-3.5rem)] overflow-y-auto rounded-[16px] border border-line bg-surface p-1 shadow-pop"
                >
                  <div className="flex items-center justify-between px-2.5 pb-1.5 pt-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Tools</span>
                    <span className="text-[11.5px] text-faint">One at a time</span>
                  </div>
                  {tools.map(({ id, label, description, title, pressed, note, disabled: unavailable, icon: Icon, onClick }) => (
                    <button
                      key={id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={pressed}
                      aria-disabled={unavailable || undefined}
                      disabled={unavailable}
                      title={title}
                      onClick={() => {
                        setToolsOpen(false)
                        onClick()
                        toolsTriggerRef.current?.focus()
                      }}
                      className={cx(
                        'flex w-full items-start gap-2 rounded-tile px-2.5 py-2 text-left transition-colors',
                        unavailable
                          ? 'cursor-not-allowed opacity-40'
                          : pressed
                            ? 'bg-accent-soft/70 text-fg'
                            : 'text-muted hover:bg-surface-2 hover:text-fg',
                      )}
                    >
                      <Icon className="mt-0.5 size-3.5 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="truncate text-[14px] font-medium">{label}</span>
                          {note && (
                            <span className={cx('ml-auto shrink-0 text-[11.5px] font-normal tabular-nums', unavailable ? 'text-danger' : 'text-faint')}>
                              {note}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-[11.5px] font-normal leading-snug text-faint">{description}</span>
                      </span>
                      <Check className={cx('mt-0.5 size-3.5 shrink-0', pressed ? 'text-accent' : 'text-transparent')} />
                    </button>
                  ))}
                  {replyUsage && (
                    <div className="mt-1 border-t border-line px-2.5 pb-1 pt-2 text-[11px] leading-snug text-faint">
                      {Math.max(0, replyUsage.limit - replyUsage.used)} of {replyUsage.limit} replies left today
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
          {model && onChangeModel ? (
            <ModelPicker
              value={model}
              onChange={onChangeModel}
              preset={modelPreset}
              onPreset={onChangeModelPreset}
              effort={effort}
              onChangeEffort={onChangeEffort}
              disabled={busy}
              placement="up"
            />
          ) : null}
          <span className={cx('ml-0.5 text-[13px] tabular-nums', over ? 'text-danger' : 'text-transparent')} aria-live="polite">
            {over ? `${value.length.toLocaleString()} / ${MAX_MESSAGE_CHARS.toLocaleString()}` : ''}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {tokenCount ? (
            <span
              className="text-[10.5px] tabular-nums text-faint"
              title="Rough estimate for this conversation, including your draft. Actual usage also includes system prompts and may be higher."
              aria-label={`Estimated ${formatTokenCount(tokenCount)} tokens`}
            >
              ~{formatTokenCount(tokenCount)} tok
            </span>
          ) : null}
          {busy ? (
            <button type="button" onClick={onStop} aria-label="Stop" className="grid size-9 place-items-center rounded-full bg-accent text-bg shadow-[0_3px_10px_-3px_rgb(168_73_20/0.5)] transition-transform active:scale-95">
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              aria-label="Send"
              className="grid size-9 place-items-center rounded-full bg-accent text-bg shadow-[0_3px_10px_-3px_rgb(168_73_20/0.5)] transition-[opacity,transform] hover:bg-accent-strong active:scale-95 disabled:opacity-45 disabled:shadow-none"
            >
              <ArrowUp className="size-4" />
            </button>
          )}
        </div>
      </div>
      <Dialog
        open={linkOpen}
        onClose={() => {
          setLinkOpen(false)
          setLinkValue('')
          setLinkError('')
        }}
        title="Add a link"
        description="Include a web address in this message."
        width={430}
        footer={
          <>
            <Button
              onClick={() => {
                setLinkOpen(false)
                setLinkValue('')
                setLinkError('')
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={submitLink} disabled={!linkValue.trim()}>
              Add link
            </Button>
          </>
        }
      >
        <label className="block text-[12.5px] font-medium text-muted" htmlFor="composer-link-url">
          Web address
        </label>
        <input
          id="composer-link-url"
          type="url"
          inputMode="url"
          autoFocus
          value={linkValue}
          onChange={(event) => {
            setLinkValue(event.target.value)
            setLinkError('')
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            submitLink()
          }}
          placeholder="https://example.com/article"
          className="mt-1.5 h-10 w-full rounded-control border border-line bg-bg px-3 text-[14px] text-fg outline-none placeholder:text-faint focus:border-accent/60"
        />
        {linkError ? (
          <p role="alert" className="mt-2 text-[12px] text-warning">
            {linkError}
          </p>
        ) : null}
      </Dialog>
      <Dialog
        open={cameraOpen}
        onClose={closeCamera}
        title="Take a photo"
        description="Use your camera to add a picture to this message."
        width={540}
        footer={
          cameraError ? (
            <>
              <Button onClick={closeCamera}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => {
                  closeCamera()
                  fileRef.current?.click()
                }}
              >
                Choose a file instead
              </Button>
            </>
          ) : (
            <>
              <Button onClick={closeCamera}>Cancel</Button>
              <Button variant="primary" disabled={!cameraReady} onClick={takePhoto}>
                Capture photo
              </Button>
            </>
          )
        }
      >
        <div className="relative grid min-h-[220px] place-items-center overflow-hidden rounded-[12px] bg-black">
          {cameraError ? (
            <p className="max-w-[320px] px-5 py-10 text-center text-[13.5px] leading-relaxed text-white/80">{cameraError}</p>
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className="max-h-[55vh] w-full object-contain" />
          )}
          {!cameraReady && !cameraError ? (
            <span className="absolute inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-[12.5px] text-white/85">
              <Loader2 className="size-3.5 animate-spin" />
              Starting camera…
            </span>
          ) : null}
        </div>
      </Dialog>
    </div>
  )
}
