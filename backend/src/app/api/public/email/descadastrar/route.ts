import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CaptacaoService = {
  descadastrar: (opts: {
    email: string | null;
    token: string | null;
  }) => Promise<{ ok: boolean; email?: string; error?: string }>;
};

function esc(v: string) {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function pagina(titulo: string, texto: string, ok: boolean) {
  const cor = ok ? "#047857" : "#b91c1c";
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(titulo)} · CADBRASIL</title></head>
<body style="margin:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:520px;margin:60px auto;background:#fff;border:1px solid #dbe3ec;border-radius:10px;overflow:hidden">
<div style="background:#0f2f52;color:#fff;padding:18px 26px;font-weight:800;letter-spacing:.02em">CADBRASIL</div>
<div style="height:4px;background:${cor}"></div>
<div style="padding:28px 26px">
<h1 style="margin:0 0 12px;font-size:20px;color:#0f172a">${esc(titulo)}</h1>
<p style="margin:0;font-size:15px;line-height:1.7;color:#334155">${texto}</p>
</div></div></body></html>`;
}

async function processar(request: Request) {
  const q = new URL(request.url).searchParams;
  try {
    const svc = await getSicafAgentModule<CaptacaoService>("services/servicos-captacao.service");
    const result = await svc.descadastrar({ email: q.get("e"), token: q.get("t") });
    if (result.ok) {
      return pagina(
        "Pronto, você foi descadastrado",
        `O e-mail <strong>${esc(result.email || "")}</strong> não receberá mais ofertas da CADBRASIL. Avisos importantes sobre os serviços contratados (pagamentos, prazos e documentos) continuam sendo enviados normalmente.`,
        true,
      );
    }
    return pagina("Link inválido", "Não conseguimos confirmar este link. Fale com a nossa equipe pelo portal.", false);
  } catch {
    return pagina("Algo deu errado", "Tente novamente em alguns minutos.", false);
  }
}

export async function GET(request: Request) {
  return new Response(await processar(request), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  return new Response(await processar(request), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
