import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Building2,
  Loader2,
  FileCheck2,
  Award,
  Gauge,
  KeyRound,
  AlertCircle,
  Clock,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  fetchOnboardingDiagnostico,
  type OnboardingCheck,
} from "@/lib/onboarding-api";

const AUTH_PORTAL_URL = "https://fornecedor.cadbrasil.com.br/auth";
const STEP_ENTER =
  "animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Assistente SICAF — CADBRASIL Oficial" },
      {
        name: "description",
        content:
          "Atualize e regularize seu SICAF com o Assistente CADBRASIL Oficial: rápido, guiado e seguro.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
});

// Cores institucionais Brasil
const VERDE = "#009C3B";
const AMARELO = "#FFDF00";
const AZUL = "#002776";

type StepId = "boas-vindas" | "identificacao" | "diagnostico";

function OnboardingPage() {
  const [step, setStep] = useState<StepId>("boas-vindas");
  const [protocolo, setProtocolo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [validando, setValidando] = useState(false);
  const [diagnostico, setDiagnostico] = useState<{
    protocolo: string;
    empresa?: string;
    checks: OnboardingCheck[];
  } | null>(null);

  const STEPS: StepId[] = ["boas-vindas", "identificacao", "diagnostico"];
  const stepIndex = STEPS.indexOf(step);

  function maskProtocolo(v: string) {
    return v.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
  }

  async function iniciarDiagnostico() {
    setErro(null);
    const p = protocolo.trim();
    if (p.length < 6) {
      setErro("Informe o protocolo enviado pela CADBRASIL (mínimo 6 caracteres).");
      return;
    }

    setValidando(true);
    try {
      const res = await fetchOnboardingDiagnostico(p);
      if (!res.ok || !res.checks?.length) {
        setErro(res.error || "Protocolo não encontrado. Verifique o e-mail enviado pela CADBRASIL.");
        return;
      }
      setDiagnostico({
        protocolo: res.protocolo || p.toUpperCase(),
        empresa: res.empresa?.razao,
        checks: res.checks,
      });
      setStep("diagnostico");
    } catch {
      setErro("Não foi possível validar o protocolo agora. Tente novamente em instantes.");
    } finally {
      setValidando(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Faixa Brasil no topo */}
      <div className="absolute inset-x-0 top-0 h-1.5 flex">
        <div className="flex-1" style={{ background: VERDE }} />
        <div className="flex-1" style={{ background: AMARELO }} />
        <div className="flex-1" style={{ background: AZUL }} />
      </div>

      {/* Ambient */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-24 top-1/4 h-96 w-96 rounded-full blur-3xl opacity-20"
          style={{ background: VERDE }}
        />
        <div
          className="absolute -right-24 bottom-0 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-20"
          style={{ background: AZUL }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:px-6 lg:py-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg"
              style={{ background: AZUL }}
            >
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight">CADBRASIL Oficial</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Assistente SICAF
              </p>
            </div>
          </div>
          {stepIndex > 0 && stepIndex < STEPS.length - 1 && (
            <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur sm:flex">
              Etapa {stepIndex + 1} de {STEPS.length}
            </div>
          )}
        </div>

        {/* Progresso */}
        {stepIndex > 0 && (
          <div className="mx-auto mt-8 w-full max-w-2xl">
            <div className="h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className="h-full transition-all duration-500 ease-out"
                style={{
                  width: `${(stepIndex / (STEPS.length - 1)) * 100}%`,
                  background: `linear-gradient(90deg, ${VERDE}, ${AZUL})`,
                }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-1 items-center justify-center py-10">
          {step === "boas-vindas" && (
            <StepBoasVindas key="s1" onNext={() => setStep("identificacao")} />
          )}
          {step === "identificacao" && (
            <StepIdentificacao
              key="s2"
              protocolo={protocolo}
              erro={erro}
              validando={validando}
              onProtocolo={(v) => setProtocolo(maskProtocolo(v))}
              onBack={() => setStep("boas-vindas")}
              onNext={iniciarDiagnostico}
            />
          )}
          {step === "diagnostico" && diagnostico && (
            <StepDiagnostico
              key="s3"
              protocolo={diagnostico.protocolo}
              empresa={diagnostico.empresa}
              checks={diagnostico.checks}
            />
          )}
        </div>

        <p className="pt-4 text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} CADBRASIL Oficial · Assistente SICAF
        </p>
      </div>
    </div>
  );
}

/* ---------------- Etapa 1 ---------------- */
function StepBoasVindas({ onNext }: { onNext: () => void }) {
  return (
    <div className={cn("w-full max-w-2xl text-center", STEP_ENTER)}>
      <div
        className="mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-3xl text-white shadow-2xl animate-in zoom-in-95 duration-500 fill-mode-both"
        style={{ background: `linear-gradient(135deg, ${VERDE}, ${AZUL})` }}
      >
        <ShieldCheck className="h-10 w-10" />
      </div>

      <div
        className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider"
        style={{ borderColor: `${AMARELO}80`, background: `${AMARELO}20`, color: AZUL }}
      >
        <Sparkles className="h-3 w-3" /> Assistente Inteligente
      </div>

      <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
        Bem-vindo à <span style={{ color: AZUL }}>CADBRASIL</span>{" "}
        <span style={{ color: VERDE }}>Oficial</span>
      </h1>
      <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
        Vamos atualizar o seu <strong>SICAF</strong> de forma simples, guiada e segura.
        Nosso Assistente cuidará de cada etapa com você.
      </p>

      <div className="mt-8">
        <Button
          size="lg"
          onClick={onNext}
          className="h-14 gap-2 px-8 text-base font-semibold text-white shadow-xl transition-transform hover:scale-105"
          style={{ background: VERDE }}
        >
          Iniciar Atualização SICAF <ArrowRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="mt-10 grid grid-cols-3 gap-3">
        {[
          { icon: ShieldCheck, label: "100% Seguro" },
          { icon: Gauge, label: "Análise rápida" },
          { icon: Award, label: "Especialistas" },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="rounded-2xl border border-border/60 bg-background/70 p-4 backdrop-blur"
          >
            <Icon className="mx-auto h-5 w-5" style={{ color: AZUL }} />
            <p className="mt-2 text-xs font-medium">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Etapa 2 ---------------- */
function StepIdentificacao({
  protocolo,
  erro,
  validando,
  onProtocolo,
  onBack,
  onNext,
}: {
  protocolo: string;
  erro: string | null;
  validando: boolean;
  onProtocolo: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="w-full max-w-2xl animate-in fade-in slide-in-from-right-4 duration-300 fill-mode-both">
      <div className="mb-6 text-center">
        <div
          className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg"
          style={{ background: AZUL }}
        >
          <KeyRound className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Informe seu protocolo</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Use o número de protocolo enviado pela CADBRASIL no seu e-mail.
        </p>
      </div>

      <Card className="border-border/60 bg-background/80 p-6 shadow-2xl backdrop-blur sm:p-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onNext();
          }}
          className="space-y-5"
        >
          <Field label="Protocolo CADBRASIL" icon={<KeyRound className="h-4 w-4" />}>
            <Input
              autoFocus
              value={protocolo}
              onChange={(e) => onProtocolo(e.target.value)}
              placeholder="Ex: SICAF-V6BWFMW2-7694"
              className="h-14 text-center font-mono text-lg tracking-widest uppercase"
            />
          </Field>
          <p className="text-center text-xs text-muted-foreground">
            Não encontrou o protocolo? Verifique o e-mail enviado pela CADBRASIL Oficial.
          </p>

          {erro && (
            <p className="rounded-lg bg-destructive/10 p-2 text-center text-xs text-destructive">
              {erro}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onBack} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={validando}
              className="h-12 gap-2 px-6 text-white"
              style={{ background: VERDE }}
            >
              {validando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Validando...
                </>
              ) : (
                <>
                  Validar protocolo <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        🔒 Seus dados são tratados conforme a LGPD e usados apenas para o processo SICAF.
      </p>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span style={{ color: AZUL }}>{icon}</span>
        {label}
      </label>
      {children}
    </div>
  );
}

/* ---------------- Etapa 3 - Progresso ---------------- */
const CHECK_ICONS = {
  "Validar protocolo": KeyRound,
  Documentos: FileCheck2,
  "Conectar ao ComprasNet": Link2,
  "Atualizar Nível III Receita Federal": Building2,
  "Validação de Taxa": Gauge,
} as const;

function StepDiagnostico({
  protocolo,
  empresa,
  checks,
}: {
  protocolo: string;
  empresa?: string;
  checks: OnboardingCheck[];
}) {
  const [done, setDone] = useState<number>(0);

  useEffect(() => {
    setDone(0);
  }, [protocolo, checks]);

  useEffect(() => {
    if (done >= checks.length) return;
    const t = setTimeout(() => setDone((d) => d + 1), 550);
    return () => clearTimeout(t);
  }, [done, checks.length]);

  const progresso = Math.min(100, Math.round((done / checks.length) * 100));
  const okCount = checks.filter((c) => c.status === "ok").length;
  const pendCount = checks.filter((c) => c.status === "pendente").length;

  return (
    <div className={cn("w-full max-w-2xl", STEP_ENTER)}>
      <div className="mb-6 text-center">
        <div
          className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, ${AZUL}, ${VERDE})` }}
        >
          {done < checks.length ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <CheckCircle2 className="h-7 w-7" />
          )}
        </div>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {done < checks.length ? "Verificando seu cadastro..." : "Diagnóstico inicial concluído"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {empresa ? (
            <>
              Cadastro localizado para <strong>{empresa}</strong> · protocolo{" "}
              <span className="font-mono">{protocolo}</span>
            </>
          ) : (
            <>
              Protocolo <span className="font-mono">{protocolo}</span> confirmado. Identificamos o que
              já está pronto e o que ainda precisa ser preparado.
            </>
          )}
        </p>
      </div>

      <Card className="border-border/60 bg-background/80 p-6 shadow-2xl backdrop-blur sm:p-7">
        <div className="mb-5 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Progresso
          </span>
          <span className="text-sm font-bold" style={{ color: AZUL }}>
            {progresso}%
          </span>
        </div>
        <div className="mb-6 h-2 rounded-full bg-border overflow-hidden">
          <div
            className="h-full transition-all duration-300 ease-out"
            style={{
              width: `${progresso}%`,
              background: `linear-gradient(90deg, ${VERDE}, ${AZUL})`,
            }}
          />
        </div>

        <ul className="space-y-2">
          {checks.map((c, i) => {
            const feito = i < done;
            const atual = i === done;
            const Icon = CHECK_ICONS[c.label as keyof typeof CHECK_ICONS] || FileCheck2;
            const isOk = c.status === "ok";
            return (
              <li
                key={c.label}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 transition-all duration-300",
                  feito || atual ? "opacity-100" : "opacity-40",
                  feito && isOk && "border-emerald-500/30 bg-emerald-500/5",
                  feito && !isOk && "border-amber-500/40 bg-amber-500/5",
                  atual && "border-blue-500/40 bg-blue-500/5",
                  !feito && !atual && "border-border bg-muted/20",
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    feito ? "text-white" : "bg-muted text-muted-foreground",
                  )}
                  style={
                    feito
                      ? { background: isOk ? VERDE : "#F59E0B" }
                      : atual
                        ? { background: `${AZUL}20`, color: AZUL }
                        : undefined
                  }
                >
                  {feito ? (
                    isOk ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />
                  ) : atual ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{c.detail}</p>
                </div>
                <span
                  className="text-xs font-semibold"
                  style={{ color: isOk ? VERDE : "#B45309" }}
                >
                  {c.statusLabel}
                </span>
              </li>
            );
          })}
        </ul>

        {done >= checks.length && (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div
                className="rounded-xl border p-3 text-center"
                style={{ borderColor: `${VERDE}40`, background: `${VERDE}10` }}
              >
                <CheckCircle2 className="mx-auto h-4 w-4" style={{ color: VERDE }} />
                <p className="mt-1 text-lg font-bold" style={{ color: VERDE }}>
                  {okCount}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Prontos
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center">
                <AlertCircle className="mx-auto h-4 w-4 text-amber-600" />
                <p className="mt-1 text-lg font-bold text-amber-700">{pendCount}</p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  A preparar
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border p-4 text-center" style={{ borderColor: `${AZUL}30`, background: `${AZUL}08` }}>
              <p className="text-sm text-muted-foreground">
                Entre no portal CADBRASIL para enviar suas certidões e concluir a atualização SICAF com
                o Assistente oficial.
              </p>
              <Button
                size="lg"
                asChild
                className="mt-4 h-12 gap-2 px-6 text-base font-semibold text-white shadow-lg transition-transform hover:scale-105"
                style={{ background: AZUL }}
              >
                <a href={AUTH_PORTAL_URL}>Enviar Certidões SICAF</a>
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
