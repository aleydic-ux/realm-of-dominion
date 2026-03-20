import { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatNumber, formatDateTime, RACE_ICONS } from '../utils/formatters';

function PowerBar({ attackerPower, defenderPower }) {
  const total = attackerPower + defenderPower || 1;
  const atkPct = Math.round((attackerPower / total) * 100);
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#8090a8', marginBottom: '3px' }}>
        <span>ATK: {formatNumber(attackerPower)}</span>
        <span>DEF: {formatNumber(defenderPower)}</span>
      </div>
      <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: '#162038' }}>
        <div style={{ width: `${atkPct}%`, background: 'linear-gradient(90deg, #ef4444, #f97316)', transition: 'width 0.3s' }} />
        <div style={{ width: `${100 - atkPct}%`, background: 'linear-gradient(90deg, #3b82f6, #6366f1)', transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function TroopLossSection({ title, losses, color, troopTypes = {} }) {
  if (!losses || typeof losses !== 'object') return null;
  const entries = Object.entries(losses).filter(([, v]) => v > 0);
  if (!entries.length) return null;
  const total = entries.reduce((s, [, v]) => s + v, 0);
  return (
    <div>
      <div style={{ color: '#8090a8', fontSize: '0.7rem', marginBottom: '4px' }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {entries.map(([id, count]) => {
          const tt = troopTypes[id] || troopTypes[parseInt(id)];
          const label = tt ? tt.name : `Type #${id}`;
          return (
            <span key={id} style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid #1e3050',
              borderRadius: '4px', padding: '2px 8px', fontSize: '0.7rem', color,
            }}>
              -{formatNumber(count)} {label}
            </span>
          );
        })}
      </div>
      <div style={{ fontSize: '0.65rem', color: '#485868', marginTop: '2px' }}>
        Total: {formatNumber(total)} troops lost
      </div>
    </div>
  );
}

function DetailPanel({ selected, province, onClose, troopTypes = {} }) {
  if (!selected) return null;

  const isSent = selected.attacker_province_id === province?.id;
  const outcomeColor = selected.outcome === 'win' ? '#22c55e' : selected.outcome === 'draw' ? '#eab308' : '#ef4444';
  const outcomeLabel = selected.outcome === 'win'
    ? (isSent ? 'VICTORY' : 'DEFEATED')
    : selected.outcome === 'draw'
      ? 'STALEMATE'
      : (isSent ? 'DEFEATED' : 'VICTORY');
  const outcomeDisplayColor = (selected.outcome === 'win' && isSent) || (selected.outcome === 'loss' && !isSent)
    ? '#22c55e' : selected.outcome === 'draw' ? '#eab308' : '#ef4444';

  // Build narrative
  const narrativeParts = [];
  if (isSent) {
    narrativeParts.push(`You launched a ${selected.attack_type} against ${selected.defender_name}.`);
  } else {
    narrativeParts.push(`${selected.attacker_name} launched a ${selected.attack_type} against your province.`);
  }

  if (selected.outcome === 'win') {
    if (selected.land_gained > 0) narrativeParts.push(`${selected.land_gained} acres of land were seized.`);
    const stolen = selected.resources_stolen || {};
    const stolenParts = Object.entries(stolen).filter(([, v]) => v > 0).map(([k, v]) => `${formatNumber(v)} ${k}`);
    if (stolenParts.length) narrativeParts.push(`Resources plundered: ${stolenParts.join(', ')}.`);
  } else if (selected.outcome === 'loss') {
    narrativeParts.push('The attack was repelled by the defenders.');
  } else {
    narrativeParts.push('Neither side gained a decisive advantage.');
  }

  return (
    <div className="realm-panel space-y-3">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 className="font-display" style={{ color: '#c8a048', fontSize: '1rem' }}>
          Battle Report #{selected.id}
        </h2>
        <button onClick={onClose} style={{ color: '#485868', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
      </div>

      {/* Outcome banner */}
      <div style={{
        textAlign: 'center', padding: '10px',
        background: `${outcomeDisplayColor}10`,
        border: `1px solid ${outcomeDisplayColor}40`,
        borderRadius: '6px',
      }}>
        <div className="font-display" style={{ fontSize: '1.1rem', fontWeight: 'bold', color: outcomeDisplayColor, letterSpacing: '0.1em' }}>
          {outcomeLabel}
        </div>
        <div style={{ fontSize: '0.7rem', color: '#8090a8', marginTop: '2px' }}>
          {selected.attack_type.toUpperCase()} — {formatDateTime(selected.attacked_at)}
        </div>
      </div>

      {/* Combatants */}
      <div className="grid grid-cols-2 gap-2">
        <div style={{
          background: isSent ? 'rgba(200,160,72,0.08)' : 'transparent',
          border: `1px solid ${isSent ? '#c8a04830' : '#1e3050'}`,
          borderRadius: '6px', padding: '8px',
        }}>
          <div style={{ color: '#485868', fontSize: '0.65rem', marginBottom: '4px' }}>
            {isSent ? 'YOU (Attacker)' : 'Attacker'}
          </div>
          <div style={{ color: '#c8d8e8', fontSize: '0.8rem' }}>
            <span style={{ marginRight: '4px' }}>{RACE_ICONS[selected.attacker_race]}</span>
            {selected.attacker_name}
          </div>
          <div style={{ color: '#ef4444', fontSize: '0.75rem' }}>
            {formatNumber(selected.attacker_power)} power
          </div>
        </div>
        <div style={{
          background: !isSent ? 'rgba(200,160,72,0.08)' : 'transparent',
          border: `1px solid ${!isSent ? '#c8a04830' : '#1e3050'}`,
          borderRadius: '6px', padding: '8px',
        }}>
          <div style={{ color: '#485868', fontSize: '0.65rem', marginBottom: '4px' }}>
            {!isSent ? 'YOU (Defender)' : 'Defender'}
          </div>
          <div style={{ color: '#c8d8e8', fontSize: '0.8rem' }}>
            <span style={{ marginRight: '4px' }}>{RACE_ICONS[selected.defender_race]}</span>
            {selected.defender_name}
          </div>
          <div style={{ color: '#3b82f6', fontSize: '0.75rem' }}>
            {formatNumber(selected.defender_power)} power
          </div>
        </div>
      </div>

      {/* Power comparison bar */}
      <PowerBar attackerPower={selected.attacker_power} defenderPower={selected.defender_power} />

      {/* Narrative */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', borderRadius: '4px', padding: '8px 10px',
        fontSize: '0.72rem', color: '#c8d8e8', lineHeight: '1.5',
        borderLeft: `3px solid ${outcomeDisplayColor}40`,
      }}>
        {narrativeParts.join(' ')}
      </div>

      {/* Spoils */}
      {selected.outcome === 'win' && (
        <div>
          {selected.land_gained > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.7rem', color: '#8090a8' }}>Land:</span>
              <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 'bold' }}>
                {isSent ? '+' : '-'}{selected.land_gained} acres
              </span>
            </div>
          )}
          {selected.resources_stolen && Object.entries(selected.resources_stolen).some(([, v]) => v > 0) && (
            <div>
              <div style={{ fontSize: '0.7rem', color: '#8090a8', marginBottom: '4px' }}>
                Resources {isSent ? 'plundered' : 'lost'}:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {Object.entries(selected.resources_stolen).filter(([, v]) => v > 0).map(([k, v]) => (
                  <span key={k} style={{
                    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: '4px', padding: '3px 8px', fontSize: '0.72rem',
                    color: isSent ? '#22c55e' : '#ef4444',
                  }}>
                    {isSent ? '+' : '-'}{formatNumber(v)} {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Casualties */}
      <div style={{ borderTop: '1px solid #1e3050', paddingTop: '8px' }}>
        <div className="font-display" style={{ color: '#c8a048', fontSize: '0.75rem', marginBottom: '6px' }}>
          Casualties
        </div>
        <div className="space-y-2">
          <TroopLossSection
            title={isSent ? 'Your losses (attacker)' : `${selected.attacker_name}'s losses`}
            losses={selected.attacker_losses}
            color="#ef4444"
            troopTypes={troopTypes}
          />
          <TroopLossSection
            title={!isSent ? 'Your losses (defender)' : `${selected.defender_name}'s losses`}
            losses={selected.defender_losses}
            color="#f97316"
            troopTypes={troopTypes}
          />
          {(!selected.attacker_losses || !Object.values(selected.attacker_losses).some(v => v > 0)) &&
           (!selected.defender_losses || !Object.values(selected.defender_losses).some(v => v > 0)) && (
            <div style={{ color: '#485868', fontSize: '0.7rem', fontStyle: 'italic' }}>No casualties recorded</div>
          )}
        </div>
      </div>

      {/* Troops deployed */}
      {selected.troops_deployed && Object.keys(selected.troops_deployed).length > 0 && (
        <div style={{ borderTop: '1px solid #1e3050', paddingTop: '8px' }}>
          <div style={{ color: '#8090a8', fontSize: '0.7rem', marginBottom: '4px' }}>Troops deployed by attacker</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {Object.entries(selected.troops_deployed).map(([id, count]) => {
              const tt = troopTypes[id] || troopTypes[parseInt(id)];
              const label = tt ? tt.name : `Type #${id}`;
              return (
                <span key={id} style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid #1e3050',
                  borderRadius: '4px', padding: '2px 8px', fontSize: '0.7rem', color: '#c8d8e8',
                }}>
                  {formatNumber(count)} {label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Return timer */}
      {selected.troops_return_at && isSent && (
        <div style={{ fontSize: '0.7rem', color: '#8090a8', borderTop: '1px solid #1e3050', paddingTop: '6px' }}>
          Troops {new Date(selected.troops_return_at) > new Date() ? 'return' : 'returned'}: {formatDateTime(selected.troops_return_at)}
        </div>
      )}
    </div>
  );
}

export default function Reports({ province }) {
  const [attacks, setAttacks] = useState([]);
  const [troopTypes, setTroopTypes] = useState({});
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState('all');

  usePageTitle('Reports');

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) { setLoadError(true); setLoading(false); }
    }, 12000);
    async function load() {
      try {
        const { data } = await api.get('/province/me/attacks');
        if (!cancelled) {
          setAttacks(data.attacks || data);
          setTroopTypes(data.troopTypes || {});
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
      if (!cancelled) setLoading(false);
      clearTimeout(timeout);
    }
    load();
    return () => { cancelled = true; clearTimeout(timeout); };
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
          ) : loadError ? (
            <div className="py-6 text-center space-y-2">
              <p className="text-red-400 text-sm">Failed to load reports. The server may be starting up.</p>
              <button onClick={() => window.location.reload()} className="realm-btn-gold text-xs">Retry</button>
            </div>
          ) : (
            <table className="realm-table">
              <thead><tr><th>Type</th><th>Opponent</th><th>Outcome</th><th>Date</th></tr></thead>
              <tbody>
                {filtered.map(a => {
                  const isSent = a.attacker_province_id === province?.id;
                  const opponent = isSent ? a.defender_name : a.attacker_name;
                  const opponentRace = isSent ? a.defender_race : a.attacker_race;
                  // Color from YOUR perspective: green if you won (sent+win or received+loss)
                  const youWon = (isSent && a.outcome === 'win') || (!isSent && a.outcome === 'loss');
                  const youLost = (isSent && a.outcome === 'loss') || (!isSent && a.outcome === 'win');
                  const outcomeColor = youWon ? 'text-green-400' : youLost ? 'text-red-400' : 'text-yellow-400';
                  const outcomeLabel = youWon ? 'victory' : youLost ? 'defeat' : 'draw';
                  return (
                    <tr key={a.id} className={`cursor-pointer ${selected?.id === a.id ? 'bg-realm-gold-dark/10' : ''}`} onClick={() => setSelected(a)}>
                      <td>
                        <span className="text-xs">{isSent ? '⚔️' : '🛡️'}</span>
                        <span className="ml-1 text-xs text-realm-text-dim">{a.attack_type}</span>
                      </td>
                      <td className="text-realm-text">
                        <span className={`race-${opponentRace} mr-1`}>{RACE_ICONS[opponentRace]}</span>
                        {opponent}
                      </td>
                      <td className={`font-medium ${outcomeColor}`}>{outcomeLabel}</td>
                      <td className="text-realm-text-dim text-xs">{formatDateTime(a.attacked_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!loading && !filtered.length && (
            <div className="py-6 text-center space-y-2">
              <div className="text-2xl">⚔️</div>
              <p className="text-realm-text-muted text-sm font-medium">No combat reports yet.</p>
              <p className="text-realm-text-dim text-xs">Reports appear here after you launch an attack or are attacked.</p>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <DetailPanel selected={selected} province={province} onClose={() => setSelected(null)} troopTypes={troopTypes} />
      </div>
    </div>
  );
}
