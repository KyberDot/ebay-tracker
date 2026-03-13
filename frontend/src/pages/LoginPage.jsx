import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function LoginPage() {
  const { connectEbay, checkAuth, config, user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    const success = searchParams.get('auth_success')
    const error = searchParams.get('auth_error')
    if (success) {
      checkAuth()
      toast('Connected to eBay successfully!', 'success')
      navigate('/', { replace: true })
    }
    if (error) {
      toast(`Auth failed: ${error}`, 'error')
    }
  }, [searchParams])

  const handleConnect = async () => {
    try {
      setConnecting(true)
      await connectEbay()
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to connect', 'error')
      setConnecting(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          linear-gradient(var(--border) 1px, transparent 1px),
          linear-gradient(90deg, var(--border) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        opacity: 0.3,
      }} />

      {/* Glow */}
      <div style={{
        position: 'absolute',
        top: '30%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 600, height: 400,
        background: 'radial-gradient(ellipse, rgba(230,168,23,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="fade-in" style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '48px 40px',
        width: '100%',
        maxWidth: 440,
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64,
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dim) 100%)',
            borderRadius: 16,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            marginBottom: 16,
            boxShadow: '0 8px 32px var(--accent-glow)',
          }}>📦</div>
          <h1 style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 22,
            fontWeight: 700,
            marginBottom: 6,
          }}>eBay Tracker</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Track your sales, orders &amp; inventory in one place
          </p>
        </div>

        {/* Features */}
        <div style={{
          background: 'var(--bg-card2)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '16px 18px',
          marginBottom: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          {[
            ['↗', 'Real-time sales analytics & revenue tracking'],
            ['📋', 'Full order history with SKU & code lookup'],
            ['📦', 'Inventory management with profit tracking'],
            ['🔄', 'Auto-sync from eBay API'],
          ].map(([icon, text]) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-dim)' }}>
              <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{icon}</span>
              {text}
            </div>
          ))}
        </div>

        {!config.ebayConfigured && (
          <div style={{
            background: 'rgba(239,68,68,0.05)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 20,
            fontSize: 12,
            color: 'var(--red)',
            lineHeight: 1.6,
          }}>
            ⚠️ <strong>eBay API not configured.</strong> Set <code>EBAY_CLIENT_ID</code> and <code>EBAY_CLIENT_SECRET</code> in your environment variables.
          </div>
        )}

        <button
          className="btn btn-primary btn-lg"
          onClick={handleConnect}
          disabled={connecting || !config.ebayConfigured}
          style={{ width: '100%', justifyContent: 'center', fontSize: 14 }}
        >
          {connecting ? (
            <>
              <span className="spinner" style={{ width: 16, height: 16 }} />
              Connecting…
            </>
          ) : (
            <>
              <span style={{ fontSize: 18 }}>🔑</span>
              Sign in with eBay
            </>
          )}
        </button>

        <p style={{
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--text-muted)',
          marginTop: 14,
          lineHeight: 1.6,
        }}>
          You'll be redirected to eBay to authorise access.<br />
          We only read your sales & inventory data.
        </p>
      </div>
    </div>
  )
}
