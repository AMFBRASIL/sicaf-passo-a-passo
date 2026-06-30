import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PendenciasModal } from "@/components/pendencias-modal";
import { Building2, ChevronRight, Edit3, FileText, MapPin, Plus, Rocket, Save, RefreshCw, ShieldCheck, User, X, Search, Loader2, QrCode, Receipt, Check, ArrowRight, ArrowLeft, Sparkles, CheckCircle2, Mail, Phone, Briefcase, Zap, Users, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { PageHeader, StatusBadge } from "@/components/page-header";
import { ManutencaoModal } from "@/components/manutencao-modal";
import { PagamentoSicafModal } from "@/components/pagamento-sicaf-modal";
import { ResolverSicafInaptoModal } from "@/components/resolver-sicaf-inapto-modal";
import { Wrench } from "lucide-react";
import {
  fetchEmpresaGerenciar,
  salvarEmpresaGerenciar,
  gerarTaxaSicaf,
  registrarEmpresa,
  PLANO_WIZARD_PARA_CODIGO,
  type ColaboradorResumo,
  type EmpresaGerenciarPainel,
  type GerenciarItem,
  type PagamentoGerado,
} from "@/lib/empresas-api";
import { BoletoGeradoPanel } from "@/components/sicaf/BoletoGeradoPanel";
import { PixPaymentModal } from "@/components/sicaf/PixPaymentModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { shouldGerenciarAbrirPagamentoFromEmpresa } from "@/lib/sicaf-access-rules";
import {
  enderecoFromCep,
  fetchCep,
  formatCepDisplay,
  formatCepInput,
} from "@/lib/cep-api";


export type SicafStatus = "ativo" | "atencao" | "vencido" | "sem_cadastro";

export interface EmpresaData {
  clienteId?: number;
  sicafId?: number;
  nome: string;
  cnpj: string;
  sicaf: SicafStatus;
  validade?: string;
  proximoPasso: string;
  acao: { label: string; variant?: "default" | "outline"; icon: typeof Rocket };
  endereco: string;
  cep?: string;
  cidade: string;
  uf: string;
  telefone: string;
  email: string;
  responsavel: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  ramoAtividade: string;
  niveis?: number[];
  detalhesNiveis?: Record<number, NivelDetalhe>;
  taxaPendente?: boolean;
  manutencaoAtiva?: boolean;
  /** Dias restantes até data_validade (0 se vencido). */
  diasValidade?: number | null;
}

export const empresasMock: EmpresaData[] = [
  {
    nome: "Empresa Demonstração LTDA",
    cnpj: "00.000.000/0001-00",
    sicaf: "atencao",
    validade: "28/02/2026",
    proximoPasso: "Atualizar Nível III e IV antes do vencimento.",
    acao: { label: "Atualizar SICAF", icon: Rocket },
    endereco: "Av. Paulista, 1000 - Sala 1201",
    cidade: "São Paulo",
    uf: "SP",
    telefone: "(11) 3456-7890",
    email: "contato@empresademo.com.br",
    responsavel: "João da Silva",
    inscricaoEstadual: "123.456.789.000",
    inscricaoMunicipal: "9876543210",
    ramoAtividade: "Serviços de Consultoria em TI",
    niveis: [1, 2],
    diasValidade: 12,
  },
  {
    nome: "JR Comércio e Serviços ME",
    cnpj: "12.345.678/0001-99",
    sicaf: "ativo",
    validade: "10/09/2026",
    proximoPasso: "Tudo em dia. Vamos monitorar por você.",
    acao: { label: "Ver detalhes", variant: "outline", icon: RefreshCw },
    endereco: "Rua Rio de Janeiro, 450 - Centro",
    cidade: "Belo Horizonte",
    uf: "MG",
    telefone: "(31) 2345-6789",
    email: "contato@jrcomercio.com.br",
    responsavel: "Maria Oliveira",
    inscricaoEstadual: "987.654.321.000",
    inscricaoMunicipal: "1234567890",
    ramoAtividade: "Comércio Varejista",
    niveis: [1, 2, 3, 4],
    diasValidade: 94,
  },
  {
    nome: "JR Construtora EIRELI",
    cnpj: "23.456.789/0001-11",
    sicaf: "vencido",
    validade: "Vencido em 14/10/2025",
    proximoPasso: "Sua empresa está fora de licitações. Atualize agora.",
    acao: { label: "Resolver agora", icon: Rocket },
    endereco: "Av. das Américas, 5000 - Bloco 2",
    cidade: "Rio de Janeiro",
    uf: "RJ",
    telefone: "(21) 3456-7890",
    email: "obras@jrconstrutora.com.br",
    responsavel: "Pedro Costa",
    inscricaoEstadual: "456.789.123.000",
    inscricaoMunicipal: "5678901234",
    ramoAtividade: "Construção Civil",
    niveis: [1, 2, 3, 4, 5, 6],
    taxaPendente: true,
    diasValidade: 0,
  },
  {
    nome: "Nova Filial Brasília LTDA",
    cnpj: "34.567.890/0001-22",
    sicaf: "sem_cadastro",
    proximoPasso: "Esta empresa ainda não possui SICAF. Vamos cadastrar?",
    acao: { label: "Cadastrar SICAF", icon: Plus },
    endereco: "SHS Qd. 6, Bloco C - Asa Sul",
    cidade: "Brasília",
    uf: "DF",
    telefone: "(61) 3456-7890",
    email: "filial@novabrasilia.com.br",
    responsavel: "Ana Souza",
    inscricaoEstadual: "N/A",
    inscricaoMunicipal: "N/A",
    ramoAtividade: "Prestação de Serviços Administrativos",
    taxaPendente: true,
  },
  {
    nome: "Teste SICAF 100% LTDA",
    cnpj: "45.678.901/0001-33",
    sicaf: "ativo",
    validade: "10/09/2026",
    proximoPasso: "SICAF 100% atualizado. Use o assistente para monitorar.",
    acao: { label: "Ver detalhes", variant: "outline", icon: RefreshCw },
    endereco: "Av. Teste, 100 - Centro",
    cidade: "Curitiba",
    uf: "PR",
    telefone: "(41) 9999-8888",
    email: "teste@sicaf100.com.br",
    responsavel: "Lucas Teste",
    inscricaoEstadual: "111.222.333.444",
    inscricaoMunicipal: "1234567890",
    ramoAtividade: "Tecnologia da Informação",
    niveis: [1, 2, 3, 4, 5, 6],
    diasValidade: 94,
  },
];

export const statusLabel: Record<SicafStatus, { label: string; status: "ok" | "warn" | "danger" | "idle" }> = {
  ativo: { label: "SICAF Ativo", status: "ok" },
  atencao: { label: "SICAF Vencendo", status: "warn" },
  vencido: { label: "SICAF Vencido", status: "danger" },
  sem_cadastro: { label: "Sem cadastro SICAF", status: "idle" },
};

export function formatSicafValidade(empresa: EmpresaData): string {
  if (empresa.sicaf === "sem_cadastro") return "Sem cadastro";

  const dias = empresa.diasValidade;
  const diasLabel =
    dias != null
      ? ` · ${dias} ${dias === 1 ? "dia" : "dias"}`
      : "";

  if (empresa.sicaf === "vencido") {
    if (empresa.validade?.startsWith("Vencido")) return empresa.validade;
    if (empresa.validade) return `Vencido em ${empresa.validade}`;
    return "Vencido";
  }

  const data = empresa.validade?.replace(/^Validade\s+/i, "").trim();
  if (data) return `Validade ${data}${diasLabel}`;
  if (dias != null) return `${dias} ${dias === 1 ? "dia restante" : "dias restantes"}`;
  return "—";
}

export const NIVEIS_SICAF: { num: number; roman: string; nome: string; color: string }[] = [
  { num: 1, roman: "I", nome: "Habilitação", color: "#16a34a" },
  { num: 2, roman: "II", nome: "Habilitação Jurídica", color: "#16a34a" },
  { num: 3, roman: "III", nome: "Regularidade Fiscal Federal", color: "#f59e0b" },
  { num: 4, roman: "IV", nome: "Regularidade Fiscal Estadual/Municipal", color: "#2563eb" },
  { num: 5, roman: "V", nome: "Qualificação Técnica", color: "#dc2626" },
  { num: 6, roman: "VI", nome: "Qualificação Econômico-Financeira", color: "#dc2626" },
];

export type AptoSituacao = {
  apto: boolean;
  niveisAtualizados: number;
  bannerTitulo: string;
  bannerSubtitulo: string;
  tooltipTitulo: string;
  tooltipDescricao: string;
};

/**
 * APTO = ao menos um nível com situação real vinda do Assistente / Situação do Fornecedor.
 * INAPTO = nenhum nível atualizado ainda (independe de SICAF pago ou validade financeira).
 */
export function countNiveisAtualizadosAssistente(empresa: EmpresaData): number {
  return NIVEIS_SICAF.filter((n) => {
    const st = empresa.detalhesNiveis?.[n.num]?.status;
    return st === "validado" || st === "vencendo" || st === "vencido";
  }).length;
}

export function isEmpresaApto(empresa: EmpresaData): boolean {
  return countNiveisAtualizadosAssistente(empresa) > 0;
}

/** Licença SICAF paga e ativa, mas nenhum nível sincronizado pelo Assistente (INAPTO). */
export function isSicafPagoInapto(empresa: EmpresaData): boolean {
  if (isEmpresaApto(empresa)) return false;
  if (empresa.taxaPendente) return false;
  return empresa.sicaf === "ativo";
}

export function getAptoSituacao(empresa: EmpresaData): AptoSituacao {
  const niveisAtualizados = countNiveisAtualizadosAssistente(empresa);
  const apto = niveisAtualizados > 0;
  return {
    apto,
    niveisAtualizados,
    bannerTitulo: apto ? "APTO" : "INAPTO",
    bannerSubtitulo: apto
      ? `${niveisAtualizados} de 6 níveis atualizados pelo Assistente`
      : "Níveis ainda não atualizados — envie a Situação do Fornecedor",
    tooltipTitulo: apto ? "Empresa APTA para licitar" : "Empresa INAPTA para licitar",
    tooltipDescricao: apto
      ? "Pelo menos um nível do SICAF foi sincronizado pelo Assistente com a Situação do Fornecedor. Isso indica que há dados reais de habilitação — independente da licença SICAF (pagamento)."
      : "Nenhum nível foi sincronizado pelo Assistente ainda. Mesmo com licença SICAF paga e válida, a empresa só fica APTA após enviar a Situação do Fornecedor e atualizar os níveis.",
  };
}

const situacaoAptoVisual = {
  apto: {
    solid: "bg-success text-white border-success/80",
    soft: "border-success/40 bg-success/15 text-success",
    gradient: "bg-gradient-to-br from-success via-success/90 to-success/70 text-white",
    card: "border-success/40 bg-success/5",
  },
  inapto: {
    solid: "bg-red-600 text-white border-red-700 shadow-sm",
    soft: "bg-red-600 text-white border-red-700 shadow-sm",
    gradient: "bg-gradient-to-br from-red-600 via-red-700 to-red-800 text-white",
    card: "border-red-600/50 bg-red-600 text-white",
  },
} as const;

export function SituacaoAptoIndicador({
  situacao,
  variant = "pill",
  className,
  showSubtitulo = false,
}: {
  situacao: AptoSituacao;
  variant?: "pill" | "banner" | "sidebar" | "card";
  className?: string;
  showSubtitulo?: boolean;
}) {
  const visual = situacao.apto ? situacaoAptoVisual.apto : situacaoAptoVisual.inapto;

  const triggerClass = cn(
    "inline-flex cursor-help transition-opacity hover:opacity-95",
    variant === "pill" &&
      cn(
        "shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        visual.solid,
      ),
    variant === "banner" &&
      cn(
        "w-full flex-col items-center justify-center gap-0.5 px-4 py-2.5 text-center sm:flex-row sm:gap-2",
        visual.gradient,
      ),
    variant === "sidebar" &&
      cn("w-full flex-col rounded-lg px-3 py-2.5 text-center", visual.solid),
    variant === "card" &&
      cn("w-full flex-col rounded-xl border p-4 space-y-2 text-left", visual.card),
    className,
  );

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button type="button" className={triggerClass}>
          {variant === "pill" && (
            <>
              {situacao.apto ? (
                <CheckCircle2 className="h-3 w-3 shrink-0" />
              ) : (
                <AlertCircle className="h-3 w-3 shrink-0" />
              )}
              {situacao.bannerTitulo}
            </>
          )}
          {variant === "banner" && (
            <>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  {situacao.bannerTitulo} — {situacao.apto ? "PODE LICITAR" : "AGUARDANDO NÍVEIS"}
                </span>
              </div>
              <span className="text-[10px] font-medium opacity-90">{situacao.bannerSubtitulo}</span>
            </>
          )}
          {variant === "sidebar" && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-90">
                Situação para licitar
              </p>
              <p className="mt-0.5 text-base font-bold">{situacao.bannerTitulo}</p>
              <p className="mt-1 text-[10px] font-medium leading-snug opacity-90">
                {situacao.bannerSubtitulo}
              </p>
            </>
          )}
          {variant === "card" && (
            <>
              <div
                className={cn(
                  "flex items-center gap-2 text-sm font-semibold",
                  !situacao.apto && "text-white",
                )}
              >
                <ShieldCheck className="h-4 w-4 shrink-0" />
                Situação para licitar
              </div>
              <p className={cn("text-xl font-bold", !situacao.apto && "text-white")}>
                {situacao.bannerTitulo}
              </p>
              {showSubtitulo && (
                <p
                  className={cn(
                    "text-xs",
                    situacao.apto ? "text-muted-foreground" : "text-white/90",
                  )}
                >
                  {situacao.bannerSubtitulo}
                </p>
              )}
            </>
          )}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 space-y-2" side="top" align="start">
        <div className="flex items-start gap-2">
          {situacao.apto ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          )}
          <div className="space-y-1.5">
            <p className="text-sm font-semibold leading-tight">{situacao.tooltipTitulo}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{situacao.tooltipDescricao}</p>
            <p className="text-[11px] font-medium text-foreground/80 pt-0.5 border-t">
              {situacao.bannerSubtitulo}
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

