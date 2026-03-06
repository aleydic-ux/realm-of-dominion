import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatNumber, RACE_ICONS } from '../utils/formatters';
import ProtectionBadge from '../components/ProtectionBadge';

export default function Kingdom() {
  const [provinces, setProvinces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/province/list');
        setProvinces(data);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const filtered = provinces.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-display text-realm-gold">Kingdom</h1>
        <input
          className="realm-input w-48"
          placeholder="Search provinces..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-realm-text-muted">Loading kingdoms...</div>
      ) : (
        <div className="realm-panel overflow-x-auto">
          <table className="realm-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Province</th>
                <th>Player</th>
                <th>Race</th>
                <th>Land</th>
                <th>Networth</th>
                <th>Alliance</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id}>
                  <td className="text-realm-text-dim">{i + 1}</td>
                  <td className="text-realm-text font-medium">{p.name}</td>
                  <td className="text-realm-text-muted">{p.username}</td>
                  <td className={`race-${p.race}`}>{RACE_ICONS[p.race]} {p.race}</td>
                  <td>{formatNumber(p.land)}</td>
                  <td className="text-realm-gold">{formatNumber(p.networth)}</td>
                  <td className="text-realm-text-dim text-xs">{p.alliance_name || '—'}</td>
                  <td>
                    {p.protection_ends_at && new Date(p.protection_ends_at) > new Date() && (
                      <span className="text-blue-400">🛡️</span>
                    )}
                    {p.is_in_war && <span className="text-red-400 ml-1">⚔️</span>}
                  </td>
                  <td>
                    <button
                      onClick={() => navigate('/attack', { state: { target: p } })}
                      className="realm-btn-outline text-xs py-1 px-2"
                    >
                      Attack
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <p className="text-realm-text-dim text-sm py-4 text-center">No provinces found.</p>
          )}
        </div>
      )}
    </div>
  );
}
