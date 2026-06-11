import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { apiFetch, fetchClientByDocumento } from "@/lib/api-fetch";
import {
  CADBRASIL_EXTENSION_STORE_URL,
  useCadBrasilExtension,
} from "@/hooks/use-cadbrasil-extension";
import {
  probeCadBrasilExtension,
  waitForCadBrasilExtension,
} from "@/lib/cadbrasil-extension";
import { toast } from "sonner";

type LaunchPhase =
  | "connecting"
  | "no_extension"
  | "launching"
  | "done"
  | "error";

type ConnectStep = "server" | "assistant" | "database";

const CONNECT_STEPS: { id: ConnectStep; label: string }[] = [
  { id: "server", label: "Conectando ao servidor..." },
  { id: "assistant", label: "Conectando ao Assistente..." },
  { id: "database", label: "Acessando banco de dados..." },
];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cnpj?: string;
  empresaNome?: string;
};

export function AssistenteSicafLaunchDialog({
  open,
  onOpenChange,
  cnpj,
  empresaNome,
}: Props) {
  const { openSICAF } = useCadBrasilExtension();
  const [phase, setPhase] = useState<LaunchPhase>("connecting");
  const [activeStep, setActiveStep] = useState<ConnectStep>("server");
  const [completedSteps, setCompletedSteps] = useState<ConnectStep[]>([]);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [pollingExtension, setPollingExtension] = useState(false);
  const [verifyingExtension, setVerifyingExtension] = useState(false);
  const runIdRef = useRef(0);
  const manualVerifyRef = useRef(false);
  const cnpjRef = useRef(cnpj);
  const onOpenChangeRef = useRef(onOpenChange);
  const openSicafRef = useRef(openSICAF);

  cnpjRef.current = cnpj;
  onOpenChangeRef.current = onOpenChange;
  openSicafRef.current = openSICAF;

  const empresaLabel = empresaNome || (cnpj ? `CNPJ ${cnpj}` : "sua empresa");

  const launchSicaf = useCallback(async () => {
    setPhase("launching");
    setProgress(85);

    const ok = await openSicafRef.current();

    if (ok) {
      setPhase("done");
      setProgress(100);
      toast.success("SICAF aberto com a extensão CadBrasil!");
      await delay(1400);
      onOpenChangeRef.current(false);
    } else {
      window.open("https://www3.comprasnet.gov.br/sicaf-web/index.jsf", "_blank");
      onOpenChangeRef.current(false);
    }
  }, []);

  const handleVerifyExtension = useCallback(async () => {
    manualVerifyRef.current = true;
    setVerifyingExtension(true);
    setPollingExtension(false);

    try {
      probeCadBrasilExtension();
      const result = await waitForCadBrasilExtension(10000);

      if (result.installed) {
        toast.success("Extensão CadBrasil detectada!");
        await launchSicaf();
      } else {
        toast.info("Extensão ainda não detectada", {
          description: "Confirme a instalação no Chrome e tente novamente.",
        });
      }
    } finally {
      setVerifyingExtension(false);
      manualVerifyRef.current = false;
    }
  }, [launchSicaf]);

  useEffect(() => {
    if (!open) {
      runIdRef.current += 1;
      return;
    }

    const runId = ++runIdRef.current;
    const isStale = () => runIdRef.current !== runId;

    setPhase("connecting");
    setActiveStep("server");
    setCompletedSteps([]);
    setProgress(8);
    setErrorMessage("");
    setPollingExtension(false);
    setVerifyingExtension(false);

    (async () => {
      try {
        setActiveStep("server");
        await Promise.all([
          apiFetch("/api/v1/health", { auth: false }).catch(() => null),
          delay(700),
        ]);
        if (isStale()) return;
        setCompletedSteps(["server"]);
        setProgress(34);

        setActiveStep("assistant");
        await Promise.all([
          apiFetch("/api/sicaf-assistant/status").catch(() => null),
          delay(800),
        ]);
        if (isStale()) return;
        setCompletedSteps(["server", "assistant"]);
        setProgress(68);

        setActiveStep("database");
        const doc = cnpjRef.current;
        if (doc) {
          await Promise.all([fetchClientByDocumento(doc), delay(700)]);
        } else {
          await delay(700);
        }
        if (isStale()) return;
        setCompletedSteps(["server", "assistant", "database"]);
        setProgress(100);

        setVerifyingExtension(true);
        probeCadBrasilExtension();
        const extensionResult = await waitForCadBrasilExtension(5000);
        setVerifyingExtension(false);
        if (isStale()) return;

        if (!extensionResult.installed) {
          setPhase("no_extension");
          return;
        }

        await launchSicaf();
      } catch {
        if (!isStale()) {
          setPhase("error");
          setErrorMessage("Não foi possível conectar ao Assistente. Tente novamente.");
        }
      }
    })();
  }, [open, launchSicaf]);

  useEffect(() => {
    if (!open || phase !== "no_extension") {
      setPollingExtension(false);
      return;
    }

    setPollingExtension(true);
    let cancelled = false;

    const poll = async () => {
      while (!cancelled) {
        if (manualVerifyRef.current) {
          await delay(300);
          continue;
        }
        probeCadBrasilExtension();
        const result = await waitForCadBrasilExtension(3000);
        if (cancelled || manualVerifyRef.current) continue;
        if (result.installed) {
          setPollingExtension(false);
          toast.success("Extensão CadBrasil detectada!");
          await launchSicaf();
          return;
        }
        await delay(1500);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      setPollingExtension(false);
    };
  }, [open, phase, launchSicaf]); // launchSicaf is stable (empty deps)

  const canClose =
    phase === "no_extension" || phase === "done" || phase === "error";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !canClose && phase === "connecting") return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Assistente SICAF</DialogTitle>

        {phase === "no_extension" ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-orange-500/10">
              <AlertTriangle className="h-10 w-10 text-orange-500" />
            </div>

            <h3 className="text-xl font-bold">Extensão não detectada</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Para acessar o SICAF com o Assistente Digital IA, é necessário instalar a
              extensão CadBrasil no seu navegador Google Chrome.
            </p>

            {(pollingExtension || verifyingExtension) && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                {verifyingExtension
                  ? "Verificando extensão CadBrasil..."
                  : "Aguardando instalação da extensão..."}
              </div>
            )}

            <div className="mt-6 w-full space-y-3 text-left">
              <div className="rounded-xl bg-muted/30 p-4">
                <p className="text-sm font-semibold">Como instalar:</p>
                <div className="mt-3 space-y-2.5">
                  {[
                    "Clique no botão abaixo para acessar a Chrome Web Store",
                    'Clique em "Usar no Chrome" para instalar',
                    'Após instalar, clique em "Já instalei — verificar" (não precisa atualizar a página)',
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {i + 1}
                      </div>
                      <p className="text-sm text-muted-foreground">{text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-amber-600">Importante:</span> A extensão
                  funciona apenas no navegador{" "}
                  <span className="font-semibold">Google Chrome</span>. Certifique-se de estar
                  usando o Chrome para instalar.
                </p>
              </div>
            </div>

            <div className="mt-6 w-full space-y-2">
              <Button
                className="w-full gap-2"
                onClick={() => window.open(CADBRASIL_EXTENSION_STORE_URL, "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
                Instalar Extensão CadBrasil
              </Button>
              <Button
                className="w-full gap-2"
                variant="secondary"
                disabled={verifyingExtension}
                onClick={() => void handleVerifyExtension()}
              >
                {verifyingExtension ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Já instalei — verificar
              </Button>
              <Button className="w-full" variant="ghost" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-6 text-center">
            <div
              className={cn(
                "mb-4 flex h-20 w-20 items-center justify-center rounded-2xl",
                phase === "error" && "bg-danger/10",
                phase === "done" && "bg-success/10",
                (phase === "connecting" || phase === "launching") && "bg-primary/10",
              )}
            >
              {phase === "error" ? (
                <AlertTriangle className="h-10 w-10 text-danger" />
              ) : phase === "done" ? (
                <CheckCircle2 className="h-10 w-10 text-success" />
              ) : (
                <Bot className="h-10 w-10 animate-pulse text-primary" />
              )}
            </div>

            <h3 className="text-xl font-bold">
              {phase === "connecting" && verifyingExtension
                ? "Verificando extensão CadBrasil..."
                : phase === "connecting"
                  ? "Conectando ao servidor..."
                  : phase === "launching"
                    ? "Abrindo Assistente Digital SICAF"
                    : phase === "done"
                      ? "Assistente SICAF ativo!"
                      : "Erro ao iniciar"}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {phase === "error"
                ? errorMessage
                : phase === "done"
                  ? `O Assistente Digital está pronto para acompanhar o cadastro SICAF de ${empresaLabel}.`
                  : `Iniciando o Assistente Digital com IA para gestão do SICAF de ${empresaLabel}.`}
            </p>

            {(phase === "connecting" || phase === "launching") && (
              <div className="mt-6 w-full space-y-4">
                <Progress value={progress} className="h-2" />
                <div className="space-y-2 rounded-lg bg-muted/30 p-4 text-left">
                  {CONNECT_STEPS.map((step) => {
                    const done = completedSteps.includes(step.id);
                    const active = activeStep === step.id && !done;
                    return (
                      <div key={step.id} className="flex items-center gap-3 text-sm">
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                        ) : active ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                        ) : (
                          <div className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />
                        )}
                        <span
                          className={cn(
                            active ? "font-medium text-foreground" : "text-muted-foreground",
                            done && "text-muted-foreground",
                          )}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                  {verifyingExtension && (
                    <div className="flex items-center gap-3 border-t pt-2 text-sm">
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                      <span className="font-medium text-foreground">
                        Verificando extensão CadBrasil...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {phase === "error" && (
              <Button className="mt-6 w-full" variant="destructive" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
