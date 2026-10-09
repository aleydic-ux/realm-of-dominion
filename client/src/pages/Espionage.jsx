import { useState, useEffect } from 'react';
import api, { getApiError } from '../utils/api';
import { formatNumber, RACE_ICONS } from '../utils/formatters';
import { usePageTitle } from '../hooks/usePageTitle';

const ACTION_ICONS = {
  recon: '🔍',
  steal_gold: '💰',
  steal_food: '🌾',
  assassinate: '🗡️',
};

function formatAgo(isoString) {
  if (!isoString) return '—';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Espionage({ province }) {
  usePageTitle('Espionage');

  const [actions, setActions] = useState([]);
  const [reports, setReports] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [executing, setExecuting] = useState(null);
  const [results, setResults] = useState({});
  const [errors, setErrors] = useState({});
  const [ap, setAp] = useState(province?.action_points ?? 0);
  const [gold, setGold] = useState(province?.gold ?? 0);

  useEffect(() => {
    setAp(province?.action_points ?? 0);
    setGold(province?.gold ?? 0);
  }, [province]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [actRes, repRes, lbRes] = await Promise.all([
          api.get('/spy/actions'),
          api.get('/spy/reports'),
          api.get('/leaderboard'),
        ]);
        if (!cancelled) {
          setActions(actRes.data);
          setReports(repRes.data);
          setProvinces(lbRes.data.overall || []);
        }
      } catch {}
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function execute(actionKey) {
    if (!target) { setErrors(prev => ({ ...prev, [actionKey]: 'Select a target first' })); return; }
    setExecuting(actionKey);
    setErrors(prev => ({ ...prev, [actionKey]: null }));
    setResults(prev => ({ ...prev, [actionKey]: null }));
    try {
      const { data } = await api.post('/spy/execute', { target_id: target.id, action_type: actionKey });
      setResults(prev => ({ ...prev, [actionKey]: data }));
      setAp(prev => prev - data.ap_used);
      setGold(prev => prev - data.gold_used);
      // Refresh reports
      const repRes = await api.get('/spy/reports');
      setReports(repRes.data);
    } catch (err) {
      setErrors(prev => ({ ...prev, [actionKey]: getApiError(err, 'Operation failed') }));
    }
    setExecuting(null);
  }

  const filteredProvinces = provinces.filter(p =>
    p.id !== province?.id &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="text-realm-text-muted text-sm p-4">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-realm-gold font-display text-2xl">Espionage</h1>
        <div className="text-xs text-realm-text-muted font-mono space-x-4">
          <span>AP: <span className="text-realm-gold">{Math.floor(ap)}</span></span>
          <span>Gold: <span className="text-yellow-400">{formatNumber(gold)}</span></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Target selector */}
        <div className="realm-panel space-y-3">
          <h2 className="text-realm-gold font-display text-sm">Select Target</h2>
          <input
            type="text"
            placeholder="Search provinces..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-realm-dark border border-realm-border text-realm-text text-xs px-3 py-1.5 rounded font-mono focus:outline-none focus:border-realm-gold"
          />
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {filteredProvinces.map(p => (
              <button
                key={p.id}
                onClick={() => { setTarget(p); setResults({}); setErrors({}); }}
                className="w-full text-left px-3 py-2 text-xs font-mono border transition-colors duration-150 rounded"
                style={{
                  background: target?.id === p.id ? 'rgba(200,160,72,0.12)' : 'transparent',
                  borderColor: target?.id === p.id ? 'rgba(200,160,72,0.5)' : 'rgba(36,54,80,0.6)',
                  color: target?.id === p.id ? '#c8a048' : '#8090a8',
                }}
              >
                <span className="mr-1">{RACE_ICONS?.[p.race] ?? '⚔'}</span>
                {p.name}
                <span className="float-right text-realm-text-dim">{formatNumber(p.land)} ac</span>
              </button>
            ))}
          </div>
        </div>

        {/* Spy actions */}
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-realm-gold font-display text-sm">
            {target ? `Operations against ${target.name}` : 'Choose a target to run operations'}
          </h2>
          {actions.map(action => {
            const result = results[action.key];
            const err = errors[action.key];
            const canAffordAp = ap >= action.ap_cost;
            const canAffordGold = gold >= action.gold_cost;
            const canRun = !!target && canAffordAp && canAffordGold;

            return (
              <div key={action.key} className="realm-panel space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-realm-gold font-display text-sm">
                      {ACTION_ICONS[action.key]} {action.name}
                    </span>
                    <p className="text-realm-text-dim text-xs mt-0.5">{action.description}</p>
                  </div>
                  <div className="text-right text-xs font-mono shrink-0 space-y-0.5">
                    <div className={canAffordAp ? 'text-realm-gold' : 'text-red-400'}>{action.ap_cost} AP</div>
                    <div className={canAffordGold ? 'text-yellow-400' : 'text-red-400'}>{formatNumber(action.gold_cost)}g</div>
                  </div>
                </div>

                {err && <p className="text-red-400 text-xs">{err}</p>}

                {result && (
                  <div className="border border-realm-border/50 rounded p-2 text-xs font-mono space-y-1">
                    <div className={result.success ? 'text-green-400' : 'text-red-400'}>
                      {result.success ? '✓ Operation successful' : '✗ Operation failed'}
                      {result.detected ? ' — detected' : ' — undetected'}
                    </div>
                    {result.success && result.result && (
                      <SpyResult actionType={result.action_type} data={result.result} />
                    )}
                  </div>
                )}

                <button
                  onClick={() => execute(action.key)}
                  disabled={!canRun || executing === action.key}
                  className="realm-btn-gold text-xs w-full"
                >
                  {executing === action.key ? 'Executing...' : `Execute ${action.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reports */}
      <div className="realm-panel space-y-3">
        <h2 className="text-realm-gold font-display text-sm">Spy Reports</h2>
        {reports.length === 0 ? (
          <p className="text-realm-text-muted text-xs">No spy activity recorded yet.</p>
        ) : (
          <div className="space-y-1">
            {reports.map(r => {
              const isAttacker = r.attacker_province_id === province?.id;
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 text-xs font-mono py-1.5 border-b border-realm-border/30"
                >
                  <span className="text-realm-text-dim w-16 shrink-0">{formatAgo(r.created_at)}</span>
                  <span className={r.success ? 'text-green-400' : 'text-red-400'}>
                    {r.success ? '✓' : '✗'}
                  </span>
                  <span className="text-realm-text-muted">
                    {isAttacker ? (
                      <>Your <span className="text-realm-text">{ACTION_ICONS[r.action_type]} {r.action_type.replace('_', ' ')}</span> on <span className="text-realm-gold">{r.defender_name}</span></>
                    ) : (
                      <><span className="text-realm-gold">{r.attacker_name ?? 'Unknown'}</span> attempted <span className="text-realm-text">{ACTION_ICONS[r.action_type]} {r.action_type.replace('_', ' ')}</span> on you</>
                    )}
                  </span>
                  {r.detected && <span className="text-yellow-500 ml-auto shrink-0">detected</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SpyResult({ actionType, data }) {
  if (actionType === 'recon') {
    return (
      <div className="space-y-0.5">
        <div className="text-realm-text">
          {RACE_ICONS?.[data.race] ?? '⚔'} {data.race} — {formatNumber(data.land)} acres — Morale {data.morale}%
        </div>
        <div className="text-yellow-400">Gold: {formatNumber(data.gold)} &nbsp; Food: {formatNumber(data.food)} &nbsp; Mana: {formatNumber(data.mana)}</div>
        {data.troops?.length > 0 && (
          <div className="text-realm-text-dim mt-1">
            Troops: {data.troops.map(t => `${t.name} ×${formatNumber(t.count_home + t.count_away)}`).join(', ')}
          </div>
        )}
      </div>
    );
  }
  if (actionType === 'steal_gold') return <div className="text-yellow-400">Stole {formatNumber(data.stolen_gold)} gold</div>;
  if (actionType === 'steal_food') return <div className="text-green-400">Stole {formatNumber(data.stolen_food)} food</div>;
  if (actionType === 'assassinate') {
    if (data.killed > 0) return <div className="text-red-400">Assassinated {formatNumber(data.killed)} {data.troop_name} (T{data.troop_tier})</div>;
    return <div className="text-realm-text-muted">{data.note}</div>;
  }
  return null;
}
