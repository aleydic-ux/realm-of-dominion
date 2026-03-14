import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../utils/api';

export default function Login({ onLogin }) {
  const location = useLocation();
  const successMessage = location.state?.successMessage || '';
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      onLogin(data.token, data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: "url('/MAIN PAGE BACKGROUND.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(6,14,28,0.50) 0%, rgba(6,14,28,0.88) 100%)' }}
      />
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <h1 className="text-realm-gold font-display" style={{ fontSize: '3.2rem', letterSpacing: '0.12em', textShadow: '2px 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(200,160,72,0.4)' }}>
            Realm of Dominion
          </h1>
          <p className="text-realm-text-muted mt-3 text-base tracking-widest uppercase" style={{ letterSpacing: '0.25em', fontSize: '0.8rem' }}>Enter your kingdom</p>
        </div>

        <form onSubmit={handleSubmit} className="realm-panel flex flex-col gap-5" style={{ padding: '2rem' }}>
          <h2 className="text-realm-gold font-display text-center" style={{ fontSize: '1.6rem', letterSpacing: '0.1em' }}>Login</h2>

          {successMessage && (
            <div className="bg-green-900/30 border border-green-700 text-green-300 px-3 py-2 rounded text-sm">
              {successMessage}
            </div>
          )}
          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="text-realm-text-muted text-sm block mb-1.5">Username</label>
            <input
              className="realm-input text-base"
              type="text"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="text-realm-text-muted text-sm block mb-1.5">Password</label>
            <input
              className="realm-input text-base"
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button type="submit" className="realm-btn-gold w-full mt-1" style={{ fontSize: '1rem', padding: '0.65rem' }} disabled={loading}>
            {loading ? 'Entering...' : 'Enter the Realm'}
          </button>

          <p className="text-realm-text-dim text-sm text-center">
            No kingdom?{' '}
            <Link to="/register" className="text-realm-gold hover:underline">Register</Link>
          </p>
          <p className="text-realm-text-dim text-sm text-center">
            <Link to="/forgot-password" className="text-realm-text-muted hover:text-realm-gold hover:underline">Forgot password?</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
