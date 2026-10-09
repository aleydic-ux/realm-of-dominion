import { io } from 'socket.io-client';

// One authenticated socket shared by the whole app (province updates, raid alerts, alliance chat)
let socket = null;

export function getSocket() {
  if (!socket) {
    if (!localStorage.getItem('token')) return null;
    socket = io('/', {
      // Read the token on every (re)connect so a refreshed one (e.g. after a password change) is used
      auth: (cb) => cb({ token: localStorage.getItem('token') }),
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
