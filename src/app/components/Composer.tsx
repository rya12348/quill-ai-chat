import { ArrowUp, Check, ChevronDown, FileText, Plus, Square, Wrench, X, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'

import { MAX_MESSAGE_CHARS } from '../../shared/config'
import type { ReasoningEffort } from '../../shared/types'
import { cx } from '../lib/cx'
import { ATTACHMENT_ACCEPT, clipboardFiles, formatFileSize, MAX_ATTACHMENTS, type PendingAttachment } from '../lib/attachments'
import type { ModelChoice, ModelPreset } from '../lib/model-presets'
import { ModelPicker } from './ModelPicker'

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

const EFFORT_OPTIONS: { value: ReasoningEffort; label: string; title: string }[] = [
  { value: 'low', label: 'Low', title: 'Fastest: skip the extra reasoning pass' },
  { value: 'default', label: 'Default', title: 'Balanced: ask supported free lanes for medium reasoning' },
  { value: 'max', label: 'Max', title: 'Max reasoning: slower and uses more tokens' },
]

export function Composer({
  value,
  onChange,
  attachments,
  tools,
  replyUsage,
  model,
  onChangeModel,
  modelPreset,
  onChangeModelPreset,
  effort,
  onChangeEffort,
  onAttach,
  onRemoveAttachment,
  onSend,
  onStop,
  busy,
  disabled,
  openFilePicker,
  placeholder,
  autoFocus,
}: {
  value: string
  onChange: (value: string) => void
  attachments: PendingAttachment[]
  /** All optional modes, grouped behind one menu. */
  tools?: ComposerToggle[]
  /** The shared daily reply allowance shown at the bottom of the menu. */
  replyUsage?: { used: number; limit: number }
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
  onRemoveAttachment: (id: string) => void
  onSend: () => void
  onStop: () => void
  /** A reply is being generated. */
  busy: boolean
  disabled?: boolean
  openFilePicker?: number
  placeholder?: string
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const filePickerRequestRef = useRef(openFilePicker ?? 0)
  const effortTriggerRef = useRef<HTMLButtonElement>(null)
  const effortPanelRef = useRef<HTMLDivElement>(null)
  const toolsRef = useRef<HTMLDivElement>(null)
  const toolsTriggerRef = useRef<HTMLButtonElement>(null)
  const [effortOpen, setEffortOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
  }, [value])
  useEffect(() => {
    if (autoFocus && !disabled) ref.current?.focus()
  }, [autoFocus, disabled])
  useEffect(() => {
    if (!openFilePicker || openFilePicker === filePickerRequestRef.current) return
    filePickerRequestRef.current = openFilePicker
    if (!disabled && !busy) fileRef.current?.click()
  }, [openFilePicker, disabled, busy])
  useEffect(() => {
    if (!effortOpen) return
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (effortTriggerRef.current?.contains(target) || effortPanelRef.current?.contains(target)) return
      setEffortOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEffortOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [effortOpen])
  useEffect(() => {
    if (effortOpen) effortPanelRef.current?.querySelector<HTMLInputElement>('input[type="range"]')?.focus()
  }, [effortOpen])
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
  const canSend = !disabled && !busy && (value.trim().length > 0 || attachments.length > 0) && value.length <= MAX_MESSAGE_CHARS
  const selectedEffort = EFFORT_OPTIONS.find((option) => option.value === effort) ?? EFFORT_OPTIONS[1]!
  const effortIndex = Math.max(0, EFFORT_OPTIONS.findIndex((option) => option.value === effort))
  const activeTool = tools?.find((tool) => tool.pressed)
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
  const effortControl =
    effort && onChangeEffort ? (
      <button
        ref={effortTriggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={effortOpen}
        aria-label={`Effort: ${selectedEffort.label}`}
        title={`Effort: ${selectedEffort.label}`}
        onClick={() => setEffortOpen((open) => !open)}
        className={cx(
          'inline-flex h-7 shrink-0 items-center gap-1 rounded-tile px-2 text-[12px] font-medium transition-colors',
          effortOpen ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
        )}
      >
        {selectedEffort.label}
        <ChevronDown className={cx('size-3 text-faint transition-transform', effortOpen && 'rotate-180')} />
      </button>
    ) : null
  return (
    <div className={cx('rounded-[22px] bg-surface shadow-composer transition-[box-shadow] focus-within:shadow-[0_1px_2px_rgb(27_26_23/0.05),0_8px_32px_-12px_rgb(27_26_23/0.22),0_0_0_1px_rgb(27_26_23/0.14)]', disabled && 'opacity-70')}>
      {model && onChangeModel && (
        <div className="flex items-center gap-2 px-3 pt-2">
          <ModelPicker value={model} onChange={onChangeModel} preset={modelPreset} onPreset={onChangeModelPreset} disabled={busy} placement="up" />
        </div>
      )}
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
                  className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-line bg-fg text-white shadow-sm transition-transform hover:scale-105"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <span key={attachment.id} className="inline-flex max-w-[230px] items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1.5 text-[12px] text-muted" title={attachment.name}>
                <FileText className="size-3.5 shrink-0" />
                <span className="truncate">{attachment.name}</span>
                <span className="shrink-0 text-faint">{formatFileSize(attachment.size)}</span>
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
      <textarea
        ref={ref}
        rows={1}
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? 'Message'}
        aria-label="Message"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        className="scrollbar-thin block w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[15px] leading-[1.5] text-fg placeholder:text-faint focus:outline-none"
      />
      <div className="relative flex items-center justify-between px-1.5 pb-2">
        <div className="flex min-w-0 flex-wrap items-center gap-0.5 pr-1">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ATTACHMENT_ACCEPT}
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? [])
              event.currentTarget.value = ''
              if (files.length) onAttach(files)
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || busy || attachments.length >= MAX_ATTACHMENTS}
            aria-label="Attach files"
            title={`Attach up to ${MAX_ATTACHMENTS} images or text files`}
            className="grid size-8 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40"
          >
            <Plus className="size-[18px]" />
          </button>
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
                  'inline-flex h-7 shrink-0 items-center gap-1 rounded-tile px-2 text-[12px] font-medium transition-colors',
                  toolsOpen ? 'bg-surface-2 text-fg' : activeTool ? 'bg-fg text-white hover:bg-[#2e2c27]' : 'text-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                <TriggerIcon className="size-3.5" />
                <span className="whitespace-nowrap">Tools{activeTool ? ` · ${activeTool.label}` : ''}</span>
                <ChevronDown className={cx('size-3 transition-transform', activeTool && !toolsOpen ? 'text-white/60' : 'text-faint', toolsOpen && 'rotate-180')} />
              </button>
              {toolsOpen && (
                <div
                  role="menu"
                  aria-label="Tools"
                  className="scrollbar-thin absolute bottom-full left-0 z-30 mb-2 max-h-[min(70vh,30rem)] w-[292px] max-w-[calc(100vw-3.5rem)] overflow-y-auto rounded-[16px] border border-line bg-surface p-1 shadow-pop"
                >
                  <div className="flex items-center justify-between px-2.5 pb-1.5 pt-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">Tools</span>
                    <span className="text-[10.5px] text-faint">One at a time</span>
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
                            ? 'bg-surface-2 text-fg'
                            : 'text-muted hover:bg-surface-2 hover:text-fg',
                      )}
                    >
                      <Icon className="mt-0.5 size-3.5 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="truncate text-[13px] font-medium">{label}</span>
                          {note && (
                            <span className={cx('ml-auto shrink-0 text-[10px] font-normal tabular-nums', unavailable ? 'text-danger' : 'text-faint')}>
                              {note}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-[10.5px] font-normal leading-snug text-faint">{description}</span>
                      </span>
                      <Check className={cx('mt-0.5 size-3.5 shrink-0', pressed ? 'text-accent' : 'text-transparent')} />
                    </button>
                  ))}
                  {replyUsage && (
                    <div className="mt-1 border-t border-line px-2.5 pb-1 pt-2 text-[10px] leading-snug text-faint">
                      {Math.max(0, replyUsage.limit - replyUsage.used)} of {replyUsage.limit} replies left today
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
          {effortControl}
          <span className={cx('ml-0.5 text-[12px] tabular-nums', over ? 'text-danger' : 'text-transparent')} aria-live="polite">
            {over ? `${value.length.toLocaleString()} / ${MAX_MESSAGE_CHARS.toLocaleString()}` : ''}
          </span>
        </div>
        {effort && onChangeEffort && effortOpen && (
          <div
            ref={effortPanelRef}
            role="dialog"
            aria-label="Effort"
            className="absolute bottom-full left-1/2 z-30 mb-2 w-[260px] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-[16px] border border-line bg-surface p-3.5 shadow-pop"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="text-[12.5px] font-medium">Effort</span>
              <span className="text-[11.5px] text-faint">{selectedEffort.label}</span>
            </div>
            <input
              type="range"
              min={0}
              max={EFFORT_OPTIONS.length - 1}
              step={1}
              value={effortIndex}
              aria-label="Effort level"
              aria-valuetext={selectedEffort.label}
              onChange={(event) => {
                const next = EFFORT_OPTIONS[Number(event.currentTarget.value)]
                if (next) onChangeEffort(next.value)
              }}
              className="mt-3 w-full cursor-pointer accent-[#1b1a17]"
            />
            <div className="mt-1 grid grid-cols-3 text-[10.5px] font-medium uppercase tracking-[0.06em] text-faint">
              <span>Low</span>
              <span className="text-center">Default</span>
              <span className="text-right">Max</span>
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted">{selectedEffort.title}</p>
          </div>
        )}
        {busy ? (
          <button type="button" onClick={onStop} aria-label="Stop" className="grid size-8 place-items-center rounded-full bg-fg text-white transition-transform active:scale-95">
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            aria-label="Send"
            className="grid size-8 place-items-center rounded-full bg-fg text-white transition-[opacity,transform] active:scale-95 disabled:opacity-25"
          >
            <ArrowUp className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}
