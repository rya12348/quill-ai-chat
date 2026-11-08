import { motion } from 'motion/react'
import { ArrowRight, Database } from 'lucide-react'

import { BRAND, TAGLINE } from '../../shared/config'
import { Logo, Mark } from '../components/Shell'

export function SignIn() {
  const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-[1040px] items-center px-5 sm:px-8">
        <Logo />
      </header>
      <main className="mx-auto grid w-full max-w-[1040px] flex-1 items-center gap-12 px-5 pb-16 sm:px-8 lg:grid-cols-[1fr_0.9fr]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="max-w-md">
          <h1 className="text-balance text-[40px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[52px]">Ask {BRAND} anything</h1>
          <p className="mt-4 text-[16px] leading-relaxed text-muted">{TAGLINE} Sign in to keep your conversations.</p>
          <a href={`/auth/freebuff/signin?returnTo=${returnTo}`} className="mt-8 inline-flex h-12 items-center gap-2 rounded-control bg-fg px-5 text-[15px] font-medium text-white transition-colors hover:bg-[#2e2c27]">
            <span className="grid size-5 place-items-center rounded-[6px] bg-white text-[11px] font-bold text-fg">F</span>
            Sign in with Freebuff
            <ArrowRight className="size-4" />
          </a>
          <p className="mt-4 text-[13px] text-faint">Uses your Freebuff account. No new password.</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }} className="hidden lg:block">
          <div className="rounded-[28px] bg-surface p-7 shadow-pop">
            <div className="flex justify-end">
              <p className="max-w-[80%] rounded-bubble rounded-br-[8px] bg-surface-2 px-4 py-2.5 text-[14.5px]">What&apos;s a good way to start learning the piano as an adult?</p>
            </div>
            <div className="mt-6 flex gap-3.5">
              <Mark size={26} className="mt-0.5 rounded-[8px]" />
              <div className="prose-chat text-[14.5px]">
                <p>Start with ten focused minutes a day rather than an hour on Sundays. Three things to do in week one:</p>
                <ol>
                  <li>Learn the C major scale with correct fingering, hands separately.</li>
                  <li>Pick one song you love and learn its first four bars.</li>
                  <li>Record yourself once a week so you can hear progress.</li>
                </ol>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  )
}

export function SetupNeeded({ message }: { message: string }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-card bg-surface shadow-card">
          <Database className="size-5 text-muted" />
        </div>
        <h1 className="mt-4 text-[20px] font-semibold tracking-tight">Almost there</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">{message}</p>
        <p className="mt-4 text-[13px] text-faint">In Freebuff, ask the agent to add D1 storage named DB, then deploy again.</p>
      </div>
    </div>
  )
}
