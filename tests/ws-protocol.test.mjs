import assert from "node:assert/strict";
import { describe, it } from "node:test";
import WebSocket from "ws";

const WS_URL = process.env.AWR_V3_WS_URL ?? "ws://localhost:8889";
const HTTP_URL = process.env.AWR_V3_HTTP_URL ?? "http://localhost:8889";
const TIMEOUT_MS = 5000;

function openWs() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("WebSocket connection timed out"));
    }, TIMEOUT_MS);

    ws.once("open", () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function sendAndReceive(ws, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", handler);
      reject(new Error(`Timed out waiting for response to: ${message}`));
    }, TIMEOUT_MS);
    const handler = (data) => {
      clearTimeout(timer);
      resolve(data.toString());
    };

    ws.once("message", handler);
    ws.send(message);
  });
}

async function authenticate(ws, auth = "admin:123456") {
  return sendAndReceive(ws, auth);
}

async function authAndCommand(command) {
  const ws = await openWs();
  try {
    await authenticate(ws);
    return JSON.parse(await sendAndReceive(ws, command));
  } finally {
    ws.close();
  }
}

async function getState() {
  const response = await fetch(`${HTTP_URL}/state`);
  assert.equal(response.status, 200);
  return response.json();
}

describe("AWR-V3 simulator protocol", () => {
  describe("authentication", () => {
    it("accepts valid credentials and rejects invalid credentials", async () => {
      const ws = await openWs();
      try {
        assert.match(await authenticate(ws, "wrong:password"), /sorry/);
        const accepted = await authenticate(ws);
        assert.match(accepted, /congratulation/);
        assert.match(accepted, /connect with server/);
      } finally {
        ws.close();
      }
    });
  });

  describe("telemetry", () => {
    it("returns dashboard-compatible get_info data", async () => {
      const result = await authAndCommand("get_info");

      assert.equal(result.status, "ok");
      assert.equal(result.title, "get_info");
      assert.equal(result.data.length, 4);
      for (const value of result.data) {
        assert.ok(Number.isFinite(Number.parseFloat(value)));
      }
    });
  });

  describe("actions mutate simulated robot state", () => {
    it("tracks speed, movement, stop, camera tilt, lights, tunes, switches, modes, and servos", async () => {
      const ws = await openWs();
      try {
        await authenticate(ws);

        for (const command of ["wsB 80", "forward"]) {
          assert.equal(JSON.parse(await sendAndReceive(ws, command)).status, "ok");
        }
        let state = await getState();
        assert.equal(state.speed, 80);
        assert.equal(state.lastMotion, "forward");

        assert.equal(JSON.parse(await sendAndReceive(ws, "DS")).status, "ok");
        state = await getState();
        assert.equal(state.lastMotion, "stopped");

        for (const command of ["up", "UDstop", "down"]) {
          assert.equal(JSON.parse(await sendAndReceive(ws, command)).status, "ok");
        }
        state = await getState();
        assert.equal(state.lastTilt, "down");

        assert.equal(JSON.parse(await sendAndReceive(ws, "police")).status, "ok");
        state = await getState();
        assert.equal(state.lights, "police");
        assert.equal(state.lastFunction, "police");

        assert.equal(JSON.parse(await sendAndReceive(ws, "tune baby_shark")).status, "ok");
        state = await getState();
        assert.equal(state.lastTune, "baby_shark");

        assert.equal(JSON.parse(await sendAndReceive(ws, "Switch_2_on")).status, "ok");
        state = await getState();
        assert.equal(state.switches["2"], true);

        assert.equal(JSON.parse(await sendAndReceive(ws, "automatic")).status, "ok");
        state = await getState();
        assert.equal(state.lastFunction, "automatic");

        assert.equal(JSON.parse(await sendAndReceive(ws, "SiLeft 0")).status, "ok");
        state = await getState();
        assert.equal(state.lastServo, "SiLeft 0");
      } finally {
        ws.close();
      }
    });
  });

  describe("capabilities endpoint", () => {
    it("advertises the simulator as a decoupled robot firmware endpoint", async () => {
      const response = await fetch(`${HTTP_URL}/capabilities`);
      assert.equal(response.status, 200);
      const capabilities = await response.json();

      assert.equal(capabilities.role, "robot-firmware-simulator");
      assert.equal(capabilities.protocol, "awr-v3-websocket");
      assert.equal(capabilities.hardware.movement, true);
      assert.equal(capabilities.hardware.cameraTilt, true);
      assert.equal(capabilities.hardware.buzzer, true);
      assert.equal(capabilities.hardware.slam, true);
      assert.equal(typeof capabilities.slam.gridSize, "number");
    });
  });

  describe("SLAM mapping protocol", () => {
    it("starts mapping, advances pose on movement, and returns get_map and slam_plan envelopes", async () => {
      const ws = await openWs();
      try {
        await authenticate(ws);
        // Reset to a deterministic starting state
        assert.equal(JSON.parse(await sendAndReceive(ws, "slam_reset")).status, "ok");

        const startMap = JSON.parse(await sendAndReceive(ws, "get_map"));
        assert.equal(startMap.title, "get_map");
        assert.equal(typeof startMap.data.grid, "string");
        assert.equal(startMap.data.grid.length, startMap.data.size * startMap.data.size);
        const startX = startMap.data.x;

        assert.equal(JSON.parse(await sendAndReceive(ws, "mapping")).title, "mapping");
        let state = await getState();
        assert.equal(state.slam.mapping, true);

        // Advance the pose with a forward command, then verify map exposes it
        for (const cmd of ["forward", "forward", "forward"]) {
          assert.equal(JSON.parse(await sendAndReceive(ws, cmd)).status, "ok");
        }
        const afterMap = JSON.parse(await sendAndReceive(ws, "get_map"));
        assert.equal(afterMap.title, "get_map");
        assert.ok(afterMap.data.x >= startX, "pose_x should advance forward (or stay clamped)");
        assert.equal(afterMap.data.mapping, true);

        const plan = JSON.parse(await sendAndReceive(ws, "slam_plan 50 50"));
        assert.equal(plan.title, "slam_plan");
        assert.equal(plan.data.found, true);
        assert.ok(plan.data.length >= 0);

        assert.equal(JSON.parse(await sendAndReceive(ws, "mappingOff")).title, "mappingOff");
        state = await getState();
        assert.equal(state.slam.mapping, false);
      } finally {
        ws.close();
      }
    });
  });
});
