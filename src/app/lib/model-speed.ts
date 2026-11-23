export type ModelSpeed = 'fast' | 'longer'

/** A short, honest label for the picker; it describes the usual wait, not quality. */
export const MODEL_SPEED_LABELS: Record<ModelSpeed, { label: string; title: string }> = {
  fast: {
    label: 'Fast',
    title: 'Usually starts replying sooner.',
  },
  longer: {
    label: 'Takes longer',
    title: 'Does more deliberate work, so expect a longer wait.',
  },
}

const FAST_MODEL = /claude-haiku-5-5|gemini-web|gemini-4|buffy-lite/i
// Picker models now answer through the selected lane directly. Only the local
// Buffy agent has a deliberately longer tool run.
const LONGER_MODEL = /(^|[\s/])buffy([\s-]|$)/i

/**
 * Classify a picker row by its usual response time. Unknown models stay
 * unlabelled rather than guessing.
 */
export function modelSpeed(id: string, name?: string): (typeof MODEL_SPEED_LABELS)[ModelSpeed] | null {
  const key = `${id} ${name ?? ''}`
  if (FAST_MODEL.test(key)) return MODEL_SPEED_LABELS.fast
  if (LONGER_MODEL.test(key)) return MODEL_SPEED_LABELS.longer
  return null
}
