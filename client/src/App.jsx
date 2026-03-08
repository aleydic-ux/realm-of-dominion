import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import NavBar from './components/NavBar';
import ResourceBar from './components/ResourceBar';
import { useProvince } from './hooks/useProvince';

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

function ProtectedLayout({ onLogout }) {
  const { province, buildings, troops, research, alliance, loading, refresh } = useProvince();
  const [seasonBanner, setSeasonBanner] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const socket = io('/', { auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('season_end', ({ old_season, new_season }) => {
      setSeasonBanner({ old_season, new_season });
      setTimeout(() => window.location.reload(), 5000);
    });
    return () => socket.disconnect();
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
      <NavBar onLogout={onLogout} />
      <ResourceBar province={province} />
      <main id="main-content" className="flex-1 p-4 max-w-7xl mx-auto w-full">
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
