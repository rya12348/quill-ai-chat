import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react'

import { Butter } from './pages/Butter'
import { ButterDive } from './pages/ButterDive'
import { KrillionSource } from './pages/KrillionSource'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import { BacktickNewTab } from './components/BacktickNewTab'
import { ConnectionRecovery } from './components/ConnectionRecovery'
import { RoomNotifications } from './components/RoomNotifications'
import { OfflineBanner } from './components/OfflineBanner'
import { Shell } from './components/Shell'
import { Spinner, ToastProvider } from './components/ui'
import { ApiError, useMe } from './lib/api'
import { usePageTraffic } from './lib/traffic'
import { Analytics } from './pages/Analytics'
import { Browser } from './pages/Browser'
import { BrowserAgent } from './pages/BrowserAgent'
import { BrowserView } from './pages/BrowserView'
import { Buffy } from './pages/Buffy'
import { BuffyCode } from './pages/BuffyCode'
import { Chat } from './pages/Chat'
import { Humanizer } from './pages/Humanizer'
import { Privacy, Terms } from './pages/Legal'
import { Library } from './pages/Library'
import { Review } from './pages/Review'
import { Room } from './pages/Room'
import { Settings } from './pages/Settings'
import { SharedChat } from './pages/SharedChat'
import { SetupNeeded, SignIn } from './pages/SignIn'
import { WebBrowser } from './pages/WebBrowser'

// PDF libraries are large and only needed on the PDF tools page. Keep them out
// of the initial chat bundle so opening Ink does not download them first.
const PdfWorkbench = lazy(() => import('./pages/PdfWorkbench').then((module) => ({ default: module.PdfWorkbench })))

// networkMode 'always' keeps cached queries running when the browser is
// offline: the service worker answers from its cache instead of pausing them.
const client = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000, networkMode: 'always' } } })

/**
 * A malformed model payload must never leave the whole app on a blank screen.
 * Chat, Browser and Humanizer all have their own error states; this is the last
 * line of defence for a render-time failure.
 */
class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Ink render error', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="grid min-h-dvh place-items-center bg-bg px-6 text-center text-fg">
        <div className="max-w-sm">
          <p className="font-display text-[24px] font-medium">Something interrupted this page.</p>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            Your chats and drafts are saved. Reload to pick up where you left off.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3 text-[13.5px]">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-control bg-fg px-3.5 py-2 font-medium text-bg"
            >
              Reload Ink
            </button>
            <a href="/" className="rounded-control px-3.5 py-2 font-medium text-muted underline underline-offset-2 hover:text-fg">
              Go home
            </a>
          </div>
        </div>
      </main>
    )
  }
}

/** Counts SPA page views; the static asset server cannot see them. */
function PageTraffic() {
  usePageTraffic()
  return null
}

function Gate() {
  const me = useMe()
  if (me.isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner />
      </div>
    )
  }
  if (me.error instanceof ApiError && me.error.status === 401) return <SignIn />
  if (me.error) {
    const status = me.error instanceof ApiError ? me.error.status : 0
    // A 5xx is the server having a bad moment, not a setup problem: offer the
    // retry instead of a dead end the person has to reload the tab to escape.
    const retryable = !(me.error instanceof ApiError) || me.error.code === 'offline' || status === 0 || status === 503 || status >= 500
    return (
      <SetupNeeded
        message={me.error.message}
        onRetry={retryable ? () => void me.refetch() : undefined}
        database={/database binding/i.test(me.error.message)}
      />
    )
  }
  return (
    <>
      <RoomNotifications />
      <Routes>
        <Route path="browser" element={<Browser />} />
        <Route path="browser/agent" element={<BrowserAgent />} />
        {/* The cloud browser alone. Only the AI Agent opens this viewer; the
            Apps tiles and the Browser/Unblocker proxy never touch it. */}
        <Route path="browser/live" element={<BrowserView />} />
        <Route path="live" element={<Navigate to="/browser" replace />} />
        <Route element={<Shell />}>
          <Route index element={<Chat />} />
          <Route path="c/:id" element={<Chat />} />
          <Route path="buffy" element={<Buffy />} />
          <Route path="buffy/code" element={<BuffyCode />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="library" element={<Library />} />
          <Route path="humanizer" element={<Humanizer />} />
          <Route
            path="tools/pdf"
            element={
              <Suspense fallback={<div className="grid min-h-0 flex-1 place-items-center p-10"><Spinner /></div>}>
                <PdfWorkbench />
              </Suspense>
            }
          />
          {/* The Browser tool lives at /math; /proxy stays for older links. */}
          <Route path="math" element={<WebBrowser />} />
          <Route path="proxy" element={<WebBrowser />} />
          {/* A shortcut carries its site in the path, so it survives a dropped
              query string and can never fall back to Google. */}
          <Route path="proxy/*" element={<WebBrowser />} />
          <Route path="review" element={<Review />} />
          {/* The dive is the front door, the way krillion.io is: the party
              sits one step in, at /butter/party. */}
          <Route path="butter" element={<ButterDive />} />
          <Route path="butter/party" element={<Butter />} />
          {/* Deliberately outside /butter/*: that prefix is a game surface and
              hides the sidebar this page is reached from. */}
          <Route path="krillion-source" element={<KrillionSource />} />
          <Route path="room" element={<Room />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export function App() {
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AppErrorBoundary>
          <BrowserRouter>
            <PageTraffic />
            <ConnectionRecovery />
            <OfflineBanner />
            <BacktickNewTab />
            <Routes>
              <Route path="/s/:token" element={<SharedChat />} />
              {/* Direct auth entry lets a guest create or sign into an account. */}
              <Route path="/auth" element={<SignIn />} />
              <Route path="/signin" element={<Navigate to="/auth" replace />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="*" element={<Gate />} />
            </Routes>
          </BrowserRouter>
        </AppErrorBoundary>
      </ToastProvider>
    </QueryClientProvider>
  )
}
