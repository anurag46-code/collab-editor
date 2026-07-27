import { useState, useEffect, useRef } from 'react'
import { Editor } from './components/Editor'
import { Login } from './components/Login'
import { RoomPicker } from './components/RoomPicker'
import { useWebSocket } from './hooks/useWebSocket'
import { useDocument } from './hooks/useDocument'
import { defaultSnippets } from './snippets'

const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']
const myColor = COLORS[Math.floor(Math.random() * COLORS.length)]

const LANGUAGES = [
  'javascript', 'typescript', 'python', 'go', 'java', 'cpp',
  'rust', 'sql', 'json', 'markdown', 'yaml', 'bash',
]

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

  useEffect(() => {
    if (roomID) {
      window.history.replaceState({}, '', `?room=${roomID}`)
    } else {
      window.history.replaceState({}, '', '/')
    }
  }, [roomID])

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

  if (!session) return <Login onAuth={handleAuth} />
  if (!roomID) return <RoomPicker email={session.email} onJoin={setRoomID} onLogout={handleLogout} />

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
  const [copied, setCopied] = useState(false)
  // Per-language buffer: saves each language's code independently (local to this client)
  const buffersRef = useRef<Record<string, string>>({})

  const sendRef = { current: (_data: string) => {} }
  const { content, snapshotReady, ownerID, language, presence, handleMessage, localInsert, localDelete, sendPresence, replaceContent } =
    useDocument(session.userID, session.email, (data) => sendRef.current(data))
  const { send, connected } = useWebSocket(roomID, session.token, handleMessage)
  sendRef.current = send

  const isOwner = ownerID === session.userID

  // Once the snapshot arrives and this client is the owner and room is empty, load JS snippet
  useEffect(() => {
    if (snapshotReady && isOwner && content.trim() === '') {
      const snippet = defaultSnippets['javascript']
      if (snippet) replaceContent(snippet, 'javascript')
    }
  }, [snapshotReady]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLanguageChange = (lang: string) => {
    // Save current code into outgoing language's buffer
    buffersRef.current[language] = content
    // Load saved buffer or default snippet for new language
    const saved = buffersRef.current[lang]
    const next = saved !== undefined ? saved : (defaultSnippets[lang] ?? '')
    replaceContent(next, lang)
    // Broadcast to all clients - server validates we're the owner
    send(JSON.stringify({ type: 'lang', language: lang }))
  }

  const copyRoomID = () => {
    navigator.clipboard.writeText(roomID).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1e1e1e' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', height: 40, background: '#2d2d2d', borderBottom: '1px solid #3a3a3a',
        flexShrink: 0,
      }}>
        {/* Left: back + room ID + copy */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onLeave} style={ghostBtn}>
            ← Rooms
          </button>
          <div style={{ width: 1, height: 16, background: '#444' }} />
          <span style={{ color: '#ccc', fontSize: 13, fontFamily: 'monospace', letterSpacing: 1 }}>
            {roomID}
          </span>
          <button onClick={copyRoomID} title="Copy room ID" style={ghostBtn}>
            {copied ? '✓ copied' : 'copy'}
          </button>
        </div>

        {/* Center: language selector (owner only) or read-only badge */}
        {isOwner ? (
          <select
            value={language}
            onChange={e => handleLanguageChange(e.target.value)}
            style={{
              background: '#1e1e1e', border: '1px solid #444', borderRadius: 4,
              color: '#ccc', fontSize: 12, padding: '3px 8px', cursor: 'pointer', outline: 'none',
            }}
          >
            {LANGUAGES.map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        ) : (
          <span style={{
            background: '#1e1e1e', border: '1px solid #333', borderRadius: 4,
            color: '#777', fontSize: 12, padding: '3px 10px',
          }}>
            {language}
          </span>
        )}

        {/* Right: connection + presence + user + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Connection indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: connected ? '#2ecc71' : '#e74c3c',
            }} />
            <span style={{ color: '#666', fontSize: 11 }}>
              {connected ? 'live' : 'offline'}
            </span>
          </div>

          <div style={{ width: 1, height: 16, background: '#444' }} />

          {/* Online users */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <div
              title={session.email}
              style={{ width: 10, height: 10, borderRadius: '50%', background: myColor, cursor: 'default' }}
            />
            {presence.map(p => (
              <div
                key={p.clientID}
                title={p.email}
                style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, cursor: 'default' }}
              />
            ))}
            <span style={{ color: '#666', fontSize: 12 }}>{presence.length + 1} online</span>
          </div>

          <div style={{ width: 1, height: 16, background: '#444' }} />

          <span style={{ color: '#666', fontSize: 12 }}>{session.email}</span>
          <button onClick={onLogout} style={ghostBtn}>Logout</button>
        </div>
      </div>

      {/* Editor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Editor
          content={content}
          language={language}
          onInsert={localInsert}
          onDelete={localDelete}
          onCursorMove={(line, col) => sendPresence(line, col, myColor)}
        />
      </div>
    </div>
  )
}

const ghostBtn: React.CSSProperties = {
  background: 'none', border: '1px solid #444', borderRadius: 4,
  color: '#999', fontSize: 12, cursor: 'pointer', padding: '3px 9px',
}
