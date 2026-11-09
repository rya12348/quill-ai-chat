import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import { OfflineBanner } from './components/OfflineBanner'
import { Shell } from './components/Shell'
import { Spinner, ToastProvider } from './components/ui'
import { ApiError, useMe } from './lib/api'
import { Chat } from './pages/Chat'
import { Library } from './pages/Library'
import { Review } from './pages/Review'
import { Settings } from './pages/Settings'
import { SharedChat } from './pages/SharedChat'
import { SetupNeeded, SignIn } from './pages/SignIn'

// networkMode 'always' keeps cached queries running when the browser is
// offline: the service worker answers from its cache instead of pausing them.
const client = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000, networkMode: 'always' } } })

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
  if (me.error) return <SetupNeeded message={me.error.message} />
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Chat />} />
        <Route path="c/:id" element={<Chat />} />
        <Route path="library" element={<Library />} />
        <Route path="review" element={<Review />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export function App() {
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <BrowserRouter>
          <OfflineBanner />
          <Routes>
            <Route path="/s/:token" element={<SharedChat />} />
            <Route path="*" element={<Gate />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
