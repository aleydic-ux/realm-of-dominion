import { useState, useEffect } from 'react';
import TroopTable from '../components/TroopTable';
import { formatNumber, formatTime, formatDuration } from '../utils/formatters';
import api from '../utils/api';

export default function Military({ province, troops = [], refresh }) {
  const [trainModal, setTrainModal] = useState(null);
  const [trainQty, setTrainQty] = useState(1);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { document.title = 'Military — Realm of Dominion'; }, []);

  if (!province) return null;

  async function handleTrain() {
    if (!trainModal || trainQty < 1) return;
    setSubmitting(true);
    setMessage('');
    setError('');
    try {
      const { data } = await api.post('/province/train', {
        troop_type_id: trainModal.troop_type_id,
        quantity: trainQty,
      });
      setMessage(`Training ${trainQty}x ${trainModal.name}. ${data.completes_at ? `Done: ${formatTime(data.completes_at)}` : ''}`);
      setTrainModal(null);
      setTrainQty(1);
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Training failed');
    } finally {
      setSubmitting(false);
    }
  }

  const totalOff = troops.reduce((s, t) => s + t.offense_power * t.count_home, 0);
  const totalDef = troops.reduce((s, t) => s + t.defense_power * t.count_home, 0);
  const totalTroops = troops.reduce((s, t) => s + t.count_home + t.count_deployed + t.count_training, 0);
  const totalFoodPerHour = troops.reduce((s, t) => s + t.food_upkeep * (t.count_home + t.count_deployed), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-display text-realm-gold">Military</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Troops', value: formatNumber(totalTroops), color: 'text-realm-gold' },
          { label: 'Attack Power', value: formatNumber(totalOff), color: 'text-red-400' },
          { label: 'Defense Power', value: formatNumber(totalDef), color: 'text-blue-400' },
          { label: 'Food/hr', value: formatNumber(totalFoodPerHour), color: 'text-green-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="realm-panel text-center">
            <div className="text-realm-text-dim text-xs mb-1">{label}</div>
            <div className={`text-lg font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {message && <div className="bg-green-900/30 border border-green-700 text-green-300 px-3 py-2 rounded text-sm">{message}</div>}
      {error && <div className="bg-red-900/30 border border-red-700 text-red-300 px-3 py-2 rounded text-sm">{error}</div>}

      {/* Troop table */}
      <div className="realm-panel overflow-x-auto">
        <h2 className="text-realm-gold font-display mb-3">Troops</h2>
        <TroopTable
          troops={troops}
          showDeploy={true}
          onDeploy={(t, qty) => { setTrainModal(t); setTrainQty(qty || 1); setError(''); }}
        />

        {/* Training timers */}
        {troops.filter(t => t.count_training > 0).map(t => (
          <div key={t.troop_type_id} className="mt-2 text-sm text-yellow-400">
            Training {t.count_training}x {t.name}... {formatTime(t.training_completes_at)}
          </div>
        ))}

        {/* Deployed */}
        {troops.filter(t => t.count_deployed > 0).map(t => (
          <div key={t.troop_type_id} className="mt-1 text-sm text-orange-400">
            {t.count_deployed}x {t.name} deployed
          </div>
        ))}
      </div>

      {/* Train Modal */}
      {trainModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="realm-panel w-full max-w-sm space-y-4">
            <h2 className="text-realm-gold font-display">Train {trainModal.name}</h2>
            <div className="text-sm text-realm-text-muted space-y-1">
              <div>ATK: <span className="text-red-400">{trainModal.offense_power}</span> | DEF: <span className="text-blue-400">{trainModal.defense_power}</span></div>
              <div>Cost per unit: <span className="text-yellow-400">{formatNumber(trainModal.gold_cost)} gold</span></div>
              <div>Training time: <span className="text-realm-text">{Math.pow(3, (trainModal.tier || 1) - 1)}s per troop</span></div>
              <div className="text-xs text-realm-text-dim">{trainModal.special_ability}</div>
            </div>
            <div>
              <label className="text-realm-text-muted text-xs block mb-1">Quantity</label>
              <input
                className="realm-input"
                type="number"
                min="1"
                value={trainQty}
                onChange={e => setTrainQty(parseInt(e.target.value) || 1)}
              />
              <div className="text-xs text-realm-text-dim mt-1">
                Total cost: <span className="text-yellow-400">{formatNumber(trainQty * trainModal.gold_cost)} gold</span>
                {' | '}Time: <span className="text-realm-text-muted">{formatDuration(trainQty * Math.pow(3, (trainModal.tier || 1) - 1) / 3600)}</span>
              </div>
            </div>
            {error && <div className="text-red-400 text-sm">{error}</div>}
            <div className="flex gap-2">
              <button onClick={handleTrain} disabled={submitting} className="realm-btn-gold flex-1">
                {submitting ? 'Training...' : 'Train'}
              </button>
              <button onClick={() => { setTrainModal(null); setError(''); }} className="realm-btn-outline flex-1">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
