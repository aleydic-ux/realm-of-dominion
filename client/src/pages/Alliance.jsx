import { useState, useEffect, useRef } from 'react';
import { useProvince } from '../hooks/useProvince';
import { useSocket } from '../hooks/useSocket';
import api from '../utils/api';
import { formatNumber, formatDateTime, RACE_ICONS } from '../utils/formatters';

export default function Alliance({ province }) {
  const { alliance } = useProvince();
  const { joinAlliance, onMessage } = useSocket();
  const [allianceData, setAllianceData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState('members');
  const [inviteId, setInviteId] = useState('');
  const [createName, setCreateName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [alliances, setAlliances] = useState([]);
  const chatEndRef = useRef(null);

  useEffect(() => { document.title = 'Alliance — Realm of Dominion'; }, []);

  useEffect(() => {
    if (alliance) {
      loadAlliance(alliance.id);
      joinAlliance(alliance.id);
    }
  }, [alliance]);

  useEffect(() => {
    if (alliance) {
      const cleanup = onMessage((msg) => {
        setMessages(prev => [...prev, msg]);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      });
      return cleanup;
    }
  }, [alliance, onMessage]);

  async function loadAlliance(id) {
    try {
      const [alliRes, chatRes] = await Promise.all([
        api.get(`/alliances/${id}`),
        api.get(`/alliances/${id}/chat`),
      ]);
      setAllianceData(alliRes.data);
      setMessages(chatRes.data);
    } catch {}
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/alliances', { name: createName });
      setMessage(`Alliance "${createName}" created!`);
      window.location.reload();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create alliance');
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/alliances/${alliance.id}/invite`, { target_province_id: parseInt(inviteId) });
      setMessage('Province invited!');
      setInviteId('');
      loadAlliance(alliance.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to invite');
    }
  }

  async function handleSendChat(e) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    try {
      await api.post(`/alliances/${alliance.id}/chat`, { body: chatInput });
      setChatInput('');
    } catch {}
  }

  useEffect(() => {
    if (!alliance) {
      api.get('/leaderboard').then(({ data }) => setAlliances(data.alliances || [])).catch(() => {});
    }
  }, [alliance]);

  if (!alliance) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-display text-realm-gold">Alliance</h1>
        <div className="realm-panel">
          <h2 className="text-realm-gold font-display mb-3">Create Alliance</h2>
          {message && <div className="text-green-400 text-sm mb-2">{message}</div>}
          {error && <div className="text-red-400 text-sm mb-2">{error}</div>}
          <form onSubmit={handleCreate} className="flex gap-2">
            <input className="realm-input" placeholder="Alliance name" value={createName}
              onChange={e => setCreateName(e.target.value)} required />
            <button type="submit" className="realm-btn-gold whitespace-nowrap">Create</button>
          </form>
          <p className="text-realm-text-dim text-xs mt-2">Or ask an existing leader to invite you by Province ID.</p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-realm-text-muted">Your Province ID:</span>
            <code className="bg-gray-900 border border-realm-border text-realm-gold px-2 py-0.5 rounded text-sm font-mono select-all">
              {province?.id ?? '...'}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(String(province?.id ?? ''))}
              disabled={!province?.id}
              className="text-xs text-realm-text-dim hover:text-realm-gold transition-colors"
              aria-label="Copy Province ID"
            >
              Copy
            </button>
          </div>
        </div>

        {alliances.length > 0 && (
          <div className="realm-panel overflow-x-auto">
            <h2 className="text-realm-gold font-display mb-3">Existing Alliances</h2>
            <table className="realm-table">
              <thead>
                <tr><th>#</th><th>Alliance</th><th>Members</th><th>Total Networth</th></tr>
              </thead>
              <tbody>
                {alliances.map((a, i) => (
                  <tr key={a.id}>
                    <td className="text-realm-text-dim">{i + 1}</td>
                    <td className="text-realm-text font-medium">{a.name}</td>
                    <td className="text-realm-text-muted">{a.member_count}</td>
                    <td className="text-realm-gold">{formatNumber(a.total_networth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  const isLeader = alliance.rank === 'leader';
  const isOfficer = ['leader','officer'].includes(alliance.rank);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-display text-realm-gold">
          {allianceData?.alliance?.name || 'Alliance'}
        </h1>
        <div className="flex gap-2">
          {allianceData?.alliance?.is_at_war && (
            <span className="realm-badge bg-red-900/40 border-red-600 text-red-400">⚔️ AT WAR</span>
          )}
          <span className="realm-badge border-realm-gold text-realm-gold bg-transparent">{alliance.rank}</span>
        </div>
      </div>

      {message && <div className="bg-green-900/30 border border-green-700 text-green-300 px-3 py-2 rounded text-sm">{message}</div>}
      {error && <div className="bg-red-900/30 border border-red-700 text-red-300 px-3 py-2 rounded text-sm">{error}</div>}

      {/* Bank */}
      {allianceData?.alliance && (
        <div className="realm-panel flex items-center justify-between">
          <div>
            <span className="text-realm-text-muted text-sm">Alliance Bank: </span>
            <span className="text-realm-gold font-bold">{formatNumber(allianceData.alliance.bank_gold)} gold</span>
          </div>
          <div className="flex gap-2">
            <button onClick={async () => {
              const amt = parseInt(prompt('Deposit amount:') || '0');
              if (amt > 0) {
                try { await api.post(`/alliances/${alliance.id}/deposit`, { amount: amt }); loadAlliance(alliance.id); }
                catch (err) { setError(err.response?.data?.error || 'Failed'); }
              }
            }} className="realm-btn-gold text-xs">Deposit</button>
            {isLeader && (
              <button onClick={async () => {
                const amt = parseInt(prompt('Withdraw amount:') || '0');
                if (amt > 0) {
                  try { await api.post(`/alliances/${alliance.id}/withdraw`, { amount: amt }); loadAlliance(alliance.id); }
                  catch (err) { setError(err.response?.data?.error || 'Failed'); }
                }
              }} className="realm-btn-outline text-xs">Withdraw</button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-realm-border pb-2">
        {['members', 'chat', 'manage'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-t text-sm capitalize transition-colors ${
              activeTab === tab ? 'bg-realm-panel border-t border-x border-realm-border text-realm-gold' : 'text-realm-text-muted hover:text-realm-gold'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'members' && allianceData?.members && (
        <div className="realm-panel overflow-x-auto">
          <table className="realm-table">
            <thead><tr><th>Province</th><th>Race</th><th>Land</th><th>Networth</th><th>Rank</th></tr></thead>
            <tbody>
              {allianceData.members.map(m => (
                <tr key={m.id}>
                  <td className="text-realm-text">{m.name}</td>
                  <td className={`race-${m.race}`}>{RACE_ICONS[m.race]} {m.race}</td>
                  <td>{formatNumber(m.land)}</td>
                  <td className="text-realm-gold">{formatNumber(m.networth)}</td>
                  <td className="text-realm-text-dim">{m.rank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="realm-panel flex flex-col" style={{ height: '400px' }}>
          <div className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1">
            {messages.map((m, i) => (
              <div key={m.id || i} className="text-sm">
                <span className={`race-${m.sender_race} font-medium`}>{m.sender_name}: </span>
                <span className="text-realm-text">{m.body}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSendChat} className="flex gap-2">
            <input className="realm-input flex-1 text-sm" placeholder="Send message..."
              value={chatInput} onChange={e => setChatInput(e.target.value)} />
            <button type="submit" className="realm-btn-gold text-sm">Send</button>
          </form>
        </div>
      )}

      {activeTab === 'manage' && isOfficer && (
        <div className="realm-panel space-y-4">
          <div>
            <h3 className="text-realm-gold font-display mb-2">Invite by Province ID</h3>
            <form onSubmit={handleInvite} className="flex gap-2">
              <input className="realm-input text-sm" placeholder="Province ID" value={inviteId}
                onChange={e => setInviteId(e.target.value)} type="number" />
              <button type="submit" className="realm-btn-gold text-sm whitespace-nowrap">Invite</button>
            </form>
          </div>
          {isLeader && (
            <div>
              <h3 className="text-realm-gold font-display mb-2">Declare War</h3>
              <div className="flex gap-2">
                <input className="realm-input text-sm" placeholder="Enemy Alliance ID" id="war-target" type="number" />
                <button
                  onClick={async () => {
                    const targetId = document.getElementById('war-target').value;
                    if (!targetId) return;
                    try {
                      await api.post(`/alliances/${alliance.id}/war/${targetId}`);
                      setMessage('War declared!');
                    } catch (err) { setError(err.response?.data?.error || 'Failed'); }
                  }}
                  className="realm-btn-red text-sm whitespace-nowrap"
                >
                  Declare War
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
