// One-line facts about a finished reply, shared by the app and its tests.

/** "42s", "1m 18s", "2m" — wall-clock time, without invented precision. */
export function elapsedLabel(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1_000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`
}
