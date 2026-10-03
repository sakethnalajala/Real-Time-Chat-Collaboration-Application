import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { refreshAccessToken } from '../services/api.js';
import { SOCKET_AUTH_ERRORS, createSocket } from '../services/socket.js';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext({ socket: null, status: 'connecting' });

/**
 * One Socket.IO connection per signed-in session.
 * Handles token expiry (refresh → reconnect) and server-initiated disconnects.
 */
export function SocketProvider({ children }) {
  const { status: authStatus, user, endSession } = useAuth();
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState('connecting');
  const userId = user?._id;

  useEffect(() => {
    if (authStatus !== 'authenticated' || !userId) return undefined;

    const instance = createSocket();
    let disposed = false;
    let authRetries = 0;

    const reconnectWithFreshToken = async () => {
      if (authRetries >= 3) {
        setStatus('disconnected');
        return;
      }
      authRetries += 1;
      try {
        await refreshAccessToken();
        if (!disposed) instance.connect();
      } catch {
        if (!disposed) {
          toast.error('Your session has ended. Please sign in again.');
          endSession();
        }
      }
    };

    instance.on('connect', () => {
      authRetries = 0;
      setStatus('connected');
    });
    instance.on('disconnect', (reason) => {
      if (disposed) return;
      setStatus('reconnecting');
      // The server closed the connection (e.g. password changed): reconnect with a new token.
      if (reason === 'io server disconnect') reconnectWithFreshToken();
    });
    instance.on('connect_error', (error) => {
      if (disposed) return;
      if (error.message === 'ACCOUNT_SUSPENDED') {
        toast.error('Your account has been suspended.');
        endSession();
      } else if (SOCKET_AUTH_ERRORS.has(error.message)) {
        reconnectWithFreshToken();
      } else {
        setStatus('reconnecting');
      }
    });

    instance.connect();
    setSocket(instance);
    setStatus('connecting');

    return () => {
      disposed = true;
      instance.removeAllListeners();
      instance.disconnect();
      setSocket(null);
    };
  }, [authStatus, userId, endSession]);

  const value = useMemo(() => ({ socket, status }), [socket, status]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);
