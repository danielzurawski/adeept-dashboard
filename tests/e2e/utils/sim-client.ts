/**
 * Thin typed client for the Node WebSocket simulator's HTTP introspection
 * surface (`/state`, `/capabilities`).
 *
 * The simulator (see `ws-server.mjs`) keeps a single in-memory state
 * object that is mutated by every authenticated WebSocket command. The
 * E2E suite exercises the dashboard UI and then hits these endpoints
 * to assert the firmware actually observed the expected protocol
 * message, rather than only checking what the dashboard *displayed*.
 */

import type { APIRequestContext } from '@playwright/test'

export interface SimulatorSwitches {
  '1': boolean
  '2': boolean
  '3': boolean
}

export interface SimulatorSlamState {
  mapping: boolean
  poseX: number
  poseY: number
  theta: number
  cellsExplored: number
  cellsTotal: number
}

export interface SimulatorState {
  speed: number
  /** Last lights-related command (e.g. "police", "lights_breath_blue"). */
  lights: string
  /** Last `tune <name>` or `tone X Y` command sent. */
  lastTune: string
  /** Last motion command: forward/backward/left/right/rotate-LR/stopped. */
  lastMotion: string
  /** Last camera-tilt command: up/down/stopped. */
  lastTilt: string
  /** Last function toggle (findColor, automatic, mapping, …). */
  lastFunction: string
  /** Last servo trim command (`SiLeft`, `SiRight`, `PWMD`, `PWMINIT`, …). */
  lastServo: string
  switches: SimulatorSwitches
  slam: SimulatorSlamState
}

export interface SimulatorCapabilities {
  role: string
  protocol: string
  transport: string
  auth: string
  hardware: Record<string, boolean>
  demos: string[]
  slam: { gridSize: number; cellCm: number; commands: string[] }
}

const DEFAULT_BASE_URL = 'http://localhost:8889'

/**
 * Convenience wrapper around `request.fetch` that returns a strongly-typed
 * snapshot of the simulator's current state.
 */
export async function getSimulatorState(
  request: APIRequestContext,
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<SimulatorState> {
  const response = await request.get(`${baseUrl}/state`)
  if (!response.ok()) {
    throw new Error(`Simulator /state returned ${response.status()}`)
  }
  return (await response.json()) as SimulatorState
}

export async function getSimulatorCapabilities(
  request: APIRequestContext,
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<SimulatorCapabilities> {
  const response = await request.get(`${baseUrl}/capabilities`)
  if (!response.ok()) {
    throw new Error(`Simulator /capabilities returned ${response.status()}`)
  }
  return (await response.json()) as SimulatorCapabilities
}
