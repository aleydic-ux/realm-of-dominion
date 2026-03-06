import { formatNumber, formatTime } from '../utils/formatters';

export default function ResourceBar({ province }) {
  if (!province) return null;

  const maxAp = 20;
  const apPct = (province.action_points / maxAp) * 100;

  return (
    <div className="bg-realm-panel border-b border-realm-border px-4 py-2 flex flex-wrap items-center gap-4 text-sm sticky top-0 z-10">
      <span className="text-realm-gold font-display text-base font-bold truncate max-w-xs">
        {province.name}
        <span className={`ml-2 text-xs race-${province.race}`}>[{province.race}]</span>
      </span>

      <div className="flex items-center gap-1">
        <span className="text-yellow-400">🪙</span>
        <span className="text-realm-gold">{formatNumber(province.gold)}</span>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-green-400">🌾</span>
        <span className={province.food < 0 ? 'text-red-400' : 'text-green-300'}>{formatNumber(province.food)}</span>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-blue-400">💠</span>
        <span className="text-blue-300">{formatNumber(province.mana)}</span>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-gray-400">⚙️</span>
        <span className="text-gray-300">{formatNumber(province.production_points)}</span>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-amber-400">🏔️</span>
        <span className="text-realm-text-muted">{formatNumber(province.land)} ac</span>
      </div>

      {/* AP Bar */}
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-realm-text-dim text-xs">AP</span>
        <div className="w-24 h-3 bg-realm-surface rounded-full border border-realm-border overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${apPct}%`,
              background: apPct > 50 ? '#c9a227' : apPct > 20 ? '#e87c00' : '#8b1a1a',
            }}
          />
        </div>
        <span className="text-realm-gold text-xs whitespace-nowrap">
          {province.action_points}/{maxAp}
        </span>
      </div>

      {province.protection_ends_at && new Date(province.protection_ends_at) > new Date() && (
        <div className="text-blue-300 text-xs flex items-center gap-1">
          🛡️ Shield: {formatTime(province.protection_ends_at)}
        </div>
      )}
    </div>
  );
}
