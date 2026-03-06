import { formatNumber, formatTime, formatDateTime, RACE_ICONS } from '../utils/formatters';
import ProtectionBadge from '../components/ProtectionBadge';
import api from '../utils/api';
import { useState } from 'react';

export default function Dashboard({ province, loading, refresh }) {
  const [exploreLoading, setExploreLoading] = useState(false);
  const [message, setMessage] = useState('');

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
          { label: 'Land', value: `${formatNumber(province.land)} acres`, color: 'text-amber-400' },
          { label: 'Gold', value: formatNumber(province.gold), color: 'text-yellow-400' },
          { label: 'Food', value: formatNumber(province.food), color: province.food < 0 ? 'text-red-400' : 'text-green-400' },
          { label: 'Mana', value: formatNumber(province.mana), color: 'text-blue-400' },
          { label: 'Industry', value: formatNumber(province.production_points), color: 'text-gray-300' },
          { label: 'Population', value: formatNumber(province.population), color: 'text-pink-400' },
          { label: 'Morale', value: `${province.morale}%`, color: province.morale >= 80 ? 'text-green-400' : 'text-red-400' },
          { label: 'Networth', value: formatNumber(province.networth), color: 'text-realm-gold' },
        ].map(({ label, value, color }) => (
          <div key={label} className="realm-panel">
            <div className="text-realm-text-dim text-xs mb-1">{label}</div>
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
        <div className="w-full h-4 bg-realm-surface rounded-full border border-realm-border overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(province.action_points / 20) * 100}%`,
              background: province.action_points > 10 ? '#c9a227' : province.action_points > 4 ? '#e87c00' : '#8b1a1a',
            }}
          />
        </div>
        <p className="text-realm-text-dim text-xs mt-1">Regenerates 1 AP every 30 minutes (max 20)</p>
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

      {/* Age Info */}
      {province.age_name && (
        <div className="realm-panel flex items-center gap-4 text-sm">
          <div>
            <span className="text-realm-text-dim">Age: </span>
            <span className="text-realm-gold">{province.age_name}</span>
          </div>
          {province.age_ends_at && (
            <div>
              <span className="text-realm-text-dim">Ends: </span>
              <span className="text-realm-text-muted">{formatDateTime(province.age_ends_at)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
