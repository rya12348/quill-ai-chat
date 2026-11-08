import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { MODELS } from '../../shared/config'
import type { ProviderStatus } from '../../shared/types'
import { useModels, useProviders } from '../lib/api'
import { cx } from '../lib/cx'

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

function StatusDot({ status }: { status: ProviderStatus }) {
  return <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLOR[status] }} />
}

/** A quiet pill naming the model; opens a list with each model's one-liner. */
export function ModelPicker({
  value,
  onChange,
  disabled,
  placement = 'down',
}: {
  value: string
  onChange: (id: string) => void
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
  // every model, so its status applies to all of them. One model can also be
  // served by several providers, so the best working duplicate wins.
  const lanesFor = (modelId: string) => health?.items.filter((item) => item.model === modelId) ?? []
  const statusFor = (modelId: string): ProviderStatus => {
    const lanes = lanesFor(modelId)
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
  const unusable = (modelId: string): boolean => {
    const lanes = lanesFor(modelId)
    if (!lanes.length) return false
    return lanes.every((lane) => lane.status === 'down' || lane.lastErrorCode === 'invalid_key' || lane.lastErrorCode === 'unavailable')
  }
  const available = models.filter((model) => model.available)
  const healthy = available.filter((model) => statusFor(model.id) === 'healthy')
  const usable = available.filter((model) => !unusable(model.id))
  // Once health is known, only offer models with a successful check. If nothing
  // has succeeded yet, fall back to usable lanes so the chat is not stranded.
  const options = healthy.length ? healthy : usable.length ? usable : available
  const hiddenCount = models.length - options.length
  const current = options.find((m) => m.id === value) ?? options[0] ?? models[0]
  const currentStatus = current ? statusFor(current.id) : 'unknown'
  const correctedFor = useRef<string | null>(null)
  // Health can arrive after the model list; do not leave a dead model selected.
  useEffect(() => {
    if (!data?.items || !health || !current || current.id === value || correctedFor.current === value) return
    correctedFor.current = value
    onChange(current.id)
  }, [current, data?.items, health, onChange, value])
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
        title={current ? `${current.name} — ${STATUS_LABEL[currentStatus]}` : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 min-w-0 max-w-[190px] items-center gap-1.5 rounded-tile px-2.5 text-[13px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50"
      >
        <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLOR[currentStatus] }} />
        <span className="truncate">{current?.name ?? value}</span>
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
              'scrollbar-thin absolute left-0 z-40 w-[280px] overflow-y-auto overscroll-contain rounded-[14px] bg-surface p-1 shadow-pop',
              placement === 'up' ? 'bottom-full mb-1' : 'top-full mt-1',
            )}
          >
            {options.map((model) => {
              const status = statusFor(model.id)
              return (
                <li key={model.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={model.id === value}
                    aria-label={`${model.name} — ${STATUS_LABEL[status]}`}
                    disabled={!model.available || status === 'down'}
                    onClick={() => {
                      onChange(model.id)
                      setOpen(false)
                    }}
                    className={cx('flex w-full items-start gap-3 rounded-tile px-2.5 py-2 text-left transition-colors hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent')}
                  >
                    <StatusDot status={status} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-medium">{model.name}</span>
                      <span className="block text-[12px] text-faint">
                        {status === 'down' ? 'Down — the last check failed' : !model.available ? 'Not available right now' : model.description}
                      </span>
                    </span>
                    {model.id === value && <Check className="mt-0.5 size-4 shrink-0 text-fg" />}
                  </button>
                </li>
              )
            })}
            {hiddenCount > 0 && (
              <li className="px-2.5 pb-1.5 pt-1 text-[11px] leading-relaxed text-faint">
                {hiddenCount} {hiddenCount === 1 ? 'model' : 'models'} hidden — not working right now
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
