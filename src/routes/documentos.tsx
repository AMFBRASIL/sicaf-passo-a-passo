import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  FileText, Upload, CheckCircle2, Circle, ArrowLeft, Building2, ShieldCheck, Loader2, Plus,
  Bot, Hash, Calendar, AlertTriangle, Lock, Receipt, ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageContainer } from "@/components/page-header";
import { DocumentoUploadModal } from "@/components/documento-upload-modal";
import {
  calcSaudeDocumentalFromDocs,
  SaudeDocumentalCard,
} from "@/components/saude-documental-card";
import { NIVEIS_SICAF, type EmpresaData } from "@/lib/empresas-shared";
import {
  fetchDocumentosChecklist,
  resolveEmpresaPorCnpj,
  type DocChecklistItem,
} from "@/lib/documentos-api";
import { fetchEmpresaGerenciar } from "@/lib/empresas-api";
import { pagamentoSicafConfirmado } from "@/lib/sicaf-page-api";
import { getDocRequirementLabels, getDocUploadRules } from "@/lib/sicaf-document-rules";
import { SelecionarEmpresaModal } from "@/components/selecionar-empresa-modal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type DocSearch = { cnpj?: string };

export const Route = createFileRoute("/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos da empresa — CADBRASIL" },
      { name: "description", content: "Envie os documentos por nível do SICAF." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): DocSearch => ({
    cnpj: typeof search.cnpj === "string" ? search.cnpj : undefined,
  }),
  component: DocsPage,
});

type DocItem = DocChecklistItem;

function mapSicafFromStatus(status?: string): EmpresaData["sicaf"] {
  const s = String(status || "").toLowerCase();
  if (s === "ativo") return "ativo";
  if (s === "vencendo") return "atencao";
  if (s === "vencido") return "vencido";
  return "sem_cadastro";
}

