import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, WifiOff } from 'lucide-react';
import { useSocket } from '../../context/SocketContext.jsx';

/** Shown when the realtime connection drops (e.g. Render cold start, network loss). */
export default function ConnectionBanner() {
  const { status } = useSocket();
  const [show, setShow] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    if (status === 'connected') {
      setShow(false);
      return undefined;
    }
    // Avoid flashing the banner for very short reconnects.
    const timer = setTimeout(() => setShow(true), 1800);
    return () => clearTimeout(timer);
  }, [status]);

  const visible = show || !online;
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
          role="status"
        >
          <div className="flex items-center justify-center gap-2 bg-amber-500/12 px-4 py-2 text-xs font-medium text-amber-600 dark:text-amber-300">
            {online ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WifiOff className="h-3.5 w-3.5" />}
            {online
              ? status === 'disconnected'
                ? 'Live updates are paused. Refresh the page to reconnect.'
                : 'Connecting to live updates… messages will sync automatically.'
              : "You're offline. Messages will sync when your connection returns."}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
