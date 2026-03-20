import { formatNumber, formatTime, isProtected } from '../utils/formatters';
import Tooltip from './Tooltip';
import { RESOURCE_TOOLTIPS } from '../help/tooltips.jsx';

export default function ResourceBar({ province }) {
  if (!province) return null;

  const maxAp = 20;
  const apPct = (province.action_points / maxAp) * 100;
  const apColor = apPct > 50 ? '#2a8a48' : apPct > 20 ? '#c8a048' : '#cc2828';
  const apFull = province.action_points >= maxAp;

  const foodLow = province.food > 0 && province.food < 100;
  const foodStarving = province.food <= 0;

  return (
    <div
      className="border-b border-realm-border"
      style={{ background: 'linear-gradient(to bottom, #111828, #0e1620)', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
    >
      {/* Province name bar */}
      <div className="province-name-bar py-1 px-3.5 border-b border-realm-border flex items-center justify-center gap-2.5 flex-wrap" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <span className="font-display text-realm-gold font-bold tracking-wider" style={{ fontSize: '0.95rem' }}>
          {province.name}
          {province.active_title && (
            <span className="font-mono text-realm-text-muted font-normal ml-2 tracking-wide" style={{ fontSize: '0.65rem' }}>
              {province.active_title}
            </span>
          )}
        </span>
        {province.province_motto && (
          <span className="text-realm-text-dim italic tracking-wide" style={{ fontFamily: 'Georgia, serif', fontSize: '0.65rem' }}>
            "{province.province_motto}"
          </span>
        )}
        <Tooltip content={RACE_TOOLTIPS[province.race]} width={200}>
          <span className={`race-${province.race} font-mono font-bold border border-current cursor-help tracking-wider`} style={{ fontSize: '0.6rem', padding: '1px 6px' }}>
            {province.race.toUpperCase()}
          </span>
        </Tooltip>
        {isProtected(province) && (
          <Tooltip content="New player shield — you cannot be attacked until this expires." width={200}>
            <span className="text-realm-blue-light border border-realm-blue-light cursor-help tracking-wide" style={{ fontSize: '0.6rem', padding: '1px 6px' }}>
              SHIELD: {formatTime(province.protection_ends_at)}
            </span>
          </Tooltip>
        )}
        {foodStarving && (
          <span className="text-realm-crimson-light border border-realm-crimson-light tracking-wide" style={{ fontSize: '0.6rem', padding: '1px 6px', animation: 'pulse 1s infinite' }}>
            ⚠️ TROOPS STARVING — morale dropping!
          </span>
        )}
      </div>

      {/* Stats row — all resources + AP on one centered line */}
      <div className="resource-stats-row flex flex-wrap items-center justify-center">
        <Tooltip content={RESOURCE_TOOLTIPS.gold} width={240}>
          <span className="py-0.5 px-2.5 border-r border-realm-border text-center">
            <span className="text-realm-text-dim block uppercase tracking-wider" style={{ fontSize: '0.6rem' }}>Gold</span>
            <span className="text-realm-gold font-bold" style={{ fontSize: '0.78rem' }}>{formatNumber(province.gold)}</span>
          </span>
        </Tooltip>

        <Tooltip content={RESOURCE_TOOLTIPS.food} width={240}>
          <span className="py-0.5 px-2.5 border-r border-realm-border text-center">
            <span className="text-realm-text-dim block uppercase tracking-wider" style={{ fontSize: '0.6rem' }}>
              Food{foodLow && !foodStarving && <span className="text-realm-gold ml-0.5">⚠</span>}
              {foodStarving && <span className="text-realm-crimson-light ml-0.5">⚠</span>}
            </span>
            <span className="font-bold" style={{ fontSize: '0.78rem', color: foodStarving ? '#cc2828' : foodLow ? '#c8a048' : '#2a8a48' }}>{formatNumber(province.food)}</span>
          </span>
        </Tooltip>

        <Tooltip content={RESOURCE_TOOLTIPS.mana} width={240}>
          <span className="py-0.5 px-2.5 border-r border-realm-border text-center">
            <span className="text-realm-text-dim block uppercase tracking-wider" style={{ fontSize: '0.6rem' }}>Mana</span>
            <span className="text-realm-purple-light font-bold" style={{ fontSize: '0.78rem' }}>{formatNumber(province.mana)}</span>
          </span>
        </Tooltip>

        <Tooltip content={RESOURCE_TOOLTIPS.industry} width={240}>
          <span className="py-0.5 px-2.5 border-r border-realm-border text-center">
            <span className="text-realm-text-dim block uppercase tracking-wider" style={{ fontSize: '0.6rem' }}>Industry</span>
            <span className="text-realm-text font-bold" style={{ fontSize: '0.78rem' }}>{formatNumber(province.industry_points)}</span>
          </span>
        </Tooltip>

        <Tooltip content={RESOURCE_TOOLTIPS.land} width={240}>
          <span className="py-0.5 px-2.5 border-r border-realm-border text-center">
            <span className="text-realm-text-dim block uppercase tracking-wider" style={{ fontSize: '0.6rem' }}>Land</span>
            <span className="text-realm-text font-bold" style={{ fontSize: '0.78rem' }}>{formatNumber(province.land)} ac</span>
          </span>
        </Tooltip>

        <Tooltip content="Gems — earned through combat, research, and milestones. Spent on enhancements." width={220}>
          <span className="py-0.5 px-2.5 border-r border-realm-border text-center">
            <span className="text-realm-text-dim block uppercase tracking-wider" style={{ fontSize: '0.6rem' }}>Gems</span>
            <span className="font-bold" style={{ fontSize: '0.78rem', color: '#a78bfa' }}>{formatNumber(province.gems || 0)}💎</span>
          </span>
        </Tooltip>

        {/* AP — inline with other resources */}
        <Tooltip content={RESOURCE_TOOLTIPS.ap} width={240}>
          <span className="py-0.5 px-2.5 text-center flex items-center gap-1.5 cursor-help">
            <span>
              <span className="text-realm-text-dim block uppercase tracking-wider" style={{ fontSize: '0.6rem' }}>AP{apFull && <span className="text-realm-gold ml-0.5">●</span>}</span>
              <span className="font-bold" style={{ fontSize: '0.78rem', color: apColor }}>{province.action_points}/{maxAp}</span>
            </span>
            <div
              role="progressbar"
              aria-label="Action Points"
              aria-valuenow={province.action_points}
              aria-valuemin={0}
              aria-valuemax={maxAp}
              className="border border-realm-border bg-realm-bg overflow-hidden"
              style={{ width: '50px', height: '6px' }}
            >
              <div className="h-full transition-[width] duration-300" style={{ width: `${apPct}%`, background: apColor }} />
            </div>
          </span>
        </Tooltip>
      </div>

      {/* AP full warning */}
      {apFull && (
        <div className="text-realm-gold text-center px-3.5 py-0.5" style={{ background: 'rgba(200,160,72,0.08)', borderTop: '1px solid rgba(200,160,72,0.2)', fontSize: '0.62rem' }}>
          ⚡ AP full — regen paused until you spend some!
        </div>
      )}
    </div>
  );
}

const RACE_TOOLTIPS = {
  human: 'Human — Economy focused. +20% gold income, -10% building costs, +20% trade proceeds. Unique: Royal Bank.',
  orc: 'Orc — Aggression focused. +25% troop attack, +15% training speed. Berserkers double-attack but die defending. Unique: Warchief Pit.',
  undead: 'Undead — Sustainability focused. Troops never consume food, 2× army return speed. Cannot use marketplace. Unique: Crypt.',
  elf: 'Elf — Magic focused. +30% mana regen, +15% land yield, +20% research speed. Unique: Ancient Grove, Archmage units.',
  dwarf: 'Dwarf — Defense focused. -25% building costs, -25% siege damage. Tunnel Rats bypass walls. Unique: Runic Forge.',
};
