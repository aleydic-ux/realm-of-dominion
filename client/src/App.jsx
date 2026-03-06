import { useState, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import NavBar from './components/NavBar';
import ResourceBar from './components/ResourceBar';
import { useProvince } from './hooks/useProvince';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Military from './pages/Military';
import Buildings from './pages/Buildings';
import Research from './pages/Research';
import Kingdom from './pages/Kingdom';
import Attack from './pages/Attack';
import Marketplace from './pages/Marketplace';
import Alliance from './pages/Alliance';
import Reports from './pages/Reports';
import Leaderboard from './pages/Leaderboard';
import WorldFeed from './pages/WorldFeed';

function ProtectedLayout({ onLogout }) {
  const { province, buildings, troops, research, alliance, loading, refresh } = useProvince();

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar onLogout={onLogout} />
      <ResourceBar province={province} />
      <main className="flex-1 p-4 max-w-7xl mx-auto w-full">
        <Routes>
          <Route path="/dashboard" element={<Dashboard province={province} loading={loading} refresh={refresh} />} />
          <Route path="/military" element={<Military province={province} troops={troops} refresh={refresh} />} />
          <Route path="/buildings" element={<Buildings province={province} buildings={buildings} refresh={refresh} />} />
          <Route path="/research" element={<Research province={province} research={research} refresh={refresh} />} />
          <Route path="/kingdom" element={<Kingdom />} />
          <Route path="/attack" element={<Attack province={province} troops={troops} refresh={refresh} />} />
          <Route path="/marketplace" element={<Marketplace province={province} refresh={refresh} />} />
          <Route path="/alliance" element={<Alliance province={province} alliance={alliance} />} />
          <Route path="/reports" element={<Reports province={province} />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/world" element={<WorldFeed province={province} />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
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
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/register" element={<Register onLogin={handleLogin} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return <ProtectedLayout onLogout={handleLogout} />;
}
