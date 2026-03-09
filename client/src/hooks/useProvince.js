import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import api from '../utils/api';

export function useProvince() {
  const [province, setProvince] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [troops, setTroops] = useState([]);
  const [research, setResearch] = useState([]);
  const [alliance, setAlliance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [slowLoad, setSlowLoad] = useState(false);
  const initialLoadDone = useRef(false);

  const refresh = useCallback(async () => {
    try {
      if (!initialLoadDone.current) setLoading(true);
      const { data } = await api.get('/province/me');
      setProvince(data.province);
      setBuildings(data.buildings || []);
      setTroops(data.troops || []);
      setResearch(data.research || []);
      setAlliance(data.alliance || null);
      setError(null);
      setSlowLoad(false);
      initialLoadDone.current = true;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load province');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // After 12s show a "warming up" message but keep waiting
    const slowTimer = setTimeout(() => {
      if (!initialLoadDone.current) setSlowLoad(true);
    }, 12000);

    // After 90s give up and show retry button
    const hardTimeout = setTimeout(() => {
      if (!initialLoadDone.current) {
        setError('Server is taking too long to respond. It may be starting up.');
        setLoading(false);
      }
    }, 90000);

    refresh().finally(() => {
      clearTimeout(slowTimer);
      clearTimeout(hardTimeout);
    });

    // Poll every 60s for resource updates
    const slowInterval = setInterval(refresh, 60000);

    // Listen for server-pushed timer completion events via Socket.io
    const token = localStorage.getItem('token');
    let socket = null;
    if (token) {
      socket = io('/', { auth: { token }, transports: ['websocket', 'polling'] });
      socket.on('province_update', () => refresh());
    }

    return () => {
      clearTimeout(slowTimer);
      clearTimeout(hardTimeout);
      clearInterval(slowInterval);
      socket?.disconnect();
    };
  }, [refresh]);

  return { province, buildings, troops, research, alliance, loading, error, slowLoad, refresh };
}
