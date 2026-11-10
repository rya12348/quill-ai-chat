import { Bot, CheckCircle2, ChevronDown, Circle, Loader2, MinusCircle, XCircle } from 'lucide-react'
import { useState } from 'react'

import type { AgentInfo, AgentTool } from '../../shared/types'
import { cx } from '../lib/cx'

const TOOL_LABELS: Record<AgentTool, string> = {
  research: 'Research',
  build: 'Build',
  canvas: 'Study',
  answer: 'Answer',
}

const STATUS_LABELS: Record<AgentInfo['status'], string> = {
  planning: 'Planning…',
  running: 'Running…',
  done: 'Run complete',
  partial: 'Partly complete',
  failed: 'Run failed',
}

/** The plan, live step status and receipt of one Agent run. */
export function AgentNote({ agent, live }: { agent: AgentInfo; live?: boolean }) {
  const [open, setOpen] = useState(true)
  const done = agent.steps.filter((step) => step.status === 'done').length
  return (
    <section className="mb-3 overflow-hidden rounded-[12px] border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] transition-colors hover:bg-surface-2/60"
      >
        <Bot className="size-3.5 shrink-0 text-accent" />
        <span className="font-medium">Agent run</span>
        <span className="text-faint">{agent.steps.length ? `${done}/${agent.steps.length} steps` : 'planning'}</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-faint">
          {live && (agent.status === 'running' || agent.status === 'planning') ? <Loader2 className="size-3 animate-spin" /> : null}
          {STATUS_LABELS[agent.status]}
        </span>
        <ChevronDown className={cx('size-3.5 shrink-0 text-faint transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <ol className="border-t border-line">
          {agent.steps.map((step) => (
            <li key={step.id} className="flex gap-2.5 border-b border-line/60 px-3 py-2 last:border-b-0">
              <StepIcon status={step.status} />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] leading-snug">{step.title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-faint">
                  {TOOL_LABELS[step.tool]}
                  {step.detail ? ` · ${step.detail}` : ''}
                  {step.model ? ` · ${step.model}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {agent.receipt || agent.reason ? (
        <div className="border-t border-line bg-surface-2/40 px-3 py-2">
          {agent.receipt ? <p className="text-[11px] leading-relaxed text-muted">{agent.receipt}</p> : null}
          {agent.reason ? <p className="mt-0.5 text-[11px] leading-relaxed text-warning">{agent.reason}</p> : null}
        </div>
      ) : null}
    </section>
  )
}

function StepIcon({ status }: { status: AgentInfo['steps'][number]['status'] }) {
  if (status === 'running') return <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-accent" />
  if (status === 'done') return <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-accent" />
  if (status === 'failed') return <XCircle className="mt-0.5 size-3.5 shrink-0 text-danger" />
  if (status === 'skipped') return <MinusCircle className="mt-0.5 size-3.5 shrink-0 text-faint" />
  return <Circle className="mt-0.5 size-3.5 shrink-0 text-line-strong" />
}
