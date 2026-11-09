// The rolling memory is model-written, then editable by the person whose
// conversation it belongs to. Both paths go through the same normalisation so
// an edited memory cannot smuggle newlines or overrun the stored limit.

import { MAX_SUMMARY_CHARS } from './config'

export function normalizeMemory(value: string): string | undefined {
  const text = value.replace(/\s+/g, ' ').trim().slice(0, MAX_SUMMARY_CHARS)
  return text || undefined
}
