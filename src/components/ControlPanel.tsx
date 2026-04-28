import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useWebSocket } from '@/hooks/useWebSocket'
import {
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw, RotateCw,
  ChevronUp, ChevronDown, Plug, Unplug, Thermometer, Cpu, MemoryStick,
  Battery, Square, Lightbulb, Siren, Eye, Palette, GitBranch, Ruler,
  ShieldAlert, ScanLine, Music, Sparkles, Volume2, Gamepad2, ShieldCheck,
  Radio, Activity, Map, type LucideIcon
} from 'lucide-react'

const connectionPresets = [
  { label: 'Local simulator', url: 'ws://localhost:8889', auth: 'admin:123456' },
  { label: 'Python robot (LAN)', url: 'ws://192.168.86.34:8888', auth: 'admin:123456' },
  { label: 'Python robot (.local)', url: 'ws://raspberry-pi.local:8888', auth: 'admin:123456' },
  { label: 'Zig robot (.local)', url: 'ws://raspberry-pi.local:8889', auth: 'admin:123456' },
]

const storageKeys = {
  url: 'awr-v3.wsUrl',
  auth: 'awr-v3.wsAuth',
}

type Backend = 'python' | 'zig' | 'simulator' | 'unknown'
type DemoStep = { cmd: string; delayMs?: number }
type DemoCard = {
  title: string
  desc: string
  category: 'sound' | 'lights' | 'sensors' | 'camera' | 'motion'
  icon: LucideIcon
  backends: Backend[]
  steps: DemoStep[]
  requiresArm?: boolean
}

const getBackend = (url: string): Backend => {
  if (url.includes('8889') && url.includes('localhost')) return 'simulator'
  if (url.includes('8889')) return 'zig'
  if (url.includes('8888')) return 'python'
  return 'unknown'
}

const demoCards: DemoCard[] = [
  { title: 'Baby Shark', desc: 'Short buzzer melody for kid demos.', category: 'sound', icon: Music, backends: ['zig', 'simulator'], steps: [{ cmd: 'tune baby_shark' }] },
  { title: 'Happy Birthday', desc: 'Classic Adeept buzzer tune.', category: 'sound', icon: Music, backends: ['zig', 'simulator'], steps: [{ cmd: 'tune happy_birthday' }] },
  { title: 'Seven Notes', desc: 'Quick musical scale proof-of-life.', category: 'sound', icon: Volume2, backends: ['zig', 'simulator'], steps: [{ cmd: 'tune seven_notes' }] },
  { title: 'Beep Marker', desc: 'Single C5 tone, very short.', category: 'sound', icon: Volume2, backends: ['zig', 'simulator'], steps: [{ cmd: 'tone C5 160' }] },
  { title: 'Police Lights', desc: 'Red/blue WS2812 flash mode.', category: 'lights', icon: Siren, backends: ['python', 'zig', 'simulator'], steps: [{ cmd: 'police' }] },
  { title: 'Breathe Blue', desc: 'Soft blue ambient glow.', category: 'lights', icon: Sparkles, backends: ['zig', 'simulator'], steps: [{ cmd: 'lights_breath_blue' }] },
  { title: 'Rainbow Sweep', desc: 'Color wheel pass over the strip.', category: 'lights', icon: Sparkles, backends: ['zig', 'simulator'], steps: [{ cmd: 'lights_rainbow' }] },
  { title: 'LED Wink', desc: 'Blink the three discrete LEDs.', category: 'lights', icon: Lightbulb, backends: ['python', 'zig', 'simulator'], steps: [
    { cmd: 'Switch_1_on', delayMs: 120 }, { cmd: 'Switch_2_on', delayMs: 120 }, { cmd: 'Switch_3_on', delayMs: 220 },
    { cmd: 'Switch_1_off', delayMs: 80 }, { cmd: 'Switch_2_off', delayMs: 80 }, { cmd: 'Switch_3_off' },
  ] },
  { title: 'Sensor Snapshot', desc: 'Poll backend telemetry now.', category: 'sensors', icon: Activity, backends: ['python', 'zig', 'simulator'], steps: [{ cmd: 'get_info' }] },
  { title: 'Camera Nod', desc: 'Tilt up and down once.', category: 'camera', icon: Radio, backends: ['python', 'zig', 'simulator'], steps: [
    { cmd: 'up', delayMs: 260 }, { cmd: 'UDstop', delayMs: 100 }, { cmd: 'down', delayMs: 260 }, { cmd: 'UDstop' },
  ] },
  { title: 'Tiny Forward Tap', desc: 'Very short movement pulse.', category: 'motion', icon: Gamepad2, backends: ['python', 'zig', 'simulator'], requiresArm: true, steps: [
    { cmd: 'wsB 25', delayMs: 80 }, { cmd: 'forward', delayMs: 350 }, { cmd: 'DS', delayMs: 80 }, { cmd: 'wsB 50' },
  ] },
  { title: 'Tiny Spin Tap', desc: 'Short rotate-left pulse.', category: 'motion', icon: RotateCcw, backends: ['python', 'zig', 'simulator'], requiresArm: true, steps: [
    { cmd: 'wsB 25', delayMs: 80 }, { cmd: 'rotate-left', delayMs: 300 }, { cmd: 'DS', delayMs: 80 }, { cmd: 'wsB 50' },
  ] },
]

