import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function WorldFeed({ province }) {
  const [feed, setFeed] = useState([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const prevLengthRef = useRef(0);

  async function loadFeed() {
    try {
      const { data } = await api.get('/feed');
      setFeed(data);
    } catch {}
  }

  useEffect(() => { document.title = 'World — Realm of Dominion'; }, []);

  useEffect(() => {
    loadFeed();
    const interval = setInterval(loadFeed, 10000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (feed.length > prevLengthRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevLengthRef.current = feed.length;
  }, [feed.length]);

  async function handleSend(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setError('');
    try {
      await api.post('/feed/chat', { message });
      setMessage('');
      await loadFeed();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  const events = feed.filter(f => f.type === 'event');
  const chats = feed.filter(f => f.type === 'chat');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-display text-realm-gold">World Feed</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Recent Battles */}
        <div className="realm-panel" style={{display:'flex', flexDirection:'column', gap:'0'}}>
          <div className="realm-section-header" style={{margin:'-12px -12px 10px -12px'}}>
            Recent Battles
          </div>
          <div style={{overflowY:'auto', maxHeight:'500px'}}>
            {events.length === 0 && (
              <div className="py-6 text-center space-y-1">
                <div className="text-2xl">🏰</div>
                <p className="text-realm-text-muted text-xs font-medium">The realm is quiet...</p>
                <p className="text-realm-text-dim text-xs">No battles recorded yet. Be the first to make history.</p>
              </div>
            )}
            {[...events].reverse().map(entry => (
              <div key={entry.id} style={{
                padding: '8px 0',
                borderBottom: '1px solid #1e3050',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}>
                <span style={{
                  fontSize: '0.72rem',
                  color: entry.message.includes('VICTORIOUS') ? '#c8a048' : '#8090a8',
                  lineHeight: '1.4',
                }}>
                  {entry.message}
                </span>
                <span style={{fontSize:'0.6rem', color:'#485868'}}>{timeAgo(entry.created_at)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div className="realm-panel" style={{display:'flex', flexDirection:'column', gap:'8px'}}>
          <div className="realm-section-header" style={{margin:'-12px -12px 10px -12px'}}>
            World Chat
          </div>

          {/* Messages */}
          <div style={{flex:1, overflowY:'auto', maxHeight:'420px', display:'flex', flexDirection:'column', gap:'4px'}}>
            {chats.length === 0 && (
              <p className="text-realm-text-dim text-xs py-4 text-center">No messages yet. Say hello!</p>
            )}
            {chats.map(entry => (
              <div key={entry.id} style={{padding:'5px 6px', background:'#111828', borderLeft:'2px solid #243650'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:'2px'}}>
                  <span style={{fontSize:'0.7rem', fontWeight:'bold', color:'#c8a048'}}>{entry.author_name}</span>
                  <span style={{fontSize:'0.6rem', color:'#485868'}}>{timeAgo(entry.created_at)}</span>
                </div>
                <div style={{fontSize:'0.75rem', color:'#c8d8e8'}}>{entry.message}</div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {error && <div style={{color:'#cc2828', fontSize:'0.7rem'}}>{error}</div>}
          <form onSubmit={handleSend} style={{display:'flex', gap:'6px'}}>
            <input
              className="realm-input"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Say something to the world..."
              maxLength={300}
              style={{flex:1}}
            />
            <button
              type="submit"
              className="realm-btn-gold"
              disabled={sending || !message.trim()}
            >
              Send
            </button>
          </form>
          <div style={{fontSize:'0.6rem', color:'#485868', textAlign:'right'}}>{message.length}/300</div>
        </div>

      </div>
    </div>
  );
}
