import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Shield,
  Check,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  Sparkles,
  ArrowRight,
  Loader2,
  Building2,
  RefreshCw,
  Bot,
  Wrench,
  Lock,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ManutencaoModal } from "@/components/manutencao-modal";
import { SaudeDocumentalCard } from "@/components/saude-documental-card";
import { NivelDots } from "@/components/admin/nivel-dots";
import { SicafFlowModals } from "@/components/sicaf/sicaf-flow-modals";
import { sicafSearchSchema, useSicafFlow } from "@/hooks/use-sicaf-flow";
import {
  certificadoEstaValido,
  formatCertValidade,
  type CertificadoDigitalInfo,
} from "@/lib/certificado-api";
import type { PipelineEtapa } from "@/lib/sicaf-pipeline-ui";
import type { EmpresaData } from "@/lib/empresas-shared";
import {
  countNiveisAtivosExibicao,
  enriquecerEmpresaComPainel,
  niveisMapParaExibicao,
  progressoNiveisEmpresa,
  segmentoEmpresaCard,
} from "@/lib/empresas-shared";

function normalizeCnpj(value?: string) {
  return (value ?? "").replace(/\D/g, "");
}

function cnpjsMatch(a?: string, b?: string) {
  const na = normalizeCnpj(a);
  const nb = normalizeCnpj(b);
  return na.length > 0 && na === nb;
}

export const Route = createFileRoute("/sicaf_old")({
  validateSearch: sicafSearchSchema,
  head: () => ({
    meta: [
      { title: "Etapas SICAF (pipeline) — CADBRASIL" },
      { name: "description", content: "Atualize seu SICAF passo a passo com o assistente CADBRASIL." },
    ],
  }),
  component: SicafPipelinePage,
});

