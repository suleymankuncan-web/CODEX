import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { HrAxisToaster } from './components/hr-axis-toaster'
import { TooltipProvider } from './components/ui/tooltip'
import { ClerkSessionProvider } from './features/auth/clerk-session'
import { LocalizationProvider } from './features/localization/LocalizationProvider'
import { SessionProvider } from './features/session/session-context'
import { captureFrontendException, initializeFrontendSentry } from './lib/sentry'
import { createQueryClientDefaultOptions } from './lib/query-client-defaults'
import './index.css'
import App from './App.tsx'

initializeFrontendSentry()

const queryClient = new QueryClient({
  defaultOptions: createQueryClientDefaultOptions(
    import.meta.env.VITE_PLAYWRIGHT_BUILD_PROFILE,
  ),
})

createRoot(document.getElementById('root')!, {
  onCaughtError: (error) => {
    captureFrontendException(error, {
      event: 'react.caught_error',
      source: 'react.onCaughtError',
    })
  },
  onUncaughtError: (error) => {
    captureFrontendException(error, {
      event: 'react.uncaught_error',
      source: 'react.onUncaughtError',
    })
  },
  onRecoverableError: (error) => {
    captureFrontendException(error, {
      event: 'react.recoverable_error',
      source: 'react.onRecoverableError',
      severity: 'warning',
    })
  },
}).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ClerkSessionProvider>
          <LocalizationProvider>
            <TooltipProvider>
              <BrowserRouter>
                <App />
                <HrAxisToaster />
              </BrowserRouter>
            </TooltipProvider>
          </LocalizationProvider>
        </ClerkSessionProvider>
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
)
