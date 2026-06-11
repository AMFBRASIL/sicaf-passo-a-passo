import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  Bot,
  ArrowRight,
  CheckCircle2,
  Lock,
  FileCheck,
  ShieldCheck,
  Upload,
  Download,
  Loader2,
  Search,
  Zap,
  FileText,
  Sparkles,
  Send,
  Building2,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { PagamentoSicafModal } from "@/components/pagamento-sicaf-modal";
import { CertificadoDigitalCard } from "@/components/certificado-digital-card";
import {
  calcSaudeDocumentalFromDocs,
  SaudeDocumentalCard,
} from "@/components/saude-documental-card";
import { fetchDocumentosChecklist, type DocChecklistItem } from "@/lib/documentos-api";
import {
  CADBRASIL_EXTENSION_STORE_URL,
  useCadBrasilExtension,
} from "@/hooks/use-cadbrasil-extension";
import {
  type CertificadoDigitalInfo,
} from "@/lib/certificado-api";
import { uploadDocumentoEmpresa } from "@/lib/documentos-api";
import type { EmpresaGerenciarPainel } from "@/lib/empresas-api";
import {
  deriveEtapaAtual,
  loadSicafPageData,
  reloadSicafPainel,
  type SicafPageCliente,
} from "@/lib/sicaf-page-api";
import { toast } from "sonner";

const searchSchema = z.object({
  cnpj: z.string().optional(),
});

export const Route = createFileRoute("/sicaf")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Atualizar SICAF — CADBRASIL" },
      { name: "description", content: "Atualize seu SICAF passo a passo com o assistente CADBRASIL." },
    ],
  }),
  component: SicafPage,
});

type PassoStatus = "done" | "current" | "pending";

interface Passo {
  n: number;
  titulo: string;
  descricao: string;
  tempoMin: number;
}

const passosBase: Passo[] = [
  {
    n: 1,
    titulo: "Pagamento da taxa CADBRASIL",
    descricao: "Confirme o pagamento para liberar a atualização dos seus níveis.",
    tempoMin: 2,
  },
  {
    n: 2,
    titulo: "Documentação da empresa",
    descricao: "Envie os documentos básicos que vamos usar para o cadastro.",
    tempoMin: 4,
  },
  {
    n: 3,
    titulo: "Conectar ao Compras.gov.br",
    descricao: "Vamos instalar o Assistente CADBRASIL para automatizar o acesso.",
    tempoMin: 3,
  },
  {
    n: 4,
    titulo: "Atualizar Nível III — Receita Federal",
    descricao: "Encontramos documentos que precisam ser atualizados.",
    tempoMin: 4,
  },
  {
    n: 5,
    titulo: "Atualizar Nível IV — Qualificação técnica",
    descricao: "Envie ou confirme os documentos da sua atividade.",
    tempoMin: 5,
  },
  {
    n: 6,
    titulo: "Validar e enviar",
    descricao: "Confirmação final — você pronto para licitar.",
    tempoMin: 1,
  },
];

const DOC_UPLOAD_NOMES: Record<string, string> = {
  contrato_social: "Contrato Social (última alteração)",
  cnpj_card: "Cartão CNPJ atualizado",
  rg_socio: "RG e CPF do(s) sócio(s)",
  comprovante_endereco: "Comprovante de endereço da empresa",
  procuracao: "Procuração (se aplicável)",
};

// ============================================================
// Documentos exigidos
// ============================================================
const documentosNecessarios = [
  { id: "contrato_social", label: "Contrato Social (última alteração)", obrigatorio: true },
  { id: "cnpj_card", label: "Cartão CNPJ atualizado", obrigatorio: true },
  { id: "rg_socio", label: "RG e CPF do(s) sócio(s)", obrigatorio: true },
  { id: "comprovante_endereco", label: "Comprovante de endereço da empresa", obrigatorio: true },
  { id: "procuracao", label: "Procuração (se aplicável)", obrigatorio: false },
];

