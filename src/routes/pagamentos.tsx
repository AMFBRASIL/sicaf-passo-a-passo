import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Wallet,
  ShieldCheck,
  Wrench,
  Building2,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Receipt,
  Plus,
  CalendarClock,
  Filter,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContainer, PageHeader } from "@/components/page-header";
import type { EmpresaData } from "@/lib/empresas-shared";
import { fetchEmpresas, fetchSicafValores } from "@/lib/empresas-api";
import {
  detectarFluxoPagamentoSicaf,
  fetchClienteFinanceiro,
  formatFinanceBRL,
  formatFinanceDateBR,
  isPagamentoSicafGerado,
  type ClienteFinanceiroPainel,
} from "@/lib/cliente-financeiro-api";
import { shouldGerenciarAbrirPagamentoFromEmpresa } from "@/lib/sicaf-access-rules";
import { fetchValorManutencaoMensal } from "@/lib/manutencao-api";
import { PagamentoSicafModal } from "@/components/pagamento-sicaf-modal";
import { PagamentoSicafResumoModal } from "@/components/pagamento-sicaf-resumo-modal";
import { PagamentosPendentesWizard } from "@/components/pagamentos-pendentes-wizard";
import { ManutencaoModal } from "@/components/manutencao-modal";
import { toast } from "sonner";

export const Route = createFileRoute("/pagamentos")({
  head: () => ({
    meta: [
      { title: "Pagamentos — CADBRASIL" },
      {
        name: "description",
        content:
          "Acompanhe os pagamentos de SICAF e Manutenção de todas as suas empresas em um só lugar.",
      },
    ],
  }),
  component: MeusPagamentosPage,
});

type PagStatus = "em_dia" | "pendente" | "nao_contratado";

type LinhaPag = {
  empresa: EmpresaData;
  financeiro: ClienteFinanceiroPainel | null;
  sicaf: { status: PagStatus; valor: number; vencimento?: string; descricao: string };
  manutencao: { status: PagStatus; valor: number; diaVencimento?: number; descricao: string };
};

type Filtro = "todas" | "pendente" | "em_dia";

type ValoresRef = {
  valorSicaf: number;
  valorManutencao: number;
};

function extrairDiaVencimento(data: string | null | undefined): number | undefined {
  if (!data) return undefined;
  const d = new Date(data);
  if (!Number.isNaN(d.getTime())) return d.getDate();
  const parts = data.split("-");
  if (parts.length === 3) return parseInt(parts[2], 10) || undefined;
  return undefined;
}

/** SICAF: situação real (pago + vigência), não boleto órfão no financeiro. */
function buildSicafLinha(
  empresa: EmpresaData,
  financeiro: ClienteFinanceiroPainel | null,
  valores: ValoresRef,
): LinhaPag["sicaf"] {
  const precisaPagar = shouldGerenciarAbrirPagamentoFromEmpresa(empresa);
  const status: PagStatus = precisaPagar ? "pendente" : "em_dia";

  const boletosAbertos = (financeiro?.sicaf?.pendentes ?? []).filter(isPagamentoSicafGerado);
  const boletoRenovacao = boletosAbertos[0];
  const ultimoPago = financeiro?.sicaf?.pagos?.[0];
  const vigencia = empresa.validade?.replace(/^Vencido em /, "") ?? undefined;
  const dias = empresa.diasValidade;

  let descricao: string;
  if (status === "em_dia") {
    if (empresa.sicaf === "atencao" && vigencia) {
      descricao =
        dias != null && dias > 0
          ? `Licença vence em ${dias} dia(s) · válida até ${vigencia}`
          : `Licença vencendo · válida até ${vigencia}`;
    } else if (vigencia) {
      descricao = `Licença válida até ${vigencia}`;
    } else {
      descricao = "Taxa SICAF quitada · cadastro em dia";
    }
  } else if (empresa.sicaf === "vencido") {
    descricao = empresa.validade
      ? `SICAF vencido (${empresa.validade}) — renove para voltar a licitar`
      : "SICAF vencido — renove para voltar a licitar";
  } else if (empresa.sicaf === "sem_cadastro") {
    descricao = "Sem cadastro SICAF — gere e pague a taxa anual";
  } else if (boletoRenovacao) {
    const sufixo = boletoRenovacao.vencido ? " · vencido" : "";
    descricao = `${boletoRenovacao.descricao || "Taxa SICAF"} · aguardando pagamento · vence ${formatFinanceDateBR(boletoRenovacao.dataVencimento)}${sufixo}`;
  } else {
    descricao = "Taxa anual do SICAF em aberto — gere o boleto ou PIX";
  }

  const valor =
    status === "pendente"
      ? (boletoRenovacao?.valor ?? valores.valorSicaf)
      : (ultimoPago?.valor ?? valores.valorSicaf);

  return {
    status,
    valor,
    vencimento: status === "em_dia" ? vigencia : undefined,
    descricao,
  };
}

