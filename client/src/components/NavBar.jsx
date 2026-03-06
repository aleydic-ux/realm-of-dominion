import { Link, useLocation } from 'react-router-dom';

const navLinks = [
  { path: '/dashboard', label: 'Province' },
  { path: '/military', label: 'Military' },
  { path: '/buildings', label: 'Buildings' },
  { path: '/research', label: 'Research' },
  { path: '/kingdom', label: 'Kingdom' },
  { path: '/attack', label: 'Attack' },
  { path: '/marketplace', label: 'Market' },
  { path: '/alliance', label: 'Alliance' },
  { path: '/reports', label: 'Reports' },
  { path: '/leaderboard', label: 'Ranks' },
  { path: '/world', label: 'World' },
];

export default function NavBar({ onLogout }) {
  const location = useLocation();

  return (
    <div>
      {/* Title bar */}
      <div style={{background:'linear-gradient(to bottom, #0a1428, #060e1c)', borderBottom:'1px solid #1e3050', padding:'6px 16px', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <span style={{fontFamily:'Cinzel, Georgia, serif', color:'#c8a048', fontSize:'1.25rem', letterSpacing:'0.12em', textShadow:'0 0 12px rgba(200,160,72,0.4), 1px 1px 2px #000'}}>
          ⚔ Realm of Dominion ⚔
        </span>
        <button
          onClick={onLogout}
          style={{fontFamily:'Verdana, Arial, sans-serif', color:'#8090a8', fontSize:'0.68rem', border:'1px solid #243650', padding:'2px 10px', background:'transparent', cursor:'pointer'}}
          onMouseOver={e => e.target.style.color='#c8d8e8'}
          onMouseOut={e => e.target.style.color='#8090a8'}
        >
          Logout
        </button>
      </div>

      {/* Nav tabs */}
      <nav style={{background:'linear-gradient(to bottom, #162038, #0e1828)', borderBottom:'2px solid #c8a048', display:'flex', overflowX:'auto'}}>
        {navLinks.map(({ path, label }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              style={{
                fontFamily: 'Verdana, Arial, sans-serif',
                fontSize: '0.68rem',
                fontWeight: active ? 'bold' : 'normal',
                padding: '6px 14px',
                whiteSpace: 'nowrap',
                borderRight: '1px solid #1e3050',
                color: active ? '#c8a048' : '#8090a8',
                background: active ? 'linear-gradient(to bottom, #1e3050, #162040)' : 'transparent',
                borderBottom: active ? '2px solid #c8a048' : '2px solid transparent',
                textDecoration: 'none',
                display: 'inline-block',
                transition: 'all 0.1s',
                marginBottom: '-2px',
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
