"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Bot,
  Loader2,
  Upload,
  FileText,
  X,
  FileSearch,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  ChevronLeft,
  Plus,
  History,
  ChevronRight,
  Building2,
  Hash,
  Calendar,
  ListChecks,
  Shield,
  Sparkles,
} from "lucide-react";

interface EmpresaResumo {
  clienteId: number;
  nome: string;
  cnpj: string;
}

interface ValidacaoAnalise {
  processo?: string;
  metodo_extracao?: string;
  cnpj_identificado?: string;
  cnpj_cadastro?: string;
  empresa?: string;
  status?: string;
}

interface SicafAnalisarProblemaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresas?: EmpresaResumo[];
  onProcessed?: () => void;
}

interface PendenciaAnalise {
  nivel?: string | null;
  titulo?: string;
  tipo?: string;
  problema?: string;
  prioridade?: string;
  solucao?: string;
  onde_resolver?: string;
}

interface NivelStatusAnalise {
  nivel?: string;
  nome?: string;
  status?: string;
  observacao?: string | null;
}

interface AnaliseResult {
  resumo?: string;
  status_geral?: string;
  cnpj?: string | null;
  razao_social?: string | null;
  tipo_documento?: string | null;
  arquivo_nome?: string | null;
  analisado_em?: string | null;
  niveis_status?: NivelStatusAnalise[];
  pendencias?: PendenciaAnalise[];
  proximos_passos?: string[];
  observacoes?: string | null;
  validacao?: ValidacaoAnalise;
}

interface AnaliseHistorico {
  id: number;
  arquivoNome?: string | null;
  statusGeral?: string | null;
  resumo?: string | null;
  totalPendencias?: number;
  analise?: AnaliseResult;
  niveisResumo?: { nivel: string; status: string }[];
  certidoesInseridas?: number;
  certidoesAtualizadas?: number;
  cadastroAtualizado?: boolean;
  aviso?: string | null;
  createdAt?: string;
  empresaNome?: string | null;
  empresaCnpj?: string | null;
}

export interface SicafAnaliseApiResult {
  ok?: boolean;
  error?: string;
  message?: string;
  cnpj?: string;
  cnpjIdentificado?: string;
  metodoExtracao?: string;
  arquivoNome?: string;
  razaoSocial?: string;
  analise?: AnaliseResult;
  analiseId?: number | null;
  saveWarning?: string | null;
  validacao?: ValidacaoAnalise;
  certidoesInserted?: number;
  certidoesUpdated?: number;
  niveisResumo?: { nivel: string; status: string }[];
}

type ApiResult = SicafAnaliseApiResult;

function erroTipo(error?: string): "cnpj_nao_cadastrado" | "cnpj_nao_identificado" | "pdf_invalido" | "generico" {
  const e = (error || "").toLowerCase();
  if (e.includes("não está cadastrado") || e.includes("nao esta cadastrado") || e.includes("não pertence")) {
    return "cnpj_nao_cadastrado";
  }
  if (e.includes("não foi possível identificar o cnpj") || e.includes("nao foi possivel identificar o cnpj")) {
    return "cnpj_nao_identificado";
  }
  if (e.includes("pdf") || e.includes("extrair texto")) {
    return "pdf_invalido";
  }
  return "generico";
}

type ViewMode = "list" | "new" | "detail";

