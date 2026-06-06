import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, ChevronRight, Edit3, FileText, MapPin, Plus, Rocket, Save, RefreshCw, ShieldCheck, User, X, Search, Loader2, QrCode, Receipt, Check, ArrowRight, ArrowLeft, Sparkles, CheckCircle2, Mail, Phone, Briefcase, Zap } from "lucide-react";
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

export const Route = createFileRoute("/empresas")({
  head: () => ({
    meta: [
      { title: "Minhas Empresas — CADBRASIL" },
      { name: "description", content: "Gerencie o SICAF de todas as suas empresas em um só lugar." },
    ],
  }),
  component: EmpresasPage,
});

type SicafStatus = "ativo" | "atencao" | "vencido" | "sem_cadastro";

export interface EmpresaData {
  nome: string;
  cnpj: string;
  sicaf: SicafStatus;
  validade?: string;
  proximoPasso: string;
  acao: { label: string; variant?: "default" | "outline"; icon: typeof Rocket };
  endereco: string;
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
  },
];

export const statusLabel: Record<SicafStatus, { label: string; status: "ok" | "warn" | "danger" | "idle" }> = {
  ativo: { label: "SICAF Ativo", status: "ok" },
  atencao: { label: "Atualização recomendada", status: "warn" },
  vencido: { label: "SICAF Vencido", status: "danger" },
  sem_cadastro: { label: "Sem cadastro SICAF", status: "idle" },
};

export const NIVEIS_SICAF: { num: number; roman: string; nome: string; color: string }[] = [
  { num: 1, roman: "I", nome: "Habilitação", color: "#16a34a" },
  { num: 2, roman: "II", nome: "Habilitação Jurídica", color: "#16a34a" },
  { num: 3, roman: "III", nome: "Regularidade Fiscal Federal", color: "#f59e0b" },
  { num: 4, roman: "IV", nome: "Regularidade Fiscal Estadual/Municipal", color: "#2563eb" },
  { num: 5, roman: "V", nome: "Qualificação Técnica", color: "#dc2626" },
  { num: 6, roman: "VI", nome: "Qualificação Econômico-Financeira", color: "#dc2626" },
];

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

function detalhesPara(empresa: EmpresaData, num: number): NivelDetalhe {
  if (empresa.detalhesNiveis?.[num]) return empresa.detalhesNiveis[num];
  const ativo = (empresa.niveis ?? []).includes(num);
  if (!ativo) return { status: "nao_cadastrado" };
  if (empresa.sicaf === "vencido") return { status: "vencido", vencimento: empresa.validade };
  if (empresa.sicaf === "atencao") return { status: "vencendo", vencimento: empresa.validade };
  return { status: "validado", vencimento: empresa.validade };
}

