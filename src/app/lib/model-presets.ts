import type { ModelInfo } from '../../shared/types'

/** A preset chooses a concrete model id before the request is sent. */
export type ModelPreset = 'auto' | 'fast' | 'best'
/** `manual` means the person picked a model from the list themselves. */
export type ModelChoice = ModelPreset | 'manual'

export const MODEL_PRESET_OPTIONS: { id: ModelPreset; label: string; description: string }[] = [
  { id: 'auto', label: 'Auto', description: 'Matches the model to the task.' },
  { id: 'fast', label: 'Fast', description: 'Quick replies for simple chats.' },
  { id: 'best', label: 'Best', description: 'More careful answers for harder work.' },
]

const FAST_MODEL = /(flash|mini|haiku|lite|small|fast|turbo|instant|bolt|lightning)/i
const STRONG_MODEL = /(claude|sonnet|opus|gpt|gemini|pro|ultra|large|reason|nemotron|kimi|deepseek-v4-pro)/i

/**
 * Resolve a preset to a model the deployment currently offers. The caller can
 * still fall back to the conversation's saved model when this returns nothing.
 */
export function resolvePresetModel(preset: ModelChoice, strategy: string, models: ModelInfo[]): string | undefined {
  if (preset === 'manual') return undefined
  const available = models.filter((model) => model.available)
  if (!available.length) return undefined
  const fast = available.find((model) => FAST_MODEL.test(model.name) || FAST_MODEL.test(model.id)) ?? available[0]
  const best = available.find((model) => STRONG_MODEL.test(model.name) || STRONG_MODEL.test(model.id)) ?? available[1] ?? available[0]
  if (preset === 'fast') return fast?.id
  if (preset === 'best') return best?.id
  return strategy === 'fast' ? fast?.id : best?.id
}
