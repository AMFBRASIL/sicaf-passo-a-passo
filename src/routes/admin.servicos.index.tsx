import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Flame, Loader2, Mail, RefreshCw, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchServicosVisao,
  type ServicoKpis,
  type ServicoResumo,
} from "@/lib/admin-servicos-captacao-api";
import { ICONE_SERVICO, moeda, numero } from "@/components/admin/captacao/servicos-visual";

export const Route = createFileRoute("/admin/servicos/")({
  component: ServicosHubPage,
});

type ServicoCard = ServicoResumo & { kpis: ServicoKpis };

function ServicosHubPage() {
  const [loading, setLoading] = useState(true);
  const [servicos, setServicos] = useState<ServicoCard[]>([]);
  const [campanhasAtivas, setCampanhasAtivas] = useState(0);

  const carregar = useCallback(async (refresh = false) => {
    setLoading(true);
    const res = await fetchServicosVisao(refresh);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setServicos(res.servicos);
    setCampanhasAtivas(res.campanhasAtivas);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const receita = servicos.reduce((acc, s) => acc + s.kpis.receita30d, 0);
  const vendas = servicos.reduce((acc, s) => acc + s.kpis.vendas30d, 0);
  const potencial = servicos.reduce((acc, s) => acc + s.kpis.potencial, 0);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Serviços CADBRASIL</h1>
          <p className="text-sm text-muted-foreground">
            Escolha um serviço para abrir a central de captação: públicos-alvo, e-mail em massa,
            WhatsApp, exportação para anúncios e resultados das campanhas.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void carregar(true)} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          )}
          Atualizar
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Resumo
          icon={Wallet}
          label="Receita dos serviços (30 dias)"
          valor={moeda(receita)}
          loading={loading}
        />
        <Resumo
          icon={TrendingUp}
          label="Vendas pagas (30 dias)"
          valor={numero(vendas)}
          loading={loading}
        />
        <Resumo
          icon={Flame}
          label="Clientes quentes para abordar"
          valor={numero(potencial)}
          loading={loading}
        />
        <Resumo
          icon={Mail}
          label="Campanhas em andamento"
          valor={numero(campanhasAtivas)}
          loading={loading}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading && !servicos.length
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))
          : servicos.map((s) => <CardServico key={s.id} servico={s} />)}
      </div>
    </div>
  );
}

function Resumo({
  icon: Icon,
  label,
  valor,
  loading,
}: {
  icon: typeof Wallet;
  label: string;
  valor: string;
  loading: boolean;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-6 w-20" />
        ) : (
          <p className="text-xl font-bold tracking-tight">{valor}</p>
        )}
      </div>
    </Card>
  );
}

function CardServico({ servico: s }: { servico: ServicoCard }) {
  const Icon = ICONE_SERVICO[s.id];
  return (
    <Link
      to="/admin/servicos/$servico"
      params={{ servico: s.id }}
      className="group block focus:outline-none"
    >
      <Card className="relative flex h-full flex-col overflow-hidden p-5 transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: s.cor }} />
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-lg text-white"
              style={{ background: s.cor }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold leading-tight">{s.nome}</h2>
              <p className="text-xs text-muted-foreground">{s.abrangencia}</p>
            </div>
          </div>
          <span className="whitespace-nowrap rounded-md bg-muted px-2 py-1 text-xs font-semibold">
            {s.preco.texto}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Metrica label={s.ativoLabel} valor={numero(s.kpis.ativos)} />
          <Metrica label="Vendas 30d" valor={numero(s.kpis.vendas30d)} />
          <Metrica label="Receita 30d" valor={moeda(s.kpis.receita30d)} />
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800">
          <Flame className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-xs leading-relaxed">
            <strong className="text-sm">{numero(s.kpis.potencial)}</strong> clientes para abordar:{" "}
            {s.kpis.potencialLabel.toLowerCase()}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-end pt-4 text-sm font-semibold text-primary">
          Abrir central de captação
          <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      </Card>
    </Link>
  );
}

function Metrica({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-2">
      <p className="truncate text-sm font-bold">{valor}</p>
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
