import { DUCK_MODEL_LABELS, DUCK_MODELS, type DuckModel } from './duck'
import { MODEL_SPEED_LABELS, modelSpeed } from './model-speed'

/** Dent is DeepSeek V4.1 Flash on the free hosted lanes, not a Duck model. */
export const DENT_MODEL = 'dent' as const
export type BuffyModel = DuckModel | typeof DENT_MODEL

export const BUFFY_MODELS = [DENT_MODEL, ...DUCK_MODELS] as const

export const BUFFY_MODEL_LABELS: Record<BuffyModel, { name: string; detail: string }> = {
  dent: { name: 'Dent', detail: 'DeepSeek V4.1 Flash' },
  ...DUCK_MODEL_LABELS,
}

export function normalizeBuffyModel(value: unknown): BuffyModel {
  return value === DENT_MODEL || (DUCK_MODELS as readonly unknown[]).includes(value)
    ? (value as BuffyModel)
    : DENT_MODEL
}

export function buffyModelSpeed(model: BuffyModel): (typeof MODEL_SPEED_LABELS)[keyof typeof MODEL_SPEED_LABELS] {
  return modelSpeed(model) ?? MODEL_SPEED_LABELS.fast
}

export function isDuckModel(model: BuffyModel): model is DuckModel {
  return model !== DENT_MODEL
}
