import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { useToast } from '../context/ToastContext'
import { formatCurrency, formatDateTime, truncate } from '../utils/format'
import SyncButton from '../components/SyncButton'

const PAGE_SIZE = 50

function StatusBadge({ status }) {
  const s = (status || '').toUpperCase()
  let cls = 'badge-gray'
  if (s.includes('PAID') || s.includes('FULFILL')) cls = 'badge-green'
  else if (s.includes('PENDING')) cls = 'badge-yellow'
  else if (s.includes('CANCEL')) cls = 'badge-red'
  return <span className={`badge ${cls}`}>{status || '—'}</span>
}

export default function SalesPage() {
  const [sales, setSales] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const { toast } = useToast()

  const load = useCallback(async (p = page, q = search) => {
    setLoading(true)
    try {
      const res = await api.get('/api/sales', {
        params: { limit: PAGE_SIZE, offset: p * PAGE_SIZE, search: q || undefined }
      })
      setSales(res.data.sales)
      setTotal(res.data.total)
    } catch {
      toast('Failed to load sales', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, search])

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
          <h2 style={{ fontSize: 18, marginBottom: 2 }}>Sales</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{total} total transactions</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="search-bar" style={{ width: 280 }}>
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search item, SKU, order ID, buyer…"
              value={search}
              onChange={handleSearch}
            />
          </div>
          <SyncButton onSync={() => load(0, search)} />
        </div>
      </div>

      <div className="page-body">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <span className="spinner" style={{ width: 28, height: 28 }} />
            </div>
          ) : sales.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">↗</div>
              <h3>No sales found</h3>
              <p>Sync your eBay account or try a different search</p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Item</th>
                      <th>SKU / Code</th>
                      <th>Qty</th>
                      <th>Total</th>
                      <th>Net</th>
                      <th>Buyer</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map(sale => (
                      <tr
                        key={sale.id}
                        onClick={() => setSelected(sale)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>
                            {sale.order_id?.slice(0, 16)}…
                          </span>
                        </td>
                        <td style={{ maxWidth: 220 }}>
                          <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sale.item_title || '—'}
                          </div>
                          {sale.item_id && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              #{sale.item_id}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)', background: 'var(--bg-card2)', padding: '2px 6px', borderRadius: 4 }}>
                            {sale.sku || sale.custom_label || '—'}
                          </span>
                        </td>
                        <td className="mono" style={{ fontSize: 13 }}>{sale.quantity}</td>
                        <td className="mono" style={{ fontWeight: 700 }}>{formatCurrency(sale.total_price, sale.currency)}</td>
                        <td className="mono" style={{ color: sale.net_profit > 0 ? 'var(--green)' : 'var(--red)', fontSize: 13 }}>
                          {formatCurrency(sale.net_profit, sale.currency)}
                        </td>
                        <td style={{ fontSize: 12 }}>{sale.buyer_username || '—'}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {formatDateTime(sale.sale_date)}
                        </td>
                        <td><StatusBadge status={sale.payment_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

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
                    <button className="btn btn-sm btn-secondary" onClick={() => { setPage(p => p - 1); load(page - 1, search) }} disabled={page === 0}>← Prev</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => { setPage(p => p + 1); load(page + 1, search) }} disabled={page >= totalPages - 1}>Next →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sale detail modal */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 20
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="fade-in"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: 14,
              padding: 28,
              width: '100%', maxWidth: 520,
              maxHeight: '80vh', overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>ORDER DETAIL</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['Order ID', selected.order_id],
                ['Item ID', selected.item_id],
                ['Title', selected.item_title],
                ['SKU', selected.sku],
                ['Custom Label / Code', selected.custom_label],
                ['Quantity', selected.quantity],
                ['Sale Price', formatCurrency(selected.sale_price, selected.currency)],
                ['Total', formatCurrency(selected.total_price, selected.currency)],
                ['eBay Fees (est.)', formatCurrency(selected.ebay_fees, selected.currency)],
                ['Postage', formatCurrency(selected.postage_cost, selected.currency)],
                ['Net Profit', formatCurrency(selected.net_profit, selected.currency)],
                ['Buyer', selected.buyer_username],
                ['Country', selected.buyer_country],
                ['Date', formatDateTime(selected.sale_date)],
                ['Payment Status', selected.payment_status],
                ['Shipping Status', selected.shipping_status],
                ['Tracking', selected.tracking_number],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '8px 0', borderBottom: '1px solid var(--border)',
                  fontSize: 13, gap: 16
                }}>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{k}</span>
                  <span style={{
                    fontFamily: ['Order ID', 'Item ID', 'SKU', 'Custom Label / Code', 'Tracking'].includes(k) ? 'var(--font-mono)' : undefined,
                    color: k === 'Net Profit' ? (selected.net_profit > 0 ? 'var(--green)' : 'var(--red)') :
                           k === 'Total' ? 'var(--accent)' : undefined,
                    fontWeight: ['Total', 'Net Profit'].includes(k) ? 700 : undefined,
                    textAlign: 'right', wordBreak: 'break-all'
                  }}>{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
