import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Loader2,
  CircleHelp,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PageHeader, StatusBadge } from "@/components/page-header";
import { CopyButton } from "@/components/copy-button";
import { NIVEIS_SICAF, type NivelStatus } from "@/components/admin/nivel-dots";
import { ComparadorSicaf, type SnapshotSicaf } from "@/components/comparador-sicaf";
import { GitCompareArrows } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AssistenteSicafLaunchDialog } from "@/components/assistente-sicaf-launch-dialog";
import {
  AssistenteOnboardingModal,
  hasSeenAssistenteOnboarding,
} from "@/components/assistente-onboarding-modal";
import { resolveEmpresaPorCnpj } from "@/lib/documentos-api";
import {
  CADBRASIL_EXTENSION_STORE_URL,
  useCadBrasilExtension,
} from "@/hooks/use-cadbrasil-extension";
import { probeCadBrasilExtension } from "@/lib/cadbrasil-extension";
import {
  analisarSituacaoPdf,
  buildComparadorSnapshots,
  certidoesPorNivel,
  fetchAnaliseDetalhe,
  fetchAssistentePainel,
  fetchHistoricoAnalises,
  mapNiveisFromPainel,
  mapPendenciasFromAnalise,
  pendenciasPorNivel,
  type AssistenteHistoricoItem,
  type AssistentePendencia,
  type PendenciaNivelResumo,
} from "@/lib/assistente-api";
import type { GerenciarItem, EmpresaGerenciarPainel } from "@/lib/empresas-api";
import { countNiveisValidadosUi, mapNiveisFromEvidencias, mapSicafPainelStatus, nivelBolinhaVisual, todosNiveisValidadosUi } from "@/lib/nivel-status";
import { pagamentoSicafConfirmado } from "@/lib/sicaf-page-api";

const SICAF_BUTTON_CLASS =
  "gap-1.5 font-semibold shadow-sm bg-accent-green text-accent-green-foreground hover:brightness-110";

const NIVEIS_VAZIOS: Record<number, NivelStatus> = {
  1: "nao_cadastrado",
  2: "nao_cadastrado",
  3: "nao_cadastrado",
  4: "nao_cadastrado",
  5: "nao_cadastrado",
  6: "nao_cadastrado",
};

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

const nivelStatusLabel: Record<NivelStatus, string> = {
  validado: "Validado",
  vencendo: "Vencendo em breve",
  vencido: "Vencido",
  pendente: "Pendente",
  nao_cadastrado: "Não cadastrado",
};

function nivelStatusTone(status: NivelStatus): "ok" | "warn" | "danger" | "idle" {
  if (status === "validado") return "ok";
  if (status === "vencendo" || status === "pendente") return "warn";
  if (status === "vencido") return "danger";
  return "idle";
}

