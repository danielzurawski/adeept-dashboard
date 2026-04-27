// Adeept AWR-V3 Robot Simulator — Bun WebSocket Server
const PORT = 8889;
let speed = 50;

const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    if (server.upgrade(req)) return;
    return new Response("AWR-V3 Simulator WebSocket Server", { status: 200 });
  },
  websocket: {
    open(ws) {
      console.log("[SIM] Client connected");
      ws.data = { authenticated: false };
    },
    message(ws, message) {
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
          speed = parseInt(msg.split(" ")[1], 10) || 50;
          console.log(`[SIM] Speed: ${speed}`);
        } else if (["forward","backward","left","right","rotate-left","rotate-right"].includes(msg)) {
          console.log(`[SIM] Move: ${msg} @ ${speed}%`);
        } else if (["DS","TS","UDstop"].includes(msg)) {
          console.log(`[SIM] Stop: ${msg}`);
        } else if (["up","down"].includes(msg)) {
          console.log(`[SIM] Tilt: ${msg}`);
        } else if (msg.startsWith("Switch_")) {
          console.log(`[SIM] Switch: ${msg}`);
        } else if (["findColor","motionGet","stopCV","automatic","automaticOff","trackLine","trackLineOff","police","policeOff","keepDistance","keepDistanceOff","CVFL"].includes(msg)) {
          console.log(`[SIM] Function: ${msg}`);
        } else if (msg.startsWith("Si") || msg.startsWith("PWM")) {
          console.log(`[SIM] Servo: ${msg}`);
        } else {
          console.log(`[SIM] Unknown: ${msg}`);
        }
      }

      ws.send(JSON.stringify(response));
    },
    close() {
      console.log("[SIM] Client disconnected");
    },
  },
});

console.log(`[AWR-V3 Simulator] Bun WebSocket server on ws://0.0.0.0:${server.port}`);