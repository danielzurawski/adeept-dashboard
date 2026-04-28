import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

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

export interface ConnectOptions {
  url: string
  authMessage: string
}

export interface MapSnapshot {
  size: number
  cellCm: number
  x: number
  y: number
  theta: number
  frontiers: number
  coverage: number
  mapping: boolean
  grid: string
  receivedAt: number
}

interface RobotApi {
  connected: boolean
  connecting: boolean
  systemInfo: SystemInfo
  log: LogEntry[]
  latestMap: MapSnapshot | null
  connect: (opts: ConnectOptions) => void
  disconnect: () => void
  sendCommand: (cmd: string) => void
  sendJson: (data: object) => void
}

const RobotContext = createContext<RobotApi | null>(null)

interface ParsedMapData {
  size?: unknown
  cell_cm?: unknown
  x?: unknown
  y?: unknown
  theta?: unknown
  frontiers?: unknown
  coverage?: unknown
  mapping?: unknown
  grid?: unknown
}

function parseMap(data: ParsedMapData | null | undefined): MapSnapshot | null {
  if (!data || typeof data !== 'object') return null
  const grid = typeof data.grid === 'string' ? (data.grid as string) : null
  if (!grid) return null
  return {
    size: Number(data.size) || 0,
    cellCm: Number(data.cell_cm) || 10,
    x: Number(data.x) || 0,
    y: Number(data.y) || 0,
    theta: Number(data.theta) || 0,
    frontiers: Number(data.frontiers) || 0,
    coverage: Number(data.coverage) || 0,
    mapping: Boolean(data.mapping),
    grid,
    receivedAt: Date.now(),
  }
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({
    cpuTemp: 'N/A', cpuUsage: 'N/A', ramUsage: 'N/A', battery: 'N/A',
  })
  const [log, setLog] = useState<LogEntry[]>([])
  const [latestMap, setLatestMap] = useState<MapSnapshot | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const addLog = useCallback((direction: 'sent' | 'received', message: string) => {
    const time = new Date().toLocaleTimeString()
    setLog((prev) => [{ time, direction, message }, ...prev].slice(0, 50))
  }, [])

  const connect = useCallback(({ url, authMessage }: ConnectOptions) => {
    if (wsRef.current) {
      wsRef.current.close()
    }
    setConnecting(true)
    const ws = new WebSocket(url)

    ws.onopen = () => {
      setConnected(true)
      setConnecting(false)
      addLog('received', 'Connected to robot server')
      ws.send(authMessage)
      addLog('sent', '<auth>')
      pollRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('get_info')
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
        } else if (parsed.title === 'get_map') {
          const snap = parseMap(parsed.data)
          if (snap) setLatestMap(snap)
        }
      } catch {
        // Non-JSON response (auth/info banner), that's fine.
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

  useEffect(() => () => disconnect(), [disconnect])

  const value = useMemo<RobotApi>(() => ({
    connected,
    connecting,
    systemInfo,
    log,
    latestMap,
    connect,
    disconnect,
    sendCommand,
    sendJson,
  }), [connected, connecting, systemInfo, log, latestMap, connect, disconnect, sendCommand, sendJson])

  return <RobotContext.Provider value={value}>{children}</RobotContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- shared hook colocated with provider
export function useWebSocket(): RobotApi {
  const ctx = useContext(RobotContext)
  if (!ctx) throw new Error('useWebSocket must be used inside <WebSocketProvider>')
  return ctx
}
