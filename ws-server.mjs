// Adeept AWR-V3 Robot Firmware Simulator — Node/WebSocket server.
// This intentionally models the remote robot firmware endpoint, not the dashboard.
import http from "node:http";
import { WebSocketServer } from "ws";

const PORT = 8889;
const state = {
  speed: 50,
  lights: "off",
  lastTune: "",
  lastMotion: "stopped",
  lastTilt: "stopped",
  lastFunction: "",
  lastServo: "",
  switches: {
    1: false,
    2: false,
    3: false,
  },
};

const capabilities = {
  role: "robot-firmware-simulator",
  protocol: "awr-v3-websocket",
  transport: "websocket",
  auth: "admin:123456",
  hardware: {
    movement: true,
    cameraTilt: true,
    discreteLeds: true,
    ws2812: true,
    buzzer: true,
    telemetry: true,
    cameraStream: false,
  },
  demos: ["baby_shark", "happy_birthday", "seven_notes", "beep_marker", "police", "breathe_blue", "rainbow", "led_wink"],
};

const httpServer = http.createServer((req, res) => {
  if (req.url === "/capabilities") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(capabilities));
    return;
  }
  if (req.url === "/state") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(state));
    return;
  }
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("AWR-V3 Simulator WebSocket Server");
});

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  console.log("[SIM] Client connected");
  ws.data = { authenticated: false };

  ws.on("message", (message) => {
    const msg = typeof message === "string" ? message : new TextDecoder().decode(message);

    // Auth handshake
    if (!ws.data.authenticated) {
      if (msg.includes(":")) {
        const [user, pass] = msg.split(":");
        if (user === "admin" && pass === "123456") {
          ws.data.authenticated = true;
          ws.send("congratulation, you have connect with server\r\nnow, you can do something else");
          console.log("[SIM] Client authenticated");
        } else {
          ws.send("sorry, the username or password is wrong, please submit again");
        }
      }
      return;
    }

    // Try JSON parse
    let parsed = null;
    try { parsed = JSON.parse(msg); } catch {}

    const response = { status: "ok", title: "", data: null };

    if (parsed && typeof parsed === "object") {
      console.log(`[SIM] JSON: ${msg}`);
    } else {
      if (msg === "get_info") {
        response.title = "get_info";
        response.data = [
          (40 + Math.random() * 25).toFixed(1),
          (5 + Math.random() * 40).toFixed(1),
          (30 + Math.random() * 30).toFixed(1),
          (60 + Math.random() * 35).toFixed(0),
        ];
      } else if (msg.startsWith("wsB ")) {
        state.speed = parseInt(msg.split(" ")[1], 10) || 50;
        console.log(`[SIM] Speed: ${state.speed}`);
      } else if (msg.startsWith("tone ")) {
        state.lastTune = msg;
        console.log(`[SIM] Tone: ${msg}`);
      } else if (msg.startsWith("tune ")) {
        state.lastTune = msg.slice("tune ".length);
        console.log(`[SIM] Tune: ${state.lastTune}`);
      } else if (msg.startsWith("lights_")) {
        state.lights = msg;
        console.log(`[SIM] Light effect: ${state.lights}`);
      } else if (["forward","backward","left","right","rotate-left","rotate-right"].includes(msg)) {
        state.lastMotion = msg;
        console.log(`[SIM] Move: ${msg} @ ${state.speed}%`);
      } else if (["DS","TS"].includes(msg)) {
        state.lastMotion = "stopped";
        console.log(`[SIM] Stop: ${msg}`);
      } else if (msg === "UDstop") {
        state.lastTilt = "stopped";
        console.log(`[SIM] Stop: ${msg}`);
      } else if (["up","down"].includes(msg)) {
        state.lastTilt = msg;
        console.log(`[SIM] Tilt: ${msg}`);
      } else if (msg.startsWith("Switch_")) {
        const match = msg.match(/^Switch_(\d+)_(on|off)$/);
        if (match) {
          state.switches[match[1]] = match[2] === "on";
        }
        console.log(`[SIM] Switch: ${msg}`);
      } else if (["findColor","motionGet","stopCV","automatic","automaticOff","trackLine","trackLineOff","police","policeOff","keepDistance","keepDistanceOff","CVFL"].includes(msg)) {
        state.lastFunction = msg;
        console.log(`[SIM] Function: ${msg}`);
        if (msg === "police") state.lights = "police";
        if (msg === "policeOff") state.lights = "off";
      } else if (msg.startsWith("Si") || msg.startsWith("PWM")) {
        state.lastServo = msg;
        console.log(`[SIM] Servo: ${msg}`);
      } else {
        console.log(`[SIM] Unknown: ${msg}`);
      }
    }

    ws.send(JSON.stringify(response));
  });

  ws.on("close", () => {
    console.log("[SIM] Client disconnected");
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[AWR-V3 Simulator] WebSocket server on ws://0.0.0.0:${PORT}`);
  console.log(`[AWR-V3 Simulator] Capabilities on http://0.0.0.0:${PORT}/capabilities`);
});