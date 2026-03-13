import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import api from '../utils/api'
import { useToast } from '../context/ToastContext'
import { formatCurrency, formatNumber, formatDate } from '../utils/format'
import SyncButton from '../components/SyncButton'

const DAYS_OPTIONS = [7, 14, 30, 90]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-card2)',
      border: '1px solid var(--border-light)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 700 }}>
            {p.dataKey === 'revenue' || p.dataKey === 'profit' ? formatCurrency(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [days, setDays] = useState(30)
  const [summary, setSummary] = useState(null)
  const [dailySales, setDailySales] = useState([])
  const [topItems, setTopItems] = useState([])
  const [recentSales, setRecentSales] = useState([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const [sumRes, salesRes] = await Promise.all([
        api.get(`/api/sales/summary?days=${days}`),
        api.get('/api/sales?limit=5'),
      ])
      setSummary(sumRes.data.summary)
      setDailySales(sumRes.data.dailySales || [])
      setTopItems(sumRes.data.topItems || [])
      setRecentSales(salesRes.data.sales || [])
    } catch (err) {
      toast('Failed to load dashboard', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [days])

  const s = summary || {}

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ fontSize: 18, marginBottom: 2 }}>Dashboard</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Overview of your eBay business</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-card2)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
            {DAYS_OPTIONS.map(d => (
              <button
                key={d}
                className="btn btn-sm"
                onClick={() => setDays(d)}
                style={{
                  background: days === d ? 'var(--accent)' : 'transparent',
                  color: days === d ? '#000' : 'var(--text-muted)',
                  border: 'none',
                  fontFamily: 'var(--font-mono)',
                }}
              >{d}d</button>
            ))}
          </div>
          <SyncButton onSync={load} />
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          {[
            { label: 'Gross Revenue', value: formatCurrency(s.gross_revenue), sub: `${formatNumber(s.total_orders)} orders`, accent: true },
            { label: 'Net Profit', value: formatCurrency(s.net_profit), sub: `After fees & postage`, color: s.net_profit > 0 ? 'var(--green)' : 'var(--red)' },
            { label: 'Items Sold', value: formatNumber(s.total_items_sold), sub: `Avg ${formatCurrency(s.avg_order_value)} / order` },
            { label: 'eBay Fees', value: formatCurrency(s.total_fees), sub: 'Est. 10% of revenue' },
            { label: 'Unique Buyers', value: formatNumber(s.unique_buyers), sub: `Last ${days} days` },
          ].map(stat => (
            <div key={stat.label} className="stat-card" style={{ borderColor: stat.accent ? 'var(--accent)' : undefined }}>
              <div className="stat-label">{stat.label}</div>
              <div className="stat-value" style={{ color: stat.color || (stat.accent ? 'var(--accent)' : undefined) }}>
                {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : stat.value}
              </div>
              <div className="stat-sub">{stat.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, marginBottom: 24 }}>
          {/* Revenue chart */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>REVENUE & ORDERS</h3>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>LAST {days} DAYS</span>
            </div>
            {dailySales.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={dailySales}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e6a817" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#e6a817" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `£${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#e6a817" strokeWidth={2} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state" style={{ padding: '40px 0' }}>
                <div>No sales data yet — sync your eBay orders</div>
              </div>
            )}
          </div>

          {/* Top items */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>TOP SELLERS</h3>
              <Link to="/inventory" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>View all →</Link>
            </div>
            {topItems.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topItems.slice(0, 6).map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 0',
                    borderBottom: i < 5 ? '1px solid var(--border)' : 'none'
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: i === 0 ? 'var(--accent)' : 'var(--bg-card2)',
                      color: i === 0 ? '#000' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, flexShrink: 0
                    }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.item_title || item.custom_label || item.sku || 'Unknown'}
                      </div>
                      {item.sku && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {item.sku}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                        {item.total_sold}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>sold</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '30px 0' }}>
                <div>No items yet</div>
              </div>
            )}
          </div>
        </div>

        {/* Recent sales */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>RECENT SALES</h3>
            <Link to="/sales" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>View all →</Link>
          </div>
          {recentSales.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>SKU / Code</th>
                  <th>Buyer</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map(sale => (
                  <tr key={sale.id}>
                    <td style={{ maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                        {sale.item_title || '—'}
                      </div>
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                        {sale.sku || sale.custom_label || '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{sale.buyer_username || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(sale.sale_date)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{formatCurrency(sale.total_price)}</td>
                    <td>
                      <span className={`badge badge-green`}>{sale.payment_status || 'PAID'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h3>No sales yet</h3>
              <p>Click "Sync" to pull your eBay orders</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
