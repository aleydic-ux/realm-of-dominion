import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

export default function Login({ onLogin }) {
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
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: "url('/MAIN PAGE BACKGROUND.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(6,14,28,0.55) 0%, rgba(6,14,28,0.85) 100%)' }}
      />
      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-5xl text-realm-gold font-display whitespace-nowrap">Realm of Dominion</h1>
          <p className="text-realm-text-muted mt-2 text-sm">Enter your kingdom</p>
        </div>

        <form onSubmit={handleSubmit} className="realm-panel flex flex-col gap-4">
          <h2 className="text-realm-gold text-xl font-display">Login</h2>

          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="text-realm-text-muted text-xs block mb-1">Username</label>
            <input
              className="realm-input"
              type="text"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="text-realm-text-muted text-xs block mb-1">Password</label>
            <input
              className="realm-input"
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button type="submit" className="realm-btn-gold w-full mt-2" disabled={loading}>
            {loading ? 'Entering...' : 'Enter the Realm'}
          </button>

          <p className="text-realm-text-dim text-xs text-center">
            No kingdom?{' '}
            <Link to="/register" className="text-realm-gold hover:underline">Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
