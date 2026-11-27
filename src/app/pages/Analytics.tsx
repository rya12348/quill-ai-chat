import type { ReactNode } from 'react'
import { ArrowLeft, Eye, Info, RefreshCw, Repeat, Users } from 'lucide-react'
import { Link } from 'react-router'

import type { TrafficDay, TrafficPage } from '../../shared/types'
import { isLocalTunnelHost } from '../../shared/traffic'
import { ApiError, useTraffic } from '../lib/api'

const number = new Intl.NumberFormat()
const dayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})
const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' })
const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

const PAGE_LABELS: Record<string, string> = {
  '/': 'Home',
  '/auth': 'Sign in',
  '/browser': 'Browser',
  '/browser/agent': 'Browser agent',
  '/buffy': 'Buffy',
  '/buffy/code': 'Buffy Code',
  '/chat': 'Chat',
  '/humanizer': 'Humanizer',
  '/library': 'Library',
  '/privacy': 'Privacy',
  '/proxy': 'Proxy',
  '/review': 'Review',
  '/room': 'Room',
  '/settings': 'Settings',
  '/shared': 'Shared chat',
  '/tools/pdf': 'PDF tools',
}

function dayLabel(day: string): string {
  return dayFormatter.format(new Date(`${day}T00:00:00Z`))
}

function pageLabel(path: string): string {
  if (PAGE_LABELS[path]) return PAGE_LABELS[path]
  const readable = path
    .replace(/^\/+/, '')
    .replace(/[-/]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
  return readable || 'Home'
}

/** Fill quiet days so the trend reads as time, not as a list of active days. */
function recentDays(days: TrafficDay[], count: number): TrafficDay[] {
  const byDay = new Map(days.map((day) => [day.day, day]))
  const now = new Date()
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(today - (count - 1 - index) * 86_400_000).toISOString().slice(0, 10)
    return byDay.get(day) ?? { day, visitors: 0, views: 0 }
  })
}

