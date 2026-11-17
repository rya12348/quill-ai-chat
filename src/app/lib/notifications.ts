import { useSyncExternalStore } from 'react'

export type NotificationSettings = {
  /** Built-in notices and the unread tab count. On by default. */
  inApp: boolean
  /** Native browser notifications, used only while Ink is in another tab. */
  browser: boolean
}

const IN_APP_KEY = 'ink:notifications:in-app'
const BROWSER_KEY = 'ink:notifications:browser'
const CHANGE_EVENT = 'ink:notifications:changed'

function readStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const value = window.localStorage.getItem(key)
    if (value === '1') return true
    if (value === '0') return false
  } catch {
    /* storage can be unavailable in private or locked-down browsers */
  }
  return fallback
}

function readSettings(): NotificationSettings {
  return {
    inApp: readStoredBoolean(IN_APP_KEY, true),
    // Browser notices are part of the default experience. The browser still
    // owns the permission prompt; Settings is the only place to turn them off.
    browser: readStoredBoolean(BROWSER_KEY, true),
  }
}

let current = readSettings()

export function getNotificationSettings(): NotificationSettings {
  return current
}

let permissionRequestAttempted = false
let permissionRequestScheduled = false

/**
 * Ask for the browser permission on the first real interaction. There is no
 * separate bell control: notifications are on by default and the browser's own
 * prompt is the only permission step. The returned cleanup lets the caller stop
 * waiting on pages (such as Settings) where the switch itself is the control.
 */
export function ensureBrowserNotificationPermission(): () => void {
  const noop = () => {}
  if (
    permissionRequestAttempted ||
    permissionRequestScheduled ||
    typeof Notification === 'undefined'
  ) {
    return noop
  }
  if (Notification.permission !== 'default' || !getNotificationSettings().browser) return noop
  permissionRequestScheduled = true
  const stopWaiting = () => {
    window.removeEventListener('pointerdown', ask, true)
    window.removeEventListener('keydown', ask, true)
    permissionRequestScheduled = false
  }
  const ask = () => {
    stopWaiting()
    permissionRequestAttempted = true
    if (Notification.permission !== 'default' || !getNotificationSettings().browser) return
    void Notification.requestPermission().catch(() => {
      /* a browser can refuse the prompt; notices stay off until allowed */
    })
  }
  window.addEventListener('pointerdown', ask, true)
  window.addEventListener('keydown', ask, true)
  return stopWaiting
}

export function setNotificationSetting(key: keyof NotificationSettings, enabled: boolean): void {
  current = { ...current, [key]: enabled }
  try {
    window.localStorage.setItem(key === 'inApp' ? IN_APP_KEY : BROWSER_KEY, enabled ? '1' : '0')
  } catch {
    /* the in-memory setting still applies for this page */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(listener: () => void): () => void {
  const onLocalChange = () => listener()
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== IN_APP_KEY && event.key !== BROWSER_KEY) return
    current = readSettings()
    listener()
  }
  window.addEventListener(CHANGE_EVENT, onLocalChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onLocalChange)
    window.removeEventListener('storage', onStorage)
  }
}

export function useNotificationSettings(): NotificationSettings {
  return useSyncExternalStore(subscribe, getNotificationSettings, getNotificationSettings)
}
