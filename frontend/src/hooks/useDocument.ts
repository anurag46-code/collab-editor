import { useState, useCallback, useRef } from 'react'

// MsgType mirrors the Go server constants
type MsgType = 'op' | 'snapshot' | 'presence' | 'lang'

interface Identifier {
  digit: number
  siteId: string
}

type Position = Identifier[]

interface Op {
  type: 'insert' | 'delete'
  position: Position
  char: number   // rune (Unicode code point)
  siteId: string
  clock: number
}

interface EntryJSON {
  pos: Position
  char: number
}

interface Message {
  type: MsgType
  op?: Op
  content?: string      // snapshot: plain text
  entries?: EntryJSON[] // snapshot: full CRDT state
  ownerId?: string      // snapshot: room owner
  language?: string     // snapshot: current lang | lang: new lang
  clientId?: string     // presence
  email?: string        // presence
  line?: number         // presence
  col?: number          // presence
  color?: string        // presence
}

interface PresenceInfo {
  clientID: string
  email: string
  line: number
  col: number
  color: string
}

// A minimal client-side CRDT document.
// The real conflict resolution runs on both server and clients.
// Here we maintain a sorted array of {position, char} entries mirroring the Go Document.
interface Entry {
  pos: Position
  char: string
}

function comparePositions(a: Position, b: Position): number {
  const minLen = Math.min(a.length, b.length)
  for (let i = 0; i < minLen; i++) {
    if (a[i].digit !== b[i].digit) return a[i].digit - b[i].digit
    if (a[i].siteId < b[i].siteId) return -1
    if (a[i].siteId > b[i].siteId) return 1
  }
  return a.length - b.length
}

const BASE = 1000

// between generates a position between lo and hi - mirrors the Go Between() function
function between(lo: Position | null, hi: Position | null, siteID: string): Position {
  const prefix: Position = []
  let hiActive = hi

  for (let level = 0; ; level++) {
    const loDigit = lo && level < lo.length ? lo[level].digit : 0
    const hiDigit = hiActive === null || level >= (hiActive?.length ?? 0) ? BASE : hiActive[level].digit
    const gap = hiDigit - loDigit

    if (gap >= 2) {
      const mid = loDigit + Math.floor(gap / 2)
      return [...prefix, { digit: mid, siteId: siteID }]
    }

    if (gap === 1) {
      prefix.push(lo && level < lo.length ? lo[level] : { digit: loDigit, siteId: '' })
      hiActive = null
      continue
    }

    prefix.push(lo && level < lo.length ? lo[level] : { digit: loDigit, siteId: '' })
  }
}

export function useDocument(clientID: string, email: string, send: (data: string) => void) {
  const [content, setContent] = useState('')
  const [snapshotReady, setSnapshotReady] = useState(false)
  const [ownerID, setOwnerID] = useState<string | null>(null)
  const [language, setLanguage] = useState('javascript')
  const entriesRef = useRef<Entry[]>([])
  const clockRef = useRef(0)
  const [presence, setPresence] = useState<PresenceInfo[]>([])

  // applyOp integrates a remote or local op into the local document
  const applyOp = useCallback((op: Op) => {
    const entries = entriesRef.current

    if (op.type === 'insert') {
      const e: Entry = { pos: op.position, char: String.fromCodePoint(op.char) }
      // binary search for insertion point
      let lo = 0, hi = entries.length
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (comparePositions(entries[mid].pos, op.position) < 0) lo = mid + 1
        else hi = mid
      }
      // idempotent: skip if position already exists
      if (lo < entries.length && comparePositions(entries[lo].pos, op.position) === 0) return
      entries.splice(lo, 0, e)
    } else {
      const idx = entries.findIndex(e => comparePositions(e.pos, op.position) === 0)
      if (idx !== -1) entries.splice(idx, 1)
    }

    setContent(entries.map(e => e.char).join(''))
  }, [])

  // handleMessage processes every incoming WebSocket message from the server
  const handleMessage = useCallback((raw: string) => {
    const msg: Message = JSON.parse(raw)

    if (msg.type === 'snapshot') {
      if (msg.entries && msg.entries.length > 0) {
        entriesRef.current = msg.entries.map(e => ({
          pos: e.pos,
          char: String.fromCodePoint(e.char),
        }))
      } else {
        entriesRef.current = []
      }
      setContent(msg.content ?? '')
      if (msg.ownerId) setOwnerID(msg.ownerId)
      if (msg.language) setLanguage(msg.language)
      setSnapshotReady(true)
    }

    if (msg.type === 'lang' && msg.language) {
      setLanguage(msg.language)
    }

    if (msg.type === 'op' && msg.op) {
      applyOp(msg.op)
    }

    if (msg.type === 'presence' && msg.clientId) {
      const p: PresenceInfo = {
        clientID: msg.clientId,
        email: msg.email ?? msg.clientId,
        line: msg.line ?? 0,
        col: msg.col ?? 0,
        color: msg.color ?? '#888',
      }
      setPresence(prev => {
        const next = prev.filter(x => x.clientID !== p.clientID)
        return [...next, p]
      })
    }
  }, [applyOp])

  // localInsert is called when the user types a character
  const localInsert = useCallback((char: string, index: number) => {
    const entries = entriesRef.current
    const lo = index > 0 ? entries[index - 1]?.pos ?? null : null
    const hi = index < entries.length ? entries[index]?.pos ?? null : null
    const pos = between(lo, hi, clientID)
    clockRef.current++

    const op: Op = {
      type: 'insert',
      position: pos,
      char: char.codePointAt(0)!,
      siteId: clientID,
      clock: clockRef.current,
    }

    applyOp(op)
    send(JSON.stringify({ type: 'op', op }))
  }, [clientID, send, applyOp])

  // localDelete is called when the user deletes a character
  const localDelete = useCallback((index: number) => {
    const entries = entriesRef.current
    if (index < 0 || index >= entries.length) return
    clockRef.current++

    const op: Op = {
      type: 'delete',
      position: entries[index].pos,
      char: 0,
      siteId: clientID,
      clock: clockRef.current,
    }

    applyOp(op)
    send(JSON.stringify({ type: 'op', op }))
  }, [clientID, send, applyOp])

  // sendPresence broadcasts cursor position to other clients
  const sendPresence = useCallback((line: number, col: number, color: string) => {
    send(JSON.stringify({ type: 'presence', clientId: clientID, email, line, col, color }))
  }, [clientID, email, send])

  // replaceContent clears the document and bulk-inserts new text as CRDT ops.
  // Used when loading a language snippet into an empty document.
  const replaceContent = useCallback((_text: string, _lang: string) => {
    // Delete all existing characters back-to-front (so indices stay valid)
    const entries = entriesRef.current
    for (let i = entries.length - 1; i >= 0; i--) {
      localDelete(i)
    }
    // Insert new text character by character
    for (let i = 0; i < _text.length; i++) {
      localInsert(_text[i], i)
    }
  }, [localInsert, localDelete])

  return { content, snapshotReady, ownerID, language, presence, handleMessage, localInsert, localDelete, sendPresence, replaceContent }
}
