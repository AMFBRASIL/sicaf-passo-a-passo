import { apiFetch } from "@/lib/api-fetch";
import type { ClienteDetalhe } from "@/components/admin/cliente-detalhe-modal";
import type { ClienteGrupo } from "@/components/admin/cliente-empresas-modal";
import type { NivelStatus } from "@/components/admin/nivel-dots";
import type { NovoClienteData } from "@/components/admin/novo-cliente-modal";
import type { TicketItem } from "@/components/admin/ticket-resposta-modal";
import {
  mapNiveisFromDetail,
  mapNiveisFromEvidencias,
  mapSicafPainelStatus,
  countNiveisValidadosUi,
  todosNiveisValidadosUi,
} from "@/lib/nivel-status";


export type ApiAdminClient = {
  id: number;
  name: string;
  fantasyName?: string;
  documento: string;
  email?: string;
  phone?: string;
  city?: string;
  status?: string;
  activeBids?: number;
  certificates?: number;
  sicafId?: number | null;
  sicafStatus?: string | null;
  sicafValidade?: string | null;
  sicafManutencao?: boolean;
  sicafNiveis?: Record<string, { habilitado?: boolean; status?: string | null }> | null;
  sicafAtivo?: boolean;
  sicafPago?: boolean;
  userId?: number;
  usuarioNome?: string;
  mrr?: number;
  manutencaoAtiva?: boolean;
  pagou?: boolean;
  pagamentoSicafStatus?: string;
  pagamentoSicafDetalhe?: string;
  novo?: boolean;
  plano?: string;
  createdAt?: string;
};

export type ApiAdminGroup = {
  id: string;
  usuarioId?: number;
  nome: string;
  contatoPrincipal: string;
  email?: string;
  telefone?: string;
  cidade?: string;
  desde?: string;
  plano?: string;
  empresas: ApiAdminClient[];
};

function mapNiveisFromSicafNiveisRecord(
  sicafNiveis?: ApiAdminClient["sicafNiveis"],
  sicafStatus?: string | null,
): Record<number, NivelStatus> {
  if (!sicafNiveis || typeof sicafNiveis !== "object") {
    return mapNiveisFromDetail(undefined, { sicaf: mapSicafPainelStatus(sicafStatus) });
  }

  const evidencias = Object.entries(sicafNiveis).map(([nivel, detail]) => ({
    nivel,
    habilitado: Boolean(detail?.habilitado),
    status: detail?.status || undefined,
  }));

  return mapNiveisFromEvidencias(evidencias, { sicaf: mapSicafPainelStatus(sicafStatus) });
}

export function mapNiveisFromApi(
  sicafNiveis?: ApiAdminClient["sicafNiveis"],
  niveisSicaf?: { level: string; status?: string }[],
  opts?: {
    sicafStatus?: string | null;
    niveisDetail?: Record<string, { status: string; observacao?: string }>;
  },
): Record<number, NivelStatus> {
  if (opts?.niveisDetail && Object.keys(opts.niveisDetail).length > 0) {
    return mapNiveisFromDetail(opts.niveisDetail, { sicaf: mapSicafPainelStatus(opts.sicafStatus) });
  }

  if (sicafNiveis && Object.keys(sicafNiveis).length > 0) {
    return mapNiveisFromSicafNiveisRecord(sicafNiveis, opts?.sicafStatus);
  }

  if (niveisSicaf?.length) {
    const evidencias = niveisSicaf.map((n) => {
      const raw = String(n.status || "");
      const s = raw.toLowerCase();
      const habilitado =
        Boolean(raw) &&
        !s.includes("não informado") &&
        !s.includes("nao informado") &&
        !(s.includes("pendente") && !["I", "II", "V", "VI"].includes(n.level));
      return { nivel: n.level, habilitado, status: n.status };
    });
    return mapNiveisFromEvidencias(evidencias, { sicaf: mapSicafPainelStatus(opts?.sicafStatus) });
  }

  return mapNiveisFromDetail(undefined, { sicaf: mapSicafPainelStatus(opts?.sicafStatus) });
}

export function calcCompletudeSicafUi(niveis: Record<number, NivelStatus>): number {
  if (todosNiveisValidadosUi(niveis)) return 100;
  return Math.round((countNiveisValidadosUi(niveis) / 6) * 100);
}

