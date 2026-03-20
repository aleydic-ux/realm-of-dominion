import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { getApiError } from '../utils/api';
import AuthLayout from '../components/AuthLayout';
import AlertBanner from '../components/AlertBanner';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) navigate('/forgot-password', { replace: true });
  }, [token, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password.length < 8) {
      return setError('Password must be at least 8 characters.');
    }
    if (form.password !== form.confirm) {
      return setError('Passwords do not match.');
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password: form.password });
      navigate('/login', { state: { successMessage: 'Password updated. Please log in.' } });
    } catch (err) {
      setError(getApiError(err, 'This reset link is invalid or has expired.'));
    } finally {
      setLoading(false);
    }
  }

  if (!token) return null;

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} className="realm-panel flex flex-col gap-5" style={{ padding: '2rem' }}>
        <h2 className="text-realm-gold font-display text-center" style={{ fontSize: '1.6rem', letterSpacing: '0.1em' }}>New Password</h2>

        <AlertBanner type="error" message={error} />

        <div>
          <label className="text-realm-text-muted text-sm block mb-1.5">New Password</label>
          <input
            className="realm-input text-base"
            type="password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            required
            autoFocus
            minLength={8}
          />
        </div>

        <div>
          <label className="text-realm-text-muted text-sm block mb-1.5">Confirm New Password</label>
          <input
            className="realm-input text-base"
            type="password"
            value={form.confirm}
            onChange={e => setForm({ ...form, confirm: e.target.value })}
            required
            minLength={8}
          />
        </div>

        <button
          type="submit"
          className="realm-btn-gold w-full mt-1"
          style={{ fontSize: '1rem', padding: '0.65rem' }}
          disabled={loading}
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>

        <p className="text-realm-text-dim text-sm text-center">
          <Link to="/login" className="text-realm-gold hover:underline">Back to Login</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
