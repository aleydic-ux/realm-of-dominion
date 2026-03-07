import { formatNumber, formatTime, formatDateTime, formatRelativeDate, RACE_ICONS } from '../utils/formatters';
import ProtectionBadge from '../components/ProtectionBadge';
import api from '../utils/api';
import { useState, useEffect } from 'react';

const AP_REGEN_MS = 30 * 60 * 1000; // 30 minutes per AP

function useAPCountdown(apLastRegen, actionPoints) {
  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    if (actionPoints >= 20 || !apLastRegen) { setCountdown(''); return; }
    const tick = () => {
      const elapsed = Date.now() - new Date(apLastRegen).getTime();
      const remaining = AP_REGEN_MS - (elapsed % AP_REGEN_MS);
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [apLastRegen, actionPoints]);
  return countdown;
}

export default function Dashboard({ province, loading, refresh }) {
  const [exploreLoading, setExploreLoading] = useState(false);
  const [message, setMessage] = useState('');
  const apCountdown = useAPCountdown(province?.ap_last_regen, province?.action_points);

  useEffect(() => { document.title = 'Province — Realm of Dominion'; }, []);

  if (loading) return <div className="text-realm-text-muted">Loading province...</div>;
  if (!province) return <div className="text-red-400">No province found for the active Age.</div>;

  async function handleExplore() {
    setExploreLoading(true);
    setMessage('');
    try {
      const { data } = await api.post('/province/explore');
      setMessage(`Explored ${data.land_gained} acres of new territory!`);
      refresh();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Exploration failed');
    } finally {
      setExploreLoading(false);
    }
  }

  return (
    <div className="space-y-4">

      {/* Castle Banner */}
      <div style={{
        position: 'relative',
        border: '1px solid #243650',
        borderTop: '2px solid #c8a048',
        overflow: 'hidden',
      }}>
        <img
          src="/castle-banner.png"
          alt="Castle Banner"
          style={{width:'100%', display:'block', maxHeight:'220px', objectFit:'cover', objectPosition:'center'}}
        />
        {/* Overlay text */}
        <div style={{position:'absolute', inset:0, background:'linear-gradient(to right, rgba(6,14,28,0.75) 0%, rgba(6,14,28,0.1) 50%, rgba(6,14,28,0.6) 100%)', display:'flex', alignItems:'flex-end', justifyContent:'space-between', padding:'12px 20px'}}>
          <div>
            <div style={{fontFamily:'Cinzel, Georgia, serif', color:'#c8a048', fontSize:'1.6rem', fontWeight:'700', textShadow:'2px 2px 4px #000, 0 0 12px rgba(200,160,72,0.5)', letterSpacing:'0.1em'}}>
              {province.name}
            </div>
            <div className={`race-${province.race}`} style={{fontFamily:'Cinzel, Georgia, serif', fontSize:'0.8rem', letterSpacing:'0.12em', textShadow:'1px 1px 2px #000'}}>
              {RACE_ICONS[province.race]} {province.race.toUpperCase()} PROVINCE
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontFamily:'Cinzel, Georgia, serif', color:'#c8a048', fontSize:'0.7rem', letterSpacing:'0.08em'}}>NETWORTH</div>
            <div style={{fontFamily:'Cinzel, Georgia, serif', color:'#fdf8ef', fontSize:'1.2rem', fontWeight:'700', textShadow:'1px 1px 2px #000'}}>{formatNumber(province.networth)}</div>
          </div>
        </div>
      </div>

      {/* Age banner */}
      {province.age_name && (
        <div className="flex items-center justify-between gap-4 px-1 py-1 text-xs border-b border-realm-border">
          <span className="text-realm-text-dim">
            ⏳ <span className="text-realm-text-muted font-medium">{province.age_name}</span>
          </span>
          {province.age_ends_at && (
            <span className="text-realm-gold" title={formatDateTime(province.age_ends_at)}>
              Ends {formatRelativeDate(province.age_ends_at)}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-display text-realm-gold">
          Province Overview
        </h1>
        <div className="flex gap-2 items-center flex-wrap">
          <ProtectionBadge protection_ends_at={province.protection_ends_at} />
          {province.is_in_war && (
            <span className="realm-badge bg-red-900/40 border-red-600 text-red-400">⚔️ AT WAR</span>
          )}
          <span className={`realm-badge race-${province.race} border-current bg-transparent`}>
            {province.race.toUpperCase()}
          </span>
        </div>
      </div>

      {message && (
        <div className="bg-realm-surface border border-realm-gold/30 text-realm-gold px-3 py-2 rounded text-sm">
          {message}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {[
          { label: 'Land', icon: '🗺️', value: `${formatNumber(province.land)} acres`, color: 'text-amber-400' },
          { label: 'Gold', icon: '💰', value: formatNumber(province.gold), color: 'text-yellow-400' },
          { label: 'Food', icon: '🌾', value: formatNumber(province.food), color: province.food < 0 ? 'text-red-400' : 'text-green-400' },
          { label: 'Mana', icon: '🔮', value: formatNumber(province.mana), color: 'text-blue-400' },
          { label: 'Industry', icon: '⚙️', value: formatNumber(province.production_points), color: 'text-gray-300' },
          { label: 'Population', icon: '👥', value: formatNumber(province.population), color: 'text-pink-400' },
          { label: 'Morale', icon: '❤️', value: `${province.morale}%`, color: province.morale >= 80 ? 'text-green-400' : 'text-red-400' },
          { label: 'Networth', icon: '📈', value: formatNumber(province.networth), color: 'text-realm-gold' },
        ].map(({ label, icon, value, color }) => (
          <div key={label} className="realm-panel">
            <div className="text-realm-text-dim text-xs mb-1">{icon} {label}</div>
            <div className={`text-lg font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Action Points */}
      <div className="realm-panel">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-realm-gold font-display">Action Points</h2>
          <span className="text-realm-gold font-bold">{province.action_points} / 20</span>
        </div>
        <div
          role="progressbar"
          aria-label="Action Points"
          aria-valuenow={province.action_points}
          aria-valuemin={0}
          aria-valuemax={20}
          className="w-full h-4 bg-realm-surface rounded-full border border-realm-border overflow-hidden"
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(province.action_points / 20) * 100}%`,
              background: province.action_points > 10 ? '#c9a227' : province.action_points > 4 ? '#e87c00' : '#8b1a1a',
            }}
          />
        </div>
        <p className="text-realm-text-dim text-xs mt-1">
          Regenerates 1 AP every 30 minutes (max 20)
          {apCountdown && <span className="ml-2 text-realm-gold">· Next in ~{apCountdown}</span>}
        </p>
      </div>

      {/* Explore */}
      <div className="realm-panel">
        <h2 className="text-realm-gold font-display mb-3">Explore Territory</h2>
        <p className="text-realm-text-muted text-sm mb-3">
          Send scouts to claim unclaimed land. Costs 1 AP. Gains 5–25 acres.
        </p>
        <button
          onClick={handleExplore}
          disabled={exploreLoading || province.action_points < 1}
          className="realm-btn-gold"
        >
          {exploreLoading ? 'Exploring...' : '🗺️ Explore (1 AP)'}
        </button>
      </div>

    </div>
  );
}
