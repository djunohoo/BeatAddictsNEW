import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ErrorScreen } from './components/ErrorScreen'

const root = createRoot(document.getElementById('root')!)

// App.tsx transitively imports src/lib/supabase.ts, which throws at module
// load if VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are missing. That happens
// during import evaluation, before React ever mounts, so an ErrorBoundary
// alone can't catch it — a dynamic import lets us catch it here instead of
// white-screening with an uncaught exception.
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
