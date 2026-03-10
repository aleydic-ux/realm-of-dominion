import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { formatRelativeDate, RACE_ICONS } from '../utils/formatters';

export default function NotificationBell({ unreadCount, onOpen }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function loadNotifications() {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data);
    } catch { /* ignore */ }
    setLoading(false);
  }

  function toggle() {
    if (!open) loadNotifications();
    setOpen(o => !o);
    if (onOpen) onOpen();
  }

  async function markRead(id) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch { /* ignore */ }
  }

  async function markAllRead() {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch { /* ignore */ }
  }

  const outcomeColor = (outcome) => {
    if (outcome === 'win') return '#ef4444';   // red = they won against you
    if (outcome === 'loss') return '#22c55e';  // green = you repelled
    return '#eab308';                           // yellow = draw
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={toggle}
        title="Notifications"
        style={{
          fontFamily: 'Verdana, Arial, sans-serif',
          color: unreadCount > 0 ? '#c8a048' : '#8090a8',
          fontSize: '0.85rem',
          border: '1px solid #243650',
          padding: '2px 8px',
          background: 'transparent',
          cursor: 'pointer',
          position: 'relative',
        }}
        onMouseOver={e => { e.target.style.color = '#c8a048'; e.target.style.borderColor = '#c8a048'; }}
        onMouseOut={e => { e.target.style.color = unreadCount > 0 ? '#c8a048' : '#8090a8'; e.target.style.borderColor = '#243650'; }}
      >
        {unreadCount > 0 ? '\u{1F514}' : '\u{1F515}'}
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            background: '#ef4444', color: '#fff', fontSize: '0.6rem',
            borderRadius: '50%', width: '16px', height: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 'bold',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '4px',
          width: '340px', maxHeight: '420px', overflowY: 'auto',
          background: '#0e1828', border: '1px solid #1e3050',
          borderRadius: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          zIndex: 100,
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 12px', borderBottom: '1px solid #1e3050',
          }}>
            <span style={{ color: '#c8a048', fontFamily: 'Cinzel, Georgia, serif', fontSize: '0.85rem' }}>
              Notifications
            </span>
            {notifications.some(n => !n.is_read) && (
              <button onClick={markAllRead} style={{
                color: '#8090a8', fontSize: '0.65rem', background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: 'Verdana, Arial, sans-serif',
              }}>
                Mark all read
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#8090a8', fontSize: '0.75rem' }}>
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#485868', fontSize: '0.75rem' }}>
              No notifications yet
            </div>
          ) : (
            notifications.map(n => {
              const meta = n.metadata || {};
              const race = meta.attacker_race || meta.defender_race;
              return (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && markRead(n.id)}
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid #162038',
                    background: n.is_read ? 'transparent' : 'rgba(200,160,72,0.06)',
                    cursor: n.is_read ? 'default' : 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    {!n.is_read && (
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#c8a048', flexShrink: 0 }} />
                    )}
                    {race && <span style={{ fontSize: '0.8rem' }}>{RACE_ICONS[race]}</span>}
                    <span style={{
                      color: meta.outcome ? outcomeColor(meta.outcome) : '#c8d8e8',
                      fontSize: '0.78rem', fontWeight: 'bold',
                      fontFamily: 'Verdana, Arial, sans-serif',
                    }}>
                      {n.title}
                    </span>
                  </div>
                  <div style={{ color: '#8090a8', fontSize: '0.7rem', fontFamily: 'Verdana, Arial, sans-serif', lineHeight: '1.4' }}>
                    {n.message}
                  </div>
                  <div style={{ color: '#485868', fontSize: '0.6rem', marginTop: '3px', fontFamily: 'Verdana, Arial, sans-serif' }}>
                    {formatRelativeDate(n.created_at)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
