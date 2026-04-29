import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Map, Play, Pause, RotateCcw, Scan, Plug } from 'lucide-react'
import { useWebSocket } from '@/hooks/useWebSocket'

const CELL_PX = 6

const COLORS = {
  unknown: '#18181b',
  free: '#1a1a2e',
  occupied: '#3b82f6',
  robot: '#22c55e',
}

function colorForChar(c: string) {
  switch (c) {
    case '.': return COLORS.free
    case '#': return COLORS.occupied
    default: return COLORS.unknown
  }
}

function countTiles(grid: string) {
  let free = 0
  let occupied = 0
  for (const c of grid) {
    if (c === '.') free++
    else if (c === '#') occupied++
  }
  return { free, occupied }
}

export function LiveOccupancyMap() {
  const { connected, latestMap, sendCommand } = useWebSocket()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [polling, setPolling] = useState(false)
  const [planTarget, setPlanTarget] = useState({ x: 50, y: 50 })

  useEffect(() => {
    if (!polling || !connected) return
    sendCommand('get_map')
    const id = setInterval(() => {
      if (connected) sendCommand('get_map')
    }, 500)
    return () => clearInterval(id)
  }, [polling, connected, sendCommand])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = latestMap?.size ?? 80
    const dim = size * CELL_PX
    if (canvas.width !== dim) canvas.width = dim
    if (canvas.height !== dim) canvas.height = dim

    ctx.fillStyle = COLORS.unknown
    ctx.fillRect(0, 0, dim, dim)

    if (latestMap?.grid) {
      const { grid } = latestMap
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const c = grid[y * size + x]
          if (!c || c === '?') continue
          ctx.fillStyle = colorForChar(c)
          ctx.fillRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX)
        }
      }

      ctx.fillStyle = COLORS.robot
      ctx.beginPath()
      ctx.arc(
        latestMap.x * CELL_PX + CELL_PX / 2,
        latestMap.y * CELL_PX + CELL_PX / 2,
        CELL_PX * 1.5,
        0,
        Math.PI * 2,
      )
      ctx.fill()

      const cosT = Math.cos(latestMap.theta)
      const sinT = Math.sin(latestMap.theta)
      ctx.strokeStyle = '#facc15'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(latestMap.x * CELL_PX + CELL_PX / 2, latestMap.y * CELL_PX + CELL_PX / 2)
      ctx.lineTo(
        latestMap.x * CELL_PX + CELL_PX / 2 + cosT * CELL_PX * 6,
        latestMap.y * CELL_PX + CELL_PX / 2 + sinT * CELL_PX * 6,
      )
      ctx.stroke()
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= size; i += 10) {
      ctx.beginPath()
      ctx.moveTo(i * CELL_PX, 0)
      ctx.lineTo(i * CELL_PX, dim)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i * CELL_PX)
      ctx.lineTo(dim, i * CELL_PX)
      ctx.stroke()
    }
  }, [latestMap])

  const stats = useMemo(() => {
    if (!latestMap) return null
    const { free, occupied } = countTiles(latestMap.grid)
    return {
      free,
      occupied,
      coverage: latestMap.coverage,
      frontiers: latestMap.frontiers,
      pose: `(${latestMap.x}, ${latestMap.y})`,
      heading: `${((latestMap.theta * 180) / Math.PI).toFixed(1)}°`,
      receivedAt: latestMap.receivedAt,
      mapping: latestMap.mapping,
    }
  }, [latestMap])

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const ageMs = stats ? now - stats.receivedAt : null

  const start = () => {
    if (!connected) return
    sendCommand('mapping')
    setPolling(true)
  }
  const stop = () => {
    if (connected) {
      sendCommand('mappingOff')
      // Polling is about to stop, so push one final get_map so
      // `latestMap.mapping` reflects the disabled state and the
      // status badge flips back to IDLE without waiting for the
      // user to hit Refresh.
      sendCommand('get_map')
    }
    setPolling(false)
  }
  const reset = () => {
    if (!connected) return
    sendCommand('slam_reset')
    // Surface the cleared grid + zeroed pose in the UI immediately
    // so the user sees the reset land without polling having to
    // resume. Also keeps the test suite deterministic.
    sendCommand('get_map')
  }
  const scanOnce = () => {
    if (connected) sendCommand('get_map')
  }
  const plan = () => {
    if (!connected) return
    sendCommand(`slam_plan ${planTarget.x} ${planTarget.y}`)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5 text-primary" />
                Live Occupancy Map
              </CardTitle>
              <CardDescription>
                Real backend SLAM stream. Toggles <code>mapping</code>/<code>mappingOff</code> on the firmware,
                then polls <code>get_map</code> 2&times;/sec while open.
              </CardDescription>
            </div>
            <Badge variant={stats?.mapping ? 'success' : 'secondary'}>
              {stats?.mapping ? 'MAPPING' : 'IDLE'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!connected && (
            <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm flex items-center gap-2 mb-3">
              <Plug className="h-4 w-4" />
              Connect to a backend in the Control Deck to start mapping.
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              onClick={polling ? stop : start}
              variant={polling ? 'destructive' : 'default'}
              className="gap-2"
              disabled={!connected}
            >
              {polling ? <><Pause className="h-4 w-4" /> Stop</> : <><Play className="h-4 w-4" /> Start</>}
            </Button>
            <Button variant="outline" onClick={reset} className="gap-2" disabled={!connected}>
              <RotateCcw className="h-4 w-4" /> Reset Map
            </Button>
            <Button variant="outline" onClick={scanOnce} className="gap-2" disabled={!connected}>
              <Scan className="h-4 w-4" /> Refresh
            </Button>
          </div>

          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-border"
              style={{ imageRendering: 'pixelated', maxWidth: '100%' }}
            />
          </div>

          <div className="flex flex-wrap gap-4 mt-4 text-xs">
            {[
              { color: COLORS.unknown, label: 'Unknown' },
              { color: COLORS.free, label: 'Free Space' },
              { color: COLORS.occupied, label: 'Obstacle' },
              { color: COLORS.robot, label: 'Robot' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: l.color }} />
                <span className="text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <Stat label="Coverage" value={stats ? `${stats.coverage}%` : '-'} highlight />
            <Stat label="Frontiers" value={stats?.frontiers ?? '-'} />
            <Stat label="Pose (cell)" value={stats?.pose ?? '-'} />
            <Stat label="Heading" value={stats?.heading ?? '-'} />
            <Stat label="Free cells" value={stats?.free ?? '-'} />
            <Stat label="Occupied" value={stats?.occupied ?? '-'} />
            <Stat label="Last update" value={ageMs !== null ? `${ageMs} ms` : 'no data'} />
            <Stat label="Connected" value={connected ? 'yes' : 'no'} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Map className="h-4 w-4" /> Path Plan
          </CardTitle>
          <CardDescription>
            Calls <code>slam_plan X Y</code> on the firmware. Returns the A* path length in cells, or 0 if no path was found.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs">
              <span className="text-muted-foreground block mb-1">Target X</span>
              <input
                type="number"
                value={planTarget.x}
                onChange={(e) => setPlanTarget((t) => ({ ...t, x: Number(e.target.value) }))}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm w-24"
              />
            </label>
            <label className="text-xs">
              <span className="text-muted-foreground block mb-1">Target Y</span>
              <input
                type="number"
                value={planTarget.y}
                onChange={(e) => setPlanTarget((t) => ({ ...t, y: Number(e.target.value) }))}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm w-24"
              />
            </label>
            <Button onClick={plan} disabled={!connected} className="gap-2">
              Plan Path
            </Button>
            <p className="text-xs text-muted-foreground max-w-md">
              The response is logged in the Command Log. Paths only become useful once the robot has driven enough cells to mark them free.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value, highlight = false }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className="text-center p-2 rounded-lg bg-secondary/50">
      <div className={`text-lg font-bold ${highlight ? 'text-primary' : ''}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
