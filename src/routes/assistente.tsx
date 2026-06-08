import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  Bot,
  Upload,
  FileText,
  Sparkles,
  ShieldCheck,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Wrench,
  ArrowRight,
  Trash2,
  Eye,
  ChevronRight,
  Zap,
  Activity,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { NIVEIS_SICAF, type NivelStatus } from "@/components/admin/nivel-dots";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  cnpj: z.string().optional(),
});

export const Route = createFileRoute("/assistente")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Assistente SICAF — CADBRASIL" },
      {
        name: "description",
        content:
          "Envie a Situação do Fornecedor, acompanhe pendências e instale o Assistente CADBRASIL.",
      },
    ],
  }),
  component: AssistentePage,
});

type Pendencia = {
  id: string;
  nivel: string;
  titulo: string;
  detalhe: string;
  severidade: "alta" | "media" | "baixa";
  solucao: {
    passos: string[];
    prazo: string;
    onde: string;
  };
};

type HistoricoItem = {
  id: string;
  arquivo: string;
  data: string;
  hora: string;
  pendencias: number;
  status: "analisado" | "regular" | "atencao";
};

const niveisIniciais: Record<number, NivelStatus> = {
  1: "validado",
  2: "validado",
  3: "vencendo",
  4: "validado",
  5: "vencido",
  6: "pendente",
};

const pendenciasMock: Pendencia[] = [
  {
    id: "p1",
    nivel: "Nível V",
    titulo: "Atestado de Capacidade Técnica vencido",
    detalhe:
      "O atestado emitido pela empresa contratante venceu em 02/05/2026. É preciso solicitar um novo documento.",
    severidade: "alta",
    solucao: {
      passos: [
        "Entre em contato com a empresa contratante e solicite a emissão de um novo Atestado de Capacidade Técnica.",
        "Confirme se o documento contém CNPJ, descrição do serviço, período e assinatura do responsável.",
        "Anexe o novo atestado no Compras.gov.br > SICAF > Nível V > Qualificação Técnica.",
        "Aguarde a validação automática (até 48h) ou peça revisão manual pelo Assistente CADBRASIL.",
      ],
      prazo: "Resolva em até 5 dias úteis",
      onde: "Compras.gov.br · Nível V — Qualificação Técnica",
    },
  },
  {
    id: "p2",
    nivel: "Nível III",
    titulo: "Certidão Federal vence em 12 dias",
    detalhe:
      "Certidão Conjunta Negativa de Débitos Federais perto do vencimento — gere a nova antes de 20/06/2026.",
    severidade: "media",
    solucao: {
      passos: [
        "Acesse o portal da Receita Federal: gov.br/receitafederal.",
        "Vá em Serviços > Certidões e Situação Fiscal > Certidão Conjunta.",
        "Informe o CNPJ e gere a nova certidão (válida por 6 meses).",
        "Faça upload no SICAF — ou deixe o Assistente CADBRASIL atualizar automaticamente.",
      ],
      prazo: "Renove até 20/06/2026",
      onde: "Receita Federal · Certidão Conjunta",
    },
  },
  {
    id: "p3",
    nivel: "Nível VI",
    titulo: "Balanço Patrimonial pendente",
    detalhe:
      "O Balanço Patrimonial do último exercício ainda não foi anexado ao SICAF — exigência da qualificação econômico-financeira.",
    severidade: "alta",
    solucao: {
      passos: [
        "Solicite o Balanço Patrimonial assinado ao seu contador.",
        "O arquivo deve estar em PDF, assinado digitalmente (e-CNPJ ou e-CPF do contador).",
        "Faça upload no Compras.gov.br > Nível VI > Qualificação Econômico-Financeira.",
        "Confirme os índices contábeis (LG, SG, LC) — o sistema calcula automaticamente.",
      ],
      prazo: "Bloqueia novas licitações",
      onde: "Compras.gov.br · Nível VI",
    },
  },
];

