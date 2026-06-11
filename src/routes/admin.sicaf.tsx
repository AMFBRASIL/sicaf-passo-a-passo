import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileCheck2, Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  fetchAdminSicaf,
  type SicafGestaoCounts,
  type SicafGestaoRow,
  type SicafGestaoStatus,
} from "@/lib/admin-sicaf-api";

export const Route = createFileRoute("/admin/sicaf")({
  component: AdminSicafPage,
});

const statusInfo: Record<SicafGestaoStatus, { cls: string; label: string }> = {
  completo: { cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", label: "🟢 Completo" },
  incompleto: { cls: "bg-slate-500/10 text-slate-700 dark:text-slate-300", label: "⚪ Incompleto" },
  vencendo: { cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300", label: "🟡 Vencendo" },
  vencido: { cls: "bg-rose-500/10 text-rose-700 dark:text-rose-300", label: "🔴 Vencido" },
};

const emptyCounts: SicafGestaoCounts = {
  completo: 0,
  incompleto: 0,
  vencendo: 0,
  vencido: 0,
};

function AdminSicafPage() {
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [filtro, setFiltro] = useState<"todos" | SicafGestaoStatus>("todos");
  const [rows, setRows] = useState<SicafGestaoRow[]>([]);
  const [counts, setCounts] = useState<SicafGestaoCounts>(emptyCounts);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await fetchAdminSicaf({ search: debouncedQ, limit: 500 });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao carregar gestão SICAF");
      return;
    }
    setRows(res.rows || []);
    setCounts(res.counts || emptyCounts);
    setTotal(res.total ?? res.rows?.length ?? 0);
  }, [debouncedQ]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const list = useMemo(
    () =>
      rows.filter((r) => {
        const ms = filtro === "todos" || r.status === filtro;
        return ms;
      }),
    [rows, filtro],
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Gestão SICAF</h1>
          <p className="text-sm text-muted-foreground">
            Níveis I a VI · Status visual semafórico por cliente
            {total > 0 && !loading ? ` · ${total} cadastros` : ""}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void carregar()} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Atualizar
          </Button>
          <Button size="sm" asChild>
            <Link to="/sicaf">
              <FileCheck2 className="mr-1.5 h-3.5 w-3.5" /> Abrir SICAF
            </Link>
          </Button>
        </div>
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
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente ou CNPJ..."
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["todos", "completo", "incompleto", "vencendo", "vencido"] as const).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={filtro === k ? "default" : "outline"}
                className="h-7 text-xs capitalize"
                onClick={() => setFiltro(k)}
              >
                {k}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando cadastros SICAF...
            </div>
          ) : list.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {debouncedQ || filtro !== "todos"
                ? "Nenhum cliente encontrado com os filtros atuais."
                : "Nenhum cadastro SICAF encontrado."}
            </div>
          ) : (
            <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Cliente</th>
                  {["I", "II", "III", "IV", "V", "VI"].map((n) => (
                    <th key={n} className="px-2 py-2 text-center font-medium">
                      Nível {n}
                    </th>
                  ))}
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Vencimento</th>
                  <th className="px-3 py-2 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 hover:bg-muted/30">
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
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusInfo[r.status].cls}`}
                      >
                        {statusInfo[r.status].label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-xs">
                      <VencimentoLabel dias={r.diasVenc} validade={r.sicafValidade} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                        <Link to="/sicaf" search={{ cnpj: r.cnpj }}>
                          <ExternalLink className="mr-1 h-3 w-3" />
                          Abrir
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">
              Exibindo {list.length} de {rows.length} carregados
              {total > rows.length ? ` · ${total.toLocaleString("pt-BR")} cadastros no total` : ""}
              {filtro !== "todos" ? " (filtro aplicado na página atual)" : ""}.
            </p>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

function VencimentoLabel({ dias, validade }: { dias: number; validade?: string | null }) {
  if (!validade) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (dias < 0) {
    return <span className="text-rose-600">Venceu há {Math.abs(dias)}d</span>;
  }
  if (dias <= 15) {
    return <span className="text-amber-600">Em {dias}d</span>;
  }
  return <span className="text-muted-foreground">Em {dias}d</span>;
}

function NivelDot({ value }: { value: boolean | "p" }) {
  const cls =
    value === true
      ? "bg-emerald-500 ring-emerald-500/30"
      : value === "p"
        ? "bg-amber-500 ring-amber-500/30"
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
