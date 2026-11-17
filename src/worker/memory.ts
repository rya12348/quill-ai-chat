// Long conversations cannot send their whole history with every question.
// Once turns fall outside the verbatim window, this helper folds them into a
// compact memory. The caller persists it with a covered-through timestamp, so
// the next request only folds in the turns that have just fallen out.

import { MAX_CONTEXT_MESSAGES, MAX_MESSAGE_CHARS, MAX_SUMMARY_CHARS, type ModelId } from '../shared/config'
import type { Message } from '../shared/types'
import { aiConfigured, complete, type ChatMessage } from './ai'
import type { Env } from './env'
import { orderLanes, publicComplete, publicLanes } from './public-ai'

const SUMMARY_MAX_TOKENS = 900
const MAX_SUMMARY_INPUT_CHARS = 48_000

/**
 * A single turn falling out of the verbatim window is not worth a model call,
 * a visible status message, or an extra wait. Refresh memory only after a real
 * batch of older turns has accumulated.
 */
export const MIN_MEMORY_MESSAGES = 8

export function shouldRefreshMemory(uncoveredMessages: number): boolean {
  return uncoveredMessages >= MIN_MEMORY_MESSAGES
}

/** Only a chat that has overflowed the verbatim window may use a summary. */
export function hasConversationOverflow(historyMessages: number): boolean {
  return historyMessages > MAX_CONTEXT_MESSAGES
}

/**
 * Keep turns that have just left the verbatim window in the prompt until a
 * summary refresh covers them. They stay before the recent window, in order.
 */
export function withPendingTurns<T>(pending: T[], recent: T[]): T[] {
  return pending.length ? [...pending, ...recent] : recent
}

const SUMMARY_SYSTEM = `You maintain a compact memory of an ongoing conversation for another assistant.

Merge the existing memory with the older messages into one factual summary. Preserve details that may be asked about later: names, code words, identifiers, preferences, constraints, decisions, dates, numbers, definitions, unresolved questions, and agreements. Distinguish what the user said from what the assistant claimed. Never invent facts. Do not answer the user, add advice, or mention that this is a summary. Write plain prose with short labelled lines where useful. Keep it under 500 words.`

function transcript(messages: Message[]): string {
  const lines = messages.map((message) => {
    const content = message.content.trim().slice(0, MAX_MESSAGE_CHARS)
    return `${message.role === 'user' ? 'User' : 'Assistant'}: ${content}`
  })
  // Keep the oldest details even when the dropped history is unusually large;
  // the covered-through cursor still advances so later requests do not repeat
  // the same work.
  const text = lines.join('\n\n')
  return text.length > MAX_SUMMARY_INPUT_CHARS ? text.slice(0, MAX_SUMMARY_INPUT_CHARS) : text
}

/** Returns an updated summary, or undefined if the summarizer could not answer. */
export async function refreshConversationSummary(input: {
  env: Env
  model: string
  existingSummary: string
  messages: Message[]
  signal?: AbortSignal
}): Promise<string | undefined> {
  if (!input.messages.length) return undefined
  const prompt: ChatMessage[] = [
    { role: 'system', content: SUMMARY_SYSTEM },
    {
      role: 'user',
      content: `Existing memory:\n${input.existingSummary.trim() || '(none)'}\n\nOlder messages to fold in:\n${transcript(input.messages)}`,
    },
  ]

  let text = ''
  try {
    if (aiConfigured(input.env)) {
      for await (const piece of complete(input.env, {
        model: input.model as ModelId,
        messages: prompt,
        signal: input.signal,
      })) {
        if (piece.type === 'text') text += piece.text
      }
    } else {
      const lanes = orderLanes(publicLanes(input.env), input.model)
      if (!lanes.length) return undefined
      for await (const piece of publicComplete(lanes, {
        messages: prompt,
        signal: input.signal,
        reasoning: false,
        temperature: 0.2,
        maxTokens: SUMMARY_MAX_TOKENS,
      })) {
        if (piece.type === 'text') text += piece.text
      }
    }
  } catch (error) {
    if (input.signal?.aborted) return undefined
    console.error('memory.summary_failed', error instanceof Error ? error.message : String(error))
    return undefined
  }

  const summary = text.replace(/\s+/g, ' ').trim().slice(0, MAX_SUMMARY_CHARS)
  return summary || undefined
}
