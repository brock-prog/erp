// server/src/socket/index.ts — Socket.io real-time broadcast

import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JwtPayload } from '../middleware/auth';

let io: SocketServer | null = null;

/** Called once from server/src/index.ts to initialize socket */
export function setupSocket(socketServer: SocketServer): void {
  io = socketServer;

  // Authenticate every socket connection via JWT
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      // Allow connection for kiosk screens (unauthenticated rooms)
      socket.data.userId = null;
      socket.data.role = 'viewer';
      socket.data.name = 'Kiosk';
      return next();
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
      socket.data.userId = payload.userId;
      socket.data.email = payload.email;
      socket.data.role = payload.role;
      socket.data.name = payload.name;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    // All authenticated users join the 'default' company room
    // In a multi-tenant setup, this would be socket.data.companyId
    socket.join('default');

    if (config.nodeEnv === 'development') {
      console.log(`🔌 Socket connected: ${socket.data.name || 'anonymous'} [${socket.id}]`);
    }

    // Send current online user list to the room
    broadcastOnlineUsers(socket);

    socket.on('disconnect', () => {
      if (config.nodeEnv === 'development') {
        console.log(`🔌 Socket disconnected: ${socket.data.name || 'anonymous'} [${socket.id}]`);
      }
      broadcastOnlineUsers(socket);
    });

    // Typing / presence events (optional, for future collaboration features)
    socket.on('user:typing', (data) => {
      socket.to('default').emit('user:typing', { ...data, userId: socket.data.userId, userName: socket.data.name });
    });
  });
}

/** Get the Socket.io instance (for use in route handlers) */
export function getIo(): SocketServer | null {
  return io;
}

/** Broadcast the list of currently connected, authenticated users */
async function broadcastOnlineUsers(socket: Socket): Promise<void> {
  if (!io) return;
  try {
    const sockets = await io.in('default').fetchSockets();
    const onlineUsers = sockets
      .filter(s => s.data.userId)
      .map(s => ({ userId: s.data.userId, name: s.data.name, role: s.data.role, socketId: s.id }));

    io.to('default').emit('users:online', onlineUsers);
  } catch {}
}
