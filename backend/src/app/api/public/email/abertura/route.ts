import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CaptacaoService = {
  registrarAbertura: (opts: { id: string | null; token: string | null }) => Promise<unknown>;
};

const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  try {
    const svc = await getSicafAgentModule<CaptacaoService>("services/servicos-captacao.service");
    await svc.registrarAbertura({ id: q.get("i"), token: q.get("t") });
  } catch {
    // O pixel sempre responde, mesmo se o registro falhar.
  }
  return new Response(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  });
}
