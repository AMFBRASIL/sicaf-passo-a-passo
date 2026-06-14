import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname),
  // sicaf-agent é carregado em runtime via sicaf-bridge.cjs (require dinâmico).
  // Na Vercel o file-tracing do Next não o inclui automaticamente — só o bridge.
  outputFileTracingIncludes: {
    "/**": ["./sicaf-agent/**/*", "./lib/sicaf-bridge.cjs"],
    "/api/**": ["./sicaf-agent/**/*", "./lib/sicaf-bridge.cjs"],
  },
  serverExternalPackages: [
    "knex",
    "mysql2",
    "nodemailer",
    "openai",
    "pdf-parse",
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
