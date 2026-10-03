import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CaptacaoService = {
  registrarClique: (opts: {
    id: string | null;
    url: string | null;
    token: string | null;
  }) => Promise<{ ok: boolean; destino: string }>;
};

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  let destino = process.env.APP_URL || "https://app.cadbrasil.com.br";
  try {
    const svc = await getSicafAgentModule<CaptacaoService>("services/servicos-captacao.service");
    const result = await svc.registrarClique({ id: q.get("i"), url: q.get("u"), token: q.get("t") });
    destino = result.destino;
  } catch {
    // Em caso de falha, segue para o portal.
  }
  return new Response(null, { status: 302, headers: { Location: destino, "Cache-Control": "no-store" } });
}
