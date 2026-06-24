import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EXT = new Set(["pdf", "png", "jpg", "jpeg", "webp", "gif"]);
const MAX_MB = 10;

type StorageService = {
  adaptWebRequest: (request: Request) => { protocol: string; get: (name: string) => string } | null;
  fileFromBuffer: (input: {
    buffer: Buffer;
    originalName: string;
    mimetype: string;
  }) => {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
    path: null;
  };
  uploadFile: (
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
      path: null;
    },
    req: { protocol: string; get: (name: string) => string } | null,
    folder: string,
  ) => Promise<{ fullUrl?: string; url?: string; originalName?: string }>;
};

type PagamentoComprovanteService = {
  autorizarComComprovante: (opts: {
    taxaId: number;
    pagamentoId?: number;
    clienteId: number;
    formaPagamento?: string;
    valor?: number;
    arquivoUrl: string;
    arquivoNome?: string;
    arquivoTipo?: string;
    arquivoTamanhoBytes?: number;
    observacoes?: string;
    autorizadoPor?: number;
  }) => Promise<{
    ok: boolean;
    error?: string;
    message?: string;
    comprovanteId?: number;
    novaValidade?: string;
    diasValidade?: number;
    emailNotificacao?: {
      enviado: boolean;
      simulado?: boolean;
      motivo?: string;
      erro?: string;
    };
  }>;
};

export async function POST(request: Request) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const formData = await request.formData();

    const taxaId = parseInt(String(formData.get("taxaId") || ""), 10);
    const clienteId = parseInt(String(formData.get("clienteId") || ""), 10);
    const pagamentoIdRaw = formData.get("pagamentoId");
    const pagamentoId = pagamentoIdRaw ? parseInt(String(pagamentoIdRaw), 10) : undefined;
    const formaPagamento = formData.get("formaPagamento")
      ? String(formData.get("formaPagamento"))
      : undefined;
    const valorRaw = formData.get("valor");
    const valor = valorRaw ? parseFloat(String(valorRaw)) : undefined;
    const observacoes = formData.get("observacoes")
      ? String(formData.get("observacoes")).trim()
      : undefined;

    if (!Number.isFinite(taxaId) || taxaId <= 0) {
      return NextResponse.json({ ok: false, error: "taxaId é obrigatório" }, { status: 400 });
    }
    if (!Number.isFinite(clienteId) || clienteId <= 0) {
      return NextResponse.json({ ok: false, error: "clienteId é obrigatório" }, { status: 400 });
    }

    const comprovante = formData.get("comprovante") ?? formData.get("file");
    if (!comprovante || !(comprovante instanceof Blob)) {
      return NextResponse.json(
        { ok: false, error: "Comprovante de pagamento é obrigatório" },
        { status: 400 },
      );
    }

    const originalName =
      comprovante instanceof File && comprovante.name ? comprovante.name : "comprovante";
    const ext = originalName.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json(
        { ok: false, error: "Formato inválido. Envie PDF ou imagem (PNG, JPG, WEBP)." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await comprovante.arrayBuffer());
    if (buffer.length > MAX_MB * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: `Arquivo muito grande. Máximo ${MAX_MB} MB.` },
        { status: 400 },
      );
    }

    const storage = await getSicafAgentModule<StorageService>("services/storage.service");
    const reqLike = storage.adaptWebRequest(request);
    const multerLike = storage.fileFromBuffer({
      buffer,
      originalName,
      mimetype: comprovante.type || "application/octet-stream",
    });
    const folder = `clientes/${clienteId}/comprovantes-pagamento`;
    const fileResult = await storage.uploadFile(multerLike, reqLike, folder);
    const arquivoUrl = fileResult.fullUrl || fileResult.url;
    if (!arquivoUrl) {
      return NextResponse.json({ ok: false, error: "Falha ao salvar comprovante" }, { status: 500 });
    }

    const svc = await getSicafAgentModule<PagamentoComprovanteService>(
      "services/pagamento-comprovante.service",
    );
    const result = await svc.autorizarComComprovante({
      taxaId,
      pagamentoId: Number.isFinite(pagamentoId) ? pagamentoId : undefined,
      clienteId,
      formaPagamento,
      valor: Number.isFinite(valor) ? valor : undefined,
      arquivoUrl,
      arquivoNome: originalName,
      arquivoTipo: comprovante.type || ext,
      arquivoTamanhoBytes: buffer.length,
      observacoes,
      autorizadoPor: usuarioId,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao autorizar pagamento";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
