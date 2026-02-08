#!/usr/bin/env node
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
let port = "5173";

const portIdx = args.indexOf("--port");
if (portIdx !== -1 && args[portIdx + 1]) {
  port = args[portIdx + 1];
  args.splice(portIdx, 2);
}

process.env.VITE_PORT = port;

const configOverride = JSON.stringify({
  build: { devUrl: `http://localhost:${port}` },
});

const child = spawn("bunx", ["tauri", "dev", "--config", configOverride, ...args], {
  stdio: "inherit",
  env: process.env,
});

child.on("close", (code) => process.exit(code ?? 0));