/** APTO = ao menos 1 nível com status real (validado/vencendo/vencido). */
export function isClienteApto(niveis: Record<number, NivelStatus>): boolean {
  return Object.values(niveis).some(
    (s) => s === "validado" || s === "vencendo" || s === "vencido",
  );
}

export function countNiveisAtualizados(niveis: Record<number, NivelStatus>): number {
  return Object.values(niveis).filter(
    (s) => s === "validado" || s === "vencendo" || s === "vencido",
  ).length;
}

function mapSicafUi(status?: string | null): ClienteDetalhe["sicaf"] {
  const s = String(status || "");
  if (s === "Ativo") return "ok";
  if (s === "Vencendo") return "pendente";
  if (s === "Vencido") return "vencido";
  return "pendente";
}

function formatDateBr(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return String(d);
  }
}

export function mapApiClientToDetalhe(c: ApiAdminClient, extra?: Partial<ClienteDetalhe>): ClienteDetalhe {
  const cidade = c.city || extra?.cidade || "—";
  return {
    id: String(c.id),
    razao: c.name,
    cnpj: c.documento,
    responsavel: c.usuarioNome || extra?.responsavel || "—",
    cidade,
    email: c.email,
    telefone: c.phone,
    sicaf: mapSicafUi(c.sicafStatus),
    pagou: !!c.pagou,
    pagamentoSicafStatus: c.pagamentoSicafStatus,
    pagamentoSicafDetalhe: c.pagamentoSicafDetalhe,
    manutencao: c.manutencaoAtiva ?? !!c.sicafManutencao,
    novo: c.novo ?? false,
    mrr: c.mrr ?? 0,
    ultimoContato: extra?.ultimoContato ?? "—",
    niveis: extra?.niveis ?? mapNiveisFromSicafNiveisRecord(c.sicafNiveis, c.sicafStatus),
    plano: c.plano || extra?.plano,
    desde: extra?.desde,
    validadeSicaf: c.sicafValidade ? formatDateBr(c.sicafValidade) : extra?.validadeSicaf,
    ltv: extra?.ltv,
  };
}

export function mapApiGroupToClienteGrupo(g: ApiAdminGroup): ClienteGrupo {
  return {
    id: g.id,
    nome: g.nome,
    contatoPrincipal: g.contatoPrincipal,
    email: g.email,
    telefone: g.telefone,
    cidade: g.cidade,
    desde: g.desde,
    plano: g.plano,
    empresas: g.empresas.map((e) =>
      mapApiClientToDetalhe(e, {
        responsavel: g.contatoPrincipal,
        desde: g.desde,
        plano: e.plano || g.plano,
      }),
    ),
  };
}

export async function fetchAdminGrupo(opts: { grupoId?: string; clienteId?: number }) {
  const params = new URLSearchParams();
  if (opts.grupoId) params.set("grupoId", opts.grupoId);
  if (opts.clienteId) params.set("clienteId", String(opts.clienteId));
  const res = await apiFetch(`/api/admin/clients/grupo?${params.toString()}`);
  return res.json() as Promise<{
    ok: boolean;
    grupo?: ApiAdminGroup;
    error?: string;
  }>;
}

export async function fetchAdminClientes(opts: {
  search?: string;
  page?: number;
  limit?: number;
  status?: string;
  sicaf?: string;
  filtro?: string;
} = {}) {
  const params = new URLSearchParams();
  if (opts.search?.trim()) params.set("search", opts.search.trim());
  if (opts.page) params.set("page", String(opts.page));
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.status && opts.status !== "all") params.set("status", opts.status);
  if (opts.sicaf && opts.sicaf !== "all") params.set("sicaf", opts.sicaf);
  if (opts.filtro && opts.filtro !== "todos") params.set("filtro", opts.filtro);
  const res = await apiFetch(`/api/admin/clients?${params.toString()}`);
  return res.json() as Promise<{
    ok: boolean;
    clients?: ApiAdminClient[];
    groups?: ApiAdminGroup[];
    total?: number;
    totalPages?: number;
    page?: number;
    stats?: {
      totalClientes: number;
      totalCnpjs: number;
      emRisco: number;
      mrr: number;
      ativos?: number;
      sicafPendentes?: number;
    };
    error?: string;
  }>;
}

