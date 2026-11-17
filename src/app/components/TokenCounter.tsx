import { estimateConversationTokens, estimateTokens, formatTokenCount } from '../../shared/tokens'
import { cx } from '../lib/cx'

export function TokenCounter({
  messages,
  extraText,
  className,
}: {
  messages: readonly { content: string; files?: readonly { text: string }[] }[]
  /** Text not sent yet, such as the current draft. */
  extraText?: string
  className?: string
}) {
  const tokens = estimateConversationTokens(messages) + (extraText ? estimateTokens(extraText) : 0)
  if (!tokens) return null
  return (
    <span
      className={cx(
        'inline-flex shrink-0 select-none items-baseline whitespace-nowrap text-[10.5px] tabular-nums text-faint',
        className,
      )}
      title="Rough estimate from the text in this chat. Provider-reported usage also includes prompts and may be higher."
      aria-label={`Estimated ${formatTokenCount(tokens)} tokens`}
    >
      ~{formatTokenCount(tokens)} tok
    </span>
  )
}
