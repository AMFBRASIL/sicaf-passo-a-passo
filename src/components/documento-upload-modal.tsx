import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bot,
  Calendar as CalendarIcon,
  Check,
  ExternalLink,
  FileText,
  Hash,
  Loader2,
  Shield,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DocChecklistItem } from "@/lib/documentos-api";
import { enviarDocumentoChecklist } from "@/lib/documentos-api";
import {
  getDocRequirementLabels,
  getDocUploadRules,
  SICAF_DOC_HINTS,
} from "@/lib/sicaf-document-rules";
import { NIVEIS_SICAF } from "@/lib/empresas-shared";

export interface DocumentoUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: number;
  clienteNome: string;
  clienteDocumento: string;
  doc: DocChecklistItem | null;
  onSuccess?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentoUploadModal({
  open,
  onOpenChange,
  clienteId,
  clienteNome,
  clienteDocumento,
  doc,
  onSuccess,
}: DocumentoUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [codigo, setCodigo] = useState("");
  const [validade, setValidade] = useState<Date | undefined>();
  const [dragOver, setDragOver] = useState(false);
  const [sending, setSending] = useState(false);

  const rules = useMemo(() => {
    if (!doc) return null;
    const base = getDocUploadRules(doc.codigo, doc.nivelSicaf ?? null);
    return {
      pdf: doc.uploadManual !== false ? base.pdf : false,
      codigo: doc.requerCodigo ?? base.codigo,
      validade: doc.requerValidade ?? base.validade,
      uploadManual: doc.uploadManual ?? base.uploadManual,
    };
  }, [doc]);

  const requirementLabels = useMemo(
    () => (rules ? getDocRequirementLabels(rules) : []),
    [rules],
  );

  const nivelInfo = useMemo(
    () => NIVEIS_SICAF.find((n) => n.roman === doc?.nivelSicaf),
    [doc?.nivelSicaf],
  );

  const resetForm = useCallback(() => {
    setFile(null);
    setCodigo("");
    setValidade(undefined);
    setDragOver(false);
    setSending(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }
    if (doc?.codigoCertidao) setCodigo(doc.codigoCertidao);
    if (doc?.dataValidade) {
      const d = new Date(doc.dataValidade);
      if (!Number.isNaN(d.getTime())) setValidade(d);
    }
  }, [open, doc, resetForm]);

  const handleClose = (value: boolean) => {
    onOpenChange(value);
    if (!value) resetForm();
  };

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Envie apenas arquivos PDF.");
      return;
    }
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) pickFile(dropped);
  };

  const handleSubmit = async () => {
    if (!doc || !rules) return;

    if (!rules.uploadManual) {
      toast.info("Este documento é obtido automaticamente pelo Assistente SICAF.");
      return;
    }

    if (!file) {
      toast.error("Selecione o arquivo PDF do documento.");
      return;
    }
    if (rules.codigo && !codigo.trim()) {
      toast.error("Informe o código da certidão.");
      return;
    }
    if (rules.validade && !validade) {
      toast.error("Informe a data de validade.");
      return;
    }

    setSending(true);
    try {
      const result = await enviarDocumentoChecklist({
        clienteId,
        tipoCertidaoId: doc.tipoCertidaoId,
        arquivo: file,
        codigo: rules.codigo ? codigo.trim() : undefined,
        dataValidade: rules.validade && validade ? format(validade, "yyyy-MM-dd") : undefined,
      });
      if (!result.ok) {
        toast.error(result.error || "Falha ao enviar documento.");
        return;
      }
      toast.success(`${doc.nome} enviado com sucesso.`);
      handleClose(false);
      onSuccess?.();
    } catch {
      toast.error("Erro ao enviar documento.");
    } finally {
      setSending(false);
    }
  };

  if (!doc) return null;

  const isAutoOnly = rules && !rules.uploadManual;
  const codigoHint = SICAF_DOC_HINTS[doc.codigo];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-3xl gap-0 overflow-hidden border-0 p-0 shadow-2xl sm:rounded-2xl"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Enviar {doc.nome}</DialogTitle>

        <div className="flex min-h-[480px] flex-col sm:flex-row">
          {/* Sidebar */}
          <div className="relative flex w-full shrink-0 flex-col overflow-hidden bg-gradient-to-br from-[hsl(220,70%,45%)] to-[hsl(250,60%,28%)] p-6 sm:w-64">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-white/5" />

            <div className="relative z-10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                {isAutoOnly ? (
                  <Bot className="h-6 w-6 text-white" />
                ) : (
                  <FileText className="h-6 w-6 text-white" />
                )}
              </div>
              <h2 className="text-lg font-bold leading-tight text-white">{doc.nome}</h2>
              <p className="mt-2 text-xs text-blue-100/80">{clienteNome}</p>
              <p className="font-mono text-[11px] text-blue-200/60">{clienteDocumento}</p>

              {doc.nivelSicaf && (
                <div className="mt-4 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-200/70" />
                  <Badge
                    variant="secondary"
                    className="border-white/20 bg-white/10 text-[10px] text-white"
                  >
                    Nível {doc.nivelSicaf}
                    {nivelInfo ? ` — ${nivelInfo.nome}` : ""}
                  </Badge>
                </div>
              )}

              {doc.orgaoEmissor && (
                <p className="mt-3 text-[11px] leading-relaxed text-blue-100/60">
                  Órgão: {doc.orgaoEmissor}
                </p>
              )}

              <div className="mt-5 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-200/50">
                  Requisitos
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {requirementLabels.map((label) => (
                    <span
                      key={label}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[10px] font-medium",
                        label === "Assistente SICAF"
                          ? "bg-amber-400/20 text-amber-100"
                          : "bg-white/15 text-white",
                      )}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="flex flex-1 flex-col bg-background">
            <div className="flex-1 space-y-5 p-6">
              {isAutoOnly ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
                    <Bot className="h-8 w-8 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Obtenção automática
                  </h3>
                  <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                    Documentos do Nível III (CND Federal, CRF FGTS e CNDT Trabalhista) são
                    emitidos automaticamente pelo Assistente SICAF. Não é necessário upload
                    manual.
                  </p>
                  <Button asChild className="mt-6 gap-2" variant="default">
                    <Link to="/assistente" search={{ cnpj: clienteDocumento.replace(/\D/g, "") }}>
                      <Bot className="h-4 w-4" />
                      Abrir Assistente SICAF
                    </Link>
                  </Button>
                  {doc.arquivoUrl && (
                    <a
                      href={doc.arquivoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ver documento já obtido
                    </a>
                  )}
                </div>
              ) : (
                <>
                  {/* Upload */}
                  <div>
                    <Label className="mb-2 block text-sm font-medium">Arquivo PDF</Label>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      className={cn(
                        "relative rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200",
                        dragOver
                          ? "border-primary bg-primary/5"
                          : file
                            ? "border-emerald-500/50 bg-emerald-500/5"
                            : "border-muted-foreground/25 hover:border-primary/40 hover:bg-muted/30",
                      )}
                    >
                      {file ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15">
                            <Check className="h-6 w-6 text-emerald-600" />
                          </div>
                          <p className="font-medium text-foreground">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-1 text-muted-foreground"
                            onClick={() => setFile(null)}
                          >
                            <X className="mr-1 h-3.5 w-3.5" />
                            Remover
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                          <p className="text-sm font-medium text-foreground">
                            Arraste o PDF aqui ou clique para selecionar
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Apenas arquivos .pdf
                          </p>
                          <input
                            type="file"
                            accept=".pdf,application/pdf"
                            className="absolute inset-0 cursor-pointer opacity-0"
                            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                          />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Código */}
                  {rules?.codigo && (
                    <div className="space-y-2">
                      <Label htmlFor="doc-codigo" className="flex items-center gap-2">
                        <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                        Código da certidão
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="doc-codigo"
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value)}
                        placeholder="Número ou código de autenticação"
                        className="font-mono"
                      />
                      {codigoHint && (
                        <p className="text-xs text-muted-foreground">{codigoHint}</p>
                      )}
                    </div>
                  )}

                  {/* Validade */}
                  {rules?.validade && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        Data de validade
                        <span className="text-destructive">*</span>
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !validade && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {validade
                              ? format(validade, "dd/MM/yyyy", { locale: ptBR })
                              : "Selecione a data de vencimento"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={validade}
                            onSelect={setValidade}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {doc.arquivoUrl && (
                    <div className="rounded-lg border bg-muted/30 px-4 py-3">
                      <p className="text-xs text-muted-foreground">Documento atual no sistema</p>
                      <a
                        href={doc.arquivoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir arquivo enviado
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Rodapé */}
            <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-6 py-4">
              <Button variant="outline" onClick={() => handleClose(false)} disabled={sending}>
                {isAutoOnly ? "Fechar" : "Cancelar"}
              </Button>
              {!isAutoOnly && (
                <Button onClick={handleSubmit} disabled={sending} className="min-w-[120px] gap-2">
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Enviar documento
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
