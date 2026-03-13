import { useState } from 'react'
import api from '../utils/api'
import { useToast } from '../context/ToastContext'

export default function SyncButton({ onSync }) {
  const [syncing, setSyncing] = useState(false)
  const { toast } = useToast()

  const handleSync = async () => {
    setSyncing(true)
    try {
      const [salesRes, invRes] = await Promise.all([
        api.post('/api/sales/sync'),
        api.post('/api/inventory/sync'),
      ])
      toast(
        `Synced ${salesRes.data.synced || 0} sales & ${invRes.data.synced || 0} inventory items`,
        'success'
      )
      onSync?.()
    } catch (err) {
      toast(err.response?.data?.error || 'Sync failed', 'error')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <button
      className="btn btn-secondary"
      onClick={handleSync}
      disabled={syncing}
      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
    >
      {syncing ? (
        <>
          <span className="spinner" style={{ width: 14, height: 14 }} />
          Syncing…
        </>
      ) : (
        <>
          <span style={{ fontSize: 14 }}>🔄</span>
          Sync eBay
        </>
      )}
    </button>
  )
}
