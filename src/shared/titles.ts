// A model-generated title is shown beside the conversation in the sidebar and
// header, so keep it short and strip the wrappers models sometimes add.
const TITLE_MAX_CHARS = 64

// Free lanes can answer with their own rate-limit or refusal text. That is not
// a conversation title, so leave the first-message placeholder in place.
const NOT_A_TITLE =
  /^(?:sorry\b|apologies\b|i'?m\s+sorry\b|i\s+am\s+sorry\b|unable\s+to\b|i\s+can(?:'?t|not)\b)|\b(?:prevent abuse|rate limit|too many requests|quota|free resources|try again later|temporarily unavailable)\b/i

export const TITLE_INSTRUCTIONS = `You name conversations for a personal AI assistant. Write a short, specific title for the exchange below.

- Use the same language as the user.
- Use 2 to 6 words, at most 64 characters.
- Describe the subject or task, not the assistant.
- Never write "Chat", "Conversation" or "New chat".
- Return only the title. No quotes, label, markdown or ending period.`

/** Clean one model reply into a title, or reject it and keep the placeholder. */
export function cleanGeneratedTitle(raw: string): string | undefined {
  let title = raw
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) ?? ''

  // Models occasionally wrap the answer despite the instruction.
  title = title.replace(/^[#>*_\s-]+/, '').trim()
  title = title.replace(/^(?:here(?:'s| is)\s+)?(?:a\s+|the\s+)?(?:conversation\s+|chat\s+)?title\s*:\s*/i, '').trim()
  title = title.replace(/^[*_`"'“”‘’\s]+|[*_`"'“”‘’\s]+$/g, '').trim()
  title = title.replace(/\s+/g, ' ')
  title = title.replace(/[.;:,]+$/, '').trim()

  if (!title || /^(new chat|chat|conversation)$/i.test(title)) return undefined
  if (NOT_A_TITLE.test(title)) return undefined
  if (title.length > TITLE_MAX_CHARS) {
    const cut = title.slice(0, TITLE_MAX_CHARS)
    const space = cut.lastIndexOf(' ')
    title = (space > 24 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?-]+$/, '').trim()
  }
  return title || undefined
}