function formatDocumento(doc?: string | null) {
  if (!doc) return "—";
  const d = doc.replace(/\D/g, "");
  if (d.length === 14) {
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (d.length === 11) {
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return doc;
}

function prioridadeBadge(prioridade?: string) {
  const p = (prioridade || "").toLowerCase();
  if (p === "alta") return "bg-red-500/15 text-red-600 border-red-500/30";
  if (p === "media" || p === "média") return "bg-amber-500/15 text-amber-700 border-amber-500/30";
  return "bg-muted text-muted-foreground";
}

function statusGeralBadge(status?: string) {
  const s = (status || "").toLowerCase();
  if (s === "regular") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (s.includes("venc")) return "bg-red-500/15 text-red-600 border-red-500/30";
  if (s === "misto") return "bg-violet-500/15 text-violet-700 border-violet-500/30";
  return "bg-amber-500/15 text-amber-700 border-amber-500/30";
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function nivelStatusBadge(status?: string) {
  const s = (status || "").toLowerCase();
  if (s === "regular") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
  if (s.includes("venc")) return "bg-red-500/10 text-red-600 border-red-500/30";
  if (s.includes("pend")) return "bg-amber-500/10 text-amber-700 border-amber-500/30";
  if (s.includes("não") || s.includes("nao")) return "bg-muted text-muted-foreground";
  return "bg-muted text-muted-foreground";
}

export function AnaliseErroRelatorio({
  error,
  cnpjIdentificado,
  metodoExtracao,
  arquivoNome,
  empresas,
}: {
  error?: string;
  cnpjIdentificado?: string | null;
  metodoExtracao?: string | null;
  arquivoNome?: string | null;
  empresas: EmpresaResumo[];
}) {
  const tipo = erroTipo(error);
  const titulo =
    tipo === "cnpj_nao_cadastrado"
      ? "CNPJ não vinculado à sua conta"
      : tipo === "cnpj_nao_identificado"
        ? "CNPJ não identificado no PDF"
        : tipo === "pdf_invalido"
          ? "Documento não pôde ser lido"
          : "Análise não concluída";

  const passos =
    tipo === "cnpj_nao_cadastrado"
      ? [
          "Confira se o PDF é da Situação do Fornecedor de uma empresa sua.",
          "Cadastre o CNPJ em Minhas Empresas antes de analisar, ou envie o PDF correto.",
          "Se o CNPJ já estiver cadastrado, verifique se está logado na conta certa.",
        ]
      : tipo === "cnpj_nao_identificado"
        ? [
            "Baixe novamente a Situação do Fornecedor completa no portal SICAF.",
            "Evite PDFs escaneados ou com baixa qualidade — prefira o arquivo gerado pelo sistema.",
          ]
        : [
            "Verifique se o arquivo é um PDF válido da Situação do Fornecedor.",
            "Tente enviar outro documento ou entre em contato com o suporte.",
          ];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-500/10 via-orange-500/5 to-background p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-7 h-7 text-red-600" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30 text-xs">
              Validação interrompida
            </Badge>
            <h3 className="text-xl font-bold text-foreground">{titulo}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{error}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <FileSearch className="w-5 h-5 text-amber-600" />
          <h4 className="font-semibold">Relatório da tentativa</h4>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {arquivoNome && (
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Arquivo enviado</p>
              <p className="text-sm font-medium mt-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{arquivoNome}</span>
              </p>
            </div>
          )}
          {cnpjIdentificado && (
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">CNPJ identificado no PDF</p>
              <p className="text-sm font-mono font-semibold mt-1">{formatDocumento(cnpjIdentificado)}</p>
            </div>
          )}
          {metodoExtracao && (
            <div className="rounded-xl border bg-muted/20 p-3 sm:col-span-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Processo de identificação</p>
              <p className="text-sm mt-1">{metodoExtracao}</p>
            </div>
          )}
          <div className="rounded-xl border bg-muted/20 p-3 sm:col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Resultado da validação</p>
            <p className="text-sm mt-1 text-red-700 dark:text-red-400 font-medium">
              {tipo === "cnpj_nao_cadastrado"
                ? "O CNPJ do PDF não pertence às empresas vinculadas ao seu usuário."
                : "Não foi possível concluir a análise SICAF deste documento."}
            </p>
          </div>
        </div>
      </div>

      {tipo === "cnpj_nao_cadastrado" && empresas.length > 0 && (
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h4 className="font-semibold">CNPJs cadastrados na sua conta ({empresas.length})</h4>
          </div>
          <p className="text-sm text-muted-foreground">
            Envie a Situação do Fornecedor de um destes CNPJs:
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {empresas.map((e) => (
              <div
                key={e.clienteId}
                className="rounded-xl border px-3 py-2.5 flex items-center justify-between gap-2 bg-muted/10"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{e.nome}</p>
                  <p className="text-xs font-mono text-muted-foreground">{formatDocumento(e.cnpj)}</p>
                </div>
                {cnpjIdentificado && formatDocumento(e.cnpj) === formatDocumento(cnpjIdentificado) && (
                  <Badge className="shrink-0 bg-emerald-500/10 text-emerald-700 text-[10px]">Match</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-blue-600" />
          <h4 className="font-semibold">O que fazer agora</h4>
        </div>
        <ol className="space-y-2">
          {passos.map((passo, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-muted-foreground pt-0.5 leading-relaxed">{passo}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function ValidacaoInfo({ validacao }: { validacao?: ValidacaoAnalise | null }) {
  if (!validacao) return null;
  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="w-4 h-4" />
        Validação do CNPJ
      </div>
      <p className="text-sm text-foreground">{validacao.processo}</p>
      <div className="flex flex-wrap gap-2 text-xs">
        {validacao.metodo_extracao && (
          <Badge variant="outline" className="bg-background/80">
            Método: {validacao.metodo_extracao}
          </Badge>
        )}
        {validacao.cnpj_identificado && (
          <Badge variant="outline" className="font-mono bg-background/80">
            PDF: {formatDocumento(validacao.cnpj_identificado)}
          </Badge>
        )}
        {validacao.status && (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
            {validacao.status}
          </Badge>
        )}
      </div>
    </div>
  );
}

function AnaliseMetaHeader({
  cnpj,
  razaoSocial,
  clientName,
  documentoFallback,
  statusGeral,
  tipoDocumento,
  arquivoNome,
  dataAnalise,
}: {
  cnpj?: string | null;
  razaoSocial?: string | null;
  clientName?: string;
  documentoFallback?: string;
  statusGeral?: string | null;
  tipoDocumento?: string | null;
  arquivoNome?: string | null;
  dataAnalise?: string | null;
}) {
  const cnpjExibido = cnpj || documentoFallback ? formatDocumento(cnpj || documentoFallback) : null;
  const nome = razaoSocial || clientName;

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-background p-5 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-3 min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-800/80 dark:text-amber-300/80 uppercase tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            Documento analisado
          </div>
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              {nome && (
                <p className="font-semibold text-base text-foreground leading-snug break-words">{nome}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {cnpjExibido && (
                  <Badge
                    variant="outline"
                    className="font-mono text-xs bg-background/80 border-amber-500/30 text-amber-900 dark:text-amber-200"
                  >
                    <Hash className="w-3 h-3 mr-1" />
                    CNPJ {cnpjExibido}
                  </Badge>
                )}
                {tipoDocumento && (
                  <Badge variant="secondary" className="text-xs">
                    {tipoDocumento}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {(arquivoNome || dataAnalise) && (
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pl-14">
              {arquivoNome && (
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  {arquivoNome}
                </span>
              )}
              {dataAnalise && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(dataAnalise)}
                </span>
              )}
            </div>
          )}
        </div>
        {statusGeral && (
          <Badge variant="outline" className={cn("text-sm px-3 py-1 shrink-0", statusGeralBadge(statusGeral))}>
            {statusGeral}
          </Badge>
        )}
      </div>
    </div>
  );
}

function AnaliseStats({
  totalPendencias,
  niveisOk,
  niveisProblema,
}: {
  totalPendencias: number;
  niveisOk: number;
  niveisProblema: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-xl border bg-card p-4 text-center">
        <p className="text-2xl font-bold text-red-600">{totalPendencias}</p>
        <p className="text-xs text-muted-foreground mt-1">Pendências</p>
      </div>
      <div className="rounded-xl border bg-card p-4 text-center">
        <p className="text-2xl font-bold text-emerald-600">{niveisOk}</p>
        <p className="text-xs text-muted-foreground mt-1">Níveis OK</p>
      </div>
      <div className="rounded-xl border bg-card p-4 text-center">
        <p className="text-2xl font-bold text-amber-600">{niveisProblema}</p>
        <p className="text-xs text-muted-foreground mt-1">Níveis c/ problema</p>
      </div>
    </div>
  );
}

export function AnaliseDetalhe({
  analise,
  saveWarning,
  clientName,
  documentoFallback,
  niveisResumo,
  validacao,
}: {
  analise: AnaliseResult;
  saveWarning?: string | null;
  clientName?: string;
  documentoFallback?: string;
  niveisResumo?: { nivel: string; status: string }[];
  validacao?: ValidacaoAnalise | null;
}) {
  const pendencias = analise.pendencias || [];
  const niveisStatus = analise.niveis_status || [];
  const niveisOk = niveisStatus.filter((n) => n.status === "Regular").length;
  const niveisProblema = niveisStatus.filter((n) =>
    ["Pendente", "Vencido"].includes(n.status || ""),
  ).length;

  return (
    <div className="space-y-5">
      <AnaliseMetaHeader
        cnpj={analise.cnpj}
        razaoSocial={analise.razao_social}
        clientName={clientName}
        documentoFallback={documentoFallback}
        statusGeral={analise.status_geral}
        tipoDocumento={analise.tipo_documento}
        arquivoNome={analise.arquivo_nome}
        dataAnalise={analise.analisado_em}
      />

      <ValidacaoInfo validacao={validacao || analise.validacao} />

      {niveisStatus.length > 0 && (
        <AnaliseStats
          totalPendencias={pendencias.length}
          niveisOk={niveisOk}
          niveisProblema={niveisProblema}
        />
      )}

      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-amber-600" />
          <h4 className="font-semibold">Diagnóstico da IA</h4>
        </div>
        <p className="text-sm text-foreground leading-relaxed">{analise.resumo}</p>
        {saveWarning && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {saveWarning}
          </div>
        )}
      </div>

      {niveisStatus.length > 0 && (
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            <h4 className="font-semibold">Situação por nível SICAF</h4>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {niveisStatus.map((n) => (
              <div
                key={n.nivel}
                className={cn(
                  "rounded-xl border p-3 transition-colors",
                  n.status === "Regular"
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : ["Pendente", "Vencido"].includes(n.status || "")
                      ? "bg-red-500/5 border-red-500/20"
                      : "bg-muted/30",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold font-mono text-foreground">Nível {n.nivel}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug break-words">{n.nome}</p>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] shrink-0", nivelStatusBadge(n.status))}>
                    {n.status || "—"}
                  </Badge>
                </div>
                {n.observacao && n.status !== "Regular" && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-2 leading-snug">{n.observacao}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {pendencias.length === 0 ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-emerald-800 dark:text-emerald-300">Cadastro regular</p>
            <p className="text-sm text-emerald-700/80 dark:text-emerald-400/80 mt-1">
              Nenhuma pendência crítica identificada no CNPJ {formatDocumento(analise.cnpj || documentoFallback)}.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h4 className="font-semibold">Pendências detalhadas ({pendencias.length})</h4>
          </div>
          <div className="space-y-3">
            {pendencias.map((p, i) => (
              <div
                key={i}
                className="rounded-2xl border bg-card p-5 shadow-sm space-y-3 hover:border-amber-500/30 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {p.nivel && (
                    <Badge variant="outline" className="font-mono bg-muted/50">
                      Nível {p.nivel}
                    </Badge>
                  )}
                  {p.prioridade && (
                    <Badge variant="outline" className={prioridadeBadge(p.prioridade)}>
                      Prioridade {p.prioridade}
                    </Badge>
                  )}
                  {p.tipo && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{p.tipo}</span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{p.titulo || "Pendência"}</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{p.problema}</p>
                </div>
                <div className="rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/15 px-4 py-3 flex gap-3">
                  <Lightbulb className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">Como resolver</p>
                    <p className="text-sm leading-relaxed">{p.solucao}</p>
                    {p.onde_resolver && (
                      <p className="text-xs text-muted-foreground pt-1">
                        <span className="font-medium">Onde:</span> {p.onde_resolver}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {analise.proximos_passos && analise.proximos_passos.length > 0 && (
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-blue-600" />
            <h4 className="font-semibold">Próximos passos recomendados</h4>
          </div>
          <ol className="space-y-2">
            {analise.proximos_passos.map((passo, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="text-muted-foreground pt-0.5 leading-relaxed">{passo}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {analise.observacoes && (
        <div className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          {analise.observacoes}
        </div>
      )}

      {niveisResumo && niveisResumo.length > 0 && (
        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Atualização no cadastro</p>
          <div className="flex flex-wrap gap-1.5">
            {niveisResumo.map((n) => (
              <Badge key={n.nivel} variant="secondary" className="text-xs">
                {n.nivel}: {n.status}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SicafAnalisarProblemaModal({
  open,
  onOpenChange,
  empresas = [],
  onProcessed,
}: SicafAnalisarProblemaModalProps) {
  const { token } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [historico, setHistorico] = useState<AnaliseHistorico[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [selectedHistorico, setSelectedHistorico] = useState<AnaliseHistorico | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const resetUpload = () => {
    setPdfFile(null);
    setResult(null);
    setProcessing(false);
    setDragOver(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const resetAll = () => {
    resetUpload();
    setView("list");
    setSelectedHistorico(null);
  };

  const loadHistorico = useCallback(async () => {
    if (!token) return;
    setLoadingHistorico(true);
    try {
      const res = await fetch(`/api/sicaf/analises`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setHistorico(data.analises || []);
      } else {
        setHistorico([]);
      }
    } catch {
      setHistorico([]);
    } finally {
      setLoadingHistorico(false);
    }
  }, [token]);

  useEffect(() => {
    if (open) {
      setView("list");
      setSelectedHistorico(null);
      resetUpload();
      loadHistorico();
    }
  }, [open, loadHistorico]);

  const handleClose = (next: boolean) => {
    if (!next) resetAll();
    onOpenChange(next);
  };

  const pickFile = (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Selecione um PDF da Situação do Fornecedor.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("PDF muito grande. Máximo 15 MB.");
      return;
    }
    setPdfFile(file);
    setResult(null);
  };

  const handleAnalyze = async () => {
    if (!token) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }
    if (!pdfFile) {
      toast.error("Selecione o PDF da Situação do Fornecedor.");
      return;
    }

    setProcessing(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", pdfFile, pdfFile.name);

      const res = await fetch(`/api/sicaf/analisar-situacao`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      let data: ApiResult = {};
      const raw = await res.text();
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        toast.error(raw?.slice(0, 200) || `Erro HTTP ${res.status}`);
        return;
      }
      if (data.ok) {
        setResult(data);
        toast.success(data.message || "Análise concluída");
        onProcessed?.();
        await loadHistorico();
      } else {
        setResult({
          ...data,
          ok: false,
          cnpjIdentificado: data.cnpjIdentificado || data.cnpj,
          arquivoNome: pdfFile.name,
        });
        toast.error(data.error || `Não foi possível analisar o PDF (${res.status})`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro de conexão";
      toast.error(`Falha ao enviar PDF: ${msg}`);
    } finally {
      setProcessing(false);
    }
  };

  const openDetail = (item: AnaliseHistorico) => {
    setSelectedHistorico(item);
    setView("detail");
  };

  const viewTitle =
    view === "list" ? "Análises SICAF com IA" : view === "new" ? "Nova análise" : "Detalhe da análise";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          "max-w-6xl w-[95vw] h-[95vh] max-h-[95vh] p-0 gap-0 overflow-hidden flex flex-col",
          "!fixed !left-1/2 !top-[2.5vh] !-translate-x-1/2 !translate-y-0",
          "[&>button:last-child]:text-white [&>button:last-child]:opacity-90 [&>button:last-child]:hover:opacity-100 [&>button:last-child]:hover:bg-white/15 [&>button:last-child]:top-5 [&>button:last-child]:right-5",
        )}
      >
        <DialogTitle className="sr-only">{viewTitle}</DialogTitle>
        <DialogDescription className="sr-only">
          Análise de PDF da Situação do Fornecedor com identificação automática de CNPJ e validação contra suas empresas cadastradas.
        </DialogDescription>
        {/* Header */}
        <div className="shrink-0 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-6 py-5 pr-14">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                {view === "list" && <History className="w-6 h-6" />}
                {view === "new" && <Upload className="w-6 h-6" />}
                {view === "detail" && <FileSearch className="w-6 h-6" />}
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">{viewTitle}</h2>
                <p className="text-sm text-white/85 mt-1 max-w-xl">
                  {view === "list" &&
                    "Histórico de diagnósticos da Situação do Fornecedor com identificação de pendências por nível."}
                  {view === "new" &&
                    "Envie o PDF gerado no portal SICAF. A IA analisa todos os níveis e indica o que precisa ser regularizado."}
                  {view === "detail" && selectedHistorico && (
                    <>
                      {selectedHistorico.arquivoNome || "Análise"} · {formatDate(selectedHistorico.createdAt)}
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur border border-white/20 px-4 py-2.5 shrink-0 max-w-sm">
              <p className="text-[10px] uppercase tracking-wider text-white/70 font-medium">Como funciona</p>
              <p className="text-xs text-white/90 mt-1 leading-relaxed">
                Envie o PDF da Situação do Fornecedor. A IA identifica o CNPJ no documento e valida se ele pertence às suas empresas cadastradas.
              </p>
            </div>
          </div>
        </div>

        {/* Body — scroll nativo ocupa todo espaço entre header e footer */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-muted/20">
          <div className="p-6 pb-10 space-y-5">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] || null)}
              />

              {view === "list" && (
                <>
                  <div className="flex justify-end">
                    <Button
                      className="bg-amber-600 hover:bg-amber-700 shadow-md"
                      onClick={() => {
                        resetUpload();
                        setView("new");
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Nova análise
                    </Button>
                  </div>

                  {loadingHistorico ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                      <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
                      <p className="text-sm font-medium">Carregando histórico...</p>
                    </div>
                  ) : historico.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed bg-card p-16 text-center space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto">
                        <FileSearch className="w-8 h-8 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg">Nenhuma análise ainda</p>
                        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                          Envie o PDF da Situação do Fornecedor. O CNPJ será identificado automaticamente e conferido com suas empresas cadastradas.
                        </p>
                      </div>
                      <Button variant="outline" onClick={() => setView("new")}>
                        Fazer primeira análise
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {historico.map((item) => {
                        const cnpjItem = item.analise?.cnpj || item.empresaCnpj;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => openDetail(item)}
                            className="w-full text-left rounded-2xl border bg-card p-5 hover:border-amber-500/40 hover:shadow-md transition-all flex items-start gap-4 group"
                          >
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center shrink-0">
                              <Bot className="w-6 h-6 text-amber-700" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-sm truncate">
                                  {item.empresaNome || item.arquivoNome || "Situação do Fornecedor"}
                                </span>
                                {cnpjItem && (
                                  <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                                    CNPJ {formatDocumento(cnpjItem)}
                                  </Badge>
                                )}
                                {item.statusGeral && (
                                  <Badge variant="outline" className={cn("text-[10px]", statusGeralBadge(item.statusGeral))}>
                                    {item.statusGeral}
                                  </Badge>
                                )}
                                {(item.totalPendencias ?? 0) > 0 && (
                                  <Badge className="bg-red-500/10 text-red-600 text-[10px]">
                                    {item.totalPendencias} pendência(s)
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {item.resumo || "Sem resumo"}
                              </p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" />
                                {formatDate(item.createdAt)}
                              </p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-2 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {view === "new" && !result && !processing && (
                <div className="space-y-4">
                  <div className="rounded-2xl border bg-card p-5 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Não é necessário informar o CNPJ. O sistema reconhece automaticamente no PDF e valida se pertence às suas empresas.
                    </p>
                    {empresas.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {empresas.slice(0, 6).map((e) => (
                          <Badge key={e.clienteId} variant="secondary" className="text-[10px] font-mono">
                            {formatDocumento(e.cnpj)}
                          </Badge>
                        ))}
                        {empresas.length > 6 && (
                          <Badge variant="outline" className="text-[10px]">
                            +{empresas.length - 6} CNPJs
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      pickFile(e.dataTransfer.files?.[0] || null);
                    }}
                    className={cn(
                      "rounded-2xl border-2 border-dashed p-12 text-center transition-all cursor-pointer bg-card",
                      dragOver
                        ? "border-amber-500 bg-amber-500/10 scale-[1.01]"
                        : "border-border hover:border-amber-500/50 hover:bg-muted/30",
                    )}
                  >
                    {pdfFile ? (
                      <div className="space-y-4">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/15 flex items-center justify-center">
                          <FileText className="w-8 h-8 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{pdfFile.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            O CNPJ será identificado automaticamente no documento
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPdfFile(null);
                            if (fileRef.current) fileRef.current.value = "";
                          }}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Remover arquivo
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-muted flex items-center justify-center">
                          <Upload className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold text-lg text-foreground">Arraste o PDF ou clique para selecionar</p>
                          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                            Documento &quot;Situação do Fornecedor&quot; do portal SICAF — o CNPJ deve ser de uma das suas empresas cadastradas
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {view === "new" && processing && (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/15 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
                    </div>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-semibold">Analisando documento...</p>
                    <p className="text-sm text-muted-foreground">
                      Identificando CNPJ no PDF e analisando níveis, pendências e soluções
                    </p>
                  </div>
                </div>
              )}

              {view === "new" && result && !result.ok && !processing && (
                <AnaliseErroRelatorio
                  error={result.error}
                  cnpjIdentificado={result.cnpjIdentificado || result.cnpj}
                  metodoExtracao={result.metodoExtracao}
                  arquivoNome={pdfFile?.name}
                  empresas={empresas}
                />
              )}

              {view === "new" && result?.ok && result?.analise && !processing && (
                <AnaliseDetalhe
                  analise={result.analise}
                  saveWarning={result.saveWarning}
                  clientName={result.razaoSocial}
                  documentoFallback={result.cnpj}
                  niveisResumo={result.niveisResumo}
                  validacao={result.validacao || result.analise.validacao}
                />
              )}

              {view === "detail" && selectedHistorico?.analise && (
                <AnaliseDetalhe
                  analise={selectedHistorico.analise}
                  saveWarning={selectedHistorico.aviso}
                  clientName={selectedHistorico.empresaNome || selectedHistorico.analise.razao_social || undefined}
                  documentoFallback={selectedHistorico.empresaCnpj || selectedHistorico.analise.cnpj || undefined}
                  niveisResumo={selectedHistorico.niveisResumo}
                  validacao={selectedHistorico.analise.validacao}
                />
              )}
            </div>
        </div>

        {/* Footer */}
        <DialogFooter className="shrink-0 border-t bg-background px-6 py-4 gap-2 flex-wrap sm:justify-between">
          {view === "list" && (
            <Button variant="outline" onClick={() => handleClose(false)} className="ml-auto">
              Fechar
            </Button>
          )}

          {view === "new" && (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  resetUpload();
                  setView("list");
                }}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Voltar ao histórico
              </Button>
              <div className="flex gap-2 flex-wrap">
                {result ? (
                  <>
                    <Button variant="outline" onClick={() => resetUpload()}>
                      {result.ok ? "Analisar outro PDF" : "Tentar outro PDF"}
                    </Button>
                    <Button className="bg-amber-600 hover:bg-amber-700" onClick={() => handleClose(false)}>
                      Fechar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => handleClose(false)} disabled={processing}>
                      Cancelar
                    </Button>
                    <Button
                      className="bg-amber-600 hover:bg-amber-700 shadow-md"
                      onClick={handleAnalyze}
                      disabled={processing || !pdfFile}
                    >
                      {processing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analisando...
                        </>
                      ) : (
                        <>
                          <Bot className="w-4 h-4 mr-2" />
                          Analisar com IA
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </>
          )}

          {view === "detail" && (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedHistorico(null);
                  setView("list");
                }}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    resetUpload();
                    setView("new");
                  }}
                >
                  Nova análise
                </Button>
                <Button className="bg-amber-600 hover:bg-amber-700" onClick={() => handleClose(false)}>
                  Fechar
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
