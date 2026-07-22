import { useState, useCallback, useRef } from 'react'

// MsgType mirrors the Go server constants
type MsgType = 'op' | 'snapshot' | 'presence'

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

interface Message {
  type: MsgType
  op?: Op
  content?: string    // snapshot
  clientId?: string   // presence
  line?: number       // presence
  col?: number        // presence
  color?: string      // presence
}

interface PresenceInfo {
  clientID: string
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

export function useDocument(clientID: string, send: (data: string) => void) {
  const [content, setContent] = useState('')
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
      entriesRef.current = []
      setContent(msg.content ?? '')
    }

    if (msg.type === 'op' && msg.op) {
      applyOp(msg.op)
    }

    if (msg.type === 'presence' && msg.clientId) {
      const p: PresenceInfo = {
        clientID: msg.clientId,
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
    send(JSON.stringify({ type: 'presence', clientId: clientID, line, col, color }))
  }, [clientID, send])

  return { content, presence, handleMessage, localInsert, localDelete, sendPresence }
}