export async function fetchAdminClienteDetalhe(clienteId: number) {
  const res = await apiFetch(`/api/admin/clients/${clienteId}`);
  return res.json() as Promise<{
    ok: boolean;
    client?: {
      id: number;
      razao_social: string;
      documento: string;
      email?: string;
      telefone?: string;
      cidade?: string;
      estado?: string;
      responsavel_nome?: string;
      observacoes?: string;
      celular?: string;
      created_at?: string;
      usuario_principal?: {
        id?: number;
        nome?: string;
        email?: string;
        telefone?: string;
        status?: string;
      } | null;
      sicaf?: {
        id?: number;
        status?: string;
        data_validade?: string;
        dias_validade?: number;
        credenciamento_anual?: number;
        manutencao_ativa?: number;
      };
      certidoes?: { tipo_nome?: string; data_validade?: string; status?: string; arquivo_url?: string }[];
      historico?: { acao?: string; created_at?: string; usuario_nome?: string }[];
      loginLogs?: { created_at?: string; ip?: string; navegador?: string }[];
      niveisSicaf?: { level: string; status?: string }[];
      niveisDetail?: Record<string, { status: string; observacao?: string }>;
      contacts?: { nome?: string; cargo?: string; email?: string; telefone?: string; principal?: number }[];
    };
    error?: string;
  }>;
}

export async function fetchAdminClienteFinanceiro(clienteId: number) {
  const res = await apiFetch(`/api/admin/clients/${clienteId}/financeiro`);
  return res.json() as Promise<{
    ok: boolean;
    financeiro?: {
      resumo?: {
        totalPagoSicaf?: number;
        totalPagoManutencao?: number;
        totalPendente?: number;
      };
      sicaf?: { pagos?: FaturaApi[]; pendentes?: FaturaApi[] };
      manutencao?: { pagos?: FaturaApi[]; pendentes?: FaturaApi[] };
      personalizados?: FaturaApi[];
      pendencias?: FaturaApi[];
      pagamentosRecentes?: {
        id: number;
        descricao?: string;
        valor?: number;
        status?: string;
        dataVencimento?: string;
        dataPagamento?: string;
        tipo?: string;
      }[];
    };
    error?: string;
  }>;
}

type FaturaApi = {
  id: number;
  tipo?: string;
  descricao?: string;
  valor?: number;
  data_vencimento?: string;
  dataVencimento?: string;
  data_pagamento?: string;
  dataPagamento?: string;
  forma_pagamento?: string;
  formaPagamento?: string;
  status?: string;
  pago?: boolean;
  pendente?: boolean;
  pagamentoId?: number;
  anoReferencia?: number | null;
  created_at?: string | null;
  createdAt?: string | null;
};

function isFaturaManutencao(f: FaturaApi): boolean {
  const tipo = String(f.tipo || "").toLowerCase();
  if (tipo === "manutencao") return true;
  const desc = String(f.descricao || "").trim();
  return /^manuten[cç][aã]o\b/i.test(desc);
}

export type FaturaUi = {
  id: string;
  taxaId: number;
  desc: string;
  valor: number;
  /** Data em que a cobrança foi gerada */
  dataGeracao: string;
  /** Data de vencimento */
  venc: string;
  /** Data em que foi pago (— se em aberto) */
  dataPago: string;
  forma: "Boleto" | "PIX";
  status: "pago" | "aberto" | "cancelado";
  pagamentoId?: number;
  anoReferencia?: number;
};

