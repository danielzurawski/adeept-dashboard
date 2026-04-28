// Adeept AWR-V3 Robot Firmware Simulator — Node/WebSocket server.
// This intentionally models the remote robot firmware endpoint, not the dashboard.
import http from "node:http";
import { WebSocketServer } from "ws";

const PORT = 8889;
const GRID_SIZE = 80;
const CELL_CM = 10;
const STEP_CM_PER_MOVE = 4;
const ROT_RAD_PER_TURN = 0.262;

function makeGrid() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill("?"));
}

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
  slam: {
    mapping: false,
    poseX: GRID_SIZE / 2,
    poseY: GRID_SIZE / 2,
    theta: 0,
    grid: makeGrid(),
    cellsExplored: 0,
  },
};

let mappingTimer = null;
function startMapping() {
  if (mappingTimer) return;
  state.slam.mapping = true;
  mappingTimer = setInterval(() => {
    // Cast a ray ~12 cells along current heading and mark free; randomly drop an obstacle near the end.
    const cosT = Math.cos(state.slam.theta);
    const sinT = Math.sin(state.slam.theta);
    const rangeCells = 12;
    for (let i = 0; i < rangeCells; i++) {
      const cx = Math.round(state.slam.poseX + i * cosT);
      const cy = Math.round(state.slam.poseY + i * sinT);
      if (cx < 0 || cy < 0 || cx >= GRID_SIZE || cy >= GRID_SIZE) break;
      if (state.slam.grid[cy][cx] === "?") state.slam.cellsExplored++;
      state.slam.grid[cy][cx] = ".";
    }
    if (Math.random() < 0.4) {
      const ex = Math.round(state.slam.poseX + rangeCells * cosT);
      const ey = Math.round(state.slam.poseY + rangeCells * sinT);
      if (ex >= 0 && ey >= 0 && ex < GRID_SIZE && ey < GRID_SIZE) {
        if (state.slam.grid[ey][ex] === "?") state.slam.cellsExplored++;
        state.slam.grid[ey][ex] = "#";
      }
    }
  }, 250);
}
function stopMapping() {
  if (mappingTimer) {
    clearInterval(mappingTimer);
    mappingTimer = null;
  }
  state.slam.mapping = false;
}
function resetMap() {
  state.slam.grid = makeGrid();
  state.slam.poseX = GRID_SIZE / 2;
  state.slam.poseY = GRID_SIZE / 2;
  state.slam.theta = 0;
  state.slam.cellsExplored = 0;
}
function clampPose(v) {
  return Math.max(0, Math.min(GRID_SIZE - 1, v));
}
function applyTranslate(dirSign) {
  const dx = Math.cos(state.slam.theta) * (STEP_CM_PER_MOVE / CELL_CM) * dirSign;
  const dy = Math.sin(state.slam.theta) * (STEP_CM_PER_MOVE / CELL_CM) * dirSign;
  state.slam.poseX = clampPose(state.slam.poseX + dx);
  state.slam.poseY = clampPose(state.slam.poseY + dy);
}
function applyRotate(deltaRad) {
  let t = state.slam.theta + deltaRad;
  while (t > Math.PI) t -= Math.PI * 2;
  while (t < -Math.PI) t += Math.PI * 2;
  state.slam.theta = t;
}
function gridToString() {
  return state.slam.grid.map((row) => row.join("")).join("");
}
function countFrontiers() {
  let count = 0;
  for (let y = 1; y < GRID_SIZE - 1; y++) {
    for (let x = 1; x < GRID_SIZE - 1; x++) {
      if (state.slam.grid[y][x] === "?") {
        if (
          state.slam.grid[y][x - 1] === "." ||
          state.slam.grid[y][x + 1] === "." ||
          state.slam.grid[y - 1][x] === "." ||
          state.slam.grid[y + 1][x] === "."
        ) count++;
      }
    }
  }
  return count;
}

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
    slam: true,
  },
  demos: ["baby_shark", "happy_birthday", "seven_notes", "beep_marker", "police", "breathe_blue", "rainbow", "led_wink"],
  slam: {
    gridSize: GRID_SIZE,
    cellCm: CELL_CM,
    commands: ["mapping", "mappingOff", "slam_reset", "get_map", "slam_plan X Y"],
  },
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
        if (msg === "forward") applyTranslate(1);
        else if (msg === "backward") applyTranslate(-1);
        else if (msg === "rotate-left" || msg === "left") applyRotate(ROT_RAD_PER_TURN);
        else if (msg === "rotate-right" || msg === "right") applyRotate(-ROT_RAD_PER_TURN);
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
      } else if (msg === "mapping") {
        startMapping();
        response.title = "mapping";
        console.log(`[SIM] Mapping started`);
      } else if (msg === "mappingOff") {
        stopMapping();
        response.title = "mappingOff";
        console.log(`[SIM] Mapping stopped`);
      } else if (msg === "slam_reset") {
        resetMap();
        response.title = "slam_reset";
        console.log(`[SIM] Map reset`);
      } else if (msg === "get_map") {
        // Custom shape: data is an object, not the 4-element string array used by get_info.
        const payload = {
          status: "ok",
          title: "get_map",
          data: {
            size: GRID_SIZE,
            cell_cm: CELL_CM,
            x: Math.round(state.slam.poseX),
            y: Math.round(state.slam.poseY),
            theta: Number(state.slam.theta.toFixed(4)),
            frontiers: countFrontiers(),
            coverage: Math.min(100, Math.round((state.slam.cellsExplored / (GRID_SIZE * GRID_SIZE)) * 100)),
            mapping: state.slam.mapping,
            grid: gridToString(),
          },
        };
        ws.send(JSON.stringify(payload));
        return;
      } else if (msg.startsWith("slam_plan ")) {
        const parts = msg.split(" ").slice(1);
        const tx = Number(parts[0]);
        const ty = Number(parts[1]);
        const valid = Number.isFinite(tx) && Number.isFinite(ty);
        const length = valid
          ? Math.round(Math.abs(tx - state.slam.poseX) + Math.abs(ty - state.slam.poseY))
          : 0;
        ws.send(JSON.stringify({
          status: "ok",
          title: "slam_plan",
          data: { found: valid, length },
        }));
        return;
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