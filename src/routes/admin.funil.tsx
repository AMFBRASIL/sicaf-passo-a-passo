import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, TrendingDown, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  fetchAdminFunil,
  type FunilEtapa,
  type FunilInsight,
} from "@/lib/admin-funil-api";

export const Route = createFileRoute("/admin/funil")({
  component: FunilPage,
});

const PERIODOS = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "60", label: "Últimos 60 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 6 meses" },
  { value: "365", label: "Último ano" },
];

function FunilPage() {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState("90");
  const [etapas, setEtapas] = useState<FunilEtapa[]>([]);
  const [insights, setInsights] = useState<FunilInsight[]>([]);
  const [resumo, setResumo] = useState<Awaited<ReturnType<typeof fetchAdminFunil>>["resumo"]>();

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await fetchAdminFunil({ days: parseInt(days, 10) });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao carregar funil");
      return;
    }
    setEtapas(res.etapas || []);
    setInsights(res.insights || []);
    setResumo(res.resumo);
  }, [days]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const max = useMemo(() => Math.max(...etapas.map((e) => e.v), 1), [etapas]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Funil Comercial</h1>
          <p className="text-sm text-muted-foreground">
            Onde o dinheiro vaza — etapa por etapa · dados reais do banco.
            {resumo && (
              <>
                {" "}
                Cadastro {resumo.taxaCadastro}% · Pagamento {resumo.taxaPagamento}% · SICAF{" "}
                {resumo.taxaSicaf}%
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="h-9 w-44 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Atualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando funil comercial...
        </div>
      ) : etapas.length === 0 ? (
        <Card className="border-dashed p-10 text-center text-sm text-muted-foreground">
          Sem dados de funil no período selecionado.
        </Card>
      ) : (
        <Card className="p-6">
          <div className="space-y-3">
            {etapas.map((e, i) => {
              const pct = (e.v / max) * 100;
              const prev = i > 0 ? etapas[i - 1] : null;
              const conv =
                e.convAnterior ??
                (prev && prev.v > 0 ? Math.round((e.v / prev.v) * 1000) / 10 : 100);
              return (
                <div key={e.nome}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{e.nome}</span>
                      {e.perda && (
                        <Badge variant="destructive" className="gap-1 text-[10px]">
                          <TrendingDown className="h-3 w-3" /> perda
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono font-semibold text-foreground">
                        {e.v.toLocaleString("pt-BR")}
                      </span>
                      {prev && !e.perda && (
                        <span>{conv.toFixed(1)}% vs etapa anterior</span>
                      )}
                      {e.pctDoTopo > 0 && e.nome !== "Visitou site" && (
                        <span>{e.pctDoTopo.toFixed(1)}% do topo</span>
                      )}
                    </div>
                  </div>
                  <div className="relative h-10 overflow-hidden rounded-md bg-muted/40">
                    <div
                      className={`h-full rounded-md bg-gradient-to-r ${e.color} transition-all`}
                      style={{ width: `${Math.max(pct, e.v > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                  {i < etapas.length - 1 && (
                    <div className="flex justify-center py-1 text-muted-foreground">
                      <ArrowDown className="h-3 w-3" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {insights.length > 0 && (
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {insights.map((ins) => (
                <Insight
                  key={ins.label}
                  label={ins.label}
                  value={ins.value}
                  valor={ins.valor}
                  tone={ins.tone}
                />
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function Insight({
  label,
  value,
  valor,
  tone,
}: {
  label: string;
  value: string;
  valor: string;
  tone: "rose" | "emerald" | "violet";
}) {
  const tones: Record<string, string> = {
    rose: "border-rose-500/30 bg-rose-500/5",
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    violet: "border-violet-500/30 bg-violet-500/5",
  };
  return (
    <Card className={`border p-4 ${tones[tone]}`}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm">{value}</p>
      <p className="mt-1 text-2xl font-bold">{valor}</p>
    </Card>
  );
}