// ============================================================
// Modal: Conectar ao Compras (instalar assistente)
// ============================================================
function AssistenteDialog({
  open,
  onOpenChange,
  onConcluido,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConcluido: () => void;
}) {
  const { extensionInstalled, checkExtension, waitForExtension } = useCadBrasilExtension();
  const [estado, setEstado] = useState<"checando" | "nao-instalado" | "instalando" | "ok">(
    "checando",
  );
  const [progresso, setProgresso] = useState(0);

  useEffect(() => {
    if (!open) {
      setEstado("checando");
      setProgresso(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const ok = await checkExtension();
      if (cancelled) return;
      if (ok || extensionInstalled) {
        setEstado("ok");
        setTimeout(() => {
          onConcluido();
          onOpenChange(false);
        }, 900);
      } else {
        setEstado("nao-instalado");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, checkExtension, extensionInstalled, onConcluido, onOpenChange]);

  const instalar = () => {
    window.open(CADBRASIL_EXTENSION_STORE_URL, "_blank", "noopener,noreferrer");
    setEstado("instalando");
    setProgresso(0);
    const id = setInterval(() => {
      setProgresso((p) => Math.min(p + 7, 95));
    }, 180);
    void waitForExtension(120_000).then((ok) => {
      clearInterval(id);
      setProgresso(100);
      if (ok) {
        setEstado("ok");
        setTimeout(() => {
          onConcluido();
          onOpenChange(false);
        }, 1100);
      } else {
        setEstado("nao-instalado");
        setProgresso(0);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Bot className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl">Conectar ao Compras.gov.br</DialogTitle>
          <DialogDescription className="text-center">
            Precisamos do Assistente CADBRASIL instalado no seu navegador para automatizar o acesso.
          </DialogDescription>
        </DialogHeader>

        {estado === "checando" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium">Verificando se o assistente está instalado…</p>
          </div>
        )}

        {estado === "nao-instalado" && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-warning/40 bg-warning/5 p-4">
              <div className="flex items-start gap-3">
                <Search className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" />
                <div className="text-sm">
                  <p className="font-semibold">Assistente CADBRASIL não encontrado</p>
                  <p className="mt-1 text-muted-foreground">
                    Vamos instalar agora — leva menos de 1 minuto e funciona em segundo plano.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                O que o assistente faz
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Acessa o Compras.gov.br (com certificado, se você tiver)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Atualiza Níveis III e IV automaticamente
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Monitora vencimentos 24h por dia
                </li>
              </ul>
            </div>
          </div>
        )}

        {estado === "instalando" && (
          <div className="space-y-4 py-6">
            <div className="flex flex-col items-center gap-2">
              <Download className="h-10 w-10 animate-pulse text-primary" />
              <p className="text-sm font-medium">Instalando Assistente CADBRASIL…</p>
            </div>
            <Progress value={progresso} className="h-2" />
            <p className="text-center text-xs text-muted-foreground">{progresso}% concluído</p>
          </div>
        )}

        {estado === "ok" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="text-base font-semibold">Assistente instalado!</p>
            <p className="text-center text-xs text-muted-foreground">
              Conectado ao Compras.gov.br com sucesso.
            </p>
          </div>
        )}

        {estado === "nao-instalado" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Agora não
            </Button>
            <Button onClick={instalar} className="gap-2">
              <Download className="h-4 w-4" />
              Instalar assistente
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Modal 3+: Atualizar Nível (assistente executando)
// ============================================================
function AssistenteRodandoDialog({
  open,
  onOpenChange,
  onConcluido,
  onIniciar,
  titulo,
  subtitulo,
  etapas,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConcluido: () => void;
  onIniciar?: () => void | Promise<void>;
  titulo: string;
  subtitulo: string;
  etapas: string[];
}) {
  const [iniciado, setIniciado] = useState(false);
  const [atual, setAtual] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) {
      setIniciado(false);
      setAtual(0);
      setDone(false);
    }
  }, [open]);

  useEffect(() => {
    if (!iniciado || done) return;
    if (atual >= etapas.length) {
      setDone(true);
      const t = setTimeout(() => {
        onConcluido();
        onOpenChange(false);
      }, 1200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setAtual((a) => a + 1), 1200);
    return () => clearTimeout(t);
  }, [iniciado, atual, done, etapas.length, onConcluido, onOpenChange]);

  const iniciar = () => {
    void onIniciar?.();
    setIniciado(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl">{titulo}</DialogTitle>
          <DialogDescription className="text-center">{subtitulo}</DialogDescription>
        </DialogHeader>

        {!iniciado && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                O assistente vai executar:
              </p>
              <ul className="mt-2 space-y-2">
                {etapas.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Você pode acompanhar em tempo real. Não feche o navegador enquanto o assistente trabalha.
              </span>
            </div>
          </div>
        )}

        {iniciado && !done && (
          <div className="space-y-3 py-4">
            {etapas.map((e, i) => {
              const completo = i < atual;
              const ativo = i === atual;
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition ${
                    ativo ? "border-primary/40 bg-primary/5" : completo ? "bg-muted/40" : "opacity-60"
                  }`}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                    {completo ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : ativo ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm">{e}</p>
                </div>
              );
            })}
          </div>
        )}

        {done && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="text-base font-semibold">Etapa concluída!</p>
            <p className="text-center text-xs text-muted-foreground">
              Atualização confirmada no Compras.gov.br
            </p>
          </div>
        )}

        {!iniciado && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Agora não
            </Button>
            <Button onClick={iniciar} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Iniciar assistente
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Modal: Documentação da empresa
// ============================================================
function DocumentacaoDialog({
  open,
  onOpenChange,
  onConcluido,
  clienteId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConcluido: () => void;
  clienteId: number;
}) {
  const [arquivos, setArquivos] = useState<Record<string, File | null>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setArquivos({});
      setEnviando(false);
      setEnviado(false);
      setErro(null);
    }
  }, [open]);

  const obrigatoriosOk = documentosNecessarios
    .filter((d) => d.obrigatorio)
    .every((d) => arquivos[d.id]);

  const enviar = async () => {
    setEnviando(true);
    setErro(null);
    const entries = Object.entries(arquivos).filter(([, f]) => f) as [string, File][];
    for (const [docId, file] of entries) {
      const nome = DOC_UPLOAD_NOMES[docId] || file.name;
      const result = await uploadDocumentoEmpresa({ clienteId, arquivo: file, nome });
      if (!result.ok) {
        setEnviando(false);
        setErro(result.error || "Falha ao enviar documentos");
        toast.error(result.error || "Falha ao enviar documentos");
        return;
      }
    }
    setEnviando(false);
    setEnviado(true);
    setTimeout(() => {
      onConcluido();
      onOpenChange(false);
    }, 1100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileText className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl">Documentação da empresa</DialogTitle>
          <DialogDescription className="text-center">
            Envie os documentos abaixo. Aceitamos PDF, JPG ou PNG até 10MB cada.
          </DialogDescription>
        </DialogHeader>

        {!enviado && !enviando && (
          <div className="space-y-3 py-2 max-h-[55vh] overflow-y-auto pr-1">
            {documentosNecessarios.map((doc) => {
              const arquivo = arquivos[doc.id];
              return (
                <div
                  key={doc.id}
                  className={`rounded-xl border p-3 transition ${
                    arquivo ? "border-success/40 bg-success/5" : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{doc.label}</p>
                        {doc.obrigatorio && (
                          <span className="text-[10px] font-semibold uppercase text-danger">
                            obrigatório
                          </span>
                        )}
                      </div>
                      {arquivo ? (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {arquivo.name} · {(arquivo.size / 1024).toFixed(0)} KB
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">Nenhum arquivo enviado</p>
                      )}
                    </div>
                    <div className="shrink-0">
                      {arquivo ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1 text-danger hover:text-danger"
                          onClick={() => setArquivos((a) => ({ ...a, [doc.id]: null }))}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remover
                        </Button>
                      ) : (
                        <label
                          htmlFor={`doc-${doc.id}`}
                          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:brightness-95"
                        >
                          <Upload className="h-3.5 w-3.5" /> Enviar
                          <input
                            id={`doc-${doc.id}`}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(e) =>
                              setArquivos((a) => ({ ...a, [doc.id]: e.target.files?.[0] ?? null }))
                            }
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {enviando && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium">Enviando documentos…</p>
          </div>
        )}

        {enviado && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="text-base font-semibold">Documentos recebidos!</p>
            <p className="text-center text-xs text-muted-foreground">
              Você já pode conectar ao Compras.gov.br.
            </p>
          </div>
        )}

        {!enviando && !enviado && (
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {erro && <p className="w-full text-center text-xs text-danger">{erro}</p>}
            <div className="flex w-full gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void enviar()} disabled={!obrigatoriosOk} className="gap-2">
                <Send className="h-4 w-4" />
                Enviar documentos
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Página principal
// ============================================================
function SicafPage() {
  const { cnpj } = Route.useSearch();
  const total = passosBase.length;
  const { extensionInstalled, openSICAF } = useCadBrasilExtension();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cliente, setCliente] = useState<SicafPageCliente | null>(null);
  const [painel, setPainel] = useState<EmpresaGerenciarPainel | null>(null);
  const [certificado, setCertificado] = useState<CertificadoDigitalInfo | null>(null);
  const [valorRenovacaoFmt, setValorRenovacaoFmt] = useState("R$ 985,00");

  const [renovando, setRenovando] = useState(false);
  const [renovacaoModal, setRenovacaoModal] = useState(false);
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [modalAberto, setModalAberto] = useState<number | null>(null);
  const [pagamentoModal, setPagamentoModal] = useState(false);
  const [docsSaude, setDocsSaude] = useState<DocChecklistItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [ultimaVerificacao, setUltimaVerificacao] = useState<string | null>(null);

  const carregarDocumentos = useCallback(async (clienteId: number) => {
    setDocsLoading(true);
    const checklist = await fetchDocumentosChecklist(clienteId);
    setDocsLoading(false);
    if (!checklist.ok || !checklist.docsPorNivel) {
      setDocsSaude([]);
      return;
    }
    setDocsSaude(Object.values(checklist.docsPorNivel).flat());
    setUltimaVerificacao(
      new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    );
  }, []);

  const saudeStats = useMemo(() => {
    const base = calcSaudeDocumentalFromDocs(docsSaude);
    return {
      ...base,
      ultimaVerificacao,
      labelMonitorado: `${base.total} documento${base.total === 1 ? "" : "s"} do SICAF monitorados`,
    };
  }, [docsSaude, ultimaVerificacao]);

  const aplicarDados = useCallback(
    (
      nextCliente: SicafPageCliente,
      nextPainel: EmpresaGerenciarPainel,
      nextCertificado: CertificadoDigitalInfo | null,
      renovandoAtual: boolean,
    ) => {
      setCliente(nextCliente);
      setPainel(nextPainel);
      setCertificado(nextCertificado);
      setEtapaAtual(
        deriveEtapaAtual(nextPainel, nextCertificado, extensionInstalled, renovandoAtual, total),
      );
    },
    [extensionInstalled, total],
  );

  const recarregar = useCallback(async () => {
    if (!cliente?.clienteId) return;
    const id = cliente.clienteId;
    const [data] = await Promise.all([
      reloadSicafPainel(id),
      carregarDocumentos(id),
    ]);
    if (data.ok && data.painel && data.cliente) {
      aplicarDados(data.cliente, data.painel, data.certificado ?? null, renovando);
    }
  }, [aplicarDados, carregarDocumentos, cliente?.clienteId, renovando]);

  useEffect(() => {
    if (cliente?.clienteId) void carregarDocumentos(cliente.clienteId);
  }, [cliente?.clienteId, carregarDocumentos]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setRenovando(false);

    loadSicafPageData(cnpj).then((data) => {
      if (cancelled) return;
      setLoading(false);
      if (!data.ok || !data.cliente || !data.painel) {
        setLoadError(data.error || "Não foi possível carregar os dados");
        setCliente(null);
        setPainel(null);
        return;
      }
      if (data.valorRenovacaoFmt) setValorRenovacaoFmt(data.valorRenovacaoFmt);
      aplicarDados(data.cliente, data.painel, data.certificado ?? null, false);
    });

    return () => {
      cancelled = true;
    };
  }, [cnpj, aplicarDados]);

  useEffect(() => {
    if (!painel || !cliente) return;
    setEtapaAtual(
      deriveEtapaAtual(painel, certificado, extensionInstalled, renovando, total),
    );
  }, [extensionInstalled, painel, certificado, renovando, total, cliente]);

  const concluidas = etapaAtual - 1;
  const percentual = Math.round((concluidas / total) * 100);

  const statusDe = (n: number): PassoStatus => {
    if (n < etapaAtual) return "done";
    if (n === etapaAtual) return "current";
    return "pending";
  };

  const concluirEtapa = () => {
    void recarregar();
  };

  const iniciarRenovacao = () => {
    setRenovando(true);
    setRenovacaoModal(false);
    if (painel && cliente) {
      setEtapaAtual(deriveEtapaAtual(painel, certificado, extensionInstalled, true, total));
    } else {
      setEtapaAtual(1);
    }
  };

  const tudoConcluido = etapaAtual > total;
  const sicafJaAtivo =
    painel?.sicaf?.status === "Ativo" || painel?.sicaf?.status === "Vencendo";

  if (loading) {
    return (
      <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 px-4 py-10">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando dados do SICAF...</p>
      </div>
    );
  }

  if (!cliente || loadError) {
    return (
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 sm:py-10">
        <PageHeader
          icon={<Bot className="h-5 w-5" />}
          title="Atualizar SICAF"
          subtitle="Não se preocupe — vamos fazer juntos, um passo de cada vez."
        />
        <Card className="mt-6 border-danger/30">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertTriangle className="h-10 w-10 text-danger" />
            <p className="font-semibold">{loadError || "Empresa não encontrada"}</p>
            <p className="text-sm text-muted-foreground">
              Cadastre a empresa em Empresas ou acesse com um CNPJ válido na URL.
            </p>
            <Button asChild>
              <Link to="/empresas">Ir para Empresas</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 sm:py-10">
      <PageHeader
        icon={<Bot className="h-5 w-5" />}
        title="Atualizar SICAF"
        subtitle="Não se preocupe — vamos fazer juntos, um passo de cada vez."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* Timeline lateral */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card className="shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Etapas do processo</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {Math.min(concluidas, total)}/{total}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ol className="relative">
                {passosBase.map((p, i) => {
                  const status = statusDe(p.n);
                  const isLast = i === passosBase.length - 1;
                  return (
                    <li key={p.n} className="relative pl-9 pb-5 last:pb-0">
                      {!isLast && (
                        <span
                          className={`absolute left-[14px] top-7 bottom-0 w-0.5 ${
                            status === "done" ? "bg-success" : "bg-border"
                          }`}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (status === "pending") return;
                        if (p.n === 1) setPagamentoModal(true);
                          else setModalAberto(p.n);
                        }}
                        disabled={status === "pending"}
                        className={`absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition ${
                          status === "done"
                            ? "bg-success text-success-foreground hover:scale-110"
                            : status === "current"
                            ? "bg-primary text-primary-foreground ring-4 ring-primary/20 animate-pulse"
                            : "bg-muted text-muted-foreground"
                        }`}
                        aria-label={`Etapa ${p.n}: ${p.titulo}`}
                      >
                        {status === "done" ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : status === "pending" ? (
                          <Lock className="h-3 w-3" />
                        ) : (
                          p.n
                        )}
                      </button>
                      <div className={status === "pending" ? "opacity-60" : ""}>
                        <p className={`text-[10px] font-semibold uppercase tracking-wider ${
                          status === "done" ? "text-success" :
                          status === "current" ? "text-primary" :
                          "text-muted-foreground"
                        }`}>
                          {status === "done" ? "Concluída" : status === "current" ? "Em andamento" : `Etapa ${p.n}`}
                        </p>
                        <p className="text-xs font-semibold leading-tight mt-0.5">{p.titulo}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-semibold text-primary">{percentual}%</span>
                </div>
                <Progress value={percentual} className="h-1.5" />
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Conteúdo principal */}
        <div>


      {/* Empresa — só identificação */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/15 bg-muted/20 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{cliente.nome}</p>
            <p className="text-xs text-muted-foreground">CNPJ {cliente.cnpj}</p>
          </div>
        </div>
        <Button asChild variant="ghost" size="sm" className="h-8 shrink-0 text-xs">
          <Link to="/empresas">Trocar empresa</Link>
        </Button>
      </div>

      {docsLoading ? (
        <Card className="mt-4 border-primary/20">
          <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Calculando saúde documental…
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4">
          <SaudeDocumentalCard
            stats={saudeStats}
            cnpj={cliente.cnpj}
            secondaryLink={{
              to: "/documentos",
              label: "Ver todos os documentos →",
              search: { cnpj: cliente.cnpj },
            }}
          />
        </div>
      )}

      <div className="mt-4">
        <CertificadoDigitalCard
          clienteId={cliente.clienteId}
          cnpj={cliente.cnpj}
          onUpdated={setCertificado}
        />
      </div>

      {cliente.estado === "vencido" && !renovando && tudoConcluido ? (
        <Card className="mt-6 border-danger/40 bg-gradient-to-br from-danger/10 via-danger/5 to-transparent shadow-soft overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-danger/15 text-danger">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 rounded-full bg-danger px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-danger-foreground">
                    SICAF Vencido
                  </span>
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Venceu em {cliente.vencidoEm}
                  </span>
                </div>
                <p className="mt-2 font-semibold">
                  Todos os níveis foram validados, mas o cadastro venceu.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sua empresa está temporariamente fora das licitações. Renove agora para reativar o SICAF — nós fazemos a atualização para você.
                </p>
              </div>
              <Button
                size="lg"
                className="gap-2 shadow-lift"
                onClick={() => setRenovacaoModal(true)}
              >
                <RefreshCw className="h-4 w-4" />
                Renovar SICAF agora
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !tudoConcluido ? (
        <Card className="mt-6 border-warning/30 bg-warning/5">
          <CardContent className="flex items-start gap-3 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" />
            <div className="text-sm">
              <p className="font-semibold">
                {renovando
                  ? "Renovação do SICAF em andamento — vamos juntos atualizar tudo."
                  : sicafJaAtivo
                    ? "Seu SICAF está ativo, mas ainda faltam etapas para liberar todos os níveis."
                    : "Sua empresa ainda não possui SICAF ativo. Vamos cadastrar agora?"}
              </p>
              <p className="mt-1 text-muted-foreground">
                Leva cerca de 5 minutos. Comece pela próxima etapa em destaque abaixo.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6 border-success/40 bg-gradient-to-br from-success/10 via-success/5 to-transparent shadow-lift overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success-foreground">
                    100% concluído
                  </span>
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Pronto para licitar
                  </span>
                </div>
                <p className="mt-2 font-semibold">
                  {renovando
                    ? "SICAF renovado com sucesso! 🎉"
                    : "Parabéns! Seu SICAF foi atualizado com sucesso 🎉"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Agora abra o Assistente para enviar a Situação do Fornecedor e manter tudo monitorado.
                </p>
              </div>
              <Button asChild size="lg" className="gap-2 shadow-lift">
                <Link to="/assistente" search={{ cnpj: cliente.cnpj }}>
                  <Bot className="h-4 w-4" />
                  Atualizar meu SICAF agora
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-4 shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Progresso da atualização</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              ⏱ Tempo total estimado: ~
              {passosBase.reduce((s, p) => s + p.tempoMin, 0)} min · restante: ~
              {passosBase
                .filter((p) => statusDe(p.n) !== "done")
                .reduce((s, p) => s + p.tempoMin, 0)}{" "}
              min
            </p>
          </div>
          <span className="text-sm font-semibold text-primary">
            {Math.min(concluidas, total)} de {total} etapas
          </span>
        </CardHeader>
        <CardContent>
          <Progress value={percentual} className="h-3" />
        </CardContent>
      </Card>

      <div className="mt-6 space-y-3">
        {passosBase.map((p) => {
          const status = statusDe(p.n);
          return (
            <Card
              key={p.n}
              className={
                status === "current"
                  ? "border-primary/40 shadow-lift"
                  : status === "done"
                  ? "bg-muted/40"
                  : "opacity-70"
              }
            >
              <CardContent className="flex items-start gap-4 p-5">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${
                    status === "done"
                      ? "bg-success text-success-foreground"
                      : status === "current"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {status === "done" ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : status === "pending" ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    p.n
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{p.titulo}</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      ⏱ ~{p.tempoMin} min
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{p.descricao}</p>
                  {status === "current" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => p.n === 1 ? setPagamentoModal(true) : setModalAberto(p.n)}>
                        Resolver agora
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {status === "done" && (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Validado
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 border-dashed">
        <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
          <FileCheck className="h-5 w-5 text-primary" />
          <span>
            Travou em alguma etapa?{" "}
            <Link to="/suporte" className="font-medium text-primary underline-offset-2 hover:underline">
              Fale com um especialista
            </Link>{" "}
            — respondemos em minutos.
          </span>
        </CardContent>
      </Card>
        </div>
      </div>

      {/* Modais */}
      <DocumentacaoDialog
        open={modalAberto === 2}
        onOpenChange={(v) => !v && setModalAberto(null)}
        onConcluido={concluirEtapa}
        clienteId={cliente.clienteId}
      />
      <AssistenteDialog
        open={modalAberto === 3}
        onOpenChange={(v) => !v && setModalAberto(null)}
        onConcluido={concluirEtapa}
      />
      <AssistenteRodandoDialog
        open={modalAberto === 4}
        onOpenChange={(v) => !v && setModalAberto(null)}
        onConcluido={concluirEtapa}
        onIniciar={() => { void openSICAF(); }}
        titulo="Atualizar Nível III — Receita Federal"
        subtitulo="O Assistente CADBRASIL vai acessar o Compras.gov.br e atualizar os documentos federais."
        etapas={[
          "Acessando Compras.gov.br",
          "Consultando documentos do Nível III na Receita Federal",
          "Baixando certidões negativas atualizadas",
          "Anexando ao seu cadastro SICAF",
          "Validando atualização junto ao sistema",
        ]}
      />
      <AssistenteRodandoDialog
        open={modalAberto === 5}
        onOpenChange={(v) => !v && setModalAberto(null)}
        onConcluido={concluirEtapa}
        onIniciar={() => { void openSICAF(); }}
        titulo="Atualizar Nível IV — Qualificação técnica"
        subtitulo="O assistente vai consolidar e enviar seus documentos de qualificação técnica."
        etapas={[
          "Conferindo CNAEs cadastrados na Receita Federal",
          "Validando atestados e documentos técnicos",
          "Preenchendo formulário de qualificação no Compras.gov.br",
          "Confirmando envio do Nível IV",
        ]}
      />
      <AssistenteRodandoDialog
        open={modalAberto === 6}
        onOpenChange={(v) => !v && setModalAberto(null)}
        onConcluido={concluirEtapa}
        onIniciar={() => { void openSICAF(); }}
        titulo="Validar e enviar"
        subtitulo="Última etapa! Confirmação final e ativação do seu SICAF."
        etapas={[
          "Revisando todos os níveis cadastrados",
          "Gerando comprovante de inscrição",
          "Confirmando ativação no SICAF",
        ]}
      />


      {tudoConcluido && (
        <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
          {cliente.estado === "vencido" && !renovando ? (
            <button
              onClick={() => setRenovacaoModal(true)}
              className="flex items-center gap-2 rounded-full bg-danger px-4 py-2 text-sm font-semibold text-danger-foreground shadow-lift hover:brightness-110 transition"
            >
              <AlertTriangle className="h-4 w-4" />
              SICAF Vencido · Renovar
            </button>
          ) : cliente.estado === "completo" ? (
            <div className="flex items-center gap-2 rounded-full bg-success px-4 py-2 text-sm font-medium text-success-foreground shadow-lift">
              <Send className="h-4 w-4" />
              SICAF ativo
            </div>
          ) : null}
        </div>
      )}

      {/* Modal: Confirmar renovação */}
      <Dialog open={renovacaoModal} onOpenChange={setRenovacaoModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <RefreshCw className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-xl">Renovar SICAF</DialogTitle>
            <DialogDescription className="text-center">
              Vamos reativar o SICAF de <span className="font-semibold text-foreground">{cliente.nome}</span>.
              O processo é idêntico ao cadastro inicial — pagamento da taxa, verificação dos documentos e atualização automática dos níveis.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-muted/30 p-4 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Vencido em</span>
              <span className="font-semibold">{cliente.vencidoEm}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Taxa de renovação</span>
              <span className="font-semibold">{valorRenovacaoFmt}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tempo estimado</span>
              <span className="font-semibold">Até 24h</span>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setRenovacaoModal(false)}>
              Cancelar
            </Button>
            <Button onClick={iniciarRenovacao} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Iniciar renovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PagamentoSicafModal
        open={pagamentoModal}
        onOpenChange={setPagamentoModal}
        empresa={{ nome: cliente.nome, cnpj: cliente.cnpj, clienteId: cliente.clienteId }}
        onPago={() => {
          setPagamentoModal(false);
          concluirEtapa();
        }}
      />
    </div>
  );
}
