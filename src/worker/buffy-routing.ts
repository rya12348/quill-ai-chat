import { needsBuffyTools } from '../shared/agent'
import { isTrivialPrompt } from './blend'

export type BuffyChatRoute = {
  /** Answer locally, before spending a provider call. */
  local: boolean
  /** Use the fast Buffy Free lane for ordinary chat. */
  fast: boolean
  /** Start the full local Buffy agent. */
  fullAgent: boolean
  /** The model row persisted and shown for this turn. */
  model: 'buffy' | 'buffy-lite' | null
}

/**
 * One decision point for a Buffy turn. A greeting stays local; ordinary chat
 * uses the fast lane; only explicit tool work, attachments, or Agent mode
 * starts the full agent.
 */
export function routeBuffyChat(input: {
  usingApi: boolean
  requestedModel?: string | null
  content: string
  strategy?: string
  hasAttachments?: boolean
}): BuffyChatRoute {
  const selected = !input.usingApi && input.requestedModel === 'buffy'
  const free = !input.usingApi && input.requestedModel === 'buffy-lite'
  const trivial = !input.usingApi && (selected || free) && !input.hasAttachments && isTrivialPrompt(input.content)
  const fullAgent =
    selected &&
    !trivial &&
    (input.strategy === 'agent' || input.hasAttachments === true || needsBuffyTools(input.content))
  // Both Buffy rows are ordinary chat unless the turn explicitly needs the
  // full agent. The hosted Buffy row (buffy-lite) must not fall into a blend
  // just because it is a brand row rather than the bridge row.
  const fast = (selected || free) && !trivial && !fullAgent
  return {
    local: trivial,
    fast,
    fullAgent,
    model: selected ? 'buffy' : free ? 'buffy-lite' : null,
  }
}