function Metric({
  label,
  value,
  detail,
  icon,
  accent = false,
}: {
  label: string
  value: number
  detail: string
  icon: ReactNode
  accent?: boolean
}) {
  return (
    <div className="rounded-card bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-faint">{label}</p>
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-tile ${
            accent ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-faint'
          }`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{number.format(value)}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-faint">{detail}</p>
    </div>
  )
}

function TrafficTrend({ days }: { days: TrafficDay[] }) {
  const peak = Math.max(...days.map((day) => day.visitors))
  const scale = Math.max(1, peak)
  const summary = days
    .map((day) => `${dayLabel(day.day)}: ${number.format(day.visitors)} unique visitor${day.visitors === 1 ? '' : 's'}`)
    .join('; ')

  return (
    <section className="mt-7 rounded-card bg-surface p-4 shadow-card sm:p-5" aria-labelledby="traffic-trend-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="traffic-trend-title" className="text-[15px] font-semibold">
            Daily unique visitors
          </h2>
          <p className="mt-0.5 text-[12.5px] text-faint">
            Last 14 days{peak > 0 ? ` · peak ${number.format(peak)}` : ''}
          </p>
        </div>
        <p className="inline-flex items-center gap-1.5 text-[12px] text-faint">
          <span className="size-2 rounded-full bg-accent" />
          One per browser
        </p>
      </div>

      <div className="mt-4 flex h-[148px] items-end gap-1 border-b border-line sm:gap-1.5" role="img" aria-label={summary}>
        {days.map((day) => {
          const barHeight = day.visitors ? Math.max(6, Math.round((day.visitors / scale) * 96)) : 2
          return (
            <div key={day.day} aria-hidden="true" className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
              <div className="flex w-full flex-1 items-end justify-center">
                <div
                  className={`w-full max-w-[28px] rounded-t-[3px] ${
                    day.visitors ? 'bg-accent/75 transition-colors group-hover:bg-accent' : 'bg-line'
                  }`}
                  style={{ height: `${barHeight}px` }}
                  title={`${dayLabel(day.day)}: ${number.format(day.visitors)} unique visitor${day.visitors === 1 ? '' : 's'}`}
                />
              </div>
              <span className="w-full truncate text-center text-[10px] font-medium text-faint">
                {weekdayFormatter.format(new Date(`${day.day}T00:00:00Z`))}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function DaysTable({ days }: { days: TrafficDay[] }) {
  const rows = [...days].reverse()
  return (
    <section aria-labelledby="traffic-days-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="traffic-days-title" className="text-[15px] font-semibold">
          Daily breakdown
        </h2>
        <p className="text-[12.5px] text-faint">UTC · last 14 days</p>
      </div>
      <div className="mt-3 overflow-hidden rounded-card bg-surface shadow-card">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-line text-[12px] font-semibold uppercase tracking-[0.1em] text-faint">
              <th className="px-4 py-2.5 font-semibold">Day</th>
              <th className="px-4 py-2.5 text-right font-semibold">Visitors</th>
              <th className="px-4 py-2.5 text-right font-semibold">Page views</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((day) => (
              <tr key={day.day} className="text-[14px]">
                <td className="px-4 py-2.5 text-muted">{dayLabel(day.day)}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">{number.format(day.visitors)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted">{number.format(day.views)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function TopPages({ pages }: { pages: TrafficPage[] }) {
  const peak = Math.max(1, ...pages.map((page) => page.views))
  return (
    <section aria-labelledby="traffic-pages-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="traffic-pages-title" className="text-[15px] font-semibold">
          Top pages
        </h2>
        <p className="text-[12.5px] text-faint">Last 30 days</p>
      </div>
      <div className="mt-3 rounded-card bg-surface p-1 shadow-card">
        {pages.length === 0 ? (
          <p className="px-4 py-5 text-[13px] text-faint">No page data yet.</p>
        ) : (
          <ol className="divide-y divide-line">
            {pages.map((page, index) => {
              const width = Math.max(4, Math.round((page.views / peak) * 100))
              return (
                <li key={page.path} className="px-3 py-3">
                  <div className="flex items-center justify-between gap-3 text-[13.5px]">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="w-4 shrink-0 text-[11px] font-medium tabular-nums text-faint">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="truncate font-medium" title={page.path}>
                        {pageLabel(page.path)}
                      </span>
                    </div>
                    <span className="shrink-0 tabular-nums text-muted">
                      {number.format(page.views)} <span className="text-[12px] text-faint">views</span>
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 pl-[26px]">
                    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-accent/60" style={{ width: `${width}%` }} />
                    </div>
                    <span className="w-[88px] shrink-0 text-right text-[11.5px] text-faint">
                      {number.format(page.visitors)} unique
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}

export function Analytics() {
  const traffic = useTraffic()
  const data = traffic.data
  const tunnel = isLocalTunnelHost(window.location.hostname)
  const days = recentDays(data?.days ?? [], 14)
  const hasTraffic = Boolean(data && data.allTime.views > 0)

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[920px] px-5 py-8 md:px-6 md:py-10">
        <Link to="/settings" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted transition-colors hover:text-fg">
          <ArrowLeft className="size-3.5" />
          Settings
        </Link>

        <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-[38px] font-medium leading-tight tracking-[-0.03em]">Who is visiting</h1>
            <p className="mt-1.5 max-w-[600px] text-[14.5px] leading-relaxed text-muted">
              Unique visitors are counted once per browser, not once per page load. Page views count every page opened.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void traffic.refetch()}
            disabled={traffic.isFetching}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-tile border border-line-strong bg-surface px-3 text-[12px] font-medium text-fg transition-colors hover:bg-surface-2 disabled:text-faint"
          >
            <RefreshCw className={`size-3.5 ${traffic.isFetching ? 'animate-spin' : ''}`} />
            {traffic.isFetching ? 'Refreshing' : 'Refresh'}
          </button>
        </div>

        <p className="mt-2 text-[12.5px] text-faint">
          {tunnel ? 'This preview link is visible to anyone who has it.' : 'Visible to signed-in people.'}
          {data ? ` Updated ${timeFormatter.format(new Date(data.updatedAt))}.` : ''}
        </p>

        <div className="mt-5 flex items-start gap-2.5 rounded-card border border-line bg-surface-2/50 px-3.5 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-accent" />
          <p className="text-[12.5px] leading-relaxed text-muted">
            <span className="font-semibold text-fg">One browser, one visitor.</span> Counting uses a random
            first-party browser id stored in a cookie and local storage, then hashed on the server. Raw IP addresses,
            query strings and browsing history are never stored. Clearing this browser&apos;s site data or using a
            private window counts as a new visitor.
          </p>
        </div>

        {traffic.isLoading ? (
          <p className="mt-8 text-[13px] text-faint">Loading traffic…</p>
        ) : traffic.error ? (
          <div className="mt-8 rounded-card border border-line bg-surface p-4 shadow-card">
            <p className="text-[13.5px] font-medium">
              {traffic.error instanceof ApiError && traffic.error.status === 403 ? 'Sign in to view traffic.' : 'Traffic could not be loaded.'}
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-faint">
              {traffic.error instanceof ApiError ? traffic.error.message : 'Check your connection and try again.'}
            </p>
          </div>
        ) : data && hasTraffic ? (
          <>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Metric
                  label="Came back this week"
                  value={data.last7Days.returning}
                  detail={`Of ${number.format(data.last7Days.visitors)} unique visitors in the last 7 days. ${number.format(data.last7Days.retained)} of them were also here the week before.`}
                  icon={<Repeat className="size-4" />}
                  accent
                />
              </div>
              <Metric
                label="Unique visitors today"
                value={data.today.visitors}
                detail="Unique browsers today. Refreshing a page does not add another."
                icon={<Users className="size-4" />}
                accent
              />
              <Metric
                label="Page views today"
                value={data.today.views}
                detail="Every page opened today (UTC), including repeat visits."
                icon={<Eye className="size-4" />}
              />
              <Metric
                label="Unique visitors, all time"
                value={data.allTime.visitors}
                detail={`${number.format(data.last7Days.visitors)} unique in the last 7 days.`}
                icon={<Users className="size-4" />}
                accent
              />
              <Metric
                label="Page views, all time"
                value={data.allTime.views}
                detail={`${number.format(data.last7Days.views)} views in the last 7 days.`}
                icon={<Eye className="size-4" />}
              />
            </div>

            <TrafficTrend days={days} />

            <div className="mt-8 grid items-start gap-7 lg:grid-cols-[1.05fr_0.95fr]">
              <DaysTable days={days} />
              <TopPages pages={data.topPages ?? []} />
            </div>
          </>
        ) : data ? (
          <div className="mt-8 rounded-card border border-dashed border-line-strong bg-surface p-6 shadow-card">
            <span className="grid size-9 place-items-center rounded-tile bg-accent-soft text-accent">
              <Users className="size-4" />
            </span>
            <p className="mt-3 text-[15px] font-semibold">No visitors yet.</p>
            <p className="mt-1 max-w-[520px] text-[13px] leading-relaxed text-faint">
              Open the site in another browser or share the link. The first page load counts one visitor; refreshing
              that browser will not count again.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
