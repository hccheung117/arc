import { useState } from 'react';
import { Zap } from 'lucide-react';
import type { HelloResponse } from '../../types/types';
import { cn } from '@/lib/utils';

export function Showoff() {
  const [response, setResponse] = useState<HelloResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const result = await window.electron.sayHello();
      setResponse(result);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-title font-semibold">Arc Desktop</h1>
        <p className="text-muted-foreground text-body">
          Electron + Vite + React + Tailwind
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="text-label font-medium">IPC Demo</span>
          </div>

          <p className="text-meta text-muted-foreground">
            Click the button to send a typed message to the Main process and
            receive a response.
          </p>

          <button
            onClick={handleClick}
            disabled={loading}
            className={cn(
              'w-full rounded-lg bg-primary px-4 py-2.5 text-label font-medium text-primary-foreground',
              'transition-colors hover:bg-primary/90',
              'disabled:pointer-events-none disabled:opacity-50'
            )}
          >
            {loading ? 'Calling...' : 'Say Hello'}
          </button>

          {response && (
            <div className="rounded-lg bg-muted p-4 space-y-1">
              <p className="text-body font-medium">{response.message}</p>
              <p className="text-meta text-muted-foreground">
                {new Date(response.timestamp).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
