import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Camera, Map, Gamepad2, Eye, Palette, GitBranch, ShieldAlert,
  Ruler, Siren, Music, ScanLine, Brain, Mic, Navigation, Monitor,
  Gauge, Thermometer, QrCode, Compass, Cpu, Radio, Lightbulb,
  BarChart3, type LucideIcon
} from 'lucide-react'

interface CapabilityDef {
  id: string
  name: string
  icon: LucideIcon
  desc: string
  category: string
  tags: string[]
  surface: 'panel' | 'control-deck' | 'robot-mode' | 'demo-pad' | 'telemetry'
  command?: string
  safety?: string
}

interface RoadmapDef {
  id: string
  name: string
  icon: LucideIcon
  desc: string
  category: string
  tags: string[]
  nextStep: string
  dependsOn: string
}

const capabilities: CapabilityDef[] = [
  { id: 'manual-drive', name: 'Manual Driving', icon: Gamepad2, desc: '4WD movement through the unified Control Mixer, with touch, keyboard, speed, stop, and arm/disarm safety.', category: 'control', tags: ['motor', 'websocket'], surface: 'control-deck', command: 'forward/backward/left/right/rotate-*', safety: 'Requires Drive Armed' },
  { id: 'camera-view', name: 'Live Camera', icon: Camera, desc: 'Configurable MJPEG stream panel for the Python Flask camera endpoint or a compatible future camera bridge.', category: 'vision', tags: ['camera', 'flask'], surface: 'panel' },
  { id: 'color-track', name: 'Color Tracking', icon: Palette, desc: 'Toggles the existing OpenCV color-following mode exposed by the Python robot server.', category: 'vision', tags: ['opencv', 'servo', 'camera'], surface: 'robot-mode', command: 'findColor / stopCV' },
  { id: 'motion-detect', name: 'Motion Detection', icon: Eye, desc: 'Toggles the existing motion detection mode exposed by the Python robot server.', category: 'vision', tags: ['opencv', 'camera'], surface: 'robot-mode', command: 'motionGet / stopCV' },
  { id: 'obstacle-avoid', name: 'Obstacle Avoidance', icon: ShieldAlert, desc: 'Starts the ultrasonic obstacle avoidance loop from the robot backend.', category: 'autonomy', tags: ['ultrasonic', 'motor'], surface: 'robot-mode', command: 'automatic / automaticOff', safety: 'Requires Drive Armed' },
  { id: 'ir-line-track', name: 'IR Line Tracking', icon: GitBranch, desc: 'Starts the three-channel infrared line tracking mode from the robot backend.', category: 'autonomy', tags: ['ir', 'motor'], surface: 'robot-mode', command: 'trackLine / trackLineOff', safety: 'Requires Drive Armed' },
  { id: 'cv-line-follow', name: 'Video Line Follow', icon: ScanLine, desc: 'Starts the camera-based line following mode from the robot backend.', category: 'autonomy', tags: ['opencv', 'camera', 'motor'], surface: 'robot-mode', command: 'CVFL / stopCV', safety: 'Requires Drive Armed' },
  { id: 'keep-distance', name: 'Distance Keeping', icon: Ruler, desc: 'Starts the ultrasonic keep-distance behavior from the robot backend.', category: 'autonomy', tags: ['ultrasonic', 'motor'], surface: 'robot-mode', command: 'keepDistance / keepDistanceOff', safety: 'Requires Drive Armed' },
  { id: 'police-lights', name: 'Police Lights', icon: Siren, desc: 'Runs the red/blue WS2812 light effect from the Demo Pad.', category: 'output', tags: ['ws2812', 'spi'], surface: 'demo-pad', command: 'police' },
  { id: 'buzzer-music', name: 'Buzzer Music', icon: Music, desc: 'Runs backend-supported tones and tunes from the Demo Pad.', category: 'output', tags: ['buzzer', 'gpio'], surface: 'demo-pad', command: 'tone / tune' },
  { id: 'battery-mon', name: 'Battery Monitor', icon: Gauge, desc: 'Shows battery telemetry returned by the backend info packet.', category: 'system', tags: ['adc', 'i2c'], surface: 'telemetry', command: 'get_info' },
  { id: 'sys-info', name: 'System Info', icon: Thermometer, desc: 'Shows CPU temperature, CPU usage, RAM usage, and battery fields from backend telemetry.', category: 'system', tags: ['psutil'], surface: 'telemetry', command: 'get_info' },
  { id: 'live-occupancy-map', name: 'Live Occupancy Map', icon: Map, desc: 'Real backend SLAM panel: toggles mapping on the firmware, streams the occupancy grid, and exposes A* path planning over the same WebSocket.', category: 'autonomy', tags: ['slam', 'ultrasonic', 'astar'], surface: 'panel', command: 'mapping / mappingOff / get_map / slam_plan', safety: 'Pose is dead-reckoned; map drifts over long runs' },
  { id: 'occupancy-map', name: 'Occupancy Map (sim)', icon: Map, desc: 'Browser-only occupancy grid demo. Useful for showcasing mapping UI without a robot connected; does not command the robot.', category: 'autonomy', tags: ['slam', 'prototype'], surface: 'panel', safety: 'Pure dashboard simulation' },
]

