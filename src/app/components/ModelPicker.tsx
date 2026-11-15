import { motion } from 'motion/react'
import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { ModelInfo, ProviderStatus, ReasoningEffort } from '../../shared/types'
import { useModels, useProviders } from '../lib/api'
import { cx } from '../lib/cx'
import { MODEL_PRESET_OPTIONS, type ModelChoice, type ModelPreset } from '../lib/model-presets'

const EFFORT_OPTIONS: { value: ReasoningEffort; label: string; title: string }[] = [
  { value: 'low', label: 'Low', title: 'Fastest: one strong model, minimal extra work' },
  { value: 'default', label: 'Default', title: 'Balanced: plan and blend only when the task needs it' },
  { value: 'max', label: 'Max', title: 'Full strength: deep plan, independent drafts and a final check' },
]

/** A quiet pill naming the model; opens a compact list of models. */
export function ModelPicker({
  value,
  onChange,
  preset,
  onPreset,
  effort,
  onChangeEffort,
  disabled,
  placement = 'down',
}: {
  value: string
  onChange: (id: string) => void
  /** The active Auto/Fast/Best policy, or manual model selection. */
  preset?: ModelChoice
  onPreset?: (preset: ModelPreset) => void
  /** Reasoning budget, shown inside the model menu on free lanes. */
  effort?: ReasoningEffort
  onChangeEffort?: (effort: ReasoningEffort) => void
  disabled?: boolean
  /** The picker sits near the bottom of the screen in the composer. */
  placement?: 'down' | 'up'
}) {
  const { data } = useModels()
  const { data: health } = useProviders()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // Fallback rows for the first paint, before /models answers. Once the
  // catalogue is known, every model it returns is selectable, strongest first.
  const brandRows: ModelInfo[] = [
    {
      id: 'gpt-6-luna',
      name: 'ChatGPT',
      description: 'Free GPT-6 Luna, no key or setup.',
      available: true,
      family: 'ChatGPT',
      billing: 'free',
      strength: 90,
    },
    {
      id: 'claude-haiku-5-5',
      name: 'Claude',
      description: 'Free Claude Haiku 5.5, no key or setup.',
      available: true,
      family: 'Claude',
      billing: 'free',
      strength: 88,
    },
    {
      id: 'gemini-web',
      name: 'Gemini',
      description: 'Free Gemini, no key or setup.',
      available: true,
      family: 'Gemini',
      billing: 'free',
      strength: 84,
    },
    {
      id: 'buffy-lite',
      name: 'Buffy',
      description: 'Buffy on the strongest free hosted models.',
      available: true,
      family: 'Buffy Agent',
      billing: 'free',
      strength: 82,
    },
  ]
  const catalog = data?.items ?? brandRows
  const catalogKnown = (data?.items?.length ?? 0) > 0
  // Every catalogue row, deduplicated by id. A local bridge can expose both
  // `buffy` and `buffy-lite` for the same agent; show the full one only.
  const models = catalogKnown
    ? catalog.filter(
        (model, index, all) =>
          all.findIndex((candidate) => candidate.id === model.id) === index &&
          (model.id !== 'buffy-lite' || !all.some((candidate) => candidate.id === 'buffy')),
      )
    : brandRows
  // Free lanes report their own health; the keyed API is one provider behind
  // every model, so its status applies to all of them. The list is one row per
  // family, and any working lane of that family makes the family usable.
  const lanesFor = (model: { id: string; family?: string }) =>
    health?.items.filter((item) => (model.family ? item.family === model.family : item.model === model.id)) ?? []
  const statusFor = (model: { id: string; family?: string }): ProviderStatus => {
    const lanes = lanesFor(model)
    if (lanes.length) {
      if (lanes.some((lane) => lane.status === 'healthy')) return 'healthy'
      if (lanes.some((lane) => lane.status === 'degraded')) return 'degraded'
      if (lanes.some((lane) => lane.status === 'unknown')) return 'unknown'
      return 'down'
    }
    if (health?.mode === 'api' && health.items[0]) return health.items[0].status
    return 'unknown'
  }
  // A confirmed dead lane and a lane with a permanently bad key/model are not
  // worth putting in the list. Temporary busy or timeout states stay selectable.
  const unusable = (model: { id: string; family?: string }): boolean => {
    const lanes = lanesFor(model)
    if (!lanes.length) return false
    return lanes.every(
      (lane) =>
        lane.status === 'down' ||
        lane.lastErrorCode === 'invalid_key' ||
        lane.lastErrorCode === 'unavailable' ||
        lane.lastErrorCode === 'quota',
    )
  }
  // Strongest first; the rows above are only a construction order.
  const options = catalogKnown
    ? [...models].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))
    : models
  const current = options.find((m) => m.id === value) ?? options[0]
  const unavailable = (model: (typeof options)[number]) =>
    !model.available || unusable(model) || statusFor(model) === 'down'
  const presets = onPreset ? MODEL_PRESET_OPTIONS : []
  const presetLabel = preset === 'auto' ? 'Auto' : preset === 'fast' ? 'Fast' : preset === 'best' ? 'Best' : null
  const selectedEffort = EFFORT_OPTIONS.find((option) => option.value === effort) ?? EFFORT_OPTIONS[1]!
  const correctedFor = useRef<string | null>(null)
  // Health can arrive after the model list; do not leave a dead manually
  // selected model. Presets resolve from the same health-filtered choices in
  // Chat, so correcting them here would silently turn Auto into Manual.
  const canCorrect = preset === undefined || preset === 'manual'
  useEffect(() => {
    if (!canCorrect || !data?.items || !health || !current || current.id === value || correctedFor.current === value) return
    correctedFor.current = value
    onChange(current.id)
  }, [canCorrect, current, data?.items, health, onChange, value])
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={current ? `${current.name}${presetLabel ? ` · ${presetLabel} preset` : ''}` : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 min-w-0 max-w-[148px] items-center gap-1.5 rounded-tile px-2.5 text-[13px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50"
      >
        <span className="truncate">{presetLabel ?? current?.name ?? value}</span>
        <ChevronDown className="size-3.5 shrink-0 text-faint" />
      </button>
      {open && (
        <motion.ul
          role="listbox"
          aria-label="Model"
          initial={{ opacity: 0, y: placement === 'up' ? -4 : 4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.14 }}
            style={{ maxHeight: 'min(70vh, 420px)' }}
            className={cx(
              'scrollbar-thin absolute left-0 z-40 w-[310px] max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-[14px] bg-surface p-1 shadow-pop',
              placement === 'up' ? 'bottom-full mb-1' : 'top-full mt-1',
            )}
          >
            {presets.length > 0 && (
              <li role="presentation" className="p-1 pb-1.5">
                <div role="group" aria-label="Model preset" className="grid grid-cols-3 gap-0.5 rounded-tile bg-surface-2 p-0.5">
                  {presets.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={preset === option.id}
                      title={option.description}
                      onClick={() => {
                        onPreset?.(option.id)
                        setOpen(false)
                      }}
                      className={cx(
                        'h-7 rounded-[6px] text-[12px] font-medium transition-colors',
                        preset === option.id ? 'bg-surface text-fg shadow-sm' : 'text-faint hover:text-fg',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </li>
            )}
            {effort && onChangeEffort ? (
              <li role="presentation" className="p-1 pb-1.5">
                <div className="flex items-center justify-between px-1 pb-1">
                  <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Effort</span>
                  <span className="text-[11.5px] text-faint">{selectedEffort.label}</span>
                </div>
                <div role="group" aria-label="Effort" className="grid grid-cols-3 gap-0.5 rounded-tile bg-surface-2 p-0.5">
                  {EFFORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={effort === option.value}
                      title={option.title}
                      onClick={() => onChangeEffort(option.value)}
                      className={cx(
                        'h-7 rounded-[6px] text-[12px] font-medium transition-colors',
                        effort === option.value ? 'bg-surface text-fg shadow-sm' : 'text-faint hover:text-fg',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="px-1 pt-1 text-[10.5px] leading-snug text-faint">{selectedEffort.title}</p>
              </li>
            ) : null}
            {(presets.length > 0 || (effort && onChangeEffort)) && (
              <li role="presentation" className="mx-1 mb-1 border-t border-line" />
            )}
            {options.map((model) => {
              const off = unavailable(model)
              return (
                <li key={model.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={model.id === value && (preset === undefined || preset === 'manual')}
                    aria-disabled={off || undefined}
                    aria-label={`${model.name}${off ? ' — unavailable' : ''}. ${model.description}`}
                    title={`${model.name}${off ? ' — unavailable right now' : ''} — ${model.description}`}
                    disabled={off}
                    onClick={() => {
                      onChange(model.id)
                      setOpen(false)
                    }}
                    className="flex w-full items-center gap-2.5 rounded-tile px-2.5 py-2 text-left transition-colors hover:bg-surface-2 disabled:opacity-45 disabled:hover:bg-transparent"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-medium">{model.name}</span>
                        {off ? <span className="shrink-0 text-[10.5px] font-medium text-warning">Unavailable</span> : null}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-snug text-faint">{model.description}</span>
                    </span>
                    {model.id === value && !off && (preset === undefined || preset === 'manual') && <Check className="size-4 shrink-0 text-fg" />}
                  </button>
                </li>
              )
            })}

        </motion.ul>
      )}
    </div>
  )
}
