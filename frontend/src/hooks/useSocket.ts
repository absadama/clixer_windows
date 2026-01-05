/**
 * Clixer - WebSocket Hook
 * Real-time bağlantı ve event yönetimi
 * 
 * Kullanım:
 *   const { isConnected, subscribe, on } = useSocket();
 *   
 *   useEffect(() => {
 *     subscribe('dashboard', designId);
 *     on('data:refresh', handleRefresh);
 *   }, [designId]);
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

// Socket instance (singleton)
let socket: Socket | null = null;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Event types
export interface SocketEvents {
  // Server → Client
  'etl:completed': { datasetId: string; datasetName: string; rowsProcessed: number; timestamp: number };
  'data:changed': { datasetId: string; table: string; timestamp: number };
  'data:refresh': { type: string; datasetId: string; message: string };
  'dashboard:refresh': { designId: string; reason: string; timestamp: number };
  'notification:new': { id: string; title: string; message: string; type: string; createdAt: string };
  'notification:broadcast': { title: string; message: string; type: string; createdAt: string };
  'pong': { timestamp: number };
}

// Socket URL
const getSocketUrl = () => {
  if (typeof window === 'undefined') return '';
  
  // Production
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `${window.location.protocol}//${window.location.hostname}:4004`;
  }
  
  // Development
  return 'http://127.0.0.1:4004';
};

// Initialize socket connection
export const initSocket = (token: string): Socket => {
  if (socket?.connected) {
    return socket;
  }
  
  if (socket) {
    socket.disconnect();
  }
  
  const url = getSocketUrl();
  
  socket = io(url, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    autoConnect: true
  });
  
  socket.on('connect', () => {
    connectionAttempts = 0;
    console.log('🔌 WebSocket connected');
  });
  
  socket.on('disconnect', (reason) => {
    console.log('🔌 WebSocket disconnected:', reason);
  });
  
  socket.on('connect_error', (error) => {
    connectionAttempts++;
    console.warn('🔌 WebSocket connection error:', error.message);
    
    if (connectionAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('🔌 Max reconnection attempts reached');
      socket?.disconnect();
    }
  });
  
  return socket;
};

// Disconnect socket
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// Get current socket instance
export const getSocket = (): Socket | null => socket;

// ============================================
// REACT HOOK
// ============================================
export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastPing, setLastPing] = useState<number | null>(null);
  const eventHandlersRef = useRef<Map<string, Set<Function>>>(new Map());
  const accessToken = useAuthStore((state) => state.accessToken);
  
  // Initialize connection
  useEffect(() => {
    if (!accessToken) {
      disconnectSocket();
      setIsConnected(false);
      return;
    }
    
    const sock = initSocket(accessToken);
    
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    
    sock.on('connect', handleConnect);
    sock.on('disconnect', handleDisconnect);
    
    // Pong handler
    sock.on('pong', (data: { timestamp: number }) => {
      setLastPing(Date.now() - data.timestamp);
    });
    
    // Initial state
    setIsConnected(sock.connected);
    
    return () => {
      sock.off('connect', handleConnect);
      sock.off('disconnect', handleDisconnect);
      sock.off('pong');
    };
  }, [accessToken]);
  
  // Subscribe to a room (dashboard, dataset)
  const subscribe = useCallback((type: 'dashboard' | 'dataset', id: string) => {
    if (!socket?.connected) return;
    socket.emit(`subscribe:${type}`, id);
  }, []);
  
  // Unsubscribe from a room
  const unsubscribe = useCallback((type: 'dashboard' | 'dataset', id: string) => {
    if (!socket?.connected) return;
    socket.emit(`unsubscribe:${type}`, id);
  }, []);
  
  // Listen to an event
  const on = useCallback(<K extends keyof SocketEvents>(
    event: K,
    handler: (data: SocketEvents[K]) => void
  ) => {
    if (!socket) return () => {};
    
    socket.on(event as string, handler as any);
    
    // Track handler for cleanup
    if (!eventHandlersRef.current.has(event)) {
      eventHandlersRef.current.set(event, new Set());
    }
    eventHandlersRef.current.get(event)!.add(handler);
    
    // Return cleanup function
    return () => {
      socket?.off(event as string, handler as any);
      eventHandlersRef.current.get(event)?.delete(handler);
    };
  }, []);
  
  // Emit an event
  const emit = useCallback((event: string, data?: any) => {
    if (!socket?.connected) {
      console.warn('Socket not connected, cannot emit:', event);
      return false;
    }
    socket.emit(event, data);
    return true;
  }, []);
  
  // Ping server
  const ping = useCallback(() => {
    if (!socket?.connected) return;
    socket.emit('ping');
  }, []);
  
  // Cleanup all handlers on unmount
  useEffect(() => {
    return () => {
      eventHandlersRef.current.forEach((handlers, event) => {
        handlers.forEach((handler) => {
          socket?.off(event, handler as any);
        });
      });
      eventHandlersRef.current.clear();
    };
  }, []);
  
  return {
    isConnected,
    lastPing,
    subscribe,
    unsubscribe,
    on,
    emit,
    ping,
    socket: getSocket()
  };
};

export default useSocket;

