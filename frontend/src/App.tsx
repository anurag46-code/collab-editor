import { useState, useEffect } from 'react'
import { Editor } from './components/Editor'
import { Login } from './components/Login'
import { RoomPicker } from './components/RoomPicker'
import { useWebSocket } from './hooks/useWebSocket'
import { useDocument } from './hooks/useDocument'

const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']
const myColor = COLORS[Math.floor(Math.random() * COLORS.length)]

const SESSION_KEY = 'collab_session'

interface Session {
  token: string
  userID: string
  email: string
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveSession(s: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s))
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export default function App() {
  const [session, setSession] = useState<Session | null>(loadSession)
  const [roomID, setRoomID] = useState<string | null>(null)

  // Keep URL in sync with the active room so sharing the link works
  useEffect(() => {
    if (roomID) {
      window.history.replaceState({}, '', `?room=${roomID}`)
    } else {
      window.history.replaceState({}, '', '/')
    }
  }, [roomID])

  // On first load, if a room is in the URL and we have a session, go straight in
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlRoom = params.get('room')
    if (urlRoom && session) setRoomID(urlRoom)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAuth = (token: string, userID: string, email: string) => {
    const s = { token, userID, email }
    saveSession(s)
    setSession(s)
  }

  const handleLogout = () => {
    clearSession()
    setSession(null)
    setRoomID(null)
  }

  if (!session) {
    return <Login onAuth={handleAuth} />
  }

  if (!roomID) {
    return <RoomPicker email={session.email} onJoin={setRoomID} onLogout={handleLogout} />
  }

  return (
    <EditorView
      roomID={roomID}
      session={session}
      onLeave={() => setRoomID(null)}
      onLogout={handleLogout}
    />
  )
}

function EditorView({ roomID, session, onLeave, onLogout }: {
  roomID: string
  session: Session
  onLeave: () => void
  onLogout: () => void
}) {
  const sendRef = { current: (_data: string) => {} }
  const { content, presence, handleMessage, localInsert, localDelete, sendPresence } =
    useDocument(session.userID, (data) => sendRef.current(data))
  const { send } = useWebSocket(roomID, session.token, handleMessage)
  sendRef.current = send

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1e1e1e' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', background: '#2d2d2d', borderBottom: '1px solid #444',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onLeave} style={{
            background: 'none', border: '1px solid #555', borderRadius: 4,
            color: '#888', fontSize: 12, cursor: 'pointer', padding: '4px 10px',
          }}>
            Rooms
          </button>
          <span style={{ color: '#888', fontSize: 13, fontFamily: 'monospace', letterSpacing: 1 }}>
            {roomID}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Online users */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div title={session.email} style={{
              width: 10, height: 10, borderRadius: '50%', background: myColor,
            }} />
            {presence.map(p => (
              <div key={p.clientID} title={p.clientID} style={{
                width: 10, height: 10, borderRadius: '50%', background: p.color,
              }} />
            ))}
            <span style={{ color: '#666', fontSize: 12, fontFamily: 'sans-serif' }}>
              {presence.length + 1} online
            </span>
          </div>

          <span style={{ color: '#555', fontSize: 12, fontFamily: 'sans-serif' }}>{session.email}</span>

          <button onClick={onLogout} style={{
            background: 'none', border: '1px solid #555', borderRadius: 4,
            color: '#888', fontSize: 12, cursor: 'pointer', padding: '4px 10px',
          }}>
            Logout
          </button>
        </div>
      </div>

      {/* Editor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Editor
          content={content}
          onInsert={localInsert}
          onDelete={localDelete}
          onCursorMove={(line, col) => sendPresence(line, col, myColor)}
        />
      </div>
    </div>
  )
}
