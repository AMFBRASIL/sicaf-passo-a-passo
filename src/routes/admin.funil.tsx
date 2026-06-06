import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowDown, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/admin/funil")({
  component: FunilPage,
});

const etapas = [
  { nome: "Visitou site", v: 12800, color: "from-blue-500 to-blue-600" },
  { nome: "Criou cadastro", v: 6120, color: "from-indigo-500 to-indigo-600" },
  { nome: "Não pagou", v: 3380, color: "from-rose-500 to-rose-600", perda: true },
  { nome: "Pagou", v: 2740, color: "from-violet-500 to-violet-600" },
  { nome: "Enviou documentos", v: 2140, color: "from-fuchsia-500 to-fuchsia-600" },
  { nome: "Atualizou SICAF", v: 1680, color: "from-pink-500 to-pink-600" },
  { nome: "Entrou em manutenção", v: 1420, color: "from-amber-500 to-amber-600" },
  { nome: "Renovou", v: 960, color: "from-emerald-500 to-emerald-600" },
];

function FunilPage() {
  const max = etapas[0].v;
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Funil Comercial</h1>
          <p className="text-sm text-muted-foreground">Onde o dinheiro vaza — etapa por etapa.</p>
        </div>
        <Button variant="outline" size="sm">Últimos 90 dias</Button>
      </div>

      <Card className="p-6">
        <div className="space-y-3">
          {etapas.map((e, i) => {
            const pct = (e.v / max) * 100;
            const prev = i > 0 ? etapas[i - 1].v : null;
            const conv = prev ? (e.v / prev) * 100 : 100;
            return (
              <div key={e.nome}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{e.nome}</span>
                    {e.perda && <Badge variant="destructive" className="gap-1 text-[10px]"><TrendingDown className="h-3 w-3" /> perda</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-mono font-semibold text-foreground">{e.v.toLocaleString("pt-BR")}</span>
                    {prev && <span>{conv.toFixed(1)}% vs etapa anterior</span>}
                  </div>
                </div>
                <div className="relative h-10 overflow-hidden rounded-md bg-muted/40">
                  <div
                    className={`h-full rounded-md bg-gradient-to-r ${e.color} transition-all`}
                    style={{ width: `${pct}%` }}
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

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Insight label="Maior perda" value="Não pagou após cadastro" valor="55,2%" tone="rose" />
          <Insight label="Conversão final" value="Visitante → Renovação" valor="7,5%" tone="emerald" />
          <Insight label="Tempo médio de conversão" value="Pagou → SICAF OK" valor="6 dias" tone="violet" />
        </div>
      </Card>
    </div>
  );
}

function Insight({ label, value, valor, tone }: any) {
  const tones: Record<string, string> = {
    rose: "border-rose-500/30 bg-rose-500/5",
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    violet: "border-violet-500/30 bg-violet-500/5",
  };
  return (
    <Card className={`p-4 ${tones[tone]} border`}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
      <p className="mt-1 text-2xl font-bold">{valor}</p>
    </Card>
  );
}
