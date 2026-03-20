import { useState, useEffect } from 'react';
import { formatNumber, formatTime } from '../utils/formatters';
import api from '../utils/api';

const TREE_ICONS = { military: '⚔️', economy: '💰', magic: '🔮', espionage: '🗡️' };
const TREE_COLORS = {
  military: { border: 'rgba(248,113,113,0.4)', bg: 'rgba(248,113,113,0.06)', text: 'text-red-400' },
  economy: { border: 'rgba(251,191,36,0.4)', bg: 'rgba(251,191,36,0.06)', text: 'text-yellow-400' },
  magic: { border: 'rgba(96,165,250,0.4)', bg: 'rgba(96,165,250,0.06)', text: 'text-blue-400' },
  espionage: { border: 'rgba(167,139,250,0.4)', bg: 'rgba(167,139,250,0.06)', text: 'text-purple-400' },
};

export default function Gems({ province }) {
  const [data, setData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  usePageTitle('Gems');

  useEffect(() => {
    if (!province) return;
    loadData();
  }, [province?.id]);

  async function loadData() {
    setLoading(true);
    try {
      const [enhRes, balRes] = await Promise.all([
        api.get('/gems/enhancements'),
        api.get('/gems/balance'),
      ]);
      setData(enhRes.data);
      setTransactions(balRes.data.transactions);
    } catch (err) {
      setError('Failed to load gem data');
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlock(id) {
    setActionLoading(id);
    setMessage('');
    setError('');
    try {
      const { data: res } = await api.post('/gems/unlock', { enhancement_id: id });
      setMessage(res.message);
      await loadData();
    } catch (err) {
      setError(getApiError(err, 'Unlock failed'));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUse(id) {
    setActionLoading(id);
    setMessage('');
    setError('');
    try {
      const { data: res } = await api.post('/gems/use', { enhancement_id: id });
      setMessage(res.message);
      await loadData();
    } catch (err) {
      setError(getApiError(err, 'Activation failed'));
    } finally {
      setActionLoading(null);
    }
  }

  if (!province) return null;
  if (loading) return <div className="text-realm-text-muted">Loading gems...</div>;

  const gems = data?.gems ?? 0;
  const enhancements = data?.enhancements ?? [];

  // Group by tree
  const trees = {};
  for (const e of enhancements) {
    if (!trees[e.tree]) trees[e.tree] = [];
    trees[e.tree].push(e);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-display text-realm-gold">Gem Enhancements</h1>
        <div className="realm-panel" style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem' }}>💎</span>
          <span className="text-realm-gold font-bold text-lg">{formatNumber(gems)}</span>
          <span className="text-realm-text-dim text-xs">gems</span>
        </div>
      </div>

      {message && <div className="bg-green-900/30 border border-green-700 text-green-300 px-3 py-2 rounded text-sm">{message}</div>}
      {error && <div className="bg-red-900/30 border border-red-700 text-red-300 px-3 py-2 rounded text-sm">{error}</div>}

      {/* How gems are earned */}
      <div className="realm-panel" style={{ borderLeft: '3px solid rgba(167,139,250,0.5)' }}>
        <h2 className="text-realm-gold font-display text-sm mb-2">How to Earn Gems</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-realm-text-dim">
          <span>⚔️ Win attack: <span className="text-purple-300">3💎</span></span>
          <span>🛡️ Defend attack: <span className="text-purple-300">2💎</span></span>
          <span>🔬 Complete research: <span className="text-purple-300">5💎</span></span>
          <span>🗺️ Land milestone (250): <span className="text-purple-300">10💎</span></span>
        </div>
      </div>

      {/* Enhancement Trees */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Object.entries(trees).map(([treeName, items]) => {
          const tc = TREE_COLORS[treeName];
          const tiers = [1, 2, 3];
          return (
            <div key={treeName} className="realm-panel" style={{ borderTop: `2px solid ${tc.border}` }}>
              <h2 className={`font-display mb-3 ${tc.text}`}>
                {TREE_ICONS[treeName]} {treeName.charAt(0).toUpperCase() + treeName.slice(1)} Tree
              </h2>
              <div className="space-y-2">
                {tiers.map(tier => {
                  const tierItems = items.filter(e => e.tier === tier);
                  if (!tierItems.length) return null;
                  return (
                    <div key={tier}>
                      <div className="text-realm-text-dim text-xs mb-1" style={{ letterSpacing: '0.08em' }}>TIER {tier}</div>
                      <div className="grid grid-cols-1 gap-2">
                        {tierItems.map(e => (
                          <EnhancementCard
                            key={e.id}
                            enhancement={e}
                            gems={gems}
                            tc={tc}
                            loading={actionLoading === e.id}
                            onUnlock={() => handleUnlock(e.id)}
                            onUse={() => handleUse(e.id)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Transaction History */}
      <div className="realm-panel">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-realm-gold font-display text-sm w-full text-left"
        >
          {showHistory ? '▼' : '▶'} Gem History
        </button>
        {showHistory && (
          <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
            {transactions.length === 0 && <p className="text-realm-text-dim text-xs">No transactions yet.</p>}
            {transactions.map((t, i) => (
              <div key={i} className="flex justify-between text-xs py-1 border-b border-realm-border/30">
                <span className="text-realm-text-muted">{t.reason}</span>
                <span className={t.amount > 0 ? 'text-green-400' : 'text-red-400'}>
                  {t.amount > 0 ? '+' : ''}{t.amount}💎
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EnhancementCard({ enhancement: e, gems, tc, loading, onUnlock, onUse }) {
  const effectDesc = describeEffect(e.effect);

  return (
    <div style={{
      background: e.unlocked ? tc.bg : 'rgba(17,24,40,0.5)',
      border: `1px solid ${e.unlocked ? tc.border : 'rgb(36,54,80)'}`,
      borderRadius: '4px',
      padding: '10px 12px',
      opacity: (!e.unlocked && !e.can_unlock) ? 0.5 : 1,
    }}>
      <div className="flex items-start justify-between gap-2">
        <div style={{ flex: 1 }}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-bold text-sm ${e.unlocked ? tc.text : 'text-realm-text-muted'}`}>
              {e.name}
            </span>
            {e.active && (
              <span style={{
                fontSize: '9px', padding: '1px 5px',
                background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)',
                color: 'rgb(74,222,128)', borderRadius: '3px',
              }}>ACTIVE</span>
            )}
            {e.unlocked && !e.active && (
              <span style={{
                fontSize: '9px', padding: '1px 5px',
                background: 'rgba(200,160,72,0.15)', border: '1px solid rgba(200,160,72,0.4)',
                color: 'rgb(200,160,72)', borderRadius: '3px',
              }}>UNLOCKED</span>
            )}
          </div>
          <div className="text-realm-text-dim text-xs">{effectDesc}</div>
          {e.duration_hours && (
            <div className="text-realm-text-dim" style={{ fontSize: '10px' }}>Duration: {e.duration_hours}h</div>
          )}
          {e.active && e.active_expires_at && (
            <div className="text-green-400" style={{ fontSize: '10px' }}>Expires: {formatTime(e.active_expires_at)}</div>
          )}
        </div>
        <div style={{ textAlign: 'right', minWidth: '80px' }}>
          {!e.unlocked && e.can_unlock && (
            <button
              onClick={onUnlock}
              disabled={loading || gems < e.unlock_cost}
              className="realm-btn-gold"
              style={{ fontSize: '10px', padding: '3px 8px', whiteSpace: 'nowrap' }}
            >
              {loading ? '...' : `Unlock ${e.unlock_cost}💎`}
            </button>
          )}
          {e.unlocked && !e.active && (
            <button
              onClick={onUse}
              disabled={loading || gems < e.use_cost}
              className="realm-btn-outline"
              style={{ fontSize: '10px', padding: '3px 8px', whiteSpace: 'nowrap' }}
            >
              {loading ? '...' : `Use ${e.use_cost}💎`}
            </button>
          )}
          {!e.unlocked && !e.can_unlock && (
            <span className="text-realm-text-dim" style={{ fontSize: '10px' }}>Locked</span>
          )}
        </div>
      </div>
    </div>
  );
}

function describeEffect(effect) {
  if (!effect) return '';
  const { type, value } = effect;
  switch (type) {
    case 'offense_multiplier': return `+${Math.round((value - 1) * 100)}% offense for next attack`;
    case 'defense_multiplier': return `+${Math.round((value - 1) * 100)}% defense`;
    case 'combat_multiplier': return `+${Math.round((value - 1) * 100)}% offense AND defense`;
    case 'training_time_reduction': return `-${Math.round(value * 100)}% troop training time`;
    case 'casualty_reduction': return `-${Math.round(value * 100)}% casualties on next attack`;
    case 'gold_income_multiplier': return `+${Math.round((value - 1) * 100)}% gold income`;
    case 'food_production_multiplier': return `+${Math.round((value - 1) * 100)}% food production`;
    case 'build_time_reduction': return `-${Math.round(value * 100)}% building construction time`;
    case 'all_production_multiplier': return `+${Math.round((value - 1) * 100)}% all resource production`;
    case 'all_income_multiplier': return `+${Math.round((value - 1) * 100)}% all income`;
    case 'mana_regen_multiplier': return `${value}x mana regeneration`;
    case 'negate_incoming_spell': return 'Negate next incoming offensive spell';
    case 'spell_power_multiplier': return `+${Math.round((value - 1) * 100)}% spell power`;
    case 'auto_counter_spell': return `${Math.round(effect.chance * 100)}% auto-counter incoming spells`;
    case 'mana_cost_reduction': return `-${Math.round(value * 100)}% mana cost on all spells`;
    case 'spy_detection_reduction': return `-${Math.round(value * 100)}% spy detection chance`;
    case 'spy_detection_boost': return `+${Math.round(value * 100)}% spy detection`;
    case 'guaranteed_spy_success': return 'Next spy mission guaranteed success';
    case 'intercept_spy_intel': return 'Intercept info on next spy op against you';
    case 'spy_effectiveness_multiplier': return `${value}x spy effectiveness`;
    default: return JSON.stringify(effect);
  }
}
