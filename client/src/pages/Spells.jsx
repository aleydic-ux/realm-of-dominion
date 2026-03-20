import { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatNumber } from '../utils/formatters';

const CATEGORY_LABELS = { scout: 'Scouting Spells', buff: 'Buff Spells', attack: 'Attack Spells' };
const CATEGORY_ICONS = { scout: '🔭', buff: '✨', attack: '⚡' };
const TIER_COLORS = {
  1: 'text-gray-400 border-gray-600',
  2: 'text-blue-400 border-blue-600',
  3: 'text-purple-400 border-purple-600',
};

export default function Spells({ province, buildings }) {
  const [spells, setSpells] = useState([]);
  const [cooldowns, setCooldowns] = useState({});
  const [activeEffects, setActiveEffects] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [casting, setCasting] = useState(null);
  const [results, setResults] = useState({});
  const [errors, setErrors] = useState({});

  const sanctumLevel = buildings?.find(b => b.building_type === 'arcane_sanctum')?.level ?? 0;

  usePageTitle('Arcane Sanctum');

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) { setLoadError(true); setLoading(false); }
    }, 12000);
    async function load() {
      try {
        const [spellsRes, lbRes] = await Promise.all([
          api.get('/spells'),
          api.get('/leaderboard'),
        ]);
        if (!cancelled) {
          setSpells(spellsRes.data.spells || []);
          setCooldowns(spellsRes.data.cooldowns || {});
          setActiveEffects(spellsRes.data.active_effects || []);
          setProvinces(lbRes.data.overall || []);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
      if (!cancelled) setLoading(false);
      clearTimeout(timeout);
    }
    load();
    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);

  async function castSpell(spellKey, targetProvinceId = null) {
    setCasting(spellKey);
    setErrors(prev => ({ ...prev, [spellKey]: null }));
    try {
      const body = { spell_key: spellKey };
      if (targetProvinceId) body.target_province_id = parseInt(targetProvinceId);
      const res = await api.post('/spells/cast', body);
      setCooldowns(prev => ({ ...prev, [spellKey]: res.data.cooldown_ends_at }));
      setResults(prev => ({ ...prev, [spellKey]: res.data }));
    } catch (err) {
      setErrors(prev => ({ ...prev, [spellKey]: getApiError(err, 'Cast failed') }));
    }
    setCasting(null);
  }

  const isCoolingDown = key => {
    const cd = cooldowns[key];
    return cd && new Date(cd) > new Date();
  };

  const cdRemaining = key => {
    const cd = cooldowns[key];
    if (!cd) return null;
    const ms = new Date(cd) - new Date();
    if (ms <= 0) return null;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (loading) return <div className="text-realm-text-muted">Loading spells...</div>;
  if (loadError) return (
    <div className="space-y-3 text-center py-8">
      <p className="text-realm-text-muted">Failed to load. The server may be starting up.</p>
      <button onClick={() => window.location.reload()} className="realm-btn-gold">Retry</button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-display text-realm-gold">Arcane Sanctum</h1>
        <div className="text-sm text-realm-text-muted">
          Sanctum Level:{' '}
          <span className={sanctumLevel > 0 ? 'text-purple-400 font-bold' : 'text-red-400'}>
            {sanctumLevel}
          </span>
          {' · '}
          Mana:{' '}
          <span className="text-blue-400 font-bold">{formatNumber(Math.floor(province?.mana || 0))}</span>
        </div>
      </div>

      {sanctumLevel === 0 && (
        <div className="realm-panel border border-purple-800/50 bg-purple-900/10 text-center py-8 space-y-2">
          <p className="text-purple-400 text-xl">✦ Arcane Sanctum Not Built ✦</p>
          <p className="text-realm-text-muted text-sm">
            Build an Arcane Sanctum in the Buildings tab to unlock the arcane arts.
          </p>
          <p className="text-realm-text-muted text-xs">
            Level 1 → Tier 1 spells · Level 3 → Tier 2 spells · Level 5 → Tier 3 spells
          </p>
        </div>
      )}

      {activeEffects.length > 0 && (
        <div className="realm-panel space-y-2">
          <h2 className="text-xs font-bold text-realm-text-dim uppercase tracking-widest">Active Effects</h2>
          <div className="space-y-1">
            {activeEffects.map(ef => {
              const spell = spells.find(s => s.key === ef.spell_key);
              const ms = new Date(ef.expires_at) - new Date();
              const h = Math.floor(ms / 3600000);
              const m = Math.floor((ms % 3600000) / 60000);
              const remainStr = ms > 0 ? (h > 0 ? `${h}h ${m}m` : `${m}m`) : 'Expiring';
              const isDebuff = ef.category === 'debuff';
              return (
                <div
                  key={ef.id}
                  className={`flex items-center justify-between text-xs px-2 py-1 rounded ${
                    isDebuff
                      ? 'bg-red-900/20 border border-red-800/30'
                      : 'bg-blue-900/20 border border-blue-800/30'
                  }`}
                >
                  <span className={isDebuff ? 'text-red-400' : 'text-blue-300'}>
                    {isDebuff ? '↓ ' : '↑ '}{spell?.name || ef.spell_key}
                  </span>
                  <span className="text-realm-text-muted">{remainStr} remaining</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {['scout', 'buff', 'attack'].map(cat => {
        const catSpells = spells.filter(s => s.category === cat);
        return (
          <div key={cat} className="space-y-3">
            <h2 className="text-realm-gold font-display border-b border-realm-border pb-1">
              {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {catSpells.map(spell => (
                <SpellCard
                  key={spell.key}
                  spell={spell}
                  locked={sanctumLevel < spell.requires_arcane_sanctum}
                  onCooldown={isCoolingDown(spell.key)}
                  cdRemaining={cdRemaining(spell.key)}
                  result={results[spell.key]}
                  error={errors[spell.key]}
                  isCasting={casting === spell.key}
                  province={province}
                  provinces={provinces}
                  onCast={castSpell}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SpellCard({ spell, locked, onCooldown, cdRemaining, result, error, isCasting, province, provinces, onCast }) {
  const [showTarget, setShowTarget] = useState(false);
  const [localTarget, setLocalTarget] = useState('');
  const [search, setSearch] = useState('');

  const notEnoughMana = province && province.mana < spell.mana_cost;
  const notEnoughAp = province && spell.ap_cost > 0 && province.action_points < spell.ap_cost;
  const canCast = !locked && !onCooldown && !isCasting && !notEnoughMana && !notEnoughAp;

  const filtered = provinces
    .filter(p =>
      p.id !== province?.id &&
      (search === '' ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.username || '').toLowerCase().includes(search.toLowerCase()))
    )
    .slice(0, 8);

  return (
    <div className={`realm-panel flex flex-col gap-2 ${locked ? 'opacity-55' : ''}`}>
      <div className="flex items-start justify-between gap-1">
        <h3 className="text-realm-gold font-display text-sm">{spell.name}</h3>
        <span className={`text-xs border rounded px-1 shrink-0 ${TIER_COLORS[spell.tier]}`}>
          T{spell.tier}
        </span>
      </div>

      <p className="text-realm-text-muted text-xs">{spell.description}</p>

      <div className="text-xs space-y-0.5 border-t border-realm-border/50 pt-2">
        <div className="flex justify-between">
          <span className="text-realm-text-dim">Cost:</span>
          <span>
            <span className={notEnoughMana ? 'text-red-400' : 'text-blue-400'}>
              {spell.mana_cost} mana
            </span>
            {spell.ap_cost > 0 && (
              <span className={notEnoughAp ? 'text-red-400' : 'text-green-400'}>
                {' '}+ {spell.ap_cost} AP
              </span>
            )}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-realm-text-dim">Cooldown:</span>
          <span className="text-realm-text-muted">{spell.cooldown_hours}h</span>
        </div>
        {spell.duration_hours > 0 && (
          <div className="flex justify-between">
            <span className="text-realm-text-dim">Duration:</span>
            <span className="text-realm-text-muted">{spell.duration_hours}h</span>
          </div>
        )}
        {locked && (
          <div className="text-red-400 text-xs pt-0.5">
            🔒 Requires Arcane Sanctum L{spell.requires_arcane_sanctum}
          </div>
        )}
      </div>

      {onCooldown && (
        <div className="text-yellow-400 text-xs">⏳ On cooldown — {cdRemaining} remaining</div>
      )}

      {error && <div className="text-red-400 text-xs">{error}</div>}

      {result && !error && (
        <div className="text-green-400 text-xs bg-green-900/20 border border-green-800/30 rounded p-1.5 space-y-1">
          <div>{result.message}</div>
          {result.scouted && <ScoutResult data={result.scouted} />}
        </div>
      )}

      {/* Cast button area */}
      {!locked && !onCooldown && spell.targeted && !showTarget && (
        <button
          onClick={() => setShowTarget(true)}
          disabled={notEnoughMana || notEnoughAp}
          className="realm-btn-gold text-xs w-full mt-auto"
        >
          {notEnoughMana ? 'Not enough mana' : notEnoughAp ? 'Not enough AP' : 'Select Target & Cast'}
        </button>
      )}

      {!locked && !onCooldown && spell.targeted && showTarget && (
        <div className="space-y-1 mt-auto">
          <input
            type="text"
            placeholder="Search province or player..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-2 py-1 text-xs bg-realm-bg border border-realm-border rounded text-realm-text"
          />
          {filtered.length > 0 && (
            <div className="max-h-28 overflow-y-auto border border-realm-border/50 rounded">
              {filtered.map(p => (
                <button
                  key={p.id}
                  onClick={() => setLocalTarget(p.id)}
                  className={`w-full text-left px-2 py-1 text-xs transition-colors ${
                    localTarget === p.id
                      ? 'bg-realm-gold/20 text-realm-gold'
                      : 'text-realm-text hover:bg-realm-gold/10'
                  }`}
                >
                  {p.name}{' '}
                  <span className="text-realm-text-muted">({p.username})</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-1">
            <button
              onClick={async () => {
                await onCast(spell.key, localTarget);
                setShowTarget(false);
                setLocalTarget('');
                setSearch('');
              }}
              disabled={!localTarget || isCasting}
              className="realm-btn-gold text-xs flex-1"
            >
              {isCasting ? 'Casting...' : 'Cast'}
            </button>
            <button
              onClick={() => { setShowTarget(false); setLocalTarget(''); setSearch(''); }}
              className="text-xs px-2 py-1 text-realm-text-muted border border-realm-border rounded hover:text-realm-text"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!locked && !onCooldown && !spell.targeted && (
        <button
          onClick={() => onCast(spell.key)}
          disabled={isCasting || notEnoughMana || notEnoughAp}
          className="realm-btn-gold text-xs w-full mt-auto"
        >
          {isCasting
            ? 'Casting...'
            : notEnoughMana
            ? 'Not enough mana'
            : notEnoughAp
            ? 'Not enough AP'
            : 'Cast'}
        </button>
      )}
    </div>
  );
}

function ScoutResult({ data }) {
  if (!data) return null;
  return (
    <div className="space-y-0.5 border-t border-green-800/30 pt-1 mt-1">
      <div>
        Province: <span className="text-realm-gold">{data.name}</span>{' '}
        <span className="text-realm-text-muted">({data.race})</span>
        {data.alliance_name && (
          <span className="text-purple-400"> [{data.alliance_name}]</span>
        )}
      </div>
      {data.land !== undefined && (
        <div>Land: {formatNumber(data.land)} acres · Networth: {formatNumber(data.networth || 0)}g</div>
      )}
      {data.gold !== undefined && (
        <div>Gold: {formatNumber(data.gold)} · Food: {formatNumber(data.food)} · Mana: {formatNumber(data.mana)}</div>
      )}
      {data.morale !== undefined && <div>Morale: {data.morale}%</div>}
      {data.troops && data.troops.length > 0 && (
        <div>
          <div className="font-bold text-realm-text mt-0.5">Troops:</div>
          {data.troops.map((t, i) => (
            <div key={i} className="text-realm-text-muted">
              {t.name}: {t.count_home} at home, {t.count_deployed} deployed
            </div>
          ))}
        </div>
      )}
      {data.buildings && data.buildings.length > 0 && (
        <div>
          <div className="font-bold text-realm-text mt-0.5">Buildings:</div>
          {data.buildings.map((b, i) => (
            <div key={i} className="text-realm-text-muted">
              {b.building_type}: L{b.level}
            </div>
          ))}
        </div>
      )}
      {data.research && data.research.length > 0 && (
        <div>
          <div className="font-bold text-realm-text mt-0.5">Researched:</div>
          <div className="text-realm-text-muted">{data.research.map(r => r.name).join(', ')}</div>
        </div>
      )}
    </div>
  );
}
