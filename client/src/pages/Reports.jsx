import { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatNumber, formatDateTime, RACE_ICONS } from '../utils/formatters';

export default function Reports({ province }) {
  const [attacks, setAttacks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/province/me/attacks');
        setAttacks(data);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const filtered = attacks.filter(a => {
    if (filter === 'sent') return a.attacker_province_id === province?.id;
    if (filter === 'received') return a.defender_province_id === province?.id;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-display text-realm-gold">Combat Reports</h1>
        <div className="flex gap-2">
          {['all','sent','received'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`realm-btn text-xs py-1 px-3 border ${filter === f ? 'border-realm-gold text-realm-gold bg-realm-gold-dark/20' : 'border-realm-border text-realm-text-muted'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* List */}
        <div className="realm-panel overflow-x-auto">
          {loading ? (
            <p className="text-realm-text-muted">Loading...</p>
          ) : (
            <table className="realm-table">
              <thead><tr><th>Type</th><th>Opponent</th><th>Outcome</th><th>Date</th></tr></thead>
              <tbody>
                {filtered.map(a => {
                  const isSent = a.attacker_province_id === province?.id;
                  const opponent = isSent ? a.defender_name : a.attacker_name;
                  const opponentRace = isSent ? a.defender_race : a.attacker_race;
                  const outcomeColor = a.outcome === 'win' ? 'text-green-400' : a.outcome === 'draw' ? 'text-yellow-400' : 'text-red-400';
                  return (
                    <tr key={a.id} className="cursor-pointer" onClick={() => setSelected(a)}>
                      <td>
                        <span className="text-xs">{isSent ? '⚔️' : '🛡️'}</span>
                        <span className="ml-1 text-xs text-realm-text-dim">{a.attack_type}</span>
                      </td>
                      <td className="text-realm-text">
                        <span className={`race-${opponentRace} mr-1`}>{RACE_ICONS[opponentRace]}</span>
                        {opponent}
                      </td>
                      <td className={`font-medium ${outcomeColor}`}>{a.outcome}</td>
                      <td className="text-realm-text-dim text-xs">{formatDateTime(a.attacked_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!loading && !filtered.length && <p className="text-realm-text-dim text-sm py-4 text-center">No reports.</p>}
        </div>

        {/* Detail */}
        {selected && (
          <div className="realm-panel space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-realm-gold font-display">Report #{selected.id}</h2>
              <button onClick={() => setSelected(null)} className="text-realm-text-dim hover:text-realm-gold">✕</button>
            </div>
            <div className="text-sm space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="realm-panel">
                  <div className="text-realm-text-dim text-xs mb-1">Attacker</div>
                  <div className={`race-${selected.attacker_race}`}>{RACE_ICONS[selected.attacker_race]} {selected.attacker_name}</div>
                  <div className="text-red-400">Power: {formatNumber(selected.attacker_power)}</div>
                </div>
                <div className="realm-panel">
                  <div className="text-realm-text-dim text-xs mb-1">Defender</div>
                  <div className={`race-${selected.defender_race}`}>{RACE_ICONS[selected.defender_race]} {selected.defender_name}</div>
                  <div className="text-blue-400">Power: {formatNumber(selected.defender_power)}</div>
                </div>
              </div>
              <div className={`text-center text-xl font-bold ${selected.outcome === 'win' ? 'text-green-400' : selected.outcome === 'draw' ? 'text-yellow-400' : 'text-red-400'}`}>
                {selected.outcome.toUpperCase()}
              </div>
              {selected.land_gained > 0 && (
                <div><span className="text-realm-text-muted">Land gained: </span><span className="text-amber-400">+{selected.land_gained} acres</span></div>
              )}
              {selected.resources_stolen && Object.keys(selected.resources_stolen).length > 0 && (
                <div>
                  <span className="text-realm-text-muted">Resources stolen: </span>
                  {Object.entries(selected.resources_stolen).map(([k, v]) => (
                    v > 0 && <span key={k} className="text-yellow-400 mr-2">{k}: {formatNumber(v)}</span>
                  ))}
                </div>
              )}
              <div>
                <div className="text-realm-text-muted text-xs mb-1">Attack type: <span className="text-realm-text">{selected.attack_type}</span></div>
                <div className="text-realm-text-dim text-xs">{formatDateTime(selected.attacked_at)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
