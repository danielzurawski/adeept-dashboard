/**
 * Live-Pi Robot Modes scenarios.
 *
 * Robot Modes (Find Color, Motion Detect, Auto Obstacle, Track Line,
 * Keep Distance, CV Line Follow, Live Mapping) translate to pairs of
 * "on" / "off" WebSocket frames.  Many of them are vendor-Python
 * specific (CV/vision/autonomy) and the Zig firmware silently
 * ignores them, but the *dashboard* must still emit the right TX.
 *
 * Live Mapping is the one that actually does something on Zig (it
 * starts the SLAM grid timer); we cover that more thoroughly in
 * `slam.spec.ts` and only verify the on/off TX here.
 */

import { test } from '../fixtures/live'

const MODES = [
  { label: 'Find Color', on: 'findColor', off: 'stopCV', requiresArm: false },
  { label: 'Motion Detect', on: 'motionGet', off: 'stopCV', requiresArm: false },
  { label: 'Auto Obstacle', on: 'automatic', off: 'automaticOff', requiresArm: true },
  { label: 'Track Line', on: 'trackLine', off: 'trackLineOff', requiresArm: true },
  { label: 'Keep Distance', on: 'keepDistance', off: 'keepDistanceOff', requiresArm: true },
  { label: 'CV Line Follow', on: 'CVFL', off: 'stopCV', requiresArm: true },
  { label: 'Live Mapping', on: 'mapping', off: 'mappingOff', requiresArm: false },
] as const

test.describe('Live-Pi Robot Modes — UI fires the right ON/OFF pair', () => {
  test.describe.configure({ timeout: 90_000 })

  for (const mode of MODES) {
    test(`${mode.label} emits "${mode.on}" then "${mode.off}"`, async ({
      connectedDeck,
    }) => {
      if (mode.requiresArm) {
        await connectedDeck.armDrive()
      }
      const button = connectedDeck.modeButton(mode.label)

      await button.click()
      await connectedDeck.expectLogContains(mode.on, 5_000)

      await button.click()
      await connectedDeck.expectLogContains(mode.off, 5_000)
    })
  }
})
