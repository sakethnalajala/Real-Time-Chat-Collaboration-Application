import { useRouteError } from 'react-router';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Button from '../components/ui/Button.jsx';

/** Last-resort boundary: a failed lazy chunk (e.g. after a deploy) or an unexpected render error. */
export default function RouteError() {
  const error = useRouteError();
  const chunkFailed = /Failed to fetch dynamically imported module|Importing a module script failed/i.test(error?.message || '');

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/25 bg-rose-500/10 text-rose-500">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h1 className="text-xl font-bold text-fg">{chunkFailed ? 'A new version is available' : 'Something went wrong'}</h1>
      <p className="max-w-md text-sm text-muted">
        {chunkFailed
          ? 'The app was updated while this tab was open. Reload to get the latest version.'
          : 'An unexpected error occurred while rendering this page. Reloading usually fixes it.'}
      </p>
      <div className="flex gap-2">
        <Button leftIcon={RefreshCw} onClick={() => window.location.reload()}>
          Reload
        </Button>
        <Button variant="secondary" onClick={() => window.location.assign('/')}>
          Go home
        </Button>
      </div>
    </div>
  );
}
