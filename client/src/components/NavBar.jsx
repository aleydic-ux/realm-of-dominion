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
  { path: '/mail', label: 'Mail' },
];

export default function NavBar({ onLogout, onOpenHelp, unreadCount = 0, mailUnreadCount = 0, onNotificationOpen }) {
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
      <div
        className="border-b border-realm-border py-1.5 px-4 flex items-center justify-between"
        style={{ background: 'linear-gradient(to bottom, #0a1428, #060e1c)' }}
      >
        <span
          className="font-display text-realm-gold text-xl tracking-widest"
          style={{ textShadow: '0 0 16px rgba(200,160,72,0.5), 0 0 40px rgba(200,160,72,0.15), 1px 1px 2px #000' }}
        >
          Realm of Dominion
        </span>
        <div className="flex items-center gap-2">
          {/* Hamburger — visible only on small screens */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
            className="sm-hamburger font-mono hidden text-realm-text-muted text-base border border-realm-border px-2 py-0.5 bg-transparent cursor-pointer"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
          <NotificationBell unreadCount={unreadCount} onOpen={onNotificationOpen} />
          {/* Settings link */}
          <Link
            to="/settings"
            title="Settings"
            className="text-realm-text-muted text-xs border border-realm-border px-2 py-0.5 no-underline inline-block hover:text-realm-gold hover:border-realm-gold transition-colors duration-200"
          >
            ⚙
          </Link>
          {/* How to Play button */}
          <button
            onClick={onOpenHelp}
            title="How to Play (press ?)"
            className="font-mono text-realm-text-muted text-xs border border-realm-border px-2 py-0.5 bg-transparent cursor-pointer font-bold hover:text-realm-gold hover:border-realm-gold transition-colors duration-200"
          >
            ?
          </button>
          <button
            onClick={onLogout}
            className="font-mono text-realm-text-muted border border-realm-border px-2.5 py-0.5 bg-transparent cursor-pointer hover:text-realm-text transition-colors duration-200"
            style={{ fontSize: '0.68rem' }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Nav tabs */}
      <nav
        aria-label="Main navigation"
        className="border-b-2 border-realm-gold"
        style={{ background: 'linear-gradient(to bottom, #162038, #0e1828)' }}
      >
        <div className="nav-desktop flex overflow-x-auto">
          {navLinks.map(({ path, label }) => {
            const badge = label === 'Mail' && mailUnreadCount > 0 ? mailUnreadCount : null;
            return (
              <NavLink
                key={path}
                to={path}
                className="font-mono whitespace-nowrap border-r border-realm-border no-underline inline-flex items-center gap-1 transition-all duration-200 -mb-0.5 tracking-wide"
                style={({ isActive }) => ({
                  fontSize: '0.68rem',
                  fontWeight: isActive ? '600' : '400',
                  padding: '6px 14px',
                  color: isActive ? '#c8a048' : '#8090a8',
                  background: isActive ? 'linear-gradient(to bottom, #1e3050, #162040)' : 'transparent',
                  borderBottom: isActive ? '2px solid #c8a048' : '2px solid transparent',
                  textShadow: isActive ? '0 0 8px rgba(200,160,72,0.3)' : 'none',
                })}
              >
                {label}
                {badge && (
                  <span className="text-white font-bold rounded-full px-1 text-center" style={{ background: '#c83030', fontSize: '0.6rem', lineHeight: '1.4', minWidth: '14px' }}>
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {mobileOpen && (
          <div className="nav-mobile flex flex-col border-t border-realm-border">
            {navLinks.map(({ path, label }) => {
              const badge = label === 'Mail' && mailUnreadCount > 0 ? mailUnreadCount : null;
              return (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setMobileOpen(false)}
                  className="font-mono text-sm no-underline flex items-center justify-between transition-all duration-200 tracking-wide border-b border-realm-border"
                  style={({ isActive }) => ({
                    fontWeight: isActive ? '600' : '400',
                    padding: '10px 16px',
                    color: isActive ? '#c8a048' : '#8090a8',
                    background: isActive ? 'rgba(30,48,80,0.6)' : 'transparent',
                  })}
                >
                  {label}
                  {badge && (
                    <span className="text-white font-bold rounded-full" style={{ background: '#c83030', fontSize: '0.65rem', padding: '1px 6px' }}>
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
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
