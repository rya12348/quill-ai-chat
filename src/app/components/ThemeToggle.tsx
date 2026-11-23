import { Moon, Sun } from 'lucide-react'

import { cx } from '../lib/cx'
import { useTheme } from '../lib/theme'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={cx(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface-2/70 px-2.5 text-[12px] font-medium text-muted shadow-card transition-colors hover:border-accent/40 hover:bg-surface-2 hover:text-fg',
        className,
      )}
    >
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
      <span className="hidden sm:inline">{next === 'light' ? 'Light' : 'Dark'}</span>
    </button>
  )
}