type NivelStatus = "validado" | "vencendo" | "vencido" | "pendente" | "nao_cadastrado";

interface NivelDetalhe {
  status: NivelStatus;
  vencimento?: string;
  certidao?: string;
  observacao?: string;
}

const statusNivelMeta: Record<NivelStatus, { label: string; tone: "ok" | "warn" | "danger" | "idle"; dot: string }> = {
  validado: { label: "Validado", tone: "ok", dot: "bg-success" },
  vencendo: { label: "Vencendo em breve", tone: "warn", dot: "bg-warning" },
  vencido: { label: "Vencido", tone: "danger", dot: "bg-danger" },
  pendente: { label: "Pendente", tone: "warn", dot: "bg-warning" },
  nao_cadastrado: { label: "Não cadastrado", tone: "idle", dot: "bg-muted-foreground/50" },
};

function detalhesParaBase(empresa: EmpresaData, num: number): NivelDetalhe {
  if (empresa.detalhesNiveis?.[num]) return empresa.detalhesNiveis[num];
  const ativo = (empresa.niveis ?? []).includes(num);
  if (!ativo) return { status: "nao_cadastrado" };
  if (empresa.sicaf === "vencido") return { status: "vencido", vencimento: empresa.validade };
  if (empresa.sicaf === "atencao") return { status: "vencendo", vencimento: empresa.validade };
  return { status: "validado", vencimento: empresa.validade };
}

/** Apenas dados reais do Assistente/banco — sem inferir pelo pagamento SICAF. */
function detalhesNivelReal(empresa: EmpresaData, num: number): NivelDetalhe {
  return empresa.detalhesNiveis?.[num] ?? { status: "nao_cadastrado" };
}

/** Quantidade de níveis com situação positiva (validado, vencendo ou pendente). */
export function countNiveisValidados(empresa: EmpresaData): number {
  return NIVEIS_SICAF.filter((n) => {
    const det = detalhesParaBase(empresa, n.num);
    return det.status === "validado" || det.status === "vencendo" || det.status === "pendente";
  }).length;
}

/** Com 2+ níveis validados, I e II são sempre exibidos como habilitados. */
function deveGarantirNiveisBase(empresa: EmpresaData): boolean {
  return empresa.sicaf !== "sem_cadastro" && countNiveisValidados(empresa) >= 2;
}

function detalheNivelBaseForcado(empresa: EmpresaData): NivelDetalhe {
  if (empresa.sicaf === "vencido") return { status: "vencido", vencimento: empresa.validade };
  if (empresa.sicaf === "atencao") return { status: "vencendo", vencimento: empresa.validade };
  return { status: "validado", vencimento: empresa.validade };
}

function detalhesPara(empresa: EmpresaData, num: number): NivelDetalhe {
  if (deveGarantirNiveisBase(empresa) && (num === 1 || num === 2)) {
    return detalheNivelBaseForcado(empresa);
  }
  return detalhesParaBase(empresa, num);
}

/** Níveis exibidos como ativos no card (inclui I e II quando a regra de base se aplica). */
export function countNiveisAtivosExibicao(empresa: EmpresaData): number {
  return NIVEIS_SICAF.filter((n) => detalhesPara(empresa, n.num).status !== "nao_cadastrado").length;
}

export function niveisMapParaExibicao(empresa: EmpresaData): Record<number, NivelStatus> {
  const out: Record<number, NivelStatus> = {};
  for (const n of NIVEIS_SICAF) {
    out[n.num] = detalhesPara(empresa, n.num).status;
  }
  return out;
}

export function segmentoEmpresaCard(empresa: EmpresaData): string {
  const ativos = NIVEIS_SICAF.filter((n) => detalhesPara(empresa, n.num).status !== "nao_cadastrado");
  const maxNivel = ativos.length ? Math.max(...ativos.map((n) => n.num)) : 0;
  const roman = NIVEIS_SICAF.find((n) => n.num === maxNivel)?.roman;
  if (maxNivel > 0) return `Nível I-${roman}`;
  if (empresa.taxaPendente) return "Aguardando pagamento";
  return "Sem níveis cadastrados";
}

export function progressoNiveisEmpresa(empresa: EmpresaData): number {
  return Math.round((countNiveisAtivosExibicao(empresa) / NIVEIS_SICAF.length) * 100);
}

export function enriquecerEmpresaComPainel(
  empresa: EmpresaData,
  painel: EmpresaGerenciarPainel,
): EmpresaData {
  return mergeEmpresaComPainel(empresa, painel);
}

