/**
 * Page Object for the **Robot Control Deck** section of the dashboard
 * (`<section id="control">`). This section consolidates the connection
 * panel, demo pad, control mixer (drive grid + camera tilt + speed),
 * system info, robot modes, LED ports, and the command log.
 *
 * The dashboard ships without `data-testid` or `aria-label` markers,
 * so this Page Object intentionally targets *user-visible* affordances:
 * accessible roles + visible names + `title` attributes. Doing so keeps
 * the tests honest — if the user-facing label changes, the test should
 * fail and prompt a deliberate update.
 */

import type { Page, Locator } from '@playwright/test'
import { expect } from '@playwright/test'

export type ConnectionPreset =
  | 'Local simulator'
  | 'Python robot (LAN)'
  | 'Python robot (.local)'
  | 'Zig robot (.local)'

export type DriveDirection =
  | 'forward'
  | 'backward'
  | 'left'
  | 'right'
  | 'rotate-left'
  | 'rotate-right'

const DRIVE_BUTTON_TITLES: Record<DriveDirection, string> = {
  forward: 'Forward (W / Arrow Up)',
  backward: 'Backward (S / Arrow Down)',
  left: 'Left (A / Arrow Left)',
  right: 'Right (D / Arrow Right)',
  'rotate-left': 'Rotate Left (Q)',
  'rotate-right': 'Rotate Right (E)',
}

export class ControlDeck {
  readonly page: Page
  readonly section: Locator

  constructor(page: Page) {
    this.page = page
    this.section = page.locator('section#control')
  }

  // ── Connection panel ────────────────────────────────────────────

  get presetSelect(): Locator {
    // The preset `<select>` lives at the top of the Connection panel.
    // It is the first <select> on the page (the camera panel ships
    // its own selects but those are inside the apps gallery, which is
    // not mounted by default).
    return this.section.locator('select').first()
  }

  get urlInput(): Locator {
    return this.page.getByPlaceholder('ws://robot-ip:8888')
  }

  get authInput(): Locator {
    return this.page.getByPlaceholder('user:password')
  }

  get connectButton(): Locator {
    return this.section.getByRole('button', { name: /^(Connect|Disconnect)$/ })
  }

  /** Top-of-section status text node ("Connected" / "Disconnected" / "Connecting…" / "Connecting..."). */
  get connectionStatusText(): Locator {
    return this.section
      .getByText(/^(Connected|Disconnected|Connecting[…\.]{1,3})$/)
      .first()
  }

  /**
   * The little colored dot next to the status text. The dashboard
   * gives it `bg-success` when connected, `bg-warning animate-pulse`
   * while connecting, and `bg-destructive` when disconnected.  We
   * read the *class list* and let the test assert on it.
   */
  get connectionStatusDot(): Locator {
    return this.section.locator('div.w-3.h-3.rounded-full').first()
  }

  /**
   * Header backend badge — Simulator/Zig/Python/Custom. Inferred from
   * the WS URL by `getBackend()` in `ControlPanel.tsx`.
   */
  get backendBadge(): Locator {
    return this.section.getByText(/^(Simulator|Zig|Python|Custom) backend$/)
  }

  async selectPreset(label: ConnectionPreset): Promise<void> {
    await this.presetSelect.selectOption({ label })
  }

  async fillUrl(url: string): Promise<void> {
    await this.urlInput.fill(url)
  }

  async fillAuth(auth: string): Promise<void> {
    await this.authInput.fill(auth)
  }

  /**
   * Click the Connect button and wait until the dashboard reflects the
   * authenticated state. We wait for the badge text (rather than only
   * the button label) because the badge is set after the auth banner
   * round-trip lands.
   */
  async connect(): Promise<void> {
    await this.connectButton.click()
    await expect(this.connectionStatusText).toHaveText('Connected', {
      timeout: 5_000,
    })
  }

  async disconnect(): Promise<void> {
    await this.connectButton.click()
    await expect(this.connectionStatusText).toHaveText('Disconnected', {
      timeout: 5_000,
    })
  }

  // ── Drive arming + emergency stop ───────────────────────────────

  get armButton(): Locator {
    return this.section.getByRole('button', { name: /^(Arm Drive|Drive Armed)$/ })
  }

  get stopAllButton(): Locator {
    return this.section.getByRole('button', { name: /Stop All/ })
  }

  async armDrive(): Promise<void> {
    await expect(this.armButton).toHaveText(/Arm Drive/)
    await this.armButton.click()
    await expect(this.armButton).toHaveText(/Drive Armed/)
  }

  async disarmDrive(): Promise<void> {
    await expect(this.armButton).toHaveText(/Drive Armed/)
    await this.armButton.click()
    await expect(this.armButton).toHaveText(/Arm Drive/)
  }

  // ── Drive mixer ─────────────────────────────────────────────────

  driveButton(direction: DriveDirection): Locator {
    return this.section.getByTitle(DRIVE_BUTTON_TITLES[direction], {
      exact: true,
    })
  }

  /**
   * The drive grid uses pointer events (`onPointerDown` / `onPointerUp`)
   * rather than click(), to support press-and-hold semantics. We
   * dispatch the pointer events explicitly so test timing is
   * deterministic.
   */
  async pressAndReleaseDrive(direction: DriveDirection, holdMs = 100): Promise<void> {
    const button = this.driveButton(direction)
    await button.dispatchEvent('pointerdown')
    await this.page.waitForTimeout(holdMs)
    await button.dispatchEvent('pointerup')
  }

