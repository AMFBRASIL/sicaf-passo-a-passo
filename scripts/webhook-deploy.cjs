/**
 * Webhook HTTP para GitHub → deploy automático no VPS.
 *
 * 1. cp scripts/deploy.env.example scripts/deploy.env
 * 2. Defina DEPLOY_WEBHOOK_SECRET no deploy.env
 * 3. PM2: node scripts/webhook-deploy.cjs  (ou aaPanel Node project)
 *
 * GitHub → Settings → Webhooks → Add:
 *   Payload URL: https://homolog.cadbrasil.com.br/deploy-hook?secret=SEU_SECRET
 *   Content type: application/json
 *   Events: Just the push event
 */
"use strict";

const http = require("node:http");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const envFile = path.join(__dirname, "deploy.env");

function loadEnvFile() {
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile();

const PORT = Number(process.env.DEPLOY_WEBHOOK_PORT || 9090);
const SECRET = process.env.DEPLOY_WEBHOOK_SECRET || "";
const DEPLOY_SCRIPT = path.join(__dirname, "deploy-vps.sh");
const LOG_FILE = process.env.DEPLOY_LOG || "/www/wwwlogs/cadbrasil-deploy.log";

let deploying = false;

function log(msg) {
  const line = `[${new Date().toISOString()}] [webhook] ${msg}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    const fallback = path.join(__dirname, "deploy-webhook.log");
    try {
      fs.appendFileSync(fallback, line);
    } catch {
      /* ignore */
    }
  }
  console.log(line.trim());
}

function verifyGitHubSignature(body, signature) {
  if (!SECRET || !signature?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("hex");
  const received = signature.slice("sha256=".length);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  } catch {
    return false;
  }
}

function runDeploy(trigger) {
  if (deploying) {
    log(`Deploy já em andamento, ignorando: ${trigger}`);
    return;
  }
  deploying = true;
  log(`Iniciando deploy (${trigger})`);

  const child = spawn("bash", [DEPLOY_SCRIPT], {
    cwd: repoRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (d) => fs.appendFileSync(LOG_FILE, d));
  child.stderr.on("data", (d) => fs.appendFileSync(LOG_FILE, d));

  child.on("close", (code) => {
    deploying = false;
    log(`Deploy finalizado com código ${code ?? 1}`);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, deploying }));
    return;
  }

  if (req.method !== "POST" || url.pathname !== "/deploy-hook") {
    res.writeHead(404).end("not found");
    return;
  }

  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    const querySecret = url.searchParams.get("secret");
    const ghSignature = req.headers["x-hub-signature-256"];

    const authorized =
      (SECRET && querySecret === SECRET) ||
      verifyGitHubSignature(body, ghSignature);

    if (!authorized) {
      log("Requisição não autorizada");
      res.writeHead(403).end("forbidden");
      return;
    }

    let event = "manual";
    try {
      const payload = JSON.parse(body.toString("utf8"));
      if (payload.ref) event = payload.ref;
    } catch {
      /* ignore */
    }

    res.writeHead(202, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, message: "deploy started", ref: event }));

    runDeploy(event);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  log(`Escutando em 127.0.0.1:${PORT} (POST /deploy-hook)`);
});
