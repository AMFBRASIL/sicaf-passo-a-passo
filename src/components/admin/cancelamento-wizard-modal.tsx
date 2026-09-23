import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCallback, useEffect, useState } from "react";
import {
  Ban,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Eye,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Paperclip,
  Scale,
  Send,
  Sparkles,
  User,
  X,
} from "lucide-react";
import wizardBg from "@/assets/wizard-bg.jpg";
import { toast } from "sonner";
import {
  type CancelamentoAnexo,
  type CancelamentoResposta,
  type CancelamentoStatus,
  type SolicitacaoCancelamento,
  type StatusOption,
  STATUS_BADGE,
  fetchCancelamentoDetalhe,
  responderCancelamento,
} from "@/lib/cancelamentos-api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitacaoId: number | null;
  onRespondido?: () => void;
  onAbrirEmpresa?: (clienteId: number) => void;
}

type StepKey = "resumo" | "analise" | "resposta" | "anexos" | "revisar" | "concluido";

const steps: { key: StepKey; label: string; desc: string; icon: React.ElementType }[] = [
  { key: "resumo", label: "Solicitação", desc: "O que o cliente pediu", icon: ClipboardList },
  { key: "analise", label: "Análise", desc: "Decisão e status", icon: Scale },
  { key: "resposta", label: "Resposta", desc: "E-mail ao cliente", icon: MessageSquare },
  { key: "anexos", label: "Anexos", desc: "Documentos da disputa", icon: Paperclip },
  { key: "revisar", label: "Revisar", desc: "Conferir e enviar", icon: Eye },
  { key: "concluido", label: "Concluído", desc: "Disputa registrada", icon: CheckCircle2 },
];

const STATUS_SUGESTOES: { value: CancelamentoStatus; label: string; hint: string }[] = [
  { value: "em_andamento", label: "Em andamento", hint: "Iniciar tratamento" },
  { value: "em_analise", label: "Em análise", hint: "Aguardando documentos/avaliação" },
  { value: "analisada", label: "Analisada", hint: "Análise concluída" },
  { value: "procedente", label: "Procedente", hint: "Aceitar cancelamento/reembolso" },
  { value: "improcedente", label: "Improcedente", hint: "Negar com fundamentação" },
  { value: "processada", label: "Processada", hint: "Encerrar e executar" },
  { value: "cancelada", label: "Cancelada", hint: "Arquivar solicitação" },
  { value: "revertida", label: "Revertida", hint: "Cliente volta a ativo" },
];

function formatDate(v?: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("pt-BR");
  } catch {
    return String(v);
  }
}

function formatReembolso(dados: Record<string, unknown> | null) {
  if (!dados || typeof dados !== "object") return null;
  const entries = Object.entries(dados).filter(([, v]) => v != null && String(v).trim() !== "");
  if (!entries.length) return null;
  return entries;
}

