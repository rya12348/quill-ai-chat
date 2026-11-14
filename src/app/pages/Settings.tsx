import { ArrowUpRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { MAX_INSTRUCTIONS_CHARS } from '../../shared/config'
import { modelDisplayName } from '../../shared/model-display'
import { isLocalTunnelHost } from '../../shared/traffic'
import { Avatar, Badge, Button, ConfirmDialog, useToast } from '../components/ui'
import { useDeleteAllConversations, useMe, useModels, useSettings, useUpdateSettings } from '../lib/api'
import { untilLabel } from '../lib/format'
import { openNewTab } from '../components/BacktickNewTab'

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
  useEffect(() => {
    if (settings) setInstructions(settings.instructions)
  }, [settings])
  if (!me) return null
  const mode = me.capabilities.mode
  const auth = me.capabilities.auth
  const canViewTraffic = auth !== 'guest' || isLocalTunnelHost(window.location.hostname)
  const modelNames = models?.items.map((model) => model.name).join(', ')
  const connections: { label: string; ok: boolean; detail: string; badge?: string; action?: React.ReactNode }[] = [
    {
      label: 'Replies',
      ok: true,
      detail: mode === 'api' ? 'OPENAI_API_KEY is set' : `Models: ${modelNames || modelDisplayName(me.capabilities.model) || 'ready'}`,
      badge: mode === 'api' ? 'API' : 'Included',
      action:
        mode === 'public' ? (
          <a href="https://enter.pollinations.ai" target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-tile px-2.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-2">
            Add a model key
            <ArrowUpRight className="size-3.5" />
          </a>
        ) : undefined,
    },
    { label: 'Database', ok: me.capabilities.database, detail: 'D1 via the DB binding' },
    {
      label: auth === 'guest' ? 'Session' : 'Account',
      ok: auth === 'guest' || auth === 'account' || auth === 'freebuff',
      detail:
        auth === 'guest'
          ? 'Guest browser; chats are saved here'
          : auth === 'account'
            ? 'Signed in with email and password'
            : auth === 'freebuff'
              ? 'A legacy browser session is active'
              : 'Using the local development user',
      badge: auth === 'guest' ? 'Guest' : auth === 'account' ? 'Email' : undefined,
      action:
        auth === 'guest' ? (
          <Link to="/auth" className="text-[12px] font-medium text-fg underline decoration-line-strong underline-offset-2">
            Create an account
          </Link>
        ) : undefined,
    },
  ]
  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[680px] px-5 py-8 md:px-6 md:py-10">
        <h1 className="mt-1 font-display text-[38px] font-medium leading-tight tracking-[-0.03em]">Settings</h1>
        <p className="mt-1.5 max-w-[520px] text-[14.5px] leading-relaxed text-muted">Account, writing preferences, and connections.</p>

        <section className="mt-8">
          <h2 className="text-[17px] font-semibold">Account</h2>
          <div className="mt-3 flex items-center gap-4 rounded-card bg-surface p-4 shadow-card">
            <Avatar name={me.user.name ?? me.user.email ?? 'You'} src={me.user.picture} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-medium">{me.user.name ?? (auth === 'guest' ? 'Guest' : 'Signed in')}</p>
              {me.user.email && <p className="truncate text-[14px] text-muted">{me.user.email}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canViewTraffic && (
                <Link
                  to="/analytics"
                  className="inline-flex h-8 items-center rounded-tile border border-line-strong bg-surface px-3 text-[12px] font-medium text-fg transition-colors hover:bg-surface-2"
                >
                  Traffic
                </Link>
              )}
              {auth === 'guest' ? (
                <Link
                  to="/auth"
                  className="inline-flex h-8 items-center rounded-tile border border-line-strong bg-surface px-3 text-[12px] font-medium text-fg transition-colors hover:bg-surface-2"
                >
                  Sign in
                </Link>
              ) : auth === 'account' || auth === 'freebuff' ? (
                <Button
                  onClick={() => {
                    void fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).finally(() => window.location.assign('/'))
                  }}
                >
                  Sign out
                </Button>
              ) : (
                <Badge tone="warning">Development user</Badge>
              )}
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-[17px] font-semibold">Instructions</h2>
          <div className="mt-3 rounded-card bg-surface p-4 shadow-card">
            <label htmlFor="instructions" className="text-[14.5px] font-medium">
              Standing instructions
            </label>
            <p className="mt-1 text-[13.5px] leading-relaxed text-faint">Applied to every new reply in every chat. Ask for tone, format, language or expertise.</p>
            <textarea
              id="instructions"
              value={instructions}
              maxLength={MAX_INSTRUCTIONS_CHARS}
              onChange={(event) => setInstructions(event.target.value)}
              rows={4}
              placeholder="e.g. Keep answers concise, use British spelling, and show your working for calculations."
              className="mt-3 w-full resize-y rounded-control border border-line-strong bg-bg px-3 py-2.5 text-[14.5px] leading-relaxed text-fg placeholder:text-faint focus:border-accent/60 focus:outline-none focus:ring-[3px] focus:ring-accent/15"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-[12.5px] tabular-nums text-faint">
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
          <h2 className="text-[17px] font-semibold">Shortcuts</h2>
          <div className="mt-3 flex items-start justify-between gap-4 rounded-card bg-surface p-4 shadow-card">
            <div className="min-w-0">
              <p className="text-[14.5px] font-medium">Open a new tab</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-faint">
                Press <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">{'`'}</kbd> anywhere to open Google Classroom in a new tab. Ink stays exactly as it is.
              </p>
            </div>
            <Button onClick={openNewTab}>
              Open
              <ArrowUpRight />
            </Button>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-[17px] font-semibold">Usage</h2>
          <div className="mt-3 rounded-card bg-surface p-4 shadow-card">
            <div className="flex items-baseline justify-between">
              <p className="text-[16px] font-medium">
                {me.usage.used} of {me.usage.limit} replies today
              </p>
              <p className="text-[13.5px] text-faint">Resets {untilLabel(me.usage.resetsAt)}</p>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-[3px] bg-surface-2">
              <div className="h-full rounded-[3px] bg-fg transition-[width] duration-500" style={{ width: `${Math.min(100, Math.round((me.usage.used / me.usage.limit) * 100))}%` }} />
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-[15px] font-semibold">Connections</h2>
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
