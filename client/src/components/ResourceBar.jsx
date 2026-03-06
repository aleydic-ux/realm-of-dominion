import { formatNumber, formatTime } from '../utils/formatters';

export default function ResourceBar({ province }) {
  if (!province) return null;

  const maxAp = 20;
  const apPct = (province.action_points / maxAp) * 100;
  const apColor = apPct > 50 ? '#1a4a1a' : apPct > 20 ? '#7a4f00' : '#6b0000';

  const statStyle = { borderRight: '1px solid #c0a882', padding: '4px 16px', display: 'inline-block' };
  const labelStyle = { color: '#8a7050', fontSize: '0.68rem', display: 'block', fontFamily: 'Cinzel, Georgia, serif', letterSpacing: '0.05em' };
  const valueStyle = { color: '#1a0e00', fontSize: '0.9rem', fontWeight: '600' };

  return (
    <div className="sticky top-0 z-10" style={{background:'linear-gradient(to bottom, #fdf8ef, #f0e8d4)', borderBottom:'2px solid #a08050', boxShadow:'0 2px 4px rgba(0,0,0,0.15)'}}>
      {/* Province name */}
      <div className="px-4 py-1.5 flex items-center gap-3 border-b" style={{borderBottomColor:'#c0a882'}}>
        <span style={{fontFamily:'Cinzel, Georgia, serif', color:'#7a4f00', fontSize:'1.1rem', fontWeight:'700', letterSpacing:'0.08em'}}>
          {province.name}
        </span>
        <span className={`race-${province.race} text-xs font-semibold border px-2 py-0.5`} style={{fontFamily:'Cinzel, Georgia, serif', fontSize:'0.65rem', letterSpacing:'0.08em', borderColor:'currentColor'}}>
          {province.race.toUpperCase()}
        </span>
        {province.protection_ends_at && new Date(province.protection_ends_at) > new Date() && (
          <span className="text-xs border px-2 py-0.5" style={{color:'#00008b', borderColor:'#00008b', fontFamily:'Cinzel, Georgia, serif', fontSize:'0.65rem', letterSpacing:'0.05em'}}>
            SHIELD: {formatTime(province.protection_ends_at)}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap items-center text-sm">
        <span style={statStyle}>
          <span style={labelStyle}>Gold</span>
          <span style={{...valueStyle, color:'#7a4f00'}}>{formatNumber(province.gold)}</span>
        </span>
        <span style={statStyle}>
          <span style={labelStyle}>Food</span>
          <span style={{...valueStyle, color: province.food < 0 ? '#6b0000' : '#1a4a1a'}}>{formatNumber(province.food)}</span>
        </span>
        <span style={statStyle}>
          <span style={labelStyle}>Mana</span>
          <span style={{...valueStyle, color:'#3a0060'}}>{formatNumber(province.mana)}</span>
        </span>
        <span style={statStyle}>
          <span style={labelStyle}>Prod</span>
          <span style={valueStyle}>{formatNumber(province.production_points)}</span>
        </span>
        <span style={{...statStyle, borderRight:'none'}}>
          <span style={labelStyle}>Land</span>
          <span style={valueStyle}>{formatNumber(province.land)} ac</span>
        </span>

        {/* AP */}
        <span className="ml-auto flex items-center gap-2 px-4">
          <span style={labelStyle}>Action Points</span>
          <span style={{...valueStyle, color: apColor}}>{province.action_points}/{maxAp}</span>
          <div style={{width:'80px', height:'8px', border:'1px solid #a08050', background:'#e8dfc8', overflow:'hidden', display:'inline-block'}}>
            <div style={{width:`${apPct}%`, height:'100%', background: apColor, transition:'width 0.3s'}} />
          </div>
        </span>
      </div>
    </div>
  );
}
