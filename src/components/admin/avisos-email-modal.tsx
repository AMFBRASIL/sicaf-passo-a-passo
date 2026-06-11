import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useCallback, useEffect, useState } from "react";
import {
  Mail,
  User,
  FileText,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Send,
  Eye,
  RefreshCw,
  DollarSign,
  ShieldAlert,
  Loader2,
  Copy,
  Building2,
} from "lucide-react";
import wizardBg from "@/assets/wizard-bg.jpg";
import { toast } from "sonner";
import type { ClienteDetalhe } from "./cliente-detalhe-modal";
import {
  type AvisoTemplateItem,
  fetchAvisoTemplates,
  previewAvisoEmail,
  enviarAvisoEmail,
} from "@/lib/admin-email-api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: ClienteDetalhe;
  clienteId?: number;
  onEnviado?: () => void;
}

type StepKey = "destino" | "template" | "conteudo" | "revisar" | "concluido";

const steps: { key: StepKey; label: string; desc: string; icon: React.ElementType }[] = [
  { key: "destino", label: "Destinatário", desc: "Para quem enviar", icon: User },
  { key: "template", label: "Template", desc: "Tipo de aviso", icon: FileText },
  { key: "conteudo", label: "Personalizar", desc: "Assunto e mensagem", icon: Sparkles },
  { key: "revisar", label: "Revisar", desc: "Conferir e enviar", icon: Eye },
  { key: "concluido", label: "Concluído", desc: "Envio registrado", icon: CheckCircle2 },
];

function iconForTemplate(nome: string): React.ElementType {
  const n = nome.toLowerCase();
  if (n.includes("boleto") || n.includes("pagamento") || n.includes("cobran")) return DollarSign;
  if (n.includes("certid")) return ShieldAlert;
  if (n.includes("sicaf") || n.includes("renov")) return RefreshCw;
  if (n.includes("bem-vindo") || n.includes("boas")) return Sparkles;
  return FileText;
}

