import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

const beginner = [
  { name: 'Custom Music Player', desc: 'Extend Buzzer.py with Star Wars, Mario melodies. Add song selector to Web UI.' },
  { name: 'LED Show Sequencer', desc: 'Programmable WS2812 animations: fire, comet trail, theater chase, sparkle.' },
  { name: 'Speed-Based LED Color', desc: 'Map motor speed to LED color (green→yellow→red) for visual speed feedback.' },
  { name: 'Battery Gauge Widget', desc: 'Display real-time battery percentage with visual gauge in the Web UI.' },
  { name: 'Maze Solver', desc: 'Right-hand/left-hand wall-following algorithm using ultrasonic for maze navigation.' },
  { name: 'Multi-Color Tracker', desc: 'Detect and track multiple colored objects simultaneously with different markers.' },
  { name: 'Smooth Acceleration', desc: 'Implement speed ramping with PID for gradual acceleration/deceleration.' },
  { name: 'Data Logger Dashboard', desc: 'Log sensors to SQLite, serve Chart.js dashboard from Flask.' },
  { name: 'Patrol Mode', desc: 'Follow predetermined paths with waypoint recording and playback.' },
  { name: 'Gamepad Support', desc: 'Add USB/Bluetooth gamepad input with analog stick proportional steering.' },
]

const intermediate = [
  { name: 'Face Detection & Following', desc: 'OpenCV Haar/DNN face detector → servo + motors follow a person.' },
  { name: 'QR Code Reader', desc: 'Decode QR codes from camera feed, navigate to QR-coded stations.' },
  { name: 'ArUco Marker Navigation', desc: 'Fiducial marker detection with pose estimation for precision docking.' },
  { name: 'MQTT Integration', desc: 'Publish sensor data, subscribe to commands. Works with Home Assistant, Node-RED.' },
  { name: 'REST API', desc: 'Proper /api/move, /api/sensor endpoints for external system integration.' },
  { name: 'Pan-Tilt Camera', desc: 'Add second servo to PCA9685 ch1 for horizontal pan control.' },
  { name: 'Video Recording', desc: 'Record button saves MJPEG stream to MP4 using OpenCV VideoWriter.' },
  { name: 'Sound-Reactive LED', desc: 'USB mic captures audio amplitude → drives WS2812 effects to music.' },
]

const advanced = [
  { name: 'OLED Display', desc: 'SSD1306 via I2C (X1/X2 ports) showing IP, battery, mode, sensor data.' },
  { name: 'IMU Stabilization', desc: 'MPU6050 for gyro-stabilized driving, collision detection, dead reckoning.' },
  { name: 'LIDAR Mapping', desc: 'RPLidar via UART → 2D occupancy grid SLAM, visualize on web dashboard.' },
  { name: 'GPS Navigation', desc: 'UART GPS module for outdoor waypoint navigation with coordinates.' },
  { name: 'Robotic Arm / Gripper', desc: 'Use spare PCA9685 ch1-7 for 2-3 DOF arm to pick up objects.' },
  { name: 'IR Remote Control', desc: 'Decode IR signals from onboard receiver for WiFi-free control.' },
  { name: 'Encoder Feedback', desc: 'Rotary encoders for closed-loop PID speed regulation.' },
]

const aiml = [
  { name: 'TFLite Object Detection', desc: 'MobileNet SSD on Pi 4/5 at 5-10 FPS. Drive toward/avoid detected classes.' },
  { name: 'Deep Learning Lane Detection', desc: 'CNN-based lane detector replacing threshold-based line tracker.' },
  { name: 'RL Navigation', desc: 'Train Q-learning/DQN in simulation, deploy for autonomous navigation.' },
  { name: 'Voice Control', desc: 'USB mic + Whisper for "go forward", "turn left", "follow me" commands.' },
  { name: 'Person Following', desc: 'Face/body detection + PID-controlled driving to follow a person.' },
  { name: 'Visual SLAM', desc: 'ORB-SLAM2 monocular SLAM for environment mapping from camera alone.' },
]

function ProposalGrid({ items }: { items: { name: string; desc: string }[] }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {items.map((item) => (
        <Card key={item.name} className="hover:border-primary/30 transition-colors">
          <CardContent className="p-4">
            <div className="font-medium text-sm mb-1">{item.name}</div>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function ProposalsSection() {
  return (
    <section id="proposals" className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-2">Expansion Proposals</h2>
        <p className="text-muted-foreground mb-8">
          40+ project ideas organized by difficulty, all achievable with the included hardware and expansion ports.
        </p>
        <Tabs defaultValue="beginner">
          <TabsList className="flex-wrap">
            <TabsTrigger value="beginner">Beginner ({beginner.length})</TabsTrigger>
            <TabsTrigger value="intermediate">Intermediate ({intermediate.length})</TabsTrigger>
            <TabsTrigger value="advanced">Advanced ({advanced.length})</TabsTrigger>
            <TabsTrigger value="aiml">AI / ML ({aiml.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="beginner"><ProposalGrid items={beginner} /></TabsContent>
          <TabsContent value="intermediate"><ProposalGrid items={intermediate} /></TabsContent>
          <TabsContent value="advanced"><ProposalGrid items={advanced} /></TabsContent>
          <TabsContent value="aiml"><ProposalGrid items={aiml} /></TabsContent>
        </Tabs>
      </div>
    </section>
  )
}