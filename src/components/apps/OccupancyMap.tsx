import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Map, Play, Pause, RotateCcw, Navigation, Scan } from 'lucide-react'

const GRID_SIZE = 80
const CELL_PX = 6
const CANVAS_SIZE = GRID_SIZE * CELL_PX

// Cell states: 0=unknown, 1=free, 2=obstacle, 3=robot, 4=path, 5=frontier
type CellState = 0 | 1 | 2 | 3 | 4 | 5

const COLORS: Record<CellState, string> = {
  0: '#18181b',
  1: '#1a1a2e',
  2: '#3b82f6',
  3: '#22c55e',
  4: '#f59e0b',
  5: '#6366f1',
}

function createGrid(): CellState[][] {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => 0 as CellState)
  )
}

function generateWalls(grid: CellState[][]) {
  // Create some room-like structures
  const walls: [number, number, number, number][] = [
    [10, 10, 10, 1], [10, 10, 1, 25], [10, 35, 1, 20], [30, 10, 1, 45],
    [10, 55, 21, 1], [50, 20, 1, 36], [35, 20, 15, 1],
    [60, 10, 1, 30], [60, 40, 15, 1], [60, 60, 1, 15],
    [20, 70, 40, 1], [15, 45, 15, 1],
  ]
  walls.forEach(([y, x, h, w]) => {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const ny = y + dy, nx = x + dx
        if (ny >= 0 && ny < GRID_SIZE && nx >= 0 && nx < GRID_SIZE) {
          grid[ny][nx] = 2
        }
      }
    }
  })
}

