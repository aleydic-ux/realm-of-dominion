import { useState, useEffect } from 'react';
import { RACE_ICONS } from '../utils/formatters';

export default function RaidToast({ alert, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!alert) return;
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300); // wait for fade-out
    }, 8000);
    return () => clearTimeout(timer);
  }, [alert, onDismiss]);

  if (!alert) return null;

  const borderColor = alert.outcome === 'win'
    ? '#ef4444'   // attacker won = bad for you
    : alert.outcome === 'loss'
      ? '#22c55e'  // attacker lost = you defended
      : '#eab308';

  const icon = alert.outcome === 'win' ? '\u{1F6A8}' : alert.outcome === 'loss' ? '\u{1F6E1}' : '\u{2694}';

  return (
    <div
      style={{
        position: 'fixed',
        top: '80px',
        right: '16px',
        width: '320px',
        background: 'linear-gradient(135deg, #0e1828, #162038)',
        border: `2px solid ${borderColor}`,
        borderRadius: '8px',
        padding: '14px 16px',
        boxShadow: `0 4px 20px rgba(0,0,0,0.7), 0 0 15px ${borderColor}40`,
        zIndex: 1000,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'opacity 0.3s, transform 0.3s',
        cursor: 'pointer',
      }}
      onClick={() => { setVisible(false); setTimeout(onDismiss, 200); }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontSize: '1.2rem' }}>{icon}</span>
        {alert.attacker_race && (
          <span style={{ fontSize: '0.9rem' }}>{RACE_ICONS[alert.attacker_race]}</span>
        )}
        <span className="font-display" style={{
          color: borderColor,
          fontSize: '0.82rem',
          fontWeight: 'bold',
        }}>
          {alert.title}
        </span>
      </div>
      <div className="font-mono" style={{
        color: '#c8d8e8',
        fontSize: '0.72rem',
        lineHeight: '1.4',
      }}>
        {alert.message}
      </div>
      <div className="font-mono" style={{
        color: '#485868',
        fontSize: '0.6rem',
        marginTop: '6px',
      }}>
        Click to dismiss
      </div>
    </div>
  );
}
