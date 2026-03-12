import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, connected: false });

const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

// Single shared socket instance — created lazily, never torn down by React
let sharedSocket: Socket | null = null;
let sharedToken: string | null = null;

function getSocket(token: string): Socket {
  if (sharedSocket && sharedToken === token) {
    return sharedSocket;
  }
  if (sharedSocket) {
    sharedSocket.disconnect();
  }
  sharedSocket = io(socketUrl, {
    auth: { token },
    transports: ['websocket'],
  });
  sharedToken = token;
  return sharedSocket;
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user || !token) return;

    const s = getSocket(token);

    const onConnect = () => {
      setConnected(true);
      s.emit('join', user.id);
    };
    const onDisconnect = () => setConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    // If already connected (e.g. StrictMode remount), sync state
    if (s.connected) {
      setConnected(true);
      s.emit('join', user.id);
    }

    setSocket(s);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, [user, token]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
