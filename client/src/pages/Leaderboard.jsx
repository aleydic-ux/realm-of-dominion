import { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatNumber, RACE_ICONS } from '../utils/formatters';

export default function Leaderboard({ province }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('overall');
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = 'Leaderboard — Realm of Dominion'; }, []);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/leaderboard');
        setData(data);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="text-realm-text-muted">Loading rankings...</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-display text-realm-gold">Rankings</h1>

      <div className="flex gap-1 border-b border-realm-border pb-2">
        {['overall', 'military', 'economic', 'alliances'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-t text-sm capitalize transition-colors ${
              tab === t ? 'bg-realm-panel border-t border-x border-realm-border text-realm-gold' : 'text-realm-text-muted hover:text-realm-gold'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'overall' && (
        <div className="realm-panel overflow-x-auto">
          <table className="realm-table">
            <thead><tr><th>#</th><th>Province</th><th>Player</th><th>Race</th><th>Land</th><th>Networth</th><th>Alliance</th></tr></thead>
            <tbody>
              {data.overall.map((p, i) => (
                <tr key={p.id} className={p.id === province?.id ? 'border-l-2 border-realm-gold bg-realm-gold/5' : ''}>
                  <td className="text-realm-gold font-bold">{i + 1}</td>
                  <td className="text-realm-text">{p.name}{p.id === province?.id && <span className="text-realm-text-dim text-xs ml-1">(you)</span>}</td>
                  <td className="text-realm-text-muted">{p.username}</td>
                  <td className={`race-${p.race}`}>{RACE_ICONS[p.race]} {p.race}</td>
                  <td>{formatNumber(p.land)}</td>
                  <td className="text-realm-gold font-bold">{formatNumber(p.networth)}</td>
                  <td className="text-realm-text-dim text-xs">{p.alliance_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'military' && (
        <div className="realm-panel overflow-x-auto">
          <table className="realm-table">
            <thead><tr><th>#</th><th>Province</th><th>Player</th><th>Race</th><th>Attacks Won</th><th>Land Captured</th></tr></thead>
            <tbody>
              {data.military.map((p, i) => (
                <tr key={p.id}>
                  <td className="text-red-400 font-bold">{i + 1}</td>
                  <td className="text-realm-text">{p.name}</td>
                  <td className="text-realm-text-muted">{p.username}</td>
                  <td className={`race-${p.race}`}>{RACE_ICONS[p.race]} {p.race}</td>
                  <td className="text-green-400">{p.successful_attacks || 0}</td>
                  <td className="text-amber-400">{formatNumber(p.total_land_gained || 0)} acres</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'economic' && (
        <div className="realm-panel overflow-x-auto">
          <table className="realm-table">
            <thead><tr><th>#</th><th>Province</th><th>Player</th><th>Race</th><th>Market Volume</th><th>Gold</th></tr></thead>
            <tbody>
              {data.economic.map((p, i) => (
                <tr key={p.id}>
                  <td className="text-yellow-400 font-bold">{i + 1}</td>
                  <td className="text-realm-text">{p.name}</td>
                  <td className="text-realm-text-muted">{p.username}</td>
                  <td className={`race-${p.race}`}>{RACE_ICONS[p.race]} {p.race}</td>
                  <td className="text-realm-gold">{formatNumber(p.marketplace_volume)}g</td>
                  <td className="text-yellow-400">{formatNumber(p.gold)}g</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'alliances' && (
        <div className="realm-panel overflow-x-auto">
          <table className="realm-table">
            <thead><tr><th>#</th><th>Alliance</th><th>Members</th><th>Total Networth</th></tr></thead>
            <tbody>
              {data.alliances.map((a, i) => (
                <tr key={a.id}>
                  <td className="text-purple-400 font-bold">{i + 1}</td>
                  <td className="text-realm-text font-medium">{a.name}</td>
                  <td className="text-realm-text-muted">{a.member_count}</td>
                  <td className="text-realm-gold font-bold">{formatNumber(a.total_networth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
