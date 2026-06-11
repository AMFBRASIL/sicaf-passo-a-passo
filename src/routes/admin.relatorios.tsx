import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet,
  FileText,
  FileType,
  Download,
  Users,
  DollarSign,
  FileCheck2,
  Ticket,
  TrendingUp,
  Filter,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { RelatorioFiltrosModal } from "@/components/admin/relatorio-filtros-modal";
import { toast } from "sonner";
import {
  downloadRelatorio,
  fetchAdminRelatorios,
  gerarRelatorio,
  type RelatorioCard,
  type RelatorioHistorico,
  type RelatorioKey,
} from "@/lib/admin-relatorios-api";

export const Route = createFileRoute("/admin/relatorios")({
  component: RelatoriosPage,
});

const META: Record<
  RelatorioKey,
  { nome: string; desc: string; icon: typeof Users }
> = {
  clientes: {
    nome: "Base de Clientes",
    desc: "Lista completa com status, MRR e responsável",
    icon: Users,
  },
  financeiro: {
    nome: "Financeiro Mensal",
    desc: "Recebimentos, inadimplência, renovações e cancelamentos",
    icon: DollarSign,
  },
  sicaf: {
    nome: "Gestão SICAF",
    desc: "Níveis I a VI, vencimentos e pendências",
    icon: FileCheck2,
  },
  suporte: {
    nome: "Suporte e SLA",
    desc: "Tickets resolvidos, tempo médio e categorias",
    icon: Ticket,
  },
  googleads: {
    nome: "Google Ads",
    desc: "Palavras, ROAS, CPA e conversões validadas",
    icon: TrendingUp,
  },
};

const ORDEM: RelatorioKey[] = [
  "clientes",
  "financeiro",
  "sicaf",
  "suporte",
  "googleads",
];

function RelatoriosPage() {
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState<RelatorioKey | null>(null);
  const [openKey, setOpenKey] = useState<RelatorioKey | null>(null);
  const [cards, setCards] = useState<RelatorioCard[]>([]);
  const [historico, setHistorico] = useState<RelatorioHistorico[]>([]);
  const [resumo, setResumo] = useState<{ totalArquivos: number; tamanhoEstimadoMb: number }>();

  const cardMap = useMemo(
    () => Object.fromEntries(cards.map((c) => [c.key, c])),
    [cards],
  );

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await fetchAdminRelatorios();
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao carregar relatórios");
      return;
    }
    setCards(res.cards || []);
    setHistorico(res.historico || []);
    setResumo(res.resumo);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const exportarRapido = async (key: RelatorioKey, formato: "xlsx" | "pdf" | "csv") => {
    setExportando(key);
    const meta = META[key];
    const res = await gerarRelatorio({
      tipo: key,
      periodo: "30d",
      formato,
    });
    setExportando(null);
    if (!res.ok || !res.headers?.length) {
      toast.error(res.error || "Falha ao gerar relatório");
      return;
    }
    downloadRelatorio(res);
    toast.success(`${meta.nome} exportado`, {
      description: `${res.total ?? 0} linhas · ${formato.toUpperCase()} · últimos 30 dias`,
    });
    void carregar();
  };

  const reexportarHistorico = async (h: RelatorioHistorico) => {
    const tipo = h.tipo as RelatorioKey;
    if (!META[tipo]) {
      toast.error("Tipo de relatório não disponível para reexportação");
      return;
    }
    setExportando(tipo);
    const res = await gerarRelatorio({
      tipo,
      periodo: "30d",
      formato: h.formato.toLowerCase() as "csv" | "xlsx" | "pdf",
    });
    setExportando(null);
    if (!res.ok) {
      toast.error(res.error || "Falha ao reexportar");
      return;
    }
    downloadRelatorio(res);
    toast.success(`Baixando ${h.filename}`);
    void carregar();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Exportação com dados reais do banco · Excel, PDF e CSV.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
            )}
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOpenKey("financeiro")}>
            Agendar envio
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {ORDEM.map((key) => {
          const r = META[key];
          const card = cardMap[key];
          const Icon = r.icon;
          const busy = exportando === key;
          return (
            <Card key={key} className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">{r.nome}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.desc}</p>
                  {card && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {card.registros.toLocaleString("pt-BR")} registros no banco
                    </p>
                  )}
                </div>
              </div>

              <Button
                size="sm"
                className="mt-4 w-full"
                onClick={() => setOpenKey(key)}
                disabled={busy}
              >
                <Filter className="mr-2 h-3.5 w-3.5" /> Filtros e exportação
              </Button>

              <div className="mt-2 flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 flex-1 gap-1 text-xs"
                  disabled={busy}
                  onClick={() => void exportarRapido(key, "xlsx")}
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  )}
                  Excel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 flex-1 gap-1 text-xs"
                  disabled={busy}
                  onClick={() => void exportarRapido(key, "pdf")}
                >
                  <FileType className="h-3.5 w-3.5 text-rose-600" /> PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 flex-1 gap-1 text-xs"
                  disabled={busy}
                  onClick={() => void exportarRapido(key, "csv")}
                >
                  <FileText className="h-3.5 w-3.5 text-blue-600" /> CSV
                </Button>
              </div>
              <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                {card?.ultimaLabel || "Nunca gerado"}
              </p>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Últimos relatórios gerados</h3>
            <p className="text-xs text-muted-foreground">Histórico dos últimos 30 dias</p>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {resumo
              ? `${resumo.totalArquivos} arquivo${resumo.totalArquivos !== 1 ? "s" : ""} · ~${resumo.tamanhoEstimadoMb} MB`
              : "—"}
          </Badge>
        </div>
        <div className="mt-3 space-y-1.5">
          {loading && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando histórico…
            </div>
          )}
          {!loading && historico.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Nenhum relatório gerado ainda. Use os botões acima para exportar.
            </p>
          )}
          {!loading &&
            historico.map((h) => (
              <div
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="truncate font-mono">{h.filename}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {h.formato}
                  </Badge>
                  {h.total != null && (
                    <span className="text-muted-foreground">{h.total} linhas</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>{h.usuario}</span>
                  <span>·</span>
                  <span>{h.quandoLabel}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={exportando !== null}
                    onClick={() => void reexportarHistorico(h)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
        </div>
      </Card>

      <RelatorioFiltrosModal
        relatorio={openKey}
        open={openKey !== null}
        onOpenChange={(o) => !o && setOpenKey(null)}
        onGerado={() => void carregar()}
      />
    </div>
  );
}
