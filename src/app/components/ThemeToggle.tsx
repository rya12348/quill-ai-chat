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
      className={cx('grid size-8 shrink-0 place-items-center rounded-tile text-faint transition-colors hover:bg-surface-2 hover:text-fg', className)}
    >
      {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
    </button>
  )
}
