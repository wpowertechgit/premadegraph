const fs = require("fs");
const path = require("path");
const { execFile, spawn } = require("child_process");

const rustProjectDir = path.resolve(__dirname, "..", "pathfinder-rust");
const DEFAULT_MAX_BUFFER = 64 * 1024 * 1024;

let daemonState = null;
let nextRequestId = 1;

function buildEnv(envOverrides = {}) {
  return {
    ...process.env,
    ...envOverrides,
  };
}

function buildEnvKey(envOverrides = {}) {
  const entries = Object.entries(envOverrides)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify(entries);
}

function resolveMaxBuffer() {
  const parsed = Number(process.env.PATHFINDER_RUST_MAX_BUFFER || "");
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_MAX_BUFFER;
}

function getRustBinaryCandidates() {
  return [
    process.env.PATHFINDER_RUST_BIN,
    path.join(rustProjectDir, "target", "release", "pathfinder_rust.exe"),
    path.join(rustProjectDir, "target", "debug", "pathfinder_rust.exe"),
    path.join(rustProjectDir, "target", "release", "pathfinder_rust"),
    path.join(rustProjectDir, "target", "debug", "pathfinder_rust"),
  ].filter(Boolean);
}

function resolveRustExecutable() {
  for (const candidate of getRustBinaryCandidates()) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function shutdownDaemon() {
  if (!daemonState?.child || daemonState.child.killed) {
    daemonState = null;
    return;
  }

  const activeState = daemonState;
  daemonState = null;
  const error = new Error("Rust daemon reset due to dataset/runtime change.");
  for (const entry of activeState.pending.values()) {
    entry.reject(error);
  }
  activeState.pending.clear();
  activeState.child.kill();
}

function ensureDaemon(envOverrides = {}) {
  const envKey = buildEnvKey(envOverrides);
  if (daemonState?.child && !daemonState.child.killed) {
    if (daemonState.envKey === envKey) {
      return daemonState;
    }
    shutdownDaemon();
  }

  const executable = resolveRustExecutable();
  if (!executable) {
    throw new Error(
      "Rust pathfinder binary not found. Build backend/pathfinder-rust first or set PATHFINDER_RUST_BIN.",
    );
  }

  const child = spawn(executable, ["serve"], {
    cwd: rustProjectDir,
    env: buildEnv(envOverrides),
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const pending = new Map();
  let stdoutBuffer = "";

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    let newlineIndex = stdoutBuffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = stdoutBuffer.slice(0, newlineIndex).trim();
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
      if (line) {
        handleDaemonLine(pending, line);
      }
      newlineIndex = stdoutBuffer.indexOf("\n");
    }
  });

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    const text = chunk.trim();
    if (text) {
      console.log(`[rustBridge][daemon][stderr] ${text}`);
    }
  });

  child.on("exit", (code, signal) => {
    const error = new Error(`Rust daemon exited unexpectedly (code=${code ?? "null"}, signal=${signal ?? "null"}).`);
    for (const entry of pending.values()) {
      entry.reject(error);
    }
    pending.clear();
    daemonState = null;
  });

  child.on("error", (error) => {
    for (const entry of pending.values()) {
      entry.reject(error);
    }
    pending.clear();
    daemonState = null;
  });

  daemonState = { child, pending, envKey };
  return daemonState;
}

function handleDaemonLine(pending, line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch (error) {
    console.error(`[rustBridge][daemon] invalid JSON line: ${line}`);
    return;
  }

  const request = pending.get(message.id);
  if (!request) {
    return;
  }
  pending.delete(message.id);

  if (!message.ok) {
    request.reject(new Error(message.error || "Rust daemon command failed."));
    return;
  }

  request.resolve(message.result);
}

function executeRustProcess(command, payload, { parseJson = true, envOverrides = {} } = {}) {
  const executable = resolveRustExecutable();

  if (!executable) {
    return Promise.reject(
      new Error(
        "Rust pathfinder binary not found. Build backend/pathfinder-rust first or set PATHFINDER_RUST_BIN.",
      ),
    );
  }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    console.log(
      `[rustBridge] starting command="${command}" parseJson=${parseJson} executable="${executable}"`,
    );
    const child = execFile(
      executable,
      [command],
      {
        cwd: rustProjectDir,
        env: buildEnv(envOverrides),
        windowsHide: true,
        maxBuffer: resolveMaxBuffer(),
      },
      (error, stdout, stderr) => {
        const elapsedMs = Date.now() - startedAt;
        if (error) {
          console.error(
            `[rustBridge] command="${command}" failed after ${elapsedMs}ms: ${stderr?.trim() || error.message}`,
          );
          reject(new Error(stderr?.trim() || error.message || "Rust pathfinder command failed."));
          return;
        }

        if (stderr?.trim()) {
          console.log(`[rustBridge][stderr][${command}] ${stderr.trim()}`);
        }

        console.log(
          `[rustBridge] command="${command}" completed in ${elapsedMs}ms stdoutBytes=${Buffer.byteLength(stdout || "", "utf8")}`,
        );

        if (!parseJson) {
          resolve(stdout);
          return;
        }

        try {
          resolve(JSON.parse(stdout));
        } catch (parseError) {
          reject(new Error(`Rust pathfinder returned invalid JSON: ${parseError.message}`));
        }
      },
    );

    if (payload !== undefined) {
      child.stdin.write(JSON.stringify(payload));
    }
    child.stdin.end();
  });
}

function executeRustCommand(command, payload, envOverrides = {}) {
  if (command === "birdseye-3d-export") {
    return executeRustProcess(command, payload, { parseJson: true, envOverrides });
  }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const daemon = ensureDaemon(envOverrides);
    const id = nextRequestId++;
    daemon.pending.set(id, {
      resolve: (result) => {
        const elapsedMs = Date.now() - startedAt;
        console.log(
          `[rustBridge][daemon] command="${command}" completed in ${elapsedMs}ms`,
        );
        resolve(result);
      },
      reject: (error) => {
        const elapsedMs = Date.now() - startedAt;
        console.error(
          `[rustBridge][daemon] command="${command}" failed after ${elapsedMs}ms: ${error.message}`,
        );
        reject(error);
      },
    });

    daemon.child.stdin.write(`${JSON.stringify({ id, command, payload: payload ?? null })}\n`);
  });
}

function executeRustCommandRaw(command, payload, envOverrides = {}) {
  return executeRustProcess(command, payload, { parseJson: false, envOverrides });
}

module.exports = {
  executeRustCommand,
  executeRustCommandRaw,
  shutdownDaemon,
};
