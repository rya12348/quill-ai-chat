// The first message gives a conversation a useful placeholder immediately. This
// helper later replaces it with a short, model-written title based on the first
// completed exchange. It deliberately uses the same free lanes / keyed API as
// chat, with a tiny output budget, and never blocks or fails the reply.
import { DEFAULT_MODEL, type ModelId } from '../shared/config'
import { cleanGeneratedTitle, TITLE_INSTRUCTIONS } from '../shared/titles'
import { AiError, aiConfigured, completeText, isModelId, type ChatMessage } from './ai'
import type { Env } from './env'
import { orderLanes, publicComplete, publicLanes } from './public-ai'

const TITLE_MAX_TOKENS = 40
const TITLE_INPUT_CHARS = 2_400

/** Returns a cleaned title, or undefined when no model can provide one. */
export async function generateConversationTitle(input: {
  env: Env
  model: string
  user: string
  assistant: string
  signal?: AbortSignal
}): Promise<string | undefined> {
  const user = input.user.trim().slice(0, TITLE_INPUT_CHARS) || '(an attachment)'
  const assistant = input.assistant.trim().slice(0, TITLE_INPUT_CHARS) || '(no text)'
  const messages: ChatMessage[] = [
    { role: 'system', content: TITLE_INSTRUCTIONS },
    {
      role: 'user',
      content: `User: ${user}\n\nAssistant: ${assistant}\n\nWrite the title now.`,
    },
  ]

  let raw = ''
  try {
    if (aiConfigured(input.env)) {
      const model: ModelId = isModelId(input.model) ? input.model : DEFAULT_MODEL
      raw = await completeText(input.env, {
        model,
        messages,
        signal: input.signal,
        maxTokens: TITLE_MAX_TOKENS,
      })
    } else {
      const lanes = orderLanes(publicLanes(input.env), input.model)
      if (!lanes.length) return undefined
      for await (const piece of publicComplete(lanes, {
        messages,
        signal: input.signal,
        reasoning: false,
        temperature: 0.2,
        maxTokens: TITLE_MAX_TOKENS,
      })) {
        if (piece.type === 'text') raw += piece.text
      }
    }
  } catch (error) {
    // A title is optional; a timeout or busy free lane must leave the existing
    // placeholder in place rather than surfacing an error in the chat.
    if (!input.signal?.aborted) {
      const detail = error instanceof AiError ? error.message : error instanceof Error ? error.message : String(error)
      console.error('conversation.title_failed', detail)
    }
    return undefined
  }

  return cleanGeneratedTitle(raw)
}
