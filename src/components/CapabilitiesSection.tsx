import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  MoveRight, Camera, Gauge, Video, Palette, Eye, Hand,
  ShieldAlert, GitBranch, ScanLine, Ruler, Lightbulb,
  Music, ToggleLeft, Battery, Cpu, Wifi, Wrench
} from 'lucide-react'

const capabilities = [
  { icon: MoveRight, name: 'Manual Driving', desc: '4WD differential drive, all directions + spin', cat: 'Movement' },
  { icon: Camera, name: 'Camera Tilt', desc: 'Single-axis servo pan (up/down)', cat: 'Movement' },
  { icon: Gauge, name: 'Speed Control', desc: '0-100% speed slider via WebSocket', cat: 'Movement' },
  { icon: Video, name: 'Live Video Feed', desc: 'MJPEG stream at 640×480 via Flask', cat: 'Vision' },
  { icon: Palette, name: 'Color Detection', desc: 'HSV filtering + contour tracking + servo follow', cat: 'Vision' },
  { icon: Eye, name: 'Motion Detection', desc: 'Background subtraction watchdog mode', cat: 'Vision' },
  { icon: Hand, name: 'Gesture Recognition', desc: 'Convex hull defects: fist vs open hand', cat: 'Vision' },
  { icon: ShieldAlert, name: 'Obstacle Avoidance', desc: 'Ultrasonic ranging, stop/turn/reverse logic', cat: 'Autonomy' },
  { icon: GitBranch, name: 'IR Line Tracking', desc: '3-sensor binary logic line following', cat: 'Autonomy' },
  { icon: ScanLine, name: 'Video Line Following', desc: 'Camera threshold + position tracking', cat: 'Autonomy' },
  { icon: Ruler, name: 'Distance Keeping', desc: 'Maintain 25-35cm via ultrasonic', cat: 'Autonomy' },
  { icon: Lightbulb, name: 'WS2812 LED Effects', desc: 'Breathing, police, rainbow, flowing', cat: 'Output' },
  { icon: Music, name: 'Buzzer Music', desc: 'Happy Birthday + tonal notes', cat: 'Output' },
  { icon: ToggleLeft, name: '3x LED Control', desc: 'Individual on/off for 3 onboard LEDs', cat: 'Output' },
  { icon: Battery, name: 'Battery Monitor', desc: 'ADC voltage + low-battery buzzer alarm', cat: 'System' },
  { icon: Cpu, name: 'System Info', desc: 'CPU temp, CPU usage, RAM usage', cat: 'System' },
  { icon: Wifi, name: 'WiFi / Hotspot', desc: 'Auto WiFi connect or AP fallback', cat: 'System' },
  { icon: Wrench, name: 'Servo Calibration', desc: 'Fine-tune servo center positions', cat: 'System' },
]

const catColors: Record<string, "default" | "success" | "warning" | "secondary" | "outline"> = {
  Movement: 'default',
  Vision: 'success',
  Autonomy: 'warning',
  Output: 'secondary',
  System: 'outline',
}

export function CapabilitiesSection() {
  return (
    <section id="capabilities" className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-8">Built-in Capabilities</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {capabilities.map((c) => (
            <Card key={c.name} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                    <c.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{c.name}</span>
                      <Badge variant={catColors[c.cat]} className="text-[10px]">{c.cat}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.desc}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}