export function parseTaxaIdFromFaturaId(faturaId: string): number | null {
  const n = parseInt(String(faturaId).replace(/^#/, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Mesma regra do backend: validade SICAF = hoje + 1 ano. */
export function novaValidadeSicafAposPagamento(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toLocaleDateString("pt-BR");
}

export function diasAteNovaValidadeSicaf(): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fim = new Date(hoje);
  fim.setFullYear(fim.getFullYear() + 1);
  return Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

/** Rótulo curto para faturas SICAF na aba Financeiro (ex.: "SICAF 2026"). */
export function simplifyFaturaDescricao(desc: string, anoReferencia?: number | null): string {
  if (anoReferencia != null && Number(anoReferencia) > 0) {
    return `SICAF ${anoReferencia}`;
  }
  const match = String(desc || "").match(/\b(20\d{2})\b/);
  if (match) return `SICAF ${match[1]}`;
  return `SICAF ${new Date().getFullYear()}`;
}

/** Apenas taxas/boletos SICAF — manutenção fica na aba Manutenção. */
export function mapFinanceiroToFaturas(fin: NonNullable<Awaited<ReturnType<typeof fetchAdminClienteFinanceiro>>["financeiro"]>): FaturaUi[] {
  const rows: FaturaApi[] = [...(fin.sicaf?.pendentes || []), ...(fin.sicaf?.pagos || [])].filter(
    (f) => !isFaturaManutencao(f),
  );
  return rows
    .map((f) => {
      const formaRaw = String(f.forma_pagamento ?? f.formaPagamento ?? "").toLowerCase();
      const forma: FaturaUi["forma"] = formaRaw.includes("pix") ? "PIX" : "Boleto";
      return {
        id: f.pagamentoId ? `#P${f.pagamentoId}` : `#${f.id}`,
        taxaId: f.id,
        desc: simplifyFaturaDescricao(f.descricao || "Taxa SICAF", f.anoReferencia),
        valor: Number(f.valor) || 0,
        dataGeracao: formatDateBr(f.createdAt ?? f.created_at),
        venc: formatDateBr(f.data_vencimento ?? f.dataVencimento),
        dataPago: formatDateBr(f.data_pagamento ?? f.dataPagamento),
        forma,
        status: (f.pago || f.status === "pago" || f.status === "Pago"
          ? "pago"
          : f.status === "cancelado" || f.status === "Cancelado"
            ? "cancelado"
            : "aberto") as FaturaUi["status"],
        pagamentoId: f.pagamentoId ?? undefined,
        anoReferencia: f.anoReferencia != null ? Number(f.anoReferencia) : undefined,
      };
    })
    .sort((a, b) => {
      const ta = a.dataGeracao === "—" ? 0 : new Date(a.dataGeracao.split("/").reverse().join("-")).getTime();
      const tb = b.dataGeracao === "—" ? 0 : new Date(b.dataGeracao.split("/").reverse().join("-")).getTime();
      return tb - ta;
    });
}

export async function confirmarPagamentoTaxaSicaf(taxaId: number) {
  const res = await apiFetch("/api/sicaf/confirmar-pagamento", {
    method: "POST",
    body: JSON.stringify({ taxaId }),
  });
  return res.json() as Promise<{
    ok: boolean;
    error?: string;
    message?: string;
    novaValidade?: string;
    diasValidade?: number;
  }>;
}

export async function autorizarPagamentoComComprovante(payload: {
  taxaId: number;
  clienteId: number;
  pagamentoId?: number;
  formaPagamento?: "Boleto" | "PIX";
  valor?: number;
  observacoes?: string;
  comprovante: File;
}) {
  const formData = new FormData();
  formData.append("taxaId", String(payload.taxaId));
  formData.append("clienteId", String(payload.clienteId));
  if (payload.pagamentoId) formData.append("pagamentoId", String(payload.pagamentoId));
  if (payload.formaPagamento) formData.append("formaPagamento", payload.formaPagamento);
  if (payload.valor != null) formData.append("valor", String(payload.valor));
  if (payload.observacoes?.trim()) formData.append("observacoes", payload.observacoes.trim());
  formData.append("comprovante", payload.comprovante);

  const res = await apiFetch("/api/admin/financeiro/autorizar-pagamento", {
    method: "POST",
    body: formData,
  });
  return res.json() as Promise<{
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
      para?: string;
      templateNome?: string;
    };
  }>;
}

export async function fetchAdminTicketsCliente(clienteId: number) {
  const res = await apiFetch(`/api/tickets-admin?clienteId=${clienteId}`);
  return res.json() as Promise<{
    ok: boolean;
    tickets?: {
      id: string;
      title: string;
      status: string;
      priority: string;
      createdAt: string;
    }[];
    error?: string;
  }>;
}

export function mapTicketsToUi(
  tickets: NonNullable<Awaited<ReturnType<typeof fetchAdminTicketsCliente>>["tickets"]>,
): TicketItem[] {
  return tickets.map((t) => ({
    id: t.id,
    titulo: t.title,
    status:
      t.status === "resolvido" || t.status === "fechado"
        ? "Fechado"
        : t.status === "em_andamento"
          ? "Em andamento"
          : "Aguardando cliente",
    prio: t.priority === "alta" ? "alta" : t.priority === "baixa" ? "baixa" : "média",
    data: t.createdAt,
  }));
}

export function mergeDetalheFromApi(
  base: ClienteDetalhe,
  api: NonNullable<Awaited<ReturnType<typeof fetchAdminClienteDetalhe>>["client"]>,
): ClienteDetalhe {
  const cidade = [api.cidade, api.estado].filter(Boolean).join("/") || base.cidade;
  const login = api.usuario_principal?.email || base.login;
  return {
    ...base,
    razao: api.razao_social || base.razao,
    cnpj: api.documento || base.cnpj,
    email: api.email || api.responsavel_email || base.email,
    telefone: api.telefone || api.responsavel_telefone || base.telefone,
    celular: api.celular || base.celular,
    login,
    responsavel: api.responsavel_nome || base.responsavel,
    cidade,
    sicaf: mapSicafUi(api.sicaf?.status),
    manutencao: api.sicaf?.manutencao_ativa === 1,
    validadeSicaf: api.sicaf?.data_validade ? formatDateBr(api.sicaf.data_validade) : base.validadeSicaf,
    niveis: mapNiveisFromApi(undefined, api.niveisSicaf, {
      sicafStatus: api.sicaf?.status,
      niveisDetail: api.niveisDetail,
    }),
    niveisDetail: api.niveisDetail,
  };
}

export type DocumentoUi = {
  nome: string;
  validade: string;
  status: "ok" | "warn" | "danger" | "pendente";
  url?: string;
  nivel?: number;
  origem?: string;
};

export type CertificadoDigitalUi = {
  id: number;
  arquivoNome: string;
  titularNome?: string | null;
  titularDocumento?: string | null;
  emissor?: string | null;
  validoDe?: string | null;
  validoAte?: string | null;
  status: string;
  senha?: string | null;
  armazenamento?: string;
};

export type DocChecklistUi = {
  id: string;
  nome: string;
  status: "ok" | "pendente" | "vencendo" | "vencida";
  validade?: string;
  arquivoUrl?: string | null;
  nivel: number;
};

export type DocumentosPainelUi = {
  sicafStatus?: string;
  docsPorNivel: Record<number, DocChecklistUi[]>;
  certidoes: {
    id: number;
    nome: string;
    validade?: string | null;
    status?: string | null;
    arquivoUrl?: string | null;
    arquivoNome?: string | null;
    nivelSicaf?: string | null;
  }[];
  arquivos: {
    id: number;
    origem: string;
    nome: string;
    pasta?: string;
    validade?: string | null;
    status?: string;
    arquivoUrl?: string | null;
    nivelSicaf?: string | null;
    dataUpload?: string | null;
  }[];
  certificadoDigital: CertificadoDigitalUi | null;
};

export type NotaInternaUi = {
  id: number;
  autor: string;
  data: string;
  texto: string;
};

export async function fetchAdminClienteNotas(clienteId: number): Promise<{
  ok: boolean;
  notas?: NotaInternaUi[];
  error?: string;
}> {
  const res = await apiFetch(`/api/admin/clients/${clienteId}/notas`);
  const data = (await res.json()) as {
    ok: boolean;
    notas?: NotaInternaUi[];
    error?: string;
  };
  return data;
}

export async function criarAdminClienteNota(
  clienteId: number,
  texto: string,
): Promise<{ ok: boolean; nota?: NotaInternaUi; error?: string }> {
  const res = await apiFetch(`/api/admin/clients/${clienteId}/notas`, {
    method: "POST",
    body: JSON.stringify({ texto }),
  });
  const data = (await res.json()) as {
    ok: boolean;
    nota?: NotaInternaUi;
    error?: string;
  };
  return data;
}

export type ClienteTrackingResumo = {
  totalSessoes: number;
  primeiraVisita: string;
  ultimaVisita: string;
  canalPrincipal: string;
  origem: string | null;
  midia: string | null;
  campanha: string | null;
  palavraChave: string | null;
  palavraConvertida: string | null;
  gclid: string | null;
  googleAds: boolean;
  sessoesGoogleAds: number;
  convertido: boolean;
  tipoConversao: string | null;
  valorConversao: number | null;
  conversaoEm: string;
  landingPage: string | null;
  referrer: string | null;
};

export type ClienteTrackingSessao = {
  id: number;
  sessionId: string;
  primeiraVisita: string;
  ultimaAtividade: string;
  criadoEm: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  gadSource: string | null;
  gadCampaignId: string | null;
  fbclid: string | null;
  msclkid: string | null;
  landingPage: string | null;
  referrer: string | null;
  exitPage: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  geoCountry: string | null;
  geoState: string | null;
  geoCity: string | null;
  ipAddress: string | null;
  pagesViewed: number;
  sessionDuration: number;
  bounce: boolean;
  scrollDepthMax: number;
  converted: boolean;
  conversionType: string | null;
  conversionValue: number | null;
  conversionAt: string;
  funnelStep: string | null;
  canal: string;
  googleAds: boolean;
};

export async function fetchAdminClienteTracking(clienteId: number): Promise<{
  ok: boolean;
  resumo?: ClienteTrackingResumo | null;
  sessoes?: ClienteTrackingSessao[];
  message?: string;
  error?: string;
}> {
  const res = await apiFetch(`/api/admin/clients/${clienteId}/tracking`);
  return res.json() as Promise<{
    ok: boolean;
    resumo?: ClienteTrackingResumo | null;
    sessoes?: ClienteTrackingSessao[];
    message?: string;
    error?: string;
  }>;
}

export type AtualizacoesGratuitasUi = {
  usadas: number;
  limite: number;
  bonus: number;
  limiteEfetivo: number;
  restantes: number;
  restantesGratuitas: number;
  manutencaoAtiva: boolean;
  contadorAtivo: boolean;
  bloqueado: boolean;
  resetEm?: string | null;
  semSicaf?: boolean;
  razaoSocial?: string;
};

export async function fetchAdminAtualizacoesGratuitas(clienteId: number): Promise<{
  ok: boolean;
  error?: string;
} & Partial<AtualizacoesGratuitasUi>> {
  const res = await apiFetch(`/api/admin/clients/${clienteId}/atualizacoes-gratuitas`);
  return res.json() as Promise<{ ok: boolean; error?: string } & Partial<AtualizacoesGratuitasUi>>;
}

export async function ajustarAdminAtualizacoesGratuitas(
  clienteId: number,
  payload: { disponiveis: number; motivo?: string },
): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
  antes?: AtualizacoesGratuitasUi;
  depois?: AtualizacoesGratuitasUi;
  anulados?: number;
}> {
  const res = await apiFetch(`/api/admin/clients/${clienteId}/atualizacoes-gratuitas`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{
    ok: boolean;
    message?: string;
    error?: string;
    antes?: AtualizacoesGratuitasUi;
    depois?: AtualizacoesGratuitasUi;
    anulados?: number;
  }>;
}

export type UpdateSicafStatusManualResult = {
  ok: boolean;
  message?: string;
  error?: string;
  oldStatus?: string;
  newStatus?: string;
  novaValidade?: string | null;
  dataInicio?: string | null;
  emailNotificacao?: {
    enviado: boolean;
    simulado?: boolean;
    motivo?: string;
    erro?: string;
    templateNome?: string;
    tipo?: string;
  };
  financeiro?: {
    taxaAtualizada?: boolean;
    pagamentosAtualizados?: number;
    renovacoesConcluidas?: number;
  };
};

export async function updateSicafStatusManual(payload: {
  sicafId: number;
  status: string;
  mensagem?: string;
  dataInicio?: string;
}): Promise<UpdateSicafStatusManualResult> {
  const res = await apiFetch("/api/sicaf/update-status", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json() as UpdateSicafStatusManualResult;
}

export type UpdateSicafVigenciaResult = {
  ok: boolean;
  error?: string;
  message?: string;
  sicafId?: number;
  oldValidade?: string | null;
  novaValidade?: string;
  diasValidade?: number;
  oldStatus?: string;
  newStatus?: string;
};

export async function updateSicafVigencia(payload: {
  sicafId?: number;
  clienteId?: number;
  novaDataValidade?: string;
  adicionarAnos?: number;
  mensagem: string;
}): Promise<UpdateSicafVigenciaResult> {
  const res = await apiFetch("/api/sicaf/update-vigencia", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json() as UpdateSicafVigenciaResult;
}

export type ContratoDigitalUi = {
  id: number;
  clienteId: number;
  plano: string;
  dataInicio: string;
  dataVencimento: string;
  status: string;
  assinadoEm?: string | null;
  assinadoPor?: string | null;
  valorMensal?: number | null;
  vigenciaMeses?: number | null;
  emailSignatario?: string | null;
  razaoSocial?: string;
  documento?: string;
  tipoDocumento?: string;
  email?: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  responsavelNome?: string;
};

export async function fetchAdminClienteContrato(clienteId: number): Promise<{
  ok: boolean;
  contrato?: ContratoDigitalUi | null;
  error?: string;
}> {
  const res = await apiFetch(`/api/admin/clients/${clienteId}/contrato`);
  const data = (await res.json()) as {
    ok: boolean;
    contrato?: ContratoDigitalUi | null;
    error?: string;
  };
  return data;
}

export async function salvarAdminClienteContrato(
  clienteId: number,
  payload: {
    contratoId?: number;
    plano: string;
    dataInicio: string;
    dataVencimento: string;
    status: "Assinado" | "Pendente Assinatura";
    assinadoPor?: string;
    assinadoEm?: string;
    valorMensal?: number;
    vigenciaMeses?: number;
    emailSignatario?: string;
  },
): Promise<{ ok: boolean; contrato?: ContratoDigitalUi; message?: string; error?: string }> {
  const res = await apiFetch(`/api/admin/clients/${clienteId}/contrato`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as {
    ok: boolean;
    contrato?: ContratoDigitalUi;
    message?: string;
    error?: string;
  };
  return data;
}

export async function downloadCertificadoDigital(clienteId: number, filename?: string): Promise<void> {
  const res = await apiFetch(`/api/admin/clients/${clienteId}/certificado-digital/download`);
  if (!res.ok) {
    let msg = "Falha ao baixar certificado";
    try {
      const err = (await res.json()) as { error?: string };
      if (err.error) msg = err.error;
    } catch (_) {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "certificado.pfx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function fetchAdminClienteDocumentos(clienteId: number): Promise<{
  ok: boolean;
  painel?: DocumentosPainelUi;
  error?: string;
}> {
  const res = await apiFetch(`/api/admin/clients/${clienteId}/documentos`);
  const data = (await res.json()) as {
    ok: boolean;
    sicafStatus?: string;
    docsPorNivel?: Record<number, DocChecklistUi[]>;
    certidoes?: DocumentosPainelUi["certidoes"];
    arquivos?: DocumentosPainelUi["arquivos"];
    certificadoDigital?: CertificadoDigitalUi | null;
    error?: string;
  };
  if (!data.ok) return { ok: false, error: data.error };
  return { ok: true, painel: mapDocumentosPainelFromApi(data) };
}

export function mapDocumentosPainelFromApi(data: {
  sicafStatus?: string;
  docsPorNivel?: Record<number, DocChecklistUi[]>;
  certidoes?: DocumentosPainelUi["certidoes"];
  arquivos?: DocumentosPainelUi["arquivos"];
  certificadoDigital?: CertificadoDigitalUi | null;
}): DocumentosPainelUi {
  return {
    sicafStatus: data.sicafStatus,
    docsPorNivel: data.docsPorNivel || {},
    certidoes: data.certidoes || [],
    arquivos: data.arquivos || [],
    certificadoDigital: data.certificadoDigital ?? null,
  };
}

export function mapCertidoesToDocumentos(
  certidoes: NonNullable<Awaited<ReturnType<typeof fetchAdminClienteDetalhe>>["client"]>["certidoes"],
): DocumentoUi[] {
  if (!certidoes?.length) return [];
  return certidoes.map((c) => {
    const st = String(c.status || "").toLowerCase();
    const status: DocumentoUi["status"] =
      st.includes("vencida") || st.includes("vencido")
        ? "danger"
        : st.includes("vencendo")
          ? "warn"
          : c.arquivo_url
            ? "ok"
            : "pendente";
    return {
      nome: c.tipo_nome || "Documento",
      validade: c.data_validade ? formatDateBr(c.data_validade) : "—",
      status,
      url: c.arquivo_url || undefined,
    };
  });
}

export function flattenChecklistDocumentos(docsPorNivel: Record<number, DocChecklistUi[]>): DocumentoUi[] {
  const out: DocumentoUi[] = [];
  for (const [nivel, lista] of Object.entries(docsPorNivel)) {
    for (const d of lista) {
      const st = String(d.status || "").toLowerCase();
      let status: DocumentoUi["status"] = "pendente";
      if (st === "vencida") status = "danger";
      else if (st === "vencendo") status = "warn";
      else if ((st === "ok" || d.arquivoUrl) && d.arquivoUrl) {
        const v = d.validade || "";
        if (v && v !== "—") {
          const [dd, mm, yyyy] = v.split("/").map(Number);
          const dt = new Date(yyyy, (mm || 1) - 1, dd || 1);
          const dias = Math.ceil((dt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (dias < 0) status = "danger";
          else if (dias <= 30) status = "warn";
          else status = "ok";
        } else {
          status = "ok";
        }
      }
      out.push({
        nome: d.nome,
        validade: d.validade || "—",
        status,
        url: d.arquivoUrl || undefined,
        nivel: Number(nivel),
      });
    }
  }
  return out.sort((a, b) => (a.nivel || 0) - (b.nivel || 0));
}

export type HistoricoUi = { d: string; t: string };

export function mapHistoricoFromApi(
  historico: NonNullable<Awaited<ReturnType<typeof fetchAdminClienteDetalhe>>["client"]>["historico"],
  loginLogs?: NonNullable<Awaited<ReturnType<typeof fetchAdminClienteDetalhe>>["client"]>["loginLogs"],
): HistoricoUi[] {
  const items: HistoricoUi[] = [];
  for (const h of historico || []) {
    items.push({
      d: formatDateBr(h.created_at),
      t: h.acao || "Ação registrada",
    });
  }
  for (const l of loginLogs || []) {
    items.push({
      d: formatDateBr(l.created_at),
      t: `Acesso ao portal${l.navegador ? ` — ${l.navegador}` : ""}`,
    });
  }
  return items.slice(0, 20);
}

export async function criarAdminCliente(data: NovoClienteData) {
  const res = await apiFetch("/api/admin/clients", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.json() as Promise<{ ok: boolean; error?: string; message?: string; clienteId?: number }>;
}

export type EditarClientePayload = {
  razao: string;
  cnpj: string;
  cidade: string;
  responsavel: string;
  email: string;
  telefone: string;
  whatsapp: string;
  login: string;
  senha: string;
  forcarTroca: boolean;
  enviarReset: boolean;
};

export function buildAtualizarClientePayload(data: EditarClientePayload): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    razao: data.razao.trim(),
    cnpj: data.cnpj.trim(),
    cidade: data.cidade.trim(),
    responsavel: data.responsavel.trim(),
    email: data.email.trim(),
    telefone: data.telefone.trim(),
    whatsapp: data.whatsapp.trim(),
    forcarTroca: data.forcarTroca,
    enviarReset: data.enviarReset,
  };

  const login = data.login.trim();
  const senha = data.senha.trim();
  const usuarioPrincipal: Record<string, unknown> = {};

  if (login) {
    payload.login = login;
    usuarioPrincipal.email = login;
  }
  if (data.responsavel.trim()) {
    usuarioPrincipal.nome = data.responsavel.trim();
  }
  if (senha) {
    payload.senha = senha;
    usuarioPrincipal.nova_senha = senha;
  }
  if (Object.keys(usuarioPrincipal).length > 0) {
    payload.usuario_principal = usuarioPrincipal;
  }

  return payload;
}

export async function atualizarAdminCliente(clienteId: number, data: EditarClientePayload | Record<string, unknown>) {
  const body =
    "razao" in data && "cnpj" in data && "login" in data
      ? buildAtualizarClientePayload(data as EditarClientePayload)
      : data;
  const res = await apiFetch(`/api/admin/clients/${clienteId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ ok: boolean; error?: string; message?: string; emailEnviado?: boolean }>;
}

export async function validarPagamentoAdmin(pagamentoId: number) {
  const res = await apiFetch("/api/admin/financeiro/validar-pagamentos", {
    method: "POST",
    body: JSON.stringify({ pagamentoId }),
  });
  return res.json() as Promise<{ ok: boolean; error?: string; message?: string }>;
}
