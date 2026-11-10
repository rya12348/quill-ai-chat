import { Brain, Check, ChevronDown, Pencil, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import { MAX_SUMMARY_CHARS } from '../../shared/config'
import { useConversationMemory, useEditConversationMemory, useForgetConversationMemory } from '../lib/api'
import { cx } from '../lib/cx'

/**
 * What Quill carries forward from turns that left the recent-message window.
 * It is written by the summarizer, sent with every new question, and can be
 * rewritten or forgotten here. Forgetting removes the memory, not the messages.
 */
export function MemoryPanel({ conversationId }: { conversationId: string }) {
  const { data } = useConversationMemory(conversationId)
  const save = useEditConversationMemory(conversationId)
  const forget = useForgetConversationMemory(conversationId)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const memory = data?.memory
  if (!memory) return null

  const startEditing = () => {
    setDraft(memory.summary)
    setEditing(true)
    setConfirming(false)
    setError(null)
    setOpen(true)
  }

  const persist = () => {
    if (!draft.trim() || save.isPending) return
    setError(null)
    save.mutate(draft, {
      onSuccess: () => setEditing(false),
      onError: (cause) => setError(cause instanceof Error ? cause.message : 'Could not save the memory.'),
    })
  }

  const remove = () => {
    setError(null)
    forget.mutate(undefined, {
      onSuccess: () => {
        setConfirming(false)
        setEditing(false)
        setOpen(false)
      },
      onError: (cause) => setError(cause instanceof Error ? cause.message : 'Could not forget the memory.'),
    })
  }

  return (
    <section className="mb-4 overflow-hidden rounded-[12px] border border-line bg-surface-2/40">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] font-medium text-muted transition-colors hover:text-fg"
      >
        <Brain className="size-3.5 shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate">What Quill remembers</span>
        <span className="hidden shrink-0 text-[11px] text-faint sm:inline">
          {memory.summary.length.toLocaleString()} characters · updated {new Date(memory.updatedAt).toLocaleDateString()}
        </span>
        <ChevronDown className={cx('size-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-line px-3 py-2.5">
          {editing ? (
            <>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={6}
                maxLength={MAX_SUMMARY_CHARS}
                aria-label="What Quill remembers"
                className="w-full resize-y rounded-[8px] border border-line bg-surface px-2.5 py-2 text-[12.5px] leading-relaxed text-fg outline-none focus:border-line-strong"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={persist}
                  disabled={!draft.trim() || save.isPending}
                  className="inline-flex items-center gap-1.5 rounded-[8px] bg-accent px-2.5 py-1.5 text-[11px] font-medium text-bg transition-opacity disabled:opacity-50"
                >
                  <Check className="size-3" />
                  {save.isPending ? 'Saving…' : 'Save memory'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false)
                    setError(null)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-fg"
                >
                  <X className="size-3" />
                  Cancel
                </button>
                <span className="text-[10.5px] text-faint">
                  {draft.trim().length.toLocaleString()} / {MAX_SUMMARY_CHARS.toLocaleString()}
                </span>
              </div>
            </>
          ) : (
            <>
              <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted">{memory.summary}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={startEditing}
                  className="inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-fg"
                >
                  <Pencil className="size-3" />
                  Edit
                </button>
                {confirming ? (
                  <>
                    <button
                      type="button"
                      onClick={remove}
                      disabled={forget.isPending}
                      className="inline-flex items-center gap-1.5 rounded-[8px] border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-[11px] font-medium text-danger transition-opacity disabled:opacity-50"
                    >
                      <Trash2 className="size-3" />
                      {forget.isPending ? 'Forgetting…' : 'Yes, forget it'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      className="text-[11px] text-muted hover:text-fg"
                    >
                      Keep
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-fg"
                  >
                    <Trash2 className="size-3" />
                    Forget
                  </button>
                )}
              </div>
            </>
          )}
          {error ? <p className="mt-2 text-[11px] text-danger">{error}</p> : null}
          <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
            This summary is sent with each new question once earlier turns fall outside the recent-message window. Forgetting it
            removes the summary, not the chat messages.
          </p>
        </div>
      )}
    </section>
  )
}
