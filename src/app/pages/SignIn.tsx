import { motion } from 'motion/react'
import { ArrowRight, Database, Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { BRAND, TAGLINE } from '../../shared/config'
import { BrandArt } from '../components/BrandArt'
import { Logo, Mark } from '../components/Shell'

type AuthMode = 'signin' | 'register'

export function SignIn() {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const currentPath = `${window.location.pathname}${window.location.search}`
  const returnTo = currentPath.startsWith('/auth') || currentPath.startsWith('/signin') ? '/' : currentPath

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !email.trim() || !password) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(mode === 'register' ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, returnTo }),
      })
      const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string; returnTo?: string }
      if (!response.ok) {
        setError(body.message || body.error || 'That did not work. Check your details and try again.')
        return
      }
      window.location.assign(body.returnTo || returnTo)
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-[1040px] items-center px-5 sm:px-8">
        <Logo />
      </header>
      <main className="mx-auto grid w-full max-w-[1040px] flex-1 items-center gap-12 px-5 pb-16 sm:px-8 lg:grid-cols-[1fr_0.9fr]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="max-w-md">
          <BrandArt variant="horizon" className="mb-5 w-[300px] max-w-full" />
          <h1 className="mt-2 text-balance font-display text-[44px] font-medium leading-[1.02] tracking-[-0.03em] sm:text-[58px]">
            {mode === 'signin' ? `Sign in to ${BRAND}` : `Create your ${BRAND} account`}
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-muted">
            {TAGLINE} {mode === 'signin' ? 'Sign in to keep your conversations.' : 'Use an email and a password you choose.'}
          </p>

          <form onSubmit={(event) => void submit(event)} className="mt-7 rounded-[18px] border border-line bg-surface p-5 shadow-card">
            <label htmlFor="auth-email" className="block text-[12.5px] font-medium text-muted">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@example.com"
              className="mt-1.5 block h-11 w-full rounded-control border border-line-strong bg-bg px-3 text-[14.5px] text-fg outline-none placeholder:text-faint focus:border-accent/60 focus:ring-[3px] focus:ring-accent/15"
            />
            <label htmlFor="auth-password" className="mt-3 block text-[12.5px] font-medium text-muted">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
              className="mt-1.5 block h-11 w-full rounded-control border border-line-strong bg-bg px-3 text-[14.5px] text-fg outline-none placeholder:text-faint focus:border-accent/60 focus:ring-[3px] focus:ring-accent/15"
            />
            {error ? <p role="alert" className="mt-3 text-[13px] leading-relaxed text-danger">{error}</p> : null}
            <button
              type="submit"
              disabled={busy || !email.trim() || !password}
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-control bg-accent px-4 text-[14.5px] font-medium text-bg shadow-[inset_0_1px_0_rgb(255_255_255/0.16)] transition-opacity hover:bg-accent-strong disabled:opacity-35"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
              {!busy ? <ArrowRight className="size-4" /> : null}
            </button>
            <p className="mt-3 text-center text-[13px] text-faint">
              {mode === 'signin' ? 'New here?' : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'signin' ? 'register' : 'signin')
                  setError('')
                }}
                className="font-medium text-fg underline decoration-line-strong underline-offset-2 transition-colors hover:text-accent"
              >
                {mode === 'signin' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          </form>

          <div className="mt-6 flex items-center gap-3 text-[13px] text-faint">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
          <form method="post" action="/api/auth/guest" className="mt-4">
            <input type="hidden" name="returnTo" value={returnTo} />
            <button type="submit" className="inline-flex h-12 items-center gap-2 rounded-control border border-line-strong bg-surface px-4 text-[14px] font-medium text-fg transition-colors hover:bg-surface-2">
              Continue as guest
              <ArrowRight className="size-4" />
            </button>
          </form>
          <p className="mt-3 text-[14px] text-faint">No account. Your chats stay in this browser.</p>
          <p className="mt-5 text-[12.5px] text-faint">
            By continuing, you agree to the{' '}
            <Link to="/terms" className="underline decoration-line-strong underline-offset-2 hover:text-fg">Terms</Link> and{' '}
            <Link to="/privacy" className="underline decoration-line-strong underline-offset-2 hover:text-fg">Privacy Policy</Link>.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }} className="hidden lg:block">
          <div className="rounded-dialog bg-surface p-7 shadow-pop">
            <div className="flex justify-end">
              <p className="max-w-[80%] rounded-bubble rounded-br-[8px] bg-surface-2 px-4 py-3 text-[15.5px]">Turn these launch notes into a short project brief.</p>
            </div>
            <div className="mt-6 flex gap-3.5">
              <Mark size={26} className="mt-0.5 rounded-[8px]" />
              <div className="prose-chat text-[15.5px]">
                <p>Here&apos;s the brief, in the order your team needs it:</p>
                <ol>
                  <li><strong>Goal</strong> — launch the coffee subscription page for existing customers.</li>
                  <li><strong>Scope</strong> — one page, three benefits, and a single Join button.</li>
                  <li><strong>Next step</strong> — review the draft copy, then ship on Friday.</li>
                </ol>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  )
}

export function SetupNeeded({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-card bg-surface shadow-card">
          <Database className="size-5 text-muted" />
        </div>
        <h1 className="mt-4 font-display text-[24px] font-semibold tracking-[-0.02em]">{onRetry ? 'Connection problem' : 'Almost there'}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          {onRetry ? `${BRAND} could not reach the server. Check your connection and try again.` : message}
        </p>
        {onRetry ? (
          <button type="button" onClick={onRetry} className="mt-4 inline-flex h-10 items-center justify-center rounded-control border border-line-strong bg-surface px-4 text-[14px] font-medium text-fg transition-colors hover:bg-surface-2">Try again</button>
        ) : (
          <p className="mt-4 text-[13px] text-faint">The site is missing its database binding. Ask the site owner to attach D1 storage named DB and redeploy.</p>
        )}
      </div>
    </div>
  )
}
