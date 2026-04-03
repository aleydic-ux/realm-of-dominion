import { formatTime, formatNumber, formatDuration } from '../utils/formatters';

const RACE_BUILD_MULTIPLIER = { human: 0.90, dwarf: 0.75, orc: 1.0, undead: 1.0, elf: 1.0, serpathi: 1.0, ironveil: 0.90, ashborn: 1.0, tidewarden: 1.0 };

const BUILDING_BASE_COSTS = {
  farm:              { gold: 300,  pp: 30 },
  barracks:          { gold: 600,  pp: 60 },
  treasury:          { gold: 400,  pp: 40 },
  marketplace_stall: { gold: 350,  pp: 35 },
  watchtower:        { gold: 450,  pp: 45 },
  walls:             { gold: 700,  pp: 70 },
  library:           { gold: 500,  pp: 50 },
  mine_quarry:       { gold: 400,  pp: 40 },
  temple_altar:      { gold: 450,  pp: 45 },
  war_hall:          { gold: 800,  pp: 80 },
  royal_bank:        { gold: 600,  pp: 60 },
  warchief_pit:      { gold: 700,  pp: 70 },
  crypt:             { gold: 550,  pp: 55 },
  ancient_grove:     { gold: 550,  pp: 55 },
  runic_forge:       { gold: 650,  pp: 65 },
  arcane_sanctum:    { gold: 900,  pp: 90 },
  shadowveil_den:    { gold: 600,  pp: 60 },
  artificers_foundry:{ gold: 700,  pp: 70 },
  ashfire_altar:     { gold: 650,  pp: 65 },
  tidal_basin:       { gold: 600,  pp: 60 },
};

function calcUpgradeCost(currentLevel, race, buildingType) {
  const targetLevel = currentLevel + 1;
  const mult = RACE_BUILD_MULTIPLIER[race] || 1.0;
  const base = BUILDING_BASE_COSTS[buildingType] || { gold: 500, pp: 50 };
  const exp = Math.pow(1.8, targetLevel - 1);
  const timeSeconds = Math.round(20 * Math.pow(3, targetLevel - 1));
  return {
    gold: Math.ceil(base.gold * exp * mult),
    pp: Math.ceil(base.pp * exp * mult),
    time_hours: timeSeconds / 3600,
  };
}

const BUILDING_LABELS = {
  farm: 'Farm',
  barracks: 'Barracks',
  treasury: 'Treasury',
  marketplace_stall: 'Marketplace Stall',
  watchtower: 'Watchtower',
  walls: 'Walls',
  library: 'Library',
  mine_quarry: 'Mine/Quarry',
  temple_altar: 'Temple/Altar',
  war_hall: 'War Hall',
  royal_bank: 'Royal Bank',
  warchief_pit: 'Warchief Pit',
  crypt: 'Crypt',
  ancient_grove: 'Ancient Grove',
  runic_forge: 'Runic Forge',
  arcane_sanctum: 'Arcane Sanctum',
  shadowveil_den: 'Shadowveil Den',
  artificers_foundry: 'Artificers Foundry',
  ashfire_altar: 'Ashfire Altar',
  tidal_basin: 'Tidal Basin',
};

const BUILDING_EFFECTS = {
  farm: '+10% food per level',
  barracks: '+10% train speed, +5% troop cap per level',
  treasury: '+8% gold cap, +4% income per level',
  marketplace_stall: '+1 trade slot, +5% trade value per level',
  watchtower: '+10% spy detect, +5% all defense per level',
  walls: '+15% defense bonus per level',
  library: '+10% research speed per level',
  mine_quarry: '+8% industry points per level',
  temple_altar: '+10% mana regen, +5% morale recovery per level',
  war_hall: '+5% troop attack; unlocks T4@L3, T5@L5',
  royal_bank: '+15% gold income per level',
  warchief_pit: '+10% Warchief/Berserker power per level',
  crypt: '+7% skeleton raise chance per level',
  ancient_grove: '+15% mana regen, +10% land yield per level',
  runic_forge: '+3 ATK/DEF to Runic Warriors per level',
  arcane_sanctum: '+5% mana regen per level; unlocks spells at L1/L3/L5',
  shadowveil_den: '+7% mana regen per level',
  artificers_foundry: '+10% industry points per level',
  ashfire_altar: 'Empowers Ashborn fury and scorched earth abilities',
  tidal_basin: '+12% gold income per level',
};

export default function BuildingCard({ building, onBuild, gold, industry_points, race }) {
  const isMax = building.level >= 5;
  const isUpgrading = building.is_upgrading;
  const label = BUILDING_LABELS[building.building_type] || building.building_type;
  const effect = BUILDING_EFFECTS[building.building_type] || '';
  const nextCost = !isMax && !isUpgrading ? calcUpgradeCost(building.level, race, building.building_type) : null;

  return (
    <div className="realm-panel flex flex-col gap-2" style={{ position: 'relative' }}>
      {isMax && (
        <span style={{
          position: 'absolute', top: '8px', right: '8px',
          fontSize: '10px', padding: '1px 6px',
          background: 'rgba(200,160,72,0.15)',
          border: '1px solid rgba(200,160,72,0.5)',
          color: 'rgb(200,160,72)',
          borderRadius: '3px', fontWeight: 'bold'
        }}>MAX</span>
      )}
      <div className="flex items-center justify-between">
        <h3 className="text-realm-gold font-display">{label}</h3>
        <div className="flex gap-1.5 items-center" style={{ marginRight: isMax ? '40px' : 0 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full border ${
                i < building.level
                  ? 'bg-realm-gold border-realm-gold'
                  : 'bg-transparent border-realm-border'
              }`}
            />
          ))}
        </div>
      </div>

      <p className="text-realm-text-dim text-xs">{effect}</p>

      {isUpgrading && (
        <p className="text-yellow-400 text-xs">
          Upgrading... {formatTime(building.upgrade_completes_at)}
        </p>
      )}

      {nextCost && (
        <div className="text-xs space-y-0.5 border-t border-realm-border/50 pt-2 mt-1">
          <div className="flex justify-between text-realm-text-dim">
            <span>Cost:</span>
            <span>
              <span className={gold >= nextCost.gold ? 'text-yellow-400' : 'text-red-400'}>{formatNumber(nextCost.gold)}g</span>
              {' + '}
              <span className={industry_points >= nextCost.pp ? 'text-gray-300' : 'text-red-400'}><abbr title="Industry Points">{formatNumber(nextCost.pp)} IP</abbr></span>
            </span>
          </div>
          <div className="flex justify-between text-realm-text-dim">
            <span>Time:</span>
            <span className="text-realm-text-muted">{formatDuration(nextCost.time_hours)}</span>
          </div>
        </div>
      )}

      {!isMax && !isUpgrading && (
        <button
          onClick={() => onBuild(building.building_type)}
          disabled={gold < nextCost.gold || industry_points < nextCost.pp}
          className="realm-btn-gold text-xs w-full"
        >
          Upgrade to L{building.level + 1}
        </button>
      )}

      {/* MAX badge is in corner */}
    </div>
  );
}
