import { ArrowUpRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { DAILY_MESSAGE_LIMIT, MAX_INSTRUCTIONS_CHARS } from '../../shared/config'
import type { ProviderStatus } from '../../shared/types'
import { Avatar, Badge, Button, ConfirmDialog, useToast } from '../components/ui'
import { useDeleteAllConversations, useMe, useModels, useProbeProviders, useProviders, useSettings, useUpdateSettings } from '../lib/api'
import { untilLabel } from '../lib/format'

const STATUS_LABEL: Record<ProviderStatus, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
  unknown: 'Not checked',
}

const toneFor = (status: ProviderStatus) => (status === 'healthy' ? 'success' : status === 'degraded' ? 'warning' : status === 'down' ? 'danger' : 'neutral')

const ago = (at: number) => {
  const seconds = Math.max(1, Math.round((Date.now() - at) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}

export function Settings() {
  const { data: me } = useMe()
  const toast = useToast()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const [instructions, setInstructions] = useState('')
  const clear = useDeleteAllConversations()
  const { data: models } = useModels()
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  const providers = useProviders()
  const probe = useProbeProviders()
  useEffect(() => {
    if (settings) setInstructions(settings.instructions)
  }, [settings])
  if (!me) return null
  const mode = me.capabilities.mode
  const freeModels = models?.items.map((model) => model.name).join(', ')
  const connections: { label: string; ok: boolean; detail: string; badge?: string; action?: React.ReactNode }[] = [
    {
      label: 'Replies',
      ok: true,
      detail: mode === 'api' ? 'OPENAI_API_KEY is set' : `Free models: ${freeModels || me.capabilities.model || 'ready'}`,
      badge: mode === 'api' ? 'API' : 'Free',
      action:
        mode === 'public' ? (
          <a href="https://enter.pollinations.ai" target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-tile px-2.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-2">
            Use Kimi K3
            <ArrowUpRight className="size-3.5" />
          </a>
        ) : undefined,
    },
    { label: 'Database', ok: me.capabilities.database, detail: 'D1 via the DB binding' },
    { label: 'Sign in with Freebuff', ok: me.capabilities.auth === 'freebuff', detail: me.capabilities.auth === 'freebuff' ? 'FREEBUFF_CLIENT_ID is set' : 'Using the local development user' },
  ]
  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[640px] px-5 py-8 md:px-6 md:py-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Workspace</p>
        <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.02em]">Settings</h1>
        <p className="mt-1 max-w-[480px] text-[13px] leading-relaxed text-muted">Your account, how Quill writes, and which services are connected.</p>

        <section className="mt-8">
          <h2 className="text-[13.5px] font-semibold">Account</h2>
          <div className="mt-3 flex items-center gap-4 rounded-card bg-surface p-4 shadow-card">
            <Avatar name={me.user.name ?? me.user.email ?? 'You'} src={me.user.picture} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium">{me.user.name ?? 'Signed in'}</p>
              {me.user.email && <p className="truncate text-[13px] text-muted">{me.user.email}</p>}
            </div>
            {me.capabilities.auth === 'freebuff' ? (
              <form method="post" action="/auth/freebuff/signout">
                <input type="hidden" name="returnTo" value="/" />
                <Button type="submit">Sign out</Button>
              </form>
            ) : (
              <Badge tone="warning">Development user</Badge>
            )}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-[13.5px] font-semibold">Assistant</h2>
          <div className="mt-3 rounded-card bg-surface p-4 shadow-card">
            <label htmlFor="instructions" className="text-[13.5px] font-medium">
              Standing instructions
            </label>
            <p className="mt-1 text-[12.5px] leading-relaxed text-faint">Applied to every new reply in every chat. Ask for tone, format, language or expertise.</p>
            <textarea
              id="instructions"
              value={instructions}
              maxLength={MAX_INSTRUCTIONS_CHARS}
              onChange={(event) => setInstructions(event.target.value)}
              rows={4}
              placeholder="e.g. Keep answers concise, use British spelling, and show your working for calculations."
              className="mt-3 w-full resize-y rounded-control border border-line-strong bg-bg px-3 py-2.5 text-[13.5px] leading-relaxed text-fg placeholder:text-faint focus:border-fg/40 focus:outline-none focus:ring-[3px] focus:ring-fg/8"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-[11.5px] tabular-nums text-faint">
                {instructions.length} / {MAX_INSTRUCTIONS_CHARS}
              </span>
              <Button
                variant="primary"
                loading={update.isPending}
                onClick={() => update.mutate(instructions, { onSuccess: () => toast('Standing instructions saved'), onError: () => toast('Could not save instructions', 'danger') })}
              >
                Save
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-[13.5px] font-semibold">Usage</h2>
          <div className="mt-3 rounded-card bg-surface p-4 shadow-card">
            <div className="flex items-baseline justify-between">
              <p className="text-[15px] font-medium">
                {me.usage.used} of {DAILY_MESSAGE_LIMIT} replies today
              </p>
              <p className="text-[12.5px] text-faint">Resets {untilLabel(me.usage.resetsAt)}</p>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-[3px] bg-surface-2">
              <div className="h-full rounded-[3px] bg-fg transition-[width] duration-500" style={{ width: `${Math.min(100, Math.round((me.usage.used / DAILY_MESSAGE_LIMIT) * 100))}%` }} />
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-[13.5px] font-semibold">Connections</h2>
          <ul className="mt-3 divide-y divide-line rounded-card bg-surface shadow-card">
            {connections.map((item) => (
              <li key={item.label} className="flex min-h-13 items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium">{item.label}</span>
                  <span className="block truncate text-[12px] text-faint">{item.detail}</span>
                </span>
                {item.action}
                <Badge tone={item.ok ? 'success' : 'neutral'}>{item.badge ?? (item.ok ? 'Connected' : 'Not set')}</Badge>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[13.5px] font-semibold">Providers</h2>
            <Button
              loading={probe.isPending}
              onClick={() =>
                probe.mutate(
                  { all: true, force: true },
                  {
                    onSuccess: (state) => {
                      const checked = state.probed?.length ?? 0
                      toast(checked ? `Checked ${checked} provider${checked === 1 ? '' : 's'}` : 'All providers are already healthy')
                    },
                    onError: () => toast('Could not check providers', 'danger'),
                  },
                )
              }
            >
              Check all
            </Button>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-faint">The last known state is saved in the database, so it is here after a reload or a restart. Reading it never probes.</p>
          {providers.isLoading ? (
            <p className="mt-3 text-[12.5px] text-faint">Loading provider health…</p>
          ) : (
            <ul className="mt-3 divide-y divide-line rounded-card bg-surface shadow-card">
              {(providers.data?.items ?? []).map((provider) => (
                <li key={provider.id} className="flex min-h-13 items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{provider.name}</span>
                    <span className="block truncate text-[12px] text-faint">
                      {provider.lastCheckedAt ? `Checked ${ago(provider.lastCheckedAt)}` : 'Not checked yet'}
                      {provider.lastCheckedAt && provider.latencyMs !== null ? ` · ${provider.latencyMs} ms` : ''}
                      {provider.status !== 'healthy' && provider.lastError ? ` · ${provider.lastError}` : ''}
                    </span>
                  </span>
                  <Badge tone={toneFor(provider.status)}>{STATUS_LABEL[provider.status]}</Badge>
                </li>
              ))}
              {providers.data?.items.length === 0 && <li className="px-4 py-3 text-[12.5px] text-faint">No providers are configured.</li>}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-[13.5px] font-semibold">Data</h2>
          <div className="mt-3 flex items-center justify-between gap-4 rounded-card bg-surface p-4 shadow-card">
            <div>
              <p className="text-[13.5px] font-medium">Delete all chats</p>
              <p className="text-[12.5px] text-faint">Removes every conversation and message. Projects stay.</p>
            </div>
            <Button variant="danger" onClick={() => setConfirm(true)}>
              Delete
            </Button>
          </div>
        </section>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete all chats?"
        description="Every conversation is removed for good."
        confirmLabel="Delete everything"
        loading={clear.isPending}
        onConfirm={() =>
          clear.mutate(undefined, {
            onSuccess: () => {
              setConfirm(false)
              toast('All chats deleted')
              navigate('/')
            },
            onError: () => toast('Could not delete your chats', 'danger'),
          })
        }
      />
    </div>
  )
}
