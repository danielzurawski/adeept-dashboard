import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const electronics = [
  { name: 'Adeept Robot HAT V3.2', qty: 1, purpose: 'Central control board', specs: 'PCA9685 (0x5f), ADS7830 (0x48), DRV8833, buzzer, LEDs, WS2812' },
  { name: 'Camera Module', qty: 1, purpose: 'Vision / FPV', specs: '640×480 via picamera2/libcamera' },
  { name: 'HC-SR04 Ultrasonic', qty: 1, purpose: 'Distance measurement', specs: 'Trig: GPIO23, Echo: GPIO24, max 2m' },
  { name: '3-CH Line Tracking', qty: 1, purpose: 'IR line following', specs: 'L: GPIO22, M: GPIO27, R: GPIO17' },
  { name: 'WS2812 RGB LED Strip', qty: 2, purpose: 'Ambient lighting', specs: 'SPI0 MOSI (GPIO10), 8 LEDs each' },
  { name: 'Servo Motor', qty: 1, purpose: 'Camera tilt', specs: 'PCA9685 ch0, 500-2400μs, 180°' },
  { name: 'DC Motor', qty: 4, purpose: 'Wheel drive', specs: 'PCA9685 ch8-15 via DRV8833' },
  { name: '18650 Battery Holder', qty: 1, purpose: 'Power supply', specs: 'Dual cells, 7.4V, peak ~3.75A' },
  { name: 'Passive Buzzer', qty: 1, purpose: 'Audio / alarms', specs: 'GPIO18 (TonalBuzzer)' },
  { name: 'Onboard LEDs', qty: 3, purpose: 'Status indicators', specs: 'GPIO9, GPIO25, GPIO11' },
]

const gpioMap = [
  { gpio: 9, fn: 'LED1' }, { gpio: 25, fn: 'LED2' }, { gpio: 11, fn: 'LED3' },
  { gpio: 18, fn: 'Passive Buzzer' }, { gpio: 23, fn: 'Ultrasonic Trigger' },
  { gpio: 24, fn: 'Ultrasonic Echo' }, { gpio: 22, fn: 'Line Track Left' },
  { gpio: 27, fn: 'Line Track Middle' }, { gpio: 17, fn: 'Line Track Right' },
  { gpio: 10, fn: 'WS2812 (SPI0 MOSI)' },
]

const ics = [
  { name: 'PCA9685', fn: '16-ch 12-bit PWM driver', iface: 'I2C', addr: '0x5f' },
  { name: 'ADS7830', fn: '8-ch 8-bit ADC', iface: 'I2C', addr: '0x48' },
  { name: 'DRV8833', fn: 'Dual H-bridge motor driver', iface: 'PWM', addr: 'N/A' },
  { name: 'LM324', fn: 'Quad op-amp', iface: 'Analog', addr: 'N/A' },
]

const expansion = [
  { port: 'X1/X2 (I2C)', desc: 'External I2C ports', idea: 'OLED display, BMP280, TOF sensor' },
  { port: 'X3 (Light Track)', desc: 'Phototransistor port', idea: 'Light-following behavior' },
  { port: 'X4/X5 (RGB)', desc: 'RGB LED ports', idea: 'Headlights, turn signals' },
  { port: 'X6/X7 (UART)', desc: 'Serial ports', idea: 'GPS, LIDAR, Bluetooth, voice' },
  { port: 'MPU6050 Header', desc: '6-axis IMU', idea: 'Tilt sensing, stabilization' },
  { port: 'IR Receiver', desc: 'Onboard IR', idea: 'IR remote control' },
  { port: 'PCA9685 Ch1-7', desc: '7 spare servo channels', idea: 'Pan servo, robotic arm, gripper' },
  { port: 'ADS7830 Ch1-7', desc: '7 spare ADC channels', idea: 'Light, temp, flex, force sensors' },
]

export function HardwareSection() {
  return (
    <section id="hardware" className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-8">Hardware Inventory</h2>

        <Card className="mb-6">
          <CardHeader><CardTitle>Core Electronics</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-3 pr-4">Component</th>
                    <th className="pb-3 pr-4">Qty</th>
                    <th className="pb-3 pr-4">Purpose</th>
                    <th className="pb-3">Key Specs</th>
                  </tr>
                </thead>
                <tbody>
                  {electronics.map((e) => (
                    <tr key={e.name} className="border-b border-border/50">
                      <td className="py-2.5 pr-4 font-medium">{e.name}</td>
                      <td className="py-2.5 pr-4"><Badge variant="secondary">{e.qty}</Badge></td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{e.purpose}</td>
                      <td className="py-2.5 text-muted-foreground text-xs">{e.specs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader><CardTitle>GPIO Pin Map</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2">GPIO</th><th className="pb-2">Function</th>
                  </tr>
                </thead>
                <tbody>
                  {gpioMap.map((g) => (
                    <tr key={g.gpio} className="border-b border-border/50">
                      <td className="py-1.5 font-mono text-primary">{g.gpio}</td>
                      <td className="py-1.5 text-muted-foreground">{g.fn}</td>
                    </tr>
                  ))}
                  <tr className="border-b border-border/50">
                    <td className="py-1.5 font-mono text-primary">SCL/SDA</td>
                    <td className="py-1.5 text-muted-foreground">PCA9685 + ADS7830 (I2C)</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Key ICs</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2">IC</th><th className="pb-2">Function</th><th className="pb-2">Addr</th>
                  </tr>
                </thead>
                <tbody>
                  {ics.map((ic) => (
                    <tr key={ic.name} className="border-b border-border/50">
                      <td className="py-1.5 font-medium">{ic.name}</td>
                      <td className="py-1.5 text-muted-foreground">{ic.fn}</td>
                      <td className="py-1.5 font-mono text-xs text-primary">{ic.addr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Unused Ports &amp; Expansion Opportunities</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-3 pr-4">Port</th>
                    <th className="pb-3 pr-4">Description</th>
                    <th className="pb-3">Expansion Ideas</th>
                  </tr>
                </thead>
                <tbody>
                  {expansion.map((e) => (
                    <tr key={e.port} className="border-b border-border/50">
                      <td className="py-2.5 pr-4 font-medium">{e.port}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{e.desc}</td>
                      <td className="py-2.5 text-muted-foreground">{e.idea}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}