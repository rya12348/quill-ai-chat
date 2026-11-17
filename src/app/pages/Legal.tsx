import { Link } from 'react-router'
import type { ReactNode } from 'react'

import { BRAND } from '../../shared/config'
import { Logo } from '../components/Shell'

const CONTACT = 'https://github.com/rya12348/quill-ai-chat/issues'

function LegalShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="mx-auto flex h-16 w-full max-w-[760px] items-center px-5 sm:px-8">
        <Logo />
        <Link to="/" className="ml-auto text-[13px] font-medium text-muted underline decoration-line-strong underline-offset-2 hover:text-fg">
          Back to {BRAND}
        </Link>
      </header>
      <main className="mx-auto w-full max-w-[760px] px-5 pb-20 sm:px-8">
        <h1 className="mt-6 font-display text-[42px] font-medium leading-tight tracking-[-0.03em]">{title}</h1>
        <p className="mt-2 text-[13px] text-faint">Last updated {updated}</p>
        <div className="prose-chat mt-8 max-w-none text-[15.5px] leading-relaxed text-muted [&_h2]:mt-9 [&_h2]:font-display [&_h2]:text-[23px] [&_h2]:font-medium [&_h2]:text-fg [&_p]:mt-3 [&_li]:mt-2 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </main>
    </div>
  )
}

export function Privacy() {
  return (
    <LegalShell title="Privacy Policy" updated="17 November 2026">
      <p>
        {BRAND} stores the data needed to run your chats and keep your account working. This page explains what is
        stored, why, and how to remove it.
      </p>
      <h2>What we store</h2>
      <ul>
        <li>Your email address, display name and a password hash if you create an account.</li>
        <li>Your conversations, messages, attachments, projects, settings and feedback.</li>
        <li>Daily usage counts and short-lived rate-limit records used to prevent abuse.</li>
        <li>
          Anonymous page-view counts using a random first-party browser id stored in a cookie and local storage, and
          a one-way hash of it. Only the page path, day and aggregate count are kept; raw IP addresses and browsing
          history are not stored. These counts are not tied to a conversation.
        </li>
        <li>Aggregate server error counts.</li>
      </ul>
      <h2>Why we store it</h2>
      <p>
        To provide the service you asked for: saving chats, syncing your library, enforcing limits, preventing abuse,
        and diagnosing failures. We do not sell personal data or use it for advertising.
      </p>
      <h2>Who processes it</h2>
      <p>
        Ink runs on Cloudflare. Chat replies are sent to the model providers configured for the deployment. When you
        use web search, your question is sent to the search provider. Those providers process the request under their
        own terms. API keys stay on the server.
      </p>
      <h2>Retention</h2>
      <p>
        Chats, attachments and account data stay until you delete them. Deleting all chats removes the conversations
        and their messages immediately. Deleting your account removes the account, chats, attachments and settings.
        Database backups are kept for up to 30 days and then expire. Expired sessions, rate-limit records,
        anonymous page views and aggregate errors are pruned by the housekeeping job.
      </p>
      <h2>Your choices</h2>
      <p>
        You can delete individual chats, all chats, or your whole account from Settings. Guests can delete their guest
        data the same way. Clearing the guest cookie starts a new guest session and loses access to the old one.
      </p>
      <h2>Contact</h2>
      <p>
        For a privacy question or a request that Settings cannot handle, open an issue at{' '}
        <a href={CONTACT} target="_blank" rel="noreferrer" className="text-fg underline decoration-line-strong underline-offset-2">
          the project issue tracker
        </a>
        . Do not include passwords or private conversation text in a public issue.
      </p>
    </LegalShell>
  )
}

export function Terms() {
  return (
    <LegalShell title="Terms of Use" updated="16 November 2026">
      <p>
        By using {BRAND}, you agree to these terms. If you do not agree, do not use the service.
      </p>
      <h2>Your account</h2>
      <p>
        Keep your password private. You are responsible for activity under your account. Guest sessions are tied to
        this browser; clearing cookies ends access to that guest history.
      </p>
      <h2>Acceptable use</h2>
      <ul>
        <li>Do not use Ink to break the law, infringe rights, or harm other people.</li>
        <li>Do not attempt to bypass limits, access another person&apos;s data, or disrupt the service.</li>
        <li>Do not use generated pages or previews to phish, distribute malware, or evade a safety warning.</li>
        <li>Respect the terms of the websites and model providers you reach through Ink.</li>
      </ul>
      <h2>AI output</h2>
      <p>
        Model output can be wrong, incomplete or out of date. Check important facts and code before relying on them.
        You are responsible for what you publish or send.
      </p>
      <h2>Availability and changes</h2>
      <p>
        The service is provided as-is, without a warranty. Features, models and limits may change. We may suspend an
        account that abuses the service or creates a security risk.
      </p>
      <h2>Ending use</h2>
      <p>
        You can delete your account and data from Settings at any time. We may remove data that is illegal, abusive,
        or necessary to investigate a security incident.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about these terms can be opened at{' '}
        <a href={CONTACT} target="_blank" rel="noreferrer" className="text-fg underline decoration-line-strong underline-offset-2">
          the project issue tracker
        </a>
        .
      </p>
    </LegalShell>
  )
}
