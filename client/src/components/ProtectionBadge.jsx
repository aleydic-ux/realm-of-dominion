import { formatTime } from '../utils/formatters';

export default function ProtectionBadge({ protection_ends_at }) {
  if (!protection_ends_at) return null;
  const active = new Date(protection_ends_at) > new Date();
  if (!active) return null;

  return (
    <span className="realm-badge bg-blue-900/40 border-blue-500 text-blue-300 text-xs">
      🛡️ Shield {formatTime(protection_ends_at)}
    </span>
  );
}
