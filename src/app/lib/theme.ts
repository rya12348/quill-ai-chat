import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const listeners = new Set<() => void>()
let initialized = false

function systemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function savedTheme(): Theme | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved === 'light' || saved === 'dark' ? saved : undefined
  } catch {
    return undefined
  }
}

function readTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function applyTheme(theme: Theme, persist: boolean) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#141310' : '#f7f6f2')
  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* private browsing can refuse storage; the page still changes theme */
    }
  }
  listeners.forEach((listener) => listener())
}

export function initTheme() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  const saved = savedTheme()
  applyTheme(saved ?? systemTheme(), false)
  if (saved) return
  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  if (!media) return
  const onChange = (event: MediaQueryListEvent) => {
    if (!savedTheme()) applyTheme(event.matches ? 'dark' : 'light', false)
  }
  if (media.addEventListener) media.addEventListener('change', onChange)
  else media.addListener(onChange)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'light')
  return {
    theme,
    toggle: () => applyTheme(readTheme() === 'dark' ? 'light' : 'dark', true),
  }
}
