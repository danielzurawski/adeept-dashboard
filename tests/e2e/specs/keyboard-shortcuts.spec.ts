/**
 * Keyboard shortcut scenarios.
 *
 * The dashboard wires WASD / arrow keys to the drive mixer, Q/E to
 * the rotate buttons, and L/K to the camera tilt. The handlers are
 * attached to the window so they work from anywhere on the page —
 * but they MUST NOT fire while focus is inside an `<input>` /
 * `<textarea>` / `<select>` / contenteditable element, because that
 * would hijack the user's typing.
 *
 * The handlers also call `preventDefault()` on every handled key so
 * arrow keys don't scroll the page during a drive session.
 */

import { test, expect } from '../fixtures/dashboard'
import { getSimulatorState } from '../utils/sim-client'

const KEY_TO_DIR = [
  { key: 'w', dir: 'forward', stop: 'DS' },
  { key: 's', dir: 'backward', stop: 'DS' },
  { key: 'a', dir: 'left', stop: 'TS' },
  { key: 'd', dir: 'right', stop: 'TS' },
  { key: 'q', dir: 'rotate-left', stop: 'DS' },
  { key: 'e', dir: 'rotate-right', stop: 'DS' },
  { key: 'ArrowUp', dir: 'forward', stop: 'DS' },
  { key: 'ArrowDown', dir: 'backward', stop: 'DS' },
  { key: 'ArrowLeft', dir: 'left', stop: 'TS' },
  { key: 'ArrowRight', dir: 'right', stop: 'TS' },
] as const

test.describe('Keyboard shortcuts — drive', () => {
  test.beforeEach(async ({ connectedDeck, dashboard }) => {
    await connectedDeck.armDrive()
    // Move focus away from any input so the window key listener fires.
    await dashboard.locator('body').click({ position: { x: 5, y: 5 } })
  })

  for (const { key, dir, stop } of KEY_TO_DIR) {
    test(`'${key}' fires '${dir}' on press and '${stop}' on release`, async ({
      dashboard,
      connectedDeck,
      request,
    }) => {
      await dashboard.keyboard.down(key)
      const live = await getSimulatorState(request)
      expect(live.lastMotion).toBe(dir)
      await dashboard.keyboard.up(key)
      const settled = await getSimulatorState(request)
      expect(settled.lastMotion).toBe('stopped')

      await connectedDeck.expectLogContains(dir)
      await connectedDeck.expectLogContains(stop)
    })
  }
})

test.describe('Keyboard shortcuts — camera tilt (no arming required)', () => {
  test('L drives the camera tilt up; K drives it down; both release with UDstop', async ({
    dashboard,
    connectedDeck,
    request,
  }) => {
    await dashboard.locator('body').click({ position: { x: 5, y: 5 } })

    await dashboard.keyboard.down('l')
    expect((await getSimulatorState(request)).lastTilt).toBe('up')
    await dashboard.keyboard.up('l')
    expect((await getSimulatorState(request)).lastTilt).toBe('stopped')

    await dashboard.keyboard.down('k')
    expect((await getSimulatorState(request)).lastTilt).toBe('down')
    await dashboard.keyboard.up('k')
    expect((await getSimulatorState(request)).lastTilt).toBe('stopped')

    await connectedDeck.expectLogContains('UDstop')
  })
})

test.describe('Keyboard shortcuts — focus safety', () => {
  test('drive keys are ignored while focus is inside the URL input', async ({
    dashboard,
    controlDeck,
    request,
  }) => {
    // Disconnect first so the URL input is enabled.
    await controlDeck.connect()
    await controlDeck.armDrive()
    await controlDeck.disconnect()

    // Focus the URL input. The window listener must short-circuit
    // when the key event target is an input.
    await controlDeck.urlInput.focus()
    await dashboard.keyboard.press('w')

    // Simulator should remain at "stopped" because the test fixture
    // resets it before each test.
    const state = await getSimulatorState(request)
    expect(state.lastMotion).toBe('stopped')
  })
})
