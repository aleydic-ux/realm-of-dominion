const raceConfig = require('../config/raceConfig');

// Every playable race; raceConfig is the source of truth
const RACES = Object.keys(raceConfig);

// Buildings every province starts with (level 0)
const UNIVERSAL_BUILDINGS = [
  'farm', 'barracks', 'treasury', 'marketplace_stall', 'watchtower',
  'walls', 'library', 'mine_quarry', 'temple_altar', 'war_hall', 'arcane_sanctum',
];

// Each race's unique building
const RACE_BUILDINGS = {
  human: 'royal_bank',
  orc: 'warchief_pit',
  undead: 'crypt',
  elf: 'ancient_grove',
  dwarf: 'runic_forge',
  serpathi: 'shadowveil_den',
  ironveil: 'artificers_foundry',
  ashborn: 'ashfire_altar',
  tidewarden: 'tidal_basin',
};

function startingBuildings(race) {
  return [...UNIVERSAL_BUILDINGS, RACE_BUILDINGS[race]].filter(Boolean);
}

module.exports = { RACES, UNIVERSAL_BUILDINGS, RACE_BUILDINGS, startingBuildings };