export function AvisosEmailModal({ open, onOpenChange, cliente, clienteId, onEnviado }: Props) {
  const [step, setStep] = useState<StepKey>("destino");
  const [templates, setTemplates] = useState<AvisoTemplateItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [buscaTemplate, setBuscaTemplate] = useState("");
  const [templateDbId, setTemplateDbId] = useState<number | null>(null);
  const [emailTo, setEmailTo] = useState(cliente.email ?? "");
  const [emailCc, setEmailCc] = useState("");
  const [copiarResponsavel, setCopiarResponsavel] = useState(true);
  const [mensagemAdicional, setMensagemAdicional] = useState("");
  const [assuntoCustom, setAssuntoCustom] = useState("");
  const [assuntoEditado, setAssuntoEditado] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewAssunto, setPreviewAssunto] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ message: string; simulado?: boolean } | null>(null);

  const effectiveClienteId =
    clienteId ?? (Number.isFinite(parseInt(String(cliente.id), 10)) ? parseInt(String(cliente.id), 10) : undefined);

  const reset = useCallback(() => {
    setStep("destino");
    setTemplateDbId(null);
    setBuscaTemplate("");
    setEmailTo(cliente.email ?? "");
    setEmailCc("");
    setCopiarResponsavel(true);
    setMensagemAdicional("");
    setAssuntoCustom("");
    setAssuntoEditado(false);
    setPreviewHtml("");
    setPreviewAssunto("");
    setResultado(null);
    setEnviando(false);
  }, [cliente.email]);

  useEffect(() => {
    if (!open) return;
    reset();
    setLoadingTemplates(true);
    fetchAvisoTemplates()
      .then((t) => {
        setTemplates(t);
        if (t.length > 0) setTemplateDbId(t[0].id);
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Erro ao carregar templates");
      })
      .finally(() => setLoadingTemplates(false));
  }, [open, reset]);

  const carregarPreview = useCallback(async () => {
    if (!effectiveClienteId || !templateDbId) return;
    setLoadingPreview(true);
    try {
      const { preview } = await previewAvisoEmail(effectiveClienteId, {
        templateDbId,
        mensagemAdicional,
        assuntoCustom: assuntoEditado ? assuntoCustom : undefined,
      });
      setPreviewHtml(preview.html);
      const assunto = assuntoEditado ? assuntoCustom : preview.assunto;
      setPreviewAssunto(assunto);
      if (!assuntoEditado) setAssuntoCustom(preview.assunto);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar pré-visualização");
    } finally {
      setLoadingPreview(false);
    }
  }, [effectiveClienteId, templateDbId, mensagemAdicional, assuntoCustom, assuntoEditado]);

  useEffect(() => {
    if (open && (step === "conteudo" || step === "revisar") && effectiveClienteId && templateDbId) {
      const t = setTimeout(() => void carregarPreview(), 300);
      return () => clearTimeout(t);
    }
  }, [open, step, carregarPreview, effectiveClienteId, templateDbId, mensagemAdicional, assuntoCustom, assuntoEditado]);

  const idxAtual = steps.findIndex((s) => s.key === step);
  const templateSel = templates.find((t) => t.id === templateDbId);
  const templatesFiltrados = templates.filter((t) => {
    const q = buscaTemplate.trim().toLowerCase();
    if (!q) return true;
    return (
      t.nome.toLowerCase().includes(q) ||
      t.assunto.toLowerCase().includes(q) ||
      (t.codigo || "").toLowerCase().includes(q)
    );
  });

  const canNext: Record<StepKey, boolean> = {
    destino: !!emailTo.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo.trim()),
    template: !!templateDbId && templates.length > 0,
    conteudo: !!previewAssunto.trim() || !!assuntoCustom.trim(),
    revisar: true,
    concluido: true,
  };

  const avancar = () => {
    const keys = steps.map((s) => s.key).filter((k) => k !== "concluido") as Exclude<StepKey, "concluido">[];
    const i = keys.indexOf(step as Exclude<StepKey, "concluido">);
    if (i >= 0 && i < keys.length - 1) setStep(keys[i + 1]);
  };

  const voltar = () => {
    const keys = steps.map((s) => s.key).filter((k) => k !== "concluido") as Exclude<StepKey, "concluido">[];
    const i = keys.indexOf(step as Exclude<StepKey, "concluido">);
    if (i > 0) setStep(keys[i - 1]);
  };

  const enviar = async () => {
    if (!effectiveClienteId || !templateDbId) {
      toast.error("Cliente ou template inválido");
      return;
    }
    setEnviando(true);
    try {
      const res = await enviarAvisoEmail(effectiveClienteId, {
        templateDbId,
        to: emailTo.trim(),
        cc: emailCc.trim() || undefined,
        mensagemAdicional: mensagemAdicional.trim() || undefined,
        assuntoCustom: assuntoEditado ? assuntoCustom.trim() : undefined,
      });
      setResultado(res);
      setStep("concluido");
      onEnviado?.();
      if (res.simulado) {
        toast.info(res.message, { description: "Configure SMTP no servidor para envio real." });
      } else {
        toast.success(res.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar");
    } finally {
      setEnviando(false);
    }
  };

  const fechar = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">Avisos por e-mail — {cliente.razao}</DialogTitle>
        <div className="grid grid-cols-[280px_1fr] min-h-[620px]">
          <aside
            className="relative p-6 text-white flex flex-col"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(88,28,135,0.88), rgba(15,23,42,0.95)), url(${wizardBg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="rounded-lg bg-white/15 p-2 backdrop-blur">
                <Mail className="h-4 w-4" />
              </div>
              <span className="text-xs font-mono opacity-80">AVISOS</span>
            </div>
            <h2 className="text-lg font-semibold leading-tight">E-mail ao cliente</h2>
            <p className="mt-1 text-xs text-white/70 truncate">{cliente.razao}</p>

            <div className="mt-6 space-y-1">
              {steps
                .filter((s) => s.key !== "concluido" || step === "concluido")
                .map((s, i) => {
                  const Icon = s.icon;
                  const active = s.key === step;
                  const stepIdx = steps.findIndex((x) => x.key === s.key);
                  const done = stepIdx < idxAtual || (step === "concluido" && s.key !== "concluido");
                  const disabled = s.key === "concluido" && step !== "concluido";
                  return (
                    <button
                      key={s.key}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (s.key !== "concluido" && (done || stepIdx <= idxAtual)) setStep(s.key);
                      }}
                      className={`w-full text-left rounded-lg px-3 py-2.5 flex items-start gap-3 transition ${
                        active ? "bg-white/15 backdrop-blur" : done ? "hover:bg-white/10" : "opacity-60"
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                          active
                            ? "bg-white text-violet-900"
                            : done
                              ? "bg-emerald-500/90 text-white"
                              : "bg-white/10"
                        }`}
                      >
                        {done && !active ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <Icon className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{s.label}</div>
                        <div className="text-[11px] text-white/60 truncate">{s.desc}</div>
                      </div>
                    </button>
                  );
                })}
            </div>

            <div className="mt-auto pt-6 space-y-2 text-[11px] text-white/60">
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{cliente.cnpj}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <User className="h-3 w-3 shrink-0" />
                <span className="truncate">{cliente.responsavel}</span>
              </div>
              <div className="h-1 rounded-full bg-white/20 overflow-hidden mt-3">
                <div
                  className="h-full bg-violet-400 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, ((idxAtual + 1) / (step === "concluido" ? steps.length : steps.length - 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </aside>

          <div className="flex flex-col bg-background min-h-0">
            <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
              <div>
                <div className="text-xs text-muted-foreground">Etapa {Math.min(idxAtual + 1, 4)} de 4</div>
                <div className="text-base font-semibold">{steps.find((s) => s.key === step)?.label}</div>
              </div>
              {templateSel && step !== "destino" && (
                <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-700 dark:text-violet-300">
                  {templateSel.nome}
                </Badge>
              )}
            </div>

            <ScrollArea className="flex-1 max-h-[480px]">
              <div className="px-6 py-5">
                {step === "destino" && (
                  <div className="space-y-5">
                    <div className="rounded-xl border bg-card p-4 flex gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
                        <Building2 className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{cliente.razao}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{cliente.cnpj}</p>
                        <p className="text-sm mt-2 text-muted-foreground">
                          Responsável: <span className="text-foreground font-medium">{cliente.responsavel}</span>
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email-to">E-mail do destinatário *</Label>
                      <div className="flex gap-2">
                        <Input
                          id="email-to"
                          type="email"
                          value={emailTo}
                          onChange={(e) => setEmailTo(e.target.value)}
                          placeholder="cliente@empresa.com.br"
                          className="flex-1"
                        />
                        {cliente.email && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="Usar e-mail do cadastro"
                            onClick={() => setEmailTo(cliente.email!)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email-cc">Cópia (CC) — opcional</Label>
                      <Input
                        id="email-cc"
                        type="email"
                        value={emailCc}
                        onChange={(e) => setEmailCc(e.target.value)}
                        placeholder="financeiro@empresa.com.br"
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">Saudar pelo nome do responsável</p>
                        <p className="text-xs text-muted-foreground">Inclui {cliente.responsavel} no corpo do e-mail</p>
                      </div>
                      <Switch checked={copiarResponsavel} onCheckedChange={setCopiarResponsavel} />
                    </div>
                  </div>
                )}

                {step === "template" && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Templates cadastrados em <strong>templates_email</strong>. O preview usa o HTML do banco com os dados deste cliente.
                    </p>
                    <Input
                      value={buscaTemplate}
                      onChange={(e) => setBuscaTemplate(e.target.value)}
                      placeholder="Buscar template por nome ou assunto..."
                    />
                    {loadingTemplates ? (
                      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" /> Carregando templates...
                      </div>
                    ) : templates.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                        Nenhum template ativo encontrado na tabela <code>templates_email</code>.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1">
                        {templatesFiltrados.map((t) => {
                          const Icon = iconForTemplate(t.nome);
                          const selected = templateDbId === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                setTemplateDbId(t.id);
                                setAssuntoEditado(false);
                              }}
                              className={`rounded-xl border p-4 text-left transition hover:shadow-md ${
                                selected
                                  ? "border-violet-500 bg-violet-50/60 dark:bg-violet-950/30 ring-2 ring-violet-500/25"
                                  : "hover:bg-muted/40"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                                    selected ? "bg-violet-500 text-white" : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold leading-snug">{t.nome}</p>
                                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                                    {t.assunto || t.descricao}
                                  </p>
                                  {t.variaveisDisponiveis?.length > 0 && (
                                    <p className="mt-1.5 text-[10px] text-muted-foreground line-clamp-1">
                                      Vars: {t.variaveisDisponiveis.slice(0, 4).join(", ")}
                                      {t.variaveisDisponiveis.length > 4 ? "…" : ""}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {step === "conteudo" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="assunto">Assunto do e-mail</Label>
                        <div className="flex items-center gap-2">
                          <Label htmlFor="edit-assunto" className="text-xs text-muted-foreground font-normal">
                            Editar manualmente
                          </Label>
                          <Switch
                            id="edit-assunto"
                            checked={assuntoEditado}
                            onCheckedChange={(v) => {
                              setAssuntoEditado(v);
                              if (!v) void carregarPreview();
                            }}
                          />
                        </div>
                      </div>
                      <Input
                        id="assunto"
                        value={assuntoEditado ? assuntoCustom : assuntoCustom || previewAssunto}
                        onChange={(e) => {
                          setAssuntoCustom(e.target.value);
                          setAssuntoEditado(true);
                        }}
                        disabled={!assuntoEditado && loadingPreview}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="msg-extra">Mensagem adicional (opcional)</Label>
                      <Textarea
                        id="msg-extra"
                        value={mensagemAdicional}
                        onChange={(e) => setMensagemAdicional(e.target.value)}
                        placeholder="Escreva uma observação que será incluída no e-mail..."
                        className="min-h-[100px]"
                      />
                    </div>

                    {templateSel?.variaveisDisponiveis?.length ? (
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Variáveis preenchidas automaticamente
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {templateSel.variaveisDisponiveis.map((v) => (
                            <Badge key={v} variant="secondary" className="text-[10px] font-mono">
                              {`{{${v}}}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <Separator />

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5" /> Pré-visualização
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => void carregarPreview()}
                          disabled={loadingPreview}
                        >
                          {loadingPreview ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          Atualizar
                        </Button>
                      </div>
                      <div className="rounded-lg border bg-white dark:bg-slate-950 overflow-hidden min-h-[200px]">
                        {loadingPreview && !previewHtml ? (
                          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Gerando preview...
                          </div>
                        ) : (
                          <iframe
                            title="Preview do e-mail"
                            srcDoc={previewHtml}
                            className="w-full h-[280px] border-0"
                            sandbox=""
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {step === "revisar" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <InfoCard label="Destinatário" value={emailTo} />
                      <InfoCard label="Cópia (CC)" value={emailCc || "—"} />
                      <InfoCard label="Template" value={templateSel?.nome ?? String(templateDbId ?? "—")} />
                      <InfoCard label="Assunto" value={assuntoEditado ? assuntoCustom : previewAssunto || assuntoCustom} />
                    </div>
                    {mensagemAdicional.trim() && (
                      <div className="rounded-lg border bg-violet-50/50 dark:bg-violet-950/20 p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Observação adicional</p>
                        <p className="text-sm">{mensagemAdicional}</p>
                      </div>
                    )}
                    <Separator />
                    <div className="rounded-lg border overflow-hidden">
                      <iframe
                        title="Preview final"
                        srcDoc={previewHtml}
                        className="w-full h-[240px] border-0 bg-white"
                        sandbox=""
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Ao confirmar, o e-mail será enviado ao destinatário e registrado no histórico do cliente.
                    </p>
                  </div>
                )}

                {step === "concluido" && resultado && (
                  <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Aviso processado</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-md">{resultado.message}</p>
                    </div>
                    <div className="rounded-lg border bg-card p-4 text-left w-full max-w-md text-sm space-y-1">
                      <p>
                        <span className="text-muted-foreground">Para:</span> {emailTo}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Assunto:</span>{" "}
                        {assuntoEditado ? assuntoCustom : previewAssunto}
                      </p>
                      {resultado.simulado && (
                        <Badge variant="outline" className="mt-2 text-amber-700 border-amber-500/40">
                          Modo simulação (SMTP não configurado)
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="border-t px-6 py-4 flex items-center justify-between shrink-0 bg-muted/20">
              {step === "concluido" ? (
                <>
                  <div />
                  <Button onClick={() => fechar(false)}>Fechar</Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => (step === "destino" ? fechar(false) : voltar())}
                    disabled={enviando}
                  >
                    {step === "destino" ? "Cancelar" : "Voltar"}
                  </Button>
                  <div className="flex gap-2">
                    {step === "revisar" ? (
                      <Button
                        type="button"
                        className="gap-1.5 bg-violet-600 hover:bg-violet-700"
                        onClick={() => void enviar()}
                        disabled={enviando || !canNext.destino}
                      >
                        {enviando ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Enviar e-mail
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        className="gap-1.5"
                        onClick={avancar}
                        disabled={!canNext[step]}
                      >
                        Continuar <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5 truncate" title={value}>
        {value}
      </p>
    </div>
  );
}
