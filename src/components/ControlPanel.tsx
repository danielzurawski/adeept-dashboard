import { useState, useCallback, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useWebSocket } from '@/hooks/useWebSocket'
import {
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw, RotateCw,
  ChevronUp, ChevronDown, Plug, Unplug, Thermometer, Cpu, MemoryStick,
  Battery, Square, Lightbulb, Siren, Eye, Palette, GitBranch, Ruler,
  ShieldAlert, ScanLine
} from 'lucide-react'

export function ControlPanel() {
  const { connected, connecting, systemInfo, log, connect, disconnect, sendCommand } = useWebSocket()
  const [wsUrl, setWsUrl] = useState('ws://localhost:8889')
  const [speed, setSpeed] = useState(50)
  const [functions, setFunctions] = useState<Record<string, boolean>>({})
  const [switches, setSwitches] = useState<Record<string, boolean>>({})
  const logEndRef = useRef<HTMLDivElement>(null)

  const handleConnect = () => {
    if (connected) {
      disconnect()
    } else {
      connect(wsUrl)
    }
  }

  const toggleFunction = (name: string, onCmd: string, offCmd: string) => {
    const isOn = functions[name]
    if (isOn) {
      sendCommand(offCmd)
    } else {
      sendCommand(onCmd)
    }
    setFunctions(prev => ({ ...prev, [name]: !isOn }))
  }

  const toggleSwitch = (port: number) => {
    const key = `switch_${port}`
    const isOn = switches[key]
    sendCommand(isOn ? `Switch_${port}_off` : `Switch_${port}_on`)
    setSwitches(prev => ({ ...prev, [key]: !isOn }))
  }

  // Movement button handlers - send on press, stop on release
  const moveHandlers = useCallback((cmd: string, stopCmd: string) => ({
    onPointerDown: () => sendCommand(cmd),
    onPointerUp: () => sendCommand(stopCmd),
    onPointerLeave: () => sendCommand(stopCmd),
  }), [sendCommand])

  // Keyboard controls
  useEffect(() => {
    const pressed = new Set<string>()
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement).isContentEditable) return
      if (pressed.has(e.key)) return
      pressed.add(e.key)
      switch (e.key.toLowerCase()) {
        case 'w': sendCommand('forward'); break
        case 's': sendCommand('backward'); break
        case 'a': sendCommand('left'); break
        case 'd': sendCommand('right'); break
        case 'q': sendCommand('rotate-left'); break
        case 'e': sendCommand('rotate-right'); break
        case 'i': sendCommand('up'); break
        case 'k': sendCommand('down'); break
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement).isContentEditable) return
      pressed.delete(e.key)
      switch (e.key.toLowerCase()) {
        case 'w': case 's': sendCommand('DS'); break
        case 'a': case 'd': sendCommand('TS'); break
        case 'q': case 'e': sendCommand('DS'); break
        case 'i': case 'k': sendCommand('UDstop'); break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [sendCommand])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  return (
    <section id="control" className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-2">Robot Control Panel</h2>
        <p className="text-muted-foreground mb-8 text-sm">
          Reimplementation of the original WebSocket control protocol. Connect to the robot or simulation server.
          Keyboard: WASD=move, QE=rotate, IK=camera tilt.
        </p>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Connection */}
          <Card className="lg:col-span-3">
            <CardContent className="p-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${connected ? 'bg-success' : connecting ? 'bg-warning animate-pulse' : 'bg-destructive'}`} />
                <span className="text-sm font-medium">{connected ? 'Connected' : connecting ? 'Connecting...' : 'Disconnected'}</span>
              </div>
              <input
                type="text"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                className="flex-1 min-w-[200px] bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="ws://robot-ip:8888"
              />
              <Button
                onClick={handleConnect}
                variant={connected ? 'destructive' : 'default'}
                className="gap-2"
              >
                {connected ? <><Unplug className="h-4 w-4" /> Disconnect</> : <><Plug className="h-4 w-4" /> Connect</>}
              </Button>
            </CardContent>
          </Card>

          {/* Movement */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Movement</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto">
                <Button size="icon" variant="outline" {...moveHandlers('rotate-left', 'DS')} title="Rotate Left (Q)">
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" {...moveHandlers('forward', 'DS')} title="Forward (W)">
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" {...moveHandlers('rotate-right', 'DS')} title="Rotate Right (E)">
                  <RotateCw className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" {...moveHandlers('left', 'TS')} title="Left (A)">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="destructive" onClick={() => { sendCommand('DS'); sendCommand('TS') }} title="Stop">
                  <Square className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" {...moveHandlers('right', 'TS')} title="Right (D)">
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <div />
                <Button size="icon" variant="outline" {...moveHandlers('backward', 'DS')} title="Backward (S)">
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <div />
              </div>
              <div className="mt-4">
                <label className="text-xs text-muted-foreground mb-1 block">Speed: {speed}%</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  value={speed}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setSpeed(v)
                    sendCommand(`wsB ${v}`)
                  }}
                  className="w-full accent-primary"
                />
              </div>
            </CardContent>
          </Card>

          {/* Camera Tilt */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Camera Tilt</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-2">
                <Button variant="outline" className="w-24 gap-2" {...moveHandlers('up', 'UDstop')}>
                  <ChevronUp className="h-4 w-4" /> Up (I)
                </Button>
                <Button variant="outline" className="w-24 gap-2" {...moveHandlers('down', 'UDstop')}>
                  <ChevronDown className="h-4 w-4" /> Down (K)
                </Button>
              </div>

              <div className="mt-6">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Servo Calibration</p>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" variant="outline" onClick={() => sendCommand('SiLeft 0')}>PWM-</Button>
                  <Button size="sm" variant="outline" onClick={() => sendCommand('PWMMS 0')}>Middle</Button>
                  <Button size="sm" variant="outline" onClick={() => sendCommand('SiRight 0')}>PWM+</Button>
                </div>
                <div className="flex gap-2 justify-center mt-2">
                  <Button size="sm" variant="ghost" onClick={() => sendCommand('PWMD')}>Reset All</Button>
                  <Button size="sm" variant="ghost" onClick={() => sendCommand('PWMINIT')}>Init</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Info */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">System Info</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm"><Thermometer className="h-4 w-4 text-destructive" /> CPU Temp</div>
                  <span className="font-mono text-sm">{systemInfo.cpuTemp}{systemInfo.cpuTemp !== 'N/A' ? '°C' : ''}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm"><Cpu className="h-4 w-4 text-primary" /> CPU Usage</div>
                  <span className="font-mono text-sm">{systemInfo.cpuUsage}{systemInfo.cpuUsage !== 'N/A' ? '%' : ''}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm"><MemoryStick className="h-4 w-4 text-warning" /> RAM Usage</div>
                  <span className="font-mono text-sm">{systemInfo.ramUsage}{systemInfo.ramUsage !== 'N/A' ? '%' : ''}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm"><Battery className="h-4 w-4 text-success" /> Battery</div>
                  <span className="font-mono text-sm">{systemInfo.battery}{systemInfo.battery !== 'N/A' ? '%' : ''}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Functions */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3"><CardTitle className="text-base">Functions</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { name: 'findColor', label: 'Find Color', on: 'findColor', off: 'stopCV', icon: Palette },
                  { name: 'motionGet', label: 'Motion Detect', on: 'motionGet', off: 'stopCV', icon: Eye },
                  { name: 'automatic', label: 'Auto Obstacle', on: 'automatic', off: 'automaticOff', icon: ShieldAlert },
                  { name: 'trackLine', label: 'Track Line', on: 'trackLine', off: 'trackLineOff', icon: GitBranch },
                  { name: 'keepDistance', label: 'Keep Distance', on: 'keepDistance', off: 'keepDistanceOff', icon: Ruler },
                  { name: 'police', label: 'Police Lights', on: 'police', off: 'policeOff', icon: Siren },
                  { name: 'cvfl', label: 'CV Line Follow', on: 'CVFL', off: 'stopCV', icon: ScanLine },
                ].map((f) => (
                  <Button
                    key={f.name}
                    variant={functions[f.name] ? 'success' : 'outline'}
                    size="sm"
                    className="gap-1.5 justify-start"
                    onClick={() => toggleFunction(f.name, f.on, f.off)}
                  >
                    <f.icon className="h-3.5 w-3.5" />
                    {f.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* LED Switches */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">LED Ports</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[1, 2, 3].map((port) => (
                  <Button
                    key={port}
                    variant={switches[`switch_${port}`] ? 'success' : 'outline'}
                    size="sm"
                    className="w-full gap-2 justify-start"
                    onClick={() => toggleSwitch(port)}
                  >
                    <Lightbulb className="h-3.5 w-3.5" />
                    Port {port} — {switches[`switch_${port}`] ? 'ON' : 'OFF'}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Command Log */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3"><CardTitle className="text-base">Command Log</CardTitle></CardHeader>
            <CardContent>
              <div className="h-40 overflow-y-auto bg-background rounded-lg p-3 font-mono text-xs space-y-1">
                {log.length === 0 ? (
                  <span className="text-muted-foreground">No commands yet. Connect to the robot to start.</span>
                ) : (
                  log.map((entry, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-muted-foreground shrink-0">{entry.time}</span>
                      <Badge variant={entry.direction === 'sent' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                        {entry.direction === 'sent' ? 'TX' : 'RX'}
                      </Badge>
                      <span className={entry.direction === 'sent' ? 'text-primary' : 'text-muted-foreground'}>{entry.message}</span>
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}