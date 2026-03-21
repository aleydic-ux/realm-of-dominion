import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatNumber, RACE_ICONS, isProtected } from '../utils/formatters';
import ProtectionBadge from '../components/ProtectionBadge';
import { usePageTitle } from '../hooks/usePageTitle';

export default function Kingdom({ province }) {
  const [provinces, setProvinces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  usePageTitle('Kingdom');

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
          className="realm-input w-full sm:w-48"
          placeholder="Search provinces..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-realm-text-muted">Loading kingdoms...</div>
      ) : (
        <>
        {/* Desktop table */}
        <div className="realm-panel overflow-x-auto hidden sm:block">
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
                    {isProtected(p) && (
                      <span className="text-blue-400">🛡️</span>
                    )}
                    {p.is_in_war && <span className="text-red-400 ml-1">⚔️</span>}
                  </td>
                  <td>
                    {p.id === province?.id ? (
                      <span className="text-realm-text-dim text-xs">(you)</span>
                    ) : (
                      <button
                        onClick={() => navigate('/attack', { state: { target: p } })}
                        className="realm-btn-outline text-xs py-1 px-2"
                      >
                        Attack
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <p className="text-realm-text-dim text-sm py-4 text-center">No provinces found.</p>
          )}
        </div>

        {/* Mobile card list */}
        <div className="sm:hidden space-y-2">
          {filtered.map((p, i) => (
            <div key={p.id} className="realm-panel flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-realm-text-dim text-xs w-5 shrink-0">{i + 1}</span>
                  <span className={`race-${p.race} text-sm`}>{RACE_ICONS[p.race]}</span>
                  <span className="text-realm-text font-medium text-sm truncate">{p.name}</span>
                  {isProtected(p) && (
                    <span className="text-blue-400 text-xs shrink-0">🛡️</span>
                  )}
                </div>
                <div className="flex gap-3 mt-0.5 ml-7 text-xs text-realm-text-muted flex-wrap">
                  <span>{p.username}</span>
                  <span className="text-realm-gold">{formatNumber(p.networth)} nw</span>
                  <span>{formatNumber(p.land)} ac</span>
                  {p.alliance_name && <span className="text-realm-text-dim">{p.alliance_name}</span>}
                </div>
              </div>
              {p.id === province?.id ? (
                <span className="text-realm-text-dim text-xs shrink-0">(you)</span>
              ) : (
                <button
                  onClick={() => navigate('/attack', { state: { target: p } })}
                  className="realm-btn-outline text-xs py-1.5 px-3 shrink-0"
                >
                  Attack
                </button>
              )}
            </div>
          ))}
          {!filtered.length && (
            <p className="text-realm-text-dim text-sm py-4 text-center">No provinces found.</p>
          )}
        </div>
        </>
      )}
    </div>
  );
}
