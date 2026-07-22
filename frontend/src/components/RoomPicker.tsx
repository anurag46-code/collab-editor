import { useState } from 'react'

interface Props {
  email: string
  onJoin: (roomID: string) => void
  onLogout: () => void
}

function generateRoomID() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export function RoomPicker({ email, onJoin, onLogout }: Props) {
  const [roomInput, setRoomInput] = useState('')
  const [error, setError] = useState('')

  const join = () => {
    const id = roomInput.trim()
    if (!id) { setError('Enter a room ID'); return }
    onJoin(id)
  }

  const create = () => {
    onJoin(generateRoomID())
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#1e1e1e',
    }}>
      <div style={{
        background: '#2d2d2d', padding: 36, borderRadius: 8,
        width: 400, border: '1px solid #444',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <h2 style={{ color: '#fff', fontFamily: 'sans-serif', fontSize: 18 }}>
            Collab Editor
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#888', fontSize: 13, fontFamily: 'sans-serif' }}>{email}</span>
            <button onClick={onLogout} style={{
              background: 'none', border: '1px solid #555', borderRadius: 4,
              color: '#888', fontSize: 12, cursor: 'pointer', padding: '4px 10px',
            }}>
              Logout
            </button>
          </div>
        </div>

        {/* Create new room */}
        <button onClick={create} style={{
          width: '100%', padding: '12px', background: '#3498db', border: 'none',
          borderRadius: 6, color: '#fff', fontSize: 14, cursor: 'pointer',
          fontFamily: 'sans-serif', marginBottom: 20,
        }}>
          + Create new room
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: '#444' }} />
          <span style={{ color: '#666', fontSize: 12, fontFamily: 'sans-serif' }}>or join existing</span>
          <div style={{ flex: 1, height: 1, background: '#444' }} />
        </div>

        {/* Join existing room */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="Room ID (e.g. A3F9K2)"
            value={roomInput}
            onChange={e => { setRoomInput(e.target.value.toUpperCase()); setError('') }}
            onKeyDown={e => e.key === 'Enter' && join()}
            style={{
              flex: 1, padding: '10px 12px', background: '#1e1e1e',
              border: '1px solid #555', borderRadius: 4, color: '#fff',
              fontSize: 14, outline: 'none', fontFamily: 'monospace',
              letterSpacing: 2,
            }}
          />
          <button onClick={join} style={{
            padding: '10px 18px', background: '#444', border: 'none',
            borderRadius: 4, color: '#fff', fontSize: 14, cursor: 'pointer',
          }}>
            Join
          </button>
        </div>

        {error && <p style={{ color: '#e74c3c', fontSize: 13, marginTop: 8, fontFamily: 'sans-serif' }}>{error}</p>}
      </div>
    </div>
  )
}
