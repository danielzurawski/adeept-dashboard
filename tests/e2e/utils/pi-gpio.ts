/**
 * Reads Raspberry Pi GPIO pin states over SSH using `pinctrl`, the
 * Raspberry Pi Foundation utility that supersedes the deprecated
 * `gpio` command. Used by the live-Pi Playwright suite to verify
 * that LED port toggles, buzzer pulses, and other GPIO-driven
 * surfaces actually flip the right pin on the board.
 *
 * Pin map (Adeept HAT V3.2 + Zig firmware, see `src/hal.zig`):
 *
 *   GPIO  9  → Switch_1 (LED port 1)
 *   GPIO 11  → Switch_3 (LED port 3)
 *   GPIO 18  → buzzer
 *   GPIO 22  → IR line sensor (left)
 *   GPIO 25  → Switch_2 (LED port 2)
 *
 * `pinctrl get NN` prints something like:
 *
 *     11: op dh pn-- | hi // GPIO11 = output
 *
 * which we parse for the bit between the pipe and the comment to get
 * "hi" or "lo". The helper below extracts that into a typed value.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { sshConfigFromEnv, type SshConfig } from './pi-pca9685'

const execFileAsync = promisify(execFile)

export type GpioLevel = 'hi' | 'lo' | 'unknown'

export const GPIO_PINS = {
  led1: 9,
  led2: 25,
  led3: 11,
  buzzer: 18,
  ir_line_l: 22,
} as const

/**
 * Reads multiple GPIO pins in a single SSH round-trip and returns a
 * `{ pin: level }` map. `pinctrl get` only takes one pin (or a
 * contiguous range like `9-11`) at a time, so we chain individual
 * `pinctrl get N` invocations with `;` and parse all of them at
 * once. This still keeps the SSH call count to one per probe.
 */
export async function readGpioPinsOverSsh(
  pins: readonly number[],
  cfg: SshConfig = sshConfigFromEnv(),
): Promise<Record<number, GpioLevel>> {
  if (!cfg.useAgent && !cfg.password) {
    throw new Error(
      'pi-gpio: no SSH credentials. Set AWR_PI_PASSWORD or AWR_PI_USE_AGENT=1.',
    )
  }

  const cmd = pins.map((p) => `pinctrl get ${p}`).join('; ')
  const sshArgs = [
    '-o', 'BatchMode=no',
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ConnectTimeout=8',
    cfg.host,
    cmd,
  ]
  let bin: string
  let args: string[]
  if (cfg.useAgent) {
    bin = 'ssh'
    args = sshArgs
  } else {
    bin = 'sshpass'
    args = ['-p', cfg.password!, 'ssh', ...sshArgs]
  }

  const { stdout } = await execFileAsync(bin, args, {
    timeout: 15_000,
    maxBuffer: 64 * 1024,
  })

  const out: Record<number, GpioLevel> = {}
  for (const pin of pins) out[pin] = 'unknown'

  for (const line of stdout.split('\n')) {
    // Example: "11: op dh pn-- | hi // GPIO11 = output"
    const match = line.match(/^\s*(\d+)\s*:.*\|\s*(hi|lo)\b/)
    if (match) {
      const pin = Number(match[1])
      const level = match[2] as 'hi' | 'lo'
      out[pin] = level
    }
  }
  return out
}

export async function readSwitchGpios(
  cfg: SshConfig = sshConfigFromEnv(),
): Promise<Record<'led1' | 'led2' | 'led3', GpioLevel>> {
  const pins = [GPIO_PINS.led1, GPIO_PINS.led2, GPIO_PINS.led3]
  const raw = await readGpioPinsOverSsh(pins, cfg)
  return {
    led1: raw[GPIO_PINS.led1] ?? 'unknown',
    led2: raw[GPIO_PINS.led2] ?? 'unknown',
    led3: raw[GPIO_PINS.led3] ?? 'unknown',
  }
}
