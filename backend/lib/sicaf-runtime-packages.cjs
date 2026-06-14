/**
 * Pacotes npm carregados em runtime pelo sicaf-agent na Vercel.
 * Manter sincronizado: next.config.ts (tracing) + sicaf-bridge.cjs (preload).
 */
"use strict";

/** Dependências diretas do sicaf-agent */
const SICAF_DIRECT_PACKAGES = [
  "dotenv",
  "knex",
  "mysql2",
  "bcryptjs",
  "nodemailer",
  "sanitize-html",
  "pdf-parse",
  "openai",
  "multer",
  "node-forge",
  "sdk-node-apis-efi",
  "@aws-sdk/client-s3",
];

/** Transitive deps do knex — obrigatórias em serverless (file tracing) */
const KNEX_TRANSITIVE_PACKAGES = [
  "tarn",
  "colorette",
  "get-package-type",
  "getopts",
  "interpret",
  "lodash",
  "pg-connection-string",
  "rechoir",
  "resolve-from",
  "tildify",
  "debug",
  "escalade",
];

const SICAF_RUNTIME_PACKAGES = [...SICAF_DIRECT_PACKAGES, ...KNEX_TRANSITIVE_PACKAGES];

function preloadRuntimePackages() {
  for (const pkg of SICAF_RUNTIME_PACKAGES) {
    try {
      require(pkg);
    } catch (_) {
      /* pacote opcional para algumas rotas */
    }
  }
}

function runtimePackageGlobs() {
  return SICAF_RUNTIME_PACKAGES.map((pkg) => `./node_modules/${pkg}/**/*`);
}

module.exports = {
  SICAF_DIRECT_PACKAGES,
  KNEX_TRANSITIVE_PACKAGES,
  SICAF_RUNTIME_PACKAGES,
  preloadRuntimePackages,
  runtimePackageGlobs,
};
