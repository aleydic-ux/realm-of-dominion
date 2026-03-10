import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import NavBar from './components/NavBar';
import ResourceBar from './components/ResourceBar';
import { useProvince } from './hooks/useProvince';
import HowToPlay from './help/HowToPlay';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Military = lazy(() => import('./pages/Military'));
const Buildings = lazy(() => import('./pages/Buildings'));
const Research = lazy(() => import('./pages/Research'));
const Kingdom = lazy(() => import('./pages/Kingdom'));
const Attack = lazy(() => import('./pages/Attack'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const Alliance = lazy(() => import('./pages/Alliance'));
const Reports = lazy(() => import('./pages/Reports'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const WorldFeed = lazy(() => import('./pages/WorldFeed'));
const Spells = lazy(() => import('./pages/Spells'));
const Crafting = lazy(() => import('./pages/Crafting'));
const Gems = lazy(() => import('./pages/Gems'));

function ProtectedLayout({ onLogout }) {
  const { province, buildings, troops, research, alliance, loading, error, slowLoad, refresh } = useProvince();
  const [seasonBanner, setSeasonBanner] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);

  // Auto-show How to Play on first login
  useEffect(() => {
    const seen = localStorage.getItem('rod_tutorial_seen');
    if (!seen) {
      setHelpOpen(true);
      localStorage.setItem('rod_tutorial_seen', 'true');
    }
  }, []);

  // Listen for season_end on the shared socket from useProvince
  useEffect(() => {
    const handler = (e) => {
      const { old_season, new_season } = e.detail;
      setSeasonBanner({ old_season, new_season });
      setTimeout(() => window.location.reload(), 5000);
    };
    window.addEventListener('season_end', handler);
    return () => window.removeEventListener('season_end', handler);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:bg-realm-gold focus:text-black focus:rounded font-bold"
      >
        Skip to main content
      </a>
      {seasonBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-realm-panel border border-realm-gold rounded-lg p-8 max-w-md text-center space-y-4">
            <div className="text-4xl">⚔</div>
            <h2 className="text-2xl font-display text-realm-gold">Season Over!</h2>
            <p className="text-realm-text">The <span className="text-realm-gold font-bold">{seasonBanner.old_season}</span> has ended.</p>
            <p className="text-realm-text">A new era begins — <span className="text-realm-gold font-bold">{seasonBanner.new_season}</span>.</p>
            <p className="text-realm-text-muted text-sm">All kingdoms have been reset. Reloading in 5 seconds...</p>
          </div>
        </div>
      )}
      <HowToPlay isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      <div className="sticky top-0 z-20">
        <NavBar onLogout={onLogout} onOpenHelp={() => setHelpOpen(true)} />
        <ResourceBar province={province} />
      </div>
      <main id="main-content" className="flex-1 p-4 max-w-7xl mx-auto w-full">
        {slowLoad && !province && !error && (
          <div style={{textAlign:'center', padding:'40px 16px', color:'#8090a8'}}>
            <div style={{fontSize:'1.5rem', marginBottom:'12px'}}>⚔</div>
            <p style={{fontSize:'0.85rem', marginBottom:'6px'}}>Server is warming up...</p>
            <p style={{fontSize:'0.72rem', color:'#485868'}}>This takes up to 60 seconds on first load. Please wait.</p>
          </div>
        )}
        {error && !province && (
          <div style={{textAlign:'center', padding:'40px 16px', color:'#8090a8'}}>
            <p style={{fontSize:'0.85rem', marginBottom:'12px'}}>{error}</p>
            <button onClick={refresh} style={{fontFamily:'Verdana, Arial, sans-serif', fontSize:'0.75rem', color:'#c8a048', border:'1px solid #c8a048', padding:'6px 18px', background:'transparent', cursor:'pointer', marginRight:'8px'}}>Retry</button>
            <button onClick={onLogout} style={{fontFamily:'Verdana, Arial, sans-serif', fontSize:'0.75rem', color:'#8090a8', border:'1px solid #243650', padding:'6px 18px', background:'transparent', cursor:'pointer'}}>Logout & Re-login</button>
          </div>
        )}
        <Suspense fallback={<div className="text-realm-text-muted">Loading...</div>}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard province={province} loading={loading} refresh={refresh} />} />
            <Route path="/military" element={<Military province={province} troops={troops} refresh={refresh} />} />
            <Route path="/buildings" element={<Buildings province={province} buildings={buildings} refresh={refresh} />} />
            <Route path="/research" element={<Research province={province} research={research} refresh={refresh} />} />
            <Route path="/kingdom" element={<Kingdom province={province} />} />
            <Route path="/attack" element={<Attack province={province} troops={troops} refresh={refresh} />} />
            <Route path="/marketplace" element={<Marketplace province={province} refresh={refresh} />} />
            <Route path="/alliance" element={<Alliance province={province} alliance={alliance} />} />
            <Route path="/reports" element={<Reports province={province} />} />
            <Route path="/leaderboard" element={<Leaderboard province={province} />} />
            <Route path="/spells" element={<Spells province={province} buildings={buildings} />} />
            <Route path="/crafting" element={<Crafting province={province} buildings={buildings} refresh={refresh} />} />
            <Route path="/gems" element={<Gems province={province} />} />
            <Route path="/world" element={<WorldFeed province={province} />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('token'));

  const handleLogin = useCallback((token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setAuthed(true);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('rod_tutorial_seen');
    setAuthed(false);
  }, []);

  if (!authed) {
    return (
      <Suspense fallback={<div className="text-realm-text-muted">Loading...</div>}>
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/register" element={<Register onLogin={handleLogin} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return <ProtectedLayout onLogout={handleLogout} />;
}
