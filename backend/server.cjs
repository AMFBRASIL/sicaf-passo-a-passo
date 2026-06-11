/**
 * Entry point para PM2 / aaPanel.
 * Run Directory: .../backend
 * Startup File: server.cjs
 */
"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");

const port = process.env.PORT || "3001";

let nextCli;
try {
  nextCli = require.resolve("next/dist/bin/next");
} catch {
  console.error(
    "[cadbrasil-backend] Pacote 'next' não encontrado. Rode 'npm install' nesta pasta antes de iniciar.",
  );
  process.exit(1);
}

const child = spawn(process.execPath, [nextCli, "start", "-p", port], {
  cwd: __dirname,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`[cadbrasil-backend] Encerrado por sinal: ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});

child.on("error", (err) => {
  console.error("[cadbrasil-backend] Falha ao iniciar:", err);
  process.exit(1);
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
