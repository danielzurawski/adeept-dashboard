/**
 * Live-Pi Demo Pad scenarios.
 *
 * Each Demo Pad button runs a short sequence of WS frames. On the
 * live Zig firmware some are hardware-verifiable (LED Wink flips
 * GPIOs, Camera Nod moves the servo, motion macros pulse motors)
 * and some are firmware-internal (tunes, lights). For the latter
 * the dashboard's command log is the single source of truth — if
 * the firmware accepts the frame, the RX response lands.
 *
 * Tests in this spec divide into:
 *
 *   1. **Hardware-backed** — assert via PCA9685 / GPIO probes.
 *   2. **Vendor-only** — assert TX appeared in the command log; the
 *      Zig firmware silently ignores commands it doesn't implement.
 */

import { test, expect } from '../fixtures/live'
import { readPca9685OverSsh, readMotorChannels } from '../utils/pi-pca9685'

test.describe('Live-Pi Demo Pad — buzzer tunes', () => {
  test.describe.configure({ timeout: 90_000 })

  // The Zig firmware ships a `tune` dispatcher that pulses GPIO 18.
  // We assert on the dashboard's command log because GPIO 18 is at
  // PWM rates too fast to sample reliably over a 1.5 s SSH read.

  for (const demo of [
    { title: 'Baby Shark', frame: 'tune baby_shark' },
    { title: 'Happy Birthday', frame: 'tune happy_birthday' },
    { title: 'Seven Notes', frame: 'tune seven_notes' },
    { title: 'Beep Marker', frame: 'tone C5 160' },
  ]) {
    test(`${demo.title} sends "${demo.frame}" to the firmware`, async ({
      connectedDeck,
    }) => {
      await connectedDeck.demoButton(demo.title).click()
      await connectedDeck.expectLogContains(demo.frame, 5_000)
    })
  }
})

test.describe('Live-Pi Demo Pad — Camera Nod', () => {
  test.describe.configure({ timeout: 60_000 })

  test('Camera Nod fires the up/UDstop/down/UDstop sequence', async ({
    connectedDeck,
    ssh,
    dashboard,
  }) => {
    // The macro completes in ~720 ms, which is shorter than a single
    // SSH-based PCA9685 probe (~1.5 s round-trip), so we cannot
    // reliably catch the servo mid-flight from outside the Pi. The
    // per-button tilt verification already lives in
    // `tilt-and-servo.spec.ts`; here we verify (a) all four protocol
    // frames flow through the dashboard, and (b) the macro leaves
    // ch0 in a *valid* (non-zero) PWM state — i.e. the servo wasn't
    // accidentally driven to a stalled coil.
    await connectedDeck.demoButton('Camera Nod').click()

    await connectedDeck.expectLogContains('up')
    await connectedDeck.expectLogContains('down')
    await connectedDeck.expectLogContains('UDstop')

    await dashboard.waitForTimeout(900)
    const finalCh0 = (await readPca9685OverSsh(ssh))['ch00'] ?? 0
    expect(finalCh0).toBeGreaterThan(0)
  })
})

test.describe('Live-Pi Demo Pad — motion macros', () => {
  test.describe.configure({ timeout: 60_000 })

  test('Tiny Forward Tap fires wsB 25 → forward → DS → wsB 50 and quiesces', async ({
    connectedDeck,
    ssh,
    dashboard,
  }) => {
    // Macro window (~510 ms total) is shorter than a single SSH
    // probe; per-frame motor activation is already covered by
    // `drive.spec.ts` (forward + ch15 assertions). Here we verify
    // the macro contract end-to-end via the command log + the
    // post-macro idle state.
    await connectedDeck.armDrive()
    await connectedDeck.demoButton('Tiny Forward Tap').click()

    await connectedDeck.expectLogContains('wsB 25')
    await connectedDeck.expectLogContains('forward')
    await connectedDeck.expectLogContains('DS')
    await connectedDeck.expectLogContains('wsB 50')

    await dashboard.waitForTimeout(700)
    const after = await readMotorChannels(ssh)
    for (const ch of [8, 9, 10, 11, 12, 13, 14, 15]) {
      expect.soft(after[ch], `ch${ch} should be idle after DS`).toBe(0)
    }
  })

  test('Tiny Spin Tap fires wsB 25 → rotate-left → DS → wsB 50 and quiesces', async ({
    connectedDeck,
    ssh,
    dashboard,
  }) => {
    await connectedDeck.armDrive()
    await connectedDeck.demoButton('Tiny Spin Tap').click()

    await connectedDeck.expectLogContains('wsB 25')
    await connectedDeck.expectLogContains('rotate-left')
    await connectedDeck.expectLogContains('DS')
    await connectedDeck.expectLogContains('wsB 50')

    await dashboard.waitForTimeout(700)
    const after = await readMotorChannels(ssh)
    for (const ch of [8, 9, 10, 11, 12, 13, 14, 15]) {
      expect.soft(after[ch], `ch${ch} should be idle after DS`).toBe(0)
    }
  })

  test('Sensor Snapshot fires get_info and System Info populates', async ({
    connectedDeck,
  }) => {
    await connectedDeck.demoButton('Sensor Snapshot').click()
    await connectedDeck.expectLogContains('get_info')
    const { value: cpuTemp } = connectedDeck.systemInfoRow('CPU Temp')
    await expect(cpuTemp).toHaveText(/\d+(\.\d+)?°C/, { timeout: 8_000 })
  })
})

test.describe('Live-Pi Demo Pad — vendor-only effects (firmware ignores)', () => {
  test.describe.configure({ timeout: 60_000 })

  /**
   * The Zig firmware does not (yet) implement WS2812 light effects.
   * The dashboard's contract is still to send the frame, and the
   * firmware acks every command with `status:ok`. These tests verify
   * the TX is wired up; a future Zig update that adds WS2812
   * support will simply pass them too.
   */
  for (const demo of [
    { title: 'Police Lights', frame: 'police' },
    { title: 'Breathe Blue', frame: 'lights_breath_blue' },
    { title: 'Rainbow Sweep', frame: 'lights_rainbow' },
  ]) {
    test(`${demo.title} sends "${demo.frame}" even when firmware silently ignores`, async ({
      connectedDeck,
    }) => {
      await connectedDeck.demoButton(demo.title).click()
      await connectedDeck.expectLogContains(demo.frame, 5_000)
    })
  }
})
