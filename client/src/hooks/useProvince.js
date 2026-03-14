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
  const [unreadCount, setUnreadCount] = useState(0);
  const [mailUnreadCount, setMailUnreadCount] = useState(0);
  const [raidAlert, setRaidAlert] = useState(null);
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
      // Fetch unread counts
      try {
        const [notifRes, mailRes] = await Promise.all([
          api.get('/notifications/unread-count'),
          api.get('/mail/unread-count'),
        ]);
        setUnreadCount(notifRes.data.count || 0);
        setMailUnreadCount(mailRes.data.count || 0);
      } catch { /* ignore — tables may not exist yet */ }
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error || 'Failed to load province';
      // 404 = server is running but no province found — show immediately, no point retrying
      if (status === 404) {
        setError(msg);
        setLoading(false);
        initialLoadDone.current = true;
        return;
      }
      // Other errors: only surface after initial load succeeded once
      if (initialLoadDone.current) {
        setError(msg);
      }
      // During initial load, let the timers handle messaging — just keep retrying
    } finally {
      if (initialLoadDone.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let retryTimer = null;

    // Retry every 8 seconds during initial load until server responds
    function scheduleRetry() {
      if (!initialLoadDone.current) {
        retryTimer = setTimeout(() => {
          refresh().finally(scheduleRetry);
        }, 8000);
      }
    }

    // After 12s show a "warming up" message but keep waiting
    const slowTimer = setTimeout(() => {
      if (!initialLoadDone.current) setSlowLoad(true);
    }, 12000);

    // After 90s give up and show retry button
    const hardTimer = setTimeout(() => {
      if (!initialLoadDone.current) {
        setError('Server is not responding. Please try again.');
        setLoading(false);
      }
    }, 90000);

    // First attempt — kick off retry chain on failure
    refresh().then(() => {
      clearTimeout(retryTimer);
    }).catch(() => {
      scheduleRetry();
    });

    // Poll every 60s for resource updates after initial load
    const pollInterval = setInterval(() => {
      if (initialLoadDone.current) refresh();
    }, 60000);

    const token = localStorage.getItem('token');
    let socket = null;
    if (token) {
      socket = io('/', {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 15000,
      });
      socket.on('province_update', () => refresh());
      socket.on('raid_alert', (data) => {
        setRaidAlert(data);
        setUnreadCount(c => c + 1);
      });
      socket.on('season_end', (data) => {
        window.dispatchEvent(new CustomEvent('season_end', { detail: data }));
      });
      // Refresh data when socket reconnects after a server restart
      socket.on('reconnect', () => refresh());
    }

    return () => {
      clearTimeout(retryTimer);
      clearTimeout(slowTimer);
      clearTimeout(hardTimer);
      clearInterval(pollInterval);
      socket?.disconnect();
    };
  }, [refresh]);

  const dismissRaidAlert = useCallback(() => setRaidAlert(null), []);
  const refreshUnread = useCallback(async () => {
    try {
      const [notifRes, mailRes] = await Promise.all([
        api.get('/notifications/unread-count'),
        api.get('/mail/unread-count'),
      ]);
      setUnreadCount(notifRes.data.count || 0);
      setMailUnreadCount(mailRes.data.count || 0);
    } catch { /* ignore */ }
  }, []);

  return { province, buildings, troops, research, alliance, loading, error, slowLoad, refresh, unreadCount, mailUnreadCount, raidAlert, dismissRaidAlert, refreshUnread };
}
