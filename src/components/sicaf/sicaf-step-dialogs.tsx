import { useEffect, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Lock,
  Search,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { uploadDocumentoEmpresa } from "@/lib/documentos-api";
import {
  CADBRASIL_EXTENSION_STORE_URL,
  useCadBrasilExtension,
} from "@/hooks/use-cadbrasil-extension";
import { toast } from "sonner";

const DOC_UPLOAD_NOMES: Record<string, string> = {
  contrato_social: "Contrato Social (última alteração)",
  cnpj_card: "Cartão CNPJ atualizado",
  rg_socio: "RG e CPF do(s) sócio(s)",
  comprovante_endereco: "Comprovante de endereço da empresa",
  procuracao: "Procuração (se aplicável)",
};

const documentosNecessarios = [
  { id: "contrato_social", label: "Contrato Social (última alteração)", obrigatorio: true },
  { id: "cnpj_card", label: "Cartão CNPJ atualizado", obrigatorio: true },
  { id: "rg_socio", label: "RG e CPF do(s) sócio(s)", obrigatorio: true },
  { id: "comprovante_endereco", label: "Comprovante de endereço da empresa", obrigatorio: true },
  { id: "procuracao", label: "Procuração (se aplicável)", obrigatorio: false },
];
export function AssistenteDialog({
  open,
  onOpenChange,
  onConcluido,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConcluido: () => void;
}) {
  const { checkExtension, waitForExtension } = useCadBrasilExtension();
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
      if (ok) {
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
  }, [open, checkExtension, onConcluido, onOpenChange]);

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
export function AssistenteRodandoDialog({
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
export function DocumentacaoDialog({
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
