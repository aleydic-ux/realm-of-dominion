import { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatNumber } from '../utils/formatters';
import ProtectionBadge from '../components/ProtectionBadge';

export default function Leaderboard({ province }) {
  const [data, setData] = useState(null);
  const [hof, setHof] = useState(null);
  const [tab, setTab] = useState('overall');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => { document.title = 'Leaderboard — Realm of Dominion'; }, []);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) { setLoadError(true); setLoading(false); }
    }, 12000);
    async function load() {
      try {
        const [lbRes, hofRes] = await Promise.all([
          api.get('/leaderboard'),
          api.get('/leaderboard/hall-of-fame'),
        ]);
        if (!cancelled) { setData(lbRes.data); setHof(hofRes.data); }
      } catch {
        if (!cancelled) setLoadError(true);
      }
      if (!cancelled) setLoading(false);
      clearTimeout(timeout);
    }
    load();
    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);

  if (loading) return <div className="text-realm-text-muted">Loading rankings...</div>;
  if (loadError) return (
    <div className="space-y-3 text-center py-8">
      <p className="text-realm-text-muted">Failed to load. The server may be starting up.</p>
      <button onClick={() => window.location.reload()} className="realm-btn-gold">Retry</button>
    </div>
  );
  if (!data) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-display text-realm-gold">Rankings</h1>

      <div className="flex gap-1 border-b border-realm-border pb-2 flex-wrap">
        {['overall', 'military', 'economic', 'alliances', 'hall-of-fame'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-t text-sm capitalize transition-colors ${
              tab === t ? 'bg-realm-panel border-t border-x border-realm-border text-realm-gold' : 'text-realm-text-muted hover:text-realm-gold'
            }`}>
            {t === 'hall-of-fame' ? 'Hall of Fame' : t}
          </button>
        ))}
      </div>

      {tab === 'overall' && (
        <div className="realm-panel overflow-x-auto">
          <table className="realm-table">
            <thead><tr><th>#</th><th>Province</th><th>Player</th><th>Networth</th><th>Alliance</th></tr></thead>
            <tbody>
              {data.overall.map((p, i) => (
                <tr key={p.id} style={p.id === province?.id ? { background: 'rgba(200,160,72,0.08)', outline: '1px solid rgba(200,160,72,0.2)' } : undefined}>
                  <td className="text-realm-gold font-bold">{i === 0 ? '🏆 1' : i + 1}</td>
                  <td className="text-realm-text">
                    {p.name}
                    {p.id === province?.id && (
                      <span style={{ marginLeft: '6px', fontSize: '10px', color: 'rgb(200,160,72)', background: 'rgba(200,160,72,0.15)', border: '1px solid rgba(200,160,72,0.4)', padding: '1px 5px', borderRadius: '3px' }}>you</span>
                    )}
                    {p.protection_ends_at && new Date(p.protection_ends_at) > new Date() && (
                      <span className="ml-2 inline-block"><ProtectionBadge protection_ends_at={p.protection_ends_at} /></span>
                    )}
                  </td>
                  <td>{p.is_bot ? (
                    <span style={{ fontSize: '10px', padding: '1px 5px', background: 'rgba(72,88,104,0.3)', border: '1px solid rgba(72,88,104,0.5)', color: 'rgb(72,88,104)', borderRadius: '3px', letterSpacing: '0.05em' }}>BOT</span>
                  ) : (
                    <span className="text-realm-text-muted">{p.username}</span>
                  )}</td>
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
            <thead><tr><th>#</th><th>Province</th><th>Player</th><th>Attacks Won</th><th>Land Captured</th></tr></thead>
            <tbody>
              {data.military.map((p, i) => (
                <tr key={p.id}>
                  <td className="text-red-400 font-bold">{i === 0 ? '🏆 1' : i + 1}</td>
                  <td className="text-realm-text">{p.name}</td>
                  <td>{p.is_bot ? (
                    <span style={{ fontSize: '10px', padding: '1px 5px', background: 'rgba(72,88,104,0.3)', border: '1px solid rgba(72,88,104,0.5)', color: 'rgb(72,88,104)', borderRadius: '3px', letterSpacing: '0.05em' }}>BOT</span>
                  ) : <span className="text-realm-text-muted">{p.username}</span>}</td>
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
            <thead><tr><th>#</th><th>Province</th><th>Player</th><th>Market Volume</th><th>Gold</th></tr></thead>
            <tbody>
              {data.economic.map((p, i) => (
                <tr key={p.id}>
                  <td className="text-yellow-400 font-bold">{i === 0 ? '🏆 1' : i + 1}</td>
                  <td className="text-realm-text">{p.name}</td>
                  <td>{p.is_bot ? (
                    <span style={{ fontSize: '10px', padding: '1px 5px', background: 'rgba(72,88,104,0.3)', border: '1px solid rgba(72,88,104,0.5)', color: 'rgb(72,88,104)', borderRadius: '3px', letterSpacing: '0.05em' }}>BOT</span>
                  ) : <span className="text-realm-text-muted">{p.username}</span>}</td>
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
            <thead><tr><th>#</th><th>Alliance</th><th>Members</th><th>Bank</th><th>War W/L</th><th>Total Networth</th></tr></thead>
            <tbody>
              {data.alliances.map((a, i) => (
                <tr key={a.id}>
                  <td className="text-purple-400 font-bold">{i + 1}</td>
                  <td className="text-realm-text font-medium">{a.name}</td>
                  <td className="text-realm-text-muted">{a.member_count}</td>
                  <td className="text-realm-gold">{formatNumber(a.bank_gold || 0)}</td>
                  <td className="text-sm">
                    <span className="text-green-400">{a.war_wins || 0}</span>
                    <span className="text-realm-text-dim">/</span>
                    <span className="text-red-400">{a.war_losses || 0}</span>
                  </td>
                  <td className="text-realm-gold font-bold">{formatNumber(a.total_networth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'hall-of-fame' && (
        <div className="space-y-6">
          {!hof || hof.length === 0 ? (
            <div className="realm-panel text-realm-text-muted text-sm text-center py-8">
              No completed seasons yet. The first Hall of Fame will be recorded when the current season ends.
            </div>
          ) : (
            (() => {
              const byAge = {};
              for (const row of hof) {
                if (!byAge[row.age_id]) byAge[row.age_id] = { name: row.age_name, overall: [], military: [] };
                byAge[row.age_id][row.category]?.push(row);
              }
              return Object.entries(byAge).reverse().map(([ageId, age]) => (
                <div key={ageId} className="realm-panel space-y-3">
                  <h2 className="text-realm-gold font-display text-lg border-b border-realm-border pb-1">{age.name}</h2>
                  {age.overall.length > 0 && (
                    <>
                      <h3 className="text-realm-text-dim text-xs uppercase tracking-widest">Overall — Top Provinces</h3>
                      <table className="realm-table">
                        <thead><tr><th>#</th><th>Province</th><th>Player</th><th>Networth</th></tr></thead>
                        <tbody>
                          {age.overall.map(r => (
                            <tr key={r.id}>
                              <td className="text-realm-gold font-bold">{r.rank}</td>
                              <td className="text-realm-text">{r.province_name}</td>
                              <td className="text-realm-text-muted">{r.username}</td>
                              <td className="text-realm-gold font-bold">{formatNumber(r.final_networth)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                  {age.military.length > 0 && (
                    <>
                      <h3 className="text-realm-text-dim text-xs uppercase tracking-widest mt-2">Military — Top Conquerors</h3>
                      <table className="realm-table">
                        <thead><tr><th>#</th><th>Province</th><th>Player</th><th>Attacks Won</th></tr></thead>
                        <tbody>
                          {age.military.map(r => (
                            <tr key={r.id}>
                              <td className="text-red-400 font-bold">{r.rank}</td>
                              <td className="text-realm-text">{r.province_name}</td>
                              <td className="text-realm-text-muted">{r.username}</td>
                              <td className="text-green-400">{r.successful_attacks}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              ));
            })()
          )}
        </div>
      )}
    </div>
  );
}
