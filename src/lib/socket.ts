// src/lib/socket.ts — Socket.io client singleton

import { io, Socket } from 'socket.io-client';

// Socket.io client — lazy connect (don't import socket.io-client until needed)
let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
  }
  return socket;
}

/** Connect the socket with an authenticated JWT token */
export function connectSocket(token: string): Socket {
  const s = getSocket();
  s.auth = { token };
  if (!s.connected) {
    s.connect();
  }
  return s;
}

/** Disconnect and clear the socket (on logout) */
export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
  socket = null;
}

/** Get the current socket ID (for mutation deduplication) */
export function getSocketId(): string | undefined {
  return socket?.id;
}

/** Subscribe to a socket event. Returns an unsubscribe function. */
export function onSocket<T = unknown>(event: string, handler: (data: T) => void): () => void {
  const s = getSocket();
  s.on(event, handler);
  return () => s.off(event, handler);
}

/** Check if socket is currently connected */
export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}

export { getSocket };
