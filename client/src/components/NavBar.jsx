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
    <nav className="bg-realm-surface border-b-2 border-realm-border px-3 py-0 flex items-center overflow-x-auto" style={{borderBottomColor: '#0f3d0f'}}>
      <span className="font-display text-realm-gold pr-4 whitespace-nowrap text-2xl tracking-widest glow-gold border-r border-realm-border mr-2">
        R.O.D
      </span>
      <div className="flex flex-1">
        {navLinks.map(({ path, label }) => (
          <Link
            key={path}
            to={path}
            className={`px-3 py-2 text-xs whitespace-nowrap uppercase tracking-widest transition-colors border-r border-realm-border ${
              location.pathname === path
                ? 'text-realm-bg bg-realm-text font-bold'
                : 'text-realm-text-muted hover:text-realm-text hover:bg-realm-panel'
            }`}
          >
            {location.pathname === path ? `>${label}<` : label}
          </Link>
        ))}
      </div>
      <button
        onClick={onLogout}
        className="text-red-700 text-xs px-4 py-2 uppercase tracking-widest hover:text-red-400 hover:bg-realm-panel transition-colors whitespace-nowrap border-l border-realm-border"
      >
        [EXIT]
      </button>
    </nav>
  );
}
