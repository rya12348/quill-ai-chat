import { ArrowLeft, Eye, Users } from 'lucide-react'
import { Link } from 'react-router'

import { ApiError, useTraffic } from '../lib/api'
import { isLocalTunnelHost } from '../../shared/traffic'

const number = new Intl.NumberFormat()

function dayLabel(day: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`))
}

function Metric({ label, value, detail, icon }: { label: string; value: number; detail: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-card bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-faint">{label}</p>
        <span className="text-faint">{icon}</span>
      </div>
      <p className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{number.format(value)}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-faint">{detail}</p>
    </div>
  )
}

export function Analytics() {
  const traffic = useTraffic()
  const data = traffic.data
  const days = data?.days.slice(0, 14) ?? []
  const tunnel = isLocalTunnelHost(window.location.hostname)

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[760px] px-5 py-8 md:px-6 md:py-10">
        <Link to="/settings" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted transition-colors hover:text-fg">
          <ArrowLeft className="size-3.5" />
          Settings
        </Link>
        <h1 className="mt-6 font-display text-[38px] font-medium leading-tight tracking-[-0.03em]">Who is visiting</h1>
        <p className="mt-1.5 max-w-[560px] text-[14.5px] leading-relaxed text-muted">
          Aggregate page views for this site. {tunnel ? 'This preview link is visible to anyone who has it.' : 'Visible to signed-in people.'} Visitors are counted with a one-way hash; raw IP addresses are never stored.
        </p>

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
        ) : data ? (
          <>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <Metric label="Visitors today" value={data.today.visitors} detail="People who opened at least one page today (UTC)." icon={<Users className="size-4" />} />
              <Metric label="Page views today" value={data.today.views} detail="Pages opened today, including repeat visits." icon={<Eye className="size-4" />} />
              <Metric label="Visitors, all time" value={data.allTime.visitors} detail={`${number.format(data.last7Days.visitors)} in the last 7 days.`} icon={<Users className="size-4" />} />
              <Metric label="Page views, all time" value={data.allTime.views} detail={`${number.format(data.last7Days.views)} in the last 7 days.`} icon={<Eye className="size-4" />} />
            </div>

            <section className="mt-8">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[15px] font-semibold">Last 14 days</h2>
                <p className="text-[12.5px] text-faint">Days are UTC. Bots, API calls and assets are excluded.</p>
              </div>
              {days.length === 0 ? (
                <div className="mt-3 rounded-card bg-surface p-5 text-[13px] text-faint shadow-card">No visits recorded yet.</div>
              ) : (
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
                      {days.map((day) => (
                        <tr key={day.day} className="text-[14px]">
                          <td className="px-4 py-2.5 text-muted">{dayLabel(day.day)}</td>
                          <td className="px-4 py-2.5 text-right font-medium tabular-nums">{number.format(day.visitors)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted">{number.format(day.views)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}
