export function formatNumber(n) {
  if (n === null || n === undefined) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(Math.floor(n));
}

export function formatTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  const now = new Date();
  const diff = d - now;
  if (diff < 0) return 'Complete';

  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function formatDateTime(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString();
}

// Format a duration in hours into human-readable string
export function formatDuration(hours) {
  const totalSeconds = Math.round(hours * 3600);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  if (totalSeconds < 3600) return `${Math.round(totalSeconds / 60)}m`;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatPercent(value, decimals = 1) {
  return `${(value * 100).toFixed(decimals)}%`;
}

export const RACE_ICONS = {
  human: '👑',
  orc: '💀',
  undead: '☠️',
  elf: '🌿',
  dwarf: '⚒️',
  serpathi: '🐍',
  ironveil: '⚙️',
  ashborn: '🔥',
  tidewarden: '🌊',
};

export const RESOURCE_ICONS = {
  gold: '🪙',
  food: '🌾',
  mana: '💠',
  industry_points: '⚙️',
};

export const RACE_LABELS = {
  human: 'Human',
  orc: 'Orc',
  undead: 'Undead',
  elf: 'Elf',
  dwarf: 'Dwarf',
  serpathi: 'Serpathi',
  ironveil: 'Ironveil',
  ashborn: 'Ashborn',
  tidewarden: 'Tidewarden',
};

/** Seconds to train one troop of a given tier. Shared with server. */
export function trainingTime(tier) {
  return Math.pow(3, (tier || 1) - 1);
}

export function isProtected(province) {
  return province.protection_ends_at && new Date(province.protection_ends_at) > new Date();
}

export function formatRelativeDate(isoString) {
  if (!isoString) return '—';
  const diff = new Date(isoString) - Date.now();
  if (diff <= 0) return 'ended';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `in ${days}d ${hours}h`;
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `in ${hours}h ${mins}m`;
  return `in ${mins}m`;
}
