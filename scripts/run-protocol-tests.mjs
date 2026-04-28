#!/usr/bin/env node
/**
 * Starts ws-server.mjs from the repo root, waits until the HTTP side is ready, runs protocol tests,
 * then stops the server.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.AWR_V3_TEST_PORT ?? "8889");
const base = `http://127.0.0.1:${port}`;

function waitForHttpReady(maxMs = 15_000) {
  const start = Date.now();
  async function retry() {
    try {
      const r = await fetch(`${base}/capabilities`, { signal: AbortSignal.timeout(2_000) });
      if (r.ok) return;
    } catch {
      /* retry */
    }
    if (Date.now() - start > maxMs) {
      throw new Error(`Simulator did not become ready on ${base} within ${maxMs}ms`);
    }
    await delay(100);
    return retry();
  }
  return retry();
}

async function runTests() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--test", "tests/ws-protocol.test.mjs"], {
      cwd: repoRoot,
      stdio: "inherit",
      env: { ...process.env },
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) reject(new Error(`Tests killed: ${signal}`));
      else resolve(code ?? 0);
    });
  });
}

async function main() {
  const sim = spawn(process.execPath, ["ws-server.mjs"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env },
  });

  sim.on("error", (err) => {
    console.error("Failed to start simulator:", err);
    process.exit(1);
  });

  let exitCode = 1;
  try {
    await waitForHttpReady();
    exitCode = await runTests();
  } catch (e) {
    console.error(e);
    exitCode = 1;
  } finally {
    sim.kill("SIGTERM");
    await delay(300);
    if (sim.exitCode === null) sim.kill("SIGKILL");
  }

  process.exit(exitCode);
}

main();
