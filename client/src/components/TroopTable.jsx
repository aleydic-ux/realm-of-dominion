import { useState } from 'react';
import { formatNumber, formatDuration } from '../utils/formatters';

export default function TroopTable({ troops, showDeploy = false, onDeploy, gold }) {
  const [qtys, setQtys] = useState({});

  if (!troops || !troops.length) {
    return <p className="text-realm-text-dim text-sm">No troops available.</p>;
  }

  const totalHome = troops.reduce((s, t) => s + (t.count_home || 0), 0);
  const totalTraining = troops.reduce((s, t) => s + (t.count_training || 0), 0);
  const totalDeployed = troops.reduce((s, t) => s + (t.count_deployed || 0), 0);
  const totalAtk = troops.reduce((s, t) => s + t.offense_power * (t.count_home || 0), 0);
  const totalDef = troops.reduce((s, t) => s + t.defense_power * (t.count_home || 0), 0);
  const totalFood = troops.reduce((s, t) => s + t.food_upkeep * ((t.count_home || 0) + (t.count_deployed || 0)), 0);

  return (
    <table className="realm-table">
      <thead>
        <tr>
          <th scope="col">Tier</th>
          <th scope="col">Name</th>
          <th scope="col">ATK</th>
          <th scope="col">DEF</th>
          <th scope="col">Cost</th>
          <th scope="col">Train Time</th>
          <th scope="col">Home</th>
          {showDeploy && <th scope="col">Training</th>}
          {showDeploy && <th scope="col">Deployed</th>}
          <th scope="col">Food/hr</th>
          <th scope="col">Ability</th>
          {showDeploy && <th scope="col">Qty</th>}
          {showDeploy && <th scope="col"><span className="sr-only">Actions</span></th>}
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
            <td className="text-realm-text-muted">{Math.pow(3, (t.tier || 1) - 1)}s/troop</td>
            <td className="text-realm-gold">{formatNumber(t.count_home)}</td>
            {showDeploy && (
              <td className="text-yellow-400">{formatNumber(t.count_training)}</td>
            )}
            {showDeploy && (
              <td className="text-orange-400">{formatNumber(t.count_deployed)}</td>
            )}
            <td className="text-green-400">
              {showDeploy ? formatNumber(t.food_upkeep * ((t.count_home || 0) + (t.count_deployed || 0))) : t.food_upkeep}
            </td>
            <td className="text-realm-text-dim text-xs max-w-xs whitespace-normal">{t.special_ability || '—'}</td>
            {showDeploy && (
              <td>
                <input
                  type="number"
                  min="1"
                  max={gold != null ? Math.floor(gold / t.gold_cost) : undefined}
                  placeholder="1"
                  className="realm-input text-xs w-16 py-0.5"
                  value={qtys[t.troop_type_id] || ''}
                  onChange={e => setQtys({ ...qtys, [t.troop_type_id]: e.target.value })}
                />
              </td>
            )}
            {showDeploy && onDeploy && (
              <td>
                <button
                  onClick={() => onDeploy(t, parseInt(qtys[t.troop_type_id]) || 1)}
                  className="realm-btn-outline text-xs py-1 px-2"
                  aria-label={`Train ${t.name}`}
                >
                  Train
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
      {showDeploy && (
        <tfoot>
          <tr style={{ background: 'rgba(200,160,72,0.08)', borderTop: '1px solid rgba(200,160,72,0.3)' }} className="font-bold text-sm">
            <td colSpan={2} className="text-realm-gold pt-2">Totals</td>
            <td className="text-red-400 pt-2">{formatNumber(totalAtk)}</td>
            <td className="text-blue-400 pt-2">{formatNumber(totalDef)}</td>
            <td colSpan={2}></td>
            <td className="text-realm-gold pt-2">{formatNumber(totalHome)}</td>
            <td className="text-yellow-400 pt-2">{formatNumber(totalTraining)}</td>
            <td className="text-orange-400 pt-2">{formatNumber(totalDeployed)}</td>
            <td className="text-green-400 pt-2">{formatNumber(totalFood)}</td>
            <td colSpan={3}></td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}