export function OccupancyMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [grid, setGrid] = useState<CellState[][]>(() => {
    const g = createGrid()
    generateWalls(g)
    return g
  })
  const [robotPos, setRobotPos] = useState({ x: 40, y: 40 })
  const [exploring, setExploring] = useState(false)
  const [cellsExplored, setCellsExplored] = useState(0)
  const [totalObstacles, setTotalObstacles] = useState(0)
  const exploringRef = useRef(false)
  const robotPosRef = useRef({ x: 40, y: 40 })
  const gridRef = useRef(grid)

  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const currentGrid = gridRef.current
    const pos = robotPosRef.current

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        ctx.fillStyle = COLORS[currentGrid[y][x]]
        ctx.fillRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX)
      }
    }

    // Draw robot
    ctx.fillStyle = COLORS[3]
    ctx.beginPath()
    ctx.arc(pos.x * CELL_PX + CELL_PX / 2, pos.y * CELL_PX + CELL_PX / 2, CELL_PX * 1.5, 0, Math.PI * 2)
    ctx.fill()

    // Draw sensor cone
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'
    ctx.beginPath()
    ctx.moveTo(pos.x * CELL_PX + CELL_PX / 2, pos.y * CELL_PX + CELL_PX / 2)
    ctx.arc(pos.x * CELL_PX + CELL_PX / 2, pos.y * CELL_PX + CELL_PX / 2, CELL_PX * 12, -Math.PI / 3, Math.PI / 3)
    ctx.closePath()
    ctx.fill()

    // Grid lines (subtle)
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= GRID_SIZE; i += 10) {
      ctx.beginPath()
      ctx.moveTo(i * CELL_PX, 0)
      ctx.lineTo(i * CELL_PX, CANVAS_SIZE)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i * CELL_PX)
      ctx.lineTo(CANVAS_SIZE, i * CELL_PX)
      ctx.stroke()
    }
  }, [])

  // Simulate ultrasonic scan around robot
  const scanArea = useCallback(() => {
    const g = gridRef.current
    const pos = robotPosRef.current
    const scanRadius = 8
    let explored = 0
    let obstacles = 0

    for (let dy = -scanRadius; dy <= scanRadius; dy++) {
      for (let dx = -scanRadius; dx <= scanRadius; dx++) {
        const ny = pos.y + dy, nx = pos.x + dx
        if (ny >= 0 && ny < GRID_SIZE && nx >= 0 && nx < GRID_SIZE) {
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist <= scanRadius) {
            if (g[ny][nx] === 0) {
              g[ny][nx] = 1
              explored++
            }
            if (g[ny][nx] === 2) obstacles++
          }
        }
      }
    }

    return { explored, obstacles }
  }, [])

  // Exploration step: move robot toward nearest frontier
  const explorationStep = useCallback(() => {
    const g = gridRef.current
    const pos = robotPosRef.current

    // Scan current area
    const { explored, obstacles } = scanArea()
    setCellsExplored(prev => prev + explored)
    setTotalObstacles(obstacles)

    // Find nearest unknown cell (frontier exploration)
    let bestDist = Infinity
    let bestDir = { dx: 0, dy: 0 }
    const searchRadius = 20

    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        const ny = pos.y + dy, nx = pos.x + dx
        if (ny >= 1 && ny < GRID_SIZE - 1 && nx >= 1 && nx < GRID_SIZE - 1) {
          if (g[ny][nx] === 0) {
            // Check if adjacent to known free space
            const hasFreNeighbor = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(
              ([ddy, ddx]) => g[ny + ddy]?.[nx + ddx] === 1
            )
            if (hasFreNeighbor) {
              const dist = Math.abs(dx) + Math.abs(dy)
              if (dist < bestDist) {
                bestDist = dist
                bestDir = { dx: Math.sign(dx), dy: Math.sign(dy) }
              }
            }
          }
        }
      }
    }

    // Move robot
    const nx = pos.x + bestDir.dx
    const ny = pos.y + bestDir.dy
    if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && g[ny][nx] !== 2) {
      // Mark path
      if (g[pos.y][pos.x] === 1 || g[pos.y][pos.x] === 3) {
        g[pos.y][pos.x] = 4
      }
      robotPosRef.current = { x: nx, y: ny }
      setRobotPos({ x: nx, y: ny })
    } else {
      // Random move if stuck
      const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }]
      const shuffled = dirs.sort(() => Math.random() - 0.5)
      for (const d of shuffled) {
        const nnx = pos.x + d.dx, nny = pos.y + d.dy
        if (nnx >= 0 && nnx < GRID_SIZE && nny >= 0 && nny < GRID_SIZE && g[nny][nnx] !== 2) {
          if (g[pos.y][pos.x] !== 2) g[pos.y][pos.x] = 4
          robotPosRef.current = { x: nnx, y: nny }
          setRobotPos({ x: nnx, y: nny })
          break
        }
      }
    }

    setGrid([...g])
    gridRef.current = g
    drawGrid()
  }, [scanArea, drawGrid])

  // Animation loop
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>
    if (exploring) {
      exploringRef.current = true
      timer = setInterval(() => {
        if (exploringRef.current) explorationStep()
      }, 80)
    } else {
      exploringRef.current = false
    }
    return () => clearInterval(timer)
  }, [exploring, explorationStep])

  // Initial draw
  useEffect(() => {
    drawGrid()
  }, [drawGrid])

  const resetMap = () => {
    setExploring(false)
    exploringRef.current = false
    const g = createGrid()
    generateWalls(g)
    gridRef.current = g
    setGrid(g)
    robotPosRef.current = { x: 40, y: 40 }
    setRobotPos({ x: 40, y: 40 })
    setCellsExplored(0)
    setTotalObstacles(0)
    setTimeout(drawGrid, 50)
  }

  const coverage = Math.round((cellsExplored / (GRID_SIZE * GRID_SIZE)) * 100)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5 text-primary" />
                Occupancy Grid Map
              </CardTitle>
              <CardDescription>
                Simulated frontier exploration using ultrasonic scanning. On the real robot, this combines ultrasonic distance + camera depth estimation.
              </CardDescription>
            </div>
            <Badge variant={exploring ? 'success' : 'secondary'}>
              {exploring ? 'EXPLORING' : 'IDLE'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Controls */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              onClick={() => setExploring(!exploring)}
              variant={exploring ? 'destructive' : 'default'}
              className="gap-2"
            >
              {exploring ? <><Pause className="h-4 w-4" /> Pause</> : <><Play className="h-4 w-4" /> Explore</>}
            </Button>
            <Button variant="outline" onClick={resetMap} className="gap-2">
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
            <Button variant="outline" onClick={() => { scanArea(); drawGrid() }} className="gap-2">
              <Scan className="h-4 w-4" /> Scan Once
            </Button>
          </div>

          {/* Map canvas */}
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="rounded-lg border border-border"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 text-xs">
            {[
              { color: COLORS[0], label: 'Unknown' },
              { color: COLORS[1], label: 'Free Space' },
              { color: COLORS[2], label: 'Obstacle' },
              { color: COLORS[3], label: 'Robot' },
              { color: COLORS[4], label: 'Path Traveled' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: l.color }} />
                <span className="text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            <div className="text-center p-2 rounded-lg bg-secondary/50">
              <div className="text-lg font-bold text-primary">{coverage}%</div>
              <div className="text-xs text-muted-foreground">Coverage</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-secondary/50">
              <div className="text-lg font-bold">{cellsExplored}</div>
              <div className="text-xs text-muted-foreground">Cells Explored</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-secondary/50">
              <div className="text-lg font-bold text-destructive">{totalObstacles}</div>
              <div className="text-xs text-muted-foreground">Obstacles Found</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-secondary/50">
              <div className="text-lg font-bold text-success">({robotPos.x}, {robotPos.y})</div>
              <div className="text-xs text-muted-foreground">Robot Position</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Implementation guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Navigation className="h-4 w-4" /> Real-World Implementation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>To implement occupancy mapping on the actual AWR-V3 robot:</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { step: '1. Ultrasonic Scanning', desc: 'Sweep the servo-mounted ultrasonic sensor across angles while recording distances. Each distance reading maps to a grid cell.' },
                { step: '2. Camera Depth Estimation', desc: 'Use monocular depth estimation (MiDaS or DPT models) to generate dense depth maps from camera frames.' },
                { step: '3. Grid Fusion', desc: 'Combine ultrasonic point measurements with camera depth into a probabilistic occupancy grid using Bayesian updating.' },
                { step: '4. Frontier Exploration', desc: 'Identify boundaries between known-free and unknown cells. Navigate to nearest frontier for autonomous exploration.' },
                { step: '5. Visual Odometry', desc: 'Track robot movement using ORB features between frames. Correct odometry drift with loop closure detection.' },
                { step: '6. Path Planning', desc: 'Use A* or Dijkstra on the occupancy grid to find optimal paths around obstacles to goal positions.' },
              ].map((s) => (
                <div key={s.step} className="p-3 rounded-lg bg-secondary/50">
                  <div className="font-medium text-foreground mb-1">{s.step}</div>
                  <p className="text-xs">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}