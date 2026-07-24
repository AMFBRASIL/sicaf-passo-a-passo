import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Stethoscope,
  Building2,
  Receipt,
  ShieldCheck,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Circle,
  Loader2,
  XCircle,
  Bot,
  ArrowRight,
  RefreshCw,
  Search,
  ListChecks,
  Upload,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { PageContainer, PageHeader } from "@/components/page-header";
import { SelecionarEmpresaModal } from "@/components/selecionar-empresa-modal";
import { fetchEmpresas, fetchEmpresaGerenciar } from "@/lib/empresas-api";
import { fetchDocumentosChecklist, resolveEmpresaPorCnpj } from "@/lib/documentos-api";
import { pagamentoSicafConfirmado } from "@/lib/sicaf-page-api";
import { formatCnpjInput } from "@/lib/concorrencia-api";
import {
  enriquecerEmpresaComPainel,
  statusLabel,
  type EmpresaData,
} from "@/lib/empresas-shared";
import {
  buildDiagnosticoSicaf,
  docFaltandoLabel,
  nivelStatusLabel,
  type DiagnosticoEtapa,
  type DiagnosticoResultado,
} from "@/lib/diagnostico-sicaf";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type DiagnosticoSearch = { cnpj?: string };

export const Route = createFileRoute("/diagnostico")({
  head: () => ({
    meta: [
      { title: "Diagnóstico SICAF — CADBRASIL" },
      {
        name: "description",
        content:
          "Diagnóstico completo do seu cadastro SICAF: etapas concluídas, níveis e documentos que faltam.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): DiagnosticoSearch => ({
    cnpj: typeof search.cnpj === "string" ? search.cnpj : undefined,
  }),
  component: DiagnosticoPage,
});

const CHECKS = [
  { id: "empresa", label: "Identificando empresa e CNPJ", icon: Building2 },
  { id: "licenca", label: "Verificando licença SICAF (taxa CADBRASIL)", icon: Receipt },
  { id: "niveis", label: "Analisando níveis I a VI no Compras.gov.br", icon: ShieldCheck },
  { id: "documentos", label: "Conferindo documentos e certidões", icon: FileText },
  { id: "plano", label: "Montando plano de ação para o Assistente", icon: Sparkles },
] as const;

type CheckId = (typeof CHECKS)[number]["id"];
type CheckStatus = "idle" | "rodando" | "ok" | "alerta" | "erro";
type CheckState = { id: CheckId; status: CheckStatus; detalhe?: string };

const CHECKS_INICIAIS: CheckState[] = CHECKS.map((c) => ({ id: c.id, status: "idle" }));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function DiagnosticoPage() {
  const { cnpj } = Route.useSearch();
  const navigate = useNavigate();

  const [fase, setFase] = useState<"selecao" | "rodando" | "concluido">("selecao");
  const [checks, setChecks] = useState<CheckState[]>(CHECKS_INICIAIS);
  const [resultado, setResultado] = useState<DiagnosticoResultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [cnpjInput, setCnpjInput] = useState("");
  const [empresas, setEmpresas] = useState<EmpresaData[]>([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(true);
  const [selecionarOpen, setSelecionarOpen] = useState(false);

  const rodandoRef = useRef<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoadingEmpresas(true);
      const res = await fetchEmpresas();
      setLoadingEmpresas(false);
      if (res.ok) setEmpresas(res.empresas);
    })();
  }, []);

  const marcar = useCallback((id: CheckId, status: CheckStatus, detalhe?: string) => {
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, status, detalhe } : c)));
  }, []);

  const executar = useCallback(
    async (cnpjBusca: string) => {
      if (rodandoRef.current === cnpjBusca) return;
      rodandoRef.current = cnpjBusca;

      setFase("rodando");
      setChecks(CHECKS_INICIAIS);
      setResultado(null);
      setErro(null);

      try {
        marcar("empresa", "rodando");
        const resolved = await resolveEmpresaPorCnpj(cnpjBusca);
        await sleep(450);
        if (!resolved.ok || !resolved.empresa?.clienteId) {
          marcar("empresa", "erro", resolved.error || "Empresa não encontrada");
          setErro(
            resolved.error ||
              "Não encontramos esse CNPJ na sua conta. Confira o número ou cadastre a empresa.",
          );
          setFase("selecao");
          rodandoRef.current = null;
          return;
        }
        const clienteId = resolved.empresa.clienteId;
        marcar("empresa", "ok", resolved.empresa.nome || cnpjBusca);

        marcar("licenca", "rodando");
        const painelRes = await fetchEmpresaGerenciar(clienteId);
        await sleep(450);
        const painel = painelRes.ok ? painelRes.painel ?? null : null;
        const taxaPaga = pagamentoSicafConfirmado(painel);
        marcar(
          "licenca",
          taxaPaga ? "ok" : "alerta",
          taxaPaga
            ? `Licença ${painel?.sicaf?.status || "ativa"} e paga`
            : "Taxa CADBRASIL ainda não confirmada",
        );

        // Níveis reais e dados cadastrais vêm do painel de gerenciamento
        const empresa: EmpresaData = painel
          ? enriquecerEmpresaComPainel(resolved.empresa, painel)
          : resolved.empresa;

        marcar("niveis", "rodando");
        await sleep(500);
        const niveisSync = [1, 2, 3, 4, 5, 6].filter((n) => {
          const s = empresa.detalhesNiveis?.[n]?.status;
          return s === "validado" || s === "vencendo" || s === "vencido";
        }).length;
        marcar(
          "niveis",
          niveisSync > 0 ? "ok" : "alerta",
          niveisSync > 0
            ? `${niveisSync} de 6 níveis sincronizados`
            : "Nenhum nível sincronizado pelo Assistente",
        );

        marcar("documentos", "rodando");
        const checklist = await fetchDocumentosChecklist(clienteId);
        await sleep(500);
        const docsPorNivel = checklist.docsPorNivel || {};
        const totalDocs = Object.values(docsPorNivel).flat().length;
        const faltandoDocs = Object.values(docsPorNivel)
          .flat()
          .filter((d) => d.status !== "ok").length;
        marcar(
          "documentos",
          faltandoDocs === 0 && totalDocs > 0 ? "ok" : "alerta",
          totalDocs === 0
            ? "Checklist de documentos ainda não gerado"
            : faltandoDocs === 0
              ? `${totalDocs} documentos em ordem`
              : `${faltandoDocs} de ${totalDocs} documentos pendentes`,
        );

        marcar("plano", "rodando");
        const diagnostico = buildDiagnosticoSicaf({
          empresa,
          painel,
          docsPorNivel,
          taxaPaga,
        });
        await sleep(500);
        marcar(
          "plano",
          "ok",
          diagnostico.proximaEtapa
            ? `Próximo passo: ${diagnostico.proximaEtapa.titulo}`
            : "Cadastro completo — nada pendente",
        );

        setResultado(diagnostico);
        setFase("concluido");
      } catch {
        setErro("Não foi possível concluir o diagnóstico. Tente novamente.");
        setFase("selecao");
      } finally {
        rodandoRef.current = null;
      }
    },
    [marcar],
  );

  useEffect(() => {
    if (!cnpj) {
      setFase("selecao");
      setResultado(null);
      return;
    }
    void executar(cnpj);
  }, [cnpj, executar]);

  const iniciarPorInput = () => {
    const digits = cnpjInput.replace(/\D/g, "");
    if (digits.length !== 14 && digits.length !== 11) {
      toast.error("Informe um CNPJ válido (14 dígitos).");
      return;
    }
    void navigate({ to: "/diagnostico", search: { cnpj: cnpjInput } });
  };

  return (
    <PageContainer>
      <PageHeader
        icon={<Stethoscope className="h-5 w-5" />}
        title="Diagnóstico SICAF"
        subtitle={
          resultado
            ? `${resultado.empresa.nome} · CNPJ ${resultado.empresa.cnpj}`
            : "Escolha um CNPJ e veja em segundos todas as etapas e os documentos que faltam."
        }
        action={
          cnpj ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setSelecionarOpen(true)}
              >
                <Building2 className="h-3.5 w-3.5" />
                Trocar empresa
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={fase === "rodando"}
                onClick={() => void executar(cnpj)}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", fase === "rodando" && "animate-spin")} />
                Refazer
              </Button>
            </div>
          ) : undefined
        }
      />

      {fase === "selecao" && (
        <SelecaoCnpj
          erro={erro}
          empresas={empresas}
          loading={loadingEmpresas}
          cnpjInput={cnpjInput}
          onCnpjInput={(v) => setCnpjInput(formatCnpjInput(v))}
          onIniciar={iniciarPorInput}
          onSelecionar={(empresa) =>
            void navigate({ to: "/diagnostico", search: { cnpj: empresa.cnpj } })
          }
          onAbrirModal={() => setSelecionarOpen(true)}
        />
      )}

      {fase !== "selecao" && (
        <ChecksCard checks={checks} rodando={fase === "rodando"} />
      )}

      {fase === "concluido" && resultado && <Resultado resultado={resultado} />}

      <SelecionarEmpresaModal
        open={selecionarOpen}
        onOpenChange={setSelecionarOpen}
        empresaAtualCnpj={resultado?.empresa.cnpj ?? cnpj}
        titulo="Escolher empresa para o diagnóstico"
        descricao="Selecione o CNPJ que você quer diagnosticar."
        onSelect={(empresa) => void navigate({ to: "/diagnostico", search: { cnpj: empresa.cnpj } })}
      />
    </PageContainer>
  );
}

