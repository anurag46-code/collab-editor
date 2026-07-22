import { useState } from 'react'

interface Props {
  onAuth: (token: string, userID: string, email: string) => void
}

export function Login({ onAuth }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const apiBase = import.meta.env.DEV ? 'http://localhost:8080' : ''
    const url = `${apiBase}/auth/${mode === 'login' ? 'login' : 'register'}`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }
      onAuth(data.token, data.userId, data.email)
    } catch {
      setError('Could not reach server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#1e1e1e',
    }}>
      <div style={{
        background: '#2d2d2d', padding: 32, borderRadius: 8,
        width: 360, border: '1px solid #444',
      }}>
        <h2 style={{ color: '#fff', marginBottom: 24, fontFamily: 'sans-serif' }}>
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </h2>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
          />
          {error && <p style={{ color: '#e74c3c', fontSize: 13, margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? 'Loading...' : mode === 'login' ? 'Sign in' : 'Register'}
          </button>
        </form>

        <p style={{ color: '#888', fontSize: 13, marginTop: 16, fontFamily: 'sans-serif' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <span
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
            style={{ color: '#3498db', cursor: 'pointer' }}
          >
            {mode === 'login' ? 'Register' : 'Sign in'}
          </span>
        </p>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px', background: '#1e1e1e', border: '1px solid #555',
  borderRadius: 4, color: '#fff', fontSize: 14, outline: 'none',
}

const buttonStyle: React.CSSProperties = {
  padding: '10px 12px', background: '#3498db', border: 'none',
  borderRadius: 4, color: '#fff', fontSize: 14, cursor: 'pointer',
  marginTop: 4,
}
