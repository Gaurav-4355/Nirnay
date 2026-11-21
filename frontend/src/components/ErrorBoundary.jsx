import React from 'react';

export default function ErrorBoundary({ children }) {
  const [hasError, setHasError] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    const errorHandler = (event) => {
      console.error('Unhandled UI error:', event.error);
      setHasError(true);
      setError(event.error);
    };
    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen bg-surface text-ink flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-xl w-full bg-surface border border-red/40 rounded-[10px] p-8 shadow-elevated space-y-4">
          <h2 className="text-[20px] font-bold text-red">
            Application error
          </h2>
          <p className="text-[14px] text-ink-soft leading-relaxed">
            A client-side error occurred. Clearing local browser cache may resolve this.
          </p>
          <pre className="bg-fill border border-line rounded-[6px] p-3 text-[12px] text-red overflow-x-auto whitespace-pre-wrap font-mono">
            {error?.toString() || 'Unknown error'}
          </pre>
          <div className="pt-2 flex gap-3">
            <button
              onClick={() => {
                if (typeof localStorage !== 'undefined') localStorage.clear();
                window.location.reload();
              }}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-[6px] text-[13px] font-semibold transition-colors"
            >
              Clear cache & reload
            </button>
            <button
              onClick={() => (window.location.href = '/')}
              className="px-4 py-2 bg-surface hover:bg-fill text-ink rounded-[6px] text-[13px] font-medium border border-line transition-colors"
            >
              Go to Today
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
