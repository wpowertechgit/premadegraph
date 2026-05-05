const DESKTOP_V1 = {
  version: 1,
  basePath: "/api/neurosim/desktop/v1",
  framesPath: "/api/neurosim/desktop/v1/frames",
  statusPath: "/api/neurosim/desktop/v1/status",
  controlPath: "/api/neurosim/desktop/v1/control",
  rustFramesPath: "/ws/desktop/v1/frames",
  rustStatusPath: "/api/desktop/v1/status",
  rustControlPath: "/api/desktop/v1/control",
  allowedCommands: new Set(["pause", "resume", "step-tick"]),
};

function normalizePath(url) {
  return new URL(url, "http://localhost").pathname;
}

function resolveDesktopUpstream(url) {
  const pathname = normalizePath(url);

  if (pathname === DESKTOP_V1.framesPath) {
    return DESKTOP_V1.rustFramesPath;
  }

  if (pathname === DESKTOP_V1.statusPath) {
    return DESKTOP_V1.rustStatusPath;
  }

  const controlPrefix = `${DESKTOP_V1.controlPath}/`;
  if (pathname.startsWith(controlPrefix)) {
    const command = pathname.slice(controlPrefix.length);
    if (!DESKTOP_V1.allowedCommands.has(command)) {
      return null;
    }

    return `${DESKTOP_V1.rustControlPath}/${command}`;
  }

  return null;
}

function buildDesktopHandshake(host, protocol = "http") {
  const httpProtocol = protocol === "https" ? "https" : "http";
  const wsProtocol = httpProtocol === "https" ? "wss" : "ws";

  return {
    protocol: "tribal-neurosim-desktop",
    version: DESKTOP_V1.version,
    role: {
      monogame: "desktop-client",
      node: "middleman",
      rust: "simulation-backend",
    },
    endpoints: {
      handshake: `${httpProtocol}://${host}${DESKTOP_V1.basePath}/handshake`,
      framesWs: `${wsProtocol}://${host}${DESKTOP_V1.framesPath}`,
      status: `${httpProtocol}://${host}${DESKTOP_V1.statusPath}`,
      control: {
        pause: `${httpProtocol}://${host}${DESKTOP_V1.controlPath}/pause`,
        resume: `${httpProtocol}://${host}${DESKTOP_V1.controlPath}/resume`,
        stepTick: `${httpProtocol}://${host}${DESKTOP_V1.controlPath}/step-tick`,
      },
    },
    frame: {
      magic: "TNS3",
      endian: "little",
      version: DESKTOP_V1.version,
      headerBytes: 32,
      payloadKind: "tribal-legacy-v0",
      payload: "Existing Rust tribal binary frame, wrapped for desktop versioning.",
      futureMetadataSlots: [
        "biome ids",
        "polity tiers",
        "settlement visual ids",
        "faction insignia ids",
        "event icon types",
        "artifact ids",
      ],
    },
    commands: ["pause", "resume", "step-tick", "status"],
  };
}

module.exports = {
  DESKTOP_V1,
  resolveDesktopUpstream,
  buildDesktopHandshake,
};