function DocsPage() {
  const { cnpj } = Route.useSearch();
  const navigate = useNavigate();
  const [empresa, setEmpresa] = useState<EmpresaData | null>(null);
  const [docsPorNivel, setDocsPorNivel] = useState<Record<number, DocItem[]>>({});
  const [pagamentoConfirmado, setPagamentoConfirmado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [uploadDoc, setUploadDoc] = useState<DocItem | null>(null);
  const [ultimaVerificacao, setUltimaVerificacao] = useState<string | null>(null);
  const [selecionarEmpresaOpen, setSelecionarEmpresaOpen] = useState(false);

  const recarregar = async (cnpjBusca?: string) => {
    setLoading(true);
    setErro(null);
    const resolved = await resolveEmpresaPorCnpj(cnpjBusca || cnpj || "");
    if (!resolved.ok || !resolved.empresa?.clienteId) {
      const msg = resolved.error || "Selecione uma empresa para ver os documentos";
      setErro(msg);
      setEmpresa(null);
      if (cnpjBusca || cnpj) {
        toast.error(msg);
      }
      setLoading(false);
      return;
    }
    const clienteId = resolved.empresa.clienteId;
    const [checklist, gerenciar] = await Promise.all([
      fetchDocumentosChecklist(clienteId),
      fetchEmpresaGerenciar(clienteId),
    ]);
    if (!checklist.ok) {
      toast.error(checklist.error || "Erro ao carregar documentos");
      setLoading(false);
      return;
    }
    setPagamentoConfirmado(
      gerenciar.ok && gerenciar.painel ? pagamentoSicafConfirmado(gerenciar.painel) : false,
    );
    const emp: EmpresaData = {
      ...resolved.empresa,
      nome: checklist.cliente?.razaoSocial || resolved.empresa.nome,
      cnpj: checklist.cliente?.documento || resolved.empresa.cnpj,
      email: checklist.cliente?.email || resolved.empresa.email,
      telefone: checklist.cliente?.telefone || resolved.empresa.telefone,
      endereco: checklist.cliente?.endereco || resolved.empresa.endereco,
      cidade: checklist.cliente?.cidade || resolved.empresa.cidade,
      uf: checklist.cliente?.estado || resolved.empresa.uf,
      inscricaoEstadual: checklist.cliente?.inscricaoEstadual || "",
      inscricaoMunicipal: checklist.cliente?.inscricaoMunicipal || "",
      ramoAtividade: checklist.cliente?.ramoAtividade || "",
      sicaf: mapSicafFromStatus(checklist.sicafStatus),
      proximoPasso: "",
      acao: resolved.empresa.acao,
    };
    setEmpresa(emp);
    setDocsPorNivel(checklist.docsPorNivel || {});
    setUltimaVerificacao(
      new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    );
    setLoading(false);
  };

  useEffect(() => {
    void recarregar(cnpj);
  }, [cnpj]);

  const allDocs = useMemo(() => Object.values(docsPorNivel).flat(), [docsPorNivel]);
  const saudeStats = useMemo(() => {
    const base = calcSaudeDocumentalFromDocs(allDocs);
    return {
      ...base,
      ultimaVerificacao,
      labelMonitorado: `${base.total} documento${base.total === 1 ? "" : "s"} do SICAF monitorados`,
    };
  }, [allDocs, ultimaVerificacao]);

  const bloquearAssistente = () => {
    toast.error("Confirme o pagamento da taxa CADBRASIL (Etapa 1) para acessar o Assistente.");
    void navigate({
      to: "/sicaf",
      search: empresa?.cnpj ? { cnpj: empresa.cnpj.replace(/\D/g, "") } : {},
    });
  };

  const bloquearEnvioDocumentos = () => {
    toast.error("Regularize o pagamento da taxa SICAF para enviar documentos.");
    void navigate({
      to: "/sicaf",
      search: empresa?.cnpj ? { cnpj: empresa.cnpj } : {},
    });
  };

  const abrirUploadDoc = (doc: DocItem) => {
    if (!pagamentoConfirmado) {
      bloquearEnvioDocumentos();
      return;
    }
    setUploadDoc(doc);
  };

  const selecionarEmpresa = (empresaSelecionada: { cnpj: string }) => {
    void navigate({
      to: "/documentos",
      search: { cnpj: empresaSelecionada.cnpj },
    });
  };

  return (
    <>
      <PageContainer>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Carregando documentos da empresa...</p>
          </div>
        ) : !empresa ? (
          <>
            <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
              <Building2 className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">
                {cnpj ? erro || "Empresa não encontrada" : "Selecione uma empresa para ver os documentos"}
              </p>
              <p className="text-xs text-muted-foreground max-w-md">
                {cnpj
                  ? `Não foi possível localizar o CNPJ ${cnpj}. Verifique o cadastro ou escolha outra empresa.`
                  : "Escolha uma empresa cadastrada para enviar e acompanhar os documentos do SICAF."}
              </p>
              <Button onClick={() => setSelecionarEmpresaOpen(true)}>
                Selecionar empresa
              </Button>
            </div>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="mb-3 -ml-2 gap-1"
              onClick={() => setSelecionarEmpresaOpen(true)}
            >
              <ArrowLeft className="h-4 w-4" />
              Trocar empresa
            </Button>

            <PageHeader
              icon={<FileText className="h-5 w-5" />}
              title="Documentos da empresa"
              subtitle={
                <span className="font-mono text-sm">
                  CNPJ {empresa.cnpj}
                </span>
              }
            />

            {!pagamentoConfirmado && (
              <Card className="mt-4 overflow-hidden border-warning/50 bg-gradient-to-br from-warning/15 via-warning/5 to-transparent">
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warning/20 text-warning-foreground">
                    <Lock className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="gap-1 border-warning/40 bg-warning/20 text-warning-foreground hover:bg-warning/25">
                        <AlertTriangle className="h-3 w-3" />
                        Envio bloqueado
                      </Badge>
                      {empresa.taxaPendente && (
                        <Badge variant="outline" className="text-[10px] text-danger border-danger/30">
                          Taxa SICAF pendente
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-snug">
                      Pagamento da taxa SICAF não confirmado
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      O envio e a substituição de documentos ficam disponíveis somente após a confirmação
                      do pagamento da taxa CADBRASIL (Etapa 1 do SICAF). Você pode consultar o checklist abaixo,
                      mas não será possível anexar arquivos até regularizar o pagamento.
                    </p>
                    <Button
                      size="sm"
                      className="mt-4 gap-1.5"
                      onClick={() => void navigate({ to: "/sicaf", search: { cnpj: empresa.cnpj } })}
                    >
                      <Receipt className="h-4 w-4" />
                      Regularizar pagamento SICAF
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="mt-4">
              <SaudeDocumentalCard
                stats={saudeStats}
                cnpj={empresa.cnpj}
                assistenteDisponivel={pagamentoConfirmado}
                onAssistenteBloqueado={bloquearAssistente}
              />
            </div>

            <div className={cn("mt-6 space-y-4", !pagamentoConfirmado && "relative")}>
              {!pagamentoConfirmado && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 px-1">
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  Botões de envio desativados até a confirmação do pagamento SICAF.
                </p>
              )}
              {NIVEIS_SICAF.map((nivel) => {
                const lista = docsPorNivel[nivel.num] || [];
                const nivelDone = lista.filter((d) => d.status === "ok").length;
                const completo = nivelDone === lista.length;
                return (
                  <Card key={nivel.num} className="overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                            style={{ backgroundColor: nivel.color }}
                          >
                            {nivel.roman}
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-base font-semibold truncate">
                              Nível {nivel.roman} — {nivel.nome}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                              {nivelDone} de {lista.length} documentos enviados
                            </p>
                          </div>
                        </div>
                        {completo ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 text-success text-xs font-semibold px-2.5 py-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Completo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning-foreground text-xs font-semibold px-2.5 py-1">
                            <ShieldCheck className="h-3.5 w-3.5" /> Pendente
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ul className="divide-y divide-border">
                        {lista.map((d) => {
                          const rules = getDocUploadRules(d.codigo, d.nivelSicaf ?? null);
                          const autoOnly = d.uploadManual === false || !rules.uploadManual;
                          const enviado = d.status === "ok";
                          return (
                            <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                              <div className="flex items-start gap-3 min-w-0">
                                {enviado ? (
                                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success mt-0.5" />
                                ) : d.status === "vencida" || d.status === "vencendo" ? (
                                  <AlertTriangle className={cn(
                                    "h-5 w-5 shrink-0 mt-0.5",
                                    d.status === "vencida" ? "text-destructive" : "text-warning",
                                  )} />
                                ) : (
                                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40 mt-0.5" />
                                )}
                                <div className="min-w-0">
                                  <p className="text-sm font-medium leading-tight truncate">{d.nome}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{d.descricao}</p>
                                  <DocRequisitosBadges doc={d} />
                                  {enviado && d.validade && d.validade !== "—" && (
                                    <p className="text-[11px] text-success mt-1">Válido até {d.validade}</p>
                                  )}
                                  {d.status === "vencida" && (
                                    <p className="text-[11px] text-destructive mt-1">Documento vencido — reenvie</p>
                                  )}
                                  {d.status === "vencendo" && (
                                    <p className="text-[11px] text-warning mt-1">Vence em breve — atualize</p>
                                  )}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant={enviado ? "outline" : "default"}
                                className={cn(
                                  "gap-1.5 shrink-0",
                                  !pagamentoConfirmado && "opacity-60",
                                )}
                                onClick={() => abrirUploadDoc(d)}
                              >
                                {!pagamentoConfirmado ? (
                                  <>
                                    <Lock className="h-3.5 w-3.5" />
                                    {autoOnly
                                      ? enviado
                                        ? "Ver"
                                        : "Assistente"
                                      : enviado
                                        ? "Substituir"
                                        : "Enviar"}
                                  </>
                                ) : autoOnly ? (
                                  <>
                                    <Bot className="h-3.5 w-3.5" />
                                    {enviado ? "Ver" : "Assistente"}
                                  </>
                                ) : enviado ? (
                                  <>
                                    <Upload className="h-3.5 w-3.5" />
                                    Substituir
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-3.5 w-3.5" />
                                    Enviar
                                  </>
                                )}
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <DocumentoUploadModal
              open={!!uploadDoc && pagamentoConfirmado}
              onOpenChange={(open) => !open && setUploadDoc(null)}
              clienteId={empresa.clienteId!}
              clienteNome={empresa.nome}
              clienteDocumento={empresa.cnpj}
              doc={uploadDoc}
              onSuccess={() => void recarregar(cnpj)}
            />
          </>
        )}
      </PageContainer>

      <SelecionarEmpresaModal
        open={selecionarEmpresaOpen}
        onOpenChange={setSelecionarEmpresaOpen}
        empresaAtualCnpj={empresa?.cnpj ?? cnpj}
        titulo="Selecionar empresa"
        descricao="Escolha a empresa para enviar e acompanhar os documentos do SICAF."
        onSelect={selecionarEmpresa}
      />
    </>
  );
}

function DocRequisitosBadges({ doc }: { doc: DocItem }) {
  const rules = getDocUploadRules(doc.codigo, doc.nivelSicaf ?? null);
  const uploadManual = doc.uploadManual !== false && rules.uploadManual;
  const labels = getDocRequirementLabels({
    pdf: uploadManual,
    codigo: doc.requerCodigo ?? rules.codigo,
    validade: doc.requerValidade ?? rules.validade,
    uploadManual,
  });

  if (!labels.length) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {labels.map((label) => (
        <Badge
          key={label}
          variant="secondary"
          className={cn(
            "text-[10px] px-1.5 py-0 font-normal gap-1",
            label === "Assistente SICAF" && "bg-amber-500/10 text-amber-700 border-amber-500/20",
          )}
        >
          {label === "Assistente SICAF" && <Bot className="h-2.5 w-2.5" />}
          {label === "Código" && <Hash className="h-2.5 w-2.5" />}
          {label === "Validade" && <Calendar className="h-2.5 w-2.5" />}
          {label === "PDF" && <FileText className="h-2.5 w-2.5" />}
          {label}
        </Badge>
      ))}
    </div>
  );
}
