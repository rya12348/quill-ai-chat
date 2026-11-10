// One short answer to "what is this model best at?" for the picker. The free
// chain has one row per family, so the family decides the label; the keyed API
// has no family, so its model names fall through to the same rules. Keep the
// labels distinct: two rows with the same strength make the picker look generic.
import type { ModelInfo } from './types'

type TraitModel = Pick<ModelInfo, 'id' | 'name' | 'family'>

const FAMILY_TRAITS: Record<string, string> = {
  nemotron: 'Reasoning',
  qwen: 'Math',
  north: 'Code review',
  gpt: 'Knowledge',
  openrouter: 'Routing',
  muse: 'Creative',
  kilo: 'Fallback',
  dots: 'Notes',
  liquid: 'Speed',
  glm: 'Tools',
  codestral: 'Code edits',
  mistral: 'Writing',
  ministral: 'Quick tasks',
  laguna: 'Code search',
  llama: 'General',
  deepseek: 'Coding',
  command: 'Business',
  gemma: 'Fast answers',
  flint: 'Everyday',
  xing: 'Concise',
  stealth: 'Experimental',
  kimi: 'Long context',
  claude: 'Editing',
  gemini: 'Documents',
  minimax: 'Fast coding',
  step: 'Agentic',
}

const NAME_RULES: [RegExp, string][] = [
  [/ministral/i, 'Quick tasks'],
  [/mistral/i, 'Writing'],
  [/nemotron/i, 'Reasoning'],
  [/deepseek/i, 'Coding'],
  [/qwen/i, 'Math'],
  [/north/i, 'Code review'],
  [/codestral/i, 'Code edits'],
  [/laguna/i, 'Code search'],
  [/glm/i, 'Tools'],
  [/minimax/i, 'Fast coding'],
  [/gpt|openai/i, 'Knowledge'],
  [/claude/i, 'Editing'],
  [/gemini/i, 'Documents'],
  [/kimi/i, 'Long context'],
  [/command/i, 'Business'],
  [/gemma/i, 'Fast answers'],
  [/liquid/i, 'Speed'],
  [/muse/i, 'Creative'],
  [/dots/i, 'Notes'],
  [/step/i, 'Agentic'],
  [/stealth|glyph|crouton/i, 'Experimental'],
  [/openrouter/i, 'Routing'],
  [/kilo/i, 'Fallback'],
  [/llama/i, 'General'],
  [/flint/i, 'Everyday'],
  [/xing/i, 'Concise'],
]

/** The family label wins; keyed model names use the fallback rules. */
export function modelTrait(model: TraitModel): string {
  const family = model.family?.trim().toLowerCase()
  if (family && FAMILY_TRAITS[family]) return FAMILY_TRAITS[family]
  const name = `${model.name} ${model.id}`
  return NAME_RULES.find(([pattern]) => pattern.test(name))?.[1] ?? 'General'
}
