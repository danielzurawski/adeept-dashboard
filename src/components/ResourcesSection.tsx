import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BookOpen, Code2, ExternalLink, FileArchive, Package, Wrench } from 'lucide-react'

const sourceLinks = [
  {
    title: 'Adeept AWR-V3.0 Learn Page',
    desc: 'Official tutorial/download page for the Raspberry Pi AWR-V3 kit.',
    href: 'https://adeept.com/learn/detail-96.html',
    icon: BookOpen,
    tag: 'official',
  },
  {
    title: 'Adeept AWR Product Page',
    desc: 'Kit overview, hardware list, and current purchasing/support context.',
    href: 'http://www.adeept.com/awr_p0122.html',
    icon: Package,
    tag: 'official',
  },
  {
    title: 'Official ZIP Resources',
    desc: 'The learn page currently lists AWR-V3 ZIP resources such as Adeept_AWR-V3-20250826.zip.',
    href: 'https://adeept.com/learn/detail-96.html',
    icon: FileArchive,
    tag: 'zip',
  },
  {
    title: 'adeept-dashboard',
    desc: 'This React control cockpit and app surface.',
    href: 'https://github.com/danielzurawski/adeept-dashboard',
    icon: Code2,
    tag: 'github',
  },
  {
    title: 'zig-awr-v3',
    desc: 'Zig firmware, hardware diagnostics, and WebSocket-compatible robot service.',
    href: 'https://github.com/danielzurawski/zig-awr-v3',
    icon: Code2,
    tag: 'github',
  },
]

const buildNotes = [
  'Main page is the cockpit: drive, demos, camera, sensor health, and apps.',
  'Manual/PDF-style details should live here as references, not dominate the control flow.',
  'Backend capability badges should decide what can run on Python, Zig, or simulation.',
  'Capacitor/PWA packaging should keep this as one responsive app shell with large touch targets.',
]

export function ResourcesSection() {
  return (
    <section id="resources" className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-8">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <Wrench className="h-7 w-7 text-primary" />
              Build Notes &amp; Sources
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Reference material, original downloads, and repo links are grouped here so the cockpit stays focused on using the robot.
            </p>
          </div>
          <Badge variant="secondary" className="w-fit">Manual content lives off the main path</Badge>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 mb-6">
          {sourceLinks.map((link) => (
            <Card key={link.title} className="bg-card/70 border-border/70 hover:border-primary/40 transition-colors">
              <CardContent className="p-5 flex flex-col h-full">
                <div className="flex items-start gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <link.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">{link.title}</div>
                    <Badge variant="outline" className="text-[10px] mt-1">{link.tag}</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground flex-1">{link.desc}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 justify-between"
                  onClick={() => window.open(link.href, '_blank', 'noopener,noreferrer')}
                >
                  Open <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle>Dashboard Direction</CardTitle></CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-3">
              {buildNotes.map((note) => (
                <div key={note} className="rounded-xl bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
                  {note}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
