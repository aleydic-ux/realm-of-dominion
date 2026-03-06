import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../utils/api';
import { formatNumber, RACE_ICONS } from '../utils/formatters';

const ATTACK_TYPES = [
  { id: 'raid', label: 'Raid', icon: '🥷', desc: 'Steal resources. No land gained. Low casualties.' },
  { id: 'conquest', label: 'Conquest', icon: '🏴', desc: 'Capture land (10-30%). Medium casualties.' },
  { id: 'raze', label: 'Raze', icon: '🔥', desc: 'Destroy enemy buildings. High casualties on both sides.' },
  { id: 'massacre', label: 'Massacre', icon: '💀', desc: 'Reduce enemy population. Very high casualties.' },
];

export default function Attack({ province, troops = [], refresh }) {
  const location = useLocation();
  const [provinces, setProvinces] = useState([]);
  const [target, setTarget] = useState(location.state?.target || null);
  const [attackType, setAttackType] = useState('raid');
  const [deployment, setDeployment] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { document.title = 'Attack — Realm of Dominion'; }, []);

  useEffect(() => {
    async function loadProvinces() {
      try {
        const { data } = await api.get('/province/list');
        setProvinces(data);
      } catch {}
    }
    loadProvinces();
  }, []);

  const homeTroops = troops.filter(t => t.count_home > 0);
  const totalDeployed = Object.values(deployment).reduce((a, b) => a + (parseInt(b) || 0), 0);

  async function handleAttack() {
    if (!target) { setError('Select a target'); return; }
    if (!totalDeployed) { setError('Deploy at least one troop'); return; }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const troopPayload = {};
      for (const [id, count] of Object.entries(deployment)) {
        if (parseInt(count) > 0) troopPayload[id] = parseInt(count);
      }
      const { data } = await api.post('/attack', {
        target_id: target.id,
        attack_type: attackType,
        troops: troopPayload,
      });
      setResult(data);
      setDeployment({});
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Attack failed');
    } finally {
      setLoading(false);
    }
  }

  const filtered = provinces.filter(p =>
    p.id !== province?.id &&
    (p.name.toLowerCase().includes(search.toLowerCase()) ||
     p.username.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-display text-realm-gold">Launch Attack</h1>

      {error && <div className="bg-red-900/30 border border-red-700 text-red-300 px-3 py-2 rounded text-sm">{error}</div>}

      {/* Result */}
      {result && (
        <div className={`realm-panel border-2 ${result.outcome === 'win' ? 'border-green-600' : result.outcome === 'draw' ? 'border-yellow-600' : 'border-red-600'}`}>
          <h2 className={`text-xl font-display mb-2 ${result.outcome === 'win' ? 'text-green-400' : result.outcome === 'draw' ? 'text-yellow-400' : 'text-red-400'}`}>
            {result.outcome === 'win' ? '⚔️ Victory!' : result.outcome === 'draw' ? '💥 Draw' : '🛡️ Defeated'}
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-realm-text-dim">Your Power</div>
              <div className="text-green-400">{formatNumber(result.attacker_power)}</div>
            </div>
            <div>
              <div className="text-realm-text-dim">Enemy Power</div>
              <div className="text-red-400">{formatNumber(result.defender_power)}</div>
            </div>
            {result.land_gained > 0 && (
              <div><div className="text-realm-text-dim">Land Gained</div><div className="text-amber-400">+{result.land_gained} acres</div></div>
            )}
            {result.resources_stolen?.gold > 0 && (
              <div><div className="text-realm-text-dim">Gold Stolen</div><div className="text-yellow-400">+{formatNumber(result.resources_stolen.gold)}</div></div>
            )}
          </div>
          <div className="text-xs text-realm-text-dim mt-2">
            Troops returning in ~8 hours.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Target Selection */}
        <div className="realm-panel space-y-3">
          <h2 className="text-realm-gold font-display">Select Target</h2>
          <input
            className="realm-input text-sm"
            placeholder="Search provinces..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {target && (
            <div className="bg-red-900/20 border border-red-700/40 rounded p-2 text-sm flex items-center justify-between">
              <span>
                <span className={`race-${target.race}`}>{RACE_ICONS[target.race]}</span>
                {' '}{target.name} <span className="text-realm-text-dim">({target.username})</span>
              </span>
              <button onClick={() => setTarget(null)} className="text-red-400 text-xs">✕</button>
            </div>
          )}
          <div className="max-h-48 overflow-y-auto space-y-1">
            {filtered.slice(0, 30).map(p => (
              <button
                key={p.id}
                onClick={() => setTarget(p)}
                className={`w-full text-left p-2 rounded text-sm transition-colors ${
                  target?.id === p.id ? 'bg-red-900/30 border border-red-600' : 'bg-realm-surface hover:bg-realm-panel border border-transparent'
                }`}
              >
                <span className={`race-${p.race} mr-1`}>{RACE_ICONS[p.race]}</span>
                <span className="text-realm-text">{p.name}</span>
                <span className="text-realm-text-dim ml-2 text-xs">{p.username}</span>
                <span className="float-right text-realm-text-dim text-xs">{formatNumber(p.land)} ac</span>
                {p.protection_ends_at && new Date(p.protection_ends_at) > new Date() && (
                  <span className="ml-1 text-blue-400">🛡️</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Attack Type + Troop Deployment */}
        <div className="space-y-3">
          <div className="realm-panel">
            <h2 className="text-realm-gold font-display mb-2">Attack Type</h2>
            <div className="grid grid-cols-2 gap-2">
              {ATTACK_TYPES.map(at => (
                <button
                  key={at.id}
                  onClick={() => setAttackType(at.id)}
                  className={`p-2 rounded text-sm text-left transition-all relative ${
                    attackType === at.id
                      ? 'border-2 border-realm-gold bg-realm-gold/10'
                      : 'border border-realm-border hover:border-realm-gold/50'
                  }`}
                >
                  {attackType === at.id && (
                    <span className="absolute top-1 right-1 text-realm-gold text-xs font-bold">✓</span>
                  )}
                  <div>{at.icon} <span className="text-realm-gold">{at.label}</span></div>
                  <div className="text-realm-text-dim text-xs mt-1">{at.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="realm-panel">
            <h2 className="text-realm-gold font-display mb-2">Deploy Troops</h2>
            {homeTroops.length === 0 ? (
              <p className="text-realm-text-dim text-sm">No troops at home.</p>
            ) : (
              <div className="space-y-2">
                {homeTroops.map(t => (
                  <div key={t.troop_type_id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-realm-text-muted text-sm w-28 truncate">{t.name}</span>
                      <span className="text-realm-text-dim text-xs">({t.count_home})</span>
                      <input
                        type="number"
                        min="0"
                        max={t.count_home}
                        className="realm-input text-xs w-20 py-1"
                        value={deployment[t.troop_type_id] || ''}
                        onChange={e => setDeployment({ ...deployment, [t.troop_type_id]: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div className="flex gap-1 ml-0">
                      {[25, 50, 75, 100].map(pct => (
                        <button
                          key={pct}
                          className="text-xs text-realm-text-dim hover:text-realm-gold border border-realm-border/50 rounded px-1.5 py-0.5"
                          onClick={() => setDeployment({ ...deployment, [t.troop_type_id]: Math.floor(t.count_home * pct / 100) })}
                        >
                          {pct === 100 ? 'Max' : `${pct}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="text-xs text-realm-text-dim mt-1">
                  Deploying: <span className="text-realm-gold">{totalDeployed}</span> troops | 5 AP
                </div>
              </div>
            )}
          </div>

          {!target && (
            <p className="text-realm-text-dim text-sm text-center">← Select a target province to continue</p>
          )}
          <button
            onClick={handleAttack}
            disabled={loading || !target || !totalDeployed || (province?.action_points || 0) < 5}
            className="realm-btn-red w-full text-base py-3"
          >
            {loading ? 'Attacking...' : `⚔️ Launch ${ATTACK_TYPES.find(t => t.id === attackType)?.label} (5 AP)`}
          </button>
        </div>
      </div>
    </div>
  );
}
