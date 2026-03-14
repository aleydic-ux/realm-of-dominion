import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';

function Section({ title, children, danger }) {
  return (
    <div
      style={{
        background: danger ? 'rgba(127,29,29,0.15)' : '#0e1828',
        border: `1px solid ${danger ? '#991b1b' : '#1e3050'}`,
        borderRadius: '6px',
        padding: '1.5rem',
      }}
    >
      <h3
        style={{
          fontFamily: 'Cinzel, Georgia, serif',
          color: danger ? '#f87171' : '#c8a048',
          fontSize: '1rem',
          letterSpacing: '0.08em',
          marginBottom: '1rem',
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function StatusMsg({ success, error }) {
  if (success) return <p style={{ color: '#4ade80', fontSize: '0.85rem', marginTop: '8px' }}>{success}</p>;
  if (error) return <p style={{ color: '#f87171', fontSize: '0.85rem', marginTop: '8px' }}>{error}</p>;
  return null;
}

// ─── Change Display Name ───────────────────────────────────────────────────
function DisplayNameSection({ user }) {
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({});
    setLoading(true);
    try {
      await api.patch('/user/profile', { displayName });
      setStatus({ success: 'Display name updated.' });
    } catch (err) {
      setStatus({ error: err.response?.data?.error || 'Failed to update display name.' });
    } finally {
      setLoading(false);
    }
  }

  const lastChanged = user?.display_name_changed_at
    ? new Date(user.display_name_changed_at).toLocaleDateString()
    : null;

  return (
    <Section title="Change Display Name">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {user?.display_name && (
          <p style={{ color: '#8090a8', fontSize: '0.8rem' }}>
            Current: <span style={{ color: '#c8d8e8' }}>{user.display_name}</span>
            {lastChanged && <> &mdash; last changed {lastChanged}</>}
          </p>
        )}
        <div>
          <label style={{ color: '#8090a8', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>New Display Name</label>
          <input
            className="realm-input"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            minLength={3}
            maxLength={20}
            required
          />
          <p style={{ color: '#485868', fontSize: '0.75rem', marginTop: '4px' }}>
            3–20 characters, letters/numbers/spaces. Can be changed once every 30 days.
          </p>
        </div>
        <button className="realm-btn-gold" style={{ alignSelf: 'flex-start', padding: '6px 18px' }} disabled={loading}>
          {loading ? 'Saving...' : 'Save Name'}
        </button>
        <StatusMsg {...status} />
      </form>
    </Section>
  );
}

// ─── Change Email ──────────────────────────────────────────────────────────
function ChangeEmailSection({ user }) {
  const [newEmail, setNewEmail] = useState('');
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({});
    setLoading(true);
    try {
      await api.post('/user/change-email', { newEmail });
      setStatus({ success: `A verification link has been sent to ${newEmail}. Your email will update once you click the link.` });
      setNewEmail('');
    } catch (err) {
      setStatus({ error: err.response?.data?.error || 'Failed to send verification email.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section title="Change Email">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p style={{ color: '#8090a8', fontSize: '0.8rem' }}>
          Current: <span style={{ color: '#c8d8e8' }}>{user?.email}</span>
        </p>
        <div>
          <label style={{ color: '#8090a8', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>New Email Address</label>
          <input
            className="realm-input"
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            required
          />
        </div>
        <button className="realm-btn-gold" style={{ alignSelf: 'flex-start', padding: '6px 18px' }} disabled={loading}>
          {loading ? 'Sending...' : 'Send Verification'}
        </button>
        <StatusMsg {...status} />
      </form>
    </Section>
  );
}

// ─── Change Password ───────────────────────────────────────────────────────
function ChangePasswordSection() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({});
    if (form.newPassword.length < 8) return setStatus({ error: 'New password must be at least 8 characters.' });
    if (form.newPassword !== form.confirm) return setStatus({ error: 'New passwords do not match.' });

    setLoading(true);
    try {
      await api.post('/user/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setStatus({ success: 'Password updated successfully.' });
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setStatus({ error: err.response?.data?.error || 'Failed to update password.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section title="Change Password">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {['currentPassword', 'newPassword', 'confirm'].map((field) => (
          <div key={field}>
            <label style={{ color: '#8090a8', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>
              {field === 'currentPassword' ? 'Current Password' : field === 'newPassword' ? 'New Password' : 'Confirm New Password'}
            </label>
            <input
              className="realm-input"
              type="password"
              value={form[field]}
              onChange={e => setForm({ ...form, [field]: e.target.value })}
              required
              minLength={field !== 'currentPassword' ? 8 : undefined}
            />
          </div>
        ))}
        <button className="realm-btn-gold" style={{ alignSelf: 'flex-start', padding: '6px 18px' }} disabled={loading}>
          {loading ? 'Updating...' : 'Update Password'}
        </button>
        <StatusMsg {...status} />
      </form>
    </Section>
  );
}

// ─── Delete Account ────────────────────────────────────────────────────────
function DeleteAccountSection({ onLogout }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (confirm !== 'DELETE') return;
    setLoading(true);
    try {
      await api.post('/user/delete-account', { confirmation: 'DELETE' });
      onLogout('Your account has been scheduled for deletion.');
    } catch (err) {
      setStatus({ error: err.response?.data?.error || 'Failed to delete account.' });
      setLoading(false);
    }
  }

  return (
    <Section title="Delete Account" danger>
      <p style={{ color: '#fca5a5', fontSize: '0.85rem', marginBottom: '12px' }}>
        Permanently deletes your account and all game data. This cannot be undone.
      </p>
      <button
        onClick={() => setModalOpen(true)}
        style={{
          fontFamily: 'Verdana, Arial, sans-serif',
          fontSize: '0.8rem',
          color: '#fca5a5',
          border: '1px solid #991b1b',
          padding: '6px 16px',
          background: 'transparent',
          cursor: 'pointer',
          borderRadius: '4px',
        }}
      >
        Delete My Account
      </button>
      <StatusMsg {...status} />

      {modalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.75)',
        }}>
          <div style={{
            background: '#0e1828', border: '1px solid #991b1b',
            borderRadius: '8px', padding: '2rem', maxWidth: '420px', width: '90%',
          }}>
            <h4 style={{ color: '#f87171', fontFamily: 'Cinzel, Georgia, serif', marginBottom: '12px' }}>
              Delete Account
            </h4>
            <p style={{ color: '#c8d8e8', fontSize: '0.85rem', marginBottom: '16px' }}>
              This will permanently delete your account and all game data. Type <strong style={{ color: '#f87171' }}>DELETE</strong> to confirm.
            </p>
            <input
              className="realm-input"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Type DELETE"
              autoFocus
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button
                onClick={handleDelete}
                disabled={confirm !== 'DELETE' || loading}
                style={{
                  fontFamily: 'Verdana, Arial, sans-serif',
                  fontSize: '0.8rem',
                  color: confirm === 'DELETE' ? '#fff' : '#666',
                  background: confirm === 'DELETE' ? '#991b1b' : '#1e2838',
                  border: '1px solid #991b1b',
                  padding: '6px 16px',
                  cursor: confirm === 'DELETE' ? 'pointer' : 'not-allowed',
                  borderRadius: '4px',
                }}
              >
                {loading ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button
                onClick={() => { setModalOpen(false); setConfirm(''); }}
                style={{
                  fontFamily: 'Verdana, Arial, sans-serif',
                  fontSize: '0.8rem',
                  color: '#8090a8',
                  border: '1px solid #243650',
                  padding: '6px 16px',
                  background: 'transparent',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

// ─── Appearance (Province Motto) ───────────────────────────────────────────
function AppearanceSection({ user }) {
  const [motto, setMotto] = useState(user?.province_motto || '');
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({});
    setLoading(true);
    try {
      await api.patch('/user/appearance', { provinceMotto: motto });
      setStatus({ success: 'Motto updated. It will appear below your province name.' });
    } catch (err) {
      setStatus({ error: err.response?.data?.error || 'Failed to save motto.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section title="Appearance">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label style={{ color: '#8090a8', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Province Motto</label>
          <input
            className="realm-input"
            value={motto}
            onChange={e => setMotto(e.target.value)}
            maxLength={80}
            placeholder="e.g. Blood and glory, or leave blank"
          />
          <p style={{ color: '#485868', fontSize: '0.75rem', marginTop: '4px' }}>
            {motto.length}/80 characters. Shown beneath your province name in the header.
          </p>
        </div>
        <button className="realm-btn-gold" style={{ alignSelf: 'flex-start', padding: '6px 18px' }} disabled={loading}>
          {loading ? 'Saving...' : 'Save Motto'}
        </button>
        <StatusMsg {...status} />
      </form>
    </Section>
  );
}

// ─── Main Settings Page ────────────────────────────────────────────────────
export default function Settings({ onLogout }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  // Banner from email verification redirect
  const emailVerified = searchParams.get('email_verified');
  const emailError = searchParams.get('email_error');

  useEffect(() => {
    api.get('/user/me')
      .then(({ data }) => setUser(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleLogout(message) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('rod_tutorial_seen');
    onLogout(message);
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem 0' }}>
      <h2
        style={{
          fontFamily: 'Cinzel, Georgia, serif',
          color: '#c8a048',
          fontSize: '1.4rem',
          letterSpacing: '0.1em',
          marginBottom: '1.5rem',
        }}
      >
        Account Settings
      </h2>

      {emailVerified && (
        <div style={{ background: 'rgba(20,83,45,0.4)', border: '1px solid #166534', color: '#4ade80', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem' }}>
          Email address updated successfully.
        </div>
      )}
      {emailError && (
        <div style={{ background: 'rgba(127,29,29,0.3)', border: '1px solid #991b1b', color: '#f87171', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem' }}>
          Email verification link is invalid or has expired.
        </div>
      )}

      {loading ? (
        <p style={{ color: '#8090a8', fontSize: '0.85rem' }}>Loading...</p>
      ) : (
        <div className="flex flex-col gap-4">
          <AppearanceSection user={user} />
          <DisplayNameSection user={user} />
          <ChangeEmailSection user={user} />
          <ChangePasswordSection />
          <DeleteAccountSection onLogout={handleLogout} />
        </div>
      )}
    </div>
  );
}