function SelecaoCnpj({
  erro,
  empresas,
  loading,
  cnpjInput,
  onCnpjInput,
  onIniciar,
  onSelecionar,
  onAbrirModal,
}: {
  erro: string | null;
  empresas: EmpresaData[];
  loading: boolean;
  cnpjInput: string;
  onCnpjInput: (v: string) => void;
  onIniciar: () => void;
  onSelecionar: (empresa: EmpresaData) => void;
  onAbrirModal: () => void;
}) {
  return (
    <>
      {erro && (
        <Card className="mt-6 border-danger/40 bg-danger/5">
          <CardContent className="flex items-start gap-3 py-4">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
            <p className="text-sm">{erro}</p>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6 border-primary/30 bg-gradient-to-br from-primary/5 via-card to-accent/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Search className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-tight">
                Qual CNPJ você quer diagnosticar?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Vamos conferir a licença SICAF, os 6 níveis do Compras.gov.br e todos os documentos
                exigidos — e mostrar exatamente o que falta.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Input
              value={cnpjInput}
              onChange={(e) => onCnpjInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onIniciar();
              }}
              placeholder="00.000.000/0000-00"
              className="font-mono sm:max-w-xs"
              inputMode="numeric"
            />
            <Button className="gap-2" onClick={onIniciar}>
              <Stethoscope className="h-4 w-4" />
              Iniciar diagnóstico
            </Button>
            {empresas.length > 0 && (
              <Button variant="outline" className="gap-2" onClick={onAbrirModal}>
                <Building2 className="h-4 w-4" />
                Ver minhas empresas
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {loading ? "Carregando suas empresas..." : "Ou escolha uma empresa já cadastrada"}
        </h3>

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando seus CNPJs...
          </div>
        ) : empresas.length === 0 ? (
          <Card className="mt-3 border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">Nenhuma empresa cadastrada</p>
              <Button asChild size="sm">
                <Link to="/empresas">Cadastrar empresa</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {empresas.map((empresa) => {
              const meta = statusLabel[empresa.sicaf];
              return (
                <button
                  key={empresa.clienteId ?? empresa.cnpj}
                  type="button"
                  onClick={() => onSelecionar(empresa)}
                  className="group rounded-xl border-2 border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold leading-tight">{empresa.nome}</p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                        {empresa.cnpj}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-semibold",
                        meta.status === "ok" && "border-success/30 bg-success/10 text-success",
                        meta.status === "warn" &&
                          "border-warning/30 bg-warning/10 text-warning-foreground",
                        meta.status === "danger" && "border-danger/30 bg-danger/10 text-danger",
                        meta.status === "idle" && "text-muted-foreground",
                      )}
                    >
                      {meta.label}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
                      Diagnosticar <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function ChecksCard({ checks, rodando }: { checks: CheckState[]; rodando: boolean }) {
  const concluidos = checks.filter((c) => c.status !== "idle" && c.status !== "rodando").length;

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {rodando ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <ListChecks className="h-4 w-4 text-primary" />
            )}
            {rodando ? "Executando diagnóstico..." : "Diagnóstico executado"}
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {concluidos} de {checks.length} verificações
          </span>
        </div>
        <Progress value={(concluidos / checks.length) * 100} className="mt-2 h-1.5" />
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="divide-y divide-border">
          {CHECKS.map((check) => {
            const state = checks.find((c) => c.id === check.id)!;
            const Icon = check.icon;
            return (
              <li key={check.id} className="flex items-center gap-3 py-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    state.status === "idle" && "bg-muted text-muted-foreground/60",
                    state.status === "rodando" && "bg-primary/10 text-primary",
                    state.status === "ok" && "bg-success/10 text-success",
                    state.status === "alerta" && "bg-warning/15 text-warning-foreground",
                    state.status === "erro" && "bg-danger/10 text-danger",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      state.status === "idle" && "text-muted-foreground/60",
                    )}
                  >
                    {check.label}
                  </p>
                  {state.detalhe && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{state.detalhe}</p>
                  )}
                </div>
                <CheckStatusIcon status={state.status} />
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function CheckStatusIcon({ status }: { status: CheckStatus }) {
  if (status === "rodando") return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />;
  if (status === "ok") return <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />;
  if (status === "alerta") return <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />;
  if (status === "erro") return <XCircle className="h-5 w-5 shrink-0 text-danger" />;
  return <Circle className="h-4 w-4 shrink-0 text-muted-foreground/30" />;
}

function Resultado({ resultado }: { resultado: DiagnosticoResultado }) {
  const {
    empresa,
    score,
    niveis,
    niveisValidados,
    docsFaltando,
    docsTotal,
    docsOk,
    etapas,
    proximaEtapa,
    taxaPaga,
    sicafStatus,
  } = resultado;

  const niveisComPendencia = niveis.filter((n) => n.docsFaltando.length > 0);
  const tone = score >= 80 ? "ok" : score >= 50 ? "warn" : "danger";

  return (
    <>
      {/* Resumo */}
      <Card className="mt-6 overflow-hidden">
        <div
          className={cn(
            "px-6 py-5 text-white",
            tone === "ok" && "bg-gradient-to-br from-success via-success/90 to-success/70",
            tone === "warn" && "bg-gradient-to-br from-warning via-warning/90 to-warning/70",
            tone === "danger" && "bg-gradient-to-br from-danger via-danger/90 to-danger/70",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
                Resultado do diagnóstico
              </p>
              <p className="mt-1 text-2xl font-bold leading-tight">
                {score >= 80
                  ? "Cadastro em boa forma"
                  : score >= 50
                    ? "Falta pouco para ficar completo"
                    : "Cadastro precisa de atenção"}
              </p>
              <p className="mt-1 text-sm opacity-90">
                {empresa.nome} · CNPJ {empresa.cnpj}
              </p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold leading-none">{score}</p>
              <p className="text-[11px] uppercase tracking-wider opacity-80">de 100</p>
            </div>
          </div>
        </div>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <ResumoItem
            icon={<Receipt className="h-4 w-4" />}
            label="Licença SICAF"
            value={taxaPaga ? "Paga" : "Pendente"}
            hint={sicafStatus}
            tone={taxaPaga ? "ok" : "danger"}
          />
          <ResumoItem
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Níveis validados"
            value={`${niveisValidados} de 6`}
            hint="Compras.gov.br"
            tone={niveisValidados === 6 ? "ok" : niveisValidados > 0 ? "warn" : "danger"}
          />
          <ResumoItem
            icon={<FileText className="h-4 w-4" />}
            label="Documentos"
            value={docsTotal ? `${docsOk} de ${docsTotal} ok` : "—"}
            hint={
              docsFaltando.length
                ? `${docsFaltando.length} pendente${docsFaltando.length === 1 ? "" : "s"}`
                : "Nada pendente"
            }
            tone={docsFaltando.length === 0 && docsTotal > 0 ? "ok" : "warn"}
          />
        </CardContent>
      </Card>

      {proximaEtapa && (
        <Card className="mt-4 border-primary/30 bg-primary/5">
          <CardContent className="flex items-start gap-3 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ArrowRight className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Seu próximo passo</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                <strong className="text-foreground">{proximaEtapa.titulo}</strong> —{" "}
                {proximaEtapa.detalhe}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CTA logo após o resumo — cliente vê sem precisar rolar até o fim */}
      <Card className="mt-4 border-primary/40 bg-gradient-to-br from-primary/10 via-card to-accent/40">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold leading-tight">
                Pronto para resolver com o Assistente
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {docsFaltando.length > 0
                  ? `O Assistente CADBRASIL vai te guiar no envio dos ${docsFaltando.length} documento(s) pendente(s) e atualizar seus níveis no Compras.gov.br.`
                  : "Envie a Situação do Fornecedor no Assistente para manter seus níveis sempre atualizados."}
              </p>
            </div>
          </div>

          <Button asChild size="lg" className="mt-4 h-14 w-full gap-2 text-base font-semibold">
            <Link to="/assistente" search={{ cnpj: empresa.cnpj }}>
              <Bot className="h-5 w-5" />
              Acessar Assistente para SICAF
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="flex-1 gap-2">
              <Link to="/documentos" search={{ cnpj: empresa.cnpj }}>
                <Upload className="h-4 w-4" />
                Enviar documentos
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1 gap-2">
              <Link to="/sicaf" search={{ cnpj: empresa.cnpj }}>
                <ShieldCheck className="h-4 w-4" />
                Ir para Central SICAF
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Etapas do processo */}
      <Card className="mt-6">
        <CardHeader className="border-b bg-muted/30 py-3">
          <CardTitle className="text-base">Etapas do processo SICAF</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ol className="divide-y divide-border">
            {etapas.map((etapa) => (
              <EtapaLinha key={etapa.n} etapa={etapa} />
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Níveis */}
      <Card className="mt-6">
        <CardHeader className="border-b bg-muted/30 py-3">
          <CardTitle className="text-base">Situação dos níveis I a VI</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {niveis.map((nivel) => (
              <li key={nivel.num} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                    style={{ backgroundColor: nivel.color }}
                  >
                    {nivel.roman}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{nivel.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {nivel.docsTotal > 0
                        ? `${nivel.docsOk} de ${nivel.docsTotal} documentos ok`
                        : "Sem documentos mapeados"}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 text-[10px] font-semibold",
                    nivel.status === "validado" && "border-success/30 bg-success/10 text-success",
                    (nivel.status === "vencendo" || nivel.status === "pendente") &&
                      "border-warning/30 bg-warning/10 text-warning-foreground",
                    nivel.status === "vencido" && "border-danger/30 bg-danger/10 text-danger",
                    nivel.status === "nao_cadastrado" && "text-muted-foreground",
                  )}
                >
                  {nivelStatusLabel(nivel.status)}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Documentos que faltam */}
      <Card className="mt-6">
        <CardHeader className="border-b bg-muted/30 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Documentos que faltam</CardTitle>
            {docsFaltando.length > 0 && (
              <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning-foreground text-[10px] font-semibold">
                {docsFaltando.length} pendente{docsFaltando.length === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className={docsFaltando.length === 0 ? "py-8" : "p-0"}>
          {docsFaltando.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <CheckCircle2 className="h-10 w-10 text-success" />
              <p className="text-sm font-semibold">Nenhum documento pendente</p>
              <p className="text-xs text-muted-foreground">
                Todos os documentos exigidos para o SICAF já estão enviados e válidos.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {niveisComPendencia.map((nivel) => (
                <div key={nivel.num} className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold text-white"
                      style={{ backgroundColor: nivel.color }}
                    >
                      {nivel.roman}
                    </span>
                    <p className="text-sm font-semibold">{nivel.nome}</p>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {nivel.docsFaltando.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-start justify-between gap-3 rounded-lg border bg-card px-3 py-2.5"
                      >
                        <div className="flex min-w-0 items-start gap-2.5">
                          <AlertTriangle
                            className={cn(
                              "mt-0.5 h-4 w-4 shrink-0",
                              doc.status === "vencida" ? "text-danger" : "text-warning",
                            )}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{doc.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.orgaoEmissor || doc.descricao || "Documento exigido no SICAF"}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 text-[10px] font-semibold",
                            doc.status === "vencida"
                              ? "border-danger/30 bg-danger/10 text-danger"
                              : "border-warning/30 bg-warning/10 text-warning-foreground",
                          )}
                        >
                          {docFaltandoLabel(doc)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function EtapaLinha({ etapa }: { etapa: DiagnosticoEtapa }) {
  return (
    <li className="flex items-start gap-3 px-5 py-4">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          etapa.status === "ok" && "bg-success text-white",
          etapa.status === "atencao" && "bg-warning text-white",
          etapa.status === "pendente" && "bg-muted text-muted-foreground",
        )}
      >
        {etapa.status === "ok" ? <CheckCircle2 className="h-4 w-4" /> : etapa.n}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{etapa.titulo}</p>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-semibold",
              etapa.status === "ok" && "border-success/30 bg-success/10 text-success",
              etapa.status === "atencao" &&
                "border-warning/30 bg-warning/10 text-warning-foreground",
              etapa.status === "pendente" && "text-muted-foreground",
            )}
          >
            {etapa.status === "ok"
              ? "Concluída"
              : etapa.status === "atencao"
                ? "Requer atenção"
                : "Pendente"}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{etapa.descricao}</p>
        <p className="mt-1 text-sm">{etapa.detalhe}</p>
      </div>
    </li>
  );
}

function ResumoItem({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone: "ok" | "warn" | "danger";
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <p
        className={cn(
          "mt-1.5 text-lg font-bold",
          tone === "ok" && "text-success",
          tone === "warn" && "text-warning-foreground",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
