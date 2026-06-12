import { useCallback, useEffect, useState } from "react";
import {
  Shield,
  ShieldCheck,
  Lock,
  KeyRound,
  Upload,
  FileKey2,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Eye,
  EyeOff,
  Server,
  Fingerprint,
} from "lucide-react";
import wizardBg from "@/assets/wizard-bg.jpg";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  formatCertValidade,
  uploadCertificadoDigital,
  type CertificadoDigitalInfo,
} from "@/lib/certificado-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type WizardStep = "seguranca" | "arquivo" | "senha" | "validando" | "concluido";

const STEPS: { key: WizardStep; label: string; desc: string; icon: typeof Shield }[] = [
  { key: "seguranca", label: "Segurança", desc: "Como protegemos seus dados", icon: Shield },
  { key: "arquivo", label: "Certificado", desc: "Arquivo e-CNPJ (.pfx)", icon: FileKey2 },
  { key: "senha", label: "Senha", desc: "Acesso ao certificado A1", icon: KeyRound },
];

const VALIDACAO_ETAPAS = [
  { label: "Recebendo arquivo com criptografia", icon: Lock },
  { label: "Validando assinatura digital ICP-Brasil", icon: Fingerprint },
  { label: "Conferindo validade do e-CNPJ", icon: ShieldCheck },
  { label: "Armazenando com segurança", icon: Server },
] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: number;
  onConcluido: (cert: CertificadoDigitalInfo) => void;
};