  get stopDriveButton(): Locator {
    return this.section.getByTitle('Stop drive', { exact: true })
  }

  // ── Speed slider ────────────────────────────────────────────────

  get speedSlider(): Locator {
    return this.section.getByRole('slider')
  }

  get speedLabel(): Locator {
    return this.section.getByText(/^Speed: \d+%$/)
  }

  async setSpeed(value: number): Promise<void> {
    // Playwright's `.fill()` is a no-op on `<input type="range">`, and
    // synthetic drag-and-drop drifts off-step (the slider's step is
    // 10). The most reliable cross-browser approach is to walk the
    // slider via keyboard arrow presses, which fire React's onChange
    // exactly once per step.
    if (value < 0 || value > 100 || value % 10 !== 0) {
      throw new Error(
        `setSpeed: value must be a multiple of 10 in [0, 100] (got ${value})`,
      )
    }
    await this.speedSlider.focus()
    // Read the current value and walk to the target. We don't use
    // Home/End because not all browsers fire React's onChange for
    // those (the change-when-value-already-equal edge case bit us in
    // CI). ArrowLeft / ArrowRight always fire one onChange per press.
    const current = Number(await this.speedSlider.inputValue())
    const delta = value - current
    const direction = delta < 0 ? 'ArrowLeft' : 'ArrowRight'
    const steps = Math.abs(delta) / 10
    for (let i = 0; i < steps; i++) {
      await this.speedSlider.press(direction)
    }
    await expect(this.speedLabel).toHaveText(`Speed: ${value}%`)
  }

  // ── Servo calibration ───────────────────────────────────────────

  /**
   * Locator for the small servo calibration buttons that live below
   * the camera tilt buttons. Each is identified by visible text.
   */
  servoCalibButton(label: 'PWM-' | 'Middle' | 'PWM+' | 'Reset' | 'Init'): Locator {
    return this.section.getByRole('button', { name: label, exact: true })
  }

  // ── Camera tilt ─────────────────────────────────────────────────

  get tiltUpButton(): Locator {
    // 'Up' alone matches the Forward (W / Arrow Up) drive button and
    // the Camera Nod demo's accessible name (which mentions "tilt up
    // and down"), so we anchor to the button's exact text rendering.
    return this.section.getByRole('button', { name: 'Up', exact: true })
  }

  get tiltDownButton(): Locator {
    return this.section.getByRole('button', { name: 'Down', exact: true })
  }

  async pressAndReleaseTilt(direction: 'up' | 'down', holdMs = 100): Promise<void> {
    const button = direction === 'up' ? this.tiltUpButton : this.tiltDownButton
    await button.dispatchEvent('pointerdown')
    await this.page.waitForTimeout(holdMs)
    await button.dispatchEvent('pointerup')
  }

  // ── Demo Pad ────────────────────────────────────────────────────

  /**
   * Locate a Demo Pad card by its visible title (e.g. "Baby Shark",
   * "Sensor Snapshot"). The card's accessible name includes a category
   * label and a description, so matching by exact name is brittle.
   * Instead we filter all buttons in the section by the unique `<div>`
   * containing the title text, which the dashboard renders with
   * `font-semibold`.
   */
  demoButton(title: string): Locator {
    return this.section
      .getByRole('button')
      .filter({ has: this.page.locator(`div.font-semibold`, { hasText: new RegExp(`^${escapeRegex(title)}$`) }) })
  }

  // ── Robot Modes ─────────────────────────────────────────────────

  modeButton(label: string): Locator {
    return this.section.getByRole('button', { name: new RegExp(`^${escapeRegex(label)}$`) })
  }

  // ── LED Ports ───────────────────────────────────────────────────

  ledPortButton(port: 1 | 2 | 3): Locator {
    return this.section.getByRole('button', { name: new RegExp(`^Port ${port}\\s*— (ON|OFF)$`) })
  }

  // ── System Info ─────────────────────────────────────────────────

  /**
   * Returns the row containing the given metric label and the value
   * span beside it. Use `expect(row.value).toHaveText(...)`.
   */
  systemInfoRow(label: 'CPU Temp' | 'CPU Usage' | 'RAM Usage' | 'Battery'): {
    row: Locator
    value: Locator
  } {
    const row = this.section
      .getByText(label, { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"justify-between")][1]')
    const value = row.locator('span.font-mono')
    return { row, value }
  }

  // ── Command Log ─────────────────────────────────────────────────

  get commandLog(): Locator {
    // The log is the only `font-mono` scrollable div inside the Control Deck.
    return this.section.locator('div.h-40.overflow-y-auto.font-mono')
  }

  /** Returns the visible TX/RX entries, newest first. */
  get commandLogEntries(): Locator {
    return this.commandLog.locator('> div')
  }

  /**
   * Wait for an entry containing `text` to appear in the log.
   * Useful for asserting that a sent command actually reached the
   * client log buffer.
   */
  async expectLogContains(text: string | RegExp, timeout = 5_000): Promise<void> {
    await expect(this.commandLog).toContainText(text, { timeout })
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
