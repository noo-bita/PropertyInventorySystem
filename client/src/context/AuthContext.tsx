import React, { createContext, useContext, useMemo, useState } from 'react'

type Role = 'ADMIN' | 'TEACHER'

type AuthUser = {
  id: number
  name: string
  email: string
  role: Role
  profile_photo_url?: string
}

type AuthContextType = {
  user: AuthUser | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem('auth_user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      if (!res.ok) return false
      const data = await res.json()
      setUser(data.user)
      localStorage.setItem('auth_user', JSON.stringify(data.user))
      if (data.token) localStorage.setItem('api_token', data.token)
      return true
    } catch {
      return false
    }
  }

  const logout = () => {
    const token = localStorage.getItem('api_token')
    // fire and forget
    if (token) {
      fetch('http://localhost:8000/api/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    }
    setUser(null)
    localStorage.removeItem('auth_user')
    localStorage.removeItem('api_token')
  }

  const value = useMemo(() => ({ user, login, logout }), [user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}