export function CertificadoUploadWizard({ open, onOpenChange, clienteId, onConcluido }: Props) {
  const [step, setStep] = useState<WizardStep>("seguranca");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [validadeMsg, setValidadeMsg] = useState<string | null>(null);
  const [progressoValidacao, setProgressoValidacao] = useState(0);
  const [etapaValidacao, setEtapaValidacao] = useState(0);

  const reset = useCallback(() => {
    setStep("seguranca");
    setArquivo(null);
    setSenha("");
    setMostrarSenha(false);
    setErro(null);
    setValidadeMsg(null);
    setProgressoValidacao(0);
    setEtapaValidacao(0);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const progressoWizard =
    step === "validando" || step === "concluido"
      ? 100
      : Math.max(stepIndex, 0) >= 0
        ? Math.round(((stepIndex + 1) / STEPS.length) * 100)
        : 0;

  const stepAtualMeta =
    step === "validando"
      ? { label: "Validação segura", desc: "Verificando seu certificado digital" }
      : step === "concluido"
        ? { label: "Concluído", desc: "Certificado cadastrado com sucesso" }
        : STEPS.find((s) => s.key === step) ?? STEPS[0];

  const executarValidacao = async () => {
    if (!arquivo) return;
    setStep("validando");
    setErro(null);
    setProgressoValidacao(8);
    setEtapaValidacao(0);

    const tick = window.setInterval(() => {
      setProgressoValidacao((p) => Math.min(p + 4, 88));
      setEtapaValidacao((e) => Math.min(e + 1, VALIDACAO_ETAPAS.length - 1));
    }, 700);

    try {
      const result = await uploadCertificadoDigital(clienteId, arquivo, senha);
      window.clearInterval(tick);

      if (!result.ok || !result.certificado) {
        setProgressoValidacao(0);
        setEtapaValidacao(0);
        setStep("senha");
        const msg = result.error || "Falha na validação do certificado";
        setErro(msg);
        toast.error(msg);
        return;
      }

      setProgressoValidacao(100);
      setEtapaValidacao(VALIDACAO_ETAPAS.length - 1);
      setValidadeMsg(formatCertValidade(result.certificado));
      setStep("concluido");
      onConcluido(result.certificado);
      window.setTimeout(() => onOpenChange(false), 2200);
    } catch (e) {
      window.clearInterval(tick);
      setStep("senha");
      const msg = e instanceof Error ? e.message : "Erro ao validar certificado";
      setErro(msg);
      toast.error(msg);
    }
  };

  const podeAvancar =
    (step === "seguranca") ||
    (step === "arquivo" && !!arquivo) ||
    (step === "senha" && senha.length >= 4 && !!arquivo);

  const avancar = () => {
    if (step === "seguranca") setStep("arquivo");
    else if (step === "arquivo") setStep("senha");
    else if (step === "senha") void executarValidacao();
  };

  const voltar = () => {
    if (step === "arquivo") setStep("seguranca");
    else if (step === "senha") setStep("arquivo");
    else onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] p-0 gap-0 overflow-hidden sm:max-w-5xl">
        <DialogTitle className="sr-only">Validar certificado digital e-CNPJ</DialogTitle>
        <DialogDescription className="sr-only">
          Wizard seguro para envio e validação do certificado digital A1.
        </DialogDescription>

        <div className="grid min-h-[min(560px,85dvh)] md:grid-cols-[300px_minmax(0,1fr)]">
          {/* Sidebar — steps + segurança visual */}
          <aside
            className="relative hidden flex-col overflow-hidden bg-slate-900 text-white md:flex"
            style={{
              backgroundImage: `linear-gradient(165deg, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.78) 45%, rgba(30,58,138,0.55) 100%), url(${wizardBg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="relative z-10 flex flex-1 flex-col p-6">
              <div className="mb-6">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 ring-2 ring-emerald-400/40">
                  <ShieldCheck className="h-7 w-7 text-emerald-300" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300/90">
                  Ambiente seguro
                </p>
                <h2 className="mt-1 text-lg font-bold leading-tight">
                  Validação de certificado digital
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-white/70">
                  Conexão criptografada · dados protegidos · uso exclusivo no Compras.gov.br
                </p>
              </div>

              <div className="mb-4 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-white/60">
                  <span>Progresso</span>
                  <span>{progressoWizard}%</span>
                </div>
                <Progress value={progressoWizard} className="h-1.5 bg-white/15 [&>div]:bg-emerald-400" />
              </div>

              <nav className="space-y-2">
                {STEPS.map((s, i) => {
                  const Icon = s.icon;
                  const done =
                    step === "validando" ||
                    step === "concluido" ||
                    stepIndex > i;
                  const active = s.key === step;
                  return (
                    <div
                      key={s.key}
                      className={cn(
                        "flex items-start gap-3 rounded-xl px-3 py-2.5 transition",
                        active && "bg-white/10 ring-1 ring-white/20",
                        done && !active && "opacity-80",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          done ? "bg-emerald-500 text-white" : active ? "bg-white text-slate-900" : "bg-white/10",
                        )}
                      >
                        {done && !active ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-xs font-semibold">{s.label}</p>
                        <p className="truncate text-[10px] text-white/55">{s.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </nav>

              <div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-emerald-300">
                  <Lock className="h-4 w-4 shrink-0" />
                  <p className="text-[11px] font-semibold">Super seguro</p>
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-white/65">
                  A senha do certificado é usada apenas na validação e nunca é exibida ou compartilhada.
                </p>
              </div>
            </div>
          </aside>

          {/* Conteúdo principal */}
          <div className="flex min-h-0 flex-col bg-background">
            <div className="border-b px-5 py-4 sm:px-6 md:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{stepAtualMeta.label}</p>
                  <Progress value={progressoWizard} className="mt-2 h-1" />
                </div>
              </div>
            </div>

            <div className="border-b px-6 py-4 hidden md:block">
              <p className="text-xs text-muted-foreground">
                {step === "validando" || step === "concluido"
                  ? "Processo finalizado"
                  : `Etapa ${stepIndex + 1} de ${STEPS.length}`}
              </p>
              <p className="text-lg font-semibold">{stepAtualMeta.label}</p>
              <p className="text-sm text-muted-foreground">{stepAtualMeta.desc}</p>
            </div>

            <ScrollArea className="flex-1 max-h-[min(420px,55dvh)]">
              <div className="px-5 py-6 sm:px-6">
                {step === "seguranca" && (
                  <div className="space-y-6">
                    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-background to-primary/5 p-6 sm:p-8">
                      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-emerald-500/10 blur-2xl" />
                      <div className="relative flex flex-col items-center text-center sm:flex-row sm:text-left sm:items-start gap-6">
                        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-500/25">
                          <Shield className="h-12 w-12" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-xl font-bold tracking-tight">
                            Você está validando um certificado digital
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
                            Este processo é <strong className="text-foreground">super seguro</strong>.
                            Utilizamos criptografia de ponta a ponta para verificar seu e-CNPJ A1 antes
                            de liberar o Assistente no Compras.gov.br.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        {
                          icon: Lock,
                          title: "Criptografia TLS",
                          desc: "Transferência protegida do arquivo .pfx",
                        },
                        {
                          icon: ShieldCheck,
                          title: "Validação ICP-Brasil",
                          desc: "Conferimos cadeia e validade do certificado",
                        },
                        {
                          icon: Server,
                          title: "Uso restrito",
                          desc: "Somente para automação no portal oficial",
                        },
                      ].map((item) => (
                        <div
                          key={item.title}
                          className="rounded-xl border bg-card/80 p-4"
                        >
                          <item.icon className="h-5 w-5 text-emerald-600 mb-2" />
                          <p className="text-sm font-semibold">{item.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                        </div>
                      ))}
                    </div>

                    <p className="text-xs text-muted-foreground text-center sm:text-left">
                      O certificado é <strong>opcional</strong> — o cadastro SICAF continua sem ele.
                    </p>
                  </div>
                )}

                {step === "arquivo" && (
                  <div className="space-y-5 max-w-xl">
                    <p className="text-sm text-muted-foreground">
                      Selecione o arquivo do certificado e-CNPJ A1 exportado em formato{" "}
                      <strong className="text-foreground">.pfx</strong> ou{" "}
                      <strong className="text-foreground">.p12</strong>.
                    </p>
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-primary/30 bg-muted/20 px-6 py-12 text-center transition hover:border-primary/60 hover:bg-primary/5">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Upload className="h-8 w-8" />
                      </div>
                      <div>
                        <p className="text-base font-semibold">
                          {arquivo ? arquivo.name : "Arraste ou clique para selecionar"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {arquivo
                            ? `${(arquivo.size / 1024).toFixed(1)} KB · pronto para validação`
                            : "Apenas arquivos .pfx ou .p12"}
                        </p>
                      </div>
                      <input
                        type="file"
                        accept=".pfx,.p12"
                        className="hidden"
                        onChange={(e) => {
                          setArquivo(e.target.files?.[0] ?? null);
                          setErro(null);
                        }}
                      />
                    </label>
                  </div>
                )}

                {step === "senha" && (
                  <div className="space-y-5 max-w-md">
                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 flex gap-3">
                      <Lock className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        A senha é necessária para abrir o certificado A1. Ela{" "}
                        <strong className="text-foreground">não fica visível</strong> após a validação e
                        é tratada com o mesmo nível de segurança dos dados bancários.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cert-wizard-senha">Senha do certificado e-CNPJ</Label>
                      <div className="relative">
                        <Input
                          id="cert-wizard-senha"
                          type={mostrarSenha ? "text" : "password"}
                          value={senha}
                          onChange={(e) => {
                            setSenha(e.target.value);
                            setErro(null);
                          }}
                          placeholder="Digite a senha do arquivo .pfx"
                          className="pr-10"
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setMostrarSenha((v) => !v)}
                          aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Mínimo de 4 caracteres</p>
                    </div>
                    {arquivo && (
                      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                        <FileKey2 className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate font-medium">{arquivo.name}</span>
                      </div>
                    )}
                    {erro && (
                      <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                        {erro}
                      </p>
                    )}
                  </div>
                )}

                {step === "validando" && (
                  <div className="flex flex-col items-center py-6 sm:py-10 max-w-md mx-auto text-center">
                    <div className="relative mb-6">
                      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/10 ring-4 ring-emerald-500/20">
                        <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
                      </div>
                      <ShieldCheck className="absolute -bottom-1 -right-1 h-8 w-8 text-emerald-600 bg-background rounded-full p-1" />
                    </div>
                    <h3 className="text-lg font-bold">Validando certificado digital…</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Aguarde — estamos verificando seu e-CNPJ de forma segura.
                    </p>
                    <div className="mt-6 w-full space-y-2">
                      <Progress value={progressoValidacao} className="h-2" />
                      <p className="text-xs text-muted-foreground">{progressoValidacao}% concluído</p>
                    </div>
                    <ul className="mt-6 w-full space-y-2 text-left">
                      {VALIDACAO_ETAPAS.map((e, i) => {
                        const Icon = e.icon;
                        const done = i < etapaValidacao;
                        const active = i === etapaValidacao;
                        return (
                          <li
                            key={e.label}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition",
                              active && "border-emerald-500/40 bg-emerald-500/5",
                              done && "opacity-70",
                            )}
                          >
                            {done ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            ) : active ? (
                              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-600" />
                            ) : (
                              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className={active ? "font-medium" : ""}>{e.label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {step === "concluido" && (
                  <div className="flex flex-col items-center py-10 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 ring-4 ring-emerald-500/20 mb-4">
                      <CheckCircle2 className="h-10 w-10" />
                    </div>
                    <h3 className="text-xl font-bold">Certificado validado com sucesso!</h3>
                    {validadeMsg && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Válido até <strong className="text-foreground">{validadeMsg}</strong>
                      </p>
                    )}
                    <p className="mt-4 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                      Armazenado com segurança · Assistente pronto para uso
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {step !== "validando" && step !== "concluido" && (
              <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-5 py-3 sm:px-6">
                <Button variant="ghost" onClick={voltar}>
                  {step === "seguranca" ? "Cancelar" : "Voltar"}
                </Button>
                <Button
                  onClick={avancar}
                  disabled={!podeAvancar}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                >
                  {step === "senha" ? (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      Validar com segurança
                    </>
                  ) : (
                    <>
                      Continuar
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
