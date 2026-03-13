import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { useToast } from '../context/ToastContext'
import { formatCurrency, formatDate, truncate } from '../utils/format'
import SyncButton from '../components/SyncButton'

export default function InventoryPage() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const { toast } = useToast()

  const load = useCallback(async (q = search) => {
    setLoading(true)
    try {
      const res = await api.get('/api/inventory', {
        params: { search: q || undefined, limit: 200 }
      })
      setItems(res.data.items)
      setTotal(res.data.total)
    } catch {
      toast('Failed to load inventory', 'error')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { load() }, [])

  const openDetail = async (item) => {
    setSelected(item)
    setSelectedDetail(null)
    setLoadingDetail(true)
    try {
      const res = await api.get(`/api/inventory/${item.id}`)
      setSelectedDetail(res.data)
    } catch {
      toast('Failed to load item detail', 'error')
    } finally {
      setLoadingDetail(false)
    }
  }

  const saveEdit = async () => {
    try {
      await api.patch(`/api/inventory/${editItem.id}`, {
        notes: editItem.notes,
        tags: editItem.tags,
        cost_price: editItem.cost_price ? parseFloat(editItem.cost_price) : undefined,
        quantity_available: editItem.quantity_available != null ? parseInt(editItem.quantity_available) : undefined,
        custom_label: editItem.custom_label,
      })
      toast('Item updated', 'success')
      setEditItem(null)
      setSelected(null)
      load()
    } catch {
      toast('Failed to save', 'error')
    }
  }

  const deleteItem = async (id) => {
    if (!confirm('Remove this item from tracking?')) return
    await api.delete(`/api/inventory/${id}`)
    toast('Item removed', 'success')
    setSelected(null)
    load()
  }

  const handleSearch = (e) => {
    setSearch(e.target.value)
    load(e.target.value)
  }

  const profitMargin = (item) => {
    if (!item.cost_price || !item.price) return null
    return ((item.price - item.cost_price) / item.price * 100).toFixed(1)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ fontSize: 18, marginBottom: 2 }}>Inventory</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{total} tracked items</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="search-bar" style={{ width: 280 }}>
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search title, SKU, tag…"
              value={search}
              onChange={handleSearch}
            />
          </div>
          <SyncButton onSync={() => load()} />
        </div>
      </div>

      <div className="page-body">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <span className="spinner" style={{ width: 28, height: 28 }} />
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <h3>No inventory yet</h3>
              <p>Sync your eBay account to pull your listings</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>SKU / Code</th>
                    <th>Stock</th>
                    <th>Price</th>
                    <th>Cost</th>
                    <th>Margin</th>
                    <th>Sold (30d)</th>
                    <th>Rev (30d)</th>
                    <th>Status</th>
                    <th>Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const margin = profitMargin(item)
                    return (
                      <tr key={item.id} onClick={() => openDetail(item)} style={{ cursor: 'pointer' }}>
                        <td style={{ maxWidth: 240 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt=""
                                style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: '1px solid var(--border)' }}
                                onError={e => e.target.style.display = 'none'}
                              />
                            ) : (
                              <div style={{ width: 36, height: 36, background: 'var(--bg-card2)', borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📦</div>
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                                {item.title || item.custom_label || '(No title)'}
                              </div>
                              <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                #{item.item_id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="mono" style={{ fontSize: 12, background: 'var(--bg-card2)', padding: '2px 7px', borderRadius: 4, color: 'var(--accent)' }}>
                            {item.sku || item.custom_label || '—'}
                          </span>
                        </td>
                        <td className="mono" style={{ fontSize: 13, fontWeight: 600, color: item.quantity_available === 0 ? 'var(--red)' : item.quantity_available < 5 ? 'var(--accent)' : 'var(--green)' }}>
                          {item.quantity_available ?? '—'}
                        </td>
                        <td className="mono" style={{ fontSize: 13 }}>{item.price ? formatCurrency(item.price, item.currency) : '—'}</td>
                        <td className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                          {item.cost_price ? formatCurrency(item.cost_price, item.currency) : '—'}
                        </td>
                        <td>
                          {margin != null ? (
                            <span className={`badge ${margin > 30 ? 'badge-green' : margin > 0 ? 'badge-yellow' : 'badge-red'}`}>
                              {margin}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="mono" style={{ fontWeight: 700, color: item.sold_30d > 0 ? 'var(--text)' : 'var(--text-muted)' }}>
                          {item.sold_30d || 0}
                        </td>
                        <td className="mono" style={{ fontSize: 12 }}>
                          {item.revenue_30d ? formatCurrency(item.revenue_30d, item.currency) : '—'}
                        </td>
                        <td>
                          <span className={`badge ${item.listing_status === 'Active' ? 'badge-green' : 'badge-gray'}`}>
                            {item.listing_status || 'Active'}
                          </span>
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.tags || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Item detail modal */}
      {selected && (
        <div
          onClick={() => { setSelected(null); setEditItem(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="fade-in"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 14, width: '100%', maxWidth: 640, maxHeight: '85vh', overflowY: 'auto' }}
          >
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
              {selected.image_url && (
                <img src={selected.image_url} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selected.title || selected.custom_label || '(No title)'}
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>{selected.item_id}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditItem(editItem ? null : { ...selected })}>
                  {editItem ? 'Cancel' : '✏ Edit'}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteItem(selected.id)}>Delete</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(null); setEditItem(null) }}>✕</button>
              </div>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {/* Edit form */}
              {editItem ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                  <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>EDIT ITEM</h4>
                  {[
                    { label: 'Custom Label / Code', key: 'custom_label' },
                    { label: 'Cost Price (£)', key: 'cost_price', type: 'number' },
                    { label: 'Stock Quantity', key: 'quantity_available', type: 'number' },
                    { label: 'Tags (comma separated)', key: 'tags' },
                    { label: 'Notes', key: 'notes', multiline: true },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5, fontFamily: 'var(--font-mono)' }}>{f.label}</label>
                      {f.multiline ? (
                        <textarea
                          rows={3}
                          value={editItem[f.key] || ''}
                          onChange={e => setEditItem(x => ({ ...x, [f.key]: e.target.value }))}
                        />
                      ) : (
                        <input
                          type={f.type || 'text'}
                          value={editItem[f.key] || ''}
                          onChange={e => setEditItem(x => ({ ...x, [f.key]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                  <button className="btn btn-primary" onClick={saveEdit}>Save Changes</button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  {[
                    ['SKU', selected.sku],
                    ['Custom Label', selected.custom_label],
                    ['Price', selected.price ? formatCurrency(selected.price) : '—'],
                    ['Cost Price', selected.cost_price ? formatCurrency(selected.cost_price) : '—'],
                    ['Stock', selected.quantity_available ?? '—'],
                    ['Sold (30d)', selected.sold_30d || 0],
                    ['Condition', selected.condition],
                    ['Status', selected.listing_status],
                    ['Tags', selected.tags],
                    ['Notes', selected.notes],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} style={{ background: 'var(--bg-card2)', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{k.toUpperCase()}</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{String(v)}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Sales history */}
              <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>SALES HISTORY</h4>
              {loadingDetail ? (
                <div style={{ textAlign: 'center', padding: 20 }}><span className="spinner" /></div>
              ) : selectedDetail?.sales?.length > 0 ? (
                <table className="data-table" style={{ fontSize: 12 }}>
                  <thead><tr><th>Order</th><th>Date</th><th>Qty</th><th>Total</th><th>Buyer</th></tr></thead>
                  <tbody>
                    {selectedDetail.sales.map(s => (
                      <tr key={s.id}>
                        <td className="mono" style={{ fontSize: 10, color: 'var(--accent)' }}>{s.order_id?.slice(0, 14)}…</td>
                        <td style={{ color: 'var(--text-muted)' }}>{formatDate(s.sale_date)}</td>
                        <td className="mono">{s.quantity}</td>
                        <td className="mono" style={{ fontWeight: 700 }}>{formatCurrency(s.total_price)}</td>
                        <td>{s.buyer_username}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No sales recorded for this item yet</p>
              )}

              {selected.listing_url && (
                <a
                  href={selected.listing_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: 16, display: 'inline-flex' }}
                >
                  View on eBay ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
