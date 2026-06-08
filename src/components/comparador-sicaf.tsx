import { ArrowRight, CheckCircle2, AlertCircle, GitCompareArrows } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Nivel = { numero: number; nome: string; ativo: boolean };

export type SnapshotSicaf = {
  validade: string;
  niveis: Nivel[];
  pendencias: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresa: string;
  antes: SnapshotSicaf;
  depois: SnapshotSicaf;
};

const NIVEIS_LABEL: Record<number, string> = {
  1: "Credenciamento",
  2: "Hab. Jurídica",
  3: "Reg. Fiscal",
  4: "Qual. Econômica",
  5: "Qual. Técnica",
  6: "Linha de Forn.",
};

export function ComparadorSicaf({ open, onOpenChange, empresa, antes, depois }: Props) {
  const antesAtivos = antes.niveis.filter((n) => n.ativo).length;
  const depoisAtivos = depois.niveis.filter((n) => n.ativo).length;
  const ganhoNiveis = depoisAtivos - antesAtivos;
  const pendResolvidas = antes.pendencias.filter((p) => !depois.pendencias.includes(p)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5 text-primary" />
            Comparativo SICAF — Antes vs Depois
          </DialogTitle>
          <DialogDescription>
            Veja exatamente o que muda em {empresa} após a atualização.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <Resumo label="Níveis ativos" valor={`${antesAtivos} → ${depoisAtivos}`} delta={ganhoNiveis > 0 ? `+${ganhoNiveis}` : "="} positivo={ganhoNiveis > 0} />
          <Resumo label="Pendências resolvidas" valor={`${pendResolvidas}`} delta={pendResolvidas > 0 ? "novo" : "—"} positivo={pendResolvidas > 0} />
          <Resumo label="Nova validade" valor={depois.validade} delta="atualizada" positivo />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ColunaSnapshot titulo="Hoje (Gov.br)" subtitulo="Estado atual no portal" snap={antes} tone="danger" />
          <ColunaSnapshot titulo="Após atualização" subtitulo="Como ficará no SICAF" snap={depois} tone="success" />
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={() => onOpenChange(false)} className="gap-1.5">
            Entendi <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Resumo({ label, valor, delta, positivo }: { label: string; valor: string; delta: string; positivo: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tracking-tight">{valor}</p>
      <span
        className={cn(
          "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
          positivo ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
        )}
      >
        {delta}
      </span>
    </div>
  );
}

function ColunaSnapshot({ titulo, subtitulo, snap, tone }: { titulo: string; subtitulo: string; snap: SnapshotSicaf; tone: "danger" | "success" }) {
  return (
    <div className={cn("rounded-2xl border-2 p-4", tone === "danger" ? "border-destructive/20 bg-destructive/[0.03]" : "border-success/30 bg-success/[0.04]")}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold">{titulo}</p>
          <p className="text-[11px] text-muted-foreground">{subtitulo}</p>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", tone === "danger" ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success")}>
          {tone === "danger" ? "Antes" : "Depois"}
        </span>
      </div>

      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Níveis</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {snap.niveis.map((n) => (
            <span
              key={n.numero}
              title={NIVEIS_LABEL[n.numero]}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                n.ativo ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground line-through",
              )}
            >
              {n.numero}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Validade</p>
        <p className="mt-0.5 text-sm font-semibold">{snap.validade}</p>
      </div>

      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Pendências ({snap.pendencias.length})
        </p>
        {snap.pendencias.length === 0 ? (
          <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Sem pendências
          </p>
        ) : (
          <ul className="mt-1 space-y-1 text-xs">
            {snap.pendencias.map((p) => (
              <li key={p} className="flex items-start gap-1.5">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
