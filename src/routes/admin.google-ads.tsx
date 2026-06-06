import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, MousePointerClick, UserPlus, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell } from "recharts";

export const Route = createFileRoute("/admin/google-ads")({
  component: GoogleAdsPage,
});

const palavras = [
  { palavra: "como tirar sicaf", clicks: 412, cad: 87, pagos: 38, fat: 11400, roas: 5.2, cpa: 38 },
  { palavra: "cadastro sicaf brasilia", clicks: 287, cad: 64, pagos: 31, fat: 9300, roas: 4.8, cpa: 41 },
  { palavra: "renovar sicaf vencido", clicks: 154, cad: 49, pagos: 22, fat: 6600, roas: 4.5, cpa: 44 },
  { palavra: "licitação mei", clicks: 198, cad: 41, pagos: 18, fat: 5400, roas: 3.9, cpa: 52 },
  { palavra: "cnpj para licitar", clicks: 132, cad: 28, pagos: 12, fat: 3600, roas: 3.1, cpa: 65 },
  { palavra: "sicaf nível 4", clicks: 89, cad: 22, pagos: 14, fat: 4200, roas: 4.0, cpa: 48 },
];

function GoogleAdsPage() {
  const maxFat = Math.max(...palavras.map(p => p.fat));
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Google Ads Intelligence</h1>
          <p className="text-sm text-muted-foreground">Palavras que <strong>geram dinheiro</strong> — não apenas cliques.</p>
        </div>
        <Button variant="outline" size="sm">Últimos 30 dias</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat icon={DollarSign} label="Investimento" value="R$ 9.840" />
        <Stat icon={MousePointerClick} label="Cliques" value="1.272" />
        <Stat icon={UserPlus} label="Cadastros" value="291" />
        <Stat icon={TrendingUp} label="Receita" value="R$ 40.500" tone="emerald" />
        <Stat icon={Target} label="ROAS médio" value="4,2x" tone="violet" />
      </div>

      <Card className="mt-5 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Top palavras por receita</h3>
          <Badge variant="secondary" className="text-[10px]">Atribuição last-click</Badge>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={palavras} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis dataKey="palavra" type="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={150} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [`R$ ${v.toLocaleString("pt-BR")}`, "Receita"]}
              />
              <Bar dataKey="fat" radius={[0, 6, 6, 0]}>
                {palavras.map((p, i) => (
                  <Cell key={i} fill={`hsl(${160 + (p.fat / maxFat) * 60} 70% ${50 - i * 3}%)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="mt-5 p-5">
        <h3 className="mb-3 text-sm font-semibold">Tabela completa</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">Palavra-chave</th>
                <th className="px-3 py-2 font-medium text-right">Cliques</th>
                <th className="px-3 py-2 font-medium text-right">Cadastros</th>
                <th className="px-3 py-2 font-medium text-right">Pagos</th>
                <th className="px-3 py-2 font-medium text-right">Receita</th>
                <th className="px-3 py-2 font-medium text-right">ROAS</th>
                <th className="px-3 py-2 font-medium text-right">CPA</th>
              </tr>
            </thead>
            <tbody>
              {palavras.map((p, i) => (
                <tr key={i} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="px-3 py-3 font-medium">{p.palavra}</td>
                  <td className="px-3 py-3 text-right">{p.clicks}</td>
                  <td className="px-3 py-3 text-right">{p.cad}</td>
                  <td className="px-3 py-3 text-right">{p.pagos}</td>
                  <td className="px-3 py-3 text-right font-semibold text-emerald-600">R$ {p.fat.toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-3 text-right">
                    <Badge variant={p.roas >= 4 ? "default" : "secondary"} className="text-[10px]">{p.roas.toFixed(1)}x</Badge>
                  </td>
                  <td className="px-3 py-3 text-right">R$ {p.cpa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone = "default" }: any) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    emerald: "text-emerald-600",
    violet: "text-violet-600",
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={`mt-2 text-xl font-bold ${tones[tone]}`}>{value}</p>
        </div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
    </Card>
  );
}
