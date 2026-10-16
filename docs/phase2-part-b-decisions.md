# Phase 2 Part B: design decisions

These are the picks for each Part B item, made from the spec, from the code, and from how
long-running games of this kind (OpenDominion, Utopia) handle the same problems. Each item
says what was picked, why, and the exact numbers, so they can be tuned later.

Reference points: OpenDominion runs ~47-day rounds with 1-hour ticks. Military takes 9–12
hours to train there, construction takes 12 hours, protection lasts 72 ticks, and late joiners
get a flat per-day bonus of resources and units. Our seasons are 11 days, so time-based numbers
are scaled down to a similar share of a season.

## B1. Training queues: **batches with fixed per-tier times, queued**

- A batch takes the same time no matter its size, set by the unit's tier:
  **T1 1h, T2 2h, T3 3h, T4 4h, T5 5h.** Barracks (+10%/level), race training speed and
  research divide these times, as before.
- Each order is its own queue entry with its own timer. You can queue several batches of the
  same unit; the limit is 10 batches in training at once.
- Why fixed per batch rather than per unit: per-unit minutes multiplied by quantity make big
  armies take days (1,000 basics at 5 min each would take 3.5 days). A fixed batch time
  (OpenDominion's model) keeps gold as the limit on army size, while losses still take hours
  to replace. That's what makes attrition warfare matter. 1–5 hours is about 0.4–2% of an
  11-day season, in line with OpenDominion's 9–12 hours over 47 days.

## B2. Building curve: **8 levels, steeper costs past level 5**

- Max level goes from 5 to 8, except the War Hall, which stays at 5 (it only unlocks troops).
- Cost per level is ×1.8 up to level 5 (unchanged), then ×2.5 per level. Level 8 costs about
  164× the base, and taking one building from 6 to 8 costs about 256× base. With 12+
  buildings, that's a season-long gold sink.
- Build time keeps its ×3-per-level curve: L6 ≈ 1.4h, L7 ≈ 4h, L8 ≈ 12h.
- The Library's build-time reduction is capped at −50% (level 5). Without the cap, level 8
  would make construction nearly instant.
- Fixed with this: a building's bonus used to apply as soon as its upgrade *started*. It now
  applies when the upgrade finishes.
- Why not the L6 specialization paths: those would need two new effects for each of 20+
  building types. Extending a curve that already works is a smaller, safer change.

## B3. Tidewarden: **+10% gold, drop the food bonus, drop the marketplace bonus**

- Gold +20% → **+10%**. Food +20% → **none**. Marketplace +10% → **none**.
- Kept: phantom attack, +10% attacker casualties, +10% mana, and the Tidal Basin.
- Why drop the marketplace bonus rather than the casualty bonus: the marketplace bonus is what
  made Tidewarden a better Human (Humans have +20% gold, −10% build cost and +20% market).
  Without it, Tidewarden is a sea raider and defender (phantom attack, costly to attack)
  instead of a stronger trader.

## B4. Tech trees for the four new races: **7 techs each, same shape as the originals**

Every tech is fully implemented (no flavor-only text). Tiers and costs mirror the original five
races: tier 1 ~1,000 gold / 6h, tier 2 ~2,500 / 12–14h, tier 3 ~5,000 / 20–24h.

| Race | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Serpathi | Venom Glands (Venom Strikers +20% ATK); Shadow Craft (+10% spy success) | Serpent Scales (Thornblades +20% DEF); Silent Approach (−20% spy detection); Coiled Reserves (+10% DEF) | Hydra Brood (Serpent Hydras +20% ATK); Toxin Mastery (wins drain −5 extra enemy morale) |
| Ironveil | Steam Boilers (+20% industry); Reinforced Plating (Clockwork Knights +20% DEF) | Siege Engineering (Siege Automatons +25% ATK); Assembly Lines (−20% building cost and time); Gear Discipline (+10% ATK) | Colossus Forge (War Colossus +20% ATK and DEF); Bastion Protocol (+15% DEF) |
| Ashborn | Kindling (+15% raid loot); Ember Training (Ember Raiders +20% ATK) | Wildfire (wins burn 5% enemy food); Fire Walk (Flame Wardens +25% DEF); Smoldering Rage (+1% fury per stack) | Cinder Legion (Cinderborn +25% ATK); Inferno (Infernal Drakes +20% ATK and DEF) |
| Tidewarden | Undertow (Tide Watchers +25% DEF); Pearl Divers (+15% food) | Riptide (Current Dancers +20% ATK and DEF); Harbor Walls (+20% wall effectiveness); Merchant Fleet (+15% marketplace sales) | Leviathan Bulwark (Leviathan Guard +20% DEF); Kraken's Call (Kraken Lords +20% ATK) |

## B5. Late-join catch-up: **no cutoff; bonus and protection scale with days late**

- The bonus used to stop after day 4. Now it applies to any late join:
  per-day amounts × days late × (1 + 15% for each day past day 5).
  Per-day amounts are unchanged: 8,000 gold, 2,500 food, 1,500 mana, 3,000 industry,
  150 population, 3 gems.
- Example: joining on day 9 (8 days late) gives 8 × 1.45 = 11.6 days' worth.
- Protection: 24h, plus 6h for each day late, capped at 72h (OpenDominion's protection length).
- Why: land comes back quickly through exploring (1 AP each), so resources and safe time to
  spend them are what a late joiner is missing.

## B6. Gold sink: **troop wages**

- Every troop at home or deployed costs gold each hour: **0.25% of its gold price per hour,
  minimum 0.02 gold.** Per troop per hour: T1 0.02, T2 ~0.04, T3 0.25, T4 ~1.6, T5 ~3.
- A typical mid-season army costs about 300 gold/hour, roughly 12–20% of income. Elite-heavy
  armies cost the most.
- If wages can't be paid (gold runs out), morale drains 5%/hour, the same as starvation.
- Undead still have no food upkeep. Wages are gold, so they pay wages like everyone else.
- Shown on the dashboard as part of hourly gold, with wages listed separately.

## B7. Sessions: **httpOnly cookie**

- Login and registration set the session JWT as an `httpOnly`, `SameSite=Lax` cookie, which is
  `Secure` in production. The browser sends it automatically, and page scripts can't read it,
  so an XSS can no longer steal a session.
- The auth middleware and the chat socket read the cookie. The `Authorization: Bearer` header
  still works for scripts and tools.
- Logout clears the cookie. The client stops storing the token in localStorage and clears any
  token already there.
- CSRF: `SameSite=Lax` blocks cross-site POSTs, and state-changing requests whose `Origin`
  header doesn't match the site are rejected with 403.
