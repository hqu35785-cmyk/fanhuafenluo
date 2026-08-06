import http from "node:http";
import { spawn, spawnSync } from "node:child_process";

const ROOT = process.cwd();
const HOST = "127.0.0.1";
const PORT = 4173;
const URL = `http://${HOST}:${PORT}/index.html`;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function requestStatus() {
  return new Promise(resolve => {
    const request = http.get(URL, response => {
      response.resume();
      resolve(response.statusCode || 0);
    });
    request.setTimeout(800, () => {
      request.destroy();
      resolve(0);
    });
    request.on("error", () => resolve(0));
  });
}

async function waitForServer(expectedUp, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const up = (await requestStatus()) === 200;
    if (up === expectedUp) return;
    await sleep(150);
  }
  throw new Error(`server did not become ${expectedUp ? "ready" : "closed"}: ${URL}`);
}

function run(label, args, env = {}) {
  console.log(`\n=== ${label} ===`);
  // Node on Windows rejects spawn of npm.cmd without a shell (EINVAL).
  const result = spawnSync(npmCommand, args, {
    cwd: ROOT,
    env: { ...process.env, TEST_URL: `http://${HOST}:${PORT}`, ...env },
    stdio: "inherit",
    windowsHide: true,
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

async function terminate(server) {
  if (server.exitCode !== null) return;
  server.kill("SIGTERM");

  const deadline = Date.now() + 3_000;
  while (server.exitCode === null && Date.now() < deadline) {
    await sleep(100);
  }

  if (server.exitCode === null) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      server.kill("SIGKILL");
    }
  }
}

async function main() {
  // Refuse to hide an already-running, unrelated process on the test port.
  if ((await requestStatus()) === 200) {
    throw new Error(`port ${PORT} is already serving HTTP; stop the existing process first`);
  }

  const server = spawn(process.execPath, ["scripts/test_server.mjs"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  server.stdout.on("data", chunk => process.stdout.write(`[server] ${chunk}`));
  server.stderr.on("data", chunk => process.stderr.write(`[server] ${chunk}`));

  try {
    await waitForServer(true);

    for (let round = 1; round <= 2; round += 1) {
      console.log(`\n######## CLEAN ROUND ${round}/2 ########`);
      run(`Round ${round}: refactor regression`, ["run", "test:refactor"]);
      run(`Round ${round}: existing cross-browser suite`, ["run", "test:browser"]);
    }

    console.log("\nTwo consecutive complete clean rounds passed.");
  } finally {
    await terminate(server);
    await waitForServer(false, 10_000);
    console.log(`Confirmed: ${HOST}:${PORT} is closed.`);
  }
}

main().catch(error => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
