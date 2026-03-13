import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState({})

  const checkAuth = useCallback(async () => {
    try {
      const [statusRes, configRes] = await Promise.all([
        api.get('/api/auth/status'),
        api.get('/api/config'),
      ])
      setUser(statusRes.data.authenticated ? statusRes.data.user : null)
      setConfig(configRes.data)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuth()
    const handler = () => { setUser(null) }
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [checkAuth])

  const connectEbay = async () => {
    const res = await api.get('/api/auth/ebay/connect')
    window.location.href = res.data.authUrl
  }

  const logout = async () => {
    await api.post('/api/auth/logout')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, config, checkAuth, connectEbay, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
