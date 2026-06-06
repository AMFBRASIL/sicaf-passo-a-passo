import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, FileCheck2, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/sicaf")({
  component: AdminSicafPage,
});

type Status = "completo" | "incompleto" | "vencendo" | "vencido";

interface Row {
  cli: string;
  cnpj: string;
  niveis: (boolean | "p")[]; // I..VI
  status: Status;
  diasVenc: number;
}

const rows: Row[] = [
  { cli: "JR Construtora EIRELI", cnpj: "12.345.678/0001-90", niveis: [true,true,true,true,true,true], status: "vencido", diasVenc: -5 },
  { cli: "Solar Brasil Energia",  cnpj: "77.888.999/0001-11", niveis: [true,true,true,true,true,true], status: "completo", diasVenc: 120 },
  { cli: "Construtora Aurora",    cnpj: "22.333.444/0001-88", niveis: [true,true,true,true,"p",false], status: "incompleto", diasVenc: 80 },
  { cli: "Engemax Serviços",       cnpj: "55.111.222/0001-44", niveis: [true,true,true,"p",false,false], status: "incompleto", diasVenc: 45 },
  { cli: "Pavimar Obras",         cnpj: "33.444.555/0001-77", niveis: [true,true,true,true,true,false], status: "vencendo", diasVenc: 12 },
  { cli: "TecnoLimp Servicos",    cnpj: "11.222.333/0001-55", niveis: [true,true,"p",false,false,false], status: "incompleto", diasVenc: 60 },
  { cli: "Nova Filial Brasília",  cnpj: "98.765.432/0001-10", niveis: [true,"p",false,false,false,false], status: "incompleto", diasVenc: 0 },
  { cli: "MEI José Roberto",      cnpj: "44.555.666/0001-22", niveis: [true,true,true,true,true,true], status: "vencido", diasVenc: -22 },
];

const statusInfo: Record<Status, { cls: string; label: string }> = {
  completo: { cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", label: "🟢 Completo" },
  incompleto: { cls: "bg-slate-500/10 text-slate-700 dark:text-slate-300", label: "⚪ Incompleto" },
  vencendo: { cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300", label: "🟡 Vencendo" },
  vencido: { cls: "bg-rose-500/10 text-rose-700 dark:text-rose-300", label: "🔴 Vencido" },
};

function AdminSicafPage() {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<"todos" | Status>("todos");

  const list = useMemo(() => rows.filter((r) => {
    const mq = !q || r.cli.toLowerCase().includes(q.toLowerCase()) || r.cnpj.includes(q);
    const ms = filtro === "todos" || r.status === filtro;
    return mq && ms;
  }), [q, filtro]);

  const counts = {
    completo: rows.filter(r => r.status === "completo").length,
    incompleto: rows.filter(r => r.status === "incompleto").length,
    vencendo: rows.filter(r => r.status === "vencendo").length,
    vencido: rows.filter(r => r.status === "vencido").length,
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Gestão SICAF</h1>
          <p className="text-sm text-muted-foreground">
            Níveis I a VI · Status visual semafórico por cliente.
          </p>
        </div>
        <Button size="sm" asChild>
          <Link to="/sicaf"><FileCheck2 className="mr-1.5 h-3.5 w-3.5" /> Abrir SICAF do cliente</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="🟢 Completos" value={counts.completo} tone="emerald" />
        <KpiCard label="⚪ Incompletos" value={counts.incompleto} tone="slate" />
        <KpiCard label="🟡 Vencendo" value={counts.vencendo} tone="amber" />
        <KpiCard label="🔴 Vencidos" value={counts.vencido} tone="rose" />
      </div>

      <Card className="mt-5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente ou CNPJ..." className="pl-8" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["todos","completo","incompleto","vencendo","vencido"] as const).map((k) => (
              <Button key={k} size="sm" variant={filtro === k ? "default" : "outline"} className="h-7 text-xs capitalize" onClick={() => setFiltro(k)}>
                {k}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">Cliente</th>
                {["I","II","III","IV","V","VI"].map(n => (
                  <th key={n} className="px-2 py-2 text-center font-medium">Nível {n}</th>
                ))}
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Vencimento</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={i} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="px-3 py-3">
                    <div className="font-medium">{r.cli}</div>
                    <div className="font-mono text-xs text-muted-foreground">{r.cnpj}</div>
                  </td>
                  {r.niveis.map((n, idx) => (
                    <td key={idx} className="px-2 py-3 text-center">
                      <NivelDot value={n} />
                    </td>
                  ))}
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusInfo[r.status].cls}`}>
                      {statusInfo[r.status].label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-xs">
                    {r.diasVenc < 0 ? (
                      <span className="text-rose-600">Venceu há {Math.abs(r.diasVenc)}d</span>
                    ) : r.diasVenc <= 15 ? (
                      <span className="text-amber-600">Em {r.diasVenc}d</span>
                    ) : (
                      <span className="text-muted-foreground">Em {r.diasVenc}d</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function NivelDot({ value }: { value: boolean | "p" }) {
  const cls =
    value === true ? "bg-emerald-500 ring-emerald-500/30"
    : value === "p" ? "bg-amber-500 ring-amber-500/30"
    : "bg-slate-300 dark:bg-slate-600 ring-slate-400/20";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ring-2 ${cls}`} />;
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    slate: "border-slate-500/30 bg-slate-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    rose: "border-rose-500/30 bg-rose-500/5",
  };
  return (
    <Card className={`p-4 ${tones[tone]} border`}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </Card>
  );
}
