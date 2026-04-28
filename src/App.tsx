import { useState } from 'react'
import type { ReactNode } from 'react'
import { Hero } from '@/components/Hero'
import { ControlPanel } from '@/components/ControlPanel'
import { CameraView } from '@/components/apps/CameraView'
import { OccupancyMap } from '@/components/apps/OccupancyMap'
import { LiveOccupancyMap } from '@/components/apps/LiveOccupancyMap'
import { AppGallery } from '@/components/apps/AppGallery'
import { ResourcesSection } from '@/components/ResourcesSection'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { WebSocketProvider } from '@/hooks/useWebSocket'
import { Bot, LayoutGrid, X } from 'lucide-react'

const navLinks = [
  { href: '#overview', label: 'Cockpit' },
  { href: '#control', label: 'Control' },
  { href: '#apps', label: 'Apps' },
  { href: '#resources', label: 'Resources' },
]

// Map of app IDs to their component panels
const appPanels: Record<string, { label: string; component: ReactNode }> = {
  'camera-view': { label: 'Live Camera', component: <CameraView /> },
  'live-occupancy-map': { label: 'Live Occupancy Map', component: <LiveOccupancyMap /> },
  'occupancy-map': { label: 'Occupancy Mapping (sim)', component: <OccupancyMap /> },
}

function AppShell() {
  const [activeApp, setActiveApp] = useState<string | null>(null)

  const handleOpenApp = (id: string) => {
    if (appPanels[id]) {
      setActiveApp(id)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">AWR-V3</span>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main>
        <Hero />
        <Separator />
        <ControlPanel />
        <Separator />

        {/* Apps Section */}
        <section id="apps" className="py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold flex items-center gap-3">
                  <LayoutGrid className="h-8 w-8 text-primary" />
                  Capabilities & Roadmap
                </h2>
                <p className="text-muted-foreground mt-1">
                  What the dashboard can do now, separated from ideas that still need robot, backend, or hardware work.
                </p>
              </div>
            </div>

            {/* Active app panel */}
            {activeApp && appPanels[activeApp] && (
              <Card className="mb-6 border-primary/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle>{appPanels[activeApp].label}</CardTitle>
                    <Button size="icon" variant="ghost" onClick={() => setActiveApp(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {appPanels[activeApp].component}
                </CardContent>
              </Card>
            )}

            {/* Gallery */}
            <AppGallery openableAppIds={Object.keys(appPanels)} onOpenApp={handleOpenApp} />
          </div>
        </section>

        <Separator />
        <ResourcesSection />
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 mt-8">
        <div className="max-w-6xl mx-auto text-center text-sm text-muted-foreground">
          <p>Adeept AWR-V3 Dashboard &mdash; Analysis &amp; Control Interface</p>
          <p className="mt-1">Built with React, TypeScript, Tailwind CSS v4, and shadcn/ui patterns</p>
        </div>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <WebSocketProvider>
      <AppShell />
    </WebSocketProvider>
  )
}