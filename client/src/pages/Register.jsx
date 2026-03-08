import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

const RACES = [
  {
    id: 'human', label: 'Human', icon: '👑',
    bonuses: '+20% gold income, -10% build cost, +20% trade bonus',
    lore: 'Balanced traders and diplomats. Masters of commerce and alliances.',
  },
  {
    id: 'orc', label: 'Orc', icon: '💀',
    bonuses: '+25% troop attack, +15% training speed',
    lore: 'Brutal warmongers. Unmatched in raw military power.',
  },
  {
    id: 'undead', label: 'Undead', icon: '☠️',
    bonuses: 'Zero troop food upkeep, skeleton raise, 2x return speed',
    lore: 'Relentless horde. Troops cost no food, and the fallen rise again.',
  },
  {
    id: 'elf', label: 'Elf', icon: '🌿',
    bonuses: '+30% mana regen, +20% research speed, +15% land yield',
    lore: 'Ancient scholars. Masters of magic and forgotten lore.',
  },
  {
    id: 'dwarf', label: 'Dwarf', icon: '⚒️',
    bonuses: '-25% build cost, -25% siege damage taken',
    lore: 'Master builders. Impenetrable fortresses and runic weapons.',
  },
];

export default function Register({ onLogin }) {
  const [form, setForm] = useState({
    username: '', email: '', password: '', province_name: '', race: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.race) { setError('Please select a race'); return; }
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', form);
      onLogin(data.token, data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
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
      <div className="w-full max-w-2xl relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-realm-gold font-display" style={{ fontSize: '3.2rem', letterSpacing: '0.12em', textShadow: '2px 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(200,160,72,0.4)' }}>Realm of Dominion</h1>
          <p className="text-realm-text-muted mt-3 uppercase tracking-widest" style={{ letterSpacing: '0.25em', fontSize: '0.8rem' }}>Forge your legend</p>
        </div>

        <form onSubmit={handleSubmit} className="realm-panel flex flex-col gap-5">
          <h2 className="text-realm-gold text-xl font-display">Create Your Province</h2>

          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-realm-text-muted text-xs block mb-1">Username</label>
              <input className="realm-input" type="text" required
                value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
            </div>
            <div>
              <label className="text-realm-text-muted text-xs block mb-1">Email</label>
              <input className="realm-input" type="email" required
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="text-realm-text-muted text-xs block mb-1">Password (min 8)</label>
              <input className="realm-input" type="password" required minLength={8}
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="text-realm-text-muted text-xs block mb-1">Province Name</label>
              <input className="realm-input" type="text" required
                value={form.province_name} onChange={e => setForm({ ...form, province_name: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="text-realm-text-muted text-xs block mb-2">Choose Your Race</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {RACES.map((race) => (
                <button
                  key={race.id}
                  type="button"
                  onClick={() => setForm({ ...form, race: race.id })}
                  className={`text-left p-3 rounded border transition-all ${
                    form.race === race.id
                      ? 'border-realm-gold bg-realm-gold-dark/20'
                      : 'border-realm-border bg-realm-surface hover:border-realm-gold/50'
                  }`}
                >
                  <div className="text-lg mb-1">{race.icon} <span className={`race-${race.id} font-bold`}>{race.label}</span></div>
                  <div className="text-realm-text-dim text-xs italic mb-1">{race.lore}</div>
                  <div className="text-green-400 text-xs">{race.bonuses}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-realm-surface border border-realm-border/50 rounded p-3 text-xs text-realm-text-dim">
            Your province will start with a <span className="text-blue-300">24-hour newbie shield</span>.
            You will not be attackable during this time.
          </div>

          <button type="submit" className="realm-btn-gold w-full" disabled={loading}>
            {loading ? 'Forging...' : 'Claim Your Province'}
          </button>

          <p className="text-realm-text-dim text-xs text-center">
            Already have a kingdom?{' '}
            <Link to="/login" className="text-realm-gold hover:underline">Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

