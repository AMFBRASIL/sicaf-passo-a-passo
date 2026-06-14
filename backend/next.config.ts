import path from "node:path";
import { createRequire } from "node:module";
import type { NextConfig } from "next";

const require = createRequire(import.meta.url);
const { SICAF_RUNTIME_PACKAGES, runtimePackageGlobs } = require("./lib/sicaf-runtime-packages.cjs");

/** Pacotes carregados em runtime pelo sicaf-agent (require dinâmico via sicaf-bridge). */
const sicafTraceIncludes = [
  "./sicaf-agent/**/*",
  "./lib/sicaf-bridge.cjs",
  "./lib/sicaf-runtime-packages.cjs",
  ...runtimePackageGlobs(),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname),
  // sicaf-agent + deps npm — carregados em runtime via sicaf-bridge.cjs (require dinâmico).
  outputFileTracingIncludes: {
    "/**": sicafTraceIncludes,
    "/api/**": sicafTraceIncludes,
  },
  serverExternalPackages: [
    ...SICAF_RUNTIME_PACKAGES,
    "pino",
    "pino-pretty",
    "thread-stream",
    "puppeteer",
    "puppeteer-extra",
    "puppeteer-extra-plugin-stealth",
  ],
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
