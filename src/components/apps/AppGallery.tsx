import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Camera, Map, Gamepad2, Eye, Palette, GitBranch, ShieldAlert,
  Ruler, Siren, Music, ScanLine, Hand, Brain, Mic,
  Navigation, Monitor, Gauge, Thermometer, QrCode, Compass,
  Cpu, Radio, Lightbulb, BarChart3,
  type LucideIcon
} from 'lucide-react'

interface AppDef {
  id: string
  name: string
  icon: LucideIcon
  desc: string
  status: 'built-in' | 'ready' | 'coming-soon'
  category: string
  tags: string[]
}

const apps: AppDef[] = [
  // Built-in capabilities
  { id: 'manual-drive', name: 'Manual Driving', icon: Gamepad2, desc: '4WD differential drive with keyboard/touch controls and speed slider.', status: 'built-in', category: 'control', tags: ['motor', 'websocket'] },
  { id: 'camera-view', name: 'Live Camera', icon: Camera, desc: 'MJPEG video stream from picamera2 with resolution selection.', status: 'built-in', category: 'vision', tags: ['camera', 'flask'] },
  { id: 'color-track', name: 'Color Tracking', icon: Palette, desc: 'HSV color detection with Kalman-filtered servo following. Configurable target color.', status: 'built-in', category: 'vision', tags: ['opencv', 'servo', 'camera'] },
  { id: 'motion-detect', name: 'Motion Detection', icon: Eye, desc: 'Background subtraction watchdog with bounding box overlays.', status: 'built-in', category: 'vision', tags: ['opencv', 'camera'] },
  { id: 'gesture', name: 'Gesture Recognition', icon: Hand, desc: 'Skin detection + convex hull defects. Recognizes fist vs open hand.', status: 'built-in', category: 'vision', tags: ['opencv', 'camera'] },
  { id: 'obstacle-avoid', name: 'Obstacle Avoidance', icon: ShieldAlert, desc: 'Ultrasonic-based autonomous navigation with stop/turn/reverse logic.', status: 'built-in', category: 'autonomy', tags: ['ultrasonic', 'motor'] },
  { id: 'ir-line-track', name: 'IR Line Tracking', icon: GitBranch, desc: '3-channel infrared sensor binary line following.', status: 'built-in', category: 'autonomy', tags: ['ir', 'motor'] },
  { id: 'cv-line-follow', name: 'Video Line Follow', icon: ScanLine, desc: 'Camera-based line following with threshold + position tracking.', status: 'built-in', category: 'autonomy', tags: ['opencv', 'camera', 'motor'] },
  { id: 'keep-distance', name: 'Distance Keeping', icon: Ruler, desc: 'Maintain 25-35cm from objects using ultrasonic sensor.', status: 'built-in', category: 'autonomy', tags: ['ultrasonic', 'motor'] },
  { id: 'police-lights', name: 'Police Lights', icon: Siren, desc: 'Alternating red/blue WS2812 LED flash pattern.', status: 'built-in', category: 'output', tags: ['ws2812', 'spi'] },
  { id: 'buzzer-music', name: 'Buzzer Music', icon: Music, desc: 'Play melodies through the GPIO18 passive buzzer.', status: 'built-in', category: 'output', tags: ['buzzer', 'gpio'] },
  { id: 'battery-mon', name: 'Battery Monitor', icon: Gauge, desc: 'Real-time voltage monitoring with low-battery alarm.', status: 'built-in', category: 'system', tags: ['adc', 'i2c'] },
  { id: 'sys-info', name: 'System Info', icon: Thermometer, desc: 'CPU temperature, CPU usage, RAM usage display.', status: 'built-in', category: 'system', tags: ['psutil'] },

  // Ready to deploy
  { id: 'occupancy-map', name: 'Occupancy Mapping', icon: Map, desc: '2D grid mapping with frontier exploration. Combines ultrasonic + camera depth.', status: 'ready', category: 'autonomy', tags: ['slam', 'ultrasonic', 'camera'] },
  { id: 'face-follow', name: 'Face Following', icon: Eye, desc: 'Haar/DNN face detection with PID-controlled servo + motor following.', status: 'ready', category: 'vision', tags: ['opencv', 'servo', 'motor'] },
  { id: 'qr-scanner', name: 'QR Code Scanner', icon: QrCode, desc: 'Decode QR/barcodes from camera feed. Navigate to coded stations.', status: 'ready', category: 'vision', tags: ['opencv', 'camera'] },
  { id: 'led-sequencer', name: 'LED Show Sequencer', icon: Lightbulb, desc: 'Programmable WS2812 animations: fire, comet, theater chase, sparkle.', status: 'ready', category: 'output', tags: ['ws2812', 'spi'] },
  { id: 'data-dashboard', name: 'Data Dashboard', icon: BarChart3, desc: 'Log sensors to SQLite. Serve Chart.js dashboard with historical data.', status: 'ready', category: 'system', tags: ['database', 'flask'] },
  { id: 'maze-solver', name: 'Maze Solver', icon: Navigation, desc: 'Wall-following algorithm (right/left hand rule) using ultrasonic.', status: 'ready', category: 'autonomy', tags: ['ultrasonic', 'motor'] },
  { id: 'patrol-mode', name: 'Patrol Mode', icon: Compass, desc: 'Waypoint recording and playback for automated patrol routes.', status: 'ready', category: 'autonomy', tags: ['motor', 'waypoints'] },

  // Coming soon
  { id: 'tflite-detect', name: 'TFLite Detection', icon: Brain, desc: 'MobileNet SSD on Pi 4/5 for real-time multi-class object detection.', status: 'coming-soon', category: 'ai', tags: ['tensorflow', 'camera'] },
  { id: 'voice-control', name: 'Voice Control', icon: Mic, desc: 'USB mic + Whisper for natural language robot commands.', status: 'coming-soon', category: 'ai', tags: ['whisper', 'mic'] },
  { id: 'visual-slam', name: 'Visual SLAM', icon: Map, desc: 'ORB-SLAM2 monocular mapping and localization.', status: 'coming-soon', category: 'ai', tags: ['slam', 'camera', 'orb'] },
  { id: 'person-follow', name: 'Person Following', icon: Eye, desc: 'Body detection + PID driving to autonomously follow a person.', status: 'coming-soon', category: 'ai', tags: ['opencv', 'pid', 'motor'] },
  { id: 'oled-display', name: 'OLED Dashboard', icon: Monitor, desc: 'SSD1306 OLED on I2C showing IP, battery, mode, sensors.', status: 'coming-soon', category: 'hardware', tags: ['i2c', 'oled'] },
  { id: 'imu-stabilize', name: 'IMU Stabilization', icon: Compass, desc: 'MPU6050 gyro for tilt detection, stabilized driving, dead reckoning.', status: 'coming-soon', category: 'hardware', tags: ['mpu6050', 'i2c'] },
  { id: 'ir-remote', name: 'IR Remote', icon: Radio, desc: 'Decode IR signals from onboard receiver for WiFi-free control.', status: 'coming-soon', category: 'hardware', tags: ['ir', 'gpio'] },
  { id: 'arm-gripper', name: 'Robotic Arm', icon: Cpu, desc: '2-3 DOF arm on spare PCA9685 channels to pick up objects.', status: 'coming-soon', category: 'hardware', tags: ['servo', 'pca9685'] },
]

