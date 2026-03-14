import { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatRelativeDate } from '../utils/formatters';

const CATEGORIES = ['All', 'Combat', 'Growth', 'Research', 'Military', 'Buildings'];

function ProgressBar({ current, max, color = '#c8a048' }) {
  const pct = Math.min(100, Math.floor((current / max) * 100));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#485868', marginBottom: '3px', fontFamily: 'Verdana, Arial, sans-serif' }}>
        <span>{current.toLocaleString()} / {max.toLocaleString()}</span>
        <span>{pct}%</span>
      </div>
      <div style={{ height: '4px', background: '#0a1020', borderRadius: '2px', overflow: 'hidden', border: '1px solid #1e3050' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

function AchievementCard({ ach }) {
  const unlocked = !!ach.unlocked_at;
  return (
    <div style={{
      background: unlocked ? 'rgba(200,160,72,0.07)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${unlocked ? 'rgba(200,160,72,0.4)' : '#1e3050'}`,
      borderRadius: '6px',
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      opacity: unlocked ? 1 : 0.65,
    }}>
      <div style={{ fontSize: '1.6rem', flexShrink: 0, lineHeight: 1 }}>{ach.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
          <span style={{ color: unlocked ? '#c8a048' : '#c8d8e8', fontFamily: 'Cinzel, Georgia, serif', fontSize: '0.82rem', fontWeight: '700' }}>
            {ach.name}
          </span>
          {unlocked && (
            <span style={{ color: '#2a8a48', fontSize: '0.6rem', fontFamily: 'Verdana, Arial, sans-serif', border: '1px solid #2a8a48', padding: '1px 5px', letterSpacing: '0.05em' }}>
              EARNED
            </span>
          )}
        </div>
        <div style={{ color: '#8090a8', fontSize: '0.7rem', fontFamily: 'Verdana, Arial, sans-serif', lineHeight: '1.4' }}>
          {ach.description}
        </div>
        {unlocked && ach.unlocked_at && (
          <div style={{ color: '#485868', fontSize: '0.62rem', marginTop: '4px', fontFamily: 'Verdana, Arial, sans-serif' }}>
            Earned {formatRelativeDate(ach.unlocked_at)}
          </div>
        )}
        {!unlocked && ach.progress && (
          <div style={{ marginTop: '8px' }}>
            <ProgressBar current={ach.progress.current} max={ach.progress.max} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatsPanel({ stats }) {
  if (!stats || !Object.keys(stats).length) return null;
  const rows = [
    { label: 'Battles Won', value: stats.attacks_won || 0 },
    { label: 'Battles Lost', value: stats.attacks_lost || 0 },
    { label: 'Attacks Repelled', value: stats.attacks_defended || 0 },
    { label: 'Acres Conquered', value: (stats.land_conquered || 0).toLocaleString() },
    { label: 'Gold Plundered', value: (stats.gold_plundered || 0).toLocaleString() },
    { label: 'Troops Trained', value: (stats.troops_trained || 0).toLocaleString() },
    { label: 'Researches Done', value: stats.research_completed || 0 },
    { label: 'Buildings Upgraded', value: stats.buildings_upgraded || 0 },
    { label: 'Spells Cast', value: stats.spells_cast || 0 },
  ];
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1e3050', borderRadius: '6px', padding: '14px 16px', marginBottom: '20px' }}>
      <div style={{ color: '#c8a048', fontFamily: 'Cinzel, Georgia, serif', fontSize: '0.85rem', fontWeight: '700', marginBottom: '10px' }}>
        Province Statistics
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
        {rows.map(({ label, value }) => (
          <div key={label}>
            <div style={{ color: '#485868', fontSize: '0.6rem', fontFamily: 'Verdana, Arial, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ color: '#c8d8e8', fontSize: '0.85rem', fontWeight: 'bold', fontFamily: 'Verdana, Arial, sans-serif' }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Achievements() {
  const [achievements, setAchievements] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');

  useEffect(() => { document.title = 'Achievements — Realm of Dominion'; }, []);

  useEffect(() => {
    api.get('/achievements')
      .then(({ data }) => {
        setAchievements(data.achievements || []);
        setStats(data.stats || {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = category === 'All'
    ? achievements
    : achievements.filter(a => a.category === category);

  const unlockedCount = achievements.filter(a => a.unlocked_at).length;
  const overallPct = achievements.length ? Math.floor((unlockedCount / achievements.length) * 100) : 0;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 4px' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontFamily: 'Cinzel, Georgia, serif', color: '#c8a048', fontSize: '1.3rem', fontWeight: '700', marginBottom: '2px' }}>
          Achievements
        </h1>
        <p style={{ color: '#8090a8', fontSize: '0.72rem', fontFamily: 'Verdana, Arial, sans-serif' }}>
          {unlockedCount} of {achievements.length} earned ({overallPct}%)
        </p>
      </div>

      {/* Overall progress */}
      <div style={{ marginBottom: '20px', height: '8px', background: '#0a1020', borderRadius: '4px', overflow: 'hidden', border: '1px solid #1e3050' }}>
        <div style={{
          width: `${overallPct}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #c8a048, #e8c860)',
          borderRadius: '4px',
          transition: 'width 0.6s ease',
        }} />
      </div>

      {/* Stats panel */}
      <StatsPanel stats={stats} />

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{
              fontFamily: 'Verdana, Arial, sans-serif',
              fontSize: '0.7rem',
              padding: '4px 12px',
              background: category === cat ? 'rgba(200,160,72,0.12)' : 'transparent',
              border: `1px solid ${category === cat ? '#c8a048' : '#243650'}`,
              color: category === cat ? '#c8a048' : '#8090a8',
              cursor: 'pointer',
              borderRadius: '3px',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#8090a8', fontSize: '0.8rem', textAlign: 'center', padding: '40px' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: '#485868', fontSize: '0.8rem', textAlign: 'center', padding: '40px' }}>No achievements in this category.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
          {filtered.map(ach => <AchievementCard key={ach.key} ach={ach} />)}
        </div>
      )}
    </div>
  );
}
