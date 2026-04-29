/**
 * Page Object for the **Live Occupancy Map** sub-panel that the user
 * opens from the App Gallery. The panel is responsible for SLAM-style
 * mapping: it polls `get_map` while active, displays a 480×480 canvas
 * of the occupancy grid, and exposes start/stop/reset/refresh + path
 * planning.
 */

import type { Page, Locator } from '@playwright/test'
import { expect } from '@playwright/test'

export class LiveOccupancyMap {
  readonly page: Page
  readonly root: Locator

  constructor(page: Page) {
    this.page = page
    // Two cards carry a `<CardTitle>Live Occupancy Map</CardTitle>`:
    //   1. AppShell's outer host card, which has class
    //      `border-primary/30` and wraps the entire panel.
    //   2. The component's own inner main card.
    //
    // The component itself returns a `space-y-4` wrapper that holds
    // **two sibling cards**: the main map card AND the Path Plan
    // card (target X/Y, Plan Path button). To address everything the
    // user sees inside the open panel — including the Path Plan
    // sub-card — we anchor on the outer host card.
    this.root = page
      .locator('div.border-primary\\/30')
      .filter({ hasText: 'Live Occupancy Map' })
      .first()
  }

  get statusBadge(): Locator {
    return this.root.getByText(/^(MAPPING|IDLE)$/)
  }

  get startStopButton(): Locator {
    return this.root.getByRole('button', { name: /^(Start|Stop)$/ })
  }

  get resetButton(): Locator {
    return this.root.getByRole('button', { name: 'Reset Map' })
  }

  get refreshButton(): Locator {
    return this.root.getByRole('button', { name: 'Refresh' })
  }

  get planPathButton(): Locator {
    return this.root.getByRole('button', { name: 'Plan Path' })
  }

  get targetXInput(): Locator {
    return this.root.locator('input[type="number"]').first()
  }

  get targetYInput(): Locator {
    return this.root.locator('input[type="number"]').nth(1)
  }

  get canvas(): Locator {
    return this.root.locator('canvas')
  }

  /**
   * Reads a stat row by label (e.g. "Coverage", "Frontiers",
   * "Pose (cell)", "Heading", "Free cells", "Occupied", "Last update",
   * "Connected"). The Stat component renders the value FIRST and the
   * label SECOND inside the same wrapper div, so we step up to the
   * shared parent and grab the bold-text value div.
   */
  statRow(label: string): { row: Locator; value: Locator } {
    const row = this.root.getByText(label, { exact: true }).locator('..')
    const value = row.locator('div.text-lg.font-bold').first()
    return { row, value }
  }

  async start(): Promise<void> {
    await this.startStopButton.click()
    await expect(this.statusBadge).toHaveText('MAPPING')
    await expect(this.startStopButton).toHaveText('Stop')
  }

  async stop(): Promise<void> {
    await this.startStopButton.click()
    await expect(this.statusBadge).toHaveText('IDLE')
    await expect(this.startStopButton).toHaveText('Start')
  }
}
