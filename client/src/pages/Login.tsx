import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LoadingButton from '../components/LoadingButton'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const ok = await login(email, password)
    setIsSubmitting(false)
    if (ok) {
      if (remember) localStorage.setItem('remember_me_email', email)
      navigate('/')
    } else {
      setError('Invalid email or password')
    }
  }

  return (
    <div className="login-shell">
      <div className="login-container">
        {/* Left visual panel */}
        <div className="login-left">
          <div className="brand">
            <img src="/uploads/Logo.png" alt="Lawaan Integrated School" />
            <h1>Property Management Inventory System</h1>
          </div>
        </div>

        {/* Right form panel */}
        <div className="login-right">
          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-content">
              <h4 className="mb-4">Sign In</h4>
              <div className="mb-3">
                <input
                  className="form-control login-input"
                  type="email"
                  placeholder="User or Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <input
                  className="form-control login-input"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="login-meta small">
                <label className="d-flex align-items-center gap-2 mb-0">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  Remember me
                </label>
                <a href="#" className="text-muted" onClick={(e) => e.preventDefault()}>Forgot password?</a>
              </div>
              {error && <div className="alert alert-danger py-2">{error}</div>}
              <LoadingButton
                type="submit"
                className="btn btn-primary w-100 login-submit"
                isLoading={isSubmitting}
                label={isSubmitting ? 'Signing in...' : 'Sign In'}
              />
            </div>
          </form>
          <div className="login-slogan small text-muted">
            Smart Inventory for Smarter<br />Property Management.
          </div>
        </div>
      </div>
    </div>
  )
}