const roadmap: RoadmapDef[] = [
  { id: 'face-follow', name: 'Face Following', icon: Eye, desc: 'Haar/DNN face detection with PID-controlled servo and cautious motor following.', category: 'vision', tags: ['opencv', 'servo', 'motor'], nextStep: 'Add a dedicated panel with detector settings, preview overlays, and explicit drive arming.', dependsOn: 'Stable camera stream and safe motor policy' },
  { id: 'qr-scanner', name: 'QR Code Scanner', icon: QrCode, desc: 'Decode QR/barcodes from camera frames and trigger route or station actions.', category: 'vision', tags: ['opencv', 'camera'], nextStep: 'Add camera-frame capture API and a scanner result panel.', dependsOn: 'Camera bridge or Python Flask stream snapshots' },
  { id: 'led-sequencer', name: 'LED Show Sequencer', icon: Lightbulb, desc: 'Programmable WS2812 animations such as fire, comet, theater chase, and sparkle.', category: 'output', tags: ['ws2812', 'spi'], nextStep: 'Standardize effect commands across Python, Zig, and simulator backends.', dependsOn: 'Shared WebSocket effect protocol' },
  { id: 'data-dashboard', name: 'Data Dashboard', icon: BarChart3, desc: 'Historical battery, telemetry, sonar, and mode logs with charting.', category: 'system', tags: ['database', 'telemetry'], nextStep: 'Persist simulator/robot telemetry and render trend panels.', dependsOn: 'Backend state endpoint or event stream' },
  { id: 'maze-solver', name: 'Maze Solver', icon: Navigation, desc: 'Wall-following algorithm using ultrasonic distance and conservative motor pulses.', category: 'autonomy', tags: ['ultrasonic', 'motor'], nextStep: 'Implement as a bounded FSM with diagnostics markers and stop-on-fault behavior.', dependsOn: 'Reliable sonar and drive calibration' },
  { id: 'patrol-mode', name: 'Patrol Mode', icon: Compass, desc: 'Record and replay waypoints or short motion macros.', category: 'autonomy', tags: ['motor', 'waypoints'], nextStep: 'Add route recording UI and backend macro execution with emergency stop.', dependsOn: 'Pose/dead-reckoning confidence' },
  { id: 'tflite-detect', name: 'TFLite Detection', icon: Brain, desc: 'MobileNet SSD on newer Pi hardware for real-time object detection.', category: 'ai', tags: ['tensorflow', 'camera'], nextStep: 'Benchmark camera FPS and CPU budget before adding model controls.', dependsOn: 'Pi 4/5 class hardware or offboard inference' },
  { id: 'voice-control', name: 'Voice Control', icon: Mic, desc: 'USB microphone plus local or remote speech recognition for natural-language commands.', category: 'ai', tags: ['whisper', 'mic'], nextStep: 'Define a constrained command grammar and confirmation flow.', dependsOn: 'Microphone hardware and safety prompts' },
  { id: 'visual-slam', name: 'Visual SLAM', icon: Map, desc: 'Camera-assisted localization and mapping beyond the current occupancy-grid prototype.', category: 'ai', tags: ['slam', 'camera', 'orb'], nextStep: 'Start with visual odometry diagnostics before full SLAM.', dependsOn: 'Camera reliability and calibrated motion model' },
  { id: 'person-follow', name: 'Person Following', icon: Eye, desc: 'Detect and follow a person using vision plus cautious motion control.', category: 'ai', tags: ['opencv', 'pid', 'motor'], nextStep: 'Gate movement behind Drive Armed and distance checks.', dependsOn: 'Face/person detection and sonar fusion' },
  { id: 'oled-display', name: 'OLED Dashboard', icon: Monitor, desc: 'SSD1306 display showing IP, battery, mode, and sensor status on the robot.', category: 'hardware', tags: ['i2c', 'oled'], nextStep: 'Add hardware detection and a tiny status-rendering service.', dependsOn: 'OLED module installation' },
  { id: 'imu-stabilize', name: 'IMU Stabilization', icon: Compass, desc: 'MPU6050 gyro/accelerometer for tilt detection and dead-reckoning support.', category: 'hardware', tags: ['mpu6050', 'i2c'], nextStep: 'Add I2C diagnostics and calibration UI.', dependsOn: 'IMU hardware installation' },
  { id: 'ir-remote', name: 'IR Remote', icon: Radio, desc: 'Decode onboard IR receiver signals for WiFi-free control.', category: 'hardware', tags: ['ir', 'gpio'], nextStep: 'Add pulse capture diagnostics and remote key mapping.', dependsOn: 'IR receiver validation' },
  { id: 'arm-gripper', name: 'Robotic Arm', icon: Cpu, desc: '2-3 DOF arm or gripper on spare PCA9685 servo channels.', category: 'hardware', tags: ['servo', 'pca9685'], nextStep: 'Add servo channel mapping and calibration panel.', dependsOn: 'Mechanical arm hardware' },
]

