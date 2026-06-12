export type { SicafStatus, EmpresaData } from "@/lib/empresas-shared";
export {
  empresasMock,
  statusLabel,
  isEmpresaApto,
  getAptoSituacao,
  countNiveisAtualizadosAssistente,
  formatSicafValidade,
  countNiveisAtivosExibicao,
  NIVEIS_SICAF,
  NiveisSicafBadges,
  SituacaoAptoIndicador,
  EmpresaDetalhesSheet,
  NovaEmpresaWizard,
} from "@/lib/empresas-shared";

import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Search,
  Plus,
  ShieldCheck,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Circle,
  Filter,
  RefreshCw,
  CalendarClock,
  FileWarning,
  Loader2,
  Settings,
  Sparkles,
  LayoutGrid,
  List,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import {
  statusLabel,
  isEmpresaApto,
  getAptoSituacao,
  formatSicafValidade,
  countNiveisAtivosExibicao,
  NiveisSicafBadges,
  SituacaoAptoIndicador,
  NovaEmpresaWizard,
  EmpresaDetalhesSheet,
  type EmpresaData,
  type SicafStatus,
} from "@/lib/empresas-shared";
import { fetchEmpresas } from "@/lib/empresas-api";
import { PendenciasModal } from "@/components/pendencias-modal";
import { PagamentoSicafModal } from "@/components/pagamento-sicaf-modal";
import { PagamentosPendentesWizard } from "@/components/pagamentos-pendentes-wizard";
import { detectarFluxoPagamentoSicaf } from "@/lib/cliente-financeiro-api";
import { SicafAnalisarProblemaModal } from "@/components/sicaf/SicafAnalisarProblemaModal";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const SICAF_BUTTON_CLASS =
  "gap-1 text-xs font-semibold shadow-sm bg-accent-green text-accent-green-foreground hover:brightness-110";

export const Route = createFileRoute("/empresas")({
  head: () => ({
    meta: [
      { title: "Minhas Empresas — CADBRASIL" },
      { name: "description", content: "Gerencie o SICAF de todas as suas empresas em um só lugar." },
    ],
  }),
  component: EmpresasPage,
});

type Filtro = "todas" | SicafStatus;
type ViewMode = "cards" | "lista";
const VIEW_MODE_KEY = "cadbrasil-empresas-view";

function readViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY);
    return v === "cards" ? "cards" : "lista";
  } catch {
    return "lista";
  }
}

const filtros: { id: Filtro; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "ativo", label: "Ativos" },
  { id: "atencao", label: "Atenção" },
  { id: "vencido", label: "Vencidos" },
  { id: "sem_cadastro", label: "Sem cadastro" },
];