export function CancelamentoWizardModal({
  open,
  onOpenChange,
  solicitacaoId,
  onRespondido,
  onAbrirEmpresa,
}: Props) {
  const [step, setStep] = useState<StepKey>("resumo");
  const [loading, setLoading] = useState(false);
  const [solicitacao, setSolicitacao] = useState<SolicitacaoCancelamento | null>(null);
  const [respostas, setRespostas] = useState<CancelamentoResposta[]>([]);
  const [anexosExistentes, setAnexosExistentes] = useState<CancelamentoAnexo[]>([]);
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([]);

  const [statusNovo, setStatusNovo] = useState<CancelamentoStatus>("em_analise");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [emailDestino, setEmailDestino] = useState("");
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [notaInterna, setNotaInterna] = useState(false);
  const [observacoesInternas, setObservacoesInternas] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep("resumo");
    setSolicitacao(null);
    setRespostas([]);
    setAnexosExistentes([]);
    setStatusNovo("em_analise");
    setAssunto("");
    setMensagem("");
    setEmailDestino("");
    setEnviarEmail(true);
    setNotaInterna(false);
    setObservacoesInternas("");
    setFiles([]);
    setResultado(null);
    setEnviando(false);
  }, []);

  const carregar = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const res = await fetchCancelamentoDetalhe(id);
      if (!res.ok || !res.solicitacao) {
        toast.error(res.error || "Solicitação não encontrada");
        return;
      }
      setSolicitacao(res.solicitacao);
      setRespostas(res.respostas || []);
      setAnexosExistentes(res.anexos || []);
      setStatusOptions(res.statusOptions || []);
      setEmailDestino(res.solicitacao.email || "");
      setAssunto(
        `Atualização — cancelamento ${res.solicitacao.protocolo || `#${res.solicitacao.id}`}`,
      );
      const next =
        res.solicitacao.status === "solicitada" ? "em_analise" : res.solicitacao.status;
      setStatusNovo(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !solicitacaoId) return;
    reset();
    void carregar(solicitacaoId);
  }, [open, solicitacaoId, reset, carregar]);

  const idxAtual = steps.findIndex((s) => s.key === step);

  const canNext: Record<StepKey, boolean> = {
    resumo: !!solicitacao,
    analise: !!statusNovo,
    resposta: notaInterna || (!!mensagem.trim() && (!enviarEmail || !!emailDestino.trim())),
    anexos: true,
    revisar: !!mensagem.trim() || notaInterna,
    concluido: true,
  };

  const avancar = () => {
    const keys = steps.map((s) => s.key).filter((k) => k !== "concluido") as Exclude<
      StepKey,
      "concluido"
    >[];
    const i = keys.indexOf(step as Exclude<StepKey, "concluido">);
    if (i >= 0 && i < keys.length - 1) setStep(keys[i + 1]);
  };

  const voltar = () => {
    const keys = steps.map((s) => s.key).filter((k) => k !== "concluido") as Exclude<
      StepKey,
      "concluido"
    >[];
    const i = keys.indexOf(step as Exclude<StepKey, "concluido">);
    if (i > 0) setStep(keys[i - 1]);
  };

  const enviar = async () => {
    if (!solicitacaoId || !mensagem.trim()) {
      toast.error("Informe a mensagem de resposta");
      return;
    }
    setEnviando(true);
    try {
      const res = await responderCancelamento(solicitacaoId, {
        mensagem: mensagem.trim(),
        assunto: assunto.trim() || undefined,
        status: statusNovo,
        emailDestino: emailDestino.trim() || undefined,
        interno: notaInterna,
        enviarEmail: notaInterna ? false : enviarEmail,
        observacoesInternas: observacoesInternas.trim() || undefined,
        files,
      });
      if (!res.ok) {
        toast.error(res.error || "Falha ao responder");
        return;
      }
      setResultado(res.message || "Resposta registrada");
      setStep("concluido");
      onRespondido?.();
      if (res.emailNotificacao?.enviado) {
        toast.success(res.message || "E-mail enviado");
      } else if (res.emailNotificacao?.simulado) {
        toast.info(res.message || "Simulado (configure SMTP)");
      } else {
        toast.success(res.message || "Resposta salva");
      }
      await carregar(solicitacaoId);
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

  const badge = solicitacao ? STATUS_BADGE[solicitacao.status] : null;
  const reembolso = formatReembolso(solicitacao?.dadosReembolso ?? null);

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">
          Cancelamento — {solicitacao?.razaoSocial || solicitacaoId}
        </DialogTitle>
        <div className="grid grid-cols-[280px_1fr] min-h-[680px]">
          <aside
            className="relative p-6 text-white flex flex-col"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(127,29,29,0.9), rgba(15,23,42,0.96)), url(${wizardBg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="rounded-lg bg-white/15 p-2 backdrop-blur">
                <Ban className="h-4 w-4" />
              </div>
              <span className="text-xs font-mono opacity-80">CANCELAMENTOS</span>
            </div>
            <h2 className="text-lg font-semibold leading-tight">Disputa / resposta</h2>
            <p className="mt-1 text-xs text-white/70 truncate">
              {solicitacao?.razaoSocial || "Carregando…"}
            </p>
            {solicitacao?.protocolo && (
              <p className="mt-0.5 text-[11px] font-mono text-white/50">{solicitacao.protocolo}</p>
            )}

            <div className="mt-6 space-y-1">
              {steps
                .filter((s) => s.key !== "concluido" || step === "concluido")
                .map((s) => {
                  const Icon = s.icon;
                  const active = s.key === step;
                  const stepIdx = steps.findIndex((x) => x.key === s.key);
                  const done = stepIdx < idxAtual || (step === "concluido" && s.key !== "concluido");
                  const disabled = s.key === "concluido" && step !== "concluido";
                  return (
                    <button
                      key={s.key}
                      type="button"
                      disabled={disabled || loading}
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
                            ? "bg-white text-rose-900"
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
              {solicitacao?.documento && (
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">{solicitacao.documento}</span>
                </div>
              )}
              {solicitacao?.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{solicitacao.email}</span>
                </div>
              )}
              <div className="h-1 rounded-full bg-white/20 overflow-hidden mt-3">
                <div
                  className="h-full bg-rose-400 transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      ((idxAtual + 1) / (step === "concluido" ? steps.length : steps.length - 1)) *
                        100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          </aside>

          <div className="flex flex-col bg-background min-h-0">
            <div className="flex items-center justify-between border-b px-6 py-4 shrink-0 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">
                  Etapa {Math.min(idxAtual + 1, 5)} de 5
                </div>
                <div className="text-base font-semibold">
                  {steps.find((s) => s.key === step)?.label}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {badge && (
                  <Badge variant="outline" className={badge.cls}>
                    {badge.label}
                  </Badge>
                )}
                {solicitacao?.clienteId && onAbrirEmpresa && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => onAbrirEmpresa(solicitacao.clienteId!)}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    Empresa
                  </Button>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1 max-h-[520px]">
              <div className="px-6 py-5">
                {loading && (
                  <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground text-sm">
                    <Loader2 className="h-5 w-5 animate-spin" /> Carregando solicitação…
                  </div>
                )}

                {!loading && step === "resumo" && solicitacao && (
                  <div className="space-y-5">
                    <div className="rounded-xl border bg-card p-4 flex gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
                        <Building2 className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{solicitacao.razaoSocial || "—"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {solicitacao.documento || "—"}
                          {solicitacao.cidade
                            ? ` · ${solicitacao.cidade}/${solicitacao.estado || ""}`
                            : ""}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                          {solicitacao.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5" /> {solicitacao.email}
                            </span>
                          )}
                          {solicitacao.telefone && (
                            <span className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5" /> {solicitacao.telefone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <InfoBox label="Protocolo" value={solicitacao.protocolo || `#${solicitacao.id}`} />
                      <InfoBox label="Criada em" value={formatDate(solicitacao.createdAt)} />
                      <InfoBox
                        label="Serviço esperado"
                        value={
                          solicitacao.servicoEsperadoOutro ||
                          solicitacao.servicoEsperado ||
                          "—"
                        }
                      />
                      <InfoBox
                        label="Monitoramento"
                        value={solicitacao.desejaMonitoramento ? "Sim" : "Não"}
                      />
                      <InfoBox
                        label="Reverter cancelamento"
                        value={solicitacao.reverterCancelamento ? "Sim (cliente pediu)" : "Não"}
                      />
                      <InfoBox
                        label="Protocolo cadastro"
                        value={solicitacao.protocoloCadastro || "—"}
                      />
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">Motivos informados</p>
                      {solicitacao.motivos.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum motivo listado.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {solicitacao.motivos.map((m, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
                            >
                              <FileText className="h-4 w-4 mt-0.5 text-rose-500 shrink-0" />
                              <span>{m}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {reembolso && (
                      <div>
                        <p className="text-sm font-medium mb-2">Dados de reembolso</p>
                        <div className="rounded-lg border divide-y">
                          {reembolso.map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-4 px-3 py-2 text-sm">
                              <span className="text-muted-foreground capitalize">
                                {k.replace(/_/g, " ")}
                              </span>
                              <span className="font-medium text-right">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {solicitacao.observacoes && (
                      <div>
                        <p className="text-sm font-medium mb-2">Observações</p>
                        <p className="text-sm whitespace-pre-wrap rounded-lg border bg-muted/30 p-3">
                          {solicitacao.observacoes}
                        </p>
                      </div>
                    )}

                    {respostas.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Histórico de respostas</p>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {respostas.map((r) => (
                            <div key={r.id} className="rounded-lg border px-3 py-2 text-sm">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-1">
                                <span>{formatDate(r.createdAt)}</span>
                                {r.usuarioNome && <span>· {r.usuarioNome}</span>}
                                {r.interno && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Interna
                                  </Badge>
                                )}
                                {r.emailEnviado && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] border-emerald-200 text-emerald-700"
                                  >
                                    E-mail enviado
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-[10px]">
                                  {r.statusNovoLabel}
                                </Badge>
                              </div>
                              <p className="whitespace-pre-wrap line-clamp-4">{r.mensagem}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {anexosExistentes.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Anexos já enviados</p>
                        <ul className="space-y-1">
                          {anexosExistentes.map((a) => (
                            <li key={a.id}>
                              <a
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-sky-600 hover:underline flex items-center gap-1.5"
                              >
                                <Paperclip className="h-3.5 w-3.5" />
                                {a.nomeOriginal}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {!loading && step === "analise" && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Defina o novo status da disputa. Isso entra no histórico e no e-mail ao cliente.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {STATUS_SUGESTOES.map((s) => {
                        const selected = statusNovo === s.value;
                        return (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => setStatusNovo(s.value)}
                            className={`rounded-xl border p-4 text-left transition hover:shadow-md ${
                              selected
                                ? "border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/25"
                                : "hover:bg-muted/40"
                            }`}
                          >
                            <p className="text-sm font-semibold">{s.label}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p>
                          </button>
                        );
                      })}
                    </div>
                    {statusOptions.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Status atuais no sistema:{" "}
                        {statusOptions.map((o) => o.label).join(" · ")}
                      </p>
                    )}
                    <div className="space-y-2">
                      <Label>Nota interna (opcional)</Label>
                      <Textarea
                        value={observacoesInternas}
                        onChange={(e) => setObservacoesInternas(e.target.value)}
                        placeholder="Anotações só para a equipe…"
                        rows={3}
                      />
                    </div>
                  </div>
                )}

                {!loading && step === "resposta" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">Nota interna (sem e-mail)</p>
                        <p className="text-xs text-muted-foreground">
                          Registra no histórico sem notificar o cliente
                        </p>
                      </div>
                      <Switch checked={notaInterna} onCheckedChange={setNotaInterna} />
                    </div>

                    {!notaInterna && (
                      <>
                        <div className="space-y-2">
                          <Label>E-mail do cliente</Label>
                          <Input
                            type="email"
                            value={emailDestino}
                            onChange={(e) => setEmailDestino(e.target.value)}
                            placeholder="cliente@empresa.com.br"
                          />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <p className="text-sm font-medium">Enviar e-mail ao cliente</p>
                            <p className="text-xs text-muted-foreground">
                              Notifica sobre a decisão / próximos passos
                            </p>
                          </div>
                          <Switch checked={enviarEmail} onCheckedChange={setEnviarEmail} />
                        </div>
                        <div className="space-y-2">
                          <Label>Assunto</Label>
                          <Input
                            value={assunto}
                            onChange={(e) => setAssunto(e.target.value)}
                            placeholder="Assunto do e-mail"
                          />
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <Label>{notaInterna ? "Nota" : "Mensagem ao cliente"} *</Label>
                      <Textarea
                        value={mensagem}
                        onChange={(e) => setMensagem(e.target.value)}
                        placeholder={
                          notaInterna
                            ? "Registro interno da análise…"
                            : "Explique a decisão, prazos, documentos necessários…"
                        }
                        rows={8}
                      />
                    </div>

                    {!notaInterna && (
                      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground flex gap-2">
                        <Sparkles className="h-4 w-4 shrink-0 text-rose-500" />
                        Sugestão: cite o protocolo, o status escolhido e o prazo para o cliente
                        responder ou enviar documentos.
                      </div>
                    )}
                  </div>
                )}

                {!loading && step === "anexos" && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Anexe comprovantes, contratos ou pareceres. Os arquivos entram no e-mail e no
                      histórico da disputa.
                    </p>
                    <label className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 cursor-pointer hover:bg-muted/40 transition">
                      <Paperclip className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm font-medium">Clique para anexar arquivos</span>
                      <span className="text-xs text-muted-foreground">PDF, imagens, DOC…</span>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const list = Array.from(e.target.files || []);
                          setFiles((prev) => [...prev, ...list]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {files.length > 0 && (
                      <ul className="space-y-2">
                        {files.map((f, i) => (
                          <li
                            key={`${f.name}-${i}`}
                            className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                          >
                            <span className="truncate flex items-center gap-2">
                              <Paperclip className="h-3.5 w-3.5 shrink-0" />
                              {f.name}
                              <span className="text-xs text-muted-foreground">
                                ({Math.round(f.size / 1024)} KB)
                              </span>
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {!loading && step === "revisar" && solicitacao && (
                  <div className="space-y-4">
                    <div className="rounded-xl border p-4 space-y-3 text-sm">
                      <Row label="Empresa" value={solicitacao.razaoSocial || "—"} />
                      <Row label="Protocolo" value={solicitacao.protocolo || `#${solicitacao.id}`} />
                      <Row
                        label="Novo status"
                        value={STATUS_BADGE[statusNovo]?.label || statusNovo}
                      />
                      <Row
                        label="Modo"
                        value={notaInterna ? "Nota interna" : enviarEmail ? "E-mail ao cliente" : "Só histórico"}
                      />
                      {!notaInterna && <Row label="Destino" value={emailDestino || "—"} />}
                      {!notaInterna && <Row label="Assunto" value={assunto || "—"} />}
                      <Row label="Anexos novos" value={String(files.length)} />
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Mensagem</p>
                      <pre className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm font-sans">
                        {mensagem || "—"}
                      </pre>
                    </div>
                  </div>
                )}

                {!loading && step === "concluido" && (
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-semibold">Resposta registrada</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      {resultado || "A disputa foi atualizada com sucesso."}
                    </p>
                    <Button type="button" onClick={() => fechar(false)} className="mt-2">
                      Fechar
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>

            {step !== "concluido" && (
              <div className="flex items-center justify-between border-t px-6 py-4 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={idxAtual <= 0 || loading}
                  onClick={voltar}
                >
                  Voltar
                </Button>
                <div className="flex gap-2">
                  {step !== "revisar" ? (
                    <Button
                      type="button"
                      disabled={!canNext[step] || loading}
                      onClick={avancar}
                      className="gap-1.5 bg-rose-600 hover:bg-rose-700"
                    >
                      Continuar <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={enviando || !canNext.revisar}
                      onClick={() => void enviar()}
                      className="gap-1.5 bg-rose-600 hover:bg-rose-700"
                    >
                      {enviando ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {notaInterna ? "Salvar nota" : enviarEmail ? "Enviar resposta" : "Registrar"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5 break-words">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
