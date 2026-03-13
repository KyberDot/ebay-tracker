import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { useToast } from '../context/ToastContext'
import { formatCurrency, formatDateTime } from '../utils/format'
import SyncButton from '../components/SyncButton'

const PAGE_SIZE = 30

function ShippingBadge({ status }) {
  const s = (status || '').toUpperCase()
  let cls = 'badge-gray', label = status || 'UNKNOWN'
  if (s === 'FULFILLED') { cls = 'badge-green'; label = 'Fulfilled' }
  else if (s === 'IN_PROGRESS') { cls = 'badge-yellow'; label = 'In Progress' }
  else if (s === 'NOT_STARTED') { cls = 'badge-gray'; label = 'Pending' }
  return <span className={`badge ${cls}`}>{label}</span>
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const { toast } = useToast()

  const load = useCallback(async (p = 0, q = '') => {
    setLoading(true)
    try {
      const res = await api.get('/api/orders', {
        params: { limit: PAGE_SIZE, offset: p * PAGE_SIZE, search: q || undefined }
      })
      setOrders(res.data.orders)
      setTotal(res.data.total)
    } catch {
      toast('Failed to load orders', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [])

  const handleSearch = (e) => {
    const q = e.target.value
    setSearch(q)
    setPage(0)
    load(0, q)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ fontSize: 18, marginBottom: 2 }}>Orders</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{total} total orders</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="search-bar" style={{ width: 300 }}>
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Order ID, SKU, buyer, item title…"
              value={search}
              onChange={handleSearch}
            />
          </div>
          <SyncButton onSync={() => load(0, search)} />
        </div>
      </div>

      <div className="page-body">
        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <span className="spinner" style={{ width: 28, height: 28 }} />
            </div>
          ) : orders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>No orders found</h3>
              <p>Sync your eBay account to load orders</p>
            </div>
          ) : (
            <>
              {orders.map(order => (
                <div key={order.order_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  {/* Order row */}
                  <div
                    onClick={() => setExpanded(expanded === order.order_id ? null : order.order_id)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 140px 100px 110px 110px 120px 60px',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                      alignItems: 'center',
                      gap: 12,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div>
                      <div className="mono" style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 3 }}>
                        {order.order_id}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                        {order.buyer_username} · {order.buyer_country} · {order.line_items} line item{order.line_items > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {formatDateTime(order.sale_date)}
                    </div>
                    <div className="mono" style={{ fontWeight: 700 }}>
                      {formatCurrency(order.total_price, order.currency)}
                    </div>
                    <div className="mono" style={{ fontSize: 12, color: order.net_profit > 0 ? 'var(--green)' : 'var(--red)' }}>
                      {formatCurrency(order.net_profit, order.currency)}
                    </div>
                    <div>
                      <span className="badge badge-green">{order.payment_status || 'PAID'}</span>
                    </div>
                    <div>
                      <ShippingBadge status={order.shipping_status} />
                    </div>
                    <div style={{ color: 'var(--text-muted)', textAlign: 'right' }}>
                      {expanded === order.order_id ? '▲' : '▼'}
                    </div>
                  </div>

                  {/* Expanded line items */}
                  {expanded === order.order_id && (
                    <div style={{ background: 'var(--bg-card2)', borderTop: '1px solid var(--border)', padding: '0 16px 12px' }}>
                      {order.tracking_number && (
                        <div style={{
                          padding: '10px 0 8px',
                          borderBottom: '1px solid var(--border)',
                          marginBottom: 8,
                          display: 'flex', gap: 12, alignItems: 'center'
                        }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tracking:</span>
                          <span className="mono" style={{ fontSize: 12, color: 'var(--accent)' }}>
                            {order.tracking_number}
                          </span>
                        </div>
                      )}
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                        <thead>
                          <tr>
                            {['Item Title', 'Item ID', 'SKU / Code', 'Qty', 'Unit Price', 'Line Total'].map(h => (
                              <th key={h} style={{
                                padding: '6px 10px', textAlign: 'left',
                                fontSize: 10, color: 'var(--text-muted)',
                                fontFamily: 'var(--font-mono)', fontWeight: 700,
                                textTransform: 'uppercase', borderBottom: '1px solid var(--border)'
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(order.lineItems || []).map((li, i) => (
                            <tr key={i}>
                              <td style={{ padding: '8px 10px', fontSize: 12 }}>{li.item_title || '—'}</td>
                              <td className="mono" style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)' }}>{li.item_id || '—'}</td>
                              <td style={{ padding: '8px 10px' }}>
                                <span className="mono" style={{
                                  fontSize: 11, background: 'var(--bg-card)',
                                  padding: '2px 6px', borderRadius: 4, color: 'var(--accent)'
                                }}>
                                  {li.sku || li.custom_label || '—'}
                                </span>
                              </td>
                              <td className="mono" style={{ padding: '8px 10px', fontSize: 12 }}>{li.quantity}</td>
                              <td className="mono" style={{ padding: '8px 10px', fontSize: 12 }}>{formatCurrency(li.sale_price)}</td>
                              <td className="mono" style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700 }}>{formatCurrency(li.total_price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderTop: '1px solid var(--border)',
                  fontSize: 12, color: 'var(--text-muted)'
                }}>
                  <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => { const p = page-1; setPage(p); load(p, search) }} disabled={page === 0}>← Prev</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => { const p = page+1; setPage(p); load(p, search) }} disabled={page >= totalPages - 1}>Next →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
