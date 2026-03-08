import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { formatNumber } from '../utils/formatters';

const EFFECT_TYPES = {
  combat_boost:    { label: 'Combat',   color: 'text-orange-400', border: 'border-orange-800/40', bg: 'bg-orange-900/10' },
  resource_boost:  { label: 'Resource', color: 'text-green-400',  border: 'border-green-800/40',  bg: 'bg-green-900/10'  },
  debuff:          { label: 'Debuff',   color: 'text-red-400',    border: 'border-red-800/40',    bg: 'bg-red-900/10'    },
};

const TIER_COLORS = ['', 'text-gray-300', 'text-blue-400', 'text-purple-400'];

function timeRemaining(ms) {
  if (ms <= 0) return 'Ready';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function CostBadge({ cost, province }) {
  const entries = Object.entries(cost);
  return (
    <span className="flex gap-1.5 flex-wrap">
      {entries.map(([k, v]) => {
        const col = k === 'industry' ? 'production_points' : k;
        const have = province?.[col] ?? 0;
        const ok = have >= v;
        return (
          <span key={k} className={`text-xs ${ok ? 'text-realm-text-muted' : 'text-red-400'}`}>
            {formatNumber(v)} {k === 'industry' ? 'PP' : k}
          </span>
        );
      })}
    </span>
  );
}

export default function Crafting({ province, buildings }) {
  const [status, setStatus] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [sendTarget, setSendTarget] = useState({});
  const [sendSearch, setSendSearch] = useState({});
  const [tick, setTick] = useState(0);

  const towerLevel = buildings?.find(b => b.building_type === 'alchemist_tower')?.level ?? 0;

  useEffect(() => { document.title = 'Alchemist Tower — Realm of Dominion'; }, []);

  // Live countdown ticker
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    try {
      const [statusRes, lbRes] = await Promise.all([
        api.get('/crafting/tower/status'),
        api.get('/leaderboard'),
      ]);
      setStatus(statusRes.data);
      setLeaderboard(lbRes.data.overall || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = useCallback(async (fn, successMsg) => {
    setError(null);
    setSuccess(null);
    try {
      await fn();
      setSuccess(successMsg);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed');
    }
    setBusy(null);
  }, [load]);

  const buildTower = () => {
    setBusy('build');
    act(() => api.post('/crafting/tower/build'), 'Alchemist Tower built!');
  };

  const upgradeTower = () => {
    setBusy('upgrade');
    act(() => api.post('/crafting/tower/upgrade'), 'Tower upgraded!');
  };

  const startCraft = (itemKey) => {
    setBusy(`craft-${itemKey}`);
    act(() => api.post('/crafting/start', { item_key: itemKey, quantity: 1 }),
      `${status?.recipes?.[itemKey]?.name || itemKey} queued!`);
  };

  const collect = () => {
    setBusy('collect');
    act(() => api.post('/crafting/collect'), 'Items collected!');
  };

  const useItem = (itemKey) => {
    setBusy(`use-${itemKey}`);
    act(() => api.post('/crafting/items/use', { item_key: itemKey, quantity: 1 }),
      `${status?.recipes?.[itemKey]?.name || itemKey} used!`);
  };

  const sendItem = (itemKey) => {
    const targetId = sendTarget[itemKey];
    if (!targetId) return;
    setBusy(`send-${itemKey}`);
    act(
      () => api.post('/crafting/items/send', { item_key: itemKey, target_province_id: parseInt(targetId) }),
      `${status?.recipes?.[itemKey]?.name || itemKey} sent!`
    );
    setSendTarget(prev => ({ ...prev, [itemKey]: '' }));
    setSendSearch(prev => ({ ...prev, [itemKey]: '' }));
  };

  if (loading) return <div className="text-realm-text-muted">Loading Alchemist Tower...</div>;

  const tower = status?.tower;
  const queue = status?.queue || [];
  const inventory = status?.inventory || [];
  const cooldowns = status?.cooldowns || {};
  const activeEffects = status?.active_effects || [];
  const recipes = status?.recipes || {};

  const readyItems = queue.filter(q => new Date(q.completes_at) <= new Date());
  const inProgress = queue.filter(q => new Date(q.completes_at) > new Date());
  const usedSlots = inProgress.length;
  const totalSlots = tower?.crafting_slots ?? 0;

  const TOWER_COSTS = {
    build:   { gold: 500, PP: 200 },
    upgrade2:{ gold: 1200, PP: 500, mana: 300 },
    upgrade3:{ gold: 3000, PP: 1000, mana: 800 },
  };

  const UPGRADE_COST_MAP = {
    build:    { gold: 500, production_points: 200 },
    upgrade2: { gold: 1200, production_points: 500, mana: 300 },
    upgrade3: { gold: 3000, production_points: 1000, mana: 800 },
  };

  function canAffordRaw(costMap) {
    for (const [k, v] of Object.entries(costMap)) {
      if ((province?.[k] ?? 0) < v) return false;
    }
    return true;
  }

  // Group recipes by type
  const byType = {};
  for (const [key, r] of Object.entries(recipes)) {
    if (!byType[r.effect_type]) byType[r.effect_type] = [];
    byType[r.effect_type].push({ key, ...r });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-display text-realm-gold">Alchemist Tower</h1>
        {tower && (
          <div className="text-sm text-realm-text-muted">
            Tier:{' '}
            <span className={`font-bold ${TIER_COLORS[tower.tier]}`}>{tower.tier}</span>
            {' · '}
            Slots:{' '}
            <span className="text-realm-gold font-bold">{usedSlots}/{totalSlots}</span>
          </div>
        )}
      </div>

      {/* Feedback */}
      {error   && <div className="realm-panel border border-red-700/50 text-red-400 text-sm p-3">{error}</div>}
      {success && <div className="realm-panel border border-green-700/50 text-green-400 text-sm p-3">{success}</div>}

      {/* No tower — build prompt */}
      {!tower && (
        <div className="realm-panel border border-yellow-800/50 bg-yellow-900/10 text-center py-8 space-y-3">
          <p className="text-yellow-400 text-xl">⚗ No Alchemist Tower</p>
          <p className="text-realm-text-muted text-sm">
            Build an Alchemist Tower to unlock potion crafting.
          </p>
          <div className="text-xs text-realm-text-muted space-y-0.5">
            <div>Cost: <span className="text-realm-gold">500 gold</span> + <span className="text-blue-300">200 production points</span></div>
            <div>Tier 1 → 2 crafting slots · Tier 2 → 3 slots · Tier 3 → 4 slots</div>
          </div>
          <button
            onClick={buildTower}
            disabled={busy === 'build' || !canAffordRaw(UPGRADE_COST_MAP.build)}
            className="realm-btn-gold"
          >
            {busy === 'build' ? 'Building...' : 'Build Tower (500g + 200 PP)'}
          </button>
        </div>
      )}

      {/* Tower exists */}
      {tower && (
        <>
          {/* Upgrade */}
          {tower.tier < 3 && (
            <div className="realm-panel flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-0.5">
                <div className="text-sm text-realm-text font-bold">Upgrade to Tier {tower.tier + 1}</div>
                <div className="text-xs text-realm-text-muted">
                  {tower.tier === 1
                    ? 'Unlock Tier 2 recipes · +1 crafting slot'
                    : 'Unlock Tier 3 recipes · +1 crafting slot'}
                </div>
                <CostBadge
                  cost={tower.tier === 1
                    ? { gold: 1200, industry: 500, mana: 300 }
                    : { gold: 3000, industry: 1000, mana: 800 }}
                  province={province}
                />
              </div>
              <button
                onClick={upgradeTower}
                disabled={busy === 'upgrade' || !canAffordRaw(tower.tier === 1 ? UPGRADE_COST_MAP.upgrade2 : UPGRADE_COST_MAP.upgrade3)}
                className="realm-btn-gold shrink-0"
              >
                {busy === 'upgrade' ? 'Upgrading...' : `Upgrade Tower`}
              </button>
            </div>
          )}
          {tower.tier === 3 && (
            <div className="realm-panel border border-purple-700/40 text-center text-purple-400 text-sm py-2">
              ✦ Maximum Tier Reached ✦
            </div>
          )}

          {/* Crafting Queue */}
          <div className="realm-panel space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-realm-text-dim uppercase tracking-widest">
                Crafting Queue ({usedSlots}/{totalSlots} slots)
              </h2>
              {readyItems.length > 0 && (
                <button
                  onClick={collect}
                  disabled={busy === 'collect'}
                  className="realm-btn-gold text-xs"
                >
                  {busy === 'collect' ? 'Collecting...' : `Collect ${readyItems.length} Ready`}
                </button>
              )}
            </div>

            {queue.length === 0 && (
              <p className="text-realm-text-muted text-sm">Queue is empty. Start crafting below.</p>
            )}

            {queue.map(job => {
              const ms = new Date(job.completes_at) - new Date();
              const ready = ms <= 0;
              return (
                <div
                  key={job.id}
                  className={`flex items-center justify-between text-sm px-3 py-2 rounded border ${
                    ready
                      ? 'border-green-700/50 bg-green-900/10'
                      : 'border-realm-border/50 bg-realm-bg/30'
                  }`}
                >
                  <span className={ready ? 'text-green-400' : 'text-realm-text'}>
                    {job.quantity}× {recipes[job.item_key]?.name || job.item_key}
                  </span>
                  <span className={`text-xs ${ready ? 'text-green-400 font-bold' : 'text-realm-text-muted'}`}>
                    {ready ? '✓ Ready' : timeRemaining(ms)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Active Effects on Self */}
          {activeEffects.length > 0 && (
            <div className="realm-panel space-y-2">
              <h2 className="text-sm font-bold text-realm-text-dim uppercase tracking-widest">Active Effects</h2>
              <div className="space-y-1">
                {activeEffects.map(ef => {
                  const ms = ef.expires_at ? new Date(ef.expires_at) - new Date() : null;
                  const isDebuff = ef.modifier_value < 0;
                  const pct = Math.round(Math.abs(ef.modifier_value) * 100);
                  return (
                    <div
                      key={ef.id}
                      className={`flex items-center justify-between text-xs px-2 py-1 rounded border ${
                        isDebuff ? 'bg-red-900/20 border-red-800/30' : 'bg-green-900/20 border-green-800/30'
                      }`}
                    >
                      <span className={isDebuff ? 'text-red-400' : 'text-green-400'}>
                        {isDebuff ? '↓' : '↑'} {recipes[ef.item_key]?.name || ef.modifier_key} ({isDebuff ? '-' : '+'}{pct}%)
                      </span>
                      <span className="text-realm-text-muted">
                        {ms !== null ? (ms > 0 ? timeRemaining(ms) : 'Expiring') : 'Next battle'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recipes */}
          {['combat_boost', 'resource_boost', 'debuff'].map(type => {
            const items = byType[type] || [];
            if (!items.length) return null;
            const t = EFFECT_TYPES[type];
            const typeLabel = type === 'combat_boost' ? 'Combat Potions'
              : type === 'resource_boost' ? 'Resource Elixirs'
              : 'Debuff Items';
            return (
              <div key={type} className="space-y-2">
                <h2 className={`font-display border-b border-realm-border pb-1 ${t.color}`}>
                  {typeLabel}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map(recipe => {
                    const locked = recipe.tier_required > tower.tier;
                    const cdAt = cooldowns[recipe.key];
                    const cdMs = cdAt ? new Date(cdAt) - new Date() : 0;
                    const onCd = cdMs > 0;
                    const slotsAvail = usedSlots < totalSlots;
                    const inv = inventory.find(i => i.item_key === recipe.key);
                    const invQty = inv?.quantity ?? 0;

                    // Can afford check
                    let canAfford = true;
                    for (const [k, v] of Object.entries(recipe.cost)) {
                      const col = k === 'industry' ? 'production_points' : k;
                      if ((province?.[col] ?? 0) < v) { canAfford = false; break; }
                    }

                    const canCraft = !locked && !onCd && slotsAvail && canAfford;
                    const craftBusy = busy === `craft-${recipe.key}`;

                    return (
                      <div key={recipe.key} className={`realm-panel space-y-2 flex flex-col ${locked ? 'opacity-50' : ''}`}>
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-realm-gold font-display text-sm">{recipe.name}</span>
                          <span className={`text-xs border rounded px-1 shrink-0 ${TIER_COLORS[recipe.tier_required]}`}>
                            T{recipe.tier_required}
                          </span>
                        </div>

                        <p className="text-realm-text-muted text-xs">{recipe.description}</p>

                        <div className="text-xs space-y-0.5 border-t border-realm-border/50 pt-2">
                          <div className="flex justify-between">
                            <span className="text-realm-text-dim">Cost:</span>
                            <CostBadge cost={recipe.cost} province={province} />
                          </div>
                          <div className="flex justify-between">
                            <span className="text-realm-text-dim">Craft time:</span>
                            <span className="text-realm-text-muted">
                              {recipe.craft_time_mins >= 60
                                ? `${recipe.craft_time_mins / 60}h`
                                : `${recipe.craft_time_mins}m`}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-realm-text-dim">In inventory:</span>
                            <span className={invQty > 0 ? 'text-realm-gold font-bold' : 'text-realm-text-muted'}>
                              {invQty}
                            </span>
                          </div>
                          {locked && (
                            <div className="text-red-400 pt-0.5">🔒 Requires Tower Tier {recipe.tier_required}</div>
                          )}
                          {onCd && (
                            <div className="text-yellow-400">⏳ Cooldown: {timeRemaining(cdMs)}</div>
                          )}
                          {!slotsAvail && !locked && !onCd && (
                            <div className="text-orange-400">Queue full</div>
                          )}
                        </div>

                        {/* Craft button */}
                        {!locked && (
                          <button
                            onClick={() => startCraft(recipe.key)}
                            disabled={!canCraft || craftBusy}
                            className={`text-xs w-full py-1.5 rounded border transition-colors ${
                              canCraft
                                ? 'border-realm-gold/60 text-realm-gold hover:bg-realm-gold/10 cursor-pointer'
                                : 'border-realm-border text-realm-text-dim cursor-not-allowed'
                            }`}
                          >
                            {craftBusy ? 'Starting...' : !canAfford ? 'Not enough resources' : onCd ? 'On Cooldown' : !slotsAvail ? 'Queue Full' : 'Craft'}
                          </button>
                        )}

                        {/* Use / Send inventory controls */}
                        {invQty > 0 && !locked && (
                          <div className="border-t border-realm-border/50 pt-2 space-y-1.5">
                            <div className="text-xs text-realm-text-dim font-bold">{invQty} in inventory:</div>

                            {/* Self-buff: use button */}
                            {type !== 'debuff' && (
                              <button
                                onClick={() => useItem(recipe.key)}
                                disabled={busy === `use-${recipe.key}`}
                                className="text-xs w-full py-1 rounded border border-green-700/50 text-green-400 hover:bg-green-900/20 transition-colors"
                              >
                                {busy === `use-${recipe.key}` ? 'Using...' : 'Use on Self'}
                              </button>
                            )}

                            {/* Send to enemy (debuffs + combat items) */}
                            {(type === 'debuff' || type === 'combat_boost') && (
                              <SendItemPanel
                                itemKey={recipe.key}
                                label={type === 'debuff' ? 'Send to Enemy' : 'Send to Ally/Enemy'}
                                provinces={leaderboard}
                                province={province}
                                search={sendSearch[recipe.key] || ''}
                                onSearchChange={v => setSendSearch(prev => ({ ...prev, [recipe.key]: v }))}
                                selectedId={sendTarget[recipe.key] || ''}
                                onSelect={id => setSendTarget(prev => ({ ...prev, [recipe.key]: id }))}
                                onSend={() => sendItem(recipe.key)}
                                busy={busy === `send-${recipe.key}`}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function SendItemPanel({ itemKey, label, provinces, province, search, onSearchChange, selectedId, onSelect, onSend, busy }) {
  const [open, setOpen] = useState(false);

  const filtered = provinces
    .filter(p =>
      p.id !== province?.id &&
      (search === '' ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.username || '').toLowerCase().includes(search.toLowerCase()))
    )
    .slice(0, 8);

  const selected = provinces.find(p => p.id === selectedId);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs w-full py-1 rounded border border-red-700/50 text-red-400 hover:bg-red-900/20 transition-colors"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <input
        type="text"
        placeholder="Search province or player..."
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        className="w-full px-2 py-1 text-xs bg-realm-bg border border-realm-border rounded text-realm-text"
      />
      {filtered.length > 0 && (
        <div className="max-h-28 overflow-y-auto border border-realm-border/50 rounded">
          {filtered.map(p => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`w-full text-left px-2 py-1 text-xs transition-colors ${
                selectedId === p.id
                  ? 'bg-realm-gold/20 text-realm-gold'
                  : 'text-realm-text hover:bg-realm-gold/10'
              }`}
            >
              {p.name} <span className="text-realm-text-muted">({p.username || '[BOT]'})</span>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <div className="text-xs text-realm-text-muted">
          Target: <span className="text-realm-gold">{selected.name}</span>
        </div>
      )}
      <div className="flex gap-1">
        <button
          onClick={onSend}
          disabled={!selectedId || busy}
          className="text-xs flex-1 py-1 rounded border border-red-700/50 text-red-400 hover:bg-red-900/20 disabled:opacity-40 transition-colors"
        >
          {busy ? 'Sending...' : 'Confirm Send'}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-xs px-2 py-1 text-realm-text-muted border border-realm-border rounded hover:text-realm-text"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
