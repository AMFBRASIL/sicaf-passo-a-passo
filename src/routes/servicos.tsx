import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  FileSignature,
  ShieldCheck,
  Wrench,
  ArrowRight,
  Building2,
  CheckCircle2,
  Ban,
  Sparkles,
  Loader2,
  FileText,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge, PageContainer } from "@/components/page-header";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ManutencaoModal } from "@/components/manutencao-modal";
import { statusLabel, type EmpresaData } from "@/lib/empresas-shared";
import { fetchEmpresas } from "@/lib/empresas-api";
import {
  contratoToContractData,
  fetchClienteContrato,
  formatContratoDataBr,
  isContratoAssinado,
  type ContratoDigital,
} from "@/lib/contrato-api";
import { openContractPreviewWindow } from "@/lib/contract-template";

export const Route = createFileRoute("/servicos")({
  head: () => ({
    meta: [
      { title: "Meus Serviços — CADBRASIL" },
      { name: "description", content: "Veja os serviços ativos da sua empresa." },
    ],
  }),
  component: ServPage,
});

const servicos = [
  { id: "sicaf", nome: "Cadastro SICAF Completo", descricao: "Cadastro e atualização nos níveis I a VI.", status: "ok" as const, label: "Ativo" },
  { id: "cert", nome: "Monitoramento de Certidões", descricao: "Acompanhamento diário de validade.", status: "ok" as const, label: "Ativo" },
  { id: "ia", nome: "Assistente IA para Licitações", descricao: "Recomendações personalizadas todos os dias.", status: "ok" as const, label: "Ativo" },
  { id: "manutencao", nome: "Manutenção Mensal", descricao: "Renovação automática de documentos.", status: "idle" as const, label: "Não contratado" },
];

function ServPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeEmpresa, setActiveEmpresa] = useState<EmpresaData | null>(null);
  const [modalMode, setModalMode] = useState<"ativar" | "gerenciar">("ativar");
  const [ativadas, setAtivadas] = useState<Record<string, number>>({});
  const [empresas, setEmpresas] = useState<EmpresaData[]>([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(true);
  const [contratoVigente, setContratoVigente] = useState<ContratoDigital | null>(null);
  const [empresaContrato, setEmpresaContrato] = useState<EmpresaData | null>(null);
  const [loadingContrato, setLoadingContrato] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoadingEmpresas(true);
      const res = await fetchEmpresas();
      if (!res.ok) {
        toast.error(res.error || "Erro ao carregar empresas");
        setLoadingEmpresas(false);
        return;
      }
      setEmpresas(res.empresas);
      const manut: Record<string, number> = {};
      for (const e of res.empresas) {
        if (e.manutencaoAtiva) manut[e.cnpj] = new Date().getDate();
      }
      setAtivadas((prev) => ({ ...manut, ...prev }));
      setLoadingEmpresas(false);

      setLoadingContrato(true);
      const comId = res.empresas.filter((e) => e.clienteId);
      const resultados = await Promise.all(
        comId.map(async (empresa) => {
          const contratoRes = await fetchClienteContrato(empresa.clienteId!);
          return { empresa, contrato: contratoRes.ok ? contratoRes.contrato : null };
        }),
      );

      const assinados = resultados
        .filter((r) => isContratoAssinado(r.contrato))
        .sort((a, b) => {
          const da = new Date(a.contrato!.assinadoEm || a.contrato!.dataInicio).getTime();
          const db = new Date(b.contrato!.assinadoEm || b.contrato!.dataInicio).getTime();
          return db - da;
        });

      const escolhido = assinados[0] ?? resultados.find((r) => r.contrato) ?? null;
      setContratoVigente(escolhido?.contrato ?? null);
      setEmpresaContrato(escolhido?.empresa ?? null);
      setLoadingContrato(false);
    })();
  }, []);

  const abrirContratoAssinado = () => {
    if (!contratoVigente || !isContratoAssinado(contratoVigente)) {
      toast.error("Nenhum contrato assinado disponível para abrir.");
      return;
    }
    const ok = openContractPreviewWindow(contratoToContractData(contratoVigente));
    if (!ok) {
      toast.error("Popup bloqueado. Permita popups para abrir o contrato.");
      return;
    }
    toast.info("Contrato aberto — use Ctrl+P para salvar em PDF.", { duration: 5000 });
  };

  const temManutencao =
    empresas.some((e) => e.manutencaoAtiva) || Object.keys(ativadas).length > 0;

  const listaServicos = useMemo(
    () =>
      servicos.map((s) =>
        s.id === "manutencao"
          ? {
              ...s,
              status: temManutencao ? ("ok" as const) : ("idle" as const),
              label: temManutencao ? "Ativo" : "Não contratado",
            }
          : s,
      ),
    [temManutencao],
  );

  const handleContratar = (empresa: EmpresaData) => {
    setActiveEmpresa(empresa);
    setModalMode(ativadas[empresa.cnpj] || empresa.manutencaoAtiva ? "gerenciar" : "ativar");
  };

  return (
    <PageContainer>
      <PageHeader
        icon={<FileSignature className="h-5 w-5" />}
        title="Meus Serviços"
        subtitle="Tudo que a CADBRASIL faz pela sua empresa."
      />

      <div className="mt-6 grid gap-3">
        {listaServicos.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {s.id === "manutencao" ? <Wrench className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-semibold">{s.nome}</p>
                  <p className="text-sm text-muted-foreground">{s.descricao}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={s.status}>{s.label}</StatusBadge>
                {s.status === "idle" && (
                  <Button size="sm" onClick={() => s.id === "manutencao" && setSheetOpen(true)}>
                    Contratar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <FileSignature className="h-4 w-4 text-primary" />
            Contrato vigente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {loadingContrato ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando contrato…
            </div>
          ) : contratoVigente ? (
            <>
              <div className="space-y-1">
                <p>
                  <span className="font-medium text-foreground">{contratoVigente.plano}</span>
                  {empresaContrato ? (
                    <>
                      {" "}
                      · <span className="text-foreground">{empresaContrato.nome}</span>
                    </>
                  ) : null}
                </p>
                <p>
                  {isContratoAssinado(contratoVigente) ? (
                    <>
                      Assinado em{" "}
                      <span className="font-medium text-foreground">
                        {formatContratoDataBr(contratoVigente.assinadoEm || contratoVigente.dataInicio)}
                      </span>
                      {contratoVigente.assinadoPor ? (
                        <>
                          {" "}
                          por{" "}
                          <span className="font-medium text-foreground">{contratoVigente.assinadoPor}</span>
                        </>
                      ) : null}
                      .
                    </>
                  ) : (
                    <>
                      Status:{" "}
                      <span className="font-medium text-foreground">{contratoVigente.status}</span>
                    </>
                  )}
                </p>
                <p>
                  Vigência até{" "}
                  <span className="font-medium text-foreground">
                    {formatContratoDataBr(contratoVigente.dataVencimento)}
                  </span>
                  .
                </p>
              </div>
              <Button
                className="gap-2"
                disabled={!isContratoAssinado(contratoVigente)}
                onClick={abrirContratoAssinado}
              >
                <FileText className="h-4 w-4" />
                Abrir contrato assinado
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </Button>
              {!isContratoAssinado(contratoVigente) && (
                <p className="text-xs">
                  O contrato ainda não foi assinado. Entre em contato com a equipe CADBRASIL para concluir a assinatura.
                </p>
              )}
            </>
          ) : (
            <>
              <p>Nenhum contrato digital encontrado para suas empresas.</p>
              <Button className="gap-2" variant="outline" disabled>
                <FileText className="h-4 w-4" />
                Abrir contrato assinado
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Lateral - escolha de empresa */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-br from-primary/5 to-transparent">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-lg">Manutenção SICAF</SheetTitle>
                <SheetDescription>Selecione a empresa para contratar o plano</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="px-6 py-5 space-y-3">
              {loadingEmpresas && (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Carregando empresas...
                </div>
              )}
              {!loadingEmpresas && empresas.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-10">
                  Nenhuma empresa cadastrada. Cadastre uma empresa em /empresas.
                </p>
              )}
              {empresas.map((e) => {
                const meta = statusLabel[e.sicaf];
                const podeContratar = e.sicaf === "ativo";
                const jaContratada = !!ativadas[e.cnpj];
                return (
                  <div
                    key={e.cnpj}
                    className="rounded-2xl border bg-card p-4 hover:shadow-soft transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="h-10 w-10 shrink-0 rounded-xl bg-muted flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{e.nome}</p>
                          <p className="text-xs text-muted-foreground font-mono">{e.cnpj}</p>
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <StatusBadge status={meta.status}>{meta.label}</StatusBadge>
                            {jaContratada && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 text-success px-2 py-0.5 text-[11px] font-semibold">
                                <CheckCircle2 className="h-3 w-3" /> Manutenção ativa
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {jaContratada
                          ? `Ativada · vencimento dia ${ativadas[e.cnpj]}`
                          : podeContratar
                          ? "Pronto para contratar"
                          : "Requer SICAF ativo para contratar"}
                      </p>
                      <Button
                        size="sm"
                        variant={jaContratada ? "outline" : "default"}
                        disabled={!podeContratar && !jaContratada}
                        onClick={() => handleContratar(e)}
                        className="shrink-0"
                      >
                        {jaContratada ? (
                          <>Ver painel <ArrowRight className="ml-1 h-4 w-4" /></>
                        ) : podeContratar ? (
                          <>Contratar Manutenção <Sparkles className="ml-1 h-4 w-4" /></>
                        ) : (
                          <>Indisponível <Ban className="ml-1 h-4 w-4" /></>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {activeEmpresa && (
        <ManutencaoModal
          open
          onOpenChange={(v) => !v && setActiveEmpresa(null)}
          empresa={activeEmpresa}
          mode={modalMode}
          diaVencimento={ativadas[activeEmpresa.cnpj]}
          onAtivar={(cnpj, dia) => setAtivadas((p) => ({ ...p, [cnpj]: dia }))}
          onCancelar={(cnpj) =>
            setAtivadas((p) => {
              const next = { ...p };
              delete next[cnpj];
              return next;
            })
          }
        />
      )}
    </PageContainer>
  );
}
