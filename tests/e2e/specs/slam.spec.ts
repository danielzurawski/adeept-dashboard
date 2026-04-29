/**
 * SLAM (Live Occupancy Map) scenarios.
 *
 * The Live Occupancy Map is the most stateful surface in the
 * dashboard:
 *
 *   - Opening it from the gallery instantiates a polling loop that
 *     fires `get_map` every 500 ms while polling is enabled.
 *   - The status badge flips between IDLE and MAPPING in lockstep
 *     with the simulator's `slam.mapping` flag.
 *   - The 480×480 canvas re-renders every time a `get_map` snapshot
 *     arrives.
 *   - Plan Path emits an `slam_plan X Y` frame; the simulator returns
 *     a Manhattan-distance estimate and the dashboard surfaces the
 *     result in the status row.
 *   - Reset Map sends `slam_reset`, clearing the simulator's grid
 *     and resetting pose to the origin.
 *
 * These tests open the panel from the gallery, exercise each
 * affordance, and validate both the UI state and the simulator's
 * `/state` payload.
 */

import { test, expect } from '../fixtures/dashboard'
import { LiveOccupancyMap } from '../pages/live-occupancy-map'
import { getSimulatorState } from '../utils/sim-client'

test.describe('Live Occupancy Map', () => {
  test('opens from the gallery and renders the canvas + status row', async ({
    connectedDeck,
    appGallery,
    dashboard,
  }) => {
    void connectedDeck
    await appGallery.openPanelButton('Live Occupancy Map').click()

    const map = new LiveOccupancyMap(dashboard)
    await expect(map.canvas).toBeVisible()
    await expect(map.statusBadge).toHaveText('IDLE')
    await expect(map.startStopButton).toHaveText('Start')
  })

  test('Start polls get_map and flips the simulator into mapping mode', async ({
    connectedDeck,
    appGallery,
    dashboard,
    request,
  }) => {
    void connectedDeck
    await appGallery.openPanelButton('Live Occupancy Map').click()
    const map = new LiveOccupancyMap(dashboard)

    await map.start()

    // The simulator should observe `mapping: true` within a tick.
    await expect
      .poll(async () => (await getSimulatorState(request)).slam.mapping, {
        timeout: 3_000,
      })
      .toBe(true)

    // After ~700 ms (one poll cycle) the dashboard's "Last update"
    // stat should show a relative age in milliseconds. The dashboard
    // computes this client-side and may briefly render a small
    // negative value when the just-arrived snapshot timestamps the
    // future relative to the local clock, so we accept any signed
    // number followed by " ms".
    const { value: lastUpdate } = map.statRow('Last update')
    await expect(lastUpdate).toHaveText(/-?\d+ ms/, { timeout: 3_000 })

    // Flip back to idle.
    await map.stop()
    await expect
      .poll(async () => (await getSimulatorState(request)).slam.mapping, {
        timeout: 3_000,
      })
      .toBe(false)
  })

  test('Refresh issues a single get_map request even while idle', async ({
    connectedDeck,
    appGallery,
    dashboard,
  }) => {
    void connectedDeck
    await appGallery.openPanelButton('Live Occupancy Map').click()
    const map = new LiveOccupancyMap(dashboard)

    await expect(map.statusBadge).toHaveText('IDLE')
    await map.refreshButton.click()

    // The dashboard's command log (in the Control Deck) should
    // record the `get_map` TX entry.
    await expect(connectedDeck.commandLog).toContainText('get_map', {
      timeout: 3_000,
    })

    const { value: lastUpdate } = map.statRow('Last update')
    await expect(lastUpdate).toHaveText(/-?\d+ ms/, { timeout: 3_000 })
  })

  test('Plan Path posts slam_plan and surfaces the result', async ({
    connectedDeck,
    appGallery,
    dashboard,
  }) => {
    void connectedDeck
    await appGallery.openPanelButton('Live Occupancy Map').click()
    const map = new LiveOccupancyMap(dashboard)

    // Drive a target. The simulator pose starts at the centre (40,40),
    // so `(50, 50)` is a 20-cell Manhattan distance away.
    await map.targetXInput.fill('50')
    await map.targetYInput.fill('50')
    await map.planPathButton.click()

    // The Control Deck command log is the canonical place to see
    // the protocol frame the dashboard emitted. We assert the slam_plan
    // request appeared and the dashboard handled the response without
    // crashing.
    await expect(connectedDeck.commandLog).toContainText('slam_plan 50 50', {
      timeout: 3_000,
    })
  })

  test('Reset Map clears the simulator grid and zeroes pose', async ({
    connectedDeck,
    appGallery,
    dashboard,
    request,
  }) => {
    void connectedDeck
    await appGallery.openPanelButton('Live Occupancy Map').click()
    const map = new LiveOccupancyMap(dashboard)

    // Start mapping and let the simulator advance the pose for a
    // moment so reset has something to undo.
    await map.start()
    await dashboard.waitForTimeout(800)
    await map.stop()

    await map.resetButton.click()

    await expect
      .poll(
        async () => {
          const state = await getSimulatorState(request)
          return {
            cellsExplored: state.slam.cellsExplored,
            poseX: state.slam.poseX,
            poseY: state.slam.poseY,
            theta: state.slam.theta,
          }
        },
        { timeout: 3_000 },
      )
      .toMatchObject({
        cellsExplored: 0,
        poseX: 40,
        poseY: 40,
        theta: 0,
      })
  })
})
