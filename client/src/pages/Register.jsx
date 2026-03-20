import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getApiError } from '../utils/api';
import { formatNumber } from '../utils/formatters';
import AuthLayout from '../components/AuthLayout';
import AlertBanner from '../components/AlertBanner';

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
  {
    id: 'serpathi', label: 'Serpathi', icon: '🐍',
    bonuses: 'Spy actions 20% cheaper, recover 15% of defensive troops, 25% enemy scout resistance, +10% mana regen',
    lore: 'We do not conquer. We wait, and then we take.',
  },
  {
    id: 'ironveil', label: 'Ironveil', icon: '⚙️',
    bonuses: '+15% offensive attack, -10% build cost, crafting yields +1 charge',
    lore: 'Every war is a resource problem. We solved it.',
  },
  {
    id: 'ashborn', label: 'Ashborn', icon: '🔥',
    bonuses: 'Raids deal +25% damage/loot, fury stacks per attack (+3% each, max 5), scorched earth on defense',
    lore: 'We have already burned. What can you do to us?',
  },
  {
    id: 'tidewarden', label: 'Tidewarden', icon: '🌊',
    bonuses: '+20% gold & food, phantom attack once/season, +10% marketplace, attackers suffer extra losses',
    lore: 'The tide comes in. The tide goes out. So does our mercy.',
  },
];

export default function Register({ onLogin }) {
  const [form, setForm] = useState({
    username: '', email: '', password: '', province_name: '', race: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lateJoin, setLateJoin] = useState(null);
  const [pendingLogin, setPendingLogin] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.race) { setError('Please select a race'); return; }
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', form);
      if (data.late_join) {
        setPendingLogin({ token: data.token, user: data.user });
        setLateJoin(data.late_join);
      } else {
        onLogin(data.token, data.user);
      }
    } catch (err) {
      setError(getApiError(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout subtitle="Forge your legend" maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit} className="realm-panel flex flex-col gap-5" style={{ backdropFilter: 'blur(8px)', background: 'rgba(22, 32, 48, 0.85)' }}>
          <h2 className="text-realm-gold text-xl font-display" style={{ textShadow: '0 0 12px rgba(200,160,72,0.3)' }}>Create Your Province</h2>

          <AlertBanner type="error" message={error} />

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
                  className={`text-left p-3 rounded border cursor-pointer ${
                    form.race === race.id
                      ? 'border-realm-gold bg-realm-gold-dark/20'
                      : 'border-realm-border bg-realm-surface hover:border-realm-gold/50'
                  }`}
                  style={{
                    transition: 'all 0.25s ease',
                    boxShadow: form.race === race.id ? '0 0 12px rgba(200,160,72,0.2), inset 0 1px 0 rgba(200,160,72,0.1)' : 'none',
                  }}
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

      {lateJoin && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="realm-panel w-full max-w-md space-y-4" style={{ borderTop: '2px solid rgb(200,160,72)' }}>
            <div className="text-center">
              <div style={{ fontSize: '2rem', marginBottom: '4px' }}>⚔</div>
              <h2 className="text-realm-gold font-display text-xl">Welcome — You've Joined on Day {lateJoin.joined_on_day}</h2>
            </div>
            <p className="text-realm-text-muted text-sm text-center">
              This Age is already in progress. We've given you a head-start bonus to help you catch up.
            </p>
            <div style={{ background: 'rgba(17,24,40,0.8)', border: '1px solid rgb(36,54,80)', borderRadius: '4px', padding: '10px 14px' }}>
              <table style={{ width: '100%', fontSize: '13px' }}>
                <tbody>
                  {lateJoin.bonus.gold > 0 && (
                    <tr><td className="text-realm-text-dim py-1">💰 Gold</td><td className="text-yellow-400 text-right font-bold">+{formatNumber(lateJoin.bonus.gold)}</td></tr>
                  )}
                  {lateJoin.bonus.food > 0 && (
                    <tr><td className="text-realm-text-dim py-1">🌾 Food</td><td className="text-green-400 text-right font-bold">+{formatNumber(lateJoin.bonus.food)}</td></tr>
                  )}
                  {lateJoin.bonus.mana > 0 && (
                    <tr><td className="text-realm-text-dim py-1">🔮 Mana</td><td className="text-blue-400 text-right font-bold">+{formatNumber(lateJoin.bonus.mana)}</td></tr>
                  )}
                  {lateJoin.bonus.industry_points > 0 && (
                    <tr><td className="text-realm-text-dim py-1">⚙️ Industry</td><td className="text-gray-300 text-right font-bold">+{formatNumber(lateJoin.bonus.industry_points)}</td></tr>
                  )}
                  {lateJoin.bonus.population > 0 && (
                    <tr><td className="text-realm-text-dim py-1">👥 Population</td><td className="text-realm-text text-right font-bold">+{formatNumber(lateJoin.bonus.population)}</td></tr>
                  )}
                  {lateJoin.bonus.gems > 0 && (
                    <tr><td className="text-realm-text-dim py-1">💎 Gems</td><td className="text-purple-400 text-right font-bold">+{lateJoin.bonus.gems}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <button
              onClick={() => { onLogin(pendingLogin.token, pendingLogin.user); }}
              className="realm-btn-gold w-full"
            >
              Begin My Kingdom
            </button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}

