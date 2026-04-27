import { Card, CardContent } from '@/components/ui/card'
import { Cpu, Gauge, Wifi, Cog } from 'lucide-react'

const stats = [
  { icon: Gauge, label: '4WD Drive', desc: '4 DC motors, differential steering' },
  { icon: Cpu, label: '17+ Features', desc: 'Vision, autonomy, sensors, LEDs' },
  { icon: Cog, label: '16-Ch PWM', desc: 'PCA9685 servo/motor controller' },
  { icon: Wifi, label: '3 Interfaces', desc: 'Web UI, Mobile App, Desktop GUI' },
]

export function Hero() {
  return (
    <section id="overview" className="py-20 px-4">
      <div className="max-w-6xl mx-auto text-center">
        <h1 className="text-5xl md:text-7xl font-bold mb-4">
          <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-cyan-400 bg-clip-text text-transparent">
            Adeept AWR-V3
          </span>
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground mb-2">
          Open-Source 4WD Smart Robot Platform
        </p>
        <p className="text-sm text-muted-foreground mb-12 max-w-2xl mx-auto">
          A Raspberry Pi-based intelligent robot featuring computer vision, autonomous navigation,
          sensor integration, and multi-interface remote control. Built for education and hobbyist robotics.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <Card key={s.label} className="bg-card/50 border-border/50 hover:border-primary/50 transition-colors">
              <CardContent className="p-6 flex flex-col items-center gap-2">
                <s.icon className="h-8 w-8 text-primary" />
                <div className="text-lg font-bold">{s.label}</div>
                <div className="text-xs text-muted-foreground text-center">{s.desc}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}