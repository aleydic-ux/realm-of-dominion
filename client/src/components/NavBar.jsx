import { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import NotificationBell from './NotificationBell';

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
  { path: '/spells', label: 'Spells' },
  { path: '/crafting', label: 'Alchemy' },
  { path: '/gems', label: 'Gems' },
  { path: '/leaderboard', label: 'Ranks' },
  { path: '/world', label: 'World' },
  { path: '/achievements', label: 'Feats' },
];

export default function NavBar({ onLogout, onOpenHelp, unreadCount = 0, onNotificationOpen }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Global keyboard shortcut: '?' opens help (when not in a text input)
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        onOpenHelp?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpenHelp]);

  return (
    <div>
      {/* Title bar */}
      <div style={{background:'linear-gradient(to bottom, #0a1428, #060e1c)', borderBottom:'1px solid #1e3050', padding:'6px 16px', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <span style={{fontFamily:'Cinzel, Georgia, serif', color:'#c8a048', fontSize:'1.25rem', letterSpacing:'0.12em', textShadow:'0 0 12px rgba(200,160,72,0.4), 1px 1px 2px #000'}}>
          Realm of Dominion
        </span>
        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
          {/* Hamburger — visible only on small screens */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
            style={{display:'none', fontFamily:'Verdana, Arial, sans-serif', color:'#8090a8', fontSize:'1rem', border:'1px solid #243650', padding:'2px 8px', background:'transparent', cursor:'pointer'}}
            className="sm-hamburger"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
          <NotificationBell unreadCount={unreadCount} onOpen={onNotificationOpen} />
          {/* Settings link */}
          <Link
            to="/settings"
            title="Settings"
            style={{ color: '#8090a8', fontSize: '0.75rem', border: '1px solid #243650', padding: '2px 8px', textDecoration: 'none', display: 'inline-block' }}
            onMouseOver={e => { e.currentTarget.style.color = '#c8a048'; e.currentTarget.style.borderColor = '#c8a048'; }}
            onMouseOut={e => { e.currentTarget.style.color = '#8090a8'; e.currentTarget.style.borderColor = '#243650'; }}
          >
            ⚙
          </Link>
          {/* How to Play button */}
          <button
            onClick={onOpenHelp}
            title="How to Play (press ?)"
            style={{fontFamily:'Verdana, Arial, sans-serif', color:'#8090a8', fontSize:'0.75rem', border:'1px solid #243650', padding:'2px 8px', background:'transparent', cursor:'pointer', fontWeight:'bold'}}
            onMouseOver={e => { e.target.style.color='#c8a048'; e.target.style.borderColor='#c8a048'; }}
            onMouseOut={e => { e.target.style.color='#8090a8'; e.target.style.borderColor='#243650'; }}
          >
            ?
          </button>
          <button
            onClick={onLogout}
            style={{fontFamily:'Verdana, Arial, sans-serif', color:'#8090a8', fontSize:'0.68rem', border:'1px solid #243650', padding:'2px 10px', background:'transparent', cursor:'pointer'}}
            onMouseOver={e => e.target.style.color='#c8d8e8'}
            onMouseOut={e => e.target.style.color='#8090a8'}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Nav tabs */}
      <nav
        aria-label="Main navigation"
        style={{background:'linear-gradient(to bottom, #162038, #0e1828)', borderBottom:'2px solid #c8a048'}}
      >
        <div className="nav-desktop" style={{display:'flex', overflowX:'auto'}}>
          {navLinks.map(({ path, label }) => (
            <NavLink
              key={path}
              to={path}
              style={({ isActive }) => ({
                fontFamily: 'Verdana, Arial, sans-serif',
                fontSize: '0.68rem',
                fontWeight: isActive ? 'bold' : 'normal',
                padding: '6px 14px',
                whiteSpace: 'nowrap',
                borderRight: '1px solid #1e3050',
                color: isActive ? '#c8a048' : '#8090a8',
                background: isActive ? 'linear-gradient(to bottom, #1e3050, #162040)' : 'transparent',
                borderBottom: isActive ? '2px solid #c8a048' : '2px solid transparent',
                textDecoration: 'none',
                display: 'inline-block',
                transition: 'all 0.1s',
                marginBottom: '-2px',
              })}
            >
              {label}
            </NavLink>
          ))}
        </div>

        {mobileOpen && (
          <div className="nav-mobile" style={{display:'flex', flexDirection:'column', borderTop:'1px solid #1e3050'}}>
            {navLinks.map(({ path, label }) => (
              <NavLink
                key={path}
                to={path}
                onClick={() => setMobileOpen(false)}
                style={({ isActive }) => ({
                  fontFamily: 'Verdana, Arial, sans-serif',
                  fontSize: '0.8rem',
                  fontWeight: isActive ? 'bold' : 'normal',
                  padding: '10px 16px',
                  borderBottom: '1px solid #1e3050',
                  color: isActive ? '#c8a048' : '#8090a8',
                  background: isActive ? 'rgba(30,48,80,0.6)' : 'transparent',
                  textDecoration: 'none',
                })}
              >
                {label}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      <style>{`
        @media (max-width: 639px) {
          .sm-hamburger { display: block !important; }
          .nav-desktop { display: none !important; }
        }
        @media (min-width: 640px) {
          .nav-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}
