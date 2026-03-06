import { useState, useEffect } from 'react';
import BuildingCard from '../components/BuildingCard';
import api from '../utils/api';
import { formatNumber } from '../utils/formatters';

export default function Buildings({ province, buildings = [], refresh }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { document.title = 'Buildings — Realm of Dominion'; }, []);

  if (!province) return null;

  async function handleBuild(building_type) {
    setMessage('');
    setError('');
    try {
      const { data } = await api.post('/province/build', { building_type });
      setMessage(data.message + `. Cost: ${formatNumber(data.cost?.gold)} gold, ${formatNumber(data.cost?.production_points)} IP`);
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Build failed');
    }
  }

  const universal = buildings.filter(b => ![
    'royal_bank','warchief_pit','crypt','ancient_grove','runic_forge'
  ].includes(b.building_type));

  const raceSpecific = buildings.filter(b => [
    'royal_bank','warchief_pit','crypt','ancient_grove','runic_forge'
  ].includes(b.building_type));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display text-realm-gold">Buildings</h1>
        <div className="text-sm text-realm-text-muted">
          AP: <span className="text-realm-gold">{province.action_points}</span> | 2 AP to build
        </div>
      </div>

      {message && <div className="bg-green-900/30 border border-green-700 text-green-300 px-3 py-2 rounded text-sm">{message}</div>}
      {error && <div className="bg-red-900/30 border border-red-700 text-red-300 px-3 py-2 rounded text-sm">{error}</div>}

      {raceSpecific.length > 0 && (
        <>
          <h2 className="text-realm-gold-dark font-display">Race Building</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {raceSpecific.map(b => (
              <BuildingCard
                key={b.building_type}
                building={b}
                onBuild={handleBuild}
                gold={province.gold}
                production_points={province.production_points}
                race={province.race}
              />
            ))}
          </div>
        </>
      )}

      <h2 className="text-realm-gold-dark font-display">Universal Buildings</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {universal.map(b => (
          <BuildingCard
            key={b.building_type}
            building={b}
            onBuild={handleBuild}
            gold={province.gold}
            production_points={province.production_points}
          />
        ))}
      </div>
    </div>
  );
}
