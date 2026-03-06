import { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatNumber, RESOURCE_ICONS } from '../utils/formatters';

export default function Marketplace({ province, refresh }) {
  const [listings, setListings] = useState([]);
  const [stats, setStats] = useState([]);
  const [form, setForm] = useState({ resource_type: 'food', quantity: '', price_per_unit: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  async function loadListings() {
    try {
      const [listRes, statsRes] = await Promise.all([
        api.get('/marketplace'),
        api.get('/marketplace/stats'),
      ]);
      setListings(listRes.data);
      setStats(statsRes.data);
    } catch {}
  }

  useEffect(() => { document.title = 'Marketplace — Realm of Dominion'; }, []);
  useEffect(() => { loadListings(); }, []);

  async function handleList(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);
    try {
      await api.post('/marketplace/list', form);
      setMessage(`Listed ${formatNumber(form.quantity)} ${form.resource_type} at ${form.price_per_unit} gold each`);
      setForm({ ...form, quantity: '', price_per_unit: '' });
      loadListings();
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create listing');
    } finally {
      setLoading(false);
    }
  }

  async function handleBuy(listingId) {
    setError('');
    setMessage('');
    try {
      const { data } = await api.post(`/marketplace/buy/${listingId}`);
      setMessage(`Purchase complete! Paid ${formatNumber(data.total_paid)} gold (incl. ${formatNumber(data.tax)} tax)`);
      loadListings();
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Purchase failed');
    }
  }

  const isUndead = province?.race === 'undead';
  const filtered = filter === 'all' ? listings : listings.filter(l => l.resource_type === filter);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-display text-realm-gold">Marketplace</h1>

      {message && <div className="bg-green-900/30 border border-green-700 text-green-300 px-3 py-2 rounded text-sm">{message}</div>}
      {error && <div className="bg-red-900/30 border border-red-700 text-red-300 px-3 py-2 rounded text-sm">{error}</div>}

      {/* Stats */}
      {stats.length > 0 && (
        <div className="realm-panel">
          <h2 className="text-realm-gold-dark font-display mb-2 text-sm">Market Averages</h2>
          <div className="flex flex-wrap gap-4">
            {stats.map(s => (
              <div key={s.resource_type} className="text-sm">
                <span className="text-realm-text-muted">{RESOURCE_ICONS[s.resource_type]} {s.resource_type}: </span>
                <span className="text-realm-gold">{s.avg_price}g avg</span>
                <span className="text-realm-text-dim ml-1">({s.transaction_count} sales)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Post Listing */}
        <div className="realm-panel">
          <h2 className="text-realm-gold font-display mb-3">Post Listing</h2>
          {isUndead ? (
            <div className="text-red-400 text-sm">☠️ Undead provinces cannot post listings (lore restriction)</div>
          ) : (
            <form onSubmit={handleList} className="space-y-3">
              <div>
                <label className="text-realm-text-muted text-xs block mb-1">Resource</label>
                <select className="realm-input" value={form.resource_type} onChange={e => setForm({ ...form, resource_type: e.target.value })}>
                  <option value="food">Food</option>
                  <option value="mana">Mana</option>
                  <option value="production_points">Industry</option>
                  <option value="gold">Gold</option>
                </select>
              </div>
              <div>
                <label className="text-realm-text-muted text-xs block mb-1">Quantity</label>
                <input className="realm-input" type="number" min="1" value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: e.target.value })} required />
                <div className="text-xs text-realm-text-dim mt-1">
                  Available: {formatNumber(province?.[form.resource_type] || 0)}
                </div>
              </div>
              <div>
                <label className="text-realm-text-muted text-xs block mb-1">Price per unit (gold)</label>
                <input className="realm-input" type="number" min="0.01" step="0.01" value={form.price_per_unit}
                  onChange={e => setForm({ ...form, price_per_unit: e.target.value })} required />
              </div>
              <div className="text-xs text-realm-text-dim">
                Expires in 24h. 5% tax on buyer. 1 AP.
                {province?.race === 'human' && <span className="text-green-400 block">Human: +20% sale proceeds</span>}
              </div>
              <button type="submit" className="realm-btn-gold w-full" disabled={loading || (province?.action_points || 0) < 1}>
                {loading ? 'Listing...' : 'Post (1 AP)'}
              </button>
            </form>
          )}
        </div>

        {/* Active Listings */}
        <div className="lg:col-span-2 realm-panel">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-realm-gold font-display">Active Listings ({listings.length})</h2>
            <select className="realm-input w-auto text-xs" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="food">Food</option>
              <option value="mana">Mana</option>
              <option value="production_points">Production</option>
              <option value="gold">Gold</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="realm-table">
              <thead>
                <tr>
                  <th>Resource</th>
                  <th>Qty</th>
                  <th>Price/unit</th>
                  <th>Total</th>
                  <th>Seller</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const total = Math.ceil(l.quantity * l.price_per_unit * 1.05);
                  const canAfford = (province?.gold || 0) >= total;
                  const isMine = l.seller_id === province?.id;
                  return (
                    <tr key={l.id}>
                      <td>{RESOURCE_ICONS[l.resource_type]} {l.resource_type}</td>
                      <td>{formatNumber(l.quantity)}</td>
                      <td className="text-realm-gold">{l.price_per_unit}g</td>
                      <td className="text-yellow-400">{formatNumber(total)}g</td>
                      <td className="text-realm-text-dim text-xs">{l.seller_name} <span className={`race-${l.seller_race}`}>[{l.seller_race}]</span></td>
                      <td>
                        {!isMine && (
                          <button
                            onClick={() => handleBuy(l.id)}
                            disabled={!canAfford || (province?.action_points || 0) < 1}
                            className="realm-btn-gold text-xs py-1 px-2"
                          >
                            Buy
                          </button>
                        )}
                        {isMine && <span className="text-realm-text-dim text-xs">Mine</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filtered.length && <p className="text-realm-text-dim text-sm py-4 text-center">No listings.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
