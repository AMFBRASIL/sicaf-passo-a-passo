import { apiFetch } from "@/lib/api-fetch";

export type NfsePainelIndicadores = {
  total: number;
  autorizadas: number;
  canceladas: number;
  rejeitadas: number;
  pendentes: number;
  valorAutorizado: number;
  valorCancelado: number;
};

export type NfsePainelEmissao = {
  id: number;
  clienteId: number | null;
  clienteRazao?: string | null;
  clienteDocumento?: string | null;
  clienteEmail?: string | null;
  ambiente?: string | null;
  status: string;
  chaveAcesso?: string | null;
  serie?: string | null;
  numeroDps?: string | null;
  valor?: number | null;
  tomadorDoc?: string | null;
  tomadorNome?: string | null;
  descricao?: string | null;
  pagamentoId?: number | null;
  origem?: string | null;
  xmlUrl?: string | null;
  pdfUrl?: string | null;
  emailEnviadoEm?: string | null;
  erro?: string | null;
  createdAt?: string | null;
  podeCancelar?: boolean;
};

export type NfsePainelSerie = {
  d: string;
  label: string;
  qtd: number;
  valor: number;
};

export async function fetchAdminFiscalPainel(opts?: {
  page?: number;
  pageSize?: number;
  status?: string;
  q?: string;
}) {
  const qs = new URLSearchParams();
  if (opts?.page) qs.set("page", String(opts.page));
  if (opts?.pageSize) qs.set("pageSize", String(opts.pageSize));
  if (opts?.status) qs.set("status", opts.status);
  if (opts?.q) qs.set("q", opts.q);
  const q = qs.toString();
  const res = await apiFetch(`/api/admin/nfse/painel${q ? `?${q}` : ""}`);
  return res.json() as Promise<{
    ok: boolean;
    error?: string;
    ambiente?: string;
    indicadores?: NfsePainelIndicadores;
    serie?: NfsePainelSerie[];
    pagination?: { page: number; pageSize: number; total: number; totalPages: number };
    emissoes?: NfsePainelEmissao[];
  }>;
}

export async function cancelarAdminFiscal(input: {
  emissaoId: number;
  clienteId: number;
  motivo?: string;
}) {
  const res = await apiFetch("/api/admin/nfse/painel", {
    method: "POST",
    body: JSON.stringify({ acao: "cancelar", ...input }),
  });
  return res.json() as Promise<{
    ok: boolean;
    error?: string;
    message?: string;
    alreadyCancelled?: boolean;
  }>;
}

export function adminFiscalArquivoUrl(
  emissaoId: number,
  tipo: "pdf" | "xml",
  opts?: { clienteId?: number | null; inline?: boolean },
) {
  const qs = new URLSearchParams({ emissaoId: String(emissaoId), tipo });
  if (opts?.clienteId) qs.set("clienteId", String(opts.clienteId));
  if (opts?.inline) qs.set("inline", "1");
  return `/api/admin/nfse/painel?${qs.toString()}`;
}

export function formatMoneyBr(v?: number | null) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDocBr(doc?: string | null) {
  const d = String(doc || "").replace(/\D/g, "");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return doc || "—";
}

export function formatDateTimeBr(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
