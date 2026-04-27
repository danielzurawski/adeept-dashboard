import { useState, useRef, useCallback, useEffect } from 'react'

export interface SystemInfo {
  cpuTemp: string
  cpuUsage: string
  ramUsage: string
  battery: string
}

export interface LogEntry {
  time: string
  direction: 'sent' | 'received'
  message: string
}

export function useWebSocket() {
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({
    cpuTemp: 'N/A', cpuUsage: 'N/A', ramUsage: 'N/A', battery: 'N/A'
  })
  const [log, setLog] = useState<LogEntry[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const addLog = useCallback((direction: 'sent' | 'received', message: string) => {
    const time = new Date().toLocaleTimeString()
    setLog(prev => [{ time, direction, message }, ...prev].slice(0, 50))
  }, [])

  const connect = useCallback((url: string) => {
    if (wsRef.current) {
      wsRef.current.close()
    }
    setConnecting(true)
    const ws = new WebSocket(url)

    ws.onopen = () => {
      setConnected(true)
      setConnecting(false)
      addLog('received', 'Connected to robot server')
      // Send auth
      ws.send('admin:123456')
      addLog('sent', 'admin:123456')
      // Start polling system info
      pollRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('get_info')
        }
      }, 3000)
    }

    ws.onmessage = (event) => {
      const data = event.data as string
      addLog('received', data.length > 100 ? data.substring(0, 100) + '...' : data)
      try {
        const parsed = JSON.parse(data)
        if (parsed.title === 'get_info' && Array.isArray(parsed.data)) {
          setSystemInfo({
            cpuTemp: parsed.data[0] || 'N/A',
            cpuUsage: parsed.data[1] || 'N/A',
            ramUsage: parsed.data[2] || 'N/A',
            battery: parsed.data[3] || 'N/A',
          })
        }
      } catch {
        // Non-JSON response, that's fine
      }
    }

    ws.onclose = () => {
      setConnected(false)
      setConnecting(false)
      addLog('received', 'Disconnected')
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }

    ws.onerror = () => {
      setConnecting(false)
      addLog('received', 'Connection error')
    }

    wsRef.current = ws
  }, [addLog])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const sendCommand = useCallback((cmd: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(cmd)
      addLog('sent', cmd)
    }
  }, [addLog])

  const sendJson = useCallback((data: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const str = JSON.stringify(data)
      wsRef.current.send(str)
      addLog('sent', str)
    }
  }, [addLog])

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return { connected, connecting, systemInfo, log, connect, disconnect, sendCommand, sendJson }
}