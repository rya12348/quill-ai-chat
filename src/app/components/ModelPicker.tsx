import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { MODELS } from '../../shared/config'
import type { ProviderStatus } from '../../shared/types'
import { useModels, useProviders } from '../lib/api'
import { cx } from '../lib/cx'
import { MODEL_PRESET_OPTIONS, type ModelChoice, type ModelPreset } from '../lib/model-presets'

const STATUS_COLOR: Record<ProviderStatus, string> = {
  healthy: '#3f9d6a',
  degraded: '#c98a2e',
  down: '#c04b4b',
  unknown: '#b9b2a6',
}

const STATUS_LABEL: Record<ProviderStatus, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
  unknown: 'Not checked yet',
}

const SHORT_BRANDS: [RegExp, string][] = [
  [/^gpt/i, 'GPT'],
  [/^deepseek/i, 'DeepSeek'],
  [/^nemotron/i, 'Nemotron'],
  [/^glm/i, 'GLM'],
  [/^claude/i, 'Claude'],
  [/^gemini/i, 'Gemini'],
  [/^qwen/i, 'Qwen'],
  [/^gemma/i, 'Gemma'],
  [/^ministral/i, 'Ministral'],
  [/^mistral/i, 'Mistral'],
  [/^codestral/i, 'Codestral'],
  [/^llama/i, 'Llama'],
  [/^command/i, 'Command'],
  [/^kimi/i, 'Kimi'],
  [/^flint/i, 'Flint'],
  [/^xing/i, 'Xing'],
  [/^north/i, 'North'],
  [/^openrouter/i, 'OpenRouter'],
]

/** Keep the visible picker to the model family; the full name stays in the tooltip. */
function shortModelName(name: string): string {
  return SHORT_BRANDS.find(([pattern]) => pattern.test(name))?.[1] ?? name.trim().split(/\s+/)[0] ?? name
}

function StatusDot({ status }: { status: ProviderStatus }) {
  return <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLOR[status] }} />
}

/** A quiet pill naming the model; opens a compact list with short model names. */
export function ModelPicker({
  value,
  onChange,
  preset,
  onPreset,
  disabled,
  placement = 'down',
}: {
  value: string
  onChange: (id: string) => void
  /** The active Auto/Fast/Best policy, or manual model selection. */
  preset?: ModelChoice
  onPreset?: (preset: ModelPreset) => void
  disabled?: boolean
  /** The picker sits near the bottom of the screen in the composer. */
  placement?: 'down' | 'up'
}) {
  const { data } = useModels()
  const { data: health } = useProviders()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const models = data?.items ?? MODELS.map((m) => ({ ...m, available: true }))
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
    return lanes.every((lane) => lane.status === 'down' || lane.lastErrorCode === 'invalid_key' || lane.lastErrorCode === 'unavailable')
  }
  const available = models.filter((model) => model.available)
  const healthy = available.filter((model) => statusFor(model) === 'healthy')
  const usable = available.filter((model) => !unusable(model))
  // Once health is known, only offer models with a successful check. If nothing
  // has succeeded yet, fall back to usable lanes so the chat is not stranded.
  const options = healthy.length ? healthy : usable.length ? usable : available
  const hiddenCount = models.length - options.length
  const current = options.find((m) => m.id === value) ?? options[0] ?? models[0]
  const currentStatus = current ? statusFor(current) : 'unknown'
  const presets = onPreset ? MODEL_PRESET_OPTIONS : []
  const presetLabel = preset === 'auto' ? 'Auto' : preset === 'fast' ? 'Fast' : preset === 'best' ? 'Best' : null
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
        title={current ? `${current.name} — ${presetLabel ? `${presetLabel} preset · ` : ''}${STATUS_LABEL[currentStatus]}` : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 min-w-0 max-w-[132px] items-center gap-1.5 rounded-tile px-2.5 text-[12.5px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50"
      >
        <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLOR[currentStatus] }} />
        <span className="truncate">{presetLabel ?? shortModelName(current?.name ?? value)}</span>
        <ChevronDown className="size-3.5 shrink-0 text-faint" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label="Model"
            initial={{ opacity: 0, y: placement === 'up' ? -4 : 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: placement === 'up' ? -4 : 4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            style={{ maxHeight: 'min(70vh, 420px)' }}
            className={cx(
              'scrollbar-thin absolute left-0 z-40 w-[196px] overflow-y-auto overscroll-contain rounded-[14px] bg-surface p-1 shadow-pop',
              placement === 'up' ? 'bottom-full mb-1' : 'top-full mt-1',
            )}
          >
            {presets.length > 0 && (
              <>
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
                          'h-6 rounded-[6px] text-[10.5px] font-medium transition-colors',
                          preset === option.id ? 'bg-surface text-fg shadow-sm' : 'text-faint hover:text-fg',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </li>
                <li role="presentation" className="mx-1 mb-1 border-t border-line" />
                <li role="presentation" className="px-2.5 pb-1 pt-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-faint">
                  Or choose a model
                </li>
              </>
            )}
            {options.map((model) => {
              const status = statusFor(model)
              return (
                <li key={model.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={model.id === value && (preset === undefined || preset === 'manual')}
                    aria-label={`${model.name} — ${STATUS_LABEL[status]}`}
                    title={`${model.name} — ${STATUS_LABEL[status]}`}
                    disabled={!model.available || status === 'down'}
                    onClick={() => {
                      onChange(model.id)
                      setOpen(false)
                    }}
                    className={cx('flex w-full items-center gap-2.5 rounded-tile px-2.5 py-1.5 text-left transition-colors hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent')}
                  >
                    <StatusDot status={status} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{shortModelName(model.name)}</span>
                    {model.id === value && (preset === undefined || preset === 'manual') && <Check className="size-4 shrink-0 text-fg" />}
                  </button>
                </li>
              )
            })}
            {hiddenCount > 0 && (
              <li className="px-2.5 pb-1.5 pt-1 text-[11px] leading-relaxed text-faint">
                {hiddenCount} {hiddenCount === 1 ? 'family' : 'families'} hidden — no working model right now
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
