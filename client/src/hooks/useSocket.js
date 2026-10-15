import { useCallback } from 'react';
import { getSocket } from '../utils/socket';

// Alliance chat helpers on the shared app socket (see utils/socket.js)
export function useSocket() {
  // Joins the alliance room now and again after every reconnect (rooms don't survive one).
  // Returns a cleanup that leaves the room.
  const joinAlliance = useCallback((allianceId) => {
    const socket = getSocket();
    if (!socket) return () => {};
    const join = () => socket.emit('join_alliance', allianceId);
    if (socket.connected) join();
    socket.on('connect', join);
    return () => {
      socket.off('connect', join);
      socket.emit('leave_alliance', allianceId);
    };
  }, []);

  const onMessage = useCallback((callback) => {
    const socket = getSocket();
    if (!socket) return () => {};
    socket.on('chat_message', callback);
    return () => socket.off('chat_message', callback);
  }, []);

  return { joinAlliance, onMessage };
}
