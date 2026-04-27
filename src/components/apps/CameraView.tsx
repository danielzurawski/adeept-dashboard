import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Camera, RefreshCw, Maximize2, ZoomIn, ZoomOut, Settings } from 'lucide-react'

export function CameraView() {
  const [streamUrl, setStreamUrl] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [resolution, setResolution] = useState('640x480')
  const [ipInput, setIpInput] = useState('192.168.4.1')

  const startStream = () => {
    const url = `http://${ipInput}:5000/video_feed`
    setStreamUrl(url)
    setStreaming(true)
  }

  const stopStream = () => {
    setStreamUrl('')
    setStreaming(false)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" />
                Live Camera Feed
              </CardTitle>
              <CardDescription>
                MJPEG stream from the robot's picamera2 via Flask on port 5000
              </CardDescription>
            </div>
            <Badge variant={streaming ? 'success' : 'secondary'}>
              {streaming ? 'LIVE' : 'OFFLINE'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Connection */}
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              type="text"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              placeholder="Robot IP (e.g. 192.168.4.1)"
              className="flex-1 min-w-[180px] bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="640x480">640×480</option>
              <option value="320x240">320×240</option>
              <option value="1280x720">1280×720</option>
            </select>
            {streaming ? (
              <Button variant="destructive" onClick={stopStream} className="gap-2">
                Stop
              </Button>
            ) : (
              <Button onClick={startStream} className="gap-2">
                <Camera className="h-4 w-4" /> Start Stream
              </Button>
            )}
          </div>

          {/* Video display */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center border border-border">
            {streaming && streamUrl ? (
              <img
                src={streamUrl}
                alt="Robot Camera Feed"
                className="w-full h-full object-contain"
                onError={() => {
                  setStreaming(false)
                  setStreamUrl('')
                }}
              />
            ) : (
              <div className="text-center text-muted-foreground">
                <Camera className="h-16 w-16 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No camera feed</p>
                <p className="text-xs mt-1">Enter the robot's IP address and click Start Stream</p>
                <p className="text-xs mt-1">The robot serves MJPEG at http://IP:5000/video_feed</p>
              </div>
            )}

            {/* Overlay controls */}
            {streaming && (
              <div className="absolute bottom-2 right-2 flex gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8 bg-black/50 hover:bg-black/70" onClick={() => window.open(streamUrl, '_blank')}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 bg-black/50 hover:bg-black/70" onClick={() => { stopStream(); setTimeout(startStream, 500) }}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Stream info */}
          <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1"><Settings className="h-3 w-3" /> Format: MJPEG</div>
            <div className="flex items-center gap-1"><ZoomIn className="h-3 w-3" /> Res: {resolution}</div>
            <div className="flex items-center gap-1"><ZoomOut className="h-3 w-3" /> Port: 5000</div>
          </div>
        </CardContent>
      </Card>

      {/* Camera capabilities info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Camera Capabilities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {[
              { title: 'Color Object Tracking', desc: 'HSV-based detection with Kalman-filtered servo following. Configurable target color.' },
              { title: 'Motion Detection (WatchDog)', desc: 'Background subtraction with accumulate weighted averaging. Bounding box overlay.' },
              { title: 'Gesture Recognition', desc: 'Skin color HSV segmentation → convex hull → defect counting. Fist vs open hand.' },
              { title: 'Video Line Following', desc: 'Grayscale → threshold → contour center tracking at two scan lines. Auto-steering.' },
              { title: 'Snapshot Capture', desc: 'Capture individual JPEG frames from the picamera2 stream for analysis.' },
              { title: 'OpenCV Pipeline', desc: 'Full OpenCV 4.x available: Haar cascades, DNN module, ArUco, QR decode, etc.' },
            ].map((c) => (
              <div key={c.title} className="p-3 rounded-lg bg-secondary/50">
                <div className="font-medium mb-1">{c.title}</div>
                <p className="text-xs text-muted-foreground">{c.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}