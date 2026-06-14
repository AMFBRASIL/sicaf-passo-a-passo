/**
 * Pacotes npm carregados em runtime pelo sicaf-agent na Vercel (exceto DB — ver sicaf-db.bundle.cjs).
 */
"use strict";

/** Dependências diretas do sicaf-agent (sem knex/mysql2 — empacotados em sicaf-db.bundle.cjs) */
const SICAF_DIRECT_PACKAGES = [
  "dotenv",
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

const SICAF_RUNTIME_PACKAGES = [...SICAF_DIRECT_PACKAGES];

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
  return [
    "./lib/sicaf-db.bundle.cjs",
    ...SICAF_RUNTIME_PACKAGES.map((pkg) => `./node_modules/${pkg}/**/*`),
  ];
}

module.exports = {
  SICAF_DIRECT_PACKAGES,
  SICAF_RUNTIME_PACKAGES,
  preloadRuntimePackages,
  runtimePackageGlobs,
};