function SicafPipelinePage() {
  const { cnpj } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const flow = useSicafFlow(cnpj);
  const selectedCnpj = cnpj ?? flow.cliente?.cnpj;

  const selectEmpresa = (nextCnpj: string) => {
    void navigate({ search: { cnpj: nextCnpj } });
  };

  const ativos = flow.empresas.length;
  const cliente = flow.cliente;
  const pipelineEtapas = flow.pipelineEtapas;
  const progresso = flow.progresso;
  const proximaAcao = flow.proximaAcao;

  const [manutencaoModal, setManutencaoModal] = useState<"ativar" | "gerenciar" | null>(null);

  const empresaAtual = useMemo(
    () => flow.empresas.find((e) => cnpjsMatch(e.cnpj, cliente?.cnpj)) ?? null,
    [flow.empresas, cliente?.cnpj],
  );

  const empresasOrdenadas = useMemo(() => {
    const enriquecer = (empresa: EmpresaData) =>
      cnpjsMatch(empresa.cnpj, selectedCnpj) && flow.painel
        ? enriquecerEmpresaComPainel(empresa, flow.painel)
        : empresa;

    return [...flow.empresas].sort((a, b) => {
      const diff =
        countNiveisAtivosExibicao(enriquecer(b)) - countNiveisAtivosExibicao(enriquecer(a));
      if (diff !== 0) return diff;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [flow.empresas, flow.painel, selectedCnpj]);

  useEffect(() => {
    if (flow.empresasLoading || empresasOrdenadas.length === 0) return;

    const primeiro = empresasOrdenadas[0];
    const cnpjValido =
      cnpj && empresasOrdenadas.some((e) => cnpjsMatch(e.cnpj, cnpj));

    if (!cnpjValido) {
      void navigate({ search: { cnpj: primeiro.cnpj }, replace: true });
    }
  }, [cnpj, flow.empresasLoading, empresasOrdenadas, navigate]);

  const manutencaoAtiva = flow.painel?.manutencao.ativa ?? empresaAtual?.manutencaoAtiva ?? false;
  const diaVencimentoManut =
    flow.painel?.manutencao.diaVencimento ?? undefined;
  const subtituloManutencao = manutencaoAtiva
    ? flow.painel?.manutencao.proximoVencimento
      ? `Próximo boleto vence em ${flow.painel.manutencao.proximoVencimento}`
      : diaVencimentoManut
        ? `Vence todo dia ${diaVencimentoManut}`
        : "Plano de manutenção ativo"
    : "Ative para cuidarmos do seu SICAF";

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Andamento SICAF
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight lg:text-4xl">Etapas SICAF</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todo o processo nesta página ·{" "}
            <strong className="text-foreground">
              {ativos} empresa{ativos === 1 ? "" : "s"}
            </strong>
          </p>
        </div>
        {cliente && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => flow.setTrocarEmpresaOpen(true)}
          >
            <Building2 className="h-3.5 w-3.5" /> Trocar empresa
          </Button>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="scrollbar-hidden space-y-3 lg:sticky lg:top-6 lg:z-10 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain">
          {flow.empresasLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando empresas...
            </div>
          ) : flow.empresas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma empresa cadastrada.</p>
          ) : (
            empresasOrdenadas.map((e) => {
              const active = cnpjsMatch(e.cnpj, selectedCnpj);
              const empresaExibida =
                active && flow.painel
                  ? enriquecerEmpresaComPainel(e, flow.painel)
                  : e;
              return (
                <EmpresaSidebarCard
                  key={normalizeCnpj(e.cnpj) || e.cnpj}
                  empresa={empresaExibida}
                  active={active}
                  onSelect={() => selectEmpresa(e.cnpj)}
                />
              );
            })
          )}
        </aside>

        <div className="space-y-4 min-w-0">
          {flow.loading ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando dados da empresa...</p>
            </div>
          ) : !cliente || flow.loadError ? (
            <Card className="border-danger/30">
              <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                <AlertTriangle className="h-10 w-10 text-danger" />
                <p className="font-semibold">{flow.loadError || "Empresa não encontrada"}</p>
                <p className="text-sm text-muted-foreground">
                  Selecione outra empresa na lista ao lado.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-stretch gap-3 lg:gap-4">
              <div
                className={`min-w-[200px] flex-1 rounded-xl border px-3 py-2.5 ${
                  flow.tudoConcluido
                    ? "border-success/30 bg-success/10"
                    : "border-warning/30 bg-warning/10"
                }`}
              >
                  <div
                    className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider ${
                      flow.tudoConcluido ? "text-success" : "text-warning-foreground"
                    }`}
                  >
                    {flow.tudoConcluido ? (
                      <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                    )}
                    {flow.tudoConcluido ? "SICAF em ordem" : "Próxima ação"}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold leading-tight">
                    {proximaAcao.acao}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                    {proximaAcao.estimativa}
                  </p>
                  {flow.tudoConcluido ? (
                    flow.pagamentoConfirmado ? (
                      <Button asChild size="sm" className="mt-2 h-7 w-full gap-1 rounded-full text-[11px] font-semibold">
                        <Link to="/assistente" search={{ cnpj: normalizeCnpj(cliente.cnpj) }}>
                          Acessar SICAF
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        className="mt-2 h-7 w-full gap-1 rounded-full text-[11px] font-semibold"
                        onClick={flow.bloquearAssistente}
                      >
                        Acessar SICAF
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    )
                  ) : flow.pagamentoConfirmado ? (
                    <Button asChild size="sm" variant="outline" className="mt-2 h-7 w-full gap-1 rounded-full text-[11px] font-semibold">
                      <Link to="/assistente" search={{ cnpj: normalizeCnpj(cliente.cnpj) }}>
                        <Bot className="h-3 w-3" />
                        Acessar Assistente
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  ) : null}
                </div>
                <ManutencaoSicafCard
                  ativa={manutencaoAtiva}
                  subtitulo={subtituloManutencao}
                  onAtivar={() => setManutencaoModal("ativar")}
                  onGerenciar={() => setManutencaoModal("gerenciar")}
                />
                <CertificadoOpcionalCard
                  certificado={flow.certificado}
                  onClick={() => flow.setCertificadoModal(true)}
                />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground transition-all"
                  style={{ width: `${progresso}%` }}
                />
              </div>
              <span className="text-xs font-semibold tabular-nums">{progresso}%</span>
            </div>
          </div>

          {cliente.estado === "vencido" && !flow.renovando && flow.tudoConcluido && (
            <Card className="border-danger/40 bg-danger/5">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="text-sm">
                  <p className="font-semibold">SICAF vencido em {cliente.vencidoEm}</p>
                  <p className="text-muted-foreground">Renove para voltar a licitar.</p>
                </div>
                <Button className="gap-2" onClick={() => flow.setRenovacaoModal(true)}>
                  <RefreshCw className="h-4 w-4" /> Renovar SICAF
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {pipelineEtapas.map((etapa) => (
              <EtapaSicafCard
                key={etapa.id}
                etapa={etapa}
                clienteCnpj={cliente.cnpj}
                verificandoPagamento={flow.verificandoPagamento}
                pagamentoConfirmado={flow.pagamentoConfirmado}
                tudoConcluido={flow.tudoConcluido}
                onAbrir={() => flow.abrirEtapaModal(etapa.modalKey)}
                onBloquearAssistente={flow.bloquearAssistente}
              />
            ))}
          </div>

          <Card className="border-dashed">
            <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
              <FileCheck className="h-5 w-5 shrink-0 text-primary" />
              <span>
                Travou em alguma etapa?{" "}
                <Link
                  to="/suporte"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  Fale com um especialista
                </Link>{" "}
                — respondemos em minutos.
              </span>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Assistente CADBRASIL</p>
                <p className="text-xs text-muted-foreground">
                  Abra o Compras.gov.br sem sair desta página.
                </p>
              </div>
            </div>
            {flow.pagamentoConfirmado ? (
              <Button asChild size="sm" className="gap-1.5">
                <Link to="/assistente" search={{ cnpj: normalizeCnpj(cliente.cnpj) }}>
                  <Bot className="h-3.5 w-3.5" />
                  {flow.tudoConcluido ? "Acessar meu SICAF" : "Abrir assistente"}
                </Link>
              </Button>
            ) : (
              <Button size="sm" className="gap-1.5" onClick={flow.bloquearAssistente}>
                <Bot className="h-3.5 w-3.5" />
                {flow.tudoConcluido ? "Acessar meu SICAF" : "Abrir assistente"}
              </Button>
            )}
          </div>

          {flow.docsLoading ? (
            <Card className="border-primary/20">
              <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Calculando saúde documental…
              </CardContent>
            </Card>
          ) : (
            <SaudeDocumentalCard
              stats={flow.saudeStats}
              cnpj={cliente.cnpj}
              assistenteDisponivel={flow.pagamentoConfirmado}
              onAssistenteBloqueado={flow.bloquearAssistente}
              secondaryLink={{
                to: "/documentos",
                label: "Ver todos os documentos →",
                search: { cnpj: cliente.cnpj },
              }}
            />
          )}
            </>
          )}
        </div>
      </div>

      {cliente && <SicafFlowModals flow={flow} onSelectEmpresa={selectEmpresa} />}

      {empresaAtual && manutencaoModal && (
        <ManutencaoModal
          open
          onOpenChange={(v) => !v && setManutencaoModal(null)}
          empresa={empresaAtual}
          painel={flow.painel}
          mode={manutencaoModal}
          diaVencimento={diaVencimentoManut}
          onAtivar={() => void flow.recarregar()}
          onCancelar={() => void flow.recarregar()}
          onPaymentGenerated={() => void flow.recarregar()}
        />
      )}
    </div>
  );
}

function EmpresaSidebarCard({
  empresa,
  active,
  onSelect,
}: {
  empresa: EmpresaData;
  active: boolean;
  onSelect: () => void;
}) {
  const progresso = progressoNiveisEmpresa(empresa);
  const niveisAtivos = countNiveisAtivosExibicao(empresa);
  const niveisMap = niveisMapParaExibicao(empresa);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-pressed={active}
      aria-current={active ? "true" : undefined}
      className={`relative w-full cursor-pointer rounded-2xl border p-4 pr-10 text-left transition ${
        active
          ? "border-black bg-black text-white shadow-lg ring-2 ring-black ring-offset-2 ring-offset-background"
          : "border-border bg-card hover:border-foreground/30 hover:shadow-sm"
      }`}
    >
      {active && (
        <span
          className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black shadow-sm"
          aria-hidden
        >
          <Check className="h-3 w-3 stroke-[3]" />
        </span>
      )}
      <div className="flex items-center gap-1.5 text-xs">
        <Shield className={`h-3.5 w-3.5 ${active ? "text-white/70" : "text-primary"}`} />
        <span className={active ? "text-white/70" : "text-muted-foreground"}>
          CNPJ {empresa.cnpj}
        </span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm font-bold tracking-tight">{empresa.nome}</p>
      <p className={`text-xs ${active ? "text-white/60" : "text-muted-foreground"}`}>
        {segmentoEmpresaCard(empresa)}
      </p>
      <div className="mt-2.5">
        <NivelDots niveis={niveisMap} size="sm" bubbleClick />
        <p className={`mt-1.5 text-[10px] font-medium ${active ? "text-white/60" : "text-muted-foreground"}`}>
          {niveisAtivos} de 6 ativos
        </p>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className={`h-1 flex-1 rounded-full ${active ? "bg-white/20" : "bg-muted"}`}>
          <div
            className={`h-full rounded-full ${active ? "bg-white" : "bg-foreground"}`}
            style={{ width: `${progresso}%` }}
          />
        </div>
        <span
          className={`text-[11px] font-semibold tabular-nums ${active ? "text-white" : ""}`}
        >
          {progresso}%
        </span>
      </div>
    </div>
  );
}

function EtapaSicafCard({
  etapa,
  clienteCnpj,
  verificandoPagamento,
  pagamentoConfirmado,
  tudoConcluido,
  onAbrir,
  onBloquearAssistente,
}: {
  etapa: PipelineEtapa;
  clienteCnpj: string;
  verificandoPagamento: boolean;
  pagamentoConfirmado: boolean;
  tudoConcluido: boolean;
  onAbrir: () => void;
  onBloquearAssistente: () => void;
}) {
  const isDone = etapa.status === "concluido";
  const isCurrent = etapa.status === "andamento" || etapa.status === "atencao";
  const isPending = etapa.status === "pendente";
  const needsAttention = etapa.status === "atencao";
  const etapaNum = etapa.etapaNum ?? 0;

  return (
    <Card
      className={
        isCurrent
          ? needsAttention
            ? "border-amber-500/40 shadow-lift"
            : "border-primary/40 shadow-lift"
          : isDone
            ? "bg-muted/40"
            : isPending
              ? "opacity-70"
              : undefined
      }
    >
      <CardContent className="flex items-start gap-4 p-5">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${
            isDone
              ? "bg-success text-success-foreground"
              : isCurrent
                ? needsAttention
                  ? "bg-amber-500 text-white"
                  : "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {isDone ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : isPending ? (
            <Lock className="h-4 w-4" />
          ) : (
            etapaNum
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{etapa.titulo}</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              ⏱ ~{etapa.tempoMin} min
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{etapa.descricao}</p>
          {etapa.subtitulo && isCurrent && (
            <p className="mt-1 text-xs font-medium text-muted-foreground/90">{etapa.subtitulo}</p>
          )}
          {isCurrent && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                className={needsAttention ? "bg-amber-500 hover:bg-amber-600" : undefined}
                disabled={etapa.modalKey === "pagamento" && verificandoPagamento}
                onClick={onAbrir}
              >
                {etapa.modalKey === "pagamento" && verificandoPagamento ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : null}
                Resolver agora
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          )}
          {isDone && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Validado
            </p>
          )}
          {etapa.id === "validar" && (isDone || tudoConcluido) && (
            <div className="mt-3">
              {pagamentoConfirmado ? (
                <Button asChild size="sm" className="gap-1.5 text-xs font-semibold">
                  <Link to="/assistente" search={{ cnpj: normalizeCnpj(clienteCnpj) }}>
                    <Bot className="h-3.5 w-3.5" />
                    Acessar meu SICAF
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="gap-1.5 text-xs font-semibold"
                  onClick={onBloquearAssistente}
                >
                  <Bot className="h-3.5 w-3.5" />
                  Acessar meu SICAF
                  <ArrowRight className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ManutencaoSicafCard({
  ativa,
  subtitulo,
  onAtivar,
  onGerenciar,
}: {
  ativa: boolean;
  subtitulo: string;
  onAtivar: () => void;
  onGerenciar: () => void;
}) {
  return (
    <div
      className={`flex min-w-[200px] flex-1 flex-col rounded-xl border px-4 py-3 ${
        ativa
          ? "border-emerald-500/40 bg-emerald-500/10"
          : "border-slate-200/80 bg-slate-50/90 dark:border-slate-700/60 dark:bg-slate-900/40"
      }`}
    >
      <div
        className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
          ativa
            ? "text-emerald-700 dark:text-emerald-300"
            : "text-slate-500 dark:text-slate-400"
        }`}
      >
        <Wrench className="h-3.5 w-3.5 shrink-0" />
        Manutenção
      </div>
      <p
        className={`mt-1.5 text-sm font-bold leading-tight ${
          ativa ? "text-emerald-800 dark:text-emerald-200" : "text-foreground"
        }`}
      >
        {ativa ? "Manutenção ativa" : "Sem manutenção ativa"}
      </p>
      <p
        className={`mt-0.5 text-xs leading-snug ${
          ativa ? "text-emerald-700/80 dark:text-emerald-300/80" : "text-muted-foreground"
        }`}
      >
        {subtitulo}
      </p>
      {ativa ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3 h-8 w-full gap-1.5 rounded-full border-background/80 bg-background/90 text-xs font-semibold hover:bg-background"
          onClick={onGerenciar}
        >
          Gerenciar
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          className="mt-3 h-8 w-full gap-1.5 rounded-full text-xs font-semibold"
          onClick={onAtivar}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Ativar manutenção
        </Button>
      )}
    </div>
  );
}

