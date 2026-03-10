import { formatNumber, formatTime } from '../utils/formatters';
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

  const cell = { padding: '3px 10px', borderRight: '1px solid #1e3050', textAlign: 'center' };
  const lbl = { color: '#485868', fontSize: '0.6rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' };
  const val = { fontSize: '0.78rem', fontWeight: 'bold', color: '#c8d8e8' };

  return (
    <div style={{background:'linear-gradient(to bottom, #111828, #0e1620)', borderBottom:'1px solid #243650', boxShadow:'0 2px 8px rgba(0,0,0,0.5)'}}>
      {/* Province name bar */}
      <div className="province-name-bar" style={{padding:'4px 14px', borderBottom:'1px solid #1e3050', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', flexWrap:'wrap', background:'rgba(255,255,255,0.02)'}}>
        <span style={{fontFamily:'Cinzel, Georgia, serif', color:'#c8a048', fontSize:'0.95rem', fontWeight:'700', letterSpacing:'0.08em'}}>
          {province.name}
        </span>
        <Tooltip content={RACE_TOOLTIPS[province.race]} width={200}>
          <span className={`race-${province.race}`} style={{fontSize:'0.6rem', fontWeight:'bold', border:'1px solid currentColor', padding:'1px 6px', fontFamily:'Verdana, Arial, sans-serif', letterSpacing:'0.06em', cursor:'help'}}>
            {province.race.toUpperCase()}
          </span>
        </Tooltip>
        {province.protection_ends_at && new Date(province.protection_ends_at) > new Date() && (
          <Tooltip content="New player shield — you cannot be attacked until this expires." width={200}>
            <span style={{fontSize:'0.6rem', color:'#3070c0', border:'1px solid #3070c0', padding:'1px 6px', letterSpacing:'0.05em', cursor:'help'}}>
              SHIELD: {formatTime(province.protection_ends_at)}
            </span>
          </Tooltip>
        )}
        {foodStarving && (
          <span style={{fontSize:'0.6rem', color:'#cc2828', border:'1px solid #cc2828', padding:'1px 6px', letterSpacing:'0.05em', animation:'pulse 1s infinite'}}>
            ⚠️ TROOPS STARVING — morale dropping!
          </span>
        )}
      </div>

      {/* Stats row — all resources + AP on one centered line */}
      <div className="resource-stats-row" style={{display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'center'}}>
        <Tooltip content={RESOURCE_TOOLTIPS.gold} width={240}>
          <span style={cell}><span style={lbl}>Gold</span><span style={{...val, color:'#c8a048'}}>{formatNumber(province.gold)}</span></span>
        </Tooltip>

        <Tooltip content={RESOURCE_TOOLTIPS.food} width={240}>
          <span style={cell}>
            <span style={lbl}>
              Food{foodLow && !foodStarving && <span style={{color:'#c8a048', marginLeft:'3px'}}>⚠</span>}
              {foodStarving && <span style={{color:'#cc2828', marginLeft:'3px'}}>⚠</span>}
            </span>
            <span style={{...val, color: foodStarving ? '#cc2828' : foodLow ? '#c8a048' : '#2a8a48'}}>{formatNumber(province.food)}</span>
          </span>
        </Tooltip>

        <Tooltip content={RESOURCE_TOOLTIPS.mana} width={240}>
          <span style={cell}><span style={lbl}>Mana</span><span style={{...val, color:'#8830cc'}}>{formatNumber(province.mana)}</span></span>
        </Tooltip>

        <Tooltip content={RESOURCE_TOOLTIPS.industry} width={240}>
          <span style={cell}><span style={lbl}>Industry</span><span style={val}>{formatNumber(province.industry_points)}</span></span>
        </Tooltip>

        <Tooltip content={RESOURCE_TOOLTIPS.land} width={240}>
          <span style={cell}><span style={lbl}>Land</span><span style={val}>{formatNumber(province.land)} ac</span></span>
        </Tooltip>

        {/* AP — inline with other resources */}
        <Tooltip content={RESOURCE_TOOLTIPS.ap} width={240}>
          <span style={{...cell, borderRight:'none', display:'flex', alignItems:'center', gap:'6px', cursor:'help'}}>
            <span>
              <span style={lbl}>AP{apFull && <span style={{color:'#c8a048', marginLeft:'3px'}}>●</span>}</span>
              <span style={{...val, color: apColor}}>{province.action_points}/{maxAp}</span>
            </span>
            <div
              role="progressbar"
              aria-label="Action Points"
              aria-valuenow={province.action_points}
              aria-valuemin={0}
              aria-valuemax={maxAp}
              style={{width:'50px', height:'6px', border:'1px solid #243650', background:'#0a1020', overflow:'hidden'}}
            >
              <div style={{width:`${apPct}%`, height:'100%', background: apColor, transition:'width 0.3s'}} />
            </div>
          </span>
        </Tooltip>
      </div>

      {/* AP full warning */}
      {apFull && (
        <div style={{background:'rgba(200,160,72,0.08)', borderTop:'1px solid rgba(200,160,72,0.2)', padding:'2px 14px', fontSize:'0.62rem', color:'#c8a048', textAlign:'center'}}>
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
