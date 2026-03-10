import { formatNumber, formatTime, formatDateTime, formatRelativeDate, RACE_ICONS } from '../utils/formatters';
import ProtectionBadge from '../components/ProtectionBadge';
import Tooltip from '../components/Tooltip';
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

const STATUS_COLORS = {
  healthy: 'rgb(74, 222, 128)',
  warning: 'rgb(251, 191, 36)',
  critical: 'rgb(248, 113, 113)',
  neutral: 'rgb(36, 54, 80)',
};

function getCardStatus(label, province, rates) {
  if (label === 'Food') {
    if (province.food < 1000) return 'critical';
    if (rates && rates.food_per_hour < 0) return 'warning';
    return 'healthy';
  }
  if (label === 'Morale') {
    if (province.morale < 50) return 'critical';
    if (province.morale < 75) return 'warning';
    return 'healthy';
  }
  if (label === 'Gold') {
    if (province.gold < 20) return 'critical';
    if (province.gold < 100) return 'warning';
    return 'neutral';
  }
  return 'neutral';
}

export default function Dashboard({ province, loading, refresh }) {
  const [exploreLoading, setExploreLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [rates, setRates] = useState(null);
  const [dropConfirm, setDropConfirm] = useState(false);
  const [dropLoading, setDropLoading] = useState(false);
  const apCountdown = useAPCountdown(province?.ap_last_regen, province?.action_points);

  useEffect(() => { document.title = 'Province — Realm of Dominion'; }, []);

  useEffect(() => {
    if (!province) return;
    api.get('/province/rates').then(r => setRates(r.data)).catch(() => {});
  }, [province?.id, province?.land]);

  if (loading) return <div className="text-realm-text-muted">Loading province...</div>;
  if (!province) return <div className="text-red-400">No province found for the active Age.</div>;

  const ap = province.action_points;
  const maxAp = 20;
  const apPct = (ap / maxAp) * 100;

  // Age progress calculation
  let agePct = null;
  if (province.age_ends_at && province.age_started_at) {
    const start = new Date(province.age_started_at).getTime();
    const end = new Date(province.age_ends_at).getTime();
    const now = Date.now();
    if (end > start) agePct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  }

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

  async function handleDropProtection() {
    setDropLoading(true);
    try {
      await api.post('/province/drop-protection');
      setMessage('Protection dropped. Your kingdom is now at war!');
      setDropConfirm(false);
      refresh();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to drop protection');
    } finally {
      setDropLoading(false);
    }
  }

  const isProtected = province.protection_ends_at && new Date(province.protection_ends_at) > new Date();

  const statCards = [
    { label: 'Land', icon: '🗺️', value: `${formatNumber(province.land)} acres`, color: 'text-amber-400' },
    { label: 'Gold', icon: '💰', value: formatNumber(province.gold), color: 'text-yellow-400',
      sub: rates && `+${formatNumber(rates.gold_per_hour)}/hr`,
      tip: rates && `+${formatNumber(rates.gold_per_hour)}/hr` },
    { label: 'Food', icon: '🌾', value: formatNumber(province.food), color: province.food < 0 ? 'text-red-400' : 'text-green-400',
      sub: rates && `Net: ${rates.food_per_hour >= 0 ? '+' : ''}${formatNumber(rates.food_per_hour)}/hr`,
      tip: rates && `+${formatNumber(rates.food_production)}/hr production\n-${formatNumber(rates.food_upkeep)}/hr upkeep\nNet: ${rates.food_per_hour >= 0 ? '+' : ''}${formatNumber(rates.food_per_hour)}/hr` },
    { label: 'Mana', icon: '🔮', value: formatNumber(province.mana), color: 'text-blue-400',
      sub: rates && `+${formatNumber(rates.mana_per_hour)}/hr`,
      tip: rates && `+${formatNumber(rates.mana_per_hour)}/hr` },
    { label: 'Industry', icon: '⚙️', value: formatNumber(province.industry_points), color: 'text-gray-300',
      sub: rates && `+${formatNumber(rates.industry_per_hour)}/hr`,
      tip: rates && `+${formatNumber(rates.industry_per_hour)}/hr` },
    { label: 'Population', icon: '👥', value: formatNumber(province.population), color: 'text-realm-text' },
    { label: 'Morale', icon: '❤️', value: `${province.morale}%`, color: province.morale >= 80 ? 'text-green-400' : 'text-red-400',
      sub: `+${province.morale}% ATK/DEF bonus` },
    { label: 'Networth', icon: '📈', value: formatNumber(province.networth), color: 'text-realm-gold' },
  ];

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
        {/* Overlay with improved gradient scrim */}
        <div style={{position:'absolute', inset:0, background:'linear-gradient(to top, rgba(6,14,28,0.85) 0%, rgba(6,14,28,0.15) 50%), linear-gradient(to right, rgba(6,14,28,0.7) 0%, transparent 40%, rgba(6,14,28,0.7) 100%)', display:'flex', alignItems:'flex-end', justifyContent:'space-between', padding:'12px 20px'}}>
          <div>
            <div style={{fontFamily:'Cinzel, Georgia, serif', color:'#c8a048', fontSize:'1.6rem', fontWeight:'700', textShadow:'2px 2px 4px #000, 0 0 12px rgba(200,160,72,0.5)', letterSpacing:'0.1em'}}>
              {province.name}
            </div>
            <div className={`race-${province.race}`} style={{fontFamily:'Cinzel, Georgia, serif', fontSize:'0.8rem', letterSpacing:'0.12em', textShadow:'1px 1px 2px #000'}}>
              {RACE_ICONS[province.race]} {province.race.toUpperCase()} PROVINCE
            </div>
          </div>
          {/* Networth pill badge */}
          <div style={{
            background: 'rgba(10, 16, 32, 0.75)',
            border: '1px solid rgba(200, 160, 72, 0.5)',
            borderRadius: '4px',
            padding: '4px 10px',
            textAlign: 'right'
          }}>
            <div className="text-realm-text-dim" style={{ fontSize: '9px', letterSpacing: '0.08em' }}>NETWORTH</div>
            <div className="text-realm-gold font-display font-bold" style={{ fontSize: '18px' }}>{formatNumber(province.networth)}</div>
          </div>
        </div>
      </div>

      {/* Age banner with progress bar */}
      {province.age_name && (
        <div className="flex items-center justify-between px-1 py-1 text-xs border-b border-realm-border" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <span className="text-realm-text-dim">
            ⏳ <span className="text-realm-text-muted font-medium">{province.age_name}</span>
          </span>
          {agePct !== null && (
            <div style={{ flex: 1, margin: '0 12px', height: '3px', background: 'rgba(36,54,80,1)', borderRadius: '2px', minWidth: '60px' }}>
              <div style={{ width: `${agePct}%`, height: '100%', background: 'rgb(200,160,72)', borderRadius: '2px' }} />
            </div>
          )}
          {province.age_ends_at && (
            <span className="text-realm-gold" title={formatDateTime(province.age_ends_at)} style={{ fontSize: '11px' }}>
              Ends {formatRelativeDate(province.age_ends_at)}
            </span>
          )}
        </div>
      )}

      {/* Protection Banner */}
      {isProtected && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(37,99,235,0.15), rgba(37,99,235,0.05))',
          border: '1px solid rgba(59,130,246,0.4)',
          borderLeft: '3px solid rgb(59,130,246)',
          borderRadius: '4px',
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '8px',
        }}>
          <div>
            <div style={{ color: 'rgb(147,197,253)', fontWeight: 'bold', fontSize: '13px', marginBottom: '2px' }}>
              🛡️ You are under Protection — expires {formatTime(province.protection_ends_at)}
            </div>
            <div style={{ color: 'rgb(107,137,167)', fontSize: '11px' }}>
              Attacks, spying, offensive spells, and marketplace selling are disabled while protected.
            </div>
          </div>
          {!dropConfirm ? (
            <button
              onClick={() => setDropConfirm(true)}
              className="realm-btn-outline"
              style={{ fontSize: '11px', padding: '4px 12px', borderColor: 'rgba(59,130,246,0.5)', color: 'rgb(147,197,253)' }}
            >
              Drop Early
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ color: 'rgb(248,113,113)', fontSize: '11px' }}>Are you sure?</span>
              <button
                onClick={handleDropProtection}
                disabled={dropLoading}
                className="realm-btn-outline"
                style={{ fontSize: '11px', padding: '4px 10px', borderColor: 'rgba(248,113,113,0.5)', color: 'rgb(248,113,113)' }}
              >
                {dropLoading ? 'Dropping...' : 'Yes, drop shield'}
              </button>
              <button
                onClick={() => setDropConfirm(false)}
                className="realm-btn-outline"
                style={{ fontSize: '11px', padding: '4px 10px' }}
              >
                Cancel
              </button>
            </div>
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

      {/* Stats Grid with sub-labels and status borders */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {statCards.map(({ label, icon, value, color, sub, tip }) => {
          const status = getCardStatus(label, province, rates);
          return (
            <Tooltip key={label} content={tip && (
              <span style={{whiteSpace:'pre-line'}}>{tip}</span>
            )} width={200}>
              <div className="realm-panel" style={{cursor: tip ? 'help' : 'default', borderLeft: `3px solid ${STATUS_COLORS[status]}`}}>
                <div className="text-realm-text-dim text-xs mb-1">{icon} {label}</div>
                <div className={`text-lg font-bold ${color}`}>{value}</div>
                {sub && (
                  <div className="text-realm-text-dim" style={{ fontSize: '10px', marginTop: '3px' }}>{sub}</div>
                )}
              </div>
            </Tooltip>
          );
        })}
      </div>

      {/* Resource Rate Row */}
      {rates && (
        <div style={{
          display: 'flex', gap: '16px', flexWrap: 'wrap',
          padding: '8px 12px',
          background: 'rgba(17,24,40,0.8)',
          border: '1px solid rgb(36,54,80)',
          borderRadius: '4px',
          fontSize: '11px'
        }}>
          <span className="text-realm-text-dim">Income/hr:</span>
          <span><span className="text-yellow-400">+{formatNumber(rates.gold_per_hour)}g</span> <span className="text-realm-text-dim">gold</span></span>
          <span style={{ color: rates.food_per_hour >= 0 ? 'rgb(74,222,128)' : 'rgb(248,113,113)' }}>
            {rates.food_per_hour >= 0 ? '+' : ''}{formatNumber(rates.food_per_hour)} <span className="text-realm-text-dim">food</span>
          </span>
          <span><span className="text-blue-400">+{formatNumber(rates.mana_per_hour)}</span> <span className="text-realm-text-dim">mana</span></span>
          <span><span className="text-gray-300">+{formatNumber(rates.industry_per_hour)}</span> <span className="text-realm-text-dim">industry</span></span>
        </div>
      )}

      {/* Action Points — improved */}
      <div className="realm-panel">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-realm-gold font-display">Action Points</h2>
          <span className="text-realm-gold font-bold">{ap} / {maxAp}</span>
        </div>
        <div
          role="progressbar"
          aria-label="Action Points"
          aria-valuenow={ap}
          aria-valuemin={0}
          aria-valuemax={maxAp}
          className="w-full h-4 bg-realm-surface rounded-full border border-realm-border overflow-hidden"
          style={{ position: 'relative' }}
        >
          <div
            className="h-full transition-all"
            style={{
              width: `${apPct}%`,
              background: 'linear-gradient(to right, rgb(200,100,0), rgb(240,150,20))',
              borderRadius: '9999px',
            }}
          />
          {[5, 10, 15].map(tick => (
            <div key={tick} style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${(tick / maxAp) * 100}%`,
              width: '1px',
              background: 'rgba(255,255,255,0.15)',
              pointerEvents: 'none',
            }} />
          ))}
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-realm-text-dim" style={{ fontSize: '10px' }}>
            Regenerates 1 AP / 30 min (max {maxAp})
          </span>
          {apCountdown && (
            <span className="text-realm-gold font-bold" style={{ fontSize: '11px' }}>
              Next in {apCountdown}
            </span>
          )}
        </div>
      </div>

      {/* Explore Territory — ActionCard pattern */}
      <div className="realm-panel" style={{ borderLeft: '3px solid rgba(200,160,72,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h2 className="text-realm-gold font-display" style={{ fontSize: '14px', margin: 0 }}>
            🗺️ Explore Territory
          </h2>
          <span className="realm-badge" style={{
            background: 'rgba(200,160,72,0.15)',
            color: 'rgb(200,160,72)',
            border: '1px solid rgba(200,160,72,0.4)',
            fontSize: '10px', padding: '1px 6px'
          }}>1 AP</span>
        </div>
        <p className="text-realm-text-muted text-sm" style={{ marginBottom: '10px' }}>
          Send scouts to claim unclaimed land. Gains 5-25 acres.
        </p>
        <button
          onClick={handleExplore}
          disabled={exploreLoading || ap < 1}
          className="realm-btn-gold"
          style={{ width: '100%' }}
        >
          {exploreLoading ? 'Exploring...' : 'Explore'}
        </button>
      </div>

    </div>
  );
}
