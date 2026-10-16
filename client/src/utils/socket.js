import { io } from 'socket.io-client';

// One authenticated socket shared by the whole app (province updates, raid alerts, alliance chat)
let socket = null;

export function getSocket() {
  if (!socket) {
    if (!localStorage.getItem('user')) return null;
    // The httpOnly session cookie authenticates the handshake (and every reconnect)
    socket = io('/', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 15000,
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