function CertificadoOpcionalCard({
  certificado,
  onClick,
}: {
  certificado: CertificadoDigitalInfo | null;
  onClick: () => void;
}) {
  const conectado = certificadoEstaValido(certificado);
  const validade = formatCertValidade(certificado);
  const expirado = certificado?.status === "expirado";

  const statusLabel = conectado ? "Conectado" : expirado ? "Expirado" : "Não conectado";

  return (
    <div
      className={`flex min-w-[200px] flex-1 flex-col rounded-xl border px-4 py-3 ${
        conectado
          ? "border-emerald-500/40 bg-emerald-500/10"
          : expirado
            ? "border-destructive/30 bg-destructive/5"
            : "border-slate-200/80 bg-slate-50/90 dark:border-slate-700/60 dark:bg-slate-900/40"
      }`}
    >
      <div
        className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
          conectado
            ? "text-emerald-700 dark:text-emerald-300"
            : expirado
              ? "text-destructive"
              : "text-slate-500 dark:text-slate-400"
        }`}
      >
        {conectado ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <KeyRound className="h-3 w-3 shrink-0" />
        )}
        Certificado digital (opcional)
      </div>
      <p
        className={`mt-1.5 text-sm font-bold leading-tight ${
          conectado
            ? "text-emerald-800 dark:text-emerald-200"
            : expirado
              ? "text-destructive"
              : "text-muted-foreground"
        }`}
      >
        {statusLabel}
      </p>
      {validade && (
        <p
          className={`mt-0.5 text-xs tabular-nums ${
            conectado ? "text-emerald-700/80 dark:text-emerald-300/80" : "text-muted-foreground"
          }`}
        >
          {validade}
        </p>
      )}
      {!conectado && !expirado && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Valide ou envie seu certificado A1
        </p>
      )}
      <Button
        type="button"
        size="sm"
        variant={conectado ? "outline" : "default"}
        className={
          conectado
            ? "mt-3 h-8 w-full gap-1.5 rounded-full border-background/80 bg-background/90 text-xs font-semibold hover:bg-background"
            : "mt-3 h-8 w-full gap-1.5 rounded-full text-xs font-semibold"
        }
        onClick={onClick}
      >
        {conectado ? "Gerenciar" : expirado ? "Renovar certificado" : "Validar certificado"}
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
