/**
 * Capabilities & Roadmap (App Gallery) scenarios.
 *
 * The gallery is the dashboard's discovery surface — it lists every
 * capability the dashboard knows about, broken into:
 *
 *   - "Capabilities": features that work *today* (Manual Driving, the
 *     Live Camera panel, Live Occupancy Map, Robot Modes, Demo Pad,
 *     telemetry, etc.).
 *   - "Roadmap": features the team has scoped but not yet shipped
 *     (Face Following, QR scanner, Maze Solver, IMU stabilization,
 *     etc.). Roadmap cards are tagged with their dependency.
 *
 * The gallery also includes a free-text search filter and category
 * tabs (All / Control / Vision / Autonomy / Output / System).  Open
 * panels close via an explicit X button which AppShell renders
 * outside the panel content.
 */

import { test, expect } from '../fixtures/dashboard'

test.describe('Capabilities & Roadmap', () => {
  test('lists both Capabilities and Roadmap sections by default', async ({
    appGallery,
  }) => {
    await expect(appGallery.capabilitiesHeading).toBeVisible()
    await expect(appGallery.roadmapHeading).toBeVisible()

    // A representative selection of capability + roadmap items must
    // be visible without any filtering.
    await expect(appGallery.capabilityTitle('Manual Driving')).toBeVisible()
    await expect(appGallery.capabilityTitle('Live Occupancy Map')).toBeVisible()
    await expect(appGallery.capabilityTitle('Buzzer Music')).toBeVisible()
    await expect(appGallery.roadmapCardTitle('Face Following')).toBeVisible()
    await expect(appGallery.roadmapCardTitle('QR Code Scanner')).toBeVisible()
  })

  test('search filter narrows both Capabilities and Roadmap', async ({
    appGallery,
  }) => {
    // "slam" matches a few capabilities/roadmap items by tag/desc.
    await appGallery.searchInput.fill('slam')

    // Capabilities surface — Live Occupancy Map and Occupancy Map
    // (sim) both carry the 'slam' tag; Visual SLAM is roadmap.
    await expect(appGallery.capabilityTitle('Live Occupancy Map')).toBeVisible()
    await expect(appGallery.capabilityTitle('Occupancy Map (sim)')).toBeVisible()
    await expect(appGallery.roadmapCardTitle('Visual SLAM')).toBeVisible()

    // Capabilities that don't carry 'slam' should be filtered out.
    await expect(
      appGallery.capabilityTitle('Buzzer Music'),
    ).toHaveCount(0)

    // Clearing the filter brings everything back.
    await appGallery.searchInput.fill('')
    await expect(appGallery.capabilityTitle('Buzzer Music')).toBeVisible()
  })

  test('opening a panel and closing via X returns the user to the gallery', async ({
    appGallery,
    dashboard,
  }) => {
    await appGallery.openPanelButton('Live Camera').click()

    // The panel mounts above the gallery, under a Card with class
    // `border-primary/30`.  A top-level `Live Camera Feed` heading is
    // the inner panel; AppShell's outer card title is "Live Camera".
    await expect(appGallery.panelHeading('Live Camera')).toBeVisible()

    await appGallery.closePanelButton.click()

    // After clicking X the outer panel host card disappears, leaving
    // only the gallery's "Live Camera" heading-less span.
    await expect(dashboard.locator('div.border-primary\\/30')).toHaveCount(0)
  })

  test('Roadmap items show a "Roadmap" badge and a dependency note', async ({
    appGallery,
  }) => {
    // Spot-check a few roadmap cards. They render a `Roadmap` badge
    // and a "Depends on:" footer.
    const visualSlam = appGallery.roadmapCardTitle('Visual SLAM').first()
    await expect(visualSlam).toBeVisible()

    const card = visualSlam.locator(
      'xpath=ancestor::div[contains(@class,"rounded-lg") and contains(@class,"border")][1]',
    )
    await expect(card.getByText('Roadmap', { exact: true })).toBeVisible()
    await expect(card.getByText(/Depends on:/)).toBeVisible()
  })
})
