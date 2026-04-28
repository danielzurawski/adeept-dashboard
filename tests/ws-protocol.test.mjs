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
    });
  });
});
