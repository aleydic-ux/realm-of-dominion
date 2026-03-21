import { useState, useEffect } from 'react';
import api, { getApiError } from '../utils/api';
import { formatNumber, formatTime, formatDuration } from '../utils/formatters';
import { RACE_LABELS } from '../utils/formatters';
import { usePageTitle } from '../hooks/usePageTitle';

export default function Research({ province, research = [], refresh }) {
  const [availableTechs, setAvailableTechs] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  usePageTitle('Research');

  useEffect(() => {
    async function loadTechs() {
      try {
        const { data } = await api.get('/tech-tree');
        setAvailableTechs(data || []);
      } catch {}
    }
    loadTechs();
  }, []);

  const researchMap = {};
  for (const r of research) researchMap[r.tech_id] = r;

  async function startResearch(techId) {
    setMessage('');
    setError('');
    try {
      const { data } = await api.post('/province/research', { tech_id: techId });
      setMessage(data.message + (data.completes_at ? ` (${formatTime(data.completes_at)})` : ''));
      refresh();
    } catch (err) {
      setError(getApiError(err, 'Research failed'));
    }
  }

  const inProgress = research.filter(r => r.status === 'in_progress');
  const completed = research.filter(r => r.status === 'complete');

  // Only show universal + player's race
  const universalTechs = availableTechs.filter(t => !t.race);
  const raceTechs = availableTechs.filter(t => province && t.race === province.race);

  function TechCard({ tech }) {
    const status = researchMap[tech.id];
    const isComplete = status?.status === 'complete';
    const isInProgress = status?.status === 'in_progress';
    const prereqMet = !tech.prerequisite_tech_id || researchMap[tech.prerequisite_tech_id]?.status === 'complete';

    return (
      <div className={`border rounded p-3 ${
        isComplete ? 'border-green-800/50 bg-green-900/10' :
        !prereqMet ? 'border-realm-border/30 opacity-50' :
        'border-realm-border'
      }`}>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-realm-text font-medium">{tech.name}</span>
              <span className="text-xs text-realm-text-dim border border-realm-border/50 px-1 rounded">T{tech.tier}</span>
              {isComplete && <span className="text-xs text-green-400">✓ Done</span>}
              {isInProgress && <span className="text-xs text-yellow-400">⟳ In Progress</span>}
              {!prereqMet && <span className="text-xs text-realm-text-dim">🔒 Locked</span>}
            </div>
            <p className="text-realm-text-dim text-xs mt-1">{tech.description}</p>
            {!prereqMet && tech.prerequisite_tech_id && (
              <p className="text-realm-text-dim text-xs mt-0.5 italic">
                Requires: {availableTechs.find(t => t.id === tech.prerequisite_tech_id)?.name}
              </p>
            )}
          </div>
          <div className="text-right text-xs shrink-0">
            <div className="text-yellow-400">{formatNumber(tech.gold_cost)}g</div>
            <div className="text-realm-text-dim">{formatDuration(tech.research_hours)}</div>
          </div>
        </div>
        {!isComplete && !isInProgress && prereqMet && (
          <button onClick={() => startResearch(tech.id)} className="realm-btn-gold text-xs mt-2">
            Research (1 AP)
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-display text-realm-gold">Research</h1>
        <div className="text-sm text-realm-text-muted">
          AP: <span className="text-realm-gold">{province?.action_points}</span> | 1 AP to research
        </div>
      </div>

      {message && <div className="bg-green-900/30 border border-green-700 text-green-300 px-3 py-2 rounded text-sm">{message}</div>}
      {error && <div className="bg-red-900/30 border border-red-700 text-red-300 px-3 py-2 rounded text-sm">{error}</div>}

      {inProgress.length > 0 && (
        <div className="realm-panel bg-yellow-900/10 border-yellow-700/40">
          <h2 className="text-yellow-400 font-display mb-2">In Progress</h2>
          {inProgress.map(r => (
            <div key={r.tech_id} className="flex justify-between items-center">
              <span className="text-realm-text">{r.name}</span>
              <span className="text-yellow-400 text-sm">{formatTime(r.completes_at)}</span>
            </div>
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="realm-panel">
          <h2 className="text-realm-gold font-display mb-2">Completed ({completed.length})</h2>
          <div className="flex flex-wrap gap-2">
            {completed.map(r => (
              <span key={r.tech_id} className="realm-badge bg-green-900/30 border-green-700 text-green-400">✓ {r.name}</span>
            ))}
          </div>
        </div>
      )}

      {universalTechs.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-realm-gold-dark font-display">Universal Technologies</h2>
          {universalTechs.map(tech => <TechCard key={tech.id} tech={tech} />)}
        </div>
      )}

      {raceTechs.length > 0 && (
        <div className="space-y-2">
          <h2 className={`font-display race-${province?.race}`}>
            {RACE_LABELS[province?.race]} Technologies
          </h2>
          {raceTechs.map(tech => <TechCard key={tech.id} tech={tech} />)}
        </div>
      )}
    </div>
  );
}