export function NiveisSicafBadges({ empresa, compact }: { empresa: EmpresaData; compact?: boolean }) {
  return (
    <div className={compact ? "" : "mt-3"}>
      {!compact && (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
          Níveis SICAF
        </p>
      )}
      <div className="flex items-center gap-1.5">
        {NIVEIS_SICAF.map((n) => {
          const det = detalhesPara(empresa, n.num);
          const inativo = det.status === "nao_cadastrado";
          const meta = statusNivelMeta[det.status];
          return (
            <HoverCard key={n.num} openDelay={120} closeDelay={80}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  aria-label={`Nível ${n.roman} - ${n.nome}`}
                  className={`relative flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white outline-none transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    inativo ? "opacity-25 grayscale" : "shadow-sm"
                  }`}
                  style={{ backgroundColor: n.color }}
                >
                  {n.roman}
                  {!inativo && (
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${meta.dot}`}
                    />
                  )}
                </button>
              </HoverCardTrigger>
              <HoverCardContent className="w-72 p-0" side="top" align="center">
                <div
                  className="flex items-center gap-2 rounded-t-md px-3 py-2 text-white"
                  style={{ backgroundColor: n.color }}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold">
                    {n.roman}
                  </span>
                  <div className="text-xs">
                    <p className="font-semibold leading-tight">Nível {n.roman}</p>
                    <p className="text-[11px] opacity-90 leading-tight">{n.nome}</p>
                  </div>
                </div>
                <div className="space-y-2 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Situação</span>
                    <StatusBadge status={meta.tone}>{meta.label}</StatusBadge>
                  </div>
                  {det.certidao && (
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-muted-foreground">Certidão</span>
                      <span className="text-right font-medium">{det.certidao}</span>
                    </div>
                  )}
                  {det.vencimento && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Vencimento</span>
                      <span
                        className={`font-medium ${
                          det.status === "vencido"
                            ? "text-danger"
                            : det.status === "vencendo"
                            ? "text-warning-foreground"
                            : ""
                        }`}
                      >
                        {det.vencimento}
                      </span>
                    </div>
                  )}
                  {det.observacao && (
                    <p className="rounded-md bg-muted/60 p-2 text-[11px] text-muted-foreground">
                      {det.observacao}
                    </p>
                  )}
                  {det.status === "nao_cadastrado" && (
                    <p className="rounded-md bg-muted/60 p-2 text-[11px] text-muted-foreground">
                      Este nível ainda não foi cadastrado para esta empresa.
                    </p>
                  )}
                </div>
              </HoverCardContent>
            </HoverCard>
          );
        })}
      </div>
    </div>
  );
}


type SectionId = "visao" | "sicaf" | "faltam" | "documentos" | "manutencao" | "certidoes" | "colaboradores" | "pagamento";

const ROMAN_TO_NUM: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };

function buildSectionMenu(badges?: EmpresaGerenciarPainel["badges"], situacao?: AptoSituacao) {
  const menu: { id: SectionId; label: string; icon: typeof FileText; badge?: string; tone?: "warn" | "danger" | "ok" }[] = [
    { id: "visao", label: "Visão geral", icon: Building2 },
    {
      id: "sicaf",
      label: "Meu SICAF",
      icon: ShieldCheck,
      badge: situacao ? situacao.bannerTitulo : undefined,
      tone: situacao?.apto ? "ok" : "danger",
    },
    {
      id: "faltam",
      label: "O que falta",
      icon: Sparkles,
      badge: badges?.faltam ? String(badges.faltam) : undefined,
      tone: "warn",
    },
    {
      id: "documentos",
      label: "Documentos",
      icon: FileText,
      badge: badges?.documentos,
    },
    {
      id: "manutencao",
      label: "Manutenção",
      icon: RefreshCw,
      badge: badges?.manutencao,
      tone: "ok",
    },
    {
      id: "certidoes",
      label: "Certidões",
      icon: ShieldCheck,
      badge: badges?.certidoes ? String(badges.certidoes) : undefined,
      tone: "danger",
    },
    {
      id: "colaboradores",
      label: "Colaboradores",
      icon: Users,
      badge: badges?.colaboradores,
    },
    { id: "pagamento", label: "Pagamento", icon: Receipt },
  ];
  return menu;
}

function mergeEmpresaComPainel(empresa: EmpresaData, painel: EmpresaGerenciarPainel): EmpresaData {
  const detalhesNiveis: Record<number, NivelDetalhe> = { ...(empresa.detalhesNiveis || {}) };
  for (const [roman, info] of Object.entries(painel.niveisDetail || {})) {
    const num = ROMAN_TO_NUM[roman];
    if (!num) continue;
    detalhesNiveis[num] = {
      status: info.status as NivelStatus,
      observacao: info.observacao,
    };
  }
  return {
    ...empresa,
    clienteId: empresa.clienteId ?? painel.cliente.id,
    nome: painel.cliente.razaoSocial || empresa.nome,
    email: painel.cliente.email || empresa.email,
    telefone: painel.cliente.telefone || empresa.telefone,
    endereco: painel.cliente.endereco || empresa.endereco,
    cep: formatCepDisplay(painel.cliente.cep) || empresa.cep || "",
    cidade: painel.cliente.cidade || empresa.cidade,
    uf: painel.cliente.estado || empresa.uf,
    inscricaoEstadual: painel.cliente.inscricaoEstadual || "",
    inscricaoMunicipal: painel.cliente.inscricaoMunicipal || "",
    ramoAtividade: painel.cliente.ramoAtividade || "",
    responsavel: painel.cliente.responsavel || "",
    manutencaoAtiva: painel.manutencao.ativa,
    validade: painel.sicaf?.validade || empresa.validade,
    diasValidade: painel.sicaf?.diasValidade ?? empresa.diasValidade,
    detalhesNiveis,
    taxaPendente: painel.financeiro.taxaPendente,
  };
}

function GerenciarListaVazia({ texto }: { texto: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
      {texto}
    </div>
  );
}

function gerenciarItemAction(item: GerenciarItem): { label: string; onClick?: () => void } | undefined {
  if (item.arquivoUrl) {
    return { label: "Ver", onClick: () => window.open(item.arquivoUrl!, "_blank", "noopener") };
  }
  if (item.linkPdf) {
    return { label: "Nota", onClick: () => window.open(item.linkPdf!, "_blank", "noopener") };
  }
  if (item.linkBoleto) {
    return { label: "Boleto", onClick: () => window.open(item.linkBoleto!, "_blank", "noopener") };
  }
  if (item.status === "idle") return { label: "Enviar" };
  if (item.status === "danger" || item.status === "warn") return { label: "Resolver" };
  return { label: "Ver" };
}

function GerenciarItensLista({
  itens,
  vazio,
  resolveAction,
}: {
  itens: GerenciarItem[];
  vazio: string;
  resolveAction?: (item: GerenciarItem) => { label: string; onClick?: () => void } | undefined;
}) {
  if (!itens.length) return <GerenciarListaVazia texto={vazio} />;
  return (
    <div className="space-y-2">
      {itens.map((item, i) => {
        const action = resolveAction ? resolveAction(item) : gerenciarItemAction(item);
        return (
          <SectionItemRow
            key={item.id ?? `${item.titulo}-${i}`}
            status={item.status}
            title={item.titulo}
            desc={item.descricao}
            action={action}
          />
        );
      })}
    </div>
  );
}

function DocumentosPainelLista({ itens, vazio }: { itens: GerenciarItem[]; vazio: string }) {
  if (!itens.length) return <GerenciarListaVazia texto={vazio} />;

  const porNivel = itens.reduce<Record<string, GerenciarItem[]>>((acc, item) => {
    const key = item.nivel || "Outros";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const ordemNiveis = ["I", "II", "III", "IV", "V", "VI", "Outros"];

  return (
    <div className="space-y-5">
      {ordemNiveis.filter((n) => porNivel[n]?.length).map((nivel) => (
        <div key={nivel}>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
              {nivel === "Outros" ? "·" : nivel}
            </span>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {nivel === "Outros" ? "Outros arquivos" : `Nível ${nivel}`}
            </p>
          </div>
          <div className="space-y-2">
            {porNivel[nivel].map((item, i) => (
              <DocumentoPainelRow key={item.id ?? `${item.titulo}-${i}`} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DocumentoPainelRow({ item }: { item: GerenciarItem }) {
  const action = gerenciarItemAction(item);
  const enviado = item.status === "ok" || !!item.arquivoUrl;

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          item.status === "ok" ? "bg-success/15 text-success" :
          item.status === "warn" ? "bg-warning/15 text-warning-foreground" :
          item.status === "danger" ? "bg-danger/15 text-danger" :
          enviado ? "bg-primary/10 text-primary" :
          "bg-muted text-muted-foreground"
        }`}>
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight">{item.titulo}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{item.descricao}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {item.dataValidade && (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                <ShieldCheck className="h-2.5 w-2.5" />
                Validade {item.dataValidade}
              </span>
            )}
            {item.uploadManual === false && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700">
                Assistente
              </span>
            )}
            {!enviado && item.uploadManual !== false && (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                Pendente
              </span>
            )}
          </div>
        </div>
      </div>
      {action?.onClick && (
        <Button size="sm" variant="outline" onClick={action.onClick} className="shrink-0">
          {action.label}
        </Button>
      )}
    </div>
  );
}

function ColaboradoresPainelLista({ itens, vazio }: { itens: ColaboradorResumo[]; vazio: string }) {
  if (!itens.length) return <GerenciarListaVazia texto={vazio} />;

  return (
    <div className="space-y-2">
      {itens.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {c.nome
                .split(" ")
                .slice(0, 2)
                .map((p) => p[0])
                .join("")
                .toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{c.nome}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                {c.email && (
                  <span className="inline-flex items-center gap-1 truncate">
                    <Mail className="h-3 w-3 shrink-0" />
                    {c.email}
                  </span>
                )}
                {c.telefone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3 shrink-0" />
                    {c.telefone}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {c.papelLabel && (
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {c.papelLabel}
                  </span>
                )}
                {c.cargo && c.cargo !== c.papelLabel && (
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {c.cargo}
                  </span>
                )}
                {c.status === "convite" && (
                  <span className="rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning-foreground">
                    Convite pendente
                  </span>
                )}
                {c.status === "inativo" && (
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    Inativo
                  </span>
                )}
                {c.ultimoAcesso && (
                  <span className="text-[10px] text-muted-foreground">
                    Último acesso {c.ultimoAcesso}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionItemRow({
  title,
  desc,
  status,
  action,
}: {
  title: string;
  desc?: string;
  status: "ok" | "warn" | "danger" | "idle";
  action?: { label: string; onClick?: () => void };
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className={`mt-0.5 h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${
          status === "ok" ? "bg-success/15 text-success" :
          status === "warn" ? "bg-warning/15 text-warning-foreground" :
          status === "danger" ? "bg-danger/15 text-danger" :
          "bg-muted text-muted-foreground"
        }`}>
          {status === "ok" ? <CheckCircle2 className="h-5 w-5" /> :
           status === "danger" ? <X className="h-5 w-5" /> :
           <ShieldCheck className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm leading-tight">{title}</p>
          {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
        </div>
      </div>
      {action && (
        <Button size="sm" variant="outline" onClick={action.onClick} className="shrink-0">
          {action.label}
        </Button>
      )}
    </div>
  );
}

function mapCertStatusToNivel(s: GerenciarItem["status"]): NivelStatus {
  if (s === "ok") return "validado";
  if (s === "warn") return "vencendo";
  if (s === "danger") return "vencido";
  if (s === "idle") return "pendente";
  return "nao_cadastrado";
}

function SidebarEmpresaStatus({
  situacao,
  meta,
  validade,
}: {
  situacao: AptoSituacao;
  meta: { label: string; status: "ok" | "warn" | "danger" | "idle" };
  validade?: string | null;
}) {
  return (
    <div className="mb-3 space-y-2 rounded-xl border bg-card p-3 shadow-sm">
      <SituacaoAptoIndicador situacao={situacao} variant="sidebar" />
      <div className="rounded-lg bg-muted/50 px-3 py-2 space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Licença SICAF (pagamento)
        </p>
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={meta.status}>{meta.label}</StatusBadge>
        </div>
        {validade && (
          <p className="text-[11px] text-muted-foreground">Validade {validade}</p>
        )}
      </div>
    </div>
  );
}

function MeuSicafSection({
  empresa,
  meta,
  situacao,
  certidoesReais = [],
  onIrDocumentos,
}: {
  empresa: EmpresaData;
  meta: { label: string; status: "ok" | "warn" | "danger" | "idle" };
  situacao: AptoSituacao;
  certidoesReais?: GerenciarItem[];
  onIrDocumentos?: () => void;
}) {
  const niveis = NIVEIS_SICAF.map((n) => ({ ...n, det: detalhesNivelReal(empresa, n.num) }));
  const validados = niveis.filter((n) => n.det.status === "validado").length;
  const pendentes = niveis.filter((n) => n.det.status === "pendente" || n.det.status === "vencendo").length;
  const vencidos = niveis.filter((n) => n.det.status === "vencido").length;
  const naoCad = niveis.filter((n) => n.det.status === "nao_cadastrado").length;
  const niveisAssistente = situacao.niveisAtualizados;

  const certidoes = certidoesReais.map((c) => ({
    nome: c.titulo,
    emissor: c.emissor || "",
    vencimento: c.dataValidade || c.descricao,
    status: mapCertStatusToNivel(c.status),
  }));

  const certVencidas = certidoes.filter((c) => c.status === "vencido").length;
  const certPendentes = certidoes.filter((c) => c.status === "pendente" || c.status === "vencendo").length;
  const [resolverOpen, setResolverOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Hero — APTO/INAPTO em destaque; licença financeira abaixo */}
      <Card className="overflow-hidden border-0 shadow-soft">
        <div
          className={cn(
            "relative px-6 py-5 text-white",
            situacao.apto ? situacaoAptoVisual.apto.gradient : situacaoAptoVisual.inapto.gradient,
          )}
        >
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,white,transparent_60%)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider font-semibold opacity-80">
                Situação para licitar
              </p>
              <HoverCard openDelay={200} closeDelay={100}>
                <HoverCardTrigger asChild>
                  <button
                    type="button"
                    className="mt-1 text-left text-2xl font-bold leading-tight cursor-help hover:opacity-90"
                  >
                    {situacao.bannerTitulo}
                  </button>
                </HoverCardTrigger>
                <HoverCardContent className="w-80 space-y-2" side="bottom" align="start">
                  <div className="flex items-start gap-2">
                    {situacao.apto ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    )}
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold leading-tight">{situacao.tooltipTitulo}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {situacao.tooltipDescricao}
                      </p>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
              <p className="text-sm opacity-90 mt-1">{situacao.bannerSubtitulo}</p>
              {isSicafPagoInapto(empresa) && (
                <Button
                  type="button"
                  size="sm"
                  className="mt-3 gap-1.5 bg-white text-red-700 hover:bg-white/90 font-semibold shadow-md"
                  onClick={() => setResolverOpen(true)}
                >
                  <Rocket className="h-3.5 w-3.5" />
                  Resolver meu SICAF
                </Button>
              )}
              {!situacao.apto && meta.status === "ok" && !isSicafPagoInapto(empresa) && (
                <p className="mt-2 text-xs rounded-lg bg-white/15 px-3 py-2 leading-snug">
                  A licença SICAF está paga e válida, mas os níveis ainda não foram sincronizados
                  pelo Assistente. Envie a Situação do Fornecedor para ficar APTO.
                </p>
              )}
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
              {situacao.apto ? (
                <CheckCircle2 className="h-7 w-7" />
              ) : (
                <AlertCircle className="h-7 w-7" />
              )}
            </div>
          </div>
          <div className="relative mt-5 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl bg-white/15 backdrop-blur px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider opacity-80">Níveis Assistente</p>
              <p className="font-bold mt-0.5">{niveisAssistente} de 6</p>
            </div>
            <div className="rounded-xl bg-white/15 backdrop-blur px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider opacity-80">Licença SICAF</p>
              <p className="font-bold mt-0.5 truncate">{meta.label}</p>
            </div>
            <div className="rounded-xl bg-white/15 backdrop-blur px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider opacity-80">Validade</p>
              <p className="font-bold mt-0.5">{empresa.validade ?? "—"}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard tone="ok" icon={<CheckCircle2 className="h-5 w-5" />} label="Validados" value={validados} />
        <KpiCard tone="warn" icon={<ShieldCheck className="h-5 w-5" />} label="Pendentes" value={pendentes} />
        <KpiCard tone="danger" icon={<X className="h-5 w-5" />} label="Vencidos" value={vencidos} />
        <KpiCard tone="idle" icon={<Plus className="h-5 w-5" />} label="Não cadastrados" value={naoCad} />
      </div>

      {/* Níveis */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h4 className="text-lg font-bold">Níveis do SICAF</h4>
          <p className="text-xs text-muted-foreground">{validados} de 6 validados</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {niveis.map((n) => {
            const sMeta = statusNivelMeta[n.det.status];
            return (
              <div
                key={n.num}
                className="group relative overflow-hidden rounded-2xl border bg-card p-4 transition hover:shadow-soft hover:-translate-y-0.5"
              >
                <div
                  className="absolute top-0 left-0 h-full w-1.5"
                  style={{ backgroundColor: n.color }}
                />
                <div className="flex items-start gap-3 pl-2">
                  <div
                    className="h-11 w-11 shrink-0 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm"
                    style={{ backgroundColor: n.color }}
                  >
                    {n.roman}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Nível {n.roman}</p>
                        <p className="font-semibold text-sm leading-tight mt-0.5">{n.nome}</p>
                      </div>
                      <StatusBadge status={sMeta.tone}>{sMeta.label}</StatusBadge>
                    </div>
                    {n.det.vencimento && (
                      <p className={`text-xs mt-2 ${
                        n.det.status === "vencido" ? "text-danger font-medium" :
                        n.det.status === "vencendo" ? "text-warning-foreground font-medium" :
                        "text-muted-foreground"
                      }`}>
                        {n.det.status === "vencido" ? "Venceu em " : "Válido até "}
                        {n.det.vencimento}
                      </p>
                    )}
                    {n.det.status === "nao_cadastrado" && (
                      <p className="text-xs text-muted-foreground mt-2">Ainda não cadastrado nesta empresa.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Certidões */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h4 className="text-lg font-bold">Certidões</h4>
          <p className="text-xs text-muted-foreground">
            {certVencidas} vencida{certVencidas !== 1 ? "s" : ""} · {certPendentes} pendente{certPendentes !== 1 ? "s" : ""}
          </p>
        </div>
        {certidoes.length === 0 ? (
          <GerenciarListaVazia texto="Nenhuma certidão cadastrada para esta empresa." />
        ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {certidoes.map((c) => {
            const cMeta = statusNivelMeta[c.status];
            return (
              <div
                key={c.nome}
                className={`rounded-2xl border bg-card p-4 transition hover:shadow-soft ${
                  c.status === "vencido" ? "border-danger/40" :
                  c.status === "pendente" ? "border-warning/40" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${
                      c.status === "validado" ? "bg-success/15 text-success" :
                      c.status === "vencido" ? "bg-danger/15 text-danger" :
                      "bg-warning/15 text-warning-foreground"
                    }`}>
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm leading-tight">{c.nome}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.emissor}</p>
                    </div>
                  </div>
                  <StatusBadge status={cMeta.tone}>{cMeta.label}</StatusBadge>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 pt-3 border-t border-dashed">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Vencimento</p>
                    <p className={`text-sm font-medium mt-0.5 truncate ${
                      c.status === "vencido" ? "text-danger" :
                      c.status === "pendente" ? "text-warning-foreground" : ""
                    }`}>
                      {c.vencimento}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={c.status === "validado" ? "outline" : "default"}
                    className="shrink-0 gap-1.5"
                    onClick={() => onIrDocumentos?.()}
                  >
                    {c.status === "validado" ? "Ver" : "Resolver"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Ações rápidas */}
      <div className="rounded-2xl border-2 border-dashed bg-muted/20 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="font-semibold flex items-center gap-2"><Rocket className="h-4 w-4 text-primary" /> Atualize seu SICAF</p>
            <p className="text-sm text-muted-foreground mt-1">
              Mantemos sua empresa habilitada para licitações em todo o Brasil.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/documentos" search={{ cnpj: empresa.cnpj }}>Enviar documentos</Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/sicaf"><RefreshCw className="h-3.5 w-3.5" /> Atualizar SICAF</Link>
            </Button>
          </div>
        </div>
      </div>

      <ResolverSicafInaptoModal
        open={resolverOpen}
        onOpenChange={setResolverOpen}
        empresaNome={empresa.nome}
        cnpj={empresa.cnpj}
      />
    </div>
  );
}

function KpiCard({
  tone, icon, label, value,
}: {
  tone: "ok" | "warn" | "danger" | "idle";
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  const toneCls =
    tone === "ok" ? "bg-success/10 text-success border-success/20" :
    tone === "warn" ? "bg-warning/10 text-warning-foreground border-warning/30" :
    tone === "danger" ? "bg-danger/10 text-danger border-danger/20" :
    "bg-muted text-muted-foreground border-border";
  return (
    <div className={`rounded-2xl border p-4 ${toneCls}`}>
      <div className="flex items-center justify-between">
        <div className="h-9 w-9 rounded-xl bg-white/60 dark:bg-black/20 flex items-center justify-center">
          {icon}
        </div>
        <p className="text-3xl font-bold tabular-nums">{value}</p>
      </div>
      <p className="text-xs font-medium mt-2 opacity-90">{label}</p>
    </div>
  );
}


export function EmpresaDetalhesSheet({
  empresa,
  open,
  onOpenChange,
  manutencaoAtivada,
  onAtivar,
  onCancelar,
  onEmpresaUpdated,
}: {
  empresa: EmpresaData | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  manutencaoAtivada: Record<string, number>;
  onAtivar: (cnpj: string, dia: number) => void;
  onCancelar?: (cnpj: string) => void;
  onEmpresaUpdated?: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<Partial<EmpresaData>>({});
  const [section, setSection] = useState<SectionId>("visao");
  const [manutencaoModal, setManutencaoModal] = useState<"ativar" | "gerenciar" | null>(null);
  const [taxaSicafModal, setTaxaSicafModal] = useState(false);
  const [taxaSicafPagaLocal, setTaxaSicafPagaLocal] = useState<Record<string, boolean>>({});
  const [painel, setPainel] = useState<EmpresaGerenciarPainel | null>(null);
  const [loadingPainel, setLoadingPainel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cepBuscando, setCepBuscando] = useState(false);

  const empresaExibida = empresa
    ? painel
      ? mergeEmpresaComPainel(empresa, painel)
      : empresa
    : null;

  const carregarPainel = async (clienteId: number) => {
    setLoadingPainel(true);
    const res = await fetchEmpresaGerenciar(clienteId);
    setLoadingPainel(false);
    if (!res.ok || !res.painel) {
      toast.error(res.error || "Não foi possível carregar os dados da empresa");
      return;
    }
    setPainel(res.painel);
  };

  useEffect(() => {
    if (!open || !empresa?.clienteId) {
      if (!open) {
        setPainel(null);
        setEditando(false);
        setForm({});
        setSection("visao");
      }
      return;
    }
    void carregarPainel(empresa.clienteId);
  }, [open, empresa?.clienteId]);

  const startEditing = () => {
    if (!empresaExibida) return;
    setForm({ ...empresaExibida });
    setEditando(true);
  };
  const cancelEditing = () => { setEditando(false); setForm({}); };
  const saveEditing = async () => {
    if (!empresa?.clienteId) return;
    setSaving(true);
    const res = await salvarEmpresaGerenciar(empresa.clienteId, {
      telefone: form.telefone,
      cep: form.cep,
      endereco: form.endereco,
      cidade: form.cidade,
      uf: form.uf,
      ramoAtividade: form.ramoAtividade,
      inscricaoEstadual: form.inscricaoEstadual,
      inscricaoMunicipal: form.inscricaoMunicipal,
      responsavel: form.responsavel,
    });
    setSaving(false);
    if (!res.ok || !res.painel) {
      toast.error(res.error || "Erro ao salvar dados");
      return;
    }
    setPainel(res.painel);
    setEditando(false);
    setForm({});
    toast.success("Dados atualizados com sucesso");
    onEmpresaUpdated?.();
  };
  const updateField = (field: keyof EmpresaData, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const buscarCep = async (cepValue?: string) => {
    const cep = cepValue ?? form.cep ?? "";
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;

    setCepBuscando(true);
    const res = await fetchCep(digits);
    setCepBuscando(false);

    if (!res.ok || !res.data) {
      toast.error(res.error || "CEP não encontrado");
      return;
    }

    const endereco = enderecoFromCep(res.data);
    setForm((p) => ({
      ...p,
      cep: formatCepDisplay(res.data!.cep || digits),
      endereco: endereco || p.endereco,
      cidade: res.data!.cidade || p.cidade,
      uf: res.data!.estado || p.uf,
    }));
    toast.success("Endereço preenchido pelo CEP");
  };

  if (!empresa || !empresaExibida) return null;

  const meta = statusLabel[empresaExibida.sicaf];
  const situacaoApto = getAptoSituacao(empresaExibida);
  const sectionMenu = buildSectionMenu(painel?.badges, situacaoApto);
  const manutencaoAtiva =
    !!painel?.manutencao.ativa ||
    !!empresaExibida.manutencaoAtiva ||
    !!manutencaoAtivada[empresa.cnpj];
  const diaVencimentoManut =
    painel?.manutencao.diaVencimento ?? manutencaoAtivada[empresa.cnpj];

  const handleAtivarManutencao = (cnpj: string, dia: number) => {
    onAtivar(cnpj, dia);
    setManutencaoModal("gerenciar");
    if (empresa?.clienteId) void carregarPainel(empresa.clienteId);
    onEmpresaUpdated?.();
  };
  const taxaPendente = painel?.financeiro.taxaPendente ?? empresaExibida.taxaPendente ?? false;
  const taxaPaga = painel?.financeiro.taxaPaga || taxaSicafPagaLocal[empresa.cnpj] || false;

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl md:max-w-4xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-xl leading-tight truncate">{empresaExibida.nome}</SheetTitle>
              <SheetDescription className="mt-1 flex flex-wrap items-center gap-2">
                <span>CNPJ {empresaExibida.cnpj}</span>
                <SituacaoAptoIndicador situacao={situacaoApto} variant="pill" />
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  Licença:
                  <StatusBadge status={meta.status}>{meta.label}</StatusBadge>
                </span>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-1 min-h-0">
          {/* Menu lateral */}
          <nav className="hidden md:flex w-56 shrink-0 flex-col border-r bg-muted/30 p-3 gap-1">
            <SidebarEmpresaStatus
              situacao={situacaoApto}
              meta={meta}
              validade={empresaExibida.validade ?? painel?.sicaf?.validade}
            />
            {sectionMenu.map((s) => {
              const Icon = s.icon;
              const active = s.id === section;
              if (s.id === "certidoes") {
                const to = "/certidoes";
                return (
                  <Link
                    key={s.id}
                    to={to}
                    search={{ cnpj: empresa.cnpj }}
                    className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm text-left transition hover:bg-muted text-foreground`}
                    onClick={() => onOpenChange(false)}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{s.label}</span>
                    </span>
                    {s.badge && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        s.tone === "danger" ? "bg-red-600 text-white" :
                        s.tone === "warn" ? "bg-warning/20 text-warning-foreground" :
                        s.tone === "ok" ? "bg-success/15 text-success" :
                        "bg-muted text-muted-foreground"
                      }`}>{s.badge}</span>
                    )}
                  </Link>
                );
              }
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setSection(s.id); setEditando(false); }}
                  className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm text-left transition ${
                    active ? "bg-primary text-primary-foreground shadow-soft" : "hover:bg-muted text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </span>
                  {s.badge && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      active ? "bg-primary-foreground/20 text-primary-foreground" :
                      s.tone === "danger" ? "bg-red-600 text-white" :
                      s.tone === "warn" ? "bg-warning/20 text-warning-foreground" :
                      s.tone === "ok" ? "bg-success/15 text-success" :
                      "bg-muted text-muted-foreground"
                    }`}>{s.badge}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Mobile section tabs */}
          <div className="md:hidden absolute top-[88px] left-0 right-0 border-b bg-card px-3 py-2 overflow-x-auto flex gap-2 z-10">
            {sectionMenu.map((s) => (
              <button
                key={s.id}
                onClick={() => { setSection(s.id); setEditando(false); }}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full ${section === s.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <ScrollArea className="flex-1 md:pt-0 pt-12">
            <div className="px-6 py-6 space-y-6">
              {loadingPainel && !painel ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">Carregando dados da empresa...</p>
                </div>
              ) : (
              <>
              {section === "visao" && !editando && (
                <div className="space-y-6">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SituacaoAptoIndicador
                      situacao={situacaoApto}
                      variant="card"
                      showSubtitulo
                    />
                    <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Receipt className="h-4 w-4 text-primary" />
                        Licença SICAF (financeiro)
                      </div>
                      <p className="text-sm font-medium mt-0.5">
                        <StatusBadge status={meta.status}>{meta.label}</StatusBadge>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Validade {empresaExibida.validade ?? painel?.sicaf?.validade ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" />Próximo passo</div>
                    <p className="text-sm font-medium">{empresaExibida.proximoPasso}</p>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-primary" />Dados Cadastrais</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><p className="text-xs text-muted-foreground">Razão Social</p><p className="text-sm font-medium mt-0.5">{empresaExibida.nome || "—"}</p></div>
                      <div><p className="text-xs text-muted-foreground">CNPJ</p><p className="text-sm font-medium mt-0.5">{empresaExibida.cnpj}</p></div>
                      <div><p className="text-xs text-muted-foreground">Inscrição Estadual</p><p className="text-sm font-medium mt-0.5">{empresaExibida.inscricaoEstadual || "—"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Inscrição Municipal</p><p className="text-sm font-medium mt-0.5">{empresaExibida.inscricaoMunicipal || "—"}</p></div>
                      <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Ramo de Atividade</p><p className="text-sm font-medium mt-0.5">{empresaExibida.ramoAtividade || "—"}</p></div>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-primary" />Endereço e Contato</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><p className="text-xs text-muted-foreground">CEP</p><p className="text-sm font-medium mt-0.5">{empresaExibida.cep || "—"}</p></div>
                      <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Endereço</p><p className="text-sm font-medium mt-0.5">{empresaExibida.endereco || "—"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Cidade / UF</p><p className="text-sm font-medium mt-0.5">{empresaExibida.cidade || "—"} / {empresaExibida.uf || "—"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Telefone</p><p className="text-sm font-medium mt-0.5">{empresaExibida.telefone || "—"}</p></div>
                      <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">E-mail</p><p className="text-sm font-medium mt-0.5">{empresaExibida.email || "—"}</p></div>
                      <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Responsável legal</p><p className="text-sm font-medium mt-0.5">{empresaExibida.responsavel || "—"}</p></div>
                    </div>
                  </div>
                </div>
              )}

              {section === "visao" && editando && (
                <div className="space-y-5">
                  <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Dados fixos do cadastro
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Razão Social</Label>
                        <Input
                          value={form.nome ?? ""}
                          readOnly
                          className="bg-muted/50 cursor-not-allowed"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>CNPJ</Label>
                        <Input
                          value={form.cnpj ?? ""}
                          readOnly
                          className="bg-muted/50 cursor-not-allowed font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>E-mail</Label>
                        <Input
                          type="email"
                          value={form.email ?? ""}
                          readOnly
                          className="bg-muted/50 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Informações editáveis
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Ramo de atividade</Label>
                        <Input
                          value={form.ramoAtividade ?? ""}
                          onChange={(e) => updateField("ramoAtividade", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Inscrição Estadual</Label>
                        <Input
                          value={form.inscricaoEstadual ?? ""}
                          onChange={(e) => updateField("inscricaoEstadual", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Inscrição Municipal</Label>
                        <Input
                          value={form.inscricaoMunicipal ?? ""}
                          onChange={(e) => updateField("inscricaoMunicipal", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>CEP</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="00000-000"
                            maxLength={9}
                            value={form.cep ?? ""}
                            onChange={(e) => updateField("cep", formatCepInput(e.target.value))}
                            onBlur={() => void buscarCep()}
                            className="font-mono"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="shrink-0 gap-2"
                            disabled={cepBuscando}
                            onClick={() => void buscarCep()}
                          >
                            {cepBuscando ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                            Buscar
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Ao informar o CEP, preenchemos endereço, cidade e UF automaticamente.
                        </p>
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Endereço</Label>
                        <Input
                          value={form.endereco ?? ""}
                          onChange={(e) => updateField("endereco", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Cidade</Label>
                        <Input
                          value={form.cidade ?? ""}
                          onChange={(e) => updateField("cidade", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>UF</Label>
                        <Input
                          maxLength={2}
                          value={form.uf ?? ""}
                          onChange={(e) => updateField("uf", e.target.value.toUpperCase())}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Telefone</Label>
                        <Input
                          value={form.telefone ?? ""}
                          onChange={(e) => updateField("telefone", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Responsável legal</Label>
                        <Input
                          value={form.responsavel ?? ""}
                          onChange={(e) => updateField("responsavel", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {section === "sicaf" && (
                <MeuSicafSection
                  empresa={empresaExibida}
                  meta={meta}
                  situacao={situacaoApto}
                  certidoesReais={painel?.certidoes ?? []}
                  onIrDocumentos={() => setSection("documentos")}
                />
              )}

              {section === "faltam" && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-bold">O que falta para ficar 100%</h4>
                    <p className="text-sm text-muted-foreground">Pendências detectadas para esta empresa.</p>
                  </div>
                  <GerenciarItensLista
                    itens={painel?.pendencias ?? []}
                    vazio="Nenhuma pendência detectada. Sua empresa está em dia."
                    resolveAction={(item) => {
                      const base = gerenciarItemAction(item);
                      if (!base) return base;
                      if (
                        (base.label === "Resolver" || base.label === "Enviar") &&
                        !base.onClick
                      ) {
                        return {
                          ...base,
                          onClick: () => setSection("documentos"),
                        };
                      }
                      return base;
                    }}
                  />
                </div>
              )}

              {section === "documentos" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-bold">Documentos</h4>
                      <p className="text-sm text-muted-foreground">
                        Todos os documentos do SICAF por nível, com validade e situação.
                      </p>
                      {painel?.documentos?.length ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {painel.documentos.filter((d) => d.status === "ok" || d.arquivoUrl).length} de{" "}
                          {painel.documentos.length} enviados
                        </p>
                      ) : null}
                    </div>
                    <Button asChild size="sm" className="gap-2 shrink-0">
                      <Link to="/documentos" search={{ cnpj: empresaExibida.cnpj }}>
                        <Plus className="h-4 w-4" /> Enviar documentos
                      </Link>
                    </Button>
                  </div>
                  <DocumentosPainelLista
                    itens={painel?.documentos ?? []}
                    vazio="Nenhum documento cadastrado para esta empresa."
                  />
                </div>
              )}

              {section === "colaboradores" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-bold">Colaboradores</h4>
                      <p className="text-sm text-muted-foreground">
                        Pessoas com acesso a esta empresa.
                      </p>
                    </div>
                    <Button asChild size="sm" className="gap-2 shrink-0">
                      <Link to="/colaboradores" search={{ cnpj: empresa.cnpj }}>
                        <Users className="h-4 w-4" />
                        Gerenciar Colaboradores
                      </Link>
                    </Button>
                  </div>
                  <ColaboradoresPainelLista
                    itens={painel?.colaboradores ?? []}
                    vazio="Nenhum colaborador vinculado a esta empresa."
                  />
                </div>
              )}

              {section === "manutencao" && (
                <div className="space-y-4">
                  {manutencaoAtiva ? (
                    <>
                      <div className="rounded-xl border border-success/40 bg-success/5 p-5 flex items-start gap-3">
                        <CheckCircle2 className="h-6 w-6 text-success shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold">Manutenção ativa</p>
                          <p className="text-sm text-muted-foreground">
                            {painel?.manutencao.proximoVencimento
                              ? `Próximo boleto vence em ${painel.manutencao.proximoVencimento}`
                              : diaVencimentoManut
                                ? `Próximo boleto vence dia ${diaVencimentoManut}`
                                : "Plano de manutenção ativo"}
                            {painel?.manutencao.valorMensalFmt ? ` · ${painel.manutencao.valorMensalFmt}/mês` : ""}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setManutencaoModal("gerenciar")}>
                          Gerenciar
                        </Button>
                      </div>
                      <Separator />
                      <div>
                        <h4 className="text-base font-semibold mb-3">Últimas ações da CADBRASIL</h4>
                        <GerenciarItensLista
                          itens={
                            (painel?.manutencao.historico?.length
                              ? painel.manutencao.historico
                              : painel?.manutencao.acoes) ?? []
                          }
                          vazio="Nenhuma ação registrada ainda."
                        />
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border-2 border-dashed bg-gradient-to-br from-muted/40 to-transparent p-8 text-center">
                      <div className="mx-auto h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                        <Wrench className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <h4 className="text-lg font-bold">Sem manutenção ativa</h4>
                      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                        Esta empresa ainda não possui o plano de manutenção. Ative agora e deixe a CADBRASIL cuidar de tudo automaticamente.
                      </p>
                      <Button className="mt-5 gap-2" onClick={() => setManutencaoModal("ativar")}>
                        <Sparkles className="h-4 w-4" /> Ativar manutenção
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {section === "certidoes" && (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-bold">Situação das certidões</h4>
                      <p className="text-sm text-muted-foreground">Monitoramos a validade de todas as certidões obrigatórias.</p>
                    </div>
                    <Button asChild className="gap-2">
                      <Link to="/certidoes" search={{ cnpj: empresa.cnpj }}>
                        <ShieldCheck className="h-4 w-4" />
                        Gerenciar Certidões
                      </Link>
                    </Button>
                  </div>
                  <GerenciarItensLista
                    itens={painel?.certidoes ?? []}
                    vazio="Nenhuma certidão cadastrada para esta empresa."
                  />
                </div>
              )}

              {section === "pagamento" && (
                <div className="space-y-4">
                  {taxaPendente && !taxaPaga && (
                    <div className="rounded-2xl border-2 border-warning/40 bg-gradient-to-br from-warning/10 to-warning/5 p-5">
                      <div className="flex items-start gap-3">
                        <div className="h-11 w-11 shrink-0 rounded-xl bg-warning/20 text-warning-foreground flex items-center justify-center">
                          <Receipt className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold">Taxa SICAF pendente</p>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-danger/15 text-danger uppercase tracking-wider">
                              Não pago
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Esta empresa ainda não possui o pagamento da taxa CADBRASIL.
                            Sem ela não conseguimos iniciar a atualização do SICAF.
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                            <span className="font-semibold">
                              A partir de {painel?.financeiro.valorCadastroSicafFmt ?? "—"}
                            </span>
                            <span className="text-muted-foreground">· Liberação em até 24h</span>
                          </div>
                          <Button
                            className="mt-4 gap-2"
                            onClick={() => setTaxaSicafModal(true)}
                            disabled={!empresa.clienteId}
                          >
                            <Sparkles className="h-4 w-4" />
                            Ativar taxa SICAF
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {taxaPaga && (
                    <div className="rounded-xl border border-success/40 bg-success/5 p-4 flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-sm">Taxa SICAF paga</p>
                        <p className="text-xs text-muted-foreground">
                          Pagamento confirmado. Atualização do SICAF liberada.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border bg-card p-4">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        {manutencaoAtiva ? "Próxima cobrança" : "Manutenção mensal"}
                      </p>
                      {manutencaoAtiva ? (
                        <>
                          <p className="text-2xl font-bold mt-1">
                            {painel?.financeiro.proximaCobranca?.valorFmt ??
                              painel?.manutencao.valorMensalFmt ??
                              "—"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Manutenção
                            {painel?.financeiro.proximaCobranca?.data
                              ? ` · ${painel.financeiro.proximaCobranca.data}`
                              : painel?.manutencao.proximoVencimento
                                ? ` · ${painel.manutencao.proximoVencimento}`
                                : ""}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-lg font-semibold mt-1 text-muted-foreground">Não contratada</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Sem cobrança de manutenção nesta empresa — apenas a licença anual do SICAF.
                          </p>
                        </>
                      )}
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Licença anual</p>
                      <p className="text-2xl font-bold mt-1">
                        {painel?.financeiro.renovacaoSicaf?.valorFmt ?? painel?.financeiro.valorCadastroSicafFmt ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {painel?.financeiro.renovacaoSicaf?.data
                          ? `Renova em ${painel.financeiro.renovacaoSicaf.data}`
                          : "Renovação SICAF"}
                      </p>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="text-base font-semibold mb-3">Histórico</h4>
                    <GerenciarItensLista
                      itens={painel?.financeiro.historico ?? []}
                      vazio="Nenhum pagamento registrado para esta empresa."
                    />
                  </div>
                </div>
              )}
              </>
              )}
            </div>
          </ScrollArea>
        </div>

        <SheetFooter className="px-6 py-4 border-t flex flex-col sm:flex-row gap-3">
          {section === "visao" ? (
            !editando ? (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-2"><X className="h-4 w-4" />Fechar</Button>
                <Button onClick={startEditing} disabled={loadingPainel && !painel} className="gap-2"><Edit3 className="h-4 w-4" />Editar dados</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={cancelEditing} className="gap-2"><X className="h-4 w-4" />Cancelar</Button>
                <Button onClick={() => void saveEditing()} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar
                </Button>
              </>
            )
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-2 sm:ml-auto"><X className="h-4 w-4" />Fechar</Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
    <ManutencaoModal
      open={manutencaoModal !== null}
      onOpenChange={(v) => !v && setManutencaoModal(null)}
      empresa={empresaExibida}
      mode={manutencaoModal ?? (manutencaoAtiva ? "gerenciar" : "ativar")}
      diaVencimento={diaVencimentoManut}
      onAtivar={handleAtivarManutencao}
      onCancelar={(cnpj) => {
        onCancelar?.(cnpj);
        setManutencaoModal("ativar");
        if (empresa?.clienteId) void carregarPainel(empresa.clienteId);
        onEmpresaUpdated?.();
      }}
      onPaymentGenerated={() => {
        if (empresa?.clienteId) void carregarPainel(empresa.clienteId);
        onEmpresaUpdated?.();
      }}
    />
    <PagamentoSicafModal
      open={taxaSicafModal}
      onOpenChange={setTaxaSicafModal}
      empresa={{
        nome: empresaExibida.nome,
        cnpj: empresaExibida.cnpj,
        clienteId: empresa.clienteId!,
      }}
      onGerado={() => {
        if (empresa.clienteId) void carregarPainel(empresa.clienteId);
        onEmpresaUpdated?.();
      }}
      onPago={() => {
        setTaxaSicafPagaLocal((p) => ({ ...p, [empresa.cnpj]: true }));
        if (empresa.clienteId) void carregarPainel(empresa.clienteId);
        onEmpresaUpdated?.();
      }}
    />
    </>
  );
}


type WizardForm = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  ramoAtividade: string;
  cep: string;
  endereco: string;
  cidade: string;
  uf: string;
  responsavel: string;
  email: string;
  telefone: string;
  plano: "padrao" | "emergencial" | "";
  pagamento: "pix" | "boleto" | "";
};

const emptyForm: WizardForm = {
  cnpj: "", razaoSocial: "", nomeFantasia: "", inscricaoEstadual: "", inscricaoMunicipal: "",
  ramoAtividade: "", cep: "", endereco: "", cidade: "", uf: "", responsavel: "", email: "",
  telefone: "", plano: "", pagamento: "",
};

function formatCep(cep: string): string {
  const d = cep.replace(/\D/g, "");
  if (d.length !== 8) return cep;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function enderecoFromCnpjWs(d: {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
}): string {
  const parts: string[] = [];
  if (d.logradouro) {
    let line = d.logradouro;
    if (d.numero) line += `, ${d.numero}`;
    if (d.complemento) line += ` - ${d.complemento}`;
    parts.push(line);
  }
  if (d.bairro) parts.push(d.bairro);
  return parts.join(" - ");
}

const wizardSteps = [
  { id: 1, title: "CNPJ", desc: "Consulta na Receita", icon: Search },
  { id: 2, title: "Dados da empresa", desc: "Confirme as informações", icon: Building2 },
  { id: 3, title: "Contato", desc: "Responsável e contato", icon: User },
  { id: 4, title: "Plano", desc: "Escolha o cadastro SICAF", icon: Sparkles },
  { id: 5, title: "Pagamento", desc: "PIX ou Boleto", icon: Receipt },
  { id: 6, title: "Pronto", desc: "Empresa cadastrada", icon: CheckCircle2 },
];

export function NovaEmpresaWizard({
  open,
  onOpenChange,
  onEmpresaCriada,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEmpresaCriada?: () => void;
}) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardForm>(emptyForm);
  const [consultando, setConsultando] = useState(false);
  const [consultaOk, setConsultaOk] = useState(false);
  const [consultaErro, setConsultaErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [pagamentoGerado, setPagamentoGerado] = useState<PagamentoGerado | null>(null);
  const [pixModalOpen, setPixModalOpen] = useState(false);

  const update = <K extends keyof WizardForm>(k: K, v: WizardForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const reset = () => {
    setStep(1);
    setForm(emptyForm);
    setConsultando(false);
    setConsultaOk(false);
    setConsultaErro("");
    setSalvando(false);
    setClienteId(null);
    setPagamentoGerado(null);
    setPixModalOpen(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const consultarCNPJ = async () => {
    const doc = form.cnpj.replace(/\D/g, "");
    if (doc.length !== 14) {
      setConsultaOk(false);
      setConsultaErro("CNPJ deve ter 14 dígitos.");
      return;
    }

    setConsultando(true);
    setConsultaOk(false);
    setConsultaErro("");

    try {
      const res = await fetch(`/api/cnpj/${doc}`);
      const result = await res.json();

      if (!result.success) {
        setConsultaErro(result.error || "Erro ao consultar CNPJ");
        return;
      }

      const d = result.data as {
        razaoSocial?: string;
        nomeFantasia?: string;
        atividadePrincipal?: string;
        email?: string;
        telefone?: string;
        cep?: string;
        logradouro?: string;
        numero?: string;
        complemento?: string;
        bairro?: string;
        cidade?: string;
        estado?: string;
      };

      setForm((p) => ({
        ...p,
        cnpj: doc,
        razaoSocial: d.razaoSocial || p.razaoSocial,
        nomeFantasia: d.nomeFantasia || p.nomeFantasia,
        ramoAtividade: d.atividadePrincipal || p.ramoAtividade,
        cep: d.cep ? formatCep(d.cep) : p.cep,
        endereco: enderecoFromCnpjWs(d) || p.endereco,
        cidade: d.cidade || p.cidade,
        uf: d.estado || p.uf,
        email: d.email || p.email,
        telefone: d.telefone || p.telefone,
      }));
      setConsultaOk(true);
    } catch {
      setConsultaErro("Erro de conexão ao consultar CNPJ.");
    } finally {
      setConsultando(false);
    }
  };

  const canNext = () => {
    if (step === 1) return consultaOk;
    if (step === 2) return !!form.razaoSocial && !!form.ramoAtividade;
    if (step === 3) return !!form.responsavel && !!form.email && !!form.telefone;
    if (step === 4) return !!form.plano;
    if (step === 5) return !!form.pagamento;
    return true;
  };

  const next = () => setStep((s) => Math.min(6, s + 1));
  const prev = () => setStep((s) => Math.max(1, s - 1));

  const vencimentoBoletoIso = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  };

  const finalizarCadastro = async () => {
    if (!form.plano || !form.pagamento) return;

    setSalvando(true);
    try {
      const reg = await registrarEmpresa({
        documento: form.cnpj.replace(/\D/g, ""),
        razaoSocial: form.razaoSocial.trim(),
        nomeFantasia: form.nomeFantasia.trim() || undefined,
        inscricaoEstadual: form.inscricaoEstadual.trim() || undefined,
        inscricaoMunicipal: form.inscricaoMunicipal.trim() || undefined,
        email: form.email.trim() || undefined,
        telefone: form.telefone.trim() || undefined,
        cep: form.cep.replace(/\D/g, "") || undefined,
        endereco: form.endereco.trim() || undefined,
        cidade: form.cidade.trim() || undefined,
        estado: form.uf.trim() || undefined,
        ramoAtividade: form.ramoAtividade.trim() || undefined,
        responsavelNome: form.responsavel.trim() || undefined,
      });

      if (!reg.ok || !reg.clienteId) {
        toast.error(reg.error || "Erro ao cadastrar empresa");
        return;
      }

      setClienteId(reg.clienteId);
      onEmpresaCriada?.();

      const taxa = await gerarTaxaSicaf({
        clienteId: reg.clienteId,
        formaPagamento: form.pagamento,
        planoCodigo: PLANO_WIZARD_PARA_CODIGO[form.plano],
        dataVencimento: form.pagamento === "boleto" ? vencimentoBoletoIso() : undefined,
      });

      if (!taxa.ok || !taxa.pagamento) {
        toast.error(taxa.error || "Empresa criada, mas falhou ao gerar o pagamento.");
        setStep(6);
        return;
      }

      setPagamentoGerado(taxa.pagamento);
      if (form.pagamento === "pix") {
        setPixModalOpen(true);
      }
      toast.success(reg.message || "Empresa cadastrada! Conclua o pagamento para iniciar o SICAF.");
      setStep(6);
    } catch {
      toast.error("Erro de conexão ao cadastrar empresa.");
    } finally {
      setSalvando(false);
    }
  };

  const progresso = (step / wizardSteps.length) * 100;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden gap-0 h-[88vh] flex">
        {/* Sidebar steps */}
        <aside
          className="hidden md:flex w-[280px] shrink-0 flex-col text-white relative overflow-hidden"
          style={{
            backgroundImage:
              "linear-gradient(160deg, oklch(0.35 0.18 265) 0%, oklch(0.25 0.15 280) 60%, oklch(0.18 0.1 290) 100%)",
          }}
        >
          <div className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 10%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 80% 90%, rgba(120,200,255,0.3), transparent 45%)",
            }}
          />
          <div className="relative p-6 border-b border-white/10">
            <div className="flex items-center gap-2 text-sm font-medium text-white/80">
              <Sparkles className="h-4 w-4" />
              Nova empresa
            </div>
            <h2 className="mt-2 text-2xl font-bold leading-tight">Cadastre seu CNPJ em minutos</h2>
            <p className="mt-1 text-sm text-white/70">A CADBRASIL cuida do SICAF pra você.</p>
          </div>
          <div className="relative p-6 flex-1">
            <ol className="space-y-1">
              {wizardSteps.map((s) => {
                const Icon = s.icon;
                const active = s.id === step;
                const done = s.id < step;
                return (
                  <li key={s.id}>
                    <div className={`flex items-start gap-3 rounded-lg p-3 transition ${active ? "bg-white/15" : ""}`}>
                      <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold ${
                        done ? "bg-emerald-400 text-emerald-950" : active ? "bg-white text-primary" : "bg-white/10 text-white/70"
                      }`}>
                        {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${active ? "text-white" : "text-white/80"}`}>{s.title}</p>
                        <p className="text-xs text-white/60">{s.desc}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="relative p-6 border-t border-white/10">
            <div className="flex items-center justify-between text-xs text-white/70 mb-2">
              <span>Progresso</span>
              <span>{Math.round(progresso)}%</span>
            </div>
            <Progress value={progresso} className="h-1.5 bg-white/15" />
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="flex items-center justify-between px-8 py-4 border-b">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Etapa {step} de {wizardSteps.length}</p>
              <h3 className="text-lg font-semibold">{wizardSteps[step - 1].title}</h3>
            </div>
            <Button variant="ghost" size="icon" onClick={() => handleClose(false)}>
              <X className="h-5 w-5" />
            </Button>
          </header>

          <div className="md:hidden px-8 pt-4">
            <Progress value={progresso} className="h-1.5" />
          </div>

          <ScrollArea className="flex-1">
            <div className={`px-8 max-w-3xl mx-auto w-full ${step === 6 ? "py-4" : "py-8"}`}>
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-2xl font-bold">Qual o CNPJ da empresa?</h4>
                    <p className="text-muted-foreground mt-1">Vamos consultar a Receita Federal e preencher os dados automaticamente.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="w-cnpj" className="text-base">CNPJ</Label>
                    <div className="flex gap-2">
                      <Input
                        id="w-cnpj"
                        placeholder="00.000.000/0000-00"
                        value={form.cnpj}
                        onChange={(e) => { update("cnpj", e.target.value); setConsultaOk(false); setConsultaErro(""); }}
                        className="h-14 text-lg"
                      />
                      <Button onClick={consultarCNPJ} disabled={consultando} size="lg" className="h-14 px-6 gap-2">
                        {consultando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                        {consultando ? "Consultando..." : "Consultar"}
                      </Button>
                    </div>
                  </div>
                  {consultaErro && (
                    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 flex items-start gap-3">
                      <AlertCircle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-destructive">Não foi possível consultar</p>
                        <p className="text-sm text-muted-foreground">{consultaErro}</p>
                      </div>
                    </div>
                  )}
                  {consultaOk && (
                    <div className="rounded-xl border border-success/40 bg-success/5 p-5 flex items-start gap-3">
                      <CheckCircle2 className="h-6 w-6 text-success shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">CNPJ encontrado!</p>
                        <p className="text-sm text-muted-foreground">{form.razaoSocial} — {form.cidade}/{form.uf}</p>
                        <p className="text-sm text-muted-foreground mt-1">Dados preenchidos automaticamente pela Receita Federal. Avance para revisar.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-2xl font-bold">Confirme os dados</h4>
                    <p className="text-muted-foreground mt-1">Trouxemos tudo da Receita. Ajuste o que precisar.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Razão Social</Label>
                      <Input className="h-12" value={form.razaoSocial} onChange={(e) => update("razaoSocial", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nome Fantasia</Label>
                      <Input className="h-12" value={form.nomeFantasia} onChange={(e) => update("nomeFantasia", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Ramo de Atividade</Label>
                      <Input className="h-12" value={form.ramoAtividade} onChange={(e) => update("ramoAtividade", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Inscrição Estadual</Label>
                      <Input className="h-12" value={form.inscricaoEstadual} onChange={(e) => update("inscricaoEstadual", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Inscrição Municipal</Label>
                      <Input className="h-12" value={form.inscricaoMunicipal} onChange={(e) => update("inscricaoMunicipal", e.target.value)} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Endereço</Label>
                      <Input className="h-12" value={form.endereco} onChange={(e) => update("endereco", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Cidade</Label>
                      <Input className="h-12" value={form.cidade} onChange={(e) => update("cidade", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>UF</Label>
                      <Input className="h-12" maxLength={2} value={form.uf} onChange={(e) => update("uf", e.target.value.toUpperCase())} />
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-2xl font-bold">Quem é o responsável?</h4>
                    <p className="text-muted-foreground mt-1">Vamos usar esses dados para enviar atualizações do SICAF.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="flex items-center gap-2"><User className="h-4 w-4" /> Nome do responsável</Label>
                      <Input className="h-12" placeholder="Nome completo" value={form.responsavel} onChange={(e) => update("responsavel", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> E-mail</Label>
                      <Input className="h-12" type="email" placeholder="email@empresa.com" value={form.email} onChange={(e) => update("email", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-2"><Phone className="h-4 w-4" /> Telefone / WhatsApp</Label>
                      <Input className="h-12" placeholder="(00) 00000-0000" value={form.telefone} onChange={(e) => update("telefone", e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-2xl font-bold">Escolha o plano de cadastro</h4>
                    <p className="text-muted-foreground mt-1">Selecione a velocidade que sua empresa precisa.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      { id: "padrao" as const, titulo: "Padrão", preco: "R$ 985,00", prazo: "Em até 24h úteis", icon: Briefcase, desc: "Ideal para quem já se planejou.", badge: "Mais escolhido" },
                      { id: "emergencial" as const, titulo: "Emergencial", preco: "R$ 1.450,00", prazo: "Início imediato", icon: Zap, desc: "Prioridade máxima na fila.", badge: "Mais rápido" },
                    ].map((p) => {
                      const Icon = p.icon;
                      const sel = form.plano === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => update("plano", p.id)}
                          className={`text-left rounded-2xl border-2 p-6 transition relative ${sel ? "border-primary bg-primary/5 shadow-soft" : "border-border hover:border-primary/40"}`}
                        >
                          <span className="absolute top-4 right-4 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-primary/10 text-primary font-semibold">{p.badge}</span>
                          <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 ${sel ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <p className="text-lg font-bold">{p.titulo}</p>
                          <p className="text-3xl font-bold mt-2">{p.preco}</p>
                          <p className="text-sm text-muted-foreground mt-1">{p.prazo}</p>
                          <p className="text-sm mt-3">{p.desc}</p>
                          {sel && (
                            <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary">
                              <Check className="h-4 w-4" /> Selecionado
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-2xl font-bold">Como prefere pagar?</h4>
                    <p className="text-muted-foreground mt-1">Liberação imediata após confirmação.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      { id: "pix" as const, titulo: "PIX", desc: "Aprovação em segundos", icon: QrCode, badge: "Recomendado" },
                      { id: "boleto" as const, titulo: "Boleto", desc: "Compensação em até 2 dias úteis", icon: Receipt, badge: "" },
                    ].map((p) => {
                      const Icon = p.icon;
                      const sel = form.pagamento === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => update("pagamento", p.id)}
                          className={`text-left rounded-2xl border-2 p-6 transition relative ${sel ? "border-primary bg-primary/5 shadow-soft" : "border-border hover:border-primary/40"}`}
                        >
                          {p.badge && (
                            <span className="absolute top-4 right-4 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-success/15 text-success font-semibold">{p.badge}</span>
                          )}
                          <div className={`h-14 w-14 rounded-xl flex items-center justify-center mb-4 ${sel ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                            <Icon className="h-7 w-7" />
                          </div>
                          <p className="text-xl font-bold">{p.titulo}</p>
                          <p className="text-sm text-muted-foreground mt-1">{p.desc}</p>
                          {sel && (
                            <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary">
                              <Check className="h-4 w-4" /> Selecionado
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="rounded-xl border bg-muted/30 p-4 flex justify-between items-center">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold">{form.plano === "emergencial" ? "R$ 1.450,00" : "R$ 985,00"}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">Plano {form.plano === "emergencial" ? "Emergencial" : "Padrão"}</p>
                  </div>
                </div>
              )}

              {step === 6 && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-xl border border-success/40 bg-success/5 p-4">
                    <CheckCircle2 className="h-9 w-9 text-success shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-lg font-bold leading-tight">Empresa cadastrada!</h4>
                      <p className="text-sm font-medium mt-1 truncate" title={form.razaoSocial}>
                        {form.razaoSocial}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        CNPJ {form.cnpj}
                        {" · "}
                        Plano {form.plano === "emergencial" ? "Emergencial" : "Padrão"}
                        {" · "}
                        {form.pagamento.toUpperCase()}
                      </p>
                      {!pagamentoGerado && (
                        <p className="text-xs text-warning-foreground mt-2">
                          Gere o pagamento em Minhas Empresas se o boleto não aparecer abaixo.
                        </p>
                      )}
                    </div>
                  </div>

                  {pagamentoGerado && form.pagamento === "boleto" && pagamentoGerado.barcode && (
                    <BoletoGeradoPanel
                      compact
                      boletoData={{
                        barcode: pagamentoGerado.barcode || "",
                        link: pagamentoGerado.link || "",
                        pdf: pagamentoGerado.pdf || "",
                        valor: pagamentoGerado.valor,
                        vencimento: pagamentoGerado.vencimento || vencimentoBoletoIso(),
                        protocolo: pagamentoGerado.protocolo || "",
                        chargeId: pagamentoGerado.chargeId,
                      }}
                      documento={form.cnpj}
                    />
                  )}

                  {pagamentoGerado && form.pagamento === "pix" && (
                    <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 text-center space-y-3">
                      <p className="text-sm font-semibold">PIX gerado — pague para liberar o SICAF</p>
                      <Button type="button" size="lg" onClick={() => setPixModalOpen(true)} className="gap-2 w-full sm:w-auto">
                        <QrCode className="h-4 w-4" />
                        Abrir QR Code PIX
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>

          <footer className="border-t px-8 py-4 flex items-center justify-between gap-3 bg-card">
            <Button variant="ghost" onClick={prev} disabled={step === 1 || step === 6} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            {step < 6 ? (
              <Button
                onClick={() => (step === 5 ? void finalizarCadastro() : next())}
                disabled={!canNext() || salvando}
                size="lg"
                className="gap-2"
              >
                {salvando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : step === 5 ? (
                  <Receipt className="h-4 w-4" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {salvando ? "Salvando..." : step === 5 ? "Confirmar e gerar pagamento" : "Continuar"}
              </Button>
            ) : (
              <Button onClick={() => handleClose(false)} size="lg" className="gap-2">
                Concluir <Check className="h-4 w-4" />
              </Button>
            )}
          </footer>
        </div>
      </DialogContent>

      {pagamentoGerado && form.pagamento === "pix" && pagamentoGerado.qrcodeText && (
        <PixPaymentModal
          open={pixModalOpen}
          onOpenChange={setPixModalOpen}
          client={form.razaoSocial}
          documento={form.cnpj}
          pixData={{
            qrcodeText: pagamentoGerado.qrcodeText,
            qrcodeImage: pagamentoGerado.qrcodeImage || "",
            valor: pagamentoGerado.valor,
            protocolo: pagamentoGerado.protocolo || "",
            txid: pagamentoGerado.txid || "",
            pagamentoId: pagamentoGerado.pagamentoId,
          }}
          onPaymentConfirmed={() => {
            onEmpresaCriada?.();
            toast.success("Pagamento PIX confirmado!");
          }}
        />
      )}
    </Dialog>
  );
}

function EmpresasPage() {
  const [detalhesEmpresa, setDetalhesEmpresa] = useState<EmpresaData | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [pendenciasOpen, setPendenciasOpen] = useState(false);
  const [taxaSicafModalOpen, setTaxaSicafModalOpen] = useState(false);
  const [taxaSicafEmpresa, setTaxaSicafEmpresa] = useState<{ nome: string; cnpj: string; clienteId: number } | null>(null);
  const [manutencaoAtivada, setManutencaoAtivada] = useState<Record<string, number>>({
    "00.000.000/0001-00": 15,
    "12.345.678/0001-99": 10,
    "23.456.789/0001-11": 5,
  });

  const empresasPendentes = empresasMock.filter((e) => e.taxaPendente);

  useEffect(() => {
    if (empresasPendentes.length === 0) return;
    const t = setTimeout(() => setPendenciasOpen(true), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = empresasMock.length;
  const ativos = empresasMock.filter((e) => e.sicaf === "ativo").length;
  const precisamAcao = empresasMock.filter(
    (e) => e.sicaf === "vencido" || e.sicaf === "atencao" || e.sicaf === "sem_cadastro",
  ).length;

  const abrirDetalhes = (empresa: EmpresaData) => {
    setDetalhesEmpresa(empresa);
  };

  const handleDetalhesOpenChange = (open: boolean) => {
    if (!open) setDetalhesEmpresa(null);
  };

  const handleGerenciar = (empresa: EmpresaData) => {
    if (shouldGerenciarAbrirPagamentoFromEmpresa(empresa)) {
      setTaxaSicafEmpresa({ nome: empresa.nome, cnpj: empresa.cnpj, clienteId: empresa.clienteId ?? 0 });
      setTaxaSicafModalOpen(true);
    } else {
      abrirDetalhes(empresa);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        icon={<Building2 className="h-5 w-5" />}
        title="Minhas Empresas"
        subtitle="Gerencie o SICAF de cada CNPJ — atualize ou cadastre novos."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="lg" variant="outline" className="gap-2">
              <Link to="/colaboradores">
                <Users className="h-4 w-4" />
                Colaboradores
              </Link>
            </Button>
            <Button size="lg" className="gap-2" onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4" />
              Adicionar nova empresa
            </Button>
          </div>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Empresas cadastradas</p>
            <p className="mt-1 text-3xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">SICAFs em dia</p>
            <p className="mt-1 text-3xl font-bold text-success">{ativos}</p>
          </CardContent>
        </Card>
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Precisam de ação</p>
            <p className="mt-1 text-3xl font-bold text-warning-foreground">{precisamAcao}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Selecione uma empresa para continuar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {empresasMock.map((e) => {
            const meta = statusLabel[e.sicaf];
            const Icon = e.acao.icon;
            return (
              <div
                key={e.cnpj}
                className={`flex flex-col gap-4 rounded-xl border p-5 transition hover:shadow-soft sm:flex-row sm:items-center sm:justify-between ${
                  e.sicaf === "vencido"
                    ? "border-danger/30 bg-danger/5"
                    : e.sicaf === "atencao"
                    ? "border-warning/40 bg-warning/5"
                    : e.sicaf === "sem_cadastro"
                    ? "border-dashed border-border bg-muted/30"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold leading-tight">{e.nome}</p>
                    <p className="text-xs text-muted-foreground">CNPJ {e.cnpj}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={meta.status}>{meta.label}</StatusBadge>
                      {manutencaoAtivada[e.cnpj] ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                          <RefreshCw className="h-3 w-3" /> Manutenção ativa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          <RefreshCw className="h-3 w-3" /> Sem manutenção
                        </span>
                      )}
                      {e.validade && (
                        <span className="text-xs text-muted-foreground">
                          {e.sicaf === "vencido" ? e.validade : `Validade: ${e.validade}`}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{e.proximoPasso}</p>
                    <NiveisSicafBadges empresa={e} />
                  </div>
                </div>
                <div className="flex shrink-0 gap-2 sm:flex-col sm:items-stretch">
                  <Button
                    type="button"
                    variant={e.acao.variant ?? "default"}
                    className="gap-2"
                    onClick={() => handleGerenciar(e)}
                  >
                    <Icon className="h-4 w-4" />
                    Gerenciar
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    className="gap-1 text-xs shadow-sm hover:brightness-90"
                    style={{ backgroundColor: 'var(--accent-green)', color: 'var(--accent-green-foreground)' }}
                  >
                    <Link to="/sicaf" search={{ cnpj: e.cnpj }}>
                      Ir para SICAF
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="mt-4 border-dashed">
        <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Tem mais empresas para gerenciar?</p>
              <p className="text-sm text-muted-foreground">
                Adicione quantos CNPJs precisar — cuidamos do SICAF de todos.
              </p>
            </div>
          </div>
          <Button size="lg" variant="outline" className="gap-2" onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4" />
            Adicionar empresa
          </Button>
        </CardContent>
      </Card>

      <EmpresaDetalhesSheet
        empresa={detalhesEmpresa}
        open={Boolean(detalhesEmpresa)}
        onOpenChange={handleDetalhesOpenChange}
        manutencaoAtivada={manutencaoAtivada}
        onAtivar={(cnpj, dia) => setManutencaoAtivada((p) => ({ ...p, [cnpj]: dia }))}
        onCancelar={(cnpj) =>
          setManutencaoAtivada((p) => {
            const next = { ...p };
            delete next[cnpj];
            return next;
          })
        }
      />
      <NovaEmpresaWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      <PendenciasModal
        open={pendenciasOpen}
        onOpenChange={setPendenciasOpen}
        empresas={empresasPendentes}
      />
      <PagamentoSicafModal
        open={taxaSicafModalOpen}
        onOpenChange={setTaxaSicafModalOpen}
        empresa={taxaSicafEmpresa ?? { nome: "", cnpj: "", clienteId: 0 }}
      />
    </div>
  );
}
