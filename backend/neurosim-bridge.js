const fs = require("fs");
const path = require("path");
const http = require("http");
const net = require("net");
const { spawn } = require("child_process");

const NEUROSIM_PORT = Number(process.env.NEUROSIM_PORT || 8000);
const NEUROSIM_HOST = process.env.NEUROSIM_HOST || "127.0.0.1";
// When NEUROSIM_HOST is set to a remote host (e.g. Docker service name), skip spawning.
const NEUROSIM_MANAGED = !!process.env.NEUROSIM_HOST;
const rustProjectDir = path.resolve(__dirname, "genetic-neurosim", "backend");

let neurosimProcess = null;

function resolveNeurosimBinary() {
  const candidates = [
    process.env.NEUROSIM_RUST_BIN,
    path.join(rustProjectDir, "target", "release", "neurosim-backend.exe"),
    path.join(rustProjectDir, "target", "debug", "neurosim-backend.exe"),
    path.join(rustProjectDir, "target", "release", "neurosim-backend"),
    path.join(rustProjectDir, "target", "debug", "neurosim-backend"),
  ].filter(Boolean).filter(fs.existsSync);

  if (candidates.length === 0) return null;

  return candidates
    .map(p => ({ path: p, mtimeMs: fs.statSync(p).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0].path;
}

function startNeurosimBackend(envOverrides = {}) {
  if (NEUROSIM_MANAGED) {
    console.log(`[neurosim-bridge] managed mode — expecting neurosim at ${NEUROSIM_HOST}:${NEUROSIM_PORT}`);
    return true;
  }
  const binary = resolveNeurosimBinary();
  if (!binary) {
    console.warn("[neurosim-bridge] Binary not found. Build backend/genetic-neurosim/backend first.");
    return false;
  }
  if (neurosimProcess && !neurosimProcess.killed) {
    return true;
  }
  neurosimProcess = spawn(binary, [], {
    cwd: rustProjectDir,
    env: { ...process.env, ...envOverrides },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  neurosimProcess.stdout.on("data", chunk => {
    const text = chunk.toString().trim();
    if (text) console.log(`[neurosim] ${text}`);
  });
  neurosimProcess.stderr.on("data", chunk => {
    const text = chunk.toString().trim();
    if (text) console.log(`[neurosim][err] ${text}`);
  });
  neurosimProcess.on("exit", (code, signal) => {
    console.log(`[neurosim-bridge] process exited code=${code} signal=${signal}`);
    neurosimProcess = null;
  });
  console.log(`[neurosim-bridge] started: ${binary}`);
  return true;
}

function stopNeurosimBackend() {
  if (neurosimProcess && !neurosimProcess.killed) {
    neurosimProcess.kill();
    neurosimProcess = null;
  }
}

/**
 * Proxy an HTTP request to the neurosim Rust backend.
 * Strip the /api/neurosim prefix before forwarding.
 */
function proxyHttp(req, res, pathPrefix = "/api/neurosim") {
  const upstreamPath = req.url.replace(pathPrefix, "") || "/";
  const options = {
    hostname: NEUROSIM_HOST,
    port: NEUROSIM_PORT,
    path: upstreamPath,
    method: req.method,
    headers: { ...req.headers, host: `${NEUROSIM_HOST}:${NEUROSIM_PORT}` },
  };

  const upstream = http.request(options, upstreamRes => {
    res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
    upstreamRes.pipe(res, { end: true });
  });

  upstream.on("error", err => {
    if (!res.headersSent) {
      res.writeHead(502);
      res.end(`[neurosim-bridge] upstream error: ${err.message}`);
    }
  });

  req.pipe(upstream, { end: true });
}

/**
 * Proxy a WebSocket upgrade to the neurosim Rust backend via raw TCP tunnel.
 * Call this from your HTTP server's 'upgrade' event for neurosim WS paths.
 */
function proxyWebSocket(req, clientSocket, head, upstreamPath = "/ws/tribal-simulation") {
  const upstream = net.createConnection(NEUROSIM_PORT, NEUROSIM_HOST);

  upstream.on("error", err => {
    console.error(`[neurosim-bridge][ws-proxy] upstream error: ${err.message}`);
    clientSocket.destroy();
  });

  clientSocket.on("error", () => upstream.destroy());

  upstream.once("connect", () => {
    // Replay the upgrade request to the upstream
    const headers = [
      `${req.method} ${upstreamPath} HTTP/1.1`,
      `Host: ${NEUROSIM_HOST}:${NEUROSIM_PORT}`,
      `Upgrade: websocket`,
      `Connection: Upgrade`,
    ];
    // Copy relevant WS headers
    for (const key of ["sec-websocket-key", "sec-websocket-version", "sec-websocket-extensions", "sec-websocket-protocol"]) {
      if (req.headers[key]) headers.push(`${key}: ${req.headers[key]}`);
    }
    headers.push("\r\n");
    upstream.write(headers.join("\r\n"));
    if (head && head.length) upstream.write(head);

    upstream.pipe(clientSocket);
    clientSocket.pipe(upstream);
  });
}

function triggerNeurosimRefresh() {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: NEUROSIM_HOST, port: NEUROSIM_PORT, path: "/api/config/refresh", method: "POST" },
      (res) => {
        res.resume();
        res.on("end", () => {
          console.log(`[neurosim-bridge] cluster refresh triggered (status ${res.statusCode})`);
          resolve();
        });
      },
    );
    req.on("error", (err) => {
      console.warn(`[neurosim-bridge] refresh failed: ${err.message}`);
      resolve();
    });
    req.end();
  });
}

module.exports = {
  startNeurosimBackend,
  stopNeurosimBackend,
  proxyHttp,
  proxyWebSocket,
  resolveNeurosimBinary,
  triggerNeurosimRefresh,
};
