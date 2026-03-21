import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getApiError } from '../utils/api';
import { formatNumber, RACE_ICONS, isProtected } from '../utils/formatters';

const RACE_COLORS = {
  human: '#4080c0', orc: '#408040', undead: '#9040c0', elf: '#40c080', dwarf: '#c0a040',
};

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function PlayerProfileModal({ provinceId, myProvinceId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data: d } = await api.get(`/province/${provinceId}`);
        if (!cancelled) setData(d);
      } catch (err) {
        if (!cancelled) setError(getApiError(err, 'Failed to load profile'));
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [provinceId]);

  // Close on backdrop click
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  const p = data?.province;
  const isOwn = myProvinceId && p?.id === myProvinceId;
  const raceColor = p ? (RACE_COLORS[p.race] || '#8090a8') : '#8090a8';
  const bs = data?.battle_stats;

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div style={{
        background: '#0d1428',
        border: '1px solid #3a5878',
        borderTop: '2px solid #c8a048',
        width: '100%', maxWidth: '480px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px',
          borderBottom: '1px solid #243650',
          background: 'linear-gradient(to right, #1e3050, #162440)',
        }}>
          <span style={{ fontSize: '0.7rem', color: '#8090a8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Province Profile
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8090a8', fontSize: '1rem', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: '14px' }}>
          {loading && <div style={{ color: '#8090a8', fontSize: '0.8rem', textAlign: 'center', padding: '24px' }}>Loading...</div>}
          {error && <div style={{ color: '#cc4444', fontSize: '0.8rem', textAlign: 'center', padding: '24px' }}>{error}</div>}

          {data && p && (
            <>
              {/* Identity */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div style={{
                  fontSize: '2rem', lineHeight: 1,
                  background: `${raceColor}20`,
                  border: `1px solid ${raceColor}50`,
                  padding: '8px 12px',
                  flexShrink: 0,
                }}>
                  {RACE_ICONS[p.race] || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span className="font-display" style={{ fontSize: '1rem', fontWeight: 'bold', color: '#c8d8e8' }}>{p.name}</span>
                    {isOwn && <span style={{ fontSize: '0.6rem', padding: '1px 5px', background: 'rgba(200,160,72,0.15)', border: '1px solid rgba(200,160,72,0.4)', color: '#c8a048', borderRadius: '3px' }}>you</span>}
                    {p.is_bot && <span style={{ fontSize: '0.6rem', padding: '1px 5px', background: 'rgba(72,88,104,0.3)', border: '1px solid rgba(72,88,104,0.5)', color: '#485868', borderRadius: '3px' }}>BOT</span>}
                    {isProtected(p) && (
                      <span style={{ fontSize: '0.6rem', padding: '1px 5px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e', borderRadius: '3px' }}>🛡 Protected</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#8090a8', marginTop: '2px' }}>
                    Player: <span style={{ color: '#b0c0d0' }}>{p.username}</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', marginTop: '2px' }}>
                    <span style={{ color: raceColor, textTransform: 'capitalize' }}>{p.race}</span>
                    {p.alliance_name && (
                      <span style={{ color: '#8090a8' }}>
                        {' · '}
                        <span style={{ color: '#9070c8' }}>[{p.alliance_name}]</span>
                        {p.alliance_rank && <span style={{ color: '#6080a0', fontSize: '0.65rem' }}> {p.alliance_rank}</span>}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '12px' }}>
                {[
                  { label: 'Networth', value: formatNumber(p.networth), color: '#c8a048' },
                  { label: 'Land', value: `${formatNumber(p.land)} ac`, color: '#c8d8e8' },
                  { label: 'Morale', value: `${p.morale}%`, color: p.morale >= 80 ? '#22c55e' : p.morale >= 50 ? '#eab308' : '#ef4444' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#111828', border: '1px solid #1e3050', padding: '6px 8px' }}>
                    <div style={{ fontSize: '0.6rem', color: '#485868', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{s.label}</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Battle record */}
              {bs && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.65rem', color: '#8090a8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', borderBottom: '1px solid #1e3050', paddingBottom: '4px' }}>
                    Battle Record
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { label: 'Attacks Won', value: bs.attacks_won, color: '#22c55e' },
                      { label: 'Attacks Lost', value: bs.attacks_lost, color: '#ef4444' },
                      { label: 'Def Won', value: bs.defenses_won, color: '#22c55e' },
                      { label: 'Def Lost', value: bs.defenses_lost, color: '#ef4444' },
                    ].map(s => (
                      <div key={s.label} style={{ flex: 1, background: '#111828', border: '1px solid #1e3050', padding: '4px 6px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.6rem', color: '#485868' }}>{s.label}</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent battles */}
              {data.recent_battles?.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.65rem', color: '#8090a8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', borderBottom: '1px solid #1e3050', paddingBottom: '4px' }}>
                    Recent Battles
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {data.recent_battles.map((b, i) => {
                      const isAttacker = b.attacker_id === p.id;
                      const won = (isAttacker && b.outcome === 'win') || (!isAttacker && b.outcome !== 'win');
                      return (
                        <div key={i} style={{ fontSize: '0.68rem', color: '#8090a8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid #162030' }}>
                          <span>
                            <span style={{ color: won ? '#22c55e' : '#ef4444', fontWeight: 'bold', marginRight: '4px' }}>{won ? 'W' : 'L'}</span>
                            <span style={{ color: '#6080a0', textTransform: 'capitalize', marginRight: '4px' }}>{b.attack_type}</span>
                            {isAttacker ? <>vs <span style={{ color: '#b0c0d0' }}>{b.defender_name}</span></> : <>attacked by <span style={{ color: '#b0c0d0' }}>{b.attacker_name}</span></>}
                            {b.land_gained > 0 && <span style={{ color: '#c8a048', marginLeft: '4px' }}>(+{b.land_gained} ac)</span>}
                          </span>
                          <span style={{ fontSize: '0.6rem', color: '#485868', flexShrink: 0, marginLeft: '8px' }}>{timeAgo(b.attacked_at)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              {!isOwn && !p.is_bot && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  <button
                    className="realm-btn-gold"
                    style={{ flex: 1, fontSize: '0.72rem' }}
                    onClick={() => { navigate('/attack', { state: { target: p } }); onClose(); }}
                  >
                    ⚔ Attack
                  </button>
                  <button
                    className="realm-btn-outline"
                    style={{ flex: 1, fontSize: '0.72rem' }}
                    onClick={() => { navigate('/mail', { state: { composeTo: p } }); onClose(); }}
                  >
                    ✉ Send Mail
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
