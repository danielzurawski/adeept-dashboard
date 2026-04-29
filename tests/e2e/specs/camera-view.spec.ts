/**
 * Live Camera (CameraView) panel scenarios.
 *
 * The Live Camera panel is an MJPEG bridge — the dashboard does not
 * decode camera frames itself; it points an `<img>` tag at the URL
 * returned by the backend (Python's Flask `/video_feed`, or in the
 * future a Zig camera bridge serving the same contract).
 *
 * Affordances under test:
 *
 *   - Preset dropdown ("Python robot Flask stream" / hotspot / LAN).
 *   - Free-form URL input.
 *   - Resolution selector (640×480 / 320×240 / 1280×720).
 *   - Start Stream / Stop buttons.
 *   - Live state badge (LIVE vs OFFLINE).
 *
 * The panel is opened from the gallery and tested with the simulator
 * connected (the simulator does not serve a camera, but it doesn't
 * need to — these tests are pure UI/state, no actual frames are
 * decoded).
 */

import { test, expect } from '../fixtures/dashboard'

test.describe('Live Camera panel', () => {
  test.beforeEach(async ({ appGallery, controlDeck }) => {
    await controlDeck.connect()
    await appGallery.openPanelButton('Live Camera').click()
  })

  test('renders the offline placeholder before any stream starts', async ({
    dashboard,
  }) => {
    await expect(
      dashboard.getByRole('heading', { name: 'Live Camera Feed', exact: true }),
    ).toBeVisible()
    await expect(dashboard.getByText('OFFLINE', { exact: true })).toBeVisible()
    await expect(dashboard.getByText('No camera feed')).toBeVisible()
  })

  test('preset dropdown sets the URL input', async ({ dashboard }) => {
    // The Live Camera panel ships its own select; the first <select>
    // in the panel is the preset chooser. The component renders TWO
    // selects (preset + resolution) so we have to scope.
    const select = dashboard
      .getByRole('heading', { name: 'Live Camera Feed', exact: true })
      .locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')
      .locator('select')
      .first()
    const urlInput = dashboard.getByPlaceholder('http://robot-ip:5000/video_feed')

    await select.selectOption({ label: 'Robot hotspot Flask stream' })
    await expect(urlInput).toHaveValue('http://192.168.4.1:5000/video_feed')

    await select.selectOption({ label: 'LAN Flask stream' })
    await expect(urlInput).toHaveValue('http://192.168.86.34:5000/video_feed')
  })

  test('Start Stream flips the status badge to LIVE and shows the img tag', async ({
    dashboard,
  }) => {
    // Use a deliberately invalid URL so the browser's <img> onError
    // immediately reverts state without triggering a real network
    // call. The dashboard's Stop button is also exercised below.
    const urlInput = dashboard.getByPlaceholder('http://robot-ip:5000/video_feed')
    await urlInput.fill('http://invalid.local/no-stream')

    // Resolution selector — the LIVE state should be reflected in
    // the status row regardless of which resolution is chosen.
    const resolutionSelect = dashboard
      .getByRole('heading', { name: 'Live Camera Feed', exact: true })
      .locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')
      .locator('select')
      .nth(1)
    await resolutionSelect.selectOption('1280x720')

    await dashboard.getByRole('button', { name: /Start Stream/ }).click()

    // The badge flips to LIVE; an <img> with the user-provided src
    // mounts inside the video host. We don't wait for the actual
    // image to load — only that the dashboard wired the src up.
    await expect(dashboard.getByText('LIVE', { exact: true })).toBeVisible()
    const img = dashboard.locator('img[alt="Robot Camera Feed"]')
    await expect(img).toBeVisible()
    await expect(img).toHaveAttribute(
      'src',
      'http://invalid.local/no-stream',
    )

    // The Stop button is conditional on streaming state and replaces
    // the Start Stream button in the layout. Confirm we can click
    // it back into the OFFLINE state.
    const stopButton = dashboard.getByRole('button', { name: /^Stop$/ })
    if (await stopButton.isVisible({ timeout: 500 }).catch(() => false)) {
      await stopButton.click()
      await expect(dashboard.getByText('OFFLINE', { exact: true })).toBeVisible()
    } else {
      // The img onError fallback fires synchronously for invalid
      // hosts on some Chromium builds and reverts to OFFLINE before
      // the user can click Stop.  Either path is acceptable.
      await expect(dashboard.getByText('OFFLINE', { exact: true })).toBeVisible()
    }
  })

  test('persists the camera URL across reloads', async ({
    dashboard,
  }) => {
    const urlInput = dashboard.getByPlaceholder('http://robot-ip:5000/video_feed')
    await urlInput.fill('http://my-robot.local:5000/video_feed')
    // The dashboard only writes to localStorage when Start Stream is
    // clicked.
    await dashboard.getByRole('button', { name: /Start Stream/ }).click()

    await dashboard.reload()
    // On reload the user has to re-open the panel.
    await dashboard.locator('button', { hasText: 'Open panel' }).first().waitFor()
    const cameraOpenButton = dashboard
      .locator('span.font-medium', { hasText: 'Live Camera' })
      .locator(
        'xpath=ancestor::div[contains(@class,"rounded-lg") and contains(@class,"border")][1]',
      )
      .getByRole('button', { name: 'Open panel' })
    await cameraOpenButton.click()

    const urlInputAfter = dashboard.getByPlaceholder(
      'http://robot-ip:5000/video_feed',
    )
    await expect(urlInputAfter).toHaveValue(
      'http://my-robot.local:5000/video_feed',
    )
  })
})
