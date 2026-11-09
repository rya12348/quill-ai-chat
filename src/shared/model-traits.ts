// One short answer to "what is this model best at?" for the picker. The free
// chain has one row per family, so the family decides the label; the keyed API
// has no family, so its model names fall through to the same rules.
import type { ModelInfo } from './types'

type TraitModel = Pick<ModelInfo, 'id' | 'name' | 'family'>

const FAMILY_TRAITS: Record<string, string> = {
  nemotron: 'Reasoning',
  qwen: 'Coding',
  north: 'Coding',
  gpt: 'Reasoning',
  openrouter: 'Router',
  muse: 'Creative',
  kilo: 'Router',
  dots: 'Notes',
  liquid: 'Fast',
  glm: 'Coding',
  codestral: 'Coding',
  mistral: 'Writing',
  ministral: 'Fast',
  laguna: 'Coding',
  llama: 'General',
  deepseek: 'Coding',
  command: 'Writing',
  gemma: 'Fast',
  flint: 'General',
  xing: 'General',
  stealth: 'Experimental',
  kimi: 'Reasoning',
  claude: 'Writing',
  gemini: 'Long docs',
  minimax: 'Coding',
}

const NAME_RULES: [RegExp, string][] = [
  [/ministral/i, 'Fast'],
  [/mistral/i, 'Writing'],
  [/nemotron/i, 'Reasoning'],
  [/deepseek/i, 'Coding'],
  [/qwen/i, 'Coding'],
  [/north/i, 'Coding'],
  [/codestral/i, 'Coding'],
  [/laguna/i, 'Coding'],
  [/glm/i, 'Coding'],
  [/minimax/i, 'Coding'],
  [/gpt|openai/i, 'Reasoning'],
  [/claude/i, 'Writing'],
  [/gemini/i, 'Long docs'],
  [/kimi/i, 'Reasoning'],
  [/command/i, 'Writing'],
  [/gemma/i, 'Fast'],
  [/liquid/i, 'Fast'],
  [/muse/i, 'Creative'],
  [/dots/i, 'Notes'],
  [/stealth|glyph|crouton/i, 'Experimental'],
  [/openrouter|kilo/i, 'Router'],
  [/llama|flint|xing/i, 'General'],
]

/** The family label wins; keyed model names use the fallback rules. */
export function modelTrait(model: TraitModel): string {
  const family = model.family?.trim().toLowerCase()
  if (family && FAMILY_TRAITS[family]) return FAMILY_TRAITS[family]
  const name = `${model.name} ${model.id}`
  return NAME_RULES.find(([pattern]) => pattern.test(name))?.[1] ?? 'General'
}