const surfaceLabels: Record<CapabilityDef['surface'], string> = {
  'panel': 'Interactive Panel',
  'control-deck': 'Control Deck',
  'robot-mode': 'Robot Mode',
  'demo-pad': 'Demo Pad',
  'telemetry': 'Telemetry',
}

const surfaceVariants: Record<CapabilityDef['surface'], "success" | "default" | "secondary" | "outline"> = {
  'panel': 'default',
  'control-deck': 'success',
  'robot-mode': 'success',
  'demo-pad': 'secondary',
  'telemetry': 'outline',
}

const categories = [
  { id: 'all', label: 'All' },
  { id: 'control', label: 'Control' },
  { id: 'vision', label: 'Vision' },
  { id: 'autonomy', label: 'Autonomy' },
  { id: 'output', label: 'Output' },
  { id: 'system', label: 'System' },
  { id: 'ai', label: 'AI / ML' },
  { id: 'hardware', label: 'Hardware' },
]

interface AppGalleryProps {
  openableAppIds: string[]
  onOpenApp: (id: string) => void
}

export function AppGallery({ openableAppIds, onOpenApp }: AppGalleryProps) {
  const [search, setSearch] = useState('')
  const openableApps = new Set(openableAppIds)

  const matchesSearch = (item: CapabilityDef | RoadmapDef) => {
    const term = search.toLowerCase()
    return !term || item.name.toLowerCase().includes(term) || item.desc.toLowerCase().includes(term) || item.tags.some(t => t.includes(term))
  }

  const filterCapabilities = (cat: string) => {
    return capabilities.filter(item => (cat === 'all' || item.category === cat) && matchesSearch(item))
  }

  const filteredRoadmap = roadmap.filter(matchesSearch)

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search apps, features, or tags..."
          className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="text-sm text-muted-foreground whitespace-nowrap">
          {capabilities.length} usable / {roadmap.length} roadmap
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold">Capabilities</h3>
          <p className="text-sm text-muted-foreground">
            Usable dashboard surfaces: panels, Control Deck controls, Robot Modes, Demo Pad actions, and telemetry.
          </p>
        </div>

        <Tabs defaultValue="all">
          <TabsList className="flex-wrap">
            {categories.slice(0, 6).map((c) => (
              <TabsTrigger key={c.id} value={c.id}>{c.label}</TabsTrigger>
            ))}
          </TabsList>
          {categories.slice(0, 6).map((cat) => (
            <TabsContent key={cat.id} value={cat.id}>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filterCapabilities(cat.id).map((app) => {
                  const canOpen = openableApps.has(app.id)

                  return (
                    <Card key={app.id} className="hover:border-primary/30 transition-colors group">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 shrink-0 group-hover:bg-primary/20 transition-colors">
                            <app.icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm truncate">{app.name}</span>
                              <Badge variant={surfaceVariants[app.surface]} className="text-[10px] shrink-0">
                                {surfaceLabels[app.surface]}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-3">{app.desc}</p>
                            <div className="space-y-2">
                              {app.command && (
                                <div className="text-[11px] text-muted-foreground">
                                  <span className="font-medium text-foreground">Command:</span> {app.command}
                                </div>
                              )}
                              {app.safety && (
                                <div className="text-[11px] text-warning">
                                  <span className="font-medium">Note:</span> {app.safety}
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <div className="flex flex-wrap gap-1 flex-1">
                                  {app.tags.slice(0, 3).map((t) => (
                                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{t}</span>
                                  ))}
                                </div>
                                {canOpen ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs shrink-0"
                                    onClick={() => onOpenApp(app.id)}
                                  >
                                    Open panel
                                  </Button>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] shrink-0">
                                    Use {surfaceLabels[app.surface]}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold">Roadmap</h3>
          <p className="text-sm text-muted-foreground">
            Unimplemented or not-yet-integrated features, with the concrete dependency that blocks each one.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredRoadmap.map((item) => (
            <Card key={item.id} className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <item.icon className="h-4 w-4 text-primary" />
                  {item.name}
                  <Badge variant="secondary" className="text-[10px] ml-auto">Roadmap</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <p className="text-xs text-muted-foreground">{item.desc}</p>
                <div className="rounded-lg bg-secondary/50 p-2 text-[11px] space-y-1">
                  <div><span className="font-medium text-foreground">Next:</span> {item.nextStep}</div>
                  <div><span className="font-medium text-foreground">Depends on:</span> {item.dependsOn}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {item.tags.slice(0, 4).map((t) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{t}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}