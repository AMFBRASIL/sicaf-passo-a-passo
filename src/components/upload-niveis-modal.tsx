import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ShieldCheck,
  Upload,
  CheckCircle2,
  FileText,
  X,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Building2,
  Hammer,
  Briefcase,
  Truck,
  Layers,
  Cloud,
  Loader2,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  fetchDocumentosChecklist,
  uploadDocumentoEmpresa,
  type DocChecklistItem,
} from "@/lib/documentos-api";
import { fetchEmpresaGerenciar } from "@/lib/empresas-api";
import { DocumentoUploadModal } from "@/components/documento-upload-modal";
import { getDocUploadRules } from "@/lib/sicaf-document-rules";

const DOC_UPLOAD_NOMES: Record<string, string> = {
  contrato_social: "Contrato Social (última alteração)",
  cnpj_card: "Cartão CNPJ atualizado",
  rg_socio: "RG e CPF do(s) sócio(s)",
  comprovante_endereco: "Comprovante de endereço da empresa",
  procuracao: "Procuração (se aplicável)",
};

const DOCUMENTOS_EMPRESA = [
  { id: "contrato_social", nome: "Contrato Social (última alteração)", obrigatorio: true },
  { id: "cnpj_card", nome: "Cartão CNPJ atualizado", obrigatorio: true },
  { id: "rg_socio", nome: "RG e CPF do(s) sócio(s)", obrigatorio: true },
  { id: "comprovante_endereco", nome: "Comprovante de endereço da empresa", obrigatorio: true },
  { id: "procuracao", nome: "Procuração (se aplicável)", obrigatorio: false },
] as const;

type NivelUi = {
  id: number;
  titulo: string;
  subtitulo: string;
  cor: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NIVEIS_UI: NivelUi[] = [
  {
    id: 1,
    titulo: "Nível I",
    subtitulo: "Credenciamento",
    cor: "from-sky-500 to-blue-600",
    icon: Building2,
  },
  {
    id: 2,
    titulo: "Nível II",
    subtitulo: "Habilitação jurídica",
    cor: "from-violet-500 to-purple-600",
    icon: Briefcase,
  },
  {
    id: 3,
    titulo: "Nível III",
    subtitulo: "Regularidade fiscal",
    cor: "from-emerald-500 to-teal-600",
    icon: ShieldCheck,
  },
  {
    id: 4,
    titulo: "Nível IV",
    subtitulo: "Qualificação econômico-financeira",
    cor: "from-amber-500 to-orange-600",
    icon: Layers,
  },
  {
    id: 5,
    titulo: "Nível V",
    subtitulo: "Qualificação técnica",
    cor: "from-rose-500 to-pink-600",
    icon: Hammer,
  },
  {
    id: 6,
    titulo: "Nível VI",
    subtitulo: "Serviços e fornecimento",
    cor: "from-cyan-500 to-sky-600",
    icon: Truck,
  },
];

const ETAPA_BASICA: NivelUi = {
  id: 0,
  titulo: "Documentação da empresa",
  subtitulo: "Documentos iniciais do cadastro",
  cor: "from-indigo-500 to-blue-600",
  icon: FileText,
};

type EmpresaDocSlot = (typeof DOCUMENTOS_EMPRESA)[number] & {
  kind: "empresa";
  enviado: boolean;
  arquivoNome?: string;
};

type ChecklistDocSlot = {
  kind: "checklist";
  item: DocChecklistItem;
  enviado: boolean;
  uploadManual: boolean;
};

type DocSlot = EmpresaDocSlot | ChecklistDocSlot;

type ModalStep = NivelUi & { docs: DocSlot[] };

function isEmpresaDocEnviado(
  titulosPainel: { titulo: string; status: string; arquivoUrl?: string | null }[],
  docId: string,
): boolean {
  const nome = DOC_UPLOAD_NOMES[docId];
  return titulosPainel.some(
    (d) =>
      (d.titulo === nome || d.titulo.toLowerCase().includes(nome.slice(0, 12).toLowerCase())) &&
      (d.status === "ok" || !!d.arquivoUrl),
  );
}

function isChecklistEnviado(item: DocChecklistItem): boolean {
  return item.status === "ok" || item.status === "vencendo" || !!item.arquivoUrl;
}

export interface UploadNiveisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: number;
  empresaNome?: string;
  empresaCnpj?: string;
  onConcluido?: () => void;
}

