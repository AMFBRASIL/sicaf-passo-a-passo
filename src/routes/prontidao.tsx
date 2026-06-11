import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { fetchProntidao, type EmpresaProntidao } from "@/lib/prontidao-api";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Building2,
  Search,
  ArrowUpRight,
  ShieldCheck,
  ClipboardCheck,
  FileText,
  Gauge,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Filter,
  CircleDashed,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/prontidao")({
  head: () => ({
    meta: [
      { title: "Prontidão para Licitar — CADBRASIL" },
      { name: "description", content: "Score 0–100 por empresa com ranking e plano de ação automático." },
    ],
  }),
  component: ProntidaoPage,
});

type Empresa = EmpresaProntidao;

function ProntidaoPage() {
  const [query, setQuery] = useState("");
  const [ordem, setOrdem] = useState<"score" | "prioridade">("prioridade");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [resumo, setResumo] = useState({ media: 0, prontas: 0, atencao: 0, criticas: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetchProntidao(query);
      if (!res.ok) {
        toast.error(res.error || "Erro ao carregar prontidão");
        setLoading(false);
        return;
      }
      setEmpresas(res.empresas || []);
      if (res.resumo) setResumo(res.resumo);
      setLoading(false);
    })();
  }, [query]);

  const filtradas = useMemo(() => {
    let list = [...empresas];
    list = [...list].sort((a, b) => {
      if (ordem === "score") return b.score - a.score;
      const pri = { alta: 0, media: 1, baixa: 2 } as const;
      return pri[a.prioridade] - pri[b.prioridade];
    });
    return list;
  }, [query, ordem]);

  const { media, prontas, atencao, criticas } = resumo;

  if (loading) {
    return (
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 sm:py-10 flex flex-col items-center justify-center gap-3 text-muted-foreground min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Calculando prontidão das empresas...</p>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 sm:py-10">
      <PageHeader
        icon={<Gauge className="h-5 w-5" />}
        title="Prontidão para Licitar"
        subtitle="Score 0–100 por CNPJ com ranking de prioridade e plano de ação."
        action={
          <Button className="gap-2">
            <Sparkles className="h-4 w-4" />
            Gerar plano com IA
          </Button>
        }
      />

      {/* Hero */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr]">
        <HeroScore media={media} total={empresas.length} />
        <KpiCard tone="ok" icon={<CheckCircle2 className="h-4 w-4" />} label="Prontas para licitar" value={prontas} hint="Score ≥ 80" />
        <KpiCard tone="warn" icon={<TrendingUp className="h-4 w-4" />} label="Em ajuste" value={atencao} hint="Score 50–79" />
        <KpiCard tone="danger" icon={<AlertTriangle className="h-4 w-4" />} label="Críticas" value={criticas} hint="Score abaixo de 50" />
      </div>

      {/* Filters */}
      <Card className="mt-6">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por empresa ou CNPJ..."
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Ordenar:</span>
            <Button
              size="sm"
              variant={ordem === "prioridade" ? "default" : "outline"}
              onClick={() => setOrdem("prioridade")}
            >
              Prioridade
            </Button>
            <Button
              size="sm"
              variant={ordem === "score" ? "default" : "outline"}
              onClick={() => setOrdem("score")}
            >
              Maior score
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ranking */}
      <div className="mt-4 space-y-3">
        {filtradas.map((e, i) => (
          <EmpresaCard key={e.id} empresa={e} posicao={i + 1} />
        ))}
      </div>

      {/* Footer info */}
      <Card className="mt-6 border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
            <div className="text-sm">
              <p className="font-semibold">Como o score é calculado?</p>
              <p className="mt-1 text-muted-foreground">
                Combinamos níveis SICAF (40%), validade das certidões (30%), completude documental (20%) e
                histórico de licitações (10%).
              </p>
            </div>
          </div>
          <Button variant="outline">Exportar relatório PDF</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function HeroScore({ media, total }: { media: number; total: number }) {
  const tone = media >= 80 ? "ok" : media >= 50 ? "warn" : "danger";
  const ring =
    tone === "ok"
      ? "from-success/30 to-success/5"
      : tone === "warn"
      ? "from-warning/30 to-warning/5"
      : "from-danger/30 to-danger/5";
  const fg =
    tone === "ok" ? "text-success" : tone === "warn" ? "text-warning-foreground" : "text-danger";
  return (
    <Card className={`relative overflow-hidden border-primary/20 bg-gradient-to-br ${ring} shadow-lift`}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
          <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
            <circle cx="18" cy="18" r="15.9" className="fill-none stroke-muted" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.9"
              className={`fill-none ${fg}`}
              strokeWidth="3"
              strokeDasharray={`${media}, 100`}
              strokeLinecap="round"
              stroke="currentColor"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xl font-bold ${fg}`}>{media}</span>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Score médio do portfólio</p>
          <p className="mt-0.5 text-lg font-bold">{total} empresas monitoradas</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Atualizado há 12 minutos</p>
        </div>
      </CardContent>
    </Card>
  );
}

function KpiCard({
  tone, icon, label, value, hint,
}: {
  tone: "ok" | "warn" | "danger";
  icon: ReactNode;
  label: string;
  value: number;
  hint: string;
}) {
  const map = {
    ok: "bg-success/10 text-success border-success/20",
    warn: "bg-warning/15 text-warning-foreground border-warning/30",
    danger: "bg-danger/10 text-danger border-danger/20",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${map[tone]}`}>
          {icon}
        </div>
        <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-bold">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function EmpresaCard({ empresa: e, posicao }: { empresa: Empresa; posicao: number }) {
  const tone = e.score >= 80 ? "ok" : e.score >= 50 ? "warn" : "danger";
  const scoreCls =
    tone === "ok" ? "text-success" : tone === "warn" ? "text-warning-foreground" : "text-danger";
  const priBadge = {
    alta: "bg-danger/10 text-danger border-danger/20",
    media: "bg-warning/15 text-warning-foreground border-warning/30",
    baixa: "bg-success/10 text-success border-success/20",
  } as const;

  return (
    <Card
      className={
        "transition hover:shadow-lift " +
        (tone === "danger" ? "border-danger/30" : tone === "warn" ? "border-warning/30" : "")
      }
    >
      <CardContent className="grid gap-4 p-5 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        {/* Rank + score */}
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
            #{posicao}
          </div>
          <div className="relative flex h-16 w-16 items-center justify-center">
            <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
              <circle cx="18" cy="18" r="15.9" className="fill-none stroke-muted" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9"
                className={`fill-none ${scoreCls}`}
                strokeWidth="3"
                strokeDasharray={`${e.score}, 100`}
                strokeLinecap="round"
                stroke="currentColor"
              />
            </svg>
            <span className={`absolute text-base font-bold ${scoreCls}`}>{e.score}</span>
          </div>
        </div>

        {/* Identity + breakdown */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <p className="font-semibold leading-tight">{e.razao}</p>
            <Badge variant="outline" className="font-mono text-[11px]">{e.cnpj}</Badge>
            <Badge variant="secondary">{e.uf}</Badge>
            <span
              className={
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                priBadge[e.prioridade]
              }
            >
              Prioridade {e.prioridade}
            </span>
          </div>

          <p className="mt-1.5 text-sm text-muted-foreground">{e.acao}</p>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <BreakdownRow
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
              label={`SICAF nível ${e.sicaf.nivel}`}
              value={(e.sicaf.nivel / 6) * 100}
              tone={e.sicaf.status}
            />
            <BreakdownRow
              icon={<ClipboardCheck className="h-3.5 w-3.5" />}
              label={`Certidões ${e.certidoes.ok}/${e.certidoes.ok + e.certidoes.warn + e.certidoes.danger}`}
              value={(e.certidoes.ok / (e.certidoes.ok + e.certidoes.warn + e.certidoes.danger)) * 100}
              tone={e.certidoes.danger > 0 ? "danger" : e.certidoes.warn > 0 ? "warn" : "ok"}
            />
            <BreakdownRow
              icon={<FileText className="h-3.5 w-3.5" />}
              label={`Documentos ${e.docs.ok}/${e.docs.total}`}
              value={(e.docs.ok / e.docs.total) * 100}
              tone={e.docs.ok === e.docs.total ? "ok" : e.docs.ok / e.docs.total < 0.7 ? "danger" : "warn"}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 lg:items-end">
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/empresas">
              Gerenciar
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to="/sicaf">Ver SICAF</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BreakdownRow({
  icon, label, value, tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: "ok" | "warn" | "danger";
}) {
  const bar =
    tone === "ok" ? "bg-success" : tone === "warn" ? "bg-warning" : "bg-danger";
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${bar}`} style={{ width: `${Math.max(4, value)}%` }} />
      </div>
    </div>
  );
}

