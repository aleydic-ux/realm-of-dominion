import { formatNumber, formatDuration } from '../utils/formatters';

export default function TroopTable({ troops, showDeploy = false, onDeploy }) {
  if (!troops || !troops.length) {
    return <p className="text-realm-text-dim text-sm">No troops available.</p>;
  }

  return (
    <table className="realm-table">
      <thead>
        <tr>
          <th>Tier</th>
          <th>Name</th>
          <th>ATK</th>
          <th>DEF</th>
          <th>Cost</th>
          <th>Train</th>
          <th>Home</th>
          {showDeploy && <th>Training</th>}
          {showDeploy && <th>Deployed</th>}
          <th>Food/hr</th>
          <th>Ability</th>
          {showDeploy && <th></th>}
        </tr>
      </thead>
      <tbody>
        {troops.map((t) => (
          <tr key={t.troop_type_id || t.id}>
            <td className="text-realm-text-dim">T{t.tier}</td>
            <td className="text-realm-text font-medium">{t.name}</td>
            <td className="text-red-400">{t.offense_power}</td>
            <td className="text-blue-400">{t.defense_power}</td>
            <td className="text-yellow-400">{formatNumber(t.gold_cost)}g</td>
            <td className="text-realm-text-muted">1s/troop</td>
            <td className="text-realm-gold">{formatNumber(t.count_home)}</td>
            {showDeploy && (
              <td className="text-yellow-400">{formatNumber(t.count_training)}</td>
            )}
            {showDeploy && (
              <td className="text-orange-400">{formatNumber(t.count_deployed)}</td>
            )}
            <td className="text-green-400">{t.food_upkeep}</td>
            <td className="text-realm-text-dim text-xs max-w-xs truncate">{t.special_ability || '—'}</td>
            {showDeploy && onDeploy && (
              <td>
                <button
                  onClick={() => onDeploy(t)}
                  className="realm-btn-outline text-xs py-1 px-2"
                >
                  Train
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
