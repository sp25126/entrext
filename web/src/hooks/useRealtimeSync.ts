import { useEffect, useRef, useCallback } from 'react'
import { useCommentStore } from '@/store/commentStore'
import { useOverlayStore } from '@/store/overlayStore'
import { useRealtimeStore } from '@/store/realtimeStore'

const WS_BASE = process.env.NEXT_PUBLIC_API_BASE?.replace('http', 'ws') ?? 'ws://localhost:8765'

export function useRealtimeSync(projectId: string) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()
  const isManualClose = useRef(false)
  
  const { setConnected, updateCursor } = useRealtimeStore()

  const connect = useCallback(() => {
    if (!projectId) return

    const tester_id = localStorage.getItem('tester_id') ?? crypto.randomUUID()
    localStorage.setItem('tester_id', tester_id)
    const tester_name = localStorage.getItem('tester_name') ?? 'Anonymous'

    const url = `${WS_BASE}/ws/project/${projectId}?tester_id=${tester_id}&tester_name=${encodeURIComponent(tester_name)}`
    
    console.log(`[Entrext WS] Connecting to ${url}...`)
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[Entrext WS] Connected ✓')
      setConnected(true)
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        
        switch (msg.type) {
          case 'COMMENT_TRIAGED':
            console.log('[Entrext WS] Intelligence Received:', msg)
            useCommentStore.getState().updateTriage(msg.comment_id, {
              severity: msg.severity,
              category: msg.category,
              ai_summary: msg.ai_summary,
              suggested_fix: msg.suggested_fix,
            })
            break
            
          case 'MARKER_PLACED':
            useOverlayStore.getState().addMarker(msg.marker)
            break
            
          case 'COMMENT_SAVED':
            useCommentStore.getState().addFromRemote(msg.comment)
            break

          case 'CURSOR_MOVE':
            updateCursor(msg.tester_id, msg.x, msg.y, msg.name || msg.tester_name)
            break
            
          case 'PING':
            wsRef.current?.send(JSON.stringify({ type: 'PONG', ts: msg.ts }))
            break
        }
      } catch (err) {
         /* malformed message — ignore */ 
      }
    }

    ws.onclose = (event) => {
      setConnected(false)
      if (isManualClose.current) return
      
      console.log(`[Entrext WS] Disconnected (${event.code}) — reconnecting in 3s`)
      // Exponential backoff or simple fixed interval for MVP
      reconnectTimer.current = setTimeout(connect, 3000)
    }

    ws.onerror = (err) => {
      console.error('[Entrext WS] Connection Error:', err)
      ws.close() // triggers onclose → reconnect
    }
  }, [projectId, setConnected, updateCursor])

  useEffect(() => {
    isManualClose.current = false
    connect()
    
    return () => {
      isManualClose.current = true
      wsRef.current?.close()
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
  }, [connect])

  return wsRef
}
