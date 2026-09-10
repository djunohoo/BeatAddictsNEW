import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ErrorScreen } from './components/ErrorScreen'

const root = createRoot(document.getElementById('root')!)

// A dynamic import catches any module-load-time throw during App.tsx's
// import graph (before React mounts, so a React ErrorBoundary alone
// wouldn't catch it) and shows ErrorScreen instead of white-screening.
// src/lib/supabase.ts (which throws if its env vars are missing) is the
// motivating case for this, but as of now nothing in src/ actually imports
// that module — this guard is defensive for whenever something does.
import('./App.tsx')
  .then(({ default: App }) => {
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    )
  })
  .catch((error: Error) => {
    console.error('Failed to load the app:', error)
    root.render(
      <StrictMode>
        <ErrorScreen error={error} />
      </StrictMode>,
    )
  })
