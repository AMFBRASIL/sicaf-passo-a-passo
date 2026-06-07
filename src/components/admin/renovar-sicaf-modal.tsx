import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  ExternalLink,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cliente?: { razao: string; cnpj: string } | null;
  statusAtual?: string;
  validade?: string;
  ultimaRenovacao?: string;
  onGerarTaxa: () => void;
}

const ITENS = [
  "Manutenção do Credenciamento (Nível I)",
  "Atualização dos dados cadastrais",
  "Renovação de todos os níveis habilitados",
  "Acesso ao portal de compras governamentais",
];

export function RenovarSicafModal({
  open,
  onOpenChange,
  cliente,
  statusAtual = "Ativo",
  validade = "05/06/2027",
  ultimaRenovacao = "Ano 2026",
  onGerarTaxa,
}: Props) {
  const ano = new Date().getFullYear();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        <div className="p-6">
          <DialogTitle className="text-lg font-bold">Renovar SICAF Anual</DialogTitle>
          <DialogDescription className="sr-only">
            Confirme os dados antes de gerar a taxa de renovação anual do SICAF.
          </DialogDescription>

          <Card className="mt-4 p-4 bg-primary/5 border-primary/20">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">Credencial SICAF {ano}</h3>
                <p className="text-xs text-muted-foreground">
                  Renovação anual do cadastro unificado
                </p>
                {cliente && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {cliente.razao} · {cliente.cnpj}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-md border bg-background/60 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Status Atual
                </p>
                <span className="mt-1 inline-flex rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                  {statusAtual}
                </span>
              </div>
              <div className="rounded-md border bg-background/60 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Validade
                </p>
                <p className="mt-1 text-base font-bold">{validade}</p>
              </div>
              <div className="col-span-2 rounded-md border bg-background/60 p-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Última Renovação
                  </p>
                  <p className="mt-1 text-sm font-medium">{ultimaRenovacao}</p>
                </div>
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                  Concluída
                </span>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm font-medium">Itens inclusos na renovação:</p>
              <ul className="mt-2 space-y-1.5">
                {ITENS.map((i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <div className="mt-4 flex gap-2 rounded-md border border-warning/30 bg-warning/10 p-3">
            <AlertTriangle className="h-4 w-4 text-warning-foreground shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-warning-foreground">Atenção</p>
              <p className="text-muted-foreground">
                A renovação deve ser feita diretamente no portal ComprasNet. Após o
                pagamento, o sistema sincroniza automaticamente.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={onGerarTaxa}>
              <CreditCard className="h-4 w-4" /> Gerar Taxa de Renovação
            </Button>
            <Button variant="outline" className="gap-1.5">
              <ExternalLink className="h-4 w-4" /> Acessar ComprasNet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
