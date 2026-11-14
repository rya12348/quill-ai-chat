/** Three drops breaking a still pool: a small travelling splash rather than a lone petri-dish droplet. */
export function InkThinking({ label, compact = false }: { label?: string; compact?: boolean }) {
  return (
    <span
      className={compact ? 'ink-loading ink-loading-compact' : 'ink-loading'}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox="0 0 28 18" fill="none" aria-hidden="true">
        <ellipse className="ink-loading-pool" cx="14" cy="16.45" rx="10.4" ry=".8" />
        <ellipse className="ink-loading-ring ink-loading-ring-left" cx="5.6" cy="14.9" rx="2.8" ry="1" />
        <ellipse className="ink-loading-ring ink-loading-ring-mid" cx="14" cy="16.1" rx="3.6" ry="1.15" />
        <ellipse className="ink-loading-ring ink-loading-ring-right" cx="22.4" cy="14.6" rx="2.7" ry=".95" />
        <g className="ink-loading-drop ink-loading-drop-left">
          <path d="M5.6 9.1c-1.05 1.4-1.9 2.35-1.9 3.45a1.9 1.9 0 0 0 3.8 0c0-1.1-.85-2.05-1.9-3.45Z" opacity=".58" />
        </g>
        <g className="ink-loading-drop ink-loading-drop-mid">
          <path d="M14 6.6c-1.4 1.85-2.5 3.15-2.5 4.55a2.5 2.5 0 0 0 5 0c0-1.4-1.1-2.7-2.5-4.55Z" opacity=".92" />
        </g>
        <g className="ink-loading-drop ink-loading-drop-right">
          <path d="M22.4 9.6c-1 1.3-1.8 2.2-1.8 3.25a1.8 1.8 0 0 0 3.6 0c0-1.05-.8-1.95-1.8-3.25Z" opacity=".58" />
        </g>
        <circle className="ink-loading-speck" cx="18.6" cy="5" r=".65" />
        <circle className="ink-loading-speck ink-loading-speck-late" cx="8.6" cy="5.6" r=".45" />
      </svg>
    </span>
  )
}
