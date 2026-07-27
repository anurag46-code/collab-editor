import { useEffect, useRef, useCallback, useState } from 'react'

type MessageHandler = (data: string) => void

export function useWebSocket(roomID: string, token: string, onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const wsBase = import.meta.env.DEV ? 'ws://localhost:8080' : `ws://${window.location.host}`
    const url = `${wsBase}/ws/${roomID}?token=${encodeURIComponent(token)}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
    }

    ws.onmessage = (event) => {
      onMessageRef.current(event.data)
    }

    ws.onerror = (err) => {
      console.error('[ws] error', err)
    }

    ws.onclose = () => {
      setConnected(false)
    }

    return () => {
      ws.close()
    }
  }, [roomID, token])

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data)
    }
  }, [])

  return { send, connected }
}
