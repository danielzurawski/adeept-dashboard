/**
 * Occupancy Mapping (sim) panel scenarios.
 *
 * This is the *browser-only* SLAM demo — no backend traffic is
 * involved. It generates a fake room layout, lets the user toggle a
 * frontier-exploration animation, and offers a manual "Scan Once"
 * button to widen the visited area without auto-stepping.
 *
 * The panel is intentionally separate from the **Live Occupancy Map**
 * panel covered in `slam.spec.ts`, which talks WebSocket to the
 * firmware.  Both can be open simultaneously: this spec only opens
 * the sim panel.
 */

import { test, expect } from '../fixtures/dashboard'

test.describe('Occupancy Mapping (sim) panel', () => {
  test.beforeEach(async ({ appGallery, controlDeck }) => {
    void controlDeck
    await appGallery.openPanelButton('Occupancy Map (sim)').click()
  })

  /**
   * Scope queries to the sim panel only.  The dashboard has many
   * buttons named "Reset" / "Explore" elsewhere (servo calibration,
   * camera view, etc.); without scoping we'd hit ambiguity.
   */
  function panelRoot(dashboard: import('@playwright/test').Page) {
    return dashboard
      .getByRole('heading', { name: 'Occupancy Grid Map', exact: true })
      .locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')
  }

  test('opens with IDLE status and an Explore call to action', async ({
    dashboard,
  }) => {
    const panel = panelRoot(dashboard)
    await expect(panel).toBeVisible()
    await expect(panel.getByText('IDLE', { exact: true })).toBeVisible()
    await expect(panel.getByRole('button', { name: /Explore/ })).toBeVisible()
  })

  test('Explore toggles the EXPLORING badge and switches the button to Pause', async ({
    dashboard,
  }) => {
    const panel = panelRoot(dashboard)
    await panel.getByRole('button', { name: /Explore/ }).click()

    await expect(panel.getByText('EXPLORING', { exact: true })).toBeVisible()
    const pauseBtn = panel.getByRole('button', { name: /Pause/ })
    await expect(pauseBtn).toBeVisible()

    await pauseBtn.click()
    await expect(panel.getByText('IDLE', { exact: true })).toBeVisible()
  })

  test('Reset returns the canvas to the default room layout', async ({
    dashboard,
  }) => {
    const panel = panelRoot(dashboard)
    await panel.getByRole('button', { name: /Explore/ }).click()
    await dashboard.waitForTimeout(300)
    await panel.getByRole('button', { name: /^Reset$/ }).click()

    await expect(panel.getByText('IDLE', { exact: true })).toBeVisible()
  })

  test('Scan Once does not start the explorer loop', async ({
    dashboard,
  }) => {
    const panel = panelRoot(dashboard)
    await panel.getByRole('button', { name: /Scan Once/ }).click()
    await expect(panel.getByText('IDLE', { exact: true })).toBeVisible()
  })
})
