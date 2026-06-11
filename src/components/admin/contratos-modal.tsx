import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useCallback, useEffect, useState } from "react";
import { FileSignature, Download, Send, Loader2, Printer, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import type { ClienteDetalhe } from "./cliente-detalhe-modal";
import {
  fetchAdminClienteContrato,
  salvarAdminClienteContrato,
  type ContratoDigitalUi,
} from "@/lib/admin-clientes-api";
import { openContractPreviewWindow, openContractPrintWindow, type ContractData } from "@/lib/contract-template";

const MODELOS = [
  { value: "Licença + Manutenção", label: "Manutenção SICAF — Anual" },
  { value: "Manutenção SICAF Plus", label: "Manutenção SICAF Plus" },
  { value: "Consultoria avulsa", label: "Consultoria avulsa" },
];

function addMonths(isoDate: string, months: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function toInputDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: ClienteDetalhe;
  clienteId?: number;
}

export function ContratosModal({ open, onOpenChange, cliente, clienteId }: Props) {
  const effectiveId =
    clienteId ?? (Number.isFinite(parseInt(cliente.id, 10)) ? parseInt(cliente.id, 10) : undefined);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contrato, setContrato] = useState<ContratoDigitalUi | null>(null);

  const [plano, setPlano] = useState("Licença + Manutenção");
  const [vigenciaMeses, setVigenciaMeses] = useState("12");
  const [dataInicio, setDataInicio] = useState(() => new Date().toISOString().slice(0, 10));
  const [dataAssinatura, setDataAssinatura] = useState(() => new Date().toISOString().slice(0, 10));
  const [valorMensal, setValorMensal] = useState(String(cliente.mrr || 155));
  const [signatario, setSignatario] = useState(cliente.responsavel || "");
  const [emailSignatario, setEmailSignatario] = useState(cliente.email ?? "");
  const [jaAssinado, setJaAssinado] = useState(false);

  const applyForm = useCallback(
    (c: ContratoDigitalUi | null) => {
      const hoje = new Date().toISOString().slice(0, 10);
      if (!c) {
        setPlano("Licença + Manutenção");
        setVigenciaMeses("12");
        setDataInicio(hoje);
        setDataAssinatura(hoje);
        setValorMensal(String(cliente.mrr || 155));
        setSignatario(cliente.responsavel || "");
        setEmailSignatario(cliente.email ?? "");
        setJaAssinado(false);
        return;
      }
      setPlano(c.plano || "Licença + Manutenção");
      setVigenciaMeses(String(c.vigenciaMeses ?? 12));
      setDataInicio(toInputDate(c.dataInicio) || hoje);
      setDataAssinatura(toInputDate(c.assinadoEm) || toInputDate(c.dataInicio) || hoje);
      setValorMensal(String(c.valorMensal ?? cliente.mrr ?? 155));
      setSignatario(c.assinadoPor || c.responsavelNome || cliente.responsavel || "");
      setEmailSignatario(c.emailSignatario || c.email || cliente.email || "");
      setJaAssinado(c.status === "Assinado");
    },
    [cliente],
  );

  const carregar = useCallback(async () => {
    if (!effectiveId) return;
    setLoading(true);
    try {
      const res = await fetchAdminClienteContrato(effectiveId);
      if (res.ok) {
        setContrato(res.contrato ?? null);
        applyForm(res.contrato ?? null);
      } else {
        toast.error(res.error || "Erro ao carregar contrato");
        applyForm(null);
      }
    } catch {
      toast.error("Erro ao carregar contrato");
      applyForm(null);
    } finally {
      setLoading(false);
    }
  }, [effectiveId, applyForm]);

  useEffect(() => {
    if (open) void carregar();
  }, [open, carregar]);

  const meses = parseInt(vigenciaMeses, 10) || 12;
  const dataVencimento = dataInicio ? addMonths(dataInicio, meses) : "";

  const buildContractData = (): ContractData => ({
    razao_social: contrato?.razaoSocial || cliente.razao,
    documento: contrato?.documento || cliente.cnpj,
    tipo_documento: contrato?.tipoDocumento || "CNPJ",
    email: emailSignatario || contrato?.email || cliente.email || "",
    telefone: contrato?.telefone || cliente.telefone || "",
    cidade: contrato?.cidade || cliente.cidade || "",
    estado: contrato?.estado || "",
    plano,
    data_inicio: dataInicio,
    data_vencimento: dataVencimento,
    status: jaAssinado ? "Assinado" : "Pendente Assinatura",
    assinado_por: jaAssinado ? signatario : null,
    assinado_em: jaAssinado ? dataAssinatura : null,
    data_documento: dataAssinatura || dataInicio,
  });

  const gerarPdf = () => {
    if (!dataAssinatura && !dataInicio) {
      toast.error("Informe a data do contrato");
      return;
    }
    const ok = openContractPreviewWindow(buildContractData());
    if (!ok) {
      toast.error("Popup bloqueado. Permita popups para abrir o contrato.");
      return;
    }
    toast.info("No navegador, use Ctrl+P → Salvar como PDF", { duration: 5000 });
  };

  const imprimir = () => {
    const ok = openContractPrintWindow(buildContractData());
    if (!ok) toast.error("Popup bloqueado. Permita popups para imprimir.");
  };

  const salvar = async (andPrint = false) => {
    if (!effectiveId) {
      toast.error("Cliente sem identificador");
      return;
    }
    if (jaAssinado && !signatario.trim()) {
      toast.error("Informe o signatário");
      return;
    }
    setSaving(true);
    try {
      const res = await salvarAdminClienteContrato(effectiveId, {
        contratoId: contrato?.id,
        plano,
        dataInicio: dataInicio || new Date().toISOString().slice(0, 10),
        dataVencimento: dataVencimento || addMonths(dataInicio, meses),
        status: jaAssinado ? "Assinado" : "Pendente Assinatura",
        assinadoPor: jaAssinado ? signatario.trim() : undefined,
        assinadoEm: jaAssinado ? dataAssinatura : undefined,
        valorMensal: parseFloat(valorMensal) || undefined,
        vigenciaMeses: parseInt(vigenciaMeses, 10) || 12,
        emailSignatario: emailSignatario.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.error || "Não foi possível salvar");
        return;
      }
      toast.success(res.message || "Contrato salvo");
      if (res.contrato) {
        setContrato(res.contrato);
        applyForm(res.contrato);
      } else {
        await carregar();
      }
      if (andPrint) imprimir();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-amber-500" /> Contrato digital
          </DialogTitle>
          <DialogDescription>
            Gere, imprima ou registre o contrato de {cliente.razao}.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando contrato...
          </div>
        ) : (
          <div className="space-y-4">
            {contrato && (
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    contrato.status === "Assinado"
                      ? "border-emerald-500/40 text-emerald-700"
                      : "border-amber-500/40 text-amber-700"
                  }
                >
                  {contrato.status === "Assinado" ? (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  ) : (
                    <Clock className="h-3 w-3 mr-1" />
                  )}
                  {contrato.status}
                </Badge>
                {contrato.assinadoEm && contrato.status === "Assinado" && (
                  <span className="text-xs text-muted-foreground">
                    Assinado em {new Date(contrato.assinadoEm).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Modelo de contrato</Label>
                <select
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  value={plano}
                  onChange={(e) => setPlano(e.target.value)}
                >
                  {MODELOS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Vigência (meses)</Label>
                <Input
                  value={vigenciaMeses}
                  onChange={(e) => setVigenciaMeses(e.target.value)}
                  placeholder="12"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Início da vigência</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data do contrato / assinatura</Label>
                <Input
                  type="date"
                  value={dataAssinatura}
                  onChange={(e) => setDataAssinatura(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  Usada no PDF mesmo sem assinatura registrada.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Valor mensal (R$)</Label>
                <Input
                  type="number"
                  value={valorMensal}
                  onChange={(e) => setValorMensal(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Vencimento (calculado)</Label>
                <Input value={dataVencimento ? new Date(dataVencimento + "T12:00:00").toLocaleDateString("pt-BR") : "—"} readOnly className="bg-muted/40" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Signatário (nome)</Label>
                <Input value={signatario} onChange={(e) => setSignatario(e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>E-mail do signatário</Label>
                <Input type="email" value={emailSignatario} onChange={(e) => setEmailSignatario(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border p-3">
              <Checkbox
                id="ja-assinado"
                checked={jaAssinado}
                onCheckedChange={(v) => setJaAssinado(!!v)}
              />
              <Label htmlFor="ja-assinado" className="text-sm font-normal cursor-pointer">
                Contrato já assinado (registrar no sistema)
              </Label>
            </div>

            <Separator />

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={gerarPdf}>
                <Download className="h-4 w-4" /> Abrir / PDF
              </Button>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={imprimir}>
                <Printer className="h-4 w-4" /> Imprimir
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={saving || loading}
            onClick={() => void salvar(true)}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Salvar e imprimir
          </Button>
          <Button className="gap-1.5" disabled={saving || loading} onClick={() => void salvar(false)}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Salvar contrato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
