import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';

export function useProvince() {
  const [province, setProvince] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [troops, setTroops] = useState([]);
  const [research, setResearch] = useState([]);
  const [alliance, setAlliance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const troopsRef = useRef([]);
  const initialLoadDone = useRef(false);

  const refresh = useCallback(async () => {
    try {
      if (!initialLoadDone.current) setLoading(true);
      const { data } = await api.get('/province/me');
      setProvince(data.province);
      setBuildings(data.buildings || []);
      setTroops(data.troops || []);
      troopsRef.current = data.troops || [];
      setResearch(data.research || []);
      setAlliance(data.alliance || null);
      setError(null);
      initialLoadDone.current = true;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load province');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    // Poll every 5s when training/building is active, otherwise every 60s
    const interval = setInterval(() => {
      const hasActiveTimers =
        troopsRef.current.some(t => t.count_training > 0);
      if (hasActiveTimers) {
        refresh();
      }
    }, 5000);

    // Always poll every 60s for resources
    const slowInterval = setInterval(refresh, 60000);

    return () => {
      clearInterval(interval);
      clearInterval(slowInterval);
    };
  }, [refresh]);

  return { province, buildings, troops, research, alliance, loading, error, refresh };
}