function EmpresasPage() {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [detalhesEmpresa, setDetalhesEmpresa] = useState<EmpresaData | null>(null);
  const [taxaModalOpen, setTaxaModalOpen] = useState(false);
  const [pagamentosWizardOpen, setPagamentosWizardOpen] = useState(false);
  const [gerenciandoClienteId, setGerenciandoClienteId] = useState<number | null>(null);
  const [taxaEmpresa, setTaxaEmpresa] = useState<{
  nome: string;
  cnpj: string;
    clienteId: number;
  } | null>(null);
  const [pendenciasOpen, setPendenciasOpen] = useState(false);
  const [empresas, setEmpresas] = useState<EmpresaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [manutencaoAtivada, setManutencaoAtivada] = useState<Record<string, number>>({});
  const [analiseModalOpen, setAnaliseModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode());
  const pendenciasAutoShown = useRef(false);

  const setView = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  const loadEmpresas = useCallback(async (search = "") => {
    setLoading(true);
    setLoadError(null);
    const result = await fetchEmpresas(search);
    if (result.ok) {
      setEmpresas(result.empresas);
      const manut: Record<string, number> = {};
      for (const e of result.empresas) {
        if (e.manutencaoAtiva) manut[e.cnpj] = new Date().getDate();
      }
      setManutencaoAtivada(manut);
    } else {
      setEmpresas([]);
      setLoadError(result.error || "Erro ao carregar empresas");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadEmpresas(busca);
    }, busca.trim() ? 400 : 0);
    return () => clearTimeout(timer);
  }, [busca, loadEmpresas]);

  const empresasPendentes = useMemo(
    () => empresas.filter((e) => e.taxaPendente),
    [empresas],
  );

  useEffect(() => {
    if (loading || pendenciasAutoShown.current || taxaModalOpen) return;
    if (empresasPendentes.length > 0) {
      setPendenciasOpen(true);
      pendenciasAutoShown.current = true;
    }
  }, [loading, empresasPendentes.length, taxaModalOpen]);

  const handleGerenciar = async (empresa: EmpresaData) => {
    const abrirPagamento = empresa.taxaPendente && empresa.sicaf !== "ativo";
    if (abrirPagamento) {
      if (!empresa.clienteId) {
        setLoadError("Empresa sem identificador. Atualize a página e tente novamente.");
        return;
      }
      const empresaCtx = {
        nome: empresa.nome,
        cnpj: empresa.cnpj,
        clienteId: empresa.clienteId,
      };
      setTaxaEmpresa(empresaCtx);
      setGerenciandoClienteId(empresa.clienteId);
      const res = await detectarFluxoPagamentoSicaf(empresa.clienteId);
      setGerenciandoClienteId(null);
      if (res.fluxo === "pendentes") {
        setPagamentosWizardOpen(true);
      } else {
        setTaxaModalOpen(true);
      }
      return;
    }
    setDetalhesEmpresa(empresa);
  };

  const contagemApto = useMemo(() => {
    let aptos = 0;
    let inaptos = 0;
    for (const e of empresas) {
      if (isEmpresaApto(e)) aptos += 1;
      else inaptos += 1;
    }
    return { aptos, inaptos };
  }, [empresas]);

  const contagem = useMemo(() => {
    const base: Record<SicafStatus, number> = {
      ativo: 0,
      atencao: 0,
      vencido: 0,
      sem_cadastro: 0,
    };
    for (const e of empresas) base[e.sicaf] += 1;
    return base;
  }, [empresas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return empresas.filter((e) => {
      if (filtro !== "todas" && e.sicaf !== filtro) return false;
      if (!q) return true;
  return (
        e.nome.toLowerCase().includes(q) ||
        e.cnpj.toLowerCase().includes(q) ||
        e.cidade.toLowerCase().includes(q) ||
        e.uf.toLowerCase().includes(q)
      );
    });
  }, [empresas, busca, filtro]);

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 sm:py-10">
      <PageHeader
        icon={<Building2 className="h-5 w-5" />}
        title="Minhas Empresas"
        subtitle="Gerencie o SICAF de cada CNPJ — atualize ou cadastre novos."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="gap-1.5 border-amber-500/40 text-amber-800 hover:bg-amber-500/10"
              onClick={() => setAnaliseModalOpen(true)}
            >
              <Sparkles className="h-4 w-4" />
              Analisar SICAF
            </Button>
            <Button className="gap-1.5" onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4" />
              Adicionar nova empresa
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard
          icon={<Building2 className="h-4 w-4" />}
          label="Total"
          value={empresas.length}
          tone="default"
        />
        <SummaryCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Aptos"
          value={contagemApto.aptos}
          tone="ok"
        />
        <SummaryCard
          icon={<XCircle className="h-4 w-4" />}
          label="Inaptos"
          value={contagemApto.inaptos}
          tone="danger"
        />
        <SummaryCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="SICAF pago"
          value={contagem.ativo}
          tone="default"
        />
        <SummaryCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Vencendo"
          value={contagem.atencao}
          tone="warn"
        />
      </div>

      {/* Toolbar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, CNPJ ou cidade..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
            <Button
              type="button"
              variant={viewMode === "cards" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1.5 px-2.5"
              onClick={() => setView("cards")}
              title="Visualização em cards"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Cards</span>
            </Button>
            <Button
              type="button"
              variant={viewMode === "lista" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1.5 px-2.5"
              onClick={() => setView("lista")}
              title="Visualização em lista"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Lista</span>
            </Button>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => loadEmpresas(busca)}
            disabled={loading}
            title="Atualizar lista"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
            <TabsList>
              {filtros.map((f) => (
                <TabsTrigger key={f.id} value={f.id} className="text-xs">
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
                  </div>
                      </div>

      {loadError && (
        <Card className="mt-6 border-danger/30 bg-danger/5">
          <CardContent className="py-4 text-sm text-danger">{loadError}</CardContent>
        </Card>
      )}

      {loading && empresas.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Carregando empresas...</p>
          </CardContent>
        </Card>
      ) : filtradas.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Filter className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Nenhuma empresa encontrada</p>
          <p className="text-xs text-muted-foreground">
              Ajuste a busca ou troque o filtro acima.
            </p>
          </CardContent>
        </Card>
      ) : viewMode === "cards" ? (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtradas.map((empresa) => (
            <EmpresaCard
              key={empresa.clienteId ?? empresa.cnpj}
              empresa={empresa}
              manutencaoDia={manutencaoAtivada[empresa.cnpj]}
              onGerenciar={() => handleGerenciar(empresa)}
              gerenciando={gerenciandoClienteId === empresa.clienteId}
            />
          ))}
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          <div className="hidden lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Empresa</span>
            <span>SICAF</span>
            <span>Manutenção</span>
            <span>Níveis</span>
            <span className="text-right">Ações</span>
          </div>
          {filtradas.map((empresa) => (
            <EmpresaListRow
              key={empresa.clienteId ?? empresa.cnpj}
              empresa={empresa}
              manutencaoDia={manutencaoAtivada[empresa.cnpj]}
              onGerenciar={() => handleGerenciar(empresa)}
              gerenciando={gerenciandoClienteId === empresa.clienteId}
            />
          ))}
        </div>
      )}

      <NovaEmpresaWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      <EmpresaDetalhesSheet
        empresa={detalhesEmpresa}
        open={Boolean(detalhesEmpresa)}
        onOpenChange={(v) => { if (!v) setDetalhesEmpresa(null); }}
        manutencaoAtivada={manutencaoAtivada}
        onAtivar={(cnpj, dia) => setManutencaoAtivada((p) => ({ ...p, [cnpj]: dia }))}
        onEmpresaUpdated={() => loadEmpresas(busca)}
      />
      <PendenciasModal
        open={pendenciasOpen}
        onOpenChange={(v) => {
          setPendenciasOpen(v);
          if (!v) pendenciasAutoShown.current = true;
        }}
        empresas={empresasPendentes}
      />
      <PagamentoSicafModal
        open={taxaModalOpen}
        onOpenChange={setTaxaModalOpen}
        empresa={taxaEmpresa ?? { nome: "", cnpj: "", clienteId: 0 }}
        onGerado={() => loadEmpresas(busca)}
        onPago={() => loadEmpresas(busca)}
      />
      <PagamentosPendentesWizard
        open={pagamentosWizardOpen}
        onOpenChange={setPagamentosWizardOpen}
        empresa={taxaEmpresa ?? { nome: "", cnpj: "", clienteId: 0 }}
        onNovoPagamento={() => setTaxaModalOpen(true)}
        onPago={() => loadEmpresas(busca)}
      />
      <SicafAnalisarProblemaModal
        open={analiseModalOpen}
        onOpenChange={setAnaliseModalOpen}
        empresas={empresas
          .filter((e) => e.clienteId && e.sicaf !== "sem_cadastro")
          .map((e) => ({ clienteId: e.clienteId!, nome: e.nome, cnpj: e.cnpj }))}
        onProcessed={() => loadEmpresas(busca)}
      />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "default" | "ok" | "warn" | "danger";
}) {
  const toneClass =
    tone === "ok"
      ? "bg-success/10 text-success border-success/20"
      : tone === "warn"
      ? "bg-warning/15 text-warning-foreground border-warning/30"
      : tone === "danger"
      ? "bg-danger/10 text-danger border-danger/20"
      : "bg-muted text-foreground border-border";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${toneClass}`}>
          {icon}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold leading-none">{value}</p>
      </div>
      </CardContent>
    </Card>
  );
}

function EmpresaCard({
  empresa,
  manutencaoDia,
  onGerenciar,
  gerenciando,
}: {
  empresa: EmpresaData;
  manutencaoDia?: number;
  onGerenciar: () => void;
  gerenciando?: boolean;
}) {
  const meta = statusLabel[empresa.sicaf];
  const situacao = getAptoSituacao(empresa);

  const niveisAtivos = countNiveisAtivosExibicao(empresa);
  const temManutencao = typeof manutencaoDia === "number";

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-md">
      <SituacaoAptoIndicador situacao={situacao} variant="banner" />
      <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold leading-tight">{empresa.nome}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">CNPJ {empresa.cnpj}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <SituacaoAptoIndicador situacao={situacao} variant="pill" />
            <StatusPill status={meta.status}>{meta.label}</StatusPill>
          </div>
          </div>

        <div className="mt-4 grid grid-cols-1 gap-2">
          <StatusRow
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            tone={temManutencao ? "ok" : "idle"}
            label="Manutenção"
            value={temManutencao ? `Ativa · dia ${manutencaoDia}` : "Sem manutenção"}
          />
          <StatusRow
            icon={<CalendarClock className="h-3.5 w-3.5" />}
            tone={
              empresa.sicaf === "vencido"
                ? "danger"
                : empresa.sicaf === "atencao"
                ? "warn"
                : empresa.sicaf === "sem_cadastro"
                ? "idle"
                : "ok"
            }
            label="Licença SICAF"
            value={formatSicafValidade(empresa)}
          />
          <StatusRow
            icon={<FileWarning className="h-3.5 w-3.5" />}
            tone={situacao.apto ? "ok" : "warn"}
            label="Níveis Assistente"
            value={
              situacao.apto
                ? `${situacao.niveisAtualizados} de 6 atualizados`
                : "Nenhum nível sincronizado"
            }
          />
        </div>

        <div className="mt-3 rounded-lg border bg-muted/30 px-3 py-2">
          <NiveisSicafBadges empresa={empresa} />
          <p className="mt-1 text-right text-[10px] text-muted-foreground">
            {niveisAtivos} de 6 níveis ativos
                    </p>
                  </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-dashed bg-background px-3 py-2">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground leading-snug">{empresa.proximoPasso}</p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            onClick={onGerenciar}
            disabled={gerenciando}
          >
            {gerenciando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Settings className="h-3.5 w-3.5" />
            )}
            Gerenciar
          </Button>
          <Button asChild size="sm" className={SICAF_BUTTON_CLASS}>
            <Link to="/sicaf" search={{ cnpj: empresa.cnpj }}>
              Ir para SICAF
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        </CardContent>
      </Card>
  );
}

function StatusRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "ok" | "warn" | "danger" | "idle";
}) {
  const map = {
    ok: "bg-success/10 text-success ring-success/20",
    warn: "bg-warning/15 text-warning-foreground ring-warning/30",
    danger: "bg-danger/10 text-danger ring-danger/20",
    idle: "bg-muted text-muted-foreground ring-border",
  } as const;
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-2.5 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`flex h-6 w-6 items-center justify-center rounded-md ring-1 ${map[tone]}`}>
          {icon}
        </span>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
            </div>
      <span className="text-right text-xs font-medium text-foreground leading-snug">{value}</span>
            </div>
  );
}

function EmpresaListRow({
  empresa,
  manutencaoDia,
  onGerenciar,
  gerenciando,
}: {
  empresa: EmpresaData;
  manutencaoDia?: number;
  onGerenciar: () => void;
  gerenciando?: boolean;
}) {
  const meta = statusLabel[empresa.sicaf];
  const situacao = getAptoSituacao(empresa);
  const niveisAtivos = countNiveisAtivosExibicao(empresa);
  const temManutencao = typeof manutencaoDia === "number";

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardContent className="p-0">
        <div
          className={cn(
            "h-1.5 w-full",
            situacao.apto ? "bg-success" : "bg-red-600",
          )}
        />
        <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-sm font-semibold">{empresa.nome}</h3>
                <SituacaoAptoIndicador situacao={situacao} variant="pill" />
                <StatusPill status={meta.status}>{meta.label}</StatusPill>
              </div>
              <p className="text-xs text-muted-foreground">CNPJ {empresa.cnpj}</p>
              {(empresa.cidade || empresa.uf) && (
                <p className="text-[11px] text-muted-foreground">
                  {[empresa.cidade, empresa.uf].filter(Boolean).join(" / ")}
                </p>
              )}
            </div>
          </div>

          <div className="lg:px-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground lg:hidden">Licença SICAF</p>
            <p className="text-sm font-medium">{formatSicafValidade(empresa)}</p>
            <p className="text-[11px] text-muted-foreground truncate">{empresa.proximoPasso}</p>
          </div>

          <div className="lg:px-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground lg:hidden">Manutenção</p>
            <p className={cn("text-sm font-medium", temManutencao ? "text-success" : "text-muted-foreground")}>
              {temManutencao ? `Ativa · dia ${manutencaoDia}` : "Sem manutenção"}
            </p>
          </div>

          <div className="lg:px-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground lg:hidden">Níveis</p>
            <NiveisSicafBadges empresa={empresa} compact />
            <p className="mt-1 text-[10px] text-muted-foreground">{niveisAtivos} de 6 ativos</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button size="sm" className="gap-1.5" onClick={onGerenciar} disabled={gerenciando}>
              {gerenciando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Settings className="h-3.5 w-3.5" />
              )}
              Gerenciar
            </Button>
            <Button asChild size="sm" className={SICAF_BUTTON_CLASS}>
              <Link to="/sicaf" search={{ cnpj: empresa.cnpj }}>
                SICAF
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusPill({
  status,
  children,
}: {
  status: "ok" | "warn" | "danger" | "idle";
  children: React.ReactNode;
}) {
  const map = {
    ok: "bg-success/10 text-success border-success/20",
    warn: "bg-warning/15 text-warning-foreground border-warning/30",
    danger: "bg-danger/10 text-danger border-danger/20",
    idle: "bg-muted text-muted-foreground border-border",
  } as const;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${map[status]}`}
    >
      <Circle className="h-1.5 w-1.5 fill-current" />
      {children}
    </span>
  );
}