const historicoMock: HistoricoItem[] = [
  {
    id: "h1",
    arquivo: "situacao-fornecedor-mai-2026.pdf",
    data: "08/06/2026",
    hora: "14:32",
    pendencias: 3,
    status: "atencao",
  },
  {
    id: "h2",
    arquivo: "situacao-fornecedor-abr-2026.pdf",
    data: "05/05/2026",
    hora: "09:18",
    pendencias: 1,
    status: "analisado",
  },
  {
    id: "h3",
    arquivo: "situacao-fornecedor-mar-2026.pdf",
    data: "03/04/2026",
    hora: "11:05",
    pendencias: 0,
    status: "regular",
  },
];

const severidadeMeta = {
  alta: {
    label: "Crítica",
    cls: "bg-danger/10 text-danger border-danger/30",
    icon: "bg-danger/15 text-danger",
  },
  media: {
    label: "Atenção",
    cls: "bg-warning/15 text-warning-foreground border-warning/30",
    icon: "bg-warning/15 text-warning-foreground",
  },
  baixa: {
    label: "Baixa",
    cls: "bg-muted text-muted-foreground border-border",
    icon: "bg-muted text-muted-foreground",
  },
} as const;

function AssistentePage() {
  const { cnpj } = Route.useSearch();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [progresso, setProgresso] = useState(0);
  const [analisando, setAnalisando] = useState(false);
  const [analisado, setAnalisado] = useState(false);
  const [pendenciaAberta, setPendenciaAberta] = useState<Pendencia | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const niveis = analisado ? niveisIniciais : niveisIniciais;

  useEffect(() => {
    if (!analisando) return;
    setProgresso(0);
    const id = setInterval(() => {
      setProgresso((p) => {
        if (p >= 100) {
          clearInterval(id);
          setTimeout(() => {
            setAnalisando(false);
            setAnalisado(true);
          }, 350);
          return 100;
        }
        return p + 6;
      });
    }, 140);
    return () => clearInterval(id);
  }, [analisando]);

  const onSelect = (f: File | null) => {
    if (!f) return;
    setArquivo(f);
    setAnalisado(false);
    setAnalisando(true);
  };

  const limpar = () => {
    setArquivo(null);
    setAnalisado(false);
    setAnalisando(false);
    setProgresso(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<Bot className="h-5 w-5" />}
        title="Assistente CADBRASIL"
        subtitle={
          cnpj
            ? `Análise inteligente da Situação do Fornecedor · CNPJ ${cnpj}`
            : "Envie sua Situação do Fornecedor e o assistente cuida do resto."
        }
        action={
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/sicaf" search={{ cnpj }}>
              <ArrowRight className="h-3.5 w-3.5 rotate-180" />
              Voltar ao SICAF
            </Link>
          </Button>
        }
      />

      {/* HERO — Níveis em destaque */}
      <Card className="mt-6 overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/40 shadow-lift">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                Status dos níveis SICAF
              </p>
              <h2 className="mt-1 text-2xl font-bold leading-tight">
                Seu mapa de regularização
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Bolinhas em destaque mostram o que está ok, vencendo ou bloqueado.
              </p>
            </div>
            <Badge variant="outline" className="gap-1.5 border-success/40 bg-success/10 text-success">
              <Activity className="h-3 w-3" />
              Monitorando em tempo real
            </Badge>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {NIVEIS_SICAF.map((n) => {
              const status = niveis[n.num];
              const meta = {
                validado: { dot: "bg-success", label: "Validado", ring: "ring-success/30" },
                vencendo: { dot: "bg-warning", label: "Vencendo", ring: "ring-warning/40" },
                vencido: { dot: "bg-danger", label: "Vencido", ring: "ring-danger/40" },
                pendente: { dot: "bg-warning", label: "Pendente", ring: "ring-warning/40" },
                nao_cadastrado: {
                  dot: "bg-muted-foreground/40",
                  label: "Sem cadastro",
                  ring: "ring-border",
                },
              }[status];
              return (
                <div
                  key={n.num}
                  className="group relative flex flex-col items-center gap-2 rounded-2xl border bg-card/70 p-4 shadow-soft backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <div
                    className={cn(
                      "relative flex h-14 w-14 items-center justify-center rounded-full text-base font-black text-white ring-4 transition group-hover:scale-110",
                      meta.ring,
                    )}
                    style={{ backgroundColor: n.color }}
                  >
                    {n.roman}
                    <span
                      className={cn(
                        "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-card",
                        meta.dot,
                      )}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Nível {n.roman}
                    </p>
                    <p className="text-[11px] font-semibold leading-tight">{n.nome}</p>
                    <p
                      className={cn(
                        "mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                        status === "validado" && "bg-success/15 text-success",
                        status === "vencendo" && "bg-warning/20 text-warning-foreground",
                        status === "vencido" && "bg-danger/15 text-danger",
                        status === "pendente" && "bg-warning/20 text-warning-foreground",
                        status === "nao_cadastrado" && "bg-muted text-muted-foreground",
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                      {meta.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Upload Situação do Fornecedor */}
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Situação do Fornecedor (PDF)
              </CardTitle>
              {analisado && (
                <Button variant="ghost" size="sm" onClick={limpar} className="h-7 gap-1 text-xs">
                  <RefreshCw className="h-3 w-3" />
                  Novo envio
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!arquivo && (
              <label
                htmlFor="sf-pdf"
                className="group relative flex cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-accent/20 px-4 py-10 text-center transition hover:border-primary hover:from-primary/10"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lift transition group-hover:scale-110">
                  <Upload className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-base font-bold">Arraste o PDF ou clique aqui</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Situação do Fornecedor emitida pelo Compras.gov.br · até 10 MB
                  </p>
                </div>
                <input
                  ref={inputRef}
                  id="sf-pdf"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
                />
              </label>
            )}

            {arquivo && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{arquivo.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(arquivo.size / 1024).toFixed(0)} KB ·{" "}
                      {analisando ? "Analisando…" : analisado ? "Análise concluída" : "Pronto"}
                    </p>
                  </div>
                  {!analisando && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={limpar}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>

                {analisando && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-primary">
                        <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                        IA analisando seu documento
                      </span>
                      <span className="font-mono text-muted-foreground">{progresso}%</span>
                    </div>
                    <Progress value={progresso} className="h-2" />
                  </div>
                )}

                {analisado && (
                  <div className="rounded-xl border border-success/30 bg-success/5 p-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                      <div className="text-sm">
                        <p className="font-semibold">
                          Encontramos {pendenciasMock.length} pontos de atenção.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Veja o painel de pendências ao lado e clique em "Como resolver".
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Histórico */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Últimas Situações enviadas
                </p>
                <Badge variant="outline" className="text-[10px]">
                  {historicoMock.length} arquivos
                </Badge>
              </div>
              <ul className="mt-3 space-y-2">
                {historicoMock.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center gap-3 rounded-xl border bg-card p-3 transition hover:border-primary/40 hover:shadow-soft"
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        h.status === "regular" && "bg-success/15 text-success",
                        h.status === "analisado" && "bg-primary/15 text-primary",
                        h.status === "atencao" && "bg-warning/20 text-warning-foreground",
                      )}
                    >
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{h.arquivo}</p>
                      <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {h.data} às {h.hora}
                        <span className="text-border">·</span>
                        {h.pendencias === 0
                          ? "Sem pendências"
                          : `${h.pendencias} pendência${h.pendencias > 1 ? "s" : ""}`}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Pendências detectadas */}
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning-foreground" />
                Pendências detectadas
              </span>
              <Badge className="bg-danger text-danger-foreground">
                {analisado ? pendenciasMock.length : 0}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!analisado ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-muted/20 px-4 py-10 text-center">
                <Sparkles className="h-8 w-8 text-muted-foreground/60" />
                <p className="text-sm font-medium text-muted-foreground">
                  Envie a Situação do Fornecedor
                </p>
                <p className="text-xs text-muted-foreground">
                  As pendências aparecem aqui após a análise.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {pendenciasMock.map((p) => {
                  const meta = severidadeMeta[p.severidade];
                  return (
                    <li
                      key={p.id}
                      className="group rounded-xl border bg-card p-3 transition hover:border-primary/40 hover:shadow-soft"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                            meta.icon,
                          )}
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              {p.nivel}
                            </Badge>
                            <span
                              className={cn(
                                "rounded-full border px-1.5 py-0.5 text-[10px] font-bold",
                                meta.cls,
                              )}
                            >
                              {meta.label}
                            </span>
                          </div>
                          <p className="mt-1.5 text-sm font-semibold leading-tight">
                            {p.titulo}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{p.detalhe}</p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 h-7 gap-1.5 text-xs"
                            onClick={() => setPendenciaAberta(p)}
                          >
                            <Wrench className="h-3 w-3" />
                            Como resolver
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instalação do Assistente */}
      <Card className="mt-6 overflow-hidden border-primary/30 bg-gradient-to-r from-primary via-primary to-[oklch(0.55_0.18_265)] text-primary-foreground shadow-lift">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                <Bot className="h-7 w-7" />
              </div>
              <div className="max-w-xl">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">
                    Automatize de vez
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold">
                    <Zap className="h-3 w-3" /> Recomendado
                  </span>
                </div>
                <h3 className="mt-1 text-xl font-bold leading-tight">
                  Instale o Assistente CADBRASIL no seu navegador
                </h3>
                <p className="mt-1 text-sm opacity-90">
                  Conecta direto ao Compras.gov.br, renova certidões, monitora vencimentos 24h e
                  envia alertas antes que algo vença.
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs opacity-95">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" /> 100% seguro
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Atualiza Níveis III–VI
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" /> Monitor 24/7
                  </span>
                </div>
              </div>
            </div>
            <Button
              size="lg"
              variant="secondary"
              className="gap-2 bg-white text-primary shadow-lift hover:bg-white/90"
            >
              <Download className="h-4 w-4" />
              Instalar assistente
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal Como resolver */}
      <Dialog open={!!pendenciaAberta} onOpenChange={(v) => !v && setPendenciaAberta(null)}>
        <DialogContent className="sm:max-w-xl">
          {pendenciaAberta && (
            <>
              <DialogHeader>
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Wrench className="h-6 w-6" />
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {pendenciaAberta.nivel}
                  </Badge>
                  <span
                    className={cn(
                      "rounded-full border px-1.5 py-0.5 text-[10px] font-bold",
                      severidadeMeta[pendenciaAberta.severidade].cls,
                    )}
                  >
                    {severidadeMeta[pendenciaAberta.severidade].label}
                  </span>
                </div>
                <DialogTitle className="text-center text-xl">
                  {pendenciaAberta.titulo}
                </DialogTitle>
                <DialogDescription className="text-center">
                  {pendenciaAberta.detalhe}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Prazo
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                      <Clock className="h-4 w-4 text-warning-foreground" />
                      {pendenciaAberta.solucao.prazo}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Onde resolver
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      {pendenciaAberta.solucao.onde}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Passo a passo
                  </p>
                  <ol className="space-y-2">
                    {pendenciaAberta.solucao.passos.map((passo, i) => (
                      <li
                        key={i}
                        className="flex gap-3 rounded-xl border bg-card p-3"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                          {i + 1}
                        </span>
                        <p className="text-sm leading-relaxed">{passo}</p>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button className="flex-1 gap-2">
                    <Bot className="h-4 w-4" />
                    Resolver com o Assistente
                  </Button>
                  <Button variant="outline" className="gap-2">
                    <Upload className="h-4 w-4" />
                    Enviar manualmente
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