const backendLabels: Record<Backend, string> = {
  python: 'Python',
  zig: 'Zig',
  simulator: 'Simulator',
  unknown: 'Custom',
}

export function ControlPanel() {
  const { connected, connecting, systemInfo, log, connect, disconnect, sendCommand } = useWebSocket()
  const [wsUrl, setWsUrl] = useState(() => localStorage.getItem(storageKeys.url) ?? connectionPresets[0].url)
  const [authMessage, setAuthMessage] = useState(() => localStorage.getItem(storageKeys.auth) ?? connectionPresets[0].auth)
  const [speed, setSpeed] = useState(50)
  const [driveArmed, setDriveArmed] = useState(false)
  const [functions, setFunctions] = useState<Record<string, boolean>>({})
  const [switches, setSwitches] = useState<Record<string, boolean>>({})
  const backend = getBackend(wsUrl)

  const handleConnect = () => {
    if (connected) {
      disconnect()
    } else {
      const nextUrl = wsUrl.trim()
      const nextAuth = authMessage.trim() || 'admin:123456'
      setAuthMessage(nextAuth)
      localStorage.setItem(storageKeys.url, nextUrl)
      localStorage.setItem(storageKeys.auth, nextAuth)
      connect({ url: nextUrl, authMessage: nextAuth })
    }
  }

  const applyPreset = (index: number) => {
    const preset = connectionPresets[index]
    if (!preset) return
    setWsUrl(preset.url)
    setAuthMessage(preset.auth)
  }

  const toggleFunction = (name: string, onCmd: string, offCmd: string, requiresArm = false) => {
    if (requiresArm && !driveArmed && !functions[name]) return
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

  const sendMotorCommand = useCallback((cmd: string) => {
    if (!driveArmed) return
    sendCommand(cmd)
  }, [driveArmed, sendCommand])

  const runDemo = useCallback((demo: DemoCard) => {
    if (!connected) return
    if (!demo.backends.includes(backend)) return
    if (demo.requiresArm && !driveArmed) return

    let elapsed = 0
    demo.steps.forEach((step) => {
      window.setTimeout(() => sendCommand(step.cmd), elapsed)
      elapsed += step.delayMs ?? 0
    })
  }, [backend, connected, driveArmed, sendCommand])

  // Movement button handlers - send on press, stop on release
  const moveHandlers = useCallback((cmd: string, stopCmd: string) => ({
    onPointerDown: () => sendMotorCommand(cmd),
    onPointerUp: () => sendCommand(stopCmd),
    onPointerLeave: () => sendCommand(stopCmd),
  }), [sendCommand, sendMotorCommand])

  const tiltHandlers = useCallback((cmd: string) => ({
    onPointerDown: () => sendCommand(cmd),
    onPointerUp: () => sendCommand('UDstop'),
    onPointerLeave: () => sendCommand('UDstop'),
  }), [sendCommand])

  // Keyboard controls
  useEffect(() => {
    const pressed = new Set<string>()
    const handledKeys = new Set([
      'w', 'a', 's', 'd',
      'arrowup', 'arrowleft', 'arrowdown', 'arrowright',
      'q', 'e', 'l', 'k',
    ])
    const motorKeys = new Set([
      'w', 'a', 's', 'd',
      'arrowup', 'arrowleft', 'arrowdown', 'arrowright',
      'q', 'e',
    ])

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement).isContentEditable) return
      const key = e.key.toLowerCase()
      if (!handledKeys.has(key)) return
      e.preventDefault()
      if (motorKeys.has(key) && !driveArmed) return
      if (pressed.has(key)) return
      pressed.add(key)
      switch (key) {
        case 'w': case 'arrowup': sendMotorCommand('forward'); break
        case 's': case 'arrowdown': sendMotorCommand('backward'); break
        case 'a': case 'arrowleft': sendMotorCommand('left'); break
        case 'd': case 'arrowright': sendMotorCommand('right'); break
        case 'q': sendMotorCommand('rotate-left'); break
        case 'e': sendMotorCommand('rotate-right'); break
        case 'l': sendCommand('up'); break
        case 'k': sendCommand('down'); break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement).isContentEditable) return
      const key = e.key.toLowerCase()
      if (!handledKeys.has(key)) return
      e.preventDefault()
      pressed.delete(key)
      switch (key) {
        case 'w': case 's': case 'arrowup': case 'arrowdown': sendCommand('DS'); break
        case 'a': case 'd': case 'arrowleft': case 'arrowright': sendCommand('TS'); break
        case 'q': case 'e': sendCommand('DS'); break
        case 'l': case 'k': sendCommand('UDstop'); break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [driveArmed, sendCommand, sendMotorCommand])

  return (
    <section id="control" className="py-10 md:py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
          <div>
            <Badge variant="secondary" className="mb-3">Mobile cockpit</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-2">Robot Control Deck</h2>
            <p className="text-muted-foreground text-sm max-w-2xl">
              Tap playful demos like a tiny synth, then drop into manual control. Keyboard: WASD or arrows=move, QE=rotate, L/K=camera tilt.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex gap-2">
            <Badge variant={connected ? 'success' : 'secondary'} className="justify-center px-3 py-2">
              {connected ? 'Connected' : 'Offline'}
            </Badge>
            <Badge variant="outline" className="justify-center px-3 py-2">
              {backendLabels[backend]} backend
            </Badge>
            <Button
              variant={driveArmed ? 'destructive' : 'outline'}
              onClick={() => {
                if (driveArmed) {
                  sendCommand('DS')
                  sendCommand('TS')
                }
                setDriveArmed((armed) => !armed)
              }}
              className="col-span-2 sm:col-span-1 gap-2"
            >
              <ShieldCheck className="h-4 w-4" />
              {driveArmed ? 'Drive Armed' : 'Arm Drive'}
            </Button>
            <Button
              variant="destructive"
              onClick={() => { sendCommand('DS'); sendCommand('TS'); sendCommand('UDstop'); setDriveArmed(false) }}
              className="col-span-2 sm:col-span-1 gap-2"
            >
              <Square className="h-4 w-4" />
              Stop All
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Connection */}
          <Card className="lg:col-span-3">
            <CardContent className="p-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${connected ? 'bg-success' : connecting ? 'bg-warning animate-pulse' : 'bg-destructive'}`} />
                <span className="text-sm font-medium">{connected ? 'Connected' : connecting ? 'Connecting...' : 'Disconnected'}</span>
              </div>
              <select
                onChange={(e) => applyPreset(Number(e.target.value))}
                defaultValue=""
                className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={connected || connecting}
              >
                <option value="" disabled>Endpoint preset</option>
                {connectionPresets.map((preset, index) => (
                  <option key={preset.label} value={index}>{preset.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                className="flex-1 min-w-[200px] bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="ws://robot-ip:8888"
                disabled={connected || connecting}
              />
              <input
                type="text"
                value={authMessage}
                onChange={(e) => setAuthMessage(e.target.value)}
                className="min-w-[160px] bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="user:password"
                disabled={connected || connecting}
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

          {/* Demo Pad */}
          <Card className="lg:col-span-3 overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/10">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Demo Pad
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Kid-friendly examples from the Adeept lessons, surfaced as one-tap performances.
                  </p>
                </div>
                <Badge variant={driveArmed ? 'destructive' : 'success'} className="w-fit">
                  {driveArmed ? 'Motor demos enabled' : 'No-drive demos only'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {demoCards.map((demo) => {
                  const supported = demo.backends.includes(backend)
                  const locked = Boolean(demo.requiresArm && !driveArmed)
                  const disabled = !connected || !supported || locked
                  return (
                    <Button
                      key={demo.title}
                      variant={demo.requiresArm ? 'outline' : demo.category === 'sound' ? 'secondary' : 'default'}
                      className="h-auto min-h-24 flex-col items-start justify-between rounded-2xl p-4 text-left whitespace-normal"
                      disabled={disabled}
                      onClick={() => runDemo(demo)}
                      title={!supported ? `Requires ${demo.backends.map((b) => backendLabels[b]).join(' or ')}` : locked ? 'Arm Drive first' : demo.desc}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <demo.icon className="h-5 w-5" />
                        <Badge variant={demo.requiresArm ? 'warning' : 'outline'} className="text-[10px]">
                          {demo.category}
                        </Badge>
                      </div>
                      <div>
                        <div className="font-semibold leading-tight">{demo.title}</div>
                        <div className="text-[11px] opacity-80 mt-1">{disabled ? (!supported ? 'Backend unavailable' : locked ? 'Arm drive first' : 'Connect first') : demo.desc}</div>
                      </div>
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Control Mixer */}
          <Card className="lg:col-span-2 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Gamepad2 className="h-4 w-4 text-primary" />
                Control Mixer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-6 items-start">
                <div>
                  <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
                    <Button size="icon" variant="outline" disabled={!driveArmed} {...moveHandlers('rotate-left', 'DS')} title="Rotate Left (Q)">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="outline" disabled={!driveArmed} {...moveHandlers('forward', 'DS')} title="Forward (W / Arrow Up)">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="outline" disabled={!driveArmed} {...moveHandlers('rotate-right', 'DS')} title="Rotate Right (E)">
                      <RotateCw className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="outline" disabled={!driveArmed} {...moveHandlers('left', 'TS')} title="Left (A / Arrow Left)">
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="destructive" onClick={() => { sendCommand('DS'); sendCommand('TS') }} title="Stop drive">
                      <Square className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="outline" disabled={!driveArmed} {...moveHandlers('right', 'TS')} title="Right (D / Arrow Right)">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <div />
                    <Button size="icon" variant="outline" disabled={!driveArmed} {...moveHandlers('backward', 'DS')} title="Backward (S / Arrow Down)">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <div />
                  </div>
                  {!driveArmed && (
                    <p className="text-[11px] text-center text-muted-foreground mt-3">
                      Arm Drive to enable motors. Camera tilt remains available.
                    </p>
                  )}
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
                </div>

                <div className="rounded-2xl border border-border bg-secondary/30 p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm font-medium">Camera Tilt</p>
                      <p className="text-[11px] text-muted-foreground">Hold L/K or press the tilt buttons.</p>
                    </div>
                    <Badge variant="outline">servo</Badge>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" className="gap-2" {...tiltHandlers('up')}>
                      <ChevronUp className="h-4 w-4" /> Up
                    </Button>
                    <Button variant="outline" className="gap-2" {...tiltHandlers('down')}>
                      <ChevronDown className="h-4 w-4" /> Down
                    </Button>
                  </div>

                  <div className="mt-5">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Servo Calibration</p>
                    <div className="grid grid-cols-3 gap-2">
                      <Button size="sm" variant="outline" onClick={() => sendCommand('SiLeft 0')}>PWM-</Button>
                      <Button size="sm" variant="outline" onClick={() => sendCommand('PWMMS 0')}>Middle</Button>
                      <Button size="sm" variant="outline" onClick={() => sendCommand('SiRight 0')}>PWM+</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <Button size="sm" variant="ghost" onClick={() => sendCommand('PWMD')}>Reset</Button>
                      <Button size="sm" variant="ghost" onClick={() => sendCommand('PWMINIT')}>Init</Button>
                    </div>
                  </div>
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

          {/* Robot Modes */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Robot Modes</CardTitle>
              <p className="text-xs text-muted-foreground">
                Stateful CV and autonomy toggles. One-tap lights and music live in the Demo Pad.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { name: 'findColor', label: 'Find Color', on: 'findColor', off: 'stopCV', icon: Palette },
                  { name: 'motionGet', label: 'Motion Detect', on: 'motionGet', off: 'stopCV', icon: Eye },
                  { name: 'automatic', label: 'Auto Obstacle', on: 'automatic', off: 'automaticOff', icon: ShieldAlert, requiresArm: true },
                  { name: 'trackLine', label: 'Track Line', on: 'trackLine', off: 'trackLineOff', icon: GitBranch, requiresArm: true },
                  { name: 'keepDistance', label: 'Keep Distance', on: 'keepDistance', off: 'keepDistanceOff', icon: Ruler, requiresArm: true },
                  { name: 'cvfl', label: 'CV Line Follow', on: 'CVFL', off: 'stopCV', icon: ScanLine, requiresArm: true },
                  { name: 'mapping', label: 'Live Mapping', on: 'mapping', off: 'mappingOff', icon: Map },
                ].map((f) => (
                  <Button
                    key={f.name}
                    variant={functions[f.name] ? 'success' : 'outline'}
                    size="sm"
                    className="gap-1.5 justify-start"
                    disabled={Boolean(f.requiresArm && !driveArmed && !functions[f.name])}
                    title={f.requiresArm && !driveArmed ? 'Arm Drive first' : undefined}
                    onClick={() => toggleFunction(f.name, f.on, f.off, f.requiresArm)}
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
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}