function NiveisSicafBadges({ empresa }: { empresa: EmpresaData }) {
  return (
    <div className="mt-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
        Níveis SICAF
      </p>
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


type SectionId = "visao" | "sicaf" | "faltam" | "documentos" | "manutencao" | "certidoes" | "pagamento";

const sectionMenu: { id: SectionId; label: string; icon: typeof FileText; badge?: string; tone?: "warn" | "danger" | "ok" }[] = [
  { id: "visao", label: "Visão geral", icon: Building2 },
  { id: "sicaf", label: "Meu SICAF", icon: ShieldCheck },
  { id: "faltam", label: "O que falta", icon: Sparkles, badge: "3", tone: "warn" },
  { id: "documentos", label: "Documentos", icon: FileText },
  { id: "manutencao", label: "Manutenção", icon: RefreshCw, badge: "ativo", tone: "ok" },
  { id: "certidoes", label: "Certidões", icon: ShieldCheck, badge: "1", tone: "danger" },
  { id: "pagamento", label: "Pagamento", icon: Receipt },
];

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

function MeuSicafSection({
  empresa,
  meta,
}: {
  empresa: EmpresaData;
  meta: { label: string; status: "ok" | "warn" | "danger" | "idle" };
}) {
  const niveis = NIVEIS_SICAF.map((n) => ({ ...n, det: detalhesPara(empresa, n.num) }));
  const validados = niveis.filter((n) => n.det.status === "validado").length;
  const pendentes = niveis.filter((n) => n.det.status === "pendente" || n.det.status === "vencendo").length;
  const vencidos = niveis.filter((n) => n.det.status === "vencido").length;
  const naoCad = niveis.filter((n) => n.det.status === "nao_cadastrado").length;

  const certidoes = [
    { nome: "Certidão Federal", emissor: "Receita Federal / PGFN", vencimento: "15/05/2026", status: "validado" as NivelStatus },
    { nome: "Certidão FGTS", emissor: "Caixa Econômica Federal", vencimento: "30/03/2026", status: "validado" as NivelStatus },
    { nome: "Certidão Trabalhista (CNDT)", emissor: "Tribunal Superior do Trabalho", vencimento: "Vencida em 12/11/2025", status: "vencido" as NivelStatus },
    { nome: "Certidão Estadual", emissor: "Sefaz " + empresa.uf, vencimento: "Não emitida", status: "pendente" as NivelStatus },
    { nome: "Certidão Municipal", emissor: "Prefeitura de " + empresa.cidade, vencimento: "10/06/2026", status: "validado" as NivelStatus },
    { nome: "Certidão Negativa de Falência", emissor: "Distribuidor cível", vencimento: "08/04/2026", status: "validado" as NivelStatus },
  ];

  const certVencidas = certidoes.filter((c) => c.status === "vencido").length;
  const certPendentes = certidoes.filter((c) => c.status === "pendente").length;

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <Card className="overflow-hidden border-0 shadow-soft">
        <div
          className={`relative px-6 py-5 text-white ${
            meta.status === "ok"
              ? "bg-gradient-to-br from-success via-success/90 to-success/70"
              : meta.status === "warn"
              ? "bg-gradient-to-br from-warning via-warning/90 to-warning/70"
              : meta.status === "danger"
              ? "bg-gradient-to-br from-danger via-danger/90 to-danger/70"
              : "bg-gradient-to-br from-muted-foreground via-muted-foreground/90 to-muted-foreground/70"
          }`}
        >
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,white,transparent_60%)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider font-semibold opacity-80">Situação SICAF</p>
              <h3 className="text-2xl font-bold mt-1 leading-tight">{meta.label}</h3>
              <p className="text-sm opacity-90 mt-1">{empresa.proximoPasso}</p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
              <ShieldCheck className="h-7 w-7" />
            </div>
          </div>
          <div className="relative mt-5 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl bg-white/15 backdrop-blur px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider opacity-80">Validade</p>
              <p className="font-bold mt-0.5">{empresa.validade ?? "—"}</p>
            </div>
            <div className="rounded-xl bg-white/15 backdrop-blur px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider opacity-80">Níveis ativos</p>
              <p className="font-bold mt-0.5">{(empresa.niveis ?? []).length} de 6</p>
            </div>
            <div className="rounded-xl bg-white/15 backdrop-blur px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider opacity-80">CNPJ</p>
              <p className="font-bold mt-0.5 truncate">{empresa.cnpj}</p>
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
                  <Button size="sm" variant={c.status === "validado" ? "outline" : "default"} className="shrink-0 gap-1.5">
                    {c.status === "validado" ? "Ver" : "Resolver"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
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


function EmpresaDetalhesSheet({
  empresa,
  open,
  onOpenChange,
}: {
  empresa: EmpresaData | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<Partial<EmpresaData>>({});
  const [section, setSection] = useState<SectionId>("visao");

  const startEditing = () => {
    if (!empresa) return;
    setForm({ ...empresa });
    setEditando(true);
  };
  const cancelEditing = () => { setEditando(false); setForm({}); };
  const saveEditing = () => { setEditando(false); setForm({}); };
  const updateField = (field: keyof EmpresaData, value: string) => setForm((p) => ({ ...p, [field]: value }));

  if (!empresa) return null;
  const meta = statusLabel[empresa.sicaf];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl md:max-w-4xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-xl leading-tight truncate">{empresa.nome}</SheetTitle>
              <SheetDescription className="mt-1">
                CNPJ {empresa.cnpj} · <StatusBadge status={meta.status}>{meta.label}</StatusBadge>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-1 min-h-0">
          {/* Menu lateral */}
          <nav className="hidden md:flex w-56 shrink-0 flex-col border-r bg-muted/30 p-3 gap-1">
            {sectionMenu.map((s) => {
              const Icon = s.icon;
              const active = s.id === section;
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
                      s.tone === "danger" ? "bg-danger/15 text-danger" :
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

              {section === "visao" && !editando && (
                <div className="space-y-6">
                  <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />Situação SICAF</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><p className="text-xs text-muted-foreground">Status</p><p className="text-sm font-medium mt-0.5"><StatusBadge status={meta.status}>{meta.label}</StatusBadge></p></div>
                      <div><p className="text-xs text-muted-foreground">Validade</p><p className="text-sm font-medium mt-0.5">{empresa.validade ?? "—"}</p></div>
                      <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Próximo passo</p><p className="text-sm font-medium mt-0.5">{empresa.proximoPasso}</p></div>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-primary" />Dados Cadastrais</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><p className="text-xs text-muted-foreground">Razão Social</p><p className="text-sm font-medium mt-0.5">{empresa.nome}</p></div>
                      <div><p className="text-xs text-muted-foreground">CNPJ</p><p className="text-sm font-medium mt-0.5">{empresa.cnpj}</p></div>
                      <div><p className="text-xs text-muted-foreground">Inscrição Estadual</p><p className="text-sm font-medium mt-0.5">{empresa.inscricaoEstadual}</p></div>
                      <div><p className="text-xs text-muted-foreground">Inscrição Municipal</p><p className="text-sm font-medium mt-0.5">{empresa.inscricaoMunicipal}</p></div>
                      <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Ramo de Atividade</p><p className="text-sm font-medium mt-0.5">{empresa.ramoAtividade}</p></div>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-primary" />Endereço e Contato</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Endereço</p><p className="text-sm font-medium mt-0.5">{empresa.endereco}</p></div>
                      <div><p className="text-xs text-muted-foreground">Cidade / UF</p><p className="text-sm font-medium mt-0.5">{empresa.cidade} / {empresa.uf}</p></div>
                      <div><p className="text-xs text-muted-foreground">Telefone</p><p className="text-sm font-medium mt-0.5">{empresa.telefone}</p></div>
                      <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">E-mail</p><p className="text-sm font-medium mt-0.5">{empresa.email}</p></div>
                      <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Responsável legal</p><p className="text-sm font-medium mt-0.5">{empresa.responsavel}</p></div>
                    </div>
                  </div>
                </div>
              )}

              {section === "visao" && editando && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2"><Label>Razão Social</Label><Input value={form.nome ?? ""} onChange={(e) => updateField("nome", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>CNPJ</Label><Input value={form.cnpj ?? ""} onChange={(e) => updateField("cnpj", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Ramo</Label><Input value={form.ramoAtividade ?? ""} onChange={(e) => updateField("ramoAtividade", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>IE</Label><Input value={form.inscricaoEstadual ?? ""} onChange={(e) => updateField("inscricaoEstadual", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>IM</Label><Input value={form.inscricaoMunicipal ?? ""} onChange={(e) => updateField("inscricaoMunicipal", e.target.value)} /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label>Endereço</Label><Input value={form.endereco ?? ""} onChange={(e) => updateField("endereco", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Cidade</Label><Input value={form.cidade ?? ""} onChange={(e) => updateField("cidade", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>UF</Label><Input maxLength={2} value={form.uf ?? ""} onChange={(e) => updateField("uf", e.target.value.toUpperCase())} /></div>
                    <div className="space-y-1.5"><Label>Telefone</Label><Input value={form.telefone ?? ""} onChange={(e) => updateField("telefone", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" value={form.email ?? ""} onChange={(e) => updateField("email", e.target.value)} /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label>Responsável</Label><Input value={form.responsavel ?? ""} onChange={(e) => updateField("responsavel", e.target.value)} /></div>
                  </div>
                </div>
              )}

              {section === "sicaf" && (
                <MeuSicafSection empresa={empresa} meta={meta} />
              )}

              {section === "faltam" && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-bold">O que falta para ficar 100%</h4>
                    <p className="text-sm text-muted-foreground">Pendências detectadas para esta empresa.</p>
                  </div>
                  <div className="space-y-2">
                    <SectionItemRow status="warn" title="Atualizar Nível III - Qualificação Técnica" desc="Vence em 28/02/2026" action={{ label: "Resolver" }} />
                    <SectionItemRow status="danger" title="Certidão de Débitos Trabalhistas vencida" desc="Necessária para emitir SICAF" action={{ label: "Enviar agora" }} />
                    <SectionItemRow status="warn" title="Atualizar contrato social" desc="Versão mais recente não enviada" action={{ label: "Anexar" }} />
                  </div>
                </div>
              )}

              {section === "documentos" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-bold">Documentos</h4>
                      <p className="text-sm text-muted-foreground">Arquivos vinculados a esta empresa.</p>
                    </div>
                    <Button asChild size="sm" className="gap-2" onClick={() => onOpenChange(false)}>
                      <Link to="/documentos" search={{ cnpj: empresa.cnpj }}>
                        <Plus className="h-4 w-4" /> Enviar
                      </Link>
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <SectionItemRow status="ok" title="Contrato Social.pdf" desc="Enviado em 12/03/2025" action={{ label: "Ver" }} />
                    <SectionItemRow status="ok" title="Cartão CNPJ.pdf" desc="Atualizado em 02/01/2026" action={{ label: "Ver" }} />
                    <SectionItemRow status="ok" title="Procuração.pdf" desc="Válida até 31/12/2026" action={{ label: "Ver" }} />
                    <SectionItemRow status="idle" title="Balanço Patrimonial 2025" desc="Não enviado" action={{ label: "Enviar" }} />
                  </div>
                </div>
              )}

              {section === "manutencao" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-success/40 bg-success/5 p-5 flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-success shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold">Manutenção ativa</p>
                      <p className="text-sm text-muted-foreground">Renovação automática em 15/01/2026 — R$ 149,00/mês</p>
                    </div>
                    <Button size="sm" variant="outline">Gerenciar</Button>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="text-base font-semibold mb-3">Últimas ações da CADBRASIL</h4>
                    <div className="space-y-2">
                      <SectionItemRow status="ok" title="Renovação SICAF Nível I e II" desc="Concluída em 02/01/2026" />
                      <SectionItemRow status="ok" title="Atualização cadastral mensal" desc="15/12/2025" />
                      <SectionItemRow status="ok" title="Verificação de certidões" desc="01/12/2025" />
                    </div>
                  </div>
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
                  <div className="space-y-2">
                    <SectionItemRow status="ok" title="Receita Federal (Conjunta)" desc="Válida até 12/05/2026" action={{ label: "Baixar" }} />
                    <SectionItemRow status="ok" title="FGTS (CRF)" desc="Válida até 03/04/2026" action={{ label: "Baixar" }} />
                    <SectionItemRow status="danger" title="Trabalhista (CNDT)" desc="Vencida em 14/11/2025" action={{ label: "Renovar" }} />
                    <SectionItemRow status="ok" title="Estadual" desc="Válida até 20/06/2026" action={{ label: "Baixar" }} />
                    <SectionItemRow status="warn" title="Municipal" desc="Vence em 22 dias" action={{ label: "Renovar" }} />
                  </div>
                </div>
              )}

              {section === "pagamento" && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border bg-card p-4">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Próxima cobrança</p>
                      <p className="text-2xl font-bold mt-1">R$ 149,00</p>
                      <p className="text-xs text-muted-foreground mt-1">Manutenção · 15/01/2026</p>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Licença anual</p>
                      <p className="text-2xl font-bold mt-1">R$ 985,00</p>
                      <p className="text-xs text-muted-foreground mt-1">Renova em 02/01/2027</p>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="text-base font-semibold mb-3">Histórico</h4>
                    <div className="space-y-2">
                      <SectionItemRow status="ok" title="Manutenção SICAF - Dezembro/2025" desc="Pago em 15/12 · PIX" action={{ label: "Nota" }} />
                      <SectionItemRow status="ok" title="Licença Anual SICAF 2026" desc="Pago em 02/01 · Boleto" action={{ label: "Nota" }} />
                      <SectionItemRow status="ok" title="Manutenção SICAF - Novembro/2025" desc="Pago em 15/11 · PIX" action={{ label: "Nota" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <SheetFooter className="px-6 py-4 border-t flex flex-col sm:flex-row gap-3">
          {section === "visao" ? (
            !editando ? (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-2"><X className="h-4 w-4" />Fechar</Button>
                <Button onClick={startEditing} className="gap-2"><Edit3 className="h-4 w-4" />Editar dados</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={cancelEditing} className="gap-2"><X className="h-4 w-4" />Cancelar</Button>
                <Button onClick={saveEditing} className="gap-2"><Save className="h-4 w-4" />Salvar</Button>
              </>
            )
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-2 sm:ml-auto"><X className="h-4 w-4" />Fechar</Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
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

const wizardSteps = [
  { id: 1, title: "CNPJ", desc: "Consulta na Receita", icon: Search },
  { id: 2, title: "Dados da empresa", desc: "Confirme as informações", icon: Building2 },
  { id: 3, title: "Contato", desc: "Responsável e contato", icon: User },
  { id: 4, title: "Plano", desc: "Escolha o cadastro SICAF", icon: Sparkles },
  { id: 5, title: "Pagamento", desc: "PIX ou Boleto", icon: Receipt },
  { id: 6, title: "Pronto", desc: "Empresa cadastrada", icon: CheckCircle2 },
];

function NovaEmpresaWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardForm>(emptyForm);
  const [consultando, setConsultando] = useState(false);
  const [consultaOk, setConsultaOk] = useState(false);

  const update = <K extends keyof WizardForm>(k: K, v: WizardForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const reset = () => {
    setStep(1); setForm(emptyForm); setConsultando(false); setConsultaOk(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const consultarCNPJ = () => {
    if (!form.cnpj || form.cnpj.replace(/\D/g, "").length < 14) return;
    setConsultando(true);
    setTimeout(() => {
      setForm((p) => ({
        ...p,
        razaoSocial: "Tech Soluções Inteligentes LTDA",
        nomeFantasia: "Tech Soluções",
        inscricaoEstadual: "123.456.789.000",
        inscricaoMunicipal: "9876543210",
        ramoAtividade: "Serviços de Tecnologia da Informação",
        cep: "01310-100",
        endereco: "Av. Paulista, 1578 - Bela Vista",
        cidade: "São Paulo",
        uf: "SP",
      }));
      setConsultando(false);
      setConsultaOk(true);
    }, 1600);
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
            <div className="px-8 py-8 max-w-3xl mx-auto w-full">
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
                        onChange={(e) => { update("cnpj", e.target.value); setConsultaOk(false); }}
                        className="h-14 text-lg"
                      />
                      <Button onClick={consultarCNPJ} disabled={consultando} size="lg" className="h-14 px-6 gap-2">
                        {consultando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                        {consultando ? "Consultando..." : "Consultar"}
                      </Button>
                    </div>
                  </div>
                  {consultaOk && (
                    <div className="rounded-xl border border-success/40 bg-success/5 p-5 flex items-start gap-3">
                      <CheckCircle2 className="h-6 w-6 text-success shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">CNPJ encontrado!</p>
                        <p className="text-sm text-muted-foreground">{form.razaoSocial} — {form.cidade}/{form.uf}</p>
                        <p className="text-sm text-muted-foreground mt-1">Avance para revisar os dados.</p>
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
                <div className="text-center py-8 space-y-5">
                  <div className="h-20 w-20 rounded-full bg-success/15 text-success flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold">Empresa cadastrada!</h4>
                    <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                      Recebemos o pagamento e iniciamos o processo de cadastro SICAF da <strong>{form.razaoSocial}</strong>.
                      Você vai receber atualizações por e-mail e WhatsApp.
                    </p>
                  </div>
                  <div className="rounded-xl border bg-muted/30 p-5 max-w-md mx-auto text-left grid gap-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">CNPJ</span><span className="font-medium">{form.cnpj}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Plano</span><span className="font-medium">{form.plano === "emergencial" ? "Emergencial" : "Padrão"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Pagamento</span><span className="font-medium uppercase">{form.pagamento}</span></div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <footer className="border-t px-8 py-4 flex items-center justify-between gap-3 bg-card">
            <Button variant="ghost" onClick={prev} disabled={step === 1 || step === 6} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            {step < 6 ? (
              <Button onClick={next} disabled={!canNext()} size="lg" className="gap-2">
                {step === 5 ? "Confirmar pagamento" : "Continuar"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => handleClose(false)} size="lg" className="gap-2">
                Concluir <Check className="h-4 w-4" />
              </Button>
            )}
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmpresasPage() {
  const [detalhesEmpresa, setDetalhesEmpresa] = useState<EmpresaData | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);


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

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<Building2 className="h-5 w-5" />}
        title="Minhas Empresas"
        subtitle="Gerencie o SICAF de cada CNPJ — atualize ou cadastre novos."
        action={
          <Button size="lg" className="gap-2" onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4" />
            Adicionar nova empresa
          </Button>
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
                    onClick={() => abrirDetalhes(e)}
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
                    <Link to="/sicaf">
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
      />
      <NovaEmpresaWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
