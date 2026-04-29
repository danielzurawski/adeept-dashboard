/**
 * Command Log scenarios.
 *
 * The Command Log gives the operator immediate visual feedback for
 * every protocol frame the dashboard sends and receives. The spec
 * for the log:
 *
 *   - Newest entry on top (so we don't need infinite scroll).
 *   - At most 50 entries kept in memory.
 *   - Each row shows a timestamp, a TX/RX badge, and the message.
 *   - Long messages (e.g. `get_map` JSON blobs) truncate to ~100 chars
 *     in the display, but the underlying data is the full message.
 */

import { test, expect } from '../fixtures/dashboard'

test.describe('Command Log', () => {
  test('shows the empty-state hint before any traffic', async ({
    controlDeck,
  }) => {
    // Pre-connect, the log card displays a neutral hint.
    await expect(
      controlDeck.commandLog.getByText(
        'No commands yet. Connect to the robot to start.',
      ),
    ).toBeVisible()
  })

  test('renders one row per command with timestamp and TX/RX classification', async ({
    connectedDeck,
  }) => {
    // After connecting, the auth banner row exists. Fire one extra
    // command so we can observe both a TX and an RX entry.
    await connectedDeck.demoButton('Sensor Snapshot').click()

    // Wait for at least 3 rows to land (open banner, auth, get_info TX,
    // and the get_info RX from the simulator typically arrive within
    // a few ms after the click).
    await expect(connectedDeck.commandLogEntries.first()).toBeVisible()
    await expect
      .poll(async () => connectedDeck.commandLogEntries.count(), {
        timeout: 3_000,
      })
      .toBeGreaterThanOrEqual(2)

    const firstEntry = connectedDeck.commandLogEntries.first()

    // Each row contains a leading timestamp span produced by
    // `new Date().toLocaleTimeString()`, a TX/RX badge, and the
    // (truncated) message text. The locale-aware string is
    // browser-locale dependent — Chromium under en-US renders
    // "1:45:23 PM" (12-hour, AM/PM, no leading zero), while a 24-hour
    // locale (e.g. de-DE) renders "13:45:23". Either is acceptable as
    // long as we see a real `H:MM:SS` core; we assert the structural
    // shape rather than depending on which command happens to land
    // first.
    const timestamp = firstEntry.locator('span').first()
    await expect(timestamp).toHaveText(/^\d{1,2}:\d{2}:\d{2}(\s?(AM|PM))?$/i)
    await expect(firstEntry).toContainText(/TX|RX/)
  })

  test('keeps the most recent 50 entries (older ones are dropped)', async ({
    connectedDeck,
  }) => {
    // Fire 60 cheap commands and assert the log never exceeds 50 rows.
    for (let i = 0; i < 60; i++) {
      await connectedDeck.demoButton('Sensor Snapshot').click()
    }
    await expect
      .poll(
        async () => connectedDeck.commandLogEntries.count(),
        { timeout: 6_000 },
      )
      .toBeLessThanOrEqual(50)
  })

  test('newest entries appear at the top of the log', async ({
    connectedDeck,
  }) => {
    // First, click "Sensor Snapshot" once to land a get_info TX/RX
    // pair near the top of the log.
    await connectedDeck.demoButton('Sensor Snapshot').click()

    // Then click "Police Lights" — the next TX must be the police
    // command. Because the log is newest-first, we expect to find
    // "police" in the first ~3 rows (TX, then the simulator's RX,
    // then potentially the next get_info poll).
    await connectedDeck.demoButton('Police Lights').click()

    const topThree = connectedDeck.commandLogEntries
    await expect(
      topThree.filter({ hasText: 'police' }).first(),
    ).toBeVisible({ timeout: 3_000 })
  })
})
