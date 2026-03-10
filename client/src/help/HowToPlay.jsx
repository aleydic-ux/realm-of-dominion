import { useState, useEffect } from 'react';

const TABS = ['Getting Started', 'Resources', 'Combat', 'Buildings & Research', 'Tips & Strategy', 'Patch Notes'];

const TAB_CONTENT = [
  // Tab 0 — Getting Started
  () => (
    <div className="space-y-4 text-sm text-realm-text">
      <p className="text-realm-text-muted">
        <strong className="text-realm-gold">Realm of Dominion</strong> is a real-time kingdom management game.
        Build a province, train armies, research technologies, cast spells, and compete on the leaderboard.
      </p>

      <div className="realm-panel space-y-2">
        <h3 className="text-realm-gold font-bold">Action Points (AP)</h3>
        <p className="text-realm-text-muted text-xs">
          AP is your core resource. Max 20. Regenerates <strong>1 AP every 30 minutes</strong>.
          Almost every action costs 1–5 AP. Never sit at 20/20 — you waste regen!
        </p>
      </div>

      <div className="realm-panel space-y-2">
        <h3 className="text-realm-gold font-bold">Your First Steps</h3>
        <ol className="text-realm-text-muted text-xs space-y-1 list-decimal list-inside">
          <li><strong>Explore Territory</strong> on the Province tab — spend 1 AP to gain 5–25 acres of land.</li>
          <li><strong>Train troops</strong> in the Military tab — you need an army to attack and defend.</li>
          <li><strong>Upgrade buildings</strong> to boost resource income and unlock new abilities.</li>
          <li><strong>Research tech</strong> — the Library tab unlocks powerful permanent bonuses.</li>
          <li><strong>Launch an attack</strong> — raid enemies for gold and conquer their land.</li>
        </ol>
      </div>

      <div className="realm-panel space-y-2">
        <h3 className="text-realm-gold font-bold">Ages</h3>
        <p className="text-realm-text-muted text-xs">
          The current <strong>Age of Iron</strong> lasts approximately 7 days.
          When it ends, scores are recorded to the Hall of Fame, all provinces reset, and a new Age begins.
          The leaderboard ranking at the end of the Age determines your legacy.
        </p>
      </div>

      <div className="realm-panel space-y-2">
        <h3 className="text-realm-gold font-bold">Your Race</h3>
        <p className="text-realm-text-muted text-xs">
          You chose a race at creation. Each race has a unique building, unique troops, and a unique research tree.
          Lean into your race's strengths — Elves excel at magic, Orcs dominate in combat, Dwarves outlast sieges.
        </p>
      </div>
    </div>
  ),

  // Tab 1 — Resources
  () => (
    <div className="space-y-3 text-sm">
      {[
        { icon: '💰', name: 'Gold', color: '#c8a048', earn: 'Population income, Treasury building, trade, Human bonus', spend: 'Training troops, buildings, research, crafting' },
        { icon: '🌾', name: 'Food', color: '#2a8a48', earn: 'Farm building, Crop Rotation research, Harvest Tonic potion, land', spend: 'Consumed by troops every hour. If food hits 0, morale drops.' },
        { icon: '🔮', name: 'Mana', color: '#8830cc', earn: 'Arcane Sanctum (+5%/lvl), Temple/Altar (+10%/lvl), Ancient Grove (Elf), land, Ley Lines spell', spend: 'Casting spells, crafting potions' },
        { icon: '⚙️', name: 'Industry', color: '#c8d8e8', earn: 'Mine/Quarry (+8%/lvl), Industry Surge potion', spend: 'Building upgrades (alongside Gold), crafting' },
        { icon: '🗺️', name: 'Land', color: '#c8d8e8', earn: 'Explore Territory (1 AP = 5–25 ac), Conquest attacks', spend: 'Sets population cap; more land = more income and production' },
        { icon: '👥', name: 'Population', color: '#c8d8e8', earn: 'Grows automatically from land + morale', spend: 'Contributes to gold income. Population Boom research speeds growth.' },
        { icon: '❤️', name: 'Morale', color: '#cc4444', earn: 'Stays at 100% normally. Temple/Altar speeds recovery.', spend: 'Drops from food shortage or heavy battle losses. Affects income.' },
      ].map(r => (
        <div key={r.name} className="realm-panel flex gap-3">
          <span className="text-2xl">{r.icon}</span>
          <div>
            <div className="font-bold text-xs" style={{color: r.color}}>{r.name}</div>
            <div className="text-xs text-realm-text-muted"><span className="text-green-400">↑ Earn:</span> {r.earn}</div>
            <div className="text-xs text-realm-text-muted"><span className="text-red-400">↓ Spend:</span> {r.spend}</div>
          </div>
        </div>
      ))}
    </div>
  ),

  // Tab 2 — Combat
  () => (
    <div className="space-y-4 text-sm">
      <div className="realm-panel space-y-2">
        <h3 className="text-realm-gold font-bold">4 Attack Types</h3>
        <div className="space-y-2 text-xs text-realm-text-muted">
          {[
            { name: 'Raid', desc: 'Steal 5–15% of enemy gold/food/mana. No land gained. Lowest casualties. Best for farming inactive provinces.' },
            { name: 'Conquest', desc: 'Capture 10–30% of enemy land (based on power ratio). Medium casualties on both sides.' },
            { name: 'Raze', desc: 'Destroy enemy buildings. Very high casualties. Best for crippling a dangerous rival.' },
            { name: 'Massacre', desc: 'Kill enemy population to reduce their long-term income. Extreme casualties.' },
          ].map(t => (
            <div key={t.name} className="border-l-2 border-realm-gold/40 pl-2">
              <strong className="text-realm-text">{t.name}</strong> — {t.desc}
            </div>
          ))}
        </div>
        <p className="text-xs text-realm-text-muted mt-1">All attacks cost <strong className="text-realm-gold">5 AP</strong>.</p>
      </div>

      <div className="realm-panel space-y-2">
        <h3 className="text-realm-gold font-bold">How Combat Resolves</h3>
        <p className="text-xs text-realm-text-muted">
          <strong>Attack Power</strong> = sum of (troops deployed × ATK) × race modifier × morale modifier × tech/spell bonuses<br/>
          <strong>Defense Power</strong> = sum of (home troops × DEF) × wall bonus × watchtower bonus × morale modifier
        </p>
        <div className="grid grid-cols-3 gap-2 text-xs text-center mt-1">
          {[
            { result: 'WIN', cond: 'ATK > DEF', atk: '5–15% casualties', def: '15–30% casualties' },
            { result: 'DRAW', cond: 'Close match', atk: '15–25%', def: '10–20%' },
            { result: 'LOSS', cond: 'ATK < DEF×0.75', atk: '25–40%', def: '5–15%' },
          ].map(r => (
            <div key={r.result} className="realm-panel text-xs space-y-0.5">
              <div className={r.result === 'WIN' ? 'text-green-400 font-bold' : r.result === 'LOSS' ? 'text-red-400 font-bold' : 'text-yellow-400 font-bold'}>{r.result}</div>
              <div className="text-realm-text-muted">{r.cond}</div>
              <div className="text-orange-400">Attacker: {r.atk}</div>
              <div className="text-blue-400">Defender: {r.def}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="realm-panel space-y-2">
        <h3 className="text-realm-gold font-bold">Raid Notifications</h3>
        <p className="text-xs text-realm-text-muted">
          When another player or bot attacks your province, you'll receive a <strong className="text-realm-text">real-time toast alert</strong> in the top-right corner of the screen.
          Alerts are color-coded: <span className="text-red-400">red</span> if the attacker won, <span className="text-green-400">green</span> if you successfully defended, <span className="text-yellow-400">yellow</span> for a draw.
        </p>
        <p className="text-xs text-realm-text-muted">
          The <strong className="text-realm-text">notification bell</strong> in the top bar tracks all alerts.
          A red badge shows unread notifications. Click the bell to see your notification history and mark them as read.
        </p>
      </div>

      <div className="realm-panel space-y-2">
        <h3 className="text-realm-gold font-bold">Combat Reports</h3>
        <p className="text-xs text-realm-text-muted">
          Every attack — sent or received — generates a detailed <strong className="text-realm-text">battle report</strong> on the Reports page.
          Filter by <strong>All</strong>, <strong>Sent</strong>, or <strong>Received</strong> to find specific battles.
        </p>
        <p className="text-xs text-realm-text-muted">
          Click any report to see the full breakdown: combatant info, a power comparison bar, battle narrative,
          resources plundered or lost, casualty details for both sides, and troop return timers.
          Outcomes are displayed from <strong className="text-realm-text">your perspective</strong> — green for your victories, red for defeats.
        </p>
      </div>

      <div className="realm-panel space-y-2">
        <h3 className="text-realm-gold font-bold">Race Comparison</h3>
        <div className="overflow-x-auto">
          <table className="realm-table text-xs w-full">
            <thead>
              <tr><th>Race</th><th>Strength</th><th>Unique Building</th><th>Special</th></tr>
            </thead>
            <tbody>
              {[
                { race: '👑 Human', str: '+20% gold, -10% build cost, +20% trade', bld: 'Royal Bank', sp: 'Best economy & traders' },
                { race: '💀 Orc', str: '+25% ATK, +15% train speed', bld: 'Warchief Pit', sp: 'Berserker double-attacks (but dies defending)' },
                { race: '☠️ Undead', str: '0 food upkeep, 2× return speed', bld: 'Crypt', sp: 'Troops never eat; can\'t use marketplace' },
                { race: '🌿 Elf', str: '+30% mana, +15% land yield, +20% research', bld: 'Ancient Grove', sp: 'Magic specialists, best arcane power' },
                { race: '⚒️ Dwarf', str: '-25% build cost, -25% siege damage', bld: 'Runic Forge', sp: 'Tunnel Rat bypasses walls; slowest army return' },
              ].map(r => (
                <tr key={r.race}>
                  <td className="font-bold">{r.race}</td>
                  <td className="text-realm-text-muted">{r.str}</td>
                  <td className="text-realm-text-muted">{r.bld}</td>
                  <td className="text-realm-text-muted">{r.sp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  ),

  // Tab 3 — Buildings & Research
  () => (
    <div className="space-y-4 text-sm">
      <div className="realm-panel space-y-2">
        <h3 className="text-realm-gold font-bold">Key Buildings</h3>
        <div className="space-y-1 text-xs text-realm-text-muted">
          {[
            { name: 'Arcane Sanctum', desc: 'Unlocks spells at L1/L3/L5. +5% mana regen/lvl. Essential for magic builds.' },
            { name: 'War Hall', desc: 'Unlocks T4 troops at L3, T5 at L5. +5% troop ATK/lvl. Required for end-game.' },
            { name: 'Barracks', desc: '-10% training time/lvl. +5% troop cap/lvl.' },
            { name: 'Mine/Quarry', desc: '+8% Industry Points/lvl. Needed for all building upgrades.' },
            { name: 'Walls', desc: '+15% defense/lvl. Best value for passive defense.' },
            { name: 'Library', desc: '-10% research time/lvl. Prioritize early if rushing techs.' },
            { name: 'Farm', desc: '+5% food production/lvl. Critical for large armies.' },
            { name: 'Temple/Altar', desc: '+10% mana regen/lvl. +5% morale recovery/lvl.' },
            { name: 'Treasury', desc: '+8% gold cap/lvl. +4% gold income/lvl.' },
          ].map(b => (
            <div key={b.name} className="border-l-2 border-realm-gold/40 pl-2">
              <strong className="text-realm-text">{b.name}</strong> — {b.desc}
            </div>
          ))}
        </div>
      </div>

      <div className="realm-panel space-y-2">
        <h3 className="text-realm-gold font-bold">Research</h3>
        <p className="text-xs text-realm-text-muted">
          Research costs Gold + 1 AP and takes time to complete. Library building reduces research time.
          <br/>Tier 2 requires a completed Tier 1 prerequisite. Tier 3 requires Tier 2.
        </p>
        <div className="text-xs text-realm-text-muted space-y-1 mt-1">
          <div><strong className="text-realm-text">Universal:</strong> Iron Working, Crop Rotation, Cartography, Siege Doctrine, Fortification, Advanced Metallurgy, Grand Fortification</div>
          <div><strong className="text-realm-text">Race-specific</strong> techs unlock powerful bonuses unique to your race — check the Research tab.</div>
        </div>
      </div>
    </div>
  ),

  // Tab 4 — Tips & Strategy
  () => (
    <div className="space-y-3 text-sm">
      {[
        { icon: '⚡', tip: 'Never sit at 20/20 AP', detail: 'Once full, regen stops. Spend AP before logging off — explore, attack, or queue research.' },
        { icon: '🌾', tip: 'Watch your Food/hr', detail: 'In the Military tab, your troops consume food every hour. If food hits 0, morale drops and income suffers. Build Farms or reduce troop count.' },
        { icon: '🔮', tip: 'Elves: go full mana', detail: 'Arcane Sanctum + Ancient Grove + Temple/Altar stacks massive mana regen. Your Archmage units and Arcane Mastery research make you the strongest spellcaster.' },
        { icon: '⚒️', tip: 'Dwarves: abuse cheap buildings', detail: '-25% building cost means you can max buildings faster than anyone. Walls + Watchtower make you nearly unassailable. Runic Warriors scale with Forge level.' },
        { icon: '🧪', tip: 'Craft before big attacks', detail: 'Queue a War Elixir (+25% ATK) or Berserker Brew (+50% ATK) in the Alchemist Tower before launching a Conquest. Also consider Plague Vials on rich targets.' },
        { icon: '🏪', tip: 'Check the Marketplace', detail: 'If you\'re low on Food or Mana, check if players are selling. You can also sell excess resources to fund troop training.' },
        { icon: '🛡️', tip: 'Build Arcane Sanctum early', detail: 'Even 1 level unlocks Clairvoyance (scout enemies) and Mana Shield (+15% DEF). The earlier you cast, the more intel you have.' },
        { icon: '⚔️', tip: 'New player protection', detail: 'Provinces under 48 hours old cannot be attacked by bots. Use this window to build, explore, and prepare your defenses.' },
        { icon: '🔔', tip: 'Check your notifications', detail: 'The bell icon shows incoming raids in real-time. Review the Reports page after being attacked to understand what you lost and adjust your defenses.' },
      ].map(t => (
        <div key={t.tip} className="realm-panel flex gap-3">
          <span className="text-xl shrink-0">{t.icon}</span>
          <div>
            <div className="font-bold text-xs text-realm-gold">{t.tip}</div>
            <div className="text-xs text-realm-text-muted">{t.detail}</div>
          </div>
        </div>
      ))}
    </div>
  ),

  // Tab 5 — Patch Notes
  () => (
    <div className="space-y-4 text-sm">
      {[
        {
          version: 'v0.6',
          date: 'Mar 10, 2026',
          title: 'Raid Notifications & Combat Reports',
          changes: [
            'Real-time toast alerts when your province is attacked',
            'Notification bell with unread badge and history dropdown',
            'Enhanced combat reports with power comparison bars, battle narratives, and casualty breakdowns',
            'Reports now show outcomes from your perspective (victory/defeat)',
            'Updated How to Play guide with new feature documentation',
          ],
        },
        {
          version: 'v0.5',
          date: 'Mar 9, 2026',
          title: 'Bot Trading & Stability',
          changes: [
            'Bots now list surplus resources on the marketplace',
            'Bots buy bargain-priced listings from the market',
            'Improved error handling and province recovery',
            'Fixed age system column naming bug that caused site-wide crash',
          ],
        },
        {
          version: 'v0.4',
          date: 'Mar 2026',
          title: 'Gems & Alchemy',
          changes: [
            'Gem socket system — find, equip, and upgrade gems for province buffs',
            'Alchemy crafting — brew potions at the Alchemist Tower for combat and resource boosts',
            'New Alchemist Tower building',
          ],
        },
        {
          version: 'v0.3',
          date: 'Mar 2026',
          title: 'Alliances & World Feed',
          changes: [
            'Alliance system — create or join alliances, shared chat, and member management',
            'World Feed — global event log of attacks, conquests, and major events',
            'Leaderboard with province and alliance rankings',
          ],
        },
        {
          version: 'v0.2',
          date: 'Mar 2026',
          title: 'Spells & Marketplace',
          changes: [
            'Magic system with race-specific and universal spells',
            'Arcane Sanctum building unlocks spell tiers',
            'Player-to-player marketplace for trading resources',
            'Bot provinces that explore, build, and attack autonomously',
          ],
        },
        {
          version: 'v0.1',
          date: 'Mar 2026',
          title: 'Launch',
          changes: [
            'Province creation with 5 races: Human, Orc, Undead, Elf, Dwarf',
            'Building and research systems with race-specific tech trees',
            'Military training with 5 troop tiers per race',
            'Combat system with 4 attack types: Raid, Conquest, Raze, Massacre',
            'Resource engine with hourly income ticks',
            'Age/season system with periodic resets',
          ],
        },
      ].map(patch => (
        <div key={patch.version} className="realm-panel space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-realm-gold font-bold">{patch.version} — {patch.title}</h3>
            <span className="text-realm-text-dim text-xs">{patch.date}</span>
          </div>
          <ul className="text-xs text-realm-text-muted space-y-1 list-disc list-inside">
            {patch.changes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  ),
];

export default function HowToPlay({ isOpen, onClose }) {
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const Content = TAB_CONTENT[tab];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="realm-panel border border-realm-gold/40 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-realm-border">
          <h2 className="font-display text-realm-gold text-lg">How to Play</h2>
          <button
            onClick={onClose}
            className="text-realm-text-muted hover:text-realm-text text-xl leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-realm-border overflow-x-auto">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`px-3 py-2 text-xs whitespace-nowrap transition-colors ${
                tab === i
                  ? 'text-realm-gold border-b-2 border-realm-gold font-bold bg-realm-gold/5'
                  : 'text-realm-text-muted hover:text-realm-text'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <Content />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-realm-border text-xs text-realm-text-muted">
          <span>Press <kbd className="border border-realm-border rounded px-1">?</kbd> to open anytime</span>
          <div className="flex gap-2">
            {tab > 0 && (
              <button onClick={() => setTab(t => t - 1)} className="realm-btn-outline text-xs py-1 px-3">← Prev</button>
            )}
            {tab < TABS.length - 1 && (
              <button onClick={() => setTab(t => t + 1)} className="realm-btn-gold text-xs py-1 px-3">Next →</button>
            )}
            {tab === TABS.length - 1 && (
              <button onClick={onClose} className="realm-btn-gold text-xs py-1 px-3">Got it!</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
