import { PICKER_MODEL_NAMES } from './config'
import type { ModelInfo } from './types'

// The app exposes five short names. Older replies and tool receipts stored
// upstream ids, so every render path resolves through this helper instead of
// printing whatever string happened to be saved.
const FALLBACKS: [RegExp, string][] = [
  [/^buffy-lite$/i, 'Buffy'],
  [/^buffy$/i, 'Buffy Agent'],
  [/^chatgpt$/i, 'ChatGPT'],
  [/claude|sonnet|opus|haiku/i, 'Sable'],
  [/kimi|moonshot/i, 'Sable'],
  [/stepfun|step[- ]?\d/i, 'Quill'],
  [/gpt|openai/i, 'Quill'],
  [/nemotron/i, 'Stride'],
  [/gemini/i, 'Stride'],
  [/deepseek/i, 'Ink'],
  [/command|cohere/i, 'Prism'],
]

const FALLBACK_NAME = 'Ink'

export function modelDisplayName(raw: string | null | undefined, models?: ModelInfo[]): string {
  const value = raw?.trim()
  if (!value) return ''

  const alias = PICKER_MODEL_NAMES.find((name) => name.toLowerCase() === value.toLowerCase())
  if (alias) return alias

  const exact = models?.find((model) => model.id === value || model.name.toLowerCase() === value.toLowerCase())
  if (exact) return exact.name

  const lower = value.toLowerCase()
  const family = models?.find((model) => model.family && lower.includes(model.family.toLowerCase()))
  if (family) return family.name

  const known = FALLBACKS.find(([pattern]) => pattern.test(value))
  return known?.[1] ?? FALLBACK_NAME
}

export function modelDisplayList(input: readonly (string | null | undefined)[], models?: ModelInfo[]): string[] {
  const names = input.map((item) => modelDisplayName(item, models)).filter(Boolean)
  return [...new Set(names)]
}
