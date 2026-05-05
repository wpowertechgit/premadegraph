const assert = require("node:assert/strict");
const test = require("node:test");
const {
  DESKTOP_V1,
  resolveDesktopUpstream,
  buildDesktopHandshake,
} = require("./neurosim-desktop-contract");

test("maps desktop websocket route to Rust desktop frame stream", () => {
  assert.equal(
    resolveDesktopUpstream("/api/neurosim/desktop/v1/frames"),
    "/ws/desktop/v1/frames",
  );
});

test("maps desktop control route to Rust control alias", () => {
  assert.equal(
    resolveDesktopUpstream("/api/neurosim/desktop/v1/control/step-tick"),
    "/api/desktop/v1/control/step-tick",
  );
});

test("handshake exposes versioned endpoints and frame envelope", () => {
  const handshake = buildDesktopHandshake("localhost:3001");

  assert.equal(handshake.protocol, "tribal-neurosim-desktop");
  assert.equal(handshake.version, DESKTOP_V1.version);
  assert.equal(handshake.endpoints.framesWs, "ws://localhost:3001/api/neurosim/desktop/v1/frames");
  assert.equal(handshake.frame.magic, "TNS3");
  assert.equal(handshake.frame.headerBytes, 32);
  assert.equal(handshake.frame.payloadKind, "tribal-legacy-v0");
});
