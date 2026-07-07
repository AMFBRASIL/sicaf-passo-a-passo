/**
 * Entry point para PM2 / aaPanel (frontend).
 * Run Directory: raiz do repositório
 * Startup File: server.cjs
 */
"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const entry = path.join(__dirname, ".output/server/index.mjs");
const publicAssetsDir = path.join(__dirname, ".output/public/assets");

function countAssetFiles(dir) {
  try {
    return fs.readdirSync(dir).filter((name) => /\.(js|css|mjs)$/i.test(name)).length;
  } catch {
    return 0;
  }
}

if (!fs.existsSync(entry)) {
  console.error(
    "[cadbrasil-frontend] Build não encontrado. Rode na raiz:\n" +
      "  npm install\n" +
      "  npm run build\n" +
      "O arquivo esperado é .output/server/index.mjs",
  );
  process.exit(1);
}

const assetCount = countAssetFiles(publicAssetsDir);
if (assetCount < 5) {
  console.error(
    "[cadbrasil-frontend] Build incompleto: .output/public/assets está ausente ou vazio.\n" +
      "  cd /www/wwwroot/sicaf-passo-a-passo\n" +
      "  npm install && npm run build\n" +
      "  sudo -u www pm2 restart FornecedorFrontend --update-env",
  );
  process.exit(1);
}

const port = process.env.PORT || "3000";
const child = spawn(process.execPath, [entry], {
  cwd: __dirname,
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: port,
    NODE_ENV: process.env.NODE_ENV || "production",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`[cadbrasil-frontend] Encerrado por sinal: ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});

child.on("error", (err) => {
  console.error("[cadbrasil-frontend] Falha ao iniciar:", err);
  process.exit(1);
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
