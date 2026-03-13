import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const { checkAuth } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      toast('eBay authorisation failed: ' + error, 'error')
      navigate('/login', { replace: true })
      return
    }

    if (code) {
      // Redirect to backend callback handler
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const params = new URLSearchParams(searchParams)
      window.location.href = `${apiUrl}/api/auth/ebay/callback?${params.toString()}`
    } else {
      navigate('/login', { replace: true })
    }
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 16,
    }}>
      <span className="spinner" style={{ width: 32, height: 32 }} />
      <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
        Completing eBay connection…
      </p>
    </div>
  )
}
