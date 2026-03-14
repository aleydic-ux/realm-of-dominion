import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

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
        </div>

        <div className="realm-panel flex flex-col gap-5" style={{ padding: '2rem' }}>
          <h2 className="text-realm-gold font-display text-center" style={{ fontSize: '1.6rem', letterSpacing: '0.1em' }}>Reset Password</h2>

          {submitted ? (
            <div className="flex flex-col gap-4 text-center">
              <div className="bg-green-900/30 border border-green-700 text-green-300 px-3 py-3 rounded text-sm">
                If that email exists, a reset link has been sent.
              </div>
              <p className="text-realm-text-muted text-sm">Check your inbox and follow the link to reset your password.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <p className="text-realm-text-muted text-sm">Enter your account email and we'll send you a reset link.</p>

              {error && (
                <div className="bg-red-900/30 border border-red-700 text-red-300 px-3 py-2 rounded text-sm">
                  {error}
                </div>
              )}

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
      </div>
    </div>
  );
}
