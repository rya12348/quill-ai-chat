import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { Link, useParams } from 'react-router'

import { AssistantMessage, UserMessage } from '../components/Message'
import { Mark } from '../components/Shell'
import { Spinner } from '../components/ui'
import { useSharedConversation } from '../lib/api'

export function SharedChat() {
  const { token } = useParams()
  const { data, isLoading, error } = useSharedConversation(token)

  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[760px] items-center gap-2.5 px-4 md:px-6">
          <Link to="/" className="inline-flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
            <Mark size={26} />
            Quill
          </Link>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11.5px] font-medium text-muted">
            <LockKeyhole className="size-3.5" />
            Read-only
          </span>
        </div>
      </header>

      {isLoading ? (
        <div className="grid min-h-[60vh] place-items-center">
          <Spinner />
        </div>
      ) : data === null ? (
        <div className="grid min-h-[60vh] place-items-center px-5 text-center">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">This link is no longer available.</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">The owner may have revoked it, or the chat may have been deleted.</p>
            <Link to="/" className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-fg underline underline-offset-2 hover:text-muted">
              <ArrowLeft className="size-4" />
              Open Quill
            </Link>
          </div>
        </div>
      ) : error ? (
        <div className="grid min-h-[60vh] place-items-center px-5 text-center">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Could not load this conversation.</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">Check the link and try again.</p>
            <Link to="/" className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-fg underline underline-offset-2 hover:text-muted">
              <ArrowLeft className="size-4" />
              Open Quill
            </Link>
          </div>
        </div>
      ) : data ? (
        <main className="mx-auto w-full max-w-[760px] px-4 pb-14 pt-8 md:px-6 md:pt-10">
          <div className="rounded-card border border-line bg-surface px-5 py-4 shadow-card">
            <h1 className="text-[21px] font-semibold tracking-[-0.02em]">{data.title || 'Shared conversation'}</h1>
            <p className="mt-1 text-[12.5px] text-faint">Shared from Quill · read-only</p>
          </div>

          <div className="mt-8 space-y-7">
            {data.messages.length ? (
              data.messages.map((message, index) =>
                message.role === 'user' ? (
                  <UserMessage key={`${message.createdAt}-${index}`} content={message.content} attachments={message.attachments} />
                ) : (
                  <AssistantMessage
                    key={`${message.createdAt}-${index}`}
                    content={message.content}
                    reasoning={message.reasoning}
                    reasoningMs={message.reasoningMs}
                    sources={message.sources}
                    team={message.team}
                    proof={message.proof}
                    research={message.research}
                    analysis={message.analysis}
                    build={message.build}
                    canvas={message.canvas}
                    model={message.modelName ?? message.model ?? ''}
                    interrupted={message.interrupted}
                  />
                ),
              )
            ) : (
              <p className="py-8 text-center text-[13.5px] text-faint">This conversation is empty.</p>
            )}
          </div>

          <div className="mt-12 border-t border-line pt-5 text-center">
            <p className="text-[12.5px] text-faint">
              Shared read-only. Nothing here can be edited or rated.
            </p>
            <Link to="/" className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-fg underline underline-offset-2 hover:text-muted">
              Start your own chat
            </Link>
          </div>
        </main>
      ) : null}
    </div>
  )
}