/** Manutenção: pendência só por boletos em aberto. */
function buildManutencaoLinha(
  empresa: EmpresaData,
  financeiro: ClienteFinanceiroPainel | null,
  valores: ValoresRef,
): LinhaPag["manutencao"] {
  const manutPendentes = (financeiro?.manutencao?.pendentes ?? []).filter(
    (p) => p.pendente && !p.pago,
  );
  const proximoManut = manutPendentes[0];

  let status: PagStatus = empresa.manutencaoAtiva ? "em_dia" : "nao_contratado";
  if (manutPendentes.length > 0) {
    status = "pendente";
  }

  const diaManut =
    extrairDiaVencimento(proximoManut?.dataVencimento) ??
    extrairDiaVencimento(financeiro?.manutencao?.pagos?.[0]?.dataVencimento);

  let descricao: string;
  if (proximoManut) {
    const sufixo = proximoManut.vencido ? " · em atraso" : "";
    descricao = `${proximoManut.descricao || "Manutenção"} · vence ${formatFinanceDateBR(proximoManut.dataVencimento)}${sufixo}`;
  } else if (empresa.manutencaoAtiva) {
    descricao = diaManut
      ? `Plano ativo · mensalidade vence todo dia ${diaManut}`
      : "Plano de manutenção ativo · sem boletos pendentes";
  } else {
    descricao = "Plano de manutenção não contratado";
  }

  return {
    status,
    valor: proximoManut?.valor ?? valores.valorManutencao,
    diaVencimento: diaManut,
    descricao,
  };
}

function buildLinhaPag(
  empresa: EmpresaData,
  financeiro: ClienteFinanceiroPainel | null,
  valores: ValoresRef,
): LinhaPag {
  return {
    empresa,
    financeiro,
    sicaf: buildSicafLinha(empresa, financeiro, valores),
    manutencao: buildManutencaoLinha(empresa, financeiro, valores),
  };
}

