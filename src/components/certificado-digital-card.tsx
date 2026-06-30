import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Bot, CheckCircle2, KeyRound, Loader2, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CertificadoUploadWizard } from "@/components/certificado-upload-wizard";
import {
  certificadoEstaValido,
  fetchCertificadoDigital,
  formatCertValidade,
  type CertificadoDigitalInfo,
} from "@/lib/certificado-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type CertificadoDigitalCardProps = {
  clienteId: number;
  cnpj?: string;
  compact?: boolean;
  /** Layout compacto na sidebar (certificado já validado). */
  variant?: "default" | "sidebar";
  onUpdated?: (cert: CertificadoDigitalInfo | null) => void;
  assistenteDisponivel?: boolean;
  onAssistenteBloqueado?: () => void;
};

function BotaoAssistente({
  cnpj,
  assistenteDisponivel,
  onAssistenteBloqueado,
  size = "lg",
  className,
}: {
  cnpj?: string;
  assistenteDisponivel: boolean;
  onAssistenteBloqueado?: () => void;
  size?: "sm" | "lg";
  className?: string;
}) {
  if (!cnpj) return null;

  const btnClass =
    size === "sm"
      ? "gap-1.5 w-full text-xs font-semibold"
      : "gap-2 px-5 font-semibold shadow-md transition hover:shadow-lg";

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          {assistenteDisponivel ? (
            <Button
              asChild
              size={size}
              className={cn(
                size === "sm"
                  ? "w-full bg-success text-success-foreground hover:bg-success/90"
                  : "bg-success text-success-foreground hover:bg-success/90",
                btnClass,
                className,
              )}
            >
              <Link to="/assistente" search={{ cnpj }}>
                <Bot className={size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5"} />
                Ir ao Assistente
                <ArrowRight className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
              </Link>
            </Button>
          ) : (
            <Button
              size={size}
              className={cn(
                size === "sm"
                  ? "w-full bg-muted text-muted-foreground"
                  : "bg-muted px-5 font-semibold text-muted-foreground shadow-sm",
                btnClass,
                className,
              )}
              onClick={() => onAssistenteBloqueado?.()}
            >
              <Bot className={size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5"} />
              Ir ao Assistente
              <ArrowRight className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
            </Button>
          )}
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          sideOffset={8}
          className="max-w-[260px] border border-success/25 bg-card p-0 text-foreground shadow-xl"
        >
          <div className="rounded-md p-3">
            <p className="text-sm font-semibold text-success">Atualize seu SICAF aqui</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {assistenteDisponivel
                ? "Envie a Situação do Fornecedor e sincronize os níveis automaticamente."
                : "Confirme o pagamento da taxa CADBRASIL (Etapa 1) para liberar o Assistente."}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function CertificadoDigitalCard({
  clienteId,
  cnpj,
  compact = false,
  variant = "default",
  onUpdated,
  assistenteDisponivel = true,
  onAssistenteBloqueado,
}: CertificadoDigitalCardProps) {
  const [certificado, setCertificado] = useState<CertificadoDigitalInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const recarregar = async () => {
    setLoading(true);
    const res = await fetchCertificadoDigital(clienteId);
    setLoading(false);
    const cert = res.certificado ?? null;
    setCertificado(cert);
    onUpdated?.(cert);
  };

  useEffect(() => {
    void recarregar();
  }, [clienteId]);

  const valido = certificadoEstaValido(certificado);
  const validade = formatCertValidade(certificado);

  const wizard = (
    <CertificadoUploadWizard
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      clienteId={clienteId}
      onConcluido={(cert) => {
        setCertificado(cert);
        onUpdated?.(cert);
        toast.success("Certificado digital validado e cadastrado.");
      }}
    />
  );

  if (variant === "sidebar") {
    if (loading) {
      return (
        <Card className="shadow-soft border-success/20">
          <CardContent className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verificando certificado…
          </CardContent>
        </Card>
      );
    }

    const expirado = certificado?.status === "expirado";

    if (valido) {
      return (
        <>
          <Card className="shadow-soft border-success/35 bg-gradient-to-br from-success/10 to-success/5">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/20 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">Certificado validado</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                    e-CNPJ cadastrado
                    {validade ? (
                      <>
                        {" "}
                        · válido até <span className="font-medium text-foreground">{validade}</span>
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5 text-xs"
                  onClick={() => setDialogOpen(true)}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Atualizar
                </Button>
                <BotaoAssistente
                  cnpj={cnpj}
                  assistenteDisponivel={assistenteDisponivel}
                  onAssistenteBloqueado={onAssistenteBloqueado}
                  size="sm"
                />
              </div>
            </CardContent>
          </Card>
          {wizard}
        </>
      );
    }

    return (
      <>
        <Card
          className={cn(
            "shadow-soft",
            expirado
              ? "border-destructive/30 bg-gradient-to-br from-destructive/10 to-destructive/5"
              : "border-primary/20 bg-gradient-to-br from-muted/40 to-muted/10",
          )}
        >
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  expirado ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary",
                )}
              >
                <KeyRound className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">Certificado digital</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                  {expirado
                    ? "Expirado — envie um novo para o Assistente"
                    : "Opcional · ainda não conectado"}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant={expirado ? "destructive" : "default"}
              className="w-full gap-1.5 text-xs"
              onClick={() => setDialogOpen(true)}
            >
              <Upload className="h-3.5 w-3.5" />
              {expirado ? "Renovar certificado" : "Enviar certificado"}
            </Button>
          </CardContent>
        </Card>
        {wizard}
      </>
    );
  }

  return (
    <>
      <Card className="border-dashed border-muted-foreground/25 bg-muted/10">
        <CardContent className={compact ? "p-4" : "p-5"}>
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-sm">Certificado digital (opcional)</p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Não obrigatório
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Algumas empresas não podem disponibilizar e-CNPJ. O cadastro SICAF segue normalmente
                sem ele. O certificado só é necessário para o Assistente acessar o Compras.gov.br
                de forma automática.
              </p>
              {loading ? (
                <p className="mt-2 text-xs text-muted-foreground inline-flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Verificando…
                </p>
              ) : valido ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Certificado cadastrado
                  {validade ? ` · válido até ${validade}` : ""}
                </p>
              ) : certificado?.status === "expirado" ? (
                <p className="mt-2 text-xs text-destructive">
                  Certificado expirado — envie um novo arquivo se quiser usar o Assistente.
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                size="sm"
                variant={valido ? "outline" : "default"}
                className="gap-1.5"
                onClick={() => setDialogOpen(true)}
              >
                <Upload className="h-3.5 w-3.5" />
                {valido ? "Atualizar" : "Enviar certificado"}
              </Button>
              {cnpj && (
                <BotaoAssistente
                  cnpj={cnpj}
                  assistenteDisponivel={assistenteDisponivel}
                  onAssistenteBloqueado={onAssistenteBloqueado}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      {wizard}
    </>
  );
}
