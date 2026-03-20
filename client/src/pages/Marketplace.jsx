import { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatNumber, RESOURCE_ICONS } from '../utils/formatters';

const ITEM_NAMES = {
  minor_mana_potion: 'Minor Mana Potion',
  shield_draught:    'Shield Draught',
  war_elixir:        'War Elixir',
  berserker_brew:    'Berserker Brew',
  harvest_tonic:     'Harvest Tonic',
  gold_infusion:     'Gold Infusion',
  industry_surge:    'Industry Surge',
  plague_vial:       'Plague Vial',
  chaos_dust:        'Chaos Dust',
  mana_drain:        'Mana Drain',
};

export default function Marketplace({ province, refresh }) {
  const [listings, setListings] = useState([]);
  const [stats, setStats] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [listingMode, setListingMode] = useState('resource'); // 'resource' | 'item'
  const [form, setForm] = useState({ resource_type: 'food', item_key: '', quantity: '', price_per_unit: '' });
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

  async function loadInventory() {
    try {
      const { data } = await api.get('/crafting/inventory');
      setInventory(data);
    } catch {}
  }

  usePageTitle('Marketplace');
  useEffect(() => { loadListings(); loadInventory(); }, []);

  async function handleList(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);
    try {
      const payload = listingMode === 'item'
        ? { item_key: form.item_key, quantity: form.quantity, price_per_unit: form.price_per_unit }
        : { resource_type: form.resource_type, quantity: form.quantity, price_per_unit: form.price_per_unit };
      await api.post('/marketplace/list', payload);
      const label = listingMode === 'item'
        ? `${formatNumber(form.quantity)}x ${ITEM_NAMES[form.item_key] || form.item_key}`
        : `${formatNumber(form.quantity)} ${form.resource_type}`;
      setMessage(`Listed ${label} at ${form.price_per_unit} gold each`);
      setForm({ ...form, quantity: '', price_per_unit: '' });
      loadListings();
      loadInventory();
      refresh();
    } catch (err) {
      setError(getApiError(err, 'Failed to create listing'));
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
      loadInventory();
      refresh();
    } catch (err) {
      setError(getApiError(err, 'Purchase failed'));
    }
  }

  const isUndead = province?.race === 'undead';
  const filtered = filter === 'all'
    ? listings
    : filter === 'items'
      ? listings.filter(l => l.item_key)
      : listings.filter(l => l.resource_type === filter);

  const selectedInv = inventory.find(i => i.item_key === form.item_key);

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
              <div key={s.type} className="text-sm">
                <span className="text-realm-text-muted">{RESOURCE_ICONS[s.type] || '⚗'} {ITEM_NAMES[s.type] || s.type}: </span>
                <span className="text-realm-gold">{s.avg_price}g avg</span>
                <span className="text-realm-text-dim ml-1">({s.transaction_count} sale{s.transaction_count !== 1 ? 's' : ''})</span>
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
            <>
              {/* Mode toggle */}
              <div className="flex rounded overflow-hidden border border-realm-border mb-3 text-xs">
                <button
                  type="button"
                  onClick={() => setListingMode('resource')}
                  className={`flex-1 py-1.5 transition-colors ${listingMode === 'resource' ? 'bg-realm-gold text-black font-bold' : 'text-realm-text-muted hover:text-realm-text'}`}
                >
                  Resources
                </button>
                <button
                  type="button"
                  onClick={() => setListingMode('item')}
                  className={`flex-1 py-1.5 transition-colors ${listingMode === 'item' ? 'bg-realm-gold text-black font-bold' : 'text-realm-text-muted hover:text-realm-text'}`}
                >
                  Potions
                </button>
              </div>

              <form onSubmit={handleList} className="space-y-3">
                {listingMode === 'resource' ? (
                  <div>
                    <label className="text-realm-text-muted text-xs block mb-1">Resource</label>
                    <select className="realm-input" value={form.resource_type} onChange={e => setForm({ ...form, resource_type: e.target.value })}>
                      <option value="food">Food</option>
                      <option value="mana">Mana</option>
                      <option value="industry_points">Industry</option>
                      <option value="gold">Gold</option>
                    </select>
                    <div className="text-xs text-realm-text-dim mt-1">
                      Available: {province ? formatNumber(province[form.resource_type] ?? 0) : '...'}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-realm-text-muted text-xs block mb-1">Potion</label>
                    {inventory.length === 0 ? (
                      <p className="text-realm-text-muted text-xs">No potions in inventory. Craft some in the Alchemist Tower.</p>
                    ) : (
                      <>
                        <select
                          className="realm-input"
                          value={form.item_key}
                          onChange={e => setForm({ ...form, item_key: e.target.value })}
                          required
                        >
                          <option value="">— Select potion —</option>
                          {inventory.map(i => (
                            <option key={i.item_key} value={i.item_key}>
                              {ITEM_NAMES[i.item_key] || i.item_key} (×{i.quantity})
                            </option>
                          ))}
                        </select>
                        {selectedInv && (
                          <div className="text-xs text-realm-text-dim mt-1">
                            Available: {selectedInv.quantity}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-realm-text-muted text-xs block mb-1">Quantity</label>
                  <input className="realm-input" type="number" min="1" value={form.quantity}
                    onChange={e => setForm({ ...form, quantity: e.target.value })} required />
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
                <button
                  type="submit"
                  className="realm-btn-gold w-full"
                  disabled={loading || (province?.action_points || 0) < 1 || (listingMode === 'item' && !form.item_key)}
                >
                  {loading ? 'Listing...' : 'Post (1 AP)'}
                </button>
              </form>
            </>
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
              <option value="industry_points">Production</option>
              <option value="gold">Gold</option>
              <option value="items">Potions</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="realm-table">
              <thead>
                <tr>
                  <th>Item</th>
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
                  const label = l.item_key
                    ? `⚗ ${ITEM_NAMES[l.item_key] || l.item_key}`
                    : `${RESOURCE_ICONS[l.resource_type] || ''} ${l.resource_type}`;
                  return (
                    <tr key={l.id}>
                      <td>{label}</td>
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
