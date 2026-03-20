import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api, { getApiError } from '../utils/api';
import AuthLayout from '../components/AuthLayout';
import AlertBanner from '../components/AlertBanner';

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
      setError(getApiError(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout subtitle="Enter your kingdom">
      <form onSubmit={handleSubmit} className="realm-panel flex flex-col gap-5" style={{ padding: '2rem', backdropFilter: 'blur(8px)', background: 'rgba(22, 32, 48, 0.85)' }}>
        <h2 className="text-realm-gold font-display text-center" style={{ fontSize: '1.6rem', letterSpacing: '0.1em', textShadow: '0 0 12px rgba(200,160,72,0.3)' }}>Login</h2>

        <AlertBanner type="success" message={successMessage} />
        <AlertBanner type="error" message={error} />

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
    </AuthLayout>
  );
}
