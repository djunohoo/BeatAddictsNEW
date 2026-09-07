export const ErrorScreen = ({ error }: { error: Error }) => (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f0f1e',
    color: '#f5f5f5',
    fontFamily: 'system-ui, sans-serif',
    padding: '2rem',
  }}>
    <div style={{ maxWidth: 480, textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Something went wrong</h1>
      <p style={{ color: '#a1a1aa', marginBottom: '1rem' }}>
        {error.message || 'The app hit an unexpected error and could not continue.'}
      </p>
      <p style={{ color: '#71717a', fontSize: '0.85rem' }}>
        If this keeps happening, check that your environment variables
        (e.g. Supabase URL/key) are configured correctly.
      </p>
    </div>
  </div>
);
