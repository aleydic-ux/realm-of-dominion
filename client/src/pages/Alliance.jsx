import { useState, useEffect, useRef } from 'react';
import { useProvince } from '../hooks/useProvince';
import { useSocket } from '../hooks/useSocket';
import api from '../utils/api';
import { formatNumber, formatDateTime, RACE_ICONS } from '../utils/formatters';

function StatusMsg({ ok, err }) {
  if (ok) return <div className="bg-green-900/30 border border-green-700 text-green-300 px-3 py-2 rounded text-sm">{ok}</div>;
  if (err) return <div className="bg-red-900/30 border border-red-700 text-red-300 px-3 py-2 rounded text-sm">{err}</div>;
  return null;
}

function NoAllianceView({ province }) {
  const [createName, setCreateName] = useState('');
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');
  const [alliances, setAlliances] = useState([]);

  useEffect(() => {
    api.get('/leaderboard').then(({ data }) => setAlliances(data.alliances || [])).catch(() => {});
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setErr('');
    try {
      await api.post('/alliances', { name: createName });
      setOk(`Alliance "${createName}" created!`);
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setErr(getApiError(e, 'Failed to create alliance'));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-display text-realm-gold">Alliance</h1>
      <div className="realm-panel">
        <h2 className="text-realm-gold font-display mb-3">Create Alliance</h2>
        <StatusMsg ok={ok} err={err} />
        <form onSubmit={handleCreate} className="flex gap-2 mt-2">
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
              <tr><th>#</th><th>Alliance</th><th>Members</th><th>Bank</th><th>War W/L</th><th>Total Networth</th></tr>
            </thead>
            <tbody>
              {alliances.map((a, i) => (
                <tr key={a.id}>
                  <td className="text-realm-text-dim">{i + 1}</td>
                  <td className="text-realm-text font-medium">{a.name}</td>
                  <td className="text-realm-text-muted">{a.member_count}</td>
                  <td className="text-realm-gold">{formatNumber(a.bank_gold || 0)}</td>
                  <td className="text-sm">
                    <span className="text-green-400">{a.war_wins || 0}</span>
                    <span className="text-realm-text-dim">/</span>
                    <span className="text-red-400">{a.war_losses || 0}</span>
                  </td>
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

function MembersTab({ allianceData, allianceId, myRank, myProvinceId, onRefresh, setOk, setErr }) {
  const isLeader = myRank === 'leader';
  const isOfficer = ['leader', 'officer'].includes(myRank);

  async function act(endpoint, body = {}) {
    setErr('');
    try {
      const { data } = await api.post(`/alliances/${allianceId}/${endpoint}`, body);
      setOk(data.message || 'Done');
      onRefresh();
    } catch (e) {
      setErr(getApiError(e, 'Action failed'));
    }
  }

  return (
    <div className="realm-panel overflow-x-auto">
      <table className="realm-table">
        <thead>
          <tr>
            <th>Province</th><th>Race</th><th>Land</th><th>Networth</th><th>Rank</th>
            {isOfficer && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {allianceData.members.map(m => {
            const isSelf = m.id === myProvinceId;
            const isMuted = m.chat_muted_until && new Date(m.chat_muted_until) > new Date();
            return (
              <tr key={m.id}>
                <td className="text-realm-text">{m.name}</td>
                <td className={`race-${m.race}`}>{RACE_ICONS[m.race]} {m.race}</td>
                <td>{formatNumber(m.land)}</td>
                <td className="text-realm-gold">{formatNumber(m.networth)}</td>
                <td className="text-realm-text-dim capitalize">
                  {m.rank}
                  {isMuted && <span className="ml-1 text-xs text-orange-400" title="Chat muted">🔇</span>}
                </td>
                {isOfficer && (
                  <td>
                    {!isSelf && m.rank !== 'leader' && (
                      <div className="flex gap-1 flex-wrap">
                        {isLeader && m.rank === 'member' && (
                          <button onClick={() => act('promote', { target_province_id: m.id })}
                            className="realm-btn-gold text-xs px-2 py-0.5">Promote</button>
                        )}
                        {isLeader && m.rank === 'officer' && (
                          <button onClick={() => act('demote', { target_province_id: m.id })}
                            className="realm-btn-outline text-xs px-2 py-0.5">Demote</button>
                        )}
                        {isLeader && m.rank === 'officer' && (
                          <button onClick={() => {
                            if (confirm(`Transfer leadership to ${m.name}?`))
                              act('transfer-leader', { target_province_id: m.id });
                          }} className="realm-btn-outline text-xs px-2 py-0.5 border-yellow-600 text-yellow-400">
                            Make Leader
                          </button>
                        )}
                        {isOfficer && (
                          <button onClick={() => {
                            if (confirm(`Kick ${m.name} from the alliance?`))
                              act('kick', { target_province_id: m.id });
                          }} className="realm-btn-red text-xs px-2 py-0.5">Kick</button>
                        )}
                        {isOfficer && (
                          isMuted
                            ? <button onClick={() => act('mute', { target_province_id: m.id, hours: 0 })} className="realm-btn-outline text-xs px-2 py-0.5 border-green-700 text-green-400">Unmute</button>
                            : <button onClick={() => act('mute', { target_province_id: m.id, hours: 1 })} className="realm-btn-outline text-xs px-2 py-0.5">Mute 1h</button>
                        )}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ChatTab({ allianceId, messages, setMessages, myRank, myProvinceId }) {
  const [chatInput, setChatInput] = useState('');
  const [sendErr, setSendErr] = useState('');
  const chatEndRef = useRef(null);
  const isOfficer = ['leader', 'officer'].includes(myRank);

  async function handleSend(e) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setSendErr('');
    try {
      await api.post(`/alliances/${allianceId}/chat`, { body: chatInput });
      setChatInput('');
    } catch (err) {
      setSendErr(getApiError(err, 'Failed to send'));
    }
  }

  async function deleteMsg(msgId) {
    try {
      await api.delete(`/alliances/${allianceId}/chat/${msgId}`);
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch {}
  }

  return (
    <div className="realm-panel flex flex-col" style={{ minHeight: '280px', maxHeight: '60vh' }}>
      <div className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1">
        {messages.map((m, i) => (
          <div key={m.id || i} className="text-sm flex items-start gap-2 group">
            <div className="flex-1">
              <span className={`race-${m.sender_race} font-medium`}>{m.sender_name}: </span>
              <span className="text-realm-text">{m.body}</span>
            </div>
            {isOfficer && m.id && (
              <button
                onClick={() => deleteMsg(m.id)}
                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-300 text-xs shrink-0 transition-opacity"
                title="Delete message"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      {sendErr && <div className="text-red-400 text-xs mb-1">{sendErr}</div>}
      <form onSubmit={handleSend} className="flex gap-2">
        <input className="realm-input flex-1 text-sm" placeholder="Send message..."
          value={chatInput} onChange={e => setChatInput(e.target.value)} />
        <button type="submit" className="realm-btn-gold text-sm">Send</button>
      </form>
    </div>
  );
}

const BUFF_LABELS = {
  gold_rush: { icon: '💰', name: 'Gold Rush', desc: '+15% gold production for 24h', cost: 5000 },
  war_drums: { icon: '🥁', name: 'War Drums', desc: '+20% attack power for 12h', cost: 8000 },
  iron_pact: { icon: '🛡️', name: 'Iron Pact', desc: '+20% defense for 12h', cost: 8000 },
  scholars_call: { icon: '📚', name: "Scholar's Call", desc: '+25% research speed for 48h', cost: 6000 },
};

function BuffsTab({ allianceId, bankGold, onRefresh, setOk, setErr }) {
  const [buffs, setBuffs] = useState([]);

  useEffect(() => {
    api.get(`/alliances/${allianceId}/buffs`).then(({ data }) => setBuffs(data.active || [])).catch(() => {});
  }, [allianceId]);

  async function purchase(buffKey) {
    setErr('');
    try {
      const { data } = await api.post(`/alliances/${allianceId}/buff`, { buff_key: buffKey });
      setOk(data.message || 'Buff purchased!');
      onRefresh();
      api.get(`/alliances/${allianceId}/buffs`).then(({ data }) => setBuffs(data.active || [])).catch(() => {});
    } catch (e) {
      setErr(getApiError(e, 'Purchase failed'));
    }
  }

  const activeKeys = new Set(buffs.map(b => b.buff_key));

  return (
    <div className="realm-panel space-y-4">
      {buffs.length > 0 && (
        <div>
          <h3 className="text-realm-gold font-display mb-2">Active Buffs</h3>
          <div className="space-y-1">
            {buffs.map(b => (
              <div key={b.id} className="flex items-center justify-between bg-green-900/20 border border-green-800/40 rounded px-3 py-1.5">
                <span className="text-sm text-green-300">{BUFF_LABELS[b.buff_key]?.icon} {b.buff_name}</span>
                <span className="text-xs text-realm-text-dim">expires {formatDateTime(b.expires_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <h3 className="text-realm-gold font-display mb-2">Purchase Buffs</h3>
        <p className="text-xs text-realm-text-dim mb-3">Alliance Bank: <span className="text-realm-gold">{formatNumber(bankGold)} gold</span></p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(BUFF_LABELS).map(([key, b]) => {
            const isActive = activeKeys.has(key);
            const canAfford = bankGold >= b.cost;
            return (
              <div key={key} className={`border rounded p-3 flex flex-col gap-2 ${isActive ? 'border-green-700 bg-green-900/10' : 'border-realm-border bg-realm-panel'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{b.icon}</span>
                  <div>
                    <div className="text-realm-text font-medium text-sm">{b.name}</div>
                    <div className="text-realm-text-dim text-xs">{b.desc}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-realm-gold text-xs">{formatNumber(b.cost)} gold</span>
                  {isActive ? (
                    <span className="text-xs text-green-400 font-medium">ACTIVE</span>
                  ) : (
                    <button
                      onClick={() => purchase(key)}
                      disabled={!canAfford}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                        canAfford
                          ? 'border-realm-gold text-realm-gold hover:bg-realm-gold/10'
                          : 'border-realm-border text-realm-text-dim cursor-not-allowed'
                      }`}
                    >
                      Purchase
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ManageTab({ allianceId, allianceData, myRank, myProvinceId, onRefresh, setOk, setErr }) {
  const isLeader = myRank === 'leader';
  const isOfficer = ['leader', 'officer'].includes(myRank);
  const [inviteId, setInviteId] = useState('');
  const [warTarget, setWarTarget] = useState('');
  const [napTarget, setNapTarget] = useState('');

  async function act(endpoint, body = {}, msg) {
    setErr('');
    try {
      const { data } = await api.post(`/alliances/${allianceId}/${endpoint}`, body);
      setOk(data.message || msg || 'Done');
      onRefresh();
    } catch (e) {
      setErr(getApiError(e, 'Action failed'));
    }
  }

  return (
    <div className="realm-panel space-y-5">
      {isOfficer && (
        <div>
          <h3 className="text-realm-gold font-display mb-2">Invite Member</h3>
          <form onSubmit={async e => { e.preventDefault(); await act('invite', { target_province_id: parseInt(inviteId) }, 'Invited!'); setInviteId(''); }}
            className="flex gap-2">
            <input className="realm-input text-sm" placeholder="Province ID" value={inviteId}
              onChange={e => setInviteId(e.target.value)} type="number" />
            <button type="submit" className="realm-btn-gold text-sm whitespace-nowrap">Invite</button>
          </form>
        </div>
      )}

      {isLeader && (
        <>
          <div>
            <h3 className="text-realm-gold font-display mb-2">Declare War</h3>
            <div className="flex gap-2">
              <input className="realm-input text-sm" placeholder="Enemy Alliance ID" value={warTarget}
                onChange={e => setWarTarget(e.target.value)} type="number" />
              <button
                onClick={() => { if (warTarget) act(`declare-war/${warTarget}`, {}, 'War declared!'); }}
                className="realm-btn-red text-sm whitespace-nowrap"
              >
                Declare War
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-realm-gold font-display mb-2">Non-Aggression Pact (48h)</h3>
            <div className="flex gap-2">
              <input className="realm-input text-sm" placeholder="Target Alliance ID" value={napTarget}
                onChange={e => setNapTarget(e.target.value)} type="number" />
              <button
                onClick={() => { if (napTarget) act(`nap/${napTarget}`, {}, 'NAP established!'); }}
                className="realm-btn-outline text-sm whitespace-nowrap"
              >
                Propose NAP
              </button>
            </div>
          </div>

          {allianceData?.alliance?.is_at_war && (
            <div>
              <h3 className="text-realm-gold font-display mb-2">End All Wars</h3>
              <button
                onClick={() => { if (confirm('End all wars and return to peace?')) act('peace', {}, 'Peace declared.'); }}
                className="realm-btn-outline text-sm border-green-700 text-green-400"
              >
                Declare Peace
              </button>
            </div>
          )}
        </>
      )}

      <div>
        <h3 className="text-red-400 font-display mb-2">Leave Alliance</h3>
        <button
          onClick={() => {
            const warning = isLeader
              ? 'As leader, leaving will disband the alliance if you have no officers. Continue?'
              : 'Leave this alliance?';
            if (confirm(warning)) act('leave', {}, 'You have left the alliance.');
          }}
          className="realm-btn-red text-sm"
        >
          Leave Alliance
        </button>
      </div>
    </div>
  );
}

export default function Alliance({ province }) {
  const { alliance } = useProvince();
  const { joinAlliance, onMessage } = useSocket();
  const [allianceData, setAllianceData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [activeTab, setActiveTab] = useState('members');
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');

  usePageTitle('Alliance');

  useEffect(() => {
    if (alliance) {
      loadAlliance(alliance.id);
      joinAlliance(alliance.id);
    }
  }, [alliance]);

  useEffect(() => {
    if (alliance) {
      const cleanup = onMessage(msg => {
        setMessages(prev => [...prev, msg]);
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

  function refresh() { if (alliance) loadAlliance(alliance.id); }

  function showOk(msg) { setOk(msg); setErr(''); setTimeout(() => setOk(''), 3000); }
  function showErr(msg) { setErr(msg); setOk(''); }

  if (!alliance) return <NoAllianceView province={province} />;

  const isLeader = alliance.rank === 'leader';
  const isOfficer = ['leader', 'officer'].includes(alliance.rank);
  const tabs = ['members', 'chat', 'buffs', 'manage'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-display text-realm-gold">
          {allianceData?.alliance?.name || 'Alliance'}
        </h1>
        <div className="flex gap-2 flex-wrap">
          {allianceData?.alliance?.is_at_war && (
            <span className="realm-badge bg-red-900/40 border-red-600 text-red-400">⚔️ AT WAR</span>
          )}
          <span className="realm-badge border-realm-gold text-realm-gold bg-transparent capitalize">{alliance.rank}</span>
        </div>
      </div>

      <StatusMsg ok={ok} err={err} />

      {allianceData?.alliance && (
        <div className="realm-panel flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-4 flex-wrap text-sm">
            <div>
              <span className="text-realm-text-muted">Bank: </span>
              <span className="text-realm-gold font-bold">{formatNumber(allianceData.alliance.bank_gold)} gold</span>
            </div>
            <div>
              <span className="text-realm-text-muted">War Record: </span>
              <span className="text-green-400">{allianceData.alliance.war_wins || 0}W</span>
              <span className="text-realm-text-dim"> / </span>
              <span className="text-red-400">{allianceData.alliance.war_losses || 0}L</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={async () => {
              const amt = parseInt(prompt('Deposit amount:') || '0');
              if (amt > 0) {
                try { await api.post(`/alliances/${alliance.id}/deposit`, { amount: amt }); refresh(); showOk('Deposited!'); }
                catch (e) { showErr(getApiError(e, 'Failed')); }
              }
            }} className="realm-btn-gold text-xs">Deposit</button>
            {isLeader && (
              <button onClick={async () => {
                const amt = parseInt(prompt('Withdraw amount:') || '0');
                if (amt > 0) {
                  try { await api.post(`/alliances/${alliance.id}/withdraw`, { amount: amt }); refresh(); showOk('Withdrawn!'); }
                  catch (e) { showErr(getApiError(e, 'Failed')); }
                }
              }} className="realm-btn-outline text-xs">Withdraw</button>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-realm-border pb-2">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-t text-sm capitalize transition-colors ${
              activeTab === tab
                ? 'bg-realm-panel border-t border-x border-realm-border text-realm-gold'
                : 'text-realm-text-muted hover:text-realm-gold'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'members' && allianceData?.members && (
        <MembersTab
          allianceData={allianceData}
          allianceId={alliance.id}
          myRank={alliance.rank}
          myProvinceId={province?.id}
          onRefresh={refresh}
          setOk={showOk}
          setErr={showErr}
        />
      )}

      {activeTab === 'chat' && (
        <ChatTab allianceId={alliance.id} messages={messages} setMessages={setMessages} myRank={alliance.rank} myProvinceId={province?.id} />
      )}

      {activeTab === 'buffs' && allianceData?.alliance && (
        <BuffsTab
          allianceId={alliance.id}
          bankGold={allianceData.alliance.bank_gold || 0}
          onRefresh={refresh}
          setOk={showOk}
          setErr={showErr}
        />
      )}

      {activeTab === 'manage' && (
        <ManageTab
          allianceId={alliance.id}
          allianceData={allianceData}
          myRank={alliance.rank}
          myProvinceId={province?.id}
          onRefresh={refresh}
          setOk={showOk}
          setErr={showErr}
        />
      )}
    </div>
  );
}