export function UploadNiveisModal({
  open,
  onOpenChange,
  clienteId,
  empresaNome,
  empresaCnpj,
  onConcluido,
}: UploadNiveisModalProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<ModalStep[]>([]);
  const [uploadDoc, setUploadDoc] = useState<DocChecklistItem | null>(null);
  const [uploadingEmpresaId, setUploadingEmpresaId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingEmpresaDocId = useRef<string | null>(null);

  const recarregar = useCallback(async () => {
    setLoading(true);
    const [checklist, gerenciar] = await Promise.all([
      fetchDocumentosChecklist(clienteId),
      fetchEmpresaGerenciar(clienteId),
    ]);
    setLoading(false);

    const painelDocs = gerenciar.ok && gerenciar.painel ? gerenciar.painel.documentos : [];
    const docsPorNivel = checklist.ok ? checklist.docsPorNivel ?? {} : {};

    const basicDocs: DocSlot[] = DOCUMENTOS_EMPRESA.map((d) => ({
      ...d,
      kind: "empresa" as const,
      enviado: isEmpresaDocEnviado(painelDocs, d.id),
    }));

    const nivelSteps: ModalStep[] = NIVEIS_UI.map((meta) => {
      const items = docsPorNivel[meta.id] ?? [];
      return {
        ...meta,
        docs: items.map((item) => {
          const rules = getDocUploadRules(item.codigo, item.nivelSicaf ?? null);
          return {
            kind: "checklist" as const,
            item,
            enviado: isChecklistEnviado(item),
            uploadManual: item.uploadManual ?? rules.uploadManual,
          };
        }),
      };
    });

    setSteps([{ ...ETAPA_BASICA, docs: basicDocs }, ...nivelSteps]);
  }, [clienteId]);

  useEffect(() => {
    if (!open) {
      setStepIdx(0);
      setUploadDoc(null);
      setUploadingEmpresaId(null);
      return;
    }
    void recarregar();
  }, [open, recarregar]);

  const nivel = steps[stepIdx];
  const totalDocs = useMemo(
    () => steps.reduce((acc, s) => acc + s.docs.length, 0),
    [steps],
  );
  const enviados = useMemo(
    () => steps.reduce((acc, s) => acc + s.docs.filter((d) => d.enviado).length, 0),
    [steps],
  );
  const progresso = totalDocs ? Math.round((enviados / totalDocs) * 100) : 0;

  const enviadosNivel = nivel?.docs.filter((d) => d.enviado).length ?? 0;
  const Icon = nivel?.icon ?? FileText;

  const handleEmpresaFile = async (docId: string, file: File) => {
    const allowed = [".pdf", ".jpg", ".jpeg", ".png"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!allowed.some((a) => ext === a) && file.type !== "application/pdf") {
      toast.error("Envie PDF, JPG ou PNG até 10MB.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo maior que 10MB.");
      return;
    }

    setUploadingEmpresaId(docId);
    const nome = DOC_UPLOAD_NOMES[docId] || file.name;
    const result = await uploadDocumentoEmpresa({ clienteId, arquivo: file, nome });
    setUploadingEmpresaId(null);

    if (!result.ok) {
      toast.error(result.error || "Falha ao enviar documento.");
      return;
    }
    toast.success("Documento enviado com sucesso.");
    await recarregar();
  };

  const triggerEmpresaUpload = (docId: string) => {
    pendingEmpresaDocId.current = docId;
    fileInputRef.current?.click();
  };

  const next = () => {
    if (stepIdx < steps.length - 1) {
      setStepIdx((i) => i + 1);
      return;
    }
    onConcluido?.();
    onOpenChange(false);
    toast.success("Documentos salvos. Continue o processo SICAF.");
  };

  const prev = () => {
    if (stepIdx > 0) setStepIdx((i) => i - 1);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const docId = pendingEmpresaDocId.current;
          e.target.value = "";
          pendingEmpresaDocId.current = null;
          if (file && docId) void handleEmpresaFile(docId, file);
        }}
      />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl gap-0 overflow-hidden border-0 p-0">
          <DialogTitle className="sr-only">Upload de documentos por nível SICAF</DialogTitle>
          <DialogDescription className="sr-only">
            Envio guiado de documentos para cada nível do SICAF.
          </DialogDescription>

          {loading && steps.length === 0 ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 p-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando documentos...</p>
            </div>
          ) : !nivel ? null : (
            <div className="grid min-h-[640px] lg:grid-cols-[280px_1fr]">
              <aside
                className="relative hidden flex-col justify-between overflow-hidden p-6 text-white lg:flex"
                style={{
                  backgroundImage:
                    "linear-gradient(160deg, rgba(15,23,42,0.92) 0%, rgba(30,41,59,0.88) 55%, rgba(2,6,23,0.95) 100%), url('https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=900&q=80')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-primary/30 blur-3xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/70">
                    <ShieldCheck className="h-3.5 w-3.5" /> Upload SICAF
                  </div>
                  <h2 className="mt-3 text-2xl font-bold leading-tight">Documentos por nível</h2>
                  {empresaNome && <p className="mt-1 text-sm text-white/70">{empresaNome}</p>}

                  <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-white/70">
                      <span>Progresso geral</span>
                      <span className="text-white">{progresso}%</span>
                    </div>
                    <Progress value={progresso} className="mt-2 h-1.5 bg-white/15" />
                    <p className="mt-2 text-xs text-white/60">
                      {enviados} de {totalDocs} documentos enviados
                    </p>
                  </div>
                </div>

                <ol className="relative mt-6 space-y-1.5">
                  {steps.map((n, i) => {
                    const NIcon = n.icon;
                    const ativo = i === stepIdx;
                    const completos = n.docs.filter((d) => d.enviado).length;
                    const allDone = n.docs.length > 0 && completos === n.docs.length;
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => setStepIdx(i)}
                          className={cn(
                            "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition",
                            ativo
                              ? "bg-white text-slate-900 shadow-lg"
                              : "text-white/80 hover:bg-white/10",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold",
                              ativo
                                ? `bg-gradient-to-br ${n.cor} text-white`
                                : allDone
                                  ? "bg-emerald-500 text-white"
                                  : "bg-white/10 text-white/80",
                            )}
                          >
                            {allDone ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <NIcon className="h-4 w-4" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold leading-tight">{n.titulo}</p>
                            <p
                              className={cn(
                                "truncate text-[11px]",
                                ativo ? "text-slate-500" : "text-white/55",
                              )}
                            >
                              {n.subtitulo}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "text-[10px] font-bold tabular-nums",
                              ativo ? "text-slate-500" : "text-white/60",
                            )}
                          >
                            {completos}/{n.docs.length}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>

                <div className="relative mt-6 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70 backdrop-blur">
                  <div className="flex items-center gap-2 text-white">
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">
                      Dica CADBRASIL
                    </span>
                  </div>
                  <p className="mt-1 leading-snug">
                    Envie os documentos obrigatórios de cada etapa para liberar as próximas fases
                    do SICAF.
                  </p>
                </div>
              </aside>

              <section className="flex flex-col bg-background">
                <header className="flex items-start justify-between border-b border-border px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                        nivel.cor,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Etapa {stepIdx + 1} de {steps.length}
                      </p>
                      <h3 className="text-xl font-bold tracking-tight">
                        {nivel.titulo} · {nivel.subtitulo}
                      </h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="rounded-md p-2 text-muted-foreground hover:bg-muted"
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </header>

                <div className="px-6 pt-4">
                  <Progress value={((stepIdx + 1) / steps.length) * 100} className="h-1" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {enviadosNivel} de {nivel.docs.length} documentos desta etapa enviados
                  </p>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
                  {nivel.docs.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum documento cadastrado para este nível.
                    </p>
                  ) : (
                    nivel.docs.map((doc) => {
                      if (doc.kind === "empresa") {
                        const uploading = uploadingEmpresaId === doc.id;
                        return (
                          <DocRow
                            key={doc.id}
                            nome={doc.nome}
                            obrigatorio={doc.obrigatorio}
                            enviado={doc.enviado}
                            uploading={uploading}
                            onUpload={() => triggerEmpresaUpload(doc.id)}
                          />
                        );
                      }

                      const { item, uploadManual } = doc;
                      return (
                        <DocRow
                          key={item.id}
                          nome={item.nome}
                          obrigatorio={item.status === "pendente" || item.status === "vencida"}
                          enviado={doc.enviado}
                          autoOnly={!uploadManual}
                          statusLabel={
                            item.status === "vencida"
                              ? "Vencida"
                              : item.status === "vencendo"
                                ? "Vencendo"
                                : undefined
                          }
                          onUpload={() => setUploadDoc(item)}
                        />
                      );
                    })
                  )}
                </div>

                <footer className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-6 py-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={prev}
                    disabled={stepIdx === 0}
                    className="gap-1.5"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Anterior
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                      Salvar e sair
                    </Button>
                    <Button size="sm" onClick={next} className="gap-1.5" disabled={loading}>
                      {stepIdx === steps.length - 1 ? (
                        <>
                          Concluir <CheckCircle2 className="h-3.5 w-3.5" />
                        </>
                      ) : (
                        <>
                          Próximo nível <ArrowRight className="h-3.5 w-3.5" />
                        </>
                      )}
                    </Button>
                  </div>
                </footer>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DocumentoUploadModal
        open={!!uploadDoc}
        onOpenChange={(v) => !v && setUploadDoc(null)}
        clienteId={clienteId}
        clienteNome={empresaNome ?? "Empresa"}
        clienteDocumento={empresaCnpj ?? ""}
        doc={uploadDoc}
        onSuccess={() => {
          setUploadDoc(null);
          void recarregar();
        }}
      />
    </>
  );
}

function DocRow({
  nome,
  obrigatorio,
  enviado,
  uploading,
  autoOnly,
  statusLabel,
  onUpload,
}: {
  nome: string;
  obrigatorio?: boolean;
  enviado: boolean;
  uploading?: boolean;
  autoOnly?: boolean;
  statusLabel?: string;
  onUpload: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-xl border-2 border-dashed p-4 transition",
        enviado
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-border bg-muted/30 hover:border-foreground/30 hover:bg-muted/50",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            enviado
              ? "bg-emerald-500 text-white"
              : "border border-border bg-background text-muted-foreground",
          )}
        >
          {enviado ? <CheckCircle2 className="h-5 w-5" /> : <Cloud className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{nome}</p>
            {obrigatorio && (
              <span className="rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-300">
                Obrigatório
              </span>
            )}
            {statusLabel && (
              <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                {statusLabel}
              </span>
            )}
            {autoOnly && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                Via Assistente
              </span>
            )}
          </div>
          {enviado ? (
            <p className="mt-1.5 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
              <FileText className="h-3.5 w-3.5" />
              Documento enviado
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              {autoOnly
                ? "Obtido automaticamente pelo Assistente CADBRASIL"
                : "PDF, JPG ou PNG até 10MB"}
            </p>
          )}
        </div>
        {!enviado && !autoOnly && (
          <Button
            size="sm"
            onClick={onUpload}
            disabled={uploading}
            className="h-8 gap-1 text-xs"
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            Enviar
          </Button>
        )}
        {autoOnly && !enviado && (
          <Button size="sm" variant="outline" disabled className="h-8 gap-1 text-xs">
            <Bot className="h-3 w-3" /> Assistente
          </Button>
        )}
      </div>
    </div>
  );
}
