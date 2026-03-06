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
];

export default function NavBar({ onLogout }) {
  const location = useLocation();

  return (
    <div>
      {/* Title bar */}
      <div className="px-4 py-2 flex items-center justify-between" style={{background:'linear-gradient(to bottom, #2c1a0a, #1a0e04)', borderBottom:'2px solid #a08050'}}>
        <span style={{fontFamily:'Cinzel, Georgia, serif', color:'#c8960c', fontSize:'1.4rem', letterSpacing:'0.15em', textShadow:'1px 1px 2px #000, 0 0 8px rgba(200,150,12,0.4)'}}>
          ⚔ Realm of Dominion ⚔
        </span>
        <button
          onClick={onLogout}
          style={{fontFamily:'Cinzel, Georgia, serif', color:'#c8960c', fontSize:'0.75rem', letterSpacing:'0.08em', border:'1px solid #7a4f00', padding:'2px 12px', background:'transparent'}}
          className="hover:bg-realm-gold-dark hover:text-realm-panel transition-colors"
        >
          Logout
        </button>
      </div>

      {/* Nav tabs */}
      <nav className="flex overflow-x-auto" style={{background:'linear-gradient(to bottom, #4a3010, #2c1a08)', borderBottom:'3px solid #a08050'}}>
        {navLinks.map(({ path, label }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              style={{
                fontFamily: 'Cinzel, Georgia, serif',
                fontSize: '0.72rem',
                letterSpacing: '0.06em',
                padding: '7px 14px',
                whiteSpace: 'nowrap',
                borderRight: '1px solid #7a4f00',
                transition: 'background 0.1s',
                background: active ? 'linear-gradient(to bottom, #c8960c, #7a4f00)' : 'transparent',
                color: active ? '#fdf8ef' : '#c8960c',
                textShadow: active ? '1px 1px 0 rgba(0,0,0,0.5)' : 'none',
                fontWeight: active ? '700' : '400',
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
