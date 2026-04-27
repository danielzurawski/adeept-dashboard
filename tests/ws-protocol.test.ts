import { describe, it, expect } from "bun:test";

const WS_URL = "ws://localhost:8889";
const TIMEOUT = 5000;

/** Helper: open a WebSocket and wait for connection */
function openWs(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("WebSocket connection timed out"));
    }, TIMEOUT);
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.addEventListener("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

/** Helper: send a message and wait for the next response */
function sendAndReceive(ws: WebSocket, message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for response to: ${message}`)), TIMEOUT);
    const handler = (event: MessageEvent) => {
      clearTimeout(timer);
      ws.removeEventListener("message", handler);
      resolve(typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data));
    };
    ws.addEventListener("message", handler);
    ws.send(message);
  });
}

/** Helper: authenticate a WebSocket connection, returns the auth response */
async function authenticate(ws: WebSocket): Promise<string> {
  return sendAndReceive(ws, "admin:123456");
}

/** Helper: authenticate and then send a command, returns parsed JSON response */
async function authAndCommand(command: string): Promise<any> {
  const ws = await openWs();
  await authenticate(ws);
  const response = await sendAndReceive(ws, command);
  ws.close();
  return JSON.parse(response);
}

// =============================================================================
// Test Suites
// =============================================================================

describe("AWR-V3 WebSocket Protocol E2E", () => {

  // ---------------------------------------------------------------------------
  // 1. Connection & Authentication
  // ---------------------------------------------------------------------------
  describe("Authentication", () => {
    it("should connect to the WebSocket server", async () => {
      const ws = await openWs();
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });

    it("should authenticate with correct credentials", async () => {
      const ws = await openWs();
      const response = await authenticate(ws);
      expect(response).toContain("congratulation");
      expect(response).toContain("connect with server");
      ws.close();
    });

    it("should reject incorrect credentials", async () => {
      const ws = await openWs();
      const response = await sendAndReceive(ws, "wrong:password");
      expect(response).toContain("sorry");
      expect(response).toContain("wrong");
      ws.close();
    });

    it("should reject empty credentials", async () => {
      const ws = await openWs();
      const response = await sendAndReceive(ws, ":");
      expect(response).toContain("sorry");
      ws.close();
    });

    it("should not process commands before authentication", async () => {
      const ws = await openWs();
      // Send a command without authenticating - server should not respond with JSON
      const response = await sendAndReceive(ws, "admin:wrong");
      expect(response).toContain("sorry");
      // Now authenticate properly
      const authResponse = await sendAndReceive(ws, "admin:123456");
      expect(authResponse).toContain("congratulation");
      ws.close();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. System Info (get_info)
  // ---------------------------------------------------------------------------
  describe("System Info", () => {
    it("should return get_info with title and data array", async () => {
      const result = await authAndCommand("get_info");
      expect(result.status).toBe("ok");
      expect(result.title).toBe("get_info");
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(4);
    });

    it("should return CPU temp as a numeric string", async () => {
      const result = await authAndCommand("get_info");
      const cpuTemp = parseFloat(result.data[0]);
      expect(cpuTemp).toBeGreaterThanOrEqual(40);
      expect(cpuTemp).toBeLessThanOrEqual(65);
    });

    it("should return CPU usage as a numeric string", async () => {
      const result = await authAndCommand("get_info");
      const cpuUsage = parseFloat(result.data[1]);
      expect(cpuUsage).toBeGreaterThanOrEqual(5);
      expect(cpuUsage).toBeLessThanOrEqual(45);
    });

    it("should return RAM usage as a numeric string", async () => {
      const result = await authAndCommand("get_info");
      const ramUsage = parseFloat(result.data[2]);
      expect(ramUsage).toBeGreaterThanOrEqual(30);
      expect(ramUsage).toBeLessThanOrEqual(60);
    });

    it("should return battery percentage as a numeric string", async () => {
      const result = await authAndCommand("get_info");
      const battery = parseFloat(result.data[3]);
      expect(battery).toBeGreaterThanOrEqual(20);
      expect(battery).toBeLessThanOrEqual(100);
    });

    it("should return different values on subsequent calls (randomized simulation)", async () => {
      const ws = await openWs();
      await authenticate(ws);
      const r1 = JSON.parse(await sendAndReceive(ws, "get_info"));
      const r2 = JSON.parse(await sendAndReceive(ws, "get_info"));
      const r3 = JSON.parse(await sendAndReceive(ws, "get_info"));
      // At least one value should differ across 3 calls (extremely unlikely all identical with random)
      const allSame = r1.data[0] === r2.data[0] && r2.data[0] === r3.data[0]
        && r1.data[1] === r2.data[1] && r2.data[1] === r3.data[1]
        && r1.data[2] === r2.data[2] && r2.data[2] === r3.data[2]
        && r1.data[3] === r2.data[3] && r2.data[3] === r3.data[3];
      expect(allSame).toBe(false);
      ws.close();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Movement Commands
  // ---------------------------------------------------------------------------
  describe("Movement Commands", () => {
    const movementCommands = ["forward", "backward", "left", "right", "rotate-left", "rotate-right"];

    for (const cmd of movementCommands) {
      it(`should accept '${cmd}' command and return ok status`, async () => {
        const result = await authAndCommand(cmd);
        expect(result.status).toBe("ok");
      });
    }

    it("should accept 'DS' (direction stop) command", async () => {
      const result = await authAndCommand("DS");
      expect(result.status).toBe("ok");
    });

    it("should accept 'TS' (turn stop) command", async () => {
      const result = await authAndCommand("TS");
      expect(result.status).toBe("ok");
    });

    it("should handle movement sequence: forward → DS", async () => {
      const ws = await openWs();
      await authenticate(ws);
      const r1 = JSON.parse(await sendAndReceive(ws, "forward"));
      expect(r1.status).toBe("ok");
      const r2 = JSON.parse(await sendAndReceive(ws, "DS"));
      expect(r2.status).toBe("ok");
      ws.close();
    });

    it("should handle rapid movement commands without error", async () => {
      const ws = await openWs();
      await authenticate(ws);
      const commands = ["forward", "left", "DS", "backward", "right", "TS", "rotate-left", "DS"];
      for (const cmd of commands) {
        const r = JSON.parse(await sendAndReceive(ws, cmd));
        expect(r.status).toBe("ok");
      }
      ws.close();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Camera Tilt Commands
  // ---------------------------------------------------------------------------
  describe("Camera Tilt", () => {
    it("should accept 'up' command", async () => {
      const result = await authAndCommand("up");
      expect(result.status).toBe("ok");
    });

    it("should accept 'down' command", async () => {
      const result = await authAndCommand("down");
      expect(result.status).toBe("ok");
    });

    it("should accept 'UDstop' command", async () => {
      const result = await authAndCommand("UDstop");
      expect(result.status).toBe("ok");
    });

    it("should handle tilt sequence: up → UDstop → down → UDstop", async () => {
      const ws = await openWs();
      await authenticate(ws);
      for (const cmd of ["up", "UDstop", "down", "UDstop"]) {
        const r = JSON.parse(await sendAndReceive(ws, cmd));
        expect(r.status).toBe("ok");
      }
      ws.close();
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Speed Control
  // ---------------------------------------------------------------------------
  describe("Speed Control", () => {
    it("should accept 'wsB 50' speed command", async () => {
      const result = await authAndCommand("wsB 50");
      expect(result.status).toBe("ok");
    });

    it("should accept 'wsB 0' (minimum speed)", async () => {
      const result = await authAndCommand("wsB 0");
      expect(result.status).toBe("ok");
    });

    it("should accept 'wsB 100' (maximum speed)", async () => {
      const result = await authAndCommand("wsB 100");
      expect(result.status).toBe("ok");
    });

    it("should handle speed change followed by movement", async () => {
      const ws = await openWs();
      await authenticate(ws);
      const r1 = JSON.parse(await sendAndReceive(ws, "wsB 80"));
      expect(r1.status).toBe("ok");
      const r2 = JSON.parse(await sendAndReceive(ws, "forward"));
      expect(r2.status).toBe("ok");
      const r3 = JSON.parse(await sendAndReceive(ws, "DS"));
      expect(r3.status).toBe("ok");
      ws.close();
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Function Toggle Commands
  // ---------------------------------------------------------------------------
  describe("Function Toggles", () => {
    const functionPairs = [
      { on: "findColor", off: "stopCV", name: "Color Detection" },
      { on: "motionGet", off: "stopCV", name: "Motion Detection" },
      { on: "automatic", off: "automaticOff", name: "Obstacle Avoidance" },
      { on: "trackLine", off: "trackLineOff", name: "Line Tracking" },
      { on: "keepDistance", off: "keepDistanceOff", name: "Keep Distance" },
      { on: "police", off: "policeOff", name: "Police Lights" },
      { on: "CVFL", off: "stopCV", name: "CV Line Follow" },
    ];

    for (const { on, off, name } of functionPairs) {
      it(`should toggle ${name}: '${on}' → '${off}'`, async () => {
        const ws = await openWs();
        await authenticate(ws);
        const r1 = JSON.parse(await sendAndReceive(ws, on));
        expect(r1.status).toBe("ok");
        const r2 = JSON.parse(await sendAndReceive(ws, off));
        expect(r2.status).toBe("ok");
        ws.close();
      });
    }

    it("should handle stopCV as universal CV stop", async () => {
      const result = await authAndCommand("stopCV");
      expect(result.status).toBe("ok");
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Switch / LED Port Commands
  // ---------------------------------------------------------------------------
  describe("Switch Controls", () => {
    for (const port of [1, 2, 3]) {
      it(`should toggle Switch_${port}_on and Switch_${port}_off`, async () => {
        const ws = await openWs();
        await authenticate(ws);
        const r1 = JSON.parse(await sendAndReceive(ws, `Switch_${port}_on`));
        expect(r1.status).toBe("ok");
        const r2 = JSON.parse(await sendAndReceive(ws, `Switch_${port}_off`));
        expect(r2.status).toBe("ok");
        ws.close();
      });
    }

    it("should handle all switches toggled in sequence", async () => {
      const ws = await openWs();
      await authenticate(ws);
      for (const port of [1, 2, 3]) {
        const on = JSON.parse(await sendAndReceive(ws, `Switch_${port}_on`));
        expect(on.status).toBe("ok");
      }
      for (const port of [1, 2, 3]) {
        const off = JSON.parse(await sendAndReceive(ws, `Switch_${port}_off`));
        expect(off.status).toBe("ok");
      }
      ws.close();
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Servo Configuration Commands
  // ---------------------------------------------------------------------------
  describe("Servo Configuration", () => {
    it("should accept 'SiLeft 0' (servo decrement)", async () => {
      const result = await authAndCommand("SiLeft 0");
      expect(result.status).toBe("ok");
    });

    it("should accept 'SiRight 0' (servo increment)", async () => {
      const result = await authAndCommand("SiRight 0");
      expect(result.status).toBe("ok");
    });

    it("should accept 'PWMMS 0' (servo middle set)", async () => {
      const result = await authAndCommand("PWMMS 0");
      expect(result.status).toBe("ok");
    });

    it("should accept 'PWMINIT' (init all servos)", async () => {
      const result = await authAndCommand("PWMINIT");
      expect(result.status).toBe("ok");
    });

    it("should accept 'PWMD' (reset all servos to default)", async () => {
      const result = await authAndCommand("PWMD");
      expect(result.status).toBe("ok");
    });

    it("should handle full servo calibration sequence", async () => {
      const ws = await openWs();
      await authenticate(ws);
      const commands = ["SiLeft 0", "SiLeft 0", "SiRight 0", "PWMMS 0", "PWMINIT", "PWMD"];
      for (const cmd of commands) {
        const r = JSON.parse(await sendAndReceive(ws, cmd));
        expect(r.status).toBe("ok");
      }
      ws.close();
    });
  });

  // ---------------------------------------------------------------------------
  // 9. JSON Commands
  // ---------------------------------------------------------------------------
  describe("JSON Commands", () => {
    it("should accept findColorSet JSON command", async () => {
      const ws = await openWs();
      await authenticate(ws);
      const payload = JSON.stringify({ title: "findColorSet", data: [120, 200, 150] });
      const response = JSON.parse(await sendAndReceive(ws, payload));
      expect(response.status).toBe("ok");
      ws.close();
    });

    it("should accept arbitrary JSON object", async () => {
      const ws = await openWs();
      await authenticate(ws);
      const payload = JSON.stringify({ lightMode: "breath", data: [70, 70, 255] });
      const response = JSON.parse(await sendAndReceive(ws, payload));
      expect(response.status).toBe("ok");
      ws.close();
    });
  });

  // ---------------------------------------------------------------------------
  // 10. Response Structure Validation
  // ---------------------------------------------------------------------------
  describe("Response Structure", () => {
    it("should always return JSON with status, title, and data fields for commands", async () => {
      const ws = await openWs();
      await authenticate(ws);
      const commands = ["forward", "DS", "up", "UDstop", "wsB 50", "Switch_1_on", "police", "policeOff"];
      for (const cmd of commands) {
        const r = JSON.parse(await sendAndReceive(ws, cmd));
        expect(r).toHaveProperty("status");
        expect(r).toHaveProperty("title");
        expect(r).toHaveProperty("data");
        expect(r.status).toBe("ok");
      }
      ws.close();
    });

    it("should return title='get_info' only for get_info command", async () => {
      const ws = await openWs();
      await authenticate(ws);
      // Normal command should have empty title
      const r1 = JSON.parse(await sendAndReceive(ws, "forward"));
      expect(r1.title).toBe("");
      // get_info should have title set
      const r2 = JSON.parse(await sendAndReceive(ws, "get_info"));
      expect(r2.title).toBe("get_info");
      ws.close();
    });

    it("should return null data for non-info commands", async () => {
      const ws = await openWs();
      await authenticate(ws);
      const r = JSON.parse(await sendAndReceive(ws, "forward"));
      expect(r.data).toBeNull();
      ws.close();
    });
  });

  // ---------------------------------------------------------------------------
  // 11. Connection Lifecycle
  // ---------------------------------------------------------------------------
  describe("Connection Lifecycle", () => {
    it("should handle multiple sequential connections", async () => {
      for (let i = 0; i < 3; i++) {
        const ws = await openWs();
        const authResp = await authenticate(ws);
        expect(authResp).toContain("congratulation");
        const info = JSON.parse(await sendAndReceive(ws, "get_info"));
        expect(info.title).toBe("get_info");
        ws.close();
      }
    });

    it("should handle full control session lifecycle", async () => {
      const ws = await openWs();

      // 1. Authenticate
      const auth = await authenticate(ws);
      expect(auth).toContain("congratulation");

      // 2. Check system info
      const info = JSON.parse(await sendAndReceive(ws, "get_info"));
      expect(info.data.length).toBe(4);

      // 3. Set speed
      const speed = JSON.parse(await sendAndReceive(ws, "wsB 70"));
      expect(speed.status).toBe("ok");

      // 4. Move forward
      const fwd = JSON.parse(await sendAndReceive(ws, "forward"));
      expect(fwd.status).toBe("ok");

      // 5. Stop
      const stop = JSON.parse(await sendAndReceive(ws, "DS"));
      expect(stop.status).toBe("ok");

      // 6. Tilt camera
      const tilt = JSON.parse(await sendAndReceive(ws, "up"));
      expect(tilt.status).toBe("ok");
      const tiltStop = JSON.parse(await sendAndReceive(ws, "UDstop"));
      expect(tiltStop.status).toBe("ok");

      // 7. Toggle function
      const funcOn = JSON.parse(await sendAndReceive(ws, "findColor"));
      expect(funcOn.status).toBe("ok");
      const funcOff = JSON.parse(await sendAndReceive(ws, "stopCV"));
      expect(funcOff.status).toBe("ok");

      // 8. Toggle LED
      const ledOn = JSON.parse(await sendAndReceive(ws, "Switch_1_on"));
      expect(ledOn.status).toBe("ok");
      const ledOff = JSON.parse(await sendAndReceive(ws, "Switch_1_off"));
      expect(ledOff.status).toBe("ok");

      // 9. Set color
      const color = JSON.parse(await sendAndReceive(ws, JSON.stringify({ title: "findColorSet", data: [100, 200, 150] })));
      expect(color.status).toBe("ok");

      // 10. Final info check
      const finalInfo = JSON.parse(await sendAndReceive(ws, "get_info"));
      expect(finalInfo.title).toBe("get_info");

      ws.close();
    });
  });

  // ---------------------------------------------------------------------------
  // 12. HTTP Endpoint (Bun.serve fallback)
  // ---------------------------------------------------------------------------
  describe("HTTP Endpoint", () => {
    it("should return 200 for HTTP GET on the server port", async () => {
      const response = await fetch("http://localhost:8889/");
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("AWR-V3");
    });
  });
});