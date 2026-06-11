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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  certificadoEstaValido,
  fetchCertificadoDigital,
  formatCertValidade,
  uploadCertificadoDigital,
  type CertificadoDigitalInfo,
} from "@/lib/certificado-api";
import { toast } from "sonner";

type CertificadoDigitalCardProps = {
  clienteId: number;
  cnpj?: string;
  compact?: boolean;
  onUpdated?: (cert: CertificadoDigitalInfo | null) => void;
};

function CertificadoUploadDialog({
  open,
  onOpenChange,
  clienteId,
  onConcluido,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clienteId: number;
  onConcluido: (cert: CertificadoDigitalInfo) => void;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [senha, setSenha] = useState("");
  const [estado, setEstado] = useState<"form" | "validando" | "ok">("form");
  const [validadeMsg, setValidadeMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setArquivo(null);
      setSenha("");
      setEstado("form");
      setValidadeMsg(null);
      setErro(null);
    }
  }, [open]);

  const podeValidar = arquivo && senha.length >= 4 && estado === "form";

  const validar = async () => {
    if (!arquivo) return;
    setEstado("validando");
    setErro(null);
    const result = await uploadCertificadoDigital(clienteId, arquivo, senha);
    if (!result.ok || !result.certificado) {
      setEstado("form");
      setErro(result.error || "Falha na validação do certificado");
      toast.error(result.error || "Falha na validação do certificado");
      return;
    }
    setValidadeMsg(formatCertValidade(result.certificado));
    setEstado("ok");
    setTimeout(() => {
      onConcluido(result.certificado!);
      onOpenChange(false);
    }, 1100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl">Certificado digital e-CNPJ</DialogTitle>
          <DialogDescription className="text-center">
            Envie o arquivo .pfx e a senha. Usamos apenas para automatizar o acesso ao Compras.gov.br.
          </DialogDescription>
        </DialogHeader>

        {estado === "form" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Arquivo do certificado (.pfx)</Label>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-center transition hover:border-primary/50">
                <Upload className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium">
                  {arquivo ? arquivo.name : "Clique para selecionar o .pfx"}
                </span>
                <input
                  type="file"
                  accept=".pfx,.p12"
                  className="hidden"
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cert-senha-opc">Senha do certificado</Label>
              <Input
                id="cert-senha-opc"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha do e-CNPJ A1"
              />
            </div>
            {erro && <p className="text-center text-xs text-destructive">{erro}</p>}
          </div>
        )}

        {estado === "validando" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium">Validando certificado…</p>
          </div>
        )}

        {estado === "ok" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="text-base font-semibold">Certificado validado!</p>
            {validadeMsg && (
              <p className="text-xs text-muted-foreground">Válido até {validadeMsg}</p>
            )}
          </div>
        )}

        {estado === "form" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void validar()} disabled={!podeValidar} className="gap-2">
              <KeyRound className="h-4 w-4" />
              Validar certificado
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CertificadoDigitalCard({
  clienteId,
  cnpj,
  compact = false,
  onUpdated,
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
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        asChild
                        size="lg"
                        className="gap-2 bg-success px-5 font-semibold text-success-foreground shadow-md transition hover:bg-success/90 hover:shadow-lg"
                      >
                        <Link to="/assistente" search={{ cnpj }}>
                          <Bot className="h-5 w-5" />
                          Ir ao Assistente
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      align="end"
                      sideOffset={10}
                      className="max-w-[300px] border border-success/25 bg-card p-0 text-foreground shadow-xl"
                    >
                      <div className="rounded-md p-3.5">
                        <p className="text-sm font-semibold text-success">Atualize seu SICAF aqui</p>
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                          No Assistente você envia a Situação do Fornecedor, sincroniza os níveis
                          do cadastro e acompanha vencimentos automaticamente.
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <CertificadoUploadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clienteId={clienteId}
        onConcluido={(cert) => {
          setCertificado(cert);
          onUpdated?.(cert);
          toast.success("Certificado digital cadastrado.");
        }}
      />
    </>
  );
}
