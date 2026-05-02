import react from "@vitejs/plugin-react-swc";
import { spawn } from "node:child_process";
import { defineConfig, type Plugin } from "vite";
import { projectRoot, syncDocumentation } from "./scripts/sync-documentation.mjs";

function runTectonicCompile() {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn("tectonic", ["-c", "minimal", "docs/mainraw.tex"], {
      cwd: projectRoot,
      windowsHide: true,
      shell: false,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const error = new Error(`tectonic exited with code ${code}`);
      Object.assign(error, { stdout, stderr });
      reject(error);
    });
  });
}

function documentationSyncPlugin(): Plugin {
  return {
    name: "premadegraph-documentation-sync",
    configureServer(server) {
      server.middlewares.use("/__documentation-sync", (req, res) => {
        if (req.method !== "POST" && req.method !== "GET") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }

        try {
          const manifest = syncDocumentation();
          if (!manifest.documents.length) {
            throw new Error("Documentation sync produced an empty manifest.");
          }
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify({ ok: true, ...manifest }));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({
            ok: false,
            error: error instanceof Error ? error.message : "Documentation sync failed.",
          }));
        }
      });

      server.middlewares.use("/__documentation-compile-thesis", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }

        try {
          const compile = await runTectonicCompile();
          const manifest = syncDocumentation();
          if (!manifest.documents.length) {
            throw new Error("Documentation sync produced an empty manifest.");
          }
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify({
            ok: true,
            compile,
            ...manifest,
          }));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({
            ok: false,
            error: error instanceof Error ? error.message : "Thesis compile failed.",
            stdout: typeof error === "object" && error && "stdout" in error ? error.stdout : "",
            stderr: typeof error === "object" && error && "stderr" in error ? error.stderr : "",
          }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), documentationSyncPlugin()],
});
