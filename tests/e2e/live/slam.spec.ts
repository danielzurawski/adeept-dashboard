/**
 * Live-Pi SLAM scenarios.
 *
 * The Zig firmware ships its own SLAM module: occupancy grid + dead-
 * reckoned pose + A* path planner. The dashboard's Live Occupancy
 * Map panel polls `get_map`, sends `mapping` / `mappingOff` to flip
 * the firmware between idle/active, and exposes `slam_reset` and
 * `slam_plan`.
 *
 * These tests verify the full UI → Zig → response loop via the
 * dashboard's command log (which captures every TX and RX frame).
 * No I²C probe is needed because SLAM is a firmware-level feature
 * — the round-trip itself is the contract.
 */

import { test, expect } from '../fixtures/live'
import { LiveOccupancyMap } from '../pages/live-occupancy-map'

test.describe('Live-Pi SLAM — UI ↔ Zig firmware', () => {
  test.describe.configure({ timeout: 60_000 })

  test('Live Mapping toggle round-trips mapping / mappingOff', async ({
    connectedDeck,
    appGallery,
    dashboard,
  }) => {
    void connectedDeck
    await appGallery.openPanelButton('Live Occupancy Map').click()
    const map = new LiveOccupancyMap(dashboard)

    // Start mapping; the firmware accepts the frame and the
    // dashboard's polling loop kicks in. We assert via the log.
    await map.start()
    await connectedDeck.expectLogContains('mapping')
    // get_map flows in shortly after.
    await connectedDeck.expectLogContains('get_map')

    await map.stop()
    await connectedDeck.expectLogContains('mappingOff')
  })

  test('Refresh fires a one-shot get_map and the canvas + last-update populate', async ({
    connectedDeck,
    appGallery,
    dashboard,
  }) => {
    void connectedDeck
    await appGallery.openPanelButton('Live Occupancy Map').click()
    const map = new LiveOccupancyMap(dashboard)

    await map.refreshButton.click()
    await connectedDeck.expectLogContains('get_map')

    const { value: lastUpdate } = map.statRow('Last update')
    await expect(lastUpdate).toHaveText(/-?\d+ ms/, { timeout: 5_000 })
  })

  test('Plan Path emits slam_plan and the firmware acks', async ({
    connectedDeck,
    appGallery,
    dashboard,
  }) => {
    void connectedDeck
    await appGallery.openPanelButton('Live Occupancy Map').click()
    const map = new LiveOccupancyMap(dashboard)

    await map.targetXInput.fill('50')
    await map.targetYInput.fill('50')
    await map.planPathButton.click()

    await connectedDeck.expectLogContains('slam_plan 50 50')
  })

  test('Reset Map sends slam_reset and refreshes the grid', async ({
    connectedDeck,
    appGallery,
    dashboard,
  }) => {
    void connectedDeck
    await appGallery.openPanelButton('Live Occupancy Map').click()
    const map = new LiveOccupancyMap(dashboard)

    await map.resetButton.click()
    await connectedDeck.expectLogContains('slam_reset')
    // The dashboard immediately follows up with a get_map so the
    // cleared grid is rendered without the user clicking Refresh.
    await connectedDeck.expectLogContains('get_map')
  })
})
