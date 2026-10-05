/**
 * Sobe os crons do sicaf-agent junto com o servidor de produção. Sem isso eles só
 * iniciam na primeira requisição à API — após um restart do PM2 as filas ficariam paradas.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NODE_ENV !== "production" || process.env.VERCEL) return;
    if (process.env.NEXT_PHASE === "phase-production-build") return;
    try {
      const { initSicafAgentModules } = await import("@/modules/sicaf-assistant/legacy-bridge");
      await initSicafAgentModules();
    } catch (error) {
      console.error("[instrumentation] Falha ao iniciar módulos do sicaf-agent:", error);
    }
  }
}
