import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socketRef.current = socket;
    return () => {
      socket.disconnect();
    };
  }, []);

  function joinAlliance(allianceId) {
    socketRef.current?.emit('join_alliance', allianceId);
  }

  function onMessage(callback) {
    socketRef.current?.on('chat_message', callback);
    return () => socketRef.current?.off('chat_message', callback);
  }

  return { socket: socketRef.current, connected, joinAlliance, onMessage };
}
