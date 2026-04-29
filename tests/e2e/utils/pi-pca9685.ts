/**
 * Reads PCA9685 channel duty cycles from the live Raspberry Pi over
 * SSH so the live-Pi Playwright suite can assert that the dashboard's
 * drive commands propagated all the way to the I²C bus.
 *
 * Why not use a sim?  Because the whole point of the live-Pi project
 * is to verify the path:
 *
 *     Dashboard UI  →  WebSocket frame  →  Zig firmware  →
 *     PCA9685 PWM channels  →  H-bridge  →  motor coils
 *
 * The duty-cycle read is the closest thing to an end-to-end ground
 * truth we can get without an external camera or hall-effect probe,
 * and it's fast enough (~1–2 s/SSH call) for a small test suite.
 *
 * Authentication: by default we use `sshpass` with the password from
 * `AWR_PI_PASSWORD`. Set `AWR_PI_HOST` (defaults to
 * `dmz@raspberry-pi.local`) and `AWR_PI_PASSWORD` (no default — the
 * suite skips itself if it isn't set). If you have a working SSH key
 * and prefer agent auth, set `AWR_PI_USE_AGENT=1` and we'll skip the
 * sshpass wrapper.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const PCA9685_ADDR = 0x5f

export type PcaChannel =
  | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
  | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15

export type PcaDutyCycles = Record<`ch${string}`, number>

const SMBUS_PROBE_PY = `
import json, smbus2
bus = smbus2.SMBus(1)
out = {}
for ch in range(16):
  base = 0x06 + 4*ch
  on_l = bus.read_byte_data(0x5f, base)
  on_h = bus.read_byte_data(0x5f, base + 1)
  off_l = bus.read_byte_data(0x5f, base + 2)
  off_h = bus.read_byte_data(0x5f, base + 3)
  on = (on_h << 8) | on_l
  off = (off_h << 8) | off_l
  # Match Adafruit's 16-bit duty_cycle scaling: off << 4, or 0xFFFF
  # when the FULL_ON bit is set in the ON register.
  if on & 0x1000:
    duty = 0xFFFF
  else:
    duty = (off & 0x0FFF) << 4
  out[f'ch{ch:02d}'] = duty
print(json.dumps(out))
`.trim()

export interface SshConfig {
  host: string
  password?: string
  useAgent: boolean
}

export function sshConfigFromEnv(): SshConfig {
  const host = process.env.AWR_PI_HOST ?? 'dmz@raspberry-pi.local'
  const useAgent = process.env.AWR_PI_USE_AGENT === '1'
  const password = process.env.AWR_PI_PASSWORD
  return { host, password, useAgent }
}

/**
 * Runs `python3 - <<'PY'` over SSH and parses the JSON it prints. The
 * Python snippet uses `smbus2` to read all 16 PCA9685 channels in one
 * round-trip, returning duty cycles in Adafruit's 16-bit scale (so
 * `0` is fully off and ~`65 535` is fully on).
 */
export async function readPca9685OverSsh(
  cfg: SshConfig = sshConfigFromEnv(),
): Promise<PcaDutyCycles> {
  if (!cfg.useAgent && !cfg.password) {
    throw new Error(
      'pi-pca9685: no SSH credentials. Set AWR_PI_PASSWORD or AWR_PI_USE_AGENT=1.',
    )
  }

  const sshArgs = [
    '-o', 'BatchMode=no',
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ConnectTimeout=8',
    cfg.host,
    `python3 -c '${SMBUS_PROBE_PY.replace(/'/g, "'\\''")}'`,
  ]

  let cmd: string
  let args: string[]
  if (cfg.useAgent) {
    cmd = 'ssh'
    args = sshArgs
  } else {
    cmd = 'sshpass'
    args = ['-p', cfg.password!, 'ssh', ...sshArgs]
  }

  const { stdout } = await execFileAsync(cmd, args, {
    timeout: 15_000,
    maxBuffer: 64 * 1024,
  })
  const trimmed = stdout.trim()
  try {
    return JSON.parse(trimmed) as PcaDutyCycles
  } catch (e) {
    throw new Error(
      `pi-pca9685: failed to parse PCA9685 JSON over SSH:\n${trimmed}\n${
        (e as Error).message
      }`,
    )
  }
}

/**
 * Convenience: read the 8 motor channels (ch08–ch15) only.  These are
 * the H-bridge inputs (chs 8,9,10,11,12,13,14,15 = M4-IN1, M4-IN2,
 * M3-IN2, M3-IN1, M2-IN1, M2-IN2, M1-IN2, M1-IN1).
 */
export async function readMotorChannels(
  cfg: SshConfig = sshConfigFromEnv(),
): Promise<Record<number, number>> {
  const all = await readPca9685OverSsh(cfg)
  const out: Record<number, number> = {}
  for (let ch = 8; ch <= 15; ch++) {
    const key = `ch${String(ch).padStart(2, '0')}` as `ch${string}`
    out[ch] = all[key] ?? 0
  }
  return out
}

/**
 * Channel mapping derived from `src/motor/driver.zig` MOTOR_CHANNELS +
 * MOTOR_DIRS. For each high-level intent, lists the PCA9685 channels
 * that should be ACTIVE (PWM > 0) when the firmware accepts the
 * command, and the channels that should be IDLE (PWM == 0).
 *
 * `forward` / `backward` use a "tank-style" 4-wheel mix where every
 * wheel spins the same direction; turn modes split the four wheels.
 */
export const MOTOR_INTENT = {
  forward:        { active: [15, 13, 11, 9], idle: [14, 12, 10, 8] },
  backward:       { active: [14, 12, 10, 8], idle: [15, 13, 11, 9] },
  'rotate-left':  { active: [15, 13, 10, 8], idle: [14, 12, 11, 9] },
  'rotate-right': { active: [14, 12, 11, 9], idle: [15, 13, 10, 8] },
  // For skid steer "left" / "right" the "high-side" wheels run at
  // full speed and the "low-side" wheels run at ~30% speed but in
  // the SAME direction (still forward), so the same channels are
  // active as for `forward` but two of them have lower duty cycles.
  left:           { active: [15, 13, 11, 9], idle: [14, 12, 10, 8] },
  right:          { active: [15, 13, 11, 9], idle: [14, 12, 10, 8] },
  stop:           { active: [], idle: [8, 9, 10, 11, 12, 13, 14, 15] },
} as const

export type MotorIntent = keyof typeof MOTOR_INTENT