function MeusPagamentosPage() {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [loading, setLoading] = useState(true);
  const [linhas, setLinhas] = useState<LinhaPag[]>([]);

  const [empresaAcao, setEmpresaAcao] = useState<EmpresaData | null>(null);
  const [sicafValidade, setSicafValidade] = useState<string | null>(null);
  const [pagamentoSicafOpen, setPagamentoSicafOpen] = useState(false);
  const [sicafResumoOpen, setSicafResumoOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [manutCtx, setManutCtx] = useState<{
    empresa: EmpresaData;
    diaVencimento?: number;
    mode: "ativar" | "gerenciar";
  } | null>(null);
  const [processandoSicaf, setProcessandoSicaf] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, valRes, manutVal] = await Promise.all([
        fetchEmpresas(),
        fetchSicafValores(),
        fetchValorManutencaoMensal(),
      ]);

      const valores: ValoresRef = {
        valorSicaf: valRes.ok ? valRes.valores?.valorCadastroSicaf ?? 985 : 985,
        valorManutencao: manutVal,
      };

      if (!empRes.ok) {
        toast.error(empRes.error || "Erro ao carregar empresas");
        setLinhas([]);
        return;
      }

      const empresas = empRes.empresas.filter((e) => e.clienteId);
      if (empresas.length === 0) {
        setLinhas([]);
        return;
      }

      const financeiros = await Promise.all(
        empresas.map((e) => fetchClienteFinanceiro(e.clienteId!)),
      );

      setLinhas(
        empresas.map((empresa, i) =>
          buildLinhaPag(
            empresa,
            financeiros[i].ok ? financeiros[i].financeiro ?? null : null,
            valores,
          ),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const kpis = useMemo(() => {
    let pendentes = 0;
    let emAberto = 0;
    let mensal = 0;
    for (const l of linhas) {
      const temPendencia =
        l.sicaf.status === "pendente" || l.manutencao.status === "pendente";
      if (temPendencia) pendentes++;

      if (l.sicaf.status === "pendente") {
        const boletos = (l.financeiro?.sicaf?.pendentes ?? []).filter(isPagamentoSicafGerado);
        if (boletos.length) {
          emAberto += boletos.reduce((s, p) => s + (p.valor || 0), 0);
        } else {
          emAberto += l.sicaf.valor;
        }
      }
      if (l.manutencao.status === "pendente") {
        for (const p of l.financeiro?.manutencao?.pendentes ?? []) {
          if (p.pendente && !p.pago) emAberto += p.valor || 0;
        }
      }

      if (l.empresa.manutencaoAtiva) {
        mensal += l.manutencao.valor;
      }
    }
    return { pendentes, emAberto, mensal, total: linhas.length };
  }, [linhas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      const temPendencia =
        l.sicaf.status === "pendente" || l.manutencao.status === "pendente";
      if (filtro === "pendente" && !temPendencia) return false;
      if (filtro === "em_dia" && temPendencia) return false;
      if (!q) return true;
      return (
        l.empresa.nome.toLowerCase().includes(q) ||
        l.empresa.cnpj.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
      );
    });
  }, [linhas, busca, filtro]);

  const abrirSicaf = async (linha: LinhaPag) => {
    const { empresa, sicaf } = linha;
    if (!empresa.clienteId) {
      toast.error("Empresa sem identificador. Atualize a página.");
      return;
    }
    setEmpresaAcao(empresa);
    setSicafValidade(empresa.validade ?? sicaf.vencimento ?? null);

    if (sicaf.status === "em_dia") {
      setSicafResumoOpen(true);
      return;
    }

    setProcessandoSicaf(true);
    try {
      const res = await detectarFluxoPagamentoSicaf(empresa.clienteId);
      if (!res.ok) {
        toast.error(res.error || "Erro ao verificar pagamentos");
        return;
      }
      if (res.fluxo === "pendentes") {
        setWizardOpen(true);
      } else {
        setPagamentoSicafOpen(true);
      }
    } finally {
      setProcessandoSicaf(false);
    }
  };

  const abrirManutencao = (linha: LinhaPag) => {
    const gerenciar =
      linha.empresa.manutencaoAtiva || linha.manutencao.status !== "nao_contratado";
    setManutCtx({
      empresa: linha.empresa,
      diaVencimento: linha.manutencao.diaVencimento,
      mode: gerenciar ? "gerenciar" : "ativar",
    });
  };

  const empresaModalCtx = empresaAcao?.clienteId
    ? { nome: empresaAcao.nome, cnpj: empresaAcao.cnpj, clienteId: empresaAcao.clienteId }
    : null;

  const fmt = (v: number) => formatFinanceBRL(v);

  return (
    <PageContainer>
      <PageHeader
        icon={<Wallet className="h-5 w-5" />}
        title="Pagamentos"
        subtitle="SICAF conforme pagamento e vigência da licença. Manutenção conforme boletos mensais em aberto."
        action={
          <Button variant="outline" className="gap-1.5" asChild>
            <Link to="/empresas">
              <Plus className="h-4 w-4" />
              Nova empresa
            </Link>
          </Button>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icon={<Building2 className="h-4 w-4" />} label="Empresas" value={String(kpis.total)} tone="default" />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Pendentes"
          value={String(kpis.pendentes)}
          tone={kpis.pendentes ? "danger" : "ok"}
        />
        <KpiCard
          icon={<Receipt className="h-4 w-4" />}
          label="Em aberto"
          value={fmt(kpis.emAberto)}
          tone={kpis.emAberto ? "warn" : "ok"}
        />
        <KpiCard
          icon={<CalendarClock className="h-4 w-4" />}
          label="Mensalidade ativa"
          value={fmt(kpis.mensal)}
          tone="default"
        />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empresa ou CNPJ..."
            className="pl-9"
          />
        </div>
        <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
          <TabsList>
            <TabsTrigger value="todas" className="text-xs">
              Todas
            </TabsTrigger>
            <TabsTrigger value="pendente" className="text-xs">
              Com pendência
            </TabsTrigger>
            <TabsTrigger value="em_dia" className="text-xs">
              Em dia
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="mt-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Carregando pagamentos das suas empresas...</p>
        </div>
      ) : linhas.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">Nenhuma empresa cadastrada</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Cadastre uma empresa para gerenciar taxas SICAF e manutenção mensal.
            </p>
            <Button asChild size="sm">
              <Link to="/empresas">Ir para Minhas Empresas</Link>
            </Button>
          </CardContent>
        </Card>
      ) : filtradas.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Filter className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Nenhum pagamento encontrado</p>
            <p className="text-xs text-muted-foreground">Ajuste a busca ou o filtro acima.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {filtradas.map((l) => (
            <EmpresaPagamentosCard
              key={l.empresa.clienteId ?? l.empresa.cnpj}
              linha={l}
              sicafLoading={processandoSicaf && empresaAcao?.clienteId === l.empresa.clienteId}
              onPagarSicaf={() => void abrirSicaf(l)}
              onAbrirManutencao={() => abrirManutencao(l)}
            />
          ))}
        </div>
      )}

      {empresaModalCtx && (
        <>
          <PagamentoSicafResumoModal
            open={sicafResumoOpen}
            onOpenChange={setSicafResumoOpen}
            empresa={empresaModalCtx}
            validade={sicafValidade}
          />
          <PagamentoSicafModal
            open={pagamentoSicafOpen}
            onOpenChange={setPagamentoSicafOpen}
            empresa={empresaModalCtx}
            onGerado={() => void carregar()}
            onPago={() => void carregar()}
          />
          <PagamentosPendentesWizard
            open={wizardOpen}
            onOpenChange={setWizardOpen}
            empresa={empresaModalCtx}
            onNovoPagamento={() => {
              setWizardOpen(false);
              setPagamentoSicafOpen(true);
            }}
            onPago={() => void carregar()}
          />
        </>
      )}

      <ManutencaoModal
        open={Boolean(manutCtx)}
        onOpenChange={(v) => {
          if (!v) setManutCtx(null);
        }}
        empresa={manutCtx?.empresa ?? null}
        mode={manutCtx?.mode ?? "ativar"}
        diaVencimento={manutCtx?.diaVencimento}
        onAtivar={() => void carregar()}
        onCancelar={() => void carregar()}
        onPaymentGenerated={() => void carregar()}
      />
    </PageContainer>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "default" | "ok" | "warn" | "danger";
}) {
  const map = {
    default: "bg-muted text-foreground border-border",
    ok: "bg-success/10 text-success border-success/20",
    warn: "bg-warning/15 text-warning-foreground border-warning/30",
    danger: "bg-danger/10 text-danger border-danger/20",
  } as const;
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${map[tone]}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-bold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusChip({ status }: { status: PagStatus }) {
  if (status === "em_dia") {
    return (
      <Badge className="gap-1 bg-success/10 text-success hover:bg-success/15 border border-success/20">
        <CheckCircle2 className="h-3 w-3" />
        Em dia
      </Badge>
    );
  }
  if (status === "pendente") {
    return (
      <Badge className="gap-1 bg-danger/10 text-danger hover:bg-danger/15 border border-danger/20">
        <XCircle className="h-3 w-3" />
        Pendente
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <AlertTriangle className="h-3 w-3" />
      Não contratado
    </Badge>
  );
}

function PagamentoLinha({
  icon,
  titulo,
  descricao,
  valor,
  status,
  onAcao,
  acaoLabel,
  acaoIcon,
  acaoLoading,
}: {
  icon: React.ReactNode;
  titulo: string;
  descricao: string;
  valor: string;
  status: PagStatus;
  onAcao: () => void;
  acaoLabel: string;
  acaoIcon: React.ReactNode;
  acaoLoading?: boolean;
}) {
  const pendente = status === "pendente";
  const naoContratado = status === "nao_contratado";
  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
        pendente ? "border-danger/30 bg-danger/5" : "bg-background"
      }`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
            pendente
              ? "border-danger/30 bg-danger/10 text-danger"
              : naoContratado
                ? "border-border bg-muted text-muted-foreground"
                : "border-success/30 bg-success/10 text-success"
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{titulo}</p>
            <StatusChip status={status} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor</p>
          <p className="text-sm font-bold">{valor}</p>
        </div>
        <Button
          size="sm"
          variant={pendente ? "default" : "outline"}
          className="gap-1.5"
          onClick={onAcao}
          disabled={acaoLoading}
        >
          {acaoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : acaoIcon}
          {acaoLabel}
        </Button>
      </div>
    </div>
  );
}

function EmpresaPagamentosCard({
  linha,
  onPagarSicaf,
  onAbrirManutencao,
  sicafLoading,
}: {
  linha: LinhaPag;
  onPagarSicaf: () => void;
  onAbrirManutencao: () => void;
  sicafLoading?: boolean;
}) {
  const { empresa, sicaf, manutencao, financeiro } = linha;
  const temPendencia = sicaf.status === "pendente" || manutencao.status === "pendente";
  const fmt = formatFinanceBRL;

  const sicafBoletosGerados = (financeiro?.sicaf?.pendentes ?? []).filter(isPagamentoSicafGerado);
  const sicafAcaoLabel =
    sicaf.status === "pendente"
      ? sicafBoletosGerados.length
        ? "Ver cobrança"
        : empresa.sicaf === "vencido"
          ? "Renovar"
          : "Pagar agora"
      : "Ver situação";

  const handleSicafAcao = () => {
    onPagarSicaf();
  };

  return (
    <Card className={`overflow-hidden ${temPendencia ? "border-danger/40" : ""}`}>
      <div
        className={`flex items-center justify-between gap-2 px-5 py-2.5 ${
          temPendencia ? "bg-danger/5" : "bg-muted/40"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              temPendencia ? "bg-danger/15 text-danger" : "bg-primary/10 text-primary"
            }`}
          >
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{empresa.nome}</p>
            <p className="text-[11px] text-muted-foreground">CNPJ {empresa.cnpj}</p>
          </div>
        </div>
        {temPendencia ? (
          <Badge className="gap-1 bg-danger text-white hover:bg-danger/90">
            <AlertTriangle className="h-3 w-3" />
            Pendência ativa
          </Badge>
        ) : (
          <Badge className="gap-1 bg-success text-white hover:bg-success/90">
            <CheckCircle2 className="h-3 w-3" />
            Tudo em dia
          </Badge>
        )}
      </div>

      <CardContent className="space-y-3 p-4">
        <PagamentoLinha
          icon={<ShieldCheck className="h-5 w-5" />}
          titulo="Taxa SICAF (anual)"
          descricao={sicaf.descricao}
          valor={fmt(sicaf.valor)}
          status={sicaf.status}
          onAcao={handleSicafAcao}
          acaoLabel={sicafAcaoLabel}
          acaoIcon={<Receipt className="h-3.5 w-3.5" />}
          acaoLoading={sicafLoading}
        />
        <PagamentoLinha
          icon={<Wrench className="h-5 w-5" />}
          titulo="Manutenção SICAF (mensal)"
          descricao={manutencao.descricao}
          valor={fmt(manutencao.valor)}
          status={manutencao.status}
          onAcao={onAbrirManutencao}
          acaoLabel={manutencao.status === "nao_contratado" ? "Contratar" : "Gerenciar"}
          acaoIcon={
            manutencao.status === "nao_contratado" ? (
              <Plus className="h-3.5 w-3.5" />
            ) : (
              <Wrench className="h-3.5 w-3.5" />
            )
          }
        />
      </CardContent>
    </Card>
  );
}
