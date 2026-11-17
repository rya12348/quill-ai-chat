import type { ModelInfo, ProviderHealth } from '../../shared/types'
import { BUFFY_MODELS, DENT_MODEL, type BuffyModel } from './buffy-models'

// These codes mean retrying the same route will not help until someone changes
// the key or quota. A route with ordinary transient failures is still shown:
// it may answer now, and hiding it on one bad probe would make the picker churn.
const BLOCKING_ERROR_CODES = new Set(['invalid_key', 'unavailable', 'empty', 'quota'])

function isWorking(provider: ProviderHealth): boolean {
  return provider.status !== 'down' && !BLOCKING_ERROR_CODES.has(provider.lastErrorCode ?? '')
}

/**
 * Dent is the DeepSeek V4.1 Flash lane, not a Duck model. Its status therefore
 * comes from provider health rather than the model catalogue. Match only the
 * exact lane family: a healthy DeepSeek R1 route cannot serve Dent.
 */
export function dentIsWorking(providers: readonly ProviderHealth[] | undefined): boolean {
  return Boolean(
    providers?.some((provider) => {
      const text = `${provider.model ?? ''} ${provider.family ?? ''} ${provider.name}`.toLowerCase()
      return (
        text.includes('deepseek') &&
        (text.includes('v4.1') || text.includes('deepseek-flash') || /\bdent\b/.test(text)) &&
        isWorking(provider)
      )
    }),
  )
}

/**
 * The model picker must never offer a route known to be broken. Dent is checked
 * against provider health; Claude and ChatGPT are browser models with no
 * provider row, so their catalogue availability is the only server-side signal.
 */
export function selectableBuffyModels(
  providers: readonly ProviderHealth[] | undefined,
  catalogue: readonly ModelInfo[] | undefined,
): BuffyModel[] {
  return BUFFY_MODELS.filter((model) => {
    if (model === DENT_MODEL) return dentIsWorking(providers)
    const row = catalogue?.find((item) => item.id === model)
    return row?.available ?? true
  })
}

/** The measured fast default, also the replacement when a saved mode is gone. */
export const BUFFY_FALLBACK_MODEL = 'claude-haiku-5-5' as const

/** Use the saved choice only while it is still offered; otherwise replace it. */
export function preferredBuffyModel(options: readonly BuffyModel[], current: BuffyModel): BuffyModel {
  if (options.includes(current)) return current
  if (options.includes(BUFFY_FALLBACK_MODEL)) return BUFFY_FALLBACK_MODEL
  return options[0] ?? current
}
