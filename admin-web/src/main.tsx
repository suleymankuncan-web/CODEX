import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HrAxisToaster } from './components/hr-axis-toaster'
import { ClerkSessionProvider } from './features/auth/clerk-session'
import { LocalizationProvider } from './features/localization/LocalizationProvider'
import { SessionProvider } from './features/session/session-context'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ClerkSessionProvider>
          <LocalizationProvider>
            <BrowserRouter>
              <App />
              <HrAxisToaster />
            </BrowserRouter>
          </LocalizationProvider>
        </ClerkSessionProvider>
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
)