function AssistenteNivelHoverContent({
  nivel,
  status,
  certidoes,
  pendenciasNivel,
  observacao,
}: {
  nivel: (typeof NIVEIS_SICAF)[number];
  status: NivelStatus;
  certidoes: GerenciarItem[];
  pendenciasNivel: PendenciaNivelResumo[];
  observacao?: string;
}) {
  const tone = nivelStatusTone(status);

  return (
    <>
      <div
        className="flex items-center gap-2 rounded-t-md px-3 py-2 text-white"
        style={{ backgroundColor: nivel.color }}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
          {nivel.roman}
        </span>
        <div className="text-xs">
          <p className="font-semibold leading-tight">Nível {nivel.roman}</p>
          <p className="text-[11px] opacity-90 leading-tight">{nivel.nome}</p>
        </div>
      </div>
      <div className="max-h-72 space-y-3 overflow-y-auto p-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Situação</span>
          <StatusBadge status={tone}>{nivelStatusLabel[status]}</StatusBadge>
        </div>

        {observacao ? (
          <p className="rounded-md bg-muted/60 p-2 text-[11px] text-muted-foreground">{observacao}</p>
        ) : null}

        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Certidões e documentos
          </p>
          {certidoes.length === 0 ? (
            <p className="rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
              Nenhuma certidão vinculada a este nível no cadastro.
            </p>
          ) : (
            <ul className="space-y-2">
              {certidoes.map((c) => (
                <li key={`${c.titulo}-${c.descricao}`} className="rounded-md border bg-card/80 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium leading-tight">{c.titulo}</span>
                    <StatusBadge status={c.status}>{c.status === "ok" ? "OK" : c.status === "warn" ? "Atenção" : c.status === "danger" ? "Crítico" : "—"}</StatusBadge>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{c.descricao}</p>
                  {c.dataValidade ? (
                    <p className="mt-1 text-[10px] text-muted-foreground">Validade: {c.dataValidade}</p>
                  ) : null}
                  {c.emissor ? (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Emissor: {c.emissor}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pendências</p>
          {pendenciasNivel.length === 0 ? (
            <p className="rounded-md bg-success/10 p-2 text-[11px] text-success">
              Nenhuma pendência identificada para este nível.
            </p>
          ) : (
            <ul className="space-y-2">
              {pendenciasNivel.map((p) => (
                <li key={p.id} className="rounded-md border border-warning/20 bg-warning/5 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium leading-tight">{p.titulo}</span>
                    <StatusBadge status={p.tone}>
                      {p.tone === "danger" ? "Crítica" : p.tone === "warn" ? "Atenção" : "Info"}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{p.descricao}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

const SNAPSHOT_VAZIO: SnapshotSicaf = {
  validade: "—",
  niveis: [1, 2, 3, 4, 5, 6].map((n) => ({
    numero: n,
    nome: NIVEIS_SICAF[n - 1]?.nome || `Nível ${n}`,
    ativo: false,
  })),
  pendencias: [],
};

function AssistentePage() {
  const { cnpj } = Route.useSearch();
  const navigate = useNavigate();
  const { extensionInstalled, extensionChecking, extensionVersion, checkExtension } =
    useCadBrasilExtension();
  const [verificandoExtensao, setVerificandoExtensao] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [progresso, setProgresso] = useState(0);
  const [analisando, setAnalisando] = useState(false);
  const [analisado, setAnalisado] = useState(false);
  const [pendenciaAberta, setPendenciaAberta] = useState<AssistentePendencia | null>(null);
  const [comparadorAberto, setComparadorAberto] = useState(false);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [empresaNome, setEmpresaNome] = useState<string | undefined>();
  const [niveis, setNiveis] = useState<Record<number, NivelStatus>>(NIVEIS_VAZIOS);
  const [historico, setHistorico] = useState<AssistenteHistoricoItem[]>([]);
  const [pendencias, setPendencias] = useState<AssistentePendencia[]>([]);
  const [certidoes, setCertidoes] = useState<GerenciarItem[]>([]);
  const [documentos, setDocumentos] = useState<GerenciarItem[]>([]);
  const [pendenciasPainel, setPendenciasPainel] = useState<GerenciarItem[]>([]);
  const [niveisDetail, setNiveisDetail] = useState<EmpresaGerenciarPainel["niveisDetail"]>();
  const [sicafValidade, setSicafValidade] = useState<string | undefined>();
  const [sicafStatus, setSicafStatus] = useState<string | undefined>();
  const [carregando, setCarregando] = useState(false);
  const [ultimaMensagem, setUltimaMensagem] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const comparadorSnapshots = useMemo(
    () => buildComparadorSnapshots(historico, sicafValidade),
    [historico, sicafValidade],
  );

  const carregarDados = useCallback(async (id: number, opts?: { atualizarPendencias?: boolean }) => {
    setCarregando(true);
    try {
      const [painelRes, histRes] = await Promise.all([
        fetchAssistentePainel(id),
        fetchHistoricoAnalises(id),
      ]);

      if (painelRes.ok && painelRes.painel) {
        if (!pagamentoSicafConfirmado(painelRes.painel)) {
          toast.error("Confirme o pagamento da taxa CADBRASIL (Etapa 1) para usar o Assistente.");
          void navigate({
            to: "/sicaf",
            search: cnpj ? { cnpj } : {},
          });
          return;
        }

        setEmpresaNome(painelRes.painel.cliente.razaoSocial || painelRes.painel.cliente.nomeFantasia || undefined);
        const painelSicafStatus = painelRes.painel.sicaf?.status;
        setSicafStatus(painelSicafStatus);
        setNiveis(mapNiveisFromPainel(painelRes.painel.niveisDetail, painelSicafStatus));
        setNiveisDetail(painelRes.painel.niveisDetail);
        setCertidoes(painelRes.painel.certidoes || []);
        setDocumentos(painelRes.painel.documentos || []);
        setPendenciasPainel(painelRes.painel.pendencias || []);
        setSicafValidade(painelRes.painel.sicaf?.validade || undefined);
      }

      if (histRes.ok) {
        setHistorico(histRes.historico);
        if (opts?.atualizarPendencias !== false && histRes.historico[0]?.analiseRaw) {
          setPendencias(mapPendenciasFromAnalise(histRes.historico[0].analiseRaw));
        }
      }
    } catch {
      toast.error("Erro ao carregar dados do assistente");
    } finally {
      setCarregando(false);
    }
  }, [cnpj, navigate]);

  useEffect(() => {
    if (!hasSeenAssistenteOnboarding()) {
      setOnboardingOpen(true);
    }
  }, []);

  useEffect(() => {
    probeCadBrasilExtension();
    void checkExtension({ waitMs: 8000 });
  }, [checkExtension]);

  const verificarExtensaoNovamente = useCallback(async () => {
    setVerificandoExtensao(true);
    try {
      probeCadBrasilExtension();
      const ok = await checkExtension({ waitMs: 10000 });
      if (ok) {
        toast.success("Extensão CadBrasil SICAF detectada!");
      } else {
        toast.info("Extensão não detectada", {
          description: "Instale no Chrome e clique em verificar novamente.",
        });
      }
    } finally {
      setVerificandoExtensao(false);
    }
  }, [checkExtension]);

  useEffect(() => {
    if (!cnpj) {
      setClienteId(null);
      setEmpresaNome(undefined);
      setNiveis(NIVEIS_VAZIOS);
      setHistorico([]);
      setPendencias([]);
      setCertidoes([]);
      setDocumentos([]);
      setPendenciasPainel([]);
      setNiveisDetail(undefined);
      return;
    }
    void resolveEmpresaPorCnpj(cnpj).then((res) => {
      if (res.ok && res.empresa?.clienteId) {
        setClienteId(res.empresa.clienteId);
        setEmpresaNome(res.empresa.nome);
        void carregarDados(res.empresa.clienteId);
      } else {
        setClienteId(null);
        toast.error(res.error || "Empresa não encontrada para este CNPJ");
      }
    });
  }, [cnpj, carregarDados]);

  const onSelect = async (f: File | null) => {
    if (!f || !clienteId) {
      if (!clienteId) toast.error("Selecione uma empresa (CNPJ) antes de enviar o PDF");
      return;
    }
    setArquivo(f);
    setAnalisado(false);
    setAnalisando(true);
    setProgresso(0);
    setUltimaMensagem(null);

    const res = await analisarSituacaoPdf(clienteId, f, setProgresso);
    setAnalisando(false);

    if (!res.ok) {
      toast.error(res.error || "Falha na análise do PDF");
      setArquivo(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setAnalisado(true);
    setPendencias(mapPendenciasFromAnalise(res.analise));
    setUltimaMensagem(res.message || "Análise concluída com sucesso.");

    if (res.niveisEvidencias?.length) {
      setNiveis(mapNiveisFromEvidencias(res.niveisEvidencias, { sicaf: mapSicafPainelStatus(sicafStatus) }));
    }

    if (res.saveWarning) {
      toast.warning(res.saveWarning);
    } else if (res.certidoesInserted || res.certidoesUpdated) {
      toast.success(
        `Cadastro atualizado: ${res.certidoesInserted || 0} inserida(s), ${res.certidoesUpdated || 0} atualizada(s).`,
      );
    } else {
      toast.success(res.message || "Análise concluída");
    }

    await carregarDados(clienteId, { atualizarPendencias: false });
  };

  const limpar = () => {
    setArquivo(null);
    setAnalisado(false);
    setAnalisando(false);
    setProgresso(0);
    setUltimaMensagem(null);
    if (historico[0]?.analiseRaw) {
      setPendencias(mapPendenciasFromAnalise(historico[0].analiseRaw));
    } else {
      setPendencias([]);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const abrirHistorico = async (item: AssistenteHistoricoItem) => {
    if (!clienteId) return;
    const res = await fetchAnaliseDetalhe(clienteId, parseInt(item.id, 10));
    if (!res.ok) {
      toast.error(res.error || "Não foi possível abrir esta análise");
      return;
    }
    setPendencias(res.pendencias);
    setAnalisado(true);
    setUltimaMensagem(res.historico.resumo || "Análise histórica carregada.");
  };

  const temPendencias = pendencias.length > 0;
  const niveisAtivos = countNiveisValidadosUi(niveis);
  const todosNiveisValidados = todosNiveisValidadosUi(niveis);

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 sm:py-10">
      <PageHeader
        icon={<Bot className="h-5 w-5" />}
        title="Assistente CADBRASIL"
        subtitle={
          cnpj ? (
            <span className="flex flex-col gap-0.5">
              {empresaNome ? (
                <span className="font-medium text-foreground leading-snug">{empresaNome}</span>
              ) : null}
              <span className="inline-flex flex-wrap items-center gap-1">
                CNPJ <span className="font-mono">{cnpj}</span>
                <CopyButton value={cnpj} label="CNPJ" />
              </span>
            </span>
          ) : (
            "Envie sua Situação do Fornecedor e o assistente cuida do resto."
          )
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setOnboardingOpen(true)}
            >
              <CircleHelp className="h-3.5 w-3.5" />
              Como atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!comparadorSnapshots}
              onClick={() => setComparadorAberto(true)}
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
              Antes vs Depois
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/sicaf" search={{ cnpj }}>
                <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                Voltar ao SICAF
              </Link>
            </Button>
            <Button
              size="sm"
              className={SICAF_BUTTON_CLASS}
              onClick={() => setLaunchOpen(true)}
            >
              <Bot className="h-3.5 w-3.5" />
              Acessar SICAF
              {extensionChecking ? (
                <Loader2 className="h-3 w-3 animate-spin opacity-80" />
              ) : extensionInstalled ? (
                <span className="flex h-2 w-2 rounded-full bg-white shadow-sm" title="Extensão detectada" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-amber-200" title="Extensão não detectada" />
              )}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      />

      {cnpj && extensionChecking && (
        <Card className="mt-6 border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-4">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">Verificando extensão CadBrasil SICAF…</p>
              <p className="text-xs text-muted-foreground">
                O assistente precisa da extensão instalada no Google Chrome para acessar o portal.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {cnpj && !extensionChecking && !extensionInstalled && (
        <Card className="mt-6 border-warning/40 bg-warning/5">
          <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warning/15">
              <AlertTriangle className="h-6 w-6 text-warning-foreground" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="font-semibold text-warning-foreground">Extensão CadBrasil não detectada</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Para abrir o SICAF com o Assistente Digital IA, instale a extensão{" "}
                  <strong>CadBrasil — Assistente SICAF</strong> no Google Chrome. Sem ela, o botão
                  &quot;Acessar SICAF&quot; não consegue automatizar o portal.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="gap-2"
                  onClick={() => window.open(CADBRASIL_EXTENSION_STORE_URL, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="h-4 w-4" />
                  Instalar extensão
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={verificandoExtensao}
                  onClick={() => void verificarExtensaoNovamente()}
                >
                  {verificandoExtensao ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Já instalei — verificar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!cnpj && (
        <Card className="mt-6 border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Bot className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium">Selecione uma empresa para usar o Assistente</p>
            <Button asChild size="sm">
              <Link to="/empresas">Ir para Minhas Empresas</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {cnpj && (
        <>
          {/* HERO — Níveis em destaque */}
          <Card className="mt-6 overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/40 shadow-lift">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                    Status dos níveis SICAF
                  </p>
                  <h2 className="mt-1 text-2xl font-bold leading-tight">
                    {todosNiveisValidados && !carregando
                      ? "Cadastro SICAF completo"
                      : "Seu mapa de regularização"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {carregando
                      ? "Carregando níveis do cadastro…"
                      : todosNiveisValidados
                        ? "6 de 6 níveis validados · 100% atingido · nível máximo"
                        : `${niveisAtivos} de 6 níveis validados · dados do banco CADBRASIL`}
                  </p>
                </div>
                {todosNiveisValidados && !carregando ? (
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-success/50 bg-success/15 font-bold text-success"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    100% · Nível máximo
                  </Badge>
                ) : extensionChecking ? (
                  <Badge variant="outline" className="gap-1.5 border-primary/40 bg-primary/10 text-primary">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Verificando extensão…
                  </Badge>
                ) : extensionInstalled ? (
                  <Badge variant="outline" className="gap-1.5 border-success/40 bg-success/10 text-success">
                    <CheckCircle2 className="h-3 w-3" />
                    Extensão ativa{extensionVersion ? ` · v${extensionVersion}` : ""}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1.5 border-warning/40 bg-warning/10 text-warning-foreground">
                    <AlertTriangle className="h-3 w-3" />
                    Extensão não instalada
                  </Badge>
                )}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {NIVEIS_SICAF.map((n) => {
                  const status = niveis[n.num];
                  const meta = {
                    validado: { dot: "bg-success", label: "Validado" },
                    vencendo: { dot: "bg-warning", label: "Vencendo" },
                    vencido: { dot: "bg-danger", label: "Vencido" },
                    pendente: { dot: "bg-warning", label: "Pendente" },
                    nao_cadastrado: {
                      dot: "bg-muted-foreground/40",
                      label: "Sem cadastro",
                    },
                  }[status];
                  const visual = nivelBolinhaVisual(status, n.color);
                  const comDados = status !== "nao_cadastrado";
                  const certidoesNivel = certidoesPorNivel(certidoes, documentos, n.roman);
                  const pendenciasNivel = pendenciasPorNivel(pendencias, pendenciasPainel, n.roman);
                  const observacao = niveisDetail?.[n.roman]?.observacao;
                  return (
                    <div
                      key={n.num}
                      className="group relative flex flex-col items-center gap-2 rounded-2xl border bg-card/70 p-4 shadow-soft backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lift"
                    >
                      <HoverCard openDelay={120} closeDelay={80}>
                        <HoverCardTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Nível ${n.roman} - ${n.nome}. Passe o mouse para ver certidões e pendências.`}
                            className={cn(
                              "relative flex h-14 w-14 items-center justify-center rounded-full text-base font-black ring-4 transition outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                              visual.ring,
                              visual.circleClass,
                              !comDados && "grayscale opacity-60",
                            )}
                            style={visual.circleStyle}
                          >
                            {n.roman}
                            {comDados && (
                              <span
                                className={cn(
                                  "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-card",
                                  visual.badgeDot,
                                )}
                              />
                            )}
                          </button>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80 p-0" side="top" align="center">
                          <AssistenteNivelHoverContent
                            nivel={n}
                            status={status}
                            certidoes={certidoesNivel}
                            pendenciasNivel={pendenciasNivel}
                            observacao={observacao}
                          />
                        </HoverCardContent>
                      </HoverCard>
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

              {todosNiveisValidados && !carregando && (
                <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-success/40 bg-success/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success/20 text-success">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success-foreground">
                          100% atingido
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-success">
                          Nível máximo
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold">Todos os 6 níveis SICAF validados</p>
                      <p className="text-xs text-muted-foreground">
                        Sua empresa está com cadastro completo. Envie novas Situações do Fornecedor para
                        manter tudo monitorado.
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 gap-1 border-success/40 bg-success/15 text-success"
                  >
                    <Sparkles className="h-3 w-3" />
                    Pronto para licitar
                  </Badge>
                </div>
              )}
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
                <div className="space-y-4">
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
                        disabled={!clienteId || analisando}
                        onChange={(e) => void onSelect(e.target.files?.[0] ?? null)}
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
                            {analisando ? "Analisando com IA…" : analisado ? "Análise concluída" : "Pronto"}
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
                              IA analisando e atualizando cadastro
                            </span>
                            <span className="font-mono text-muted-foreground">{progresso}%</span>
                          </div>
                          <Progress value={progresso} className="h-2" />
                        </div>
                      )}

                      {analisado && (
                        <div
                          className={cn(
                            "rounded-xl border p-3",
                            temPendencias
                              ? "border-warning/30 bg-warning/5"
                              : "border-success/30 bg-success/5",
                          )}
                        >
                          <div className="flex items-start gap-2">
                            {temPendencias ? (
                              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" />
                            ) : (
                              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                            )}
                            <div className="text-sm">
                              <p className="font-semibold">
                                {temPendencias
                                  ? `Encontramos ${pendencias.length} ponto(s) de atenção.`
                                  : "Nenhuma pendência crítica — níveis em ordem."}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {ultimaMensagem || "Veja o painel de pendências ao lado."}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Histórico */}
                <div className="mt-6">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Últimas Situações enviadas
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {historico.length} arquivo{historico.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  {carregando && historico.length === 0 ? (
                    <div className="mt-3 flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando histórico…
                    </div>
                  ) : historico.length === 0 ? (
                    <p className="mt-3 rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
                      Nenhuma análise registrada ainda. Envie o primeiro PDF acima.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {historico.map((h) => (
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
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            title="Ver pendências desta análise"
                            onClick={() => void abrirHistorico(h)}
                          >
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
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
                  <Badge className={temPendencias ? "bg-danger text-danger-foreground" : "bg-muted text-muted-foreground"}>
                    {pendencias.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendencias.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-muted/20 px-4 py-10 text-center">
                    <Sparkles className="h-8 w-8 text-muted-foreground/60" />
                    <p className="text-sm font-medium text-muted-foreground">
                      {analisado || historico.length > 0
                        ? "Nenhuma pendência na última análise"
                        : "Envie a Situação do Fornecedor"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {analisado || historico.length > 0
                        ? "Seu cadastro SICAF está em ordem segundo a IA."
                        : "As pendências aparecem aqui após a análise."}
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {pendencias.map((p) => {
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
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="gap-2 bg-white text-primary shadow-lift hover:bg-white/90"
                    onClick={() => window.open(CADBRASIL_EXTENSION_STORE_URL, "_blank")}
                  >
                    <Download className="h-4 w-4" />
                    Instalar assistente
                  </Button>
                  <Button
                    size="lg"
                    className={cn(SICAF_BUTTON_CLASS, "shadow-lift")}
                    onClick={() => setLaunchOpen(true)}
                  >
                    <Bot className="h-4 w-4" />
                    Acessar SICAF
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

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
                      <li key={i} className="flex gap-3 rounded-xl border bg-card p-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                          {i + 1}
                        </span>
                        <p className="text-sm leading-relaxed">{passo}</p>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button className="flex-1 gap-2" onClick={() => setLaunchOpen(true)}>
                    <Bot className="h-4 w-4" />
                    Resolver com o Assistente
                  </Button>
                  <Button asChild variant="outline" className="gap-2">
                    <Link to="/sicaf" search={{ cnpj }}>
                      <Upload className="h-4 w-4" />
                      Ir ao SICAF
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ComparadorSicaf
        open={comparadorAberto}
        onOpenChange={setComparadorAberto}
        empresa={empresaNome || (cnpj ? `CNPJ ${cnpj}` : "Sua empresa")}
        antes={comparadorSnapshots?.antes ?? SNAPSHOT_VAZIO}
        depois={comparadorSnapshots?.depois ?? SNAPSHOT_VAZIO}
      />

      <AssistenteSicafLaunchDialog
        open={launchOpen}
        onOpenChange={setLaunchOpen}
        cnpj={cnpj}
        empresaNome={empresaNome}
      />

      <AssistenteOnboardingModal
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        onComecar={() => inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
      />
    </div>
  );
}
