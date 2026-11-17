/**
 * A deliberately rough token estimate for UI hints.
 *
 * The app does not capture provider-reported usage for every free lane, so this
 * is derived from text length: about four ASCII characters per token, and one
 * token per non-ASCII character. It is close enough for a size hint, not for
 * billing or context-limit decisions.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  let ascii = 0
  let other = 0
  for (const character of text) {
    if (character.charCodeAt(0) < 128) ascii += 1
    else other += 1
  }
  return Math.ceil(ascii / 4 + other)
}

const MESSAGE_OVERHEAD = 4
const ATTACHMENT_OVERHEAD = 4

/** Estimate the conversation text, including attached text files. */
export function estimateConversationTokens(
  messages: readonly { content: string; files?: readonly { text: string }[] }[],
): number {
  return messages.reduce((total, message) => {
    const attachments = message.files?.reduce(
      (sum, file) => sum + ATTACHMENT_OVERHEAD + estimateTokens(file.text),
      0,
    )
    return total + MESSAGE_OVERHEAD + estimateTokens(message.content) + (attachments ?? 0)
  }, 0)
}

/** Compact display: 842, 1.2k, 18k. */
export function formatTokenCount(count: number): string {
  if (count < 1_000) return String(count)
  if (count < 10_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return `${Math.round(count / 1_000)}k`
}
