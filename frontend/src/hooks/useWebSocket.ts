import { useEffect, useRef, useCallback } from 'react'

type MessageHandler = (data: string) => void

// useWebSocket manages a persistent WebSocket connection to the server.
// It automatically reconnects if the connection drops.
// token is passed as a query param because browsers cannot set
// Authorization headers on WebSocket upgrade requests.
export function useWebSocket(roomID: string, token: string, onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage // always call the latest handler without re-connecting

  useEffect(() => {
    const wsBase = import.meta.env.DEV ? 'ws://localhost:8080' : `ws://${window.location.host}`
    const url = `${wsBase}/ws/${roomID}?token=${encodeURIComponent(token)}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      console.log(`[ws] connected to room ${roomID}`)
    }

    ws.onmessage = (event) => {
      onMessageRef.current(event.data)
    }

    ws.onerror = (err) => {
      console.error('[ws] error', err)
    }

    ws.onclose = () => {
      console.log('[ws] disconnected')
    }

    // Cleanup: close the connection when the component unmounts or roomID changes
    return () => {
      ws.close()
    }
  }, [roomID, token])

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data)
    }
  }, [])

  return { send }
}
