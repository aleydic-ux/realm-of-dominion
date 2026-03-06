import { formatNumber, formatTime } from '../utils/formatters';

export default function ResourceBar({ province }) {
  if (!province) return null;

  const maxAp = 20;
  const apPct = (province.action_points / maxAp) * 100;
  const apColor = apPct > 50 ? '#33ff66' : apPct > 20 ? '#ffc107' : '#cc2200';

  return (
    <div className="bg-realm-surface border-b-2 border-realm-border sticky top-0 z-10" style={{borderBottomColor:'#0f3d0f'}}>
      {/* Province name bar */}
      <div className="px-4 py-1 border-b border-realm-border flex items-center gap-3" style={{borderBottomColor:'#0f3d0f', background:'rgba(0,255,66,0.03)'}}>
        <span className="font-display text-realm-gold text-xl tracking-widest glow-gold uppercase">
          {province.name}
        </span>
        <span className={`text-xs uppercase tracking-widest race-${province.race} border border-current px-2 py-0.5`}>
          {province.race}
        </span>
        {province.protection_ends_at && new Date(province.protection_ends_at) > new Date() && (
          <span className="text-xs text-realm-blue-light uppercase tracking-wider border border-blue-700 px-2 py-0.5 text-blue-400">
            SHIELD: {formatTime(province.protection_ends_at)}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="px-4 py-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs uppercase tracking-wider">
        <span>
          <span className="text-realm-text-dim">GOLD: </span>
          <span className="text-realm-gold glow-gold">{formatNumber(province.gold)}</span>
        </span>
        <span>
          <span className="text-realm-text-dim">FOOD: </span>
          <span className={province.food < 0 ? 'text-red-400' : 'text-realm-text'}>{formatNumber(province.food)}</span>
        </span>
        <span>
          <span className="text-realm-text-dim">MANA: </span>
          <span className="text-realm-purple-light" style={{color:'#aa44ff'}}>{formatNumber(province.mana)}</span>
        </span>
        <span>
          <span className="text-realm-text-dim">PROD: </span>
          <span className="text-realm-text-muted">{formatNumber(province.production_points)}</span>
        </span>
        <span>
          <span className="text-realm-text-dim">LAND: </span>
          <span className="text-realm-text-muted">{formatNumber(province.land)} AC</span>
        </span>

        {/* AP */}
        <span className="ml-auto flex items-center gap-2">
          <span className="text-realm-text-dim">AP:</span>
          <span style={{color: apColor}} className="font-bold">{province.action_points}</span>
          <span className="text-realm-text-dim">/</span>
          <span className="text-realm-text-dim">{maxAp}</span>
          <div className="w-20 h-2 bg-realm-surface border border-realm-border overflow-hidden">
            <div className="h-full transition-all" style={{ width: `${apPct}%`, background: apColor }} />
          </div>
        </span>
      </div>
    </div>
  );
}
