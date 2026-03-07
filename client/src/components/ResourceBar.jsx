import { formatNumber, formatTime } from '../utils/formatters';

export default function ResourceBar({ province }) {
  if (!province) return null;

  const maxAp = 20;
  const apPct = (province.action_points / maxAp) * 100;
  const apColor = apPct > 50 ? '#2a8a48' : apPct > 20 ? '#c8a048' : '#cc2828';

  const cell = { padding: '3px 14px', borderRight: '1px solid #1e3050' };
  const lbl = { color: '#485868', fontSize: '0.6rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' };
  const val = { fontSize: '0.78rem', fontWeight: 'bold', color: '#c8d8e8' };

  return (
    <div className="sticky top-0 z-10" style={{background:'linear-gradient(to bottom, #111828, #0e1620)', borderBottom:'1px solid #243650', boxShadow:'0 2px 8px rgba(0,0,0,0.5)'}}>
      {/* Province name bar */}
      <div style={{padding:'4px 14px', borderBottom:'1px solid #1e3050', display:'flex', alignItems:'center', gap:'10px', background:'rgba(255,255,255,0.02)'}}>
        <span style={{fontFamily:'Cinzel, Georgia, serif', color:'#c8a048', fontSize:'0.95rem', fontWeight:'700', letterSpacing:'0.08em'}}>
          {province.name}
        </span>
        <span className={`race-${province.race}`} style={{fontSize:'0.6rem', fontWeight:'bold', border:'1px solid currentColor', padding:'1px 6px', fontFamily:'Verdana, Arial, sans-serif', letterSpacing:'0.06em'}}>
          {province.race.toUpperCase()}
        </span>
        {province.protection_ends_at && new Date(province.protection_ends_at) > new Date() && (
          <span style={{fontSize:'0.6rem', color:'#3070c0', border:'1px solid #3070c0', padding:'1px 6px', letterSpacing:'0.05em'}}>
            SHIELD: {formatTime(province.protection_ends_at)}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div style={{display:'flex', flexWrap:'wrap', alignItems:'stretch'}}>
        <span style={cell} title={Math.floor(province.gold).toLocaleString() + ' gold'}><span style={lbl}>Gold</span><span style={{...val, color:'#c8a048'}}>{formatNumber(province.gold)}</span></span>
        <span style={cell} title={Math.floor(province.food).toLocaleString() + ' food'}><span style={lbl}>Food</span><span style={{...val, color: province.food < 0 ? '#cc2828' : '#2a8a48'}}>{formatNumber(province.food)}</span></span>
        <span style={cell} title={Math.floor(province.mana).toLocaleString() + ' mana'}><span style={lbl}>Mana</span><span style={{...val, color:'#8830cc'}}>{formatNumber(province.mana)}</span></span>
        <span style={cell} title={Math.floor(province.production_points).toLocaleString() + ' industry'}><span style={lbl}>Industry</span><span style={val}>{formatNumber(province.production_points)}</span></span>
        <span style={{...cell, borderRight:'none'}} title={Math.floor(province.land).toLocaleString() + ' acres'}><span style={lbl}>Land</span><span style={val}>{formatNumber(province.land)} ac</span></span>

        {/* AP */}
        <span style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:'6px', padding:'4px 14px'}}>
          <span style={lbl}>AP</span>
          <span style={{...val, color: apColor}}>{province.action_points}/{maxAp}</span>
          <div
            role="progressbar"
            aria-label="Action Points"
            aria-valuenow={province.action_points}
            aria-valuemin={0}
            aria-valuemax={maxAp}
            style={{width:'70px', height:'6px', border:'1px solid #243650', background:'#0a1020', overflow:'hidden'}}
          >
            <div style={{width:`${apPct}%`, height:'100%', background: apColor, transition:'width 0.3s'}} />
          </div>
        </span>
      </div>
    </div>
  );
}
