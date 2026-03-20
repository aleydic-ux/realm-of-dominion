import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import AuthLayout from '../components/AuthLayout';
import AlertBanner from '../components/AlertBanner';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="realm-panel flex flex-col gap-5" style={{ padding: '2rem' }}>
        <h2 className="text-realm-gold font-display text-center" style={{ fontSize: '1.6rem', letterSpacing: '0.1em' }}>Reset Password</h2>

        {submitted ? (
          <div className="flex flex-col gap-4 text-center">
            <AlertBanner type="success" message="If that email exists, a reset link has been sent." />
            <p className="text-realm-text-muted text-sm">Check your inbox and follow the link to reset your password.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <p className="text-realm-text-muted text-sm">Enter your account email and we'll send you a reset link.</p>

            <AlertBanner type="error" message={error} />

            <div>
              <label className="text-realm-text-muted text-sm block mb-1.5">Email Address</label>
              <input
                className="realm-input text-base"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="realm-btn-gold w-full mt-1"
              style={{ fontSize: '1rem', padding: '0.65rem' }}
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <p className="text-realm-text-dim text-sm text-center">
          <Link to="/login" className="text-realm-gold hover:underline">Back to Login</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
