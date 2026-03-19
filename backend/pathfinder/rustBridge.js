const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const rustProjectDir = path.resolve(__dirname, "..", "pathfinder-rust");
const DEFAULT_MAX_BUFFER = 64 * 1024 * 1024;

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

function resolveRustCommand(command) {
  for (const candidate of getRustBinaryCandidates()) {
    if (fs.existsSync(candidate)) {
      return {
        executable: candidate,
        args: [command],
      };
    }
  }

  return null;
}

function executeRustProcess(command, payload, { parseJson = true } = {}) {
  const resolved = resolveRustCommand(command);

  if (!resolved) {
    return Promise.reject(
      new Error(
        "Rust pathfinder binary not found. Build backend/pathfinder-rust first or set PATHFINDER_RUST_BIN.",
      ),
    );
  }

  return new Promise((resolve, reject) => {
    const child = execFile(
      resolved.executable,
      resolved.args,
      {
        cwd: rustProjectDir,
        windowsHide: true,
        maxBuffer: resolveMaxBuffer(),
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr?.trim() || error.message || "Rust pathfinder command failed."));
          return;
        }

        if (stderr?.trim()) {
          console.log(stderr.trim());
        }

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

function executeRustCommand(command, payload) {
  return executeRustProcess(command, payload, { parseJson: true });
}

function executeRustCommandRaw(command, payload) {
  return executeRustProcess(command, payload, { parseJson: false });
}

module.exports = {
  executeRustCommand,
  executeRustCommandRaw,
};
