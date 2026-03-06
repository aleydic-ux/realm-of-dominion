import { Link, useLocation } from 'react-router-dom';

const navLinks = [
  { path: '/dashboard', label: 'Province', icon: '🏰' },
  { path: '/military', label: 'Military', icon: '⚔️' },
  { path: '/buildings', label: 'Buildings', icon: '🏗️' },
  { path: '/research', label: 'Research', icon: '📜' },
  { path: '/kingdom', label: 'Kingdom', icon: '🌍' },
  { path: '/attack', label: 'Attack', icon: '💥' },
  { path: '/marketplace', label: 'Market', icon: '🏪' },
  { path: '/alliance', label: 'Alliance', icon: '⚜️' },
  { path: '/reports', label: 'Reports', icon: '📋' },
  { path: '/leaderboard', label: 'Ranks', icon: '🏆' },
];

export default function NavBar({ onLogout }) {
  const location = useLocation();

  return (
    <nav className="bg-realm-surface border-b border-realm-border px-2 py-1 flex items-center gap-1 overflow-x-auto">
      <span className="text-realm-gold font-display text-lg font-bold px-2 whitespace-nowrap">⚔️ RoD</span>
      <div className="flex gap-1 flex-1">
        {navLinks.map(({ path, label, icon }) => (
          <Link
            key={path}
            to={path}
            className={`px-3 py-1.5 rounded text-xs whitespace-nowrap transition-colors ${
              location.pathname === path
                ? 'bg-realm-gold-dark text-realm-gold border border-realm-gold'
                : 'text-realm-text-muted hover:text-realm-gold hover:bg-realm-panel'
            }`}
          >
            <span className="mr-1">{icon}</span>{label}
          </Link>
        ))}
      </div>
      <button onClick={onLogout} className="text-realm-text-dim text-xs px-3 py-1.5 hover:text-red-400 transition-colors">
        Exit
      </button>
    </nav>
  );
}
