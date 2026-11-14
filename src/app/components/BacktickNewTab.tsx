import { useEffect } from 'react'

export const NEW_TAB_URL = 'https://classroom.google.com/'

/** Open the decoy tab. No page state is changed. */
export function openNewTab() {
  if (typeof window === 'undefined') return
  try {
    const tab = window.open(NEW_TAB_URL, '_blank')
    if (!tab) return
    try {
      tab.focus()
    } catch {
      /* The browser still opened the tab even if focus was refused. */
    }
    try {
      tab.opener = null
    } catch {
      /* Classroom is a different origin; the opener can be cleared. */
    }
  } catch {
    /* A popup blocker leaves the current page untouched. */
  }
}

/** Backtick opens a new tab. It does not cover or modify this page. */
export function BacktickNewTab() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return
      }
      if (event.code !== 'Backquote' && event.key !== '`') return
      event.preventDefault()
      event.stopPropagation()
      openNewTab()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  return null
}
