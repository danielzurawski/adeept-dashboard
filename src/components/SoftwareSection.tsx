import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const servers = [
  { name: 'WebServer.py', proto: 'WebSocket + HTTP', ports: '8888 / 5000', client: 'Chrome (any device)', rec: true },
  { name: 'APPServer.py', proto: 'WebSocket + HTTP', ports: '8888 / 5000', client: 'Adeept Mobile App', rec: false },
  { name: 'GUIServer.py', proto: 'TCP + ZMQ', ports: '10223 / 5555', client: 'Tkinter Desktop GUI', rec: false },
]

const modules = [
  { name: 'Move.py', desc: '4-motor differential drive via PCA9685' },
  { name: 'RPIservo.py', desc: 'Multi-threaded servo control (16 channels)' },
  { name: 'Functions.py', desc: 'Autonomous behaviors: obstacle avoidance, line tracking, keep distance' },
  { name: 'camera_opencv.py', desc: 'OpenCV: color detect, line follow CV, motion detect' },
  { name: 'app.py', desc: 'Flask web server + Vue.js SPA video feed' },
  { name: 'FPV.py', desc: 'ZMQ video streaming for GUI client' },
  { name: 'RobotLight.py', desc: 'WS2812 LED control via SPI (breath, police, rainbow, flowing)' },
  { name: 'Buzzer.py', desc: 'Musical playback (Happy Birthday)' },
  { name: 'Switch.py', desc: 'GPIO LED on/off control' },
  { name: 'Ultra.py', desc: 'HC-SR04 ultrasonic distance measurement' },
  { name: 'Voltage.py', desc: 'Battery monitoring via ADS7830 ADC' },
  { name: 'Info.py', desc: 'CPU temp, CPU usage, RAM usage' },
  { name: 'PID.py', desc: 'PID controller for smooth servo tracking' },
  { name: 'Kalman_Filter.py', desc: 'Kalman filter for noise reduction' },
]

const prereqs = [
  { pkg: 'adafruit-circuitpython-pca9685', method: 'pip', purpose: 'Servo/motor PWM driver' },
  { pkg: 'adafruit-circuitpython-motor', method: 'pip', purpose: 'DC motor abstraction' },
  { pkg: 'adafruit-circuitpython-ads7830', method: 'pip', purpose: 'ADC for battery monitoring' },
  { pkg: 'flask + flask_cors', method: 'pip', purpose: 'Web server' },
  { pkg: 'websockets==13.0', method: 'pip', purpose: 'WebSocket server' },
  { pkg: 'opencv (python3-opencv)', method: 'apt', purpose: 'Computer vision' },
  { pkg: 'picamera2', method: 'apt', purpose: 'Camera driver' },
  { pkg: 'python3-gpiozero', method: 'apt', purpose: 'GPIO control' },
  { pkg: 'spidev', method: 'pip', purpose: 'SPI for WS2812 LEDs' },
  { pkg: 'numpy, pyzmq, imutils, psutil', method: 'pip', purpose: 'Core utilities' },
]

export function SoftwareSection() {
  return (
    <section id="software" className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-8">Software Architecture</h2>

        <Card className="mb-6">
          <CardHeader><CardTitle>Server Variants</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-3 pr-4">Server</th>
                    <th className="pb-3 pr-4">Protocol</th>
                    <th className="pb-3 pr-4">Ports</th>
                    <th className="pb-3">Client</th>
                  </tr>
                </thead>
                <tbody>
                  {servers.map((s) => (
                    <tr key={s.name} className="border-b border-border/50">
                      <td className="py-2.5 pr-4 font-mono text-sm">
                        {s.name} {s.rec && <Badge variant="default" className="ml-2 text-[10px]">Recommended</Badge>}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{s.proto}</td>
                      <td className="py-2.5 pr-4 font-mono text-primary">{s.ports}</td>
                      <td className="py-2.5 text-muted-foreground">{s.client}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader><CardTitle>Python Modules</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {modules.map((m) => (
                  <div key={m.name} className="flex gap-3 text-sm">
                    <span className="font-mono text-primary whitespace-nowrap">{m.name}</span>
                    <span className="text-muted-foreground">{m.desc}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Software Prerequisites</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="pb-2">Package</th><th className="pb-2">Via</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prereqs.map((p) => (
                      <tr key={p.pkg} className="border-b border-border/50">
                        <td className="py-1.5 font-mono text-xs">{p.pkg}</td>
                        <td className="py-1.5">
                          <Badge variant={p.method === 'apt' ? 'warning' : 'secondary'} className="text-[10px]">{p.method}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Architecture Diagram</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs text-muted-foreground font-mono bg-background rounded-lg p-4 overflow-x-auto leading-relaxed">{`WebServer.py / APPServer.py / GUIServer.py
├── Move.py          → 4-motor differential drive (PCA9685 ch8-15)
├── RPIservo.py      → Multi-threaded servo control (PCA9685 ch0-7)
├── Functions.py     → Autonomous behaviors
│   ├── Ultra.py         → HC-SR04 distance
│   ├── Kalman_Filter.py → Noise filtering
│   └── Move.py          → Motor commands
├── camera_opencv.py → OpenCV CV pipeline
│   ├── PID.py           → Tracking PID
│   └── RPIservo.py      → Servo tracking
├── app.py           → Flask (port 5000) + Vue.js SPA
├── RobotLight.py    → WS2812 via SPI (breath/police/rainbow)
├── Buzzer.py        → GPIO18 tonal buzzer
├── Switch.py        → GPIO LED control (9, 25, 11)
├── Voltage.py       → Battery via ADS7830 ADC
└── Info.py          → CPU temp, usage, RAM`}</pre>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}