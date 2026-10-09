import { useState, useEffect, useRef, useCallback } from 'react';
import api, { getApiError } from '../utils/api';
import { getSocket, disconnectSocket } from '../utils/socket';

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
  const lastDataHash = useRef('');

  const refresh = useCallback(async () => {
    try {
      if (!initialLoadDone.current) setLoading(true);
      const { data } = await api.get('/province/me');

      // Change detection: only update state if data actually changed
      const hash = JSON.stringify(data);
      if (hash !== lastDataHash.current) {
        lastDataHash.current = hash;
        setProvince(data.province);
        setBuildings(data.buildings || []);
        setTroops(data.troops || []);
        setResearch(data.research || []);
        setAlliance(data.alliance || null);
      }
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
      const msg = getApiError(err, 'Failed to load province');
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

    // Shared app socket; this hook owns its lifetime (App mounts it once per login)
    const socket = getSocket();
    const onProvinceUpdate = () => refresh();
    const onRaidAlert = (data) => {
      setRaidAlert(data);
      setUnreadCount(c => c + 1);
    };
    const onSeasonEnd = (data) => {
      window.dispatchEvent(new CustomEvent('season_end', { detail: data }));
    };
    if (socket) {
      socket.on('province_update', onProvinceUpdate);
      socket.on('raid_alert', onRaidAlert);
      socket.on('season_end', onSeasonEnd);
      // Refresh data when socket reconnects after a server restart ('reconnect' is a Manager event)
      socket.io.on('reconnect', onProvinceUpdate);
    }

    return () => {
      clearTimeout(retryTimer);
      clearTimeout(slowTimer);
      clearTimeout(hardTimer);
      clearInterval(pollInterval);
      if (socket) {
        socket.off('province_update', onProvinceUpdate);
        socket.off('raid_alert', onRaidAlert);
        socket.off('season_end', onSeasonEnd);
        socket.io.off('reconnect', onProvinceUpdate);
      }
      disconnectSocket();
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
