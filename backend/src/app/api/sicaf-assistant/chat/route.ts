import { NextResponse } from "next/server";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageContext = {
  url?: string;
  pageText?: string;
  title?: string;
  formData?: string[];
  clientName?: string;
  clientDoc?: string;
  clientRole?: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = String(body.message || "").trim();
    if (!message) {
      return NextResponse.json(
        { ok: false, error: 'Campo "message" é obrigatório' },
        { status: 400 },
      );
    }

    const ctx: PageContext = body.pageContext || {};
    const hasContext = ctx.url && ctx.url.includes("comprasnet");
    const contextParts: string[] = [];

    if (ctx.clientName || ctx.clientDoc) {
      let identity = "CLIENTE QUE ESTÁ NO CHAT AGORA:";
      if (ctx.clientName) identity += "\n  Nome: " + ctx.clientName;
      if (ctx.clientDoc) identity += "\n  CPF/CNPJ: " + ctx.clientDoc;
      if (ctx.clientRole) identity += "\n  Tipo: " + ctx.clientRole;
      contextParts.push(identity);
    }
    if (ctx.pageText) {
      contextParts.push("CONTEÚDO DA TELA DO CLIENTE NO SICAF:\n" + ctx.pageText);
    }
    if (ctx.formData?.length) {
      contextParts.push("CAMPOS PREENCHIDOS NO FORMULÁRIO:\n" + ctx.formData.join("\n"));
    }

    const pageState = {
      step: hasContext ? ctx.title || "sicaf_page" : "extension-chat",
      url: ctx.url || "",
      text: contextParts.join("\n\n"),
    };

    const history = Array.isArray(body.chatHistory) ? body.chatHistory.slice(-20) : [];

    const iaService = await getSicafAgentModule<{
      streamChatEvents: (
        msg: string,
        state: typeof pageState,
        hist: unknown[],
      ) => AsyncGenerator<{ chunk?: string; done?: boolean; fullText?: string; actions?: string[] }>;
    }>("services/ia.service");

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of iaService.streamChatEvents(
            message,
            pageState,
            history,
          )) {
            controller.enqueue(
              encoder.encode("data: " + JSON.stringify(event) + "\n\n"),
            );
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : "Erro interno";
          controller.enqueue(
            encoder.encode(
              "data: " +
                JSON.stringify({ done: true, fullText: "⚠ Erro interno: " + errMsg }) +
                "\n\n",
            ),
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Erro interno";
    console.error("[SicafAssistant:chat]", errMsg);
    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
  }
}