const statusColors: Record<string, "success" | "default" | "secondary"> = {
  'built-in': 'success',
  'ready': 'default',
  'coming-soon': 'secondary',
}

const statusLabels: Record<string, string> = {
  'built-in': 'Built-in',
  'ready': 'Ready',
  'coming-soon': 'Coming Soon',
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

export function AppGallery({ onOpenApp }: { onOpenApp: (id: string) => void }) {
  const [search, setSearch] = useState('')

  const filterApps = (cat: string) => {
    return apps.filter(a => {
      const matchesCat = cat === 'all' || a.category === cat
      const matchesSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.tags.some(t => t.includes(search.toLowerCase()))
      return matchesCat && matchesSearch
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search apps, features, or tags..."
          className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="text-sm text-muted-foreground whitespace-nowrap">
          {apps.length} apps
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList className="flex-wrap">
          {categories.map((c) => (
            <TabsTrigger key={c.id} value={c.id}>{c.label}</TabsTrigger>
          ))}
        </TabsList>
        {categories.map((cat) => (
          <TabsContent key={cat.id} value={cat.id}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filterApps(cat.id).map((app) => (
                <Card key={app.id} className="hover:border-primary/30 transition-colors group">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 shrink-0 group-hover:bg-primary/20 transition-colors">
                        <app.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm truncate">{app.name}</span>
                          <Badge variant={statusColors[app.status]} className="text-[10px] shrink-0">
                            {statusLabels[app.status]}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{app.desc}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-wrap gap-1 flex-1">
                            {app.tags.slice(0, 3).map((t) => (
                              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{t}</span>
                            ))}
                          </div>
                          {app.status !== 'coming-soon' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs shrink-0"
                              onClick={() => onOpenApp(app.id)}
                            >
                              Open
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}