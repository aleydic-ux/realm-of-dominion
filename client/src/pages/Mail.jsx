import { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatDateTime } from '../utils/formatters';

export default function Mail({ province, onRead }) {
  const [tab, setTab] = useState('inbox');
  const [inbox, setInbox] = useState([]);
  const [sent, setSent] = useState([]);
  const [selected, setSelected] = useState(null);
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({ recipient_province_id: '', subject: '', body: '' });
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  usePageTitle('Mail');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [inboxRes, sentRes] = await Promise.all([
        api.get('/mail'),
        api.get('/mail/sent'),
      ]);
      setInbox(inboxRes.data);
      setSent(sentRes.data);
    } catch {}
    setLoading(false);
  }

  async function openMsg(msg) {
    setSelected(msg);
    if (!msg.read_at && tab === 'inbox') {
      await api.patch(`/mail/${msg.id}/read`).catch(() => {});
      setInbox(prev => prev.map(m => m.id === msg.id ? { ...m, read_at: new Date().toISOString() } : m));
      onRead?.();
    }
  }

  async function deleteMsg(msg) {
    await api.delete(`/mail/${msg.id}`).catch(() => {});
    if (tab === 'inbox') setInbox(prev => prev.filter(m => m.id !== msg.id));
    else setSent(prev => prev.filter(m => m.id !== msg.id));
    if (selected?.id === msg.id) setSelected(null);
  }

  async function sendMail(e) {
    e.preventDefault();
    setErr('');
    try {
      const { data } = await api.post('/mail', {
        recipient_province_id: parseInt(form.recipient_province_id),
        subject: form.subject,
        body: form.body,
      });
      setOk(data.message || 'Mail sent!');
      setComposing(false);
      setForm({ recipient_province_id: '', subject: '', body: '' });
      loadAll();
      setTimeout(() => setOk(''), 3000);
    } catch (e) {
      setErr(getApiError(e, 'Failed to send'));
    }
  }

  function replyTo(msg) {
    setForm({
      recipient_province_id: String(msg.sender_id || ''),
      subject: msg.subject?.startsWith('Re:') ? msg.subject : `Re: ${msg.subject || 'No subject'}`,
      body: '',
    });
    setComposing(true);
    setSelected(null);
  }

  const list = tab === 'inbox' ? inbox : sent;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-display text-realm-gold">Mail</h1>
        <button onClick={() => { setComposing(true); setSelected(null); }} className="realm-btn-gold text-sm">
          ✉ Compose
        </button>
      </div>

      {ok && <div className="bg-green-900/30 border border-green-700 text-green-300 px-3 py-2 rounded text-sm">{ok}</div>}

      {composing && (
        <div className="realm-panel space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-realm-gold font-display">New Message</h3>
            <button onClick={() => setComposing(false)} className="text-realm-text-muted hover:text-realm-text text-lg">✕</button>
          </div>
          {err && <div className="text-red-400 text-xs">{err}</div>}
          <form onSubmit={sendMail} className="space-y-2">
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex-1 min-w-0">
                <label className="text-xs text-realm-text-dim block mb-1">To (Province ID)</label>
                <input className="realm-input" type="number" placeholder="Province ID"
                  value={form.recipient_province_id}
                  onChange={e => setForm(f => ({ ...f, recipient_province_id: e.target.value }))}
                  required />
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-xs text-realm-text-dim block mb-1">Your Province ID (share to receive mail)</label>
                <div className="realm-input bg-realm-panel/50 text-realm-text-dim select-all">{province?.id ?? '...'}</div>
              </div>
            </div>
            <div>
              <label className="text-xs text-realm-text-dim block mb-1">Subject</label>
              <input className="realm-input" placeholder="Subject (optional)"
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                maxLength={100} />
            </div>
            <div>
              <label className="text-xs text-realm-text-dim block mb-1">Message</label>
              <textarea className="realm-input resize-none" rows={5} placeholder="Write your message..."
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                required maxLength={4000} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="realm-btn-gold text-sm">Send</button>
              <button type="button" onClick={() => setComposing(false)} className="realm-btn-outline text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-1 border-b border-realm-border pb-2">
        {['inbox', 'sent'].map(t => (
          <button key={t} onClick={() => { setTab(t); setSelected(null); }}
            className={`px-4 py-1.5 rounded-t text-sm capitalize transition-colors ${
              tab === t ? 'bg-realm-panel border-t border-x border-realm-border text-realm-gold' : 'text-realm-text-muted hover:text-realm-gold'
            }`}>
            {t}
            {t === 'inbox' && inbox.filter(m => !m.read_at).length > 0 && (
              <span className="ml-1.5 text-xs bg-red-700 text-white rounded-full px-1.5">{inbox.filter(m => !m.read_at).length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: selected ? '1fr 1fr' : '1fr' }}>
        {/* Message list */}
        <div className="realm-panel p-0 overflow-hidden">
          {loading && <div className="p-4 text-realm-text-muted text-sm">Loading...</div>}
          {!loading && list.length === 0 && (
            <div className="p-6 text-center text-realm-text-dim text-sm">
              {tab === 'inbox' ? 'No messages yet. Share your Province ID for others to contact you.' : 'No sent mail yet.'}
            </div>
          )}
          {list.map(m => {
            const isUnread = tab === 'inbox' && !m.read_at;
            const isSelected = selected?.id === m.id;
            return (
              <div
                key={m.id}
                onClick={() => openMsg(m)}
                className={`flex items-start gap-3 px-3 py-2.5 border-b border-realm-border cursor-pointer transition-colors ${
                  isSelected ? 'bg-realm-gold/5 border-l-2 border-l-realm-gold' : 'hover:bg-white/5'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isUnread && <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />}
                    <span className={`text-xs truncate ${isUnread ? 'text-realm-text font-bold' : 'text-realm-text-muted'}`}>
                      {tab === 'inbox' ? `From: ${m.sender_name}` : `To: ${m.recipient_name}`}
                    </span>
                  </div>
                  <div className={`text-xs truncate mt-0.5 ${isUnread ? 'text-realm-text' : 'text-realm-text-dim'}`}>
                    {m.subject || 'No subject'}
                  </div>
                  <div className="text-xs text-realm-text-dim mt-0.5">{formatDateTime(m.created_at)}</div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteMsg(m); }}
                  className="text-realm-text-dim hover:text-red-400 text-xs shrink-0 px-1"
                  title="Delete"
                >
                  🗑
                </button>
              </div>
            );
          })}
        </div>

        {/* Message detail */}
        {selected && (
          <div className="realm-panel space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-realm-gold font-display text-sm">{selected.subject || 'No subject'}</h3>
                <div className="text-xs text-realm-text-dim mt-0.5">
                  {tab === 'inbox' ? `From: ${selected.sender_name}` : `To: ${selected.recipient_name}`}
                  {' · '}{formatDateTime(selected.created_at)}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-realm-text-muted hover:text-realm-text text-lg shrink-0">✕</button>
            </div>
            <hr className="realm-divider" />
            <p className="text-sm text-realm-text whitespace-pre-wrap">{selected.body}</p>
            <div className="flex gap-2 pt-2">
              {tab === 'inbox' && (
                <button onClick={() => replyTo(selected)} className="realm-btn-gold text-xs">Reply</button>
              )}
              <button onClick={() => deleteMsg(selected)} className="realm-btn-red text-xs">Delete</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
