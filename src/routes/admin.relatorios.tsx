import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, FileText, FileType, Download, Users, DollarSign, FileCheck2, Ticket, TrendingUp, Filter } from "lucide-react";
import { RelatorioFiltrosModal, type RelatorioKey } from "@/components/admin/relatorio-filtros-modal";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/relatorios")({
  component: RelatoriosPage,
});

const relatorios: { key: RelatorioKey; nome: string; desc: string; icon: any; ult: string }[] = [
  { key: "clientes",   nome: "Base de Clientes",   desc: "Lista completa com status, MRR e responsável",        icon: Users,       ult: "Gerado há 2h" },
  { key: "financeiro", nome: "Financeiro Mensal",  desc: "Recebimentos, inadimplência, renovações e cancelamentos", icon: DollarSign, ult: "Gerado ontem" },
  { key: "sicaf",      nome: "Gestão SICAF",       desc: "Níveis I a VI, vencimentos e pendências",              icon: FileCheck2,  ult: "Hoje 09:00" },
  { key: "suporte",    nome: "Suporte e SLA",      desc: "Tickets resolvidos, tempo médio, NPS",                 icon: Ticket,      ult: "Semanal · seg 08:00" },
  { key: "googleads",  nome: "Google Ads",         desc: "Palavras, ROAS, CPA, atribuição por cliente",          icon: TrendingUp,  ult: "Diário · 06:00" },
];

function RelatoriosPage() {
  const [openKey, setOpenKey] = useState<RelatorioKey | null>(null);

  const abrir = (k: RelatorioKey) => setOpenKey(k);
  const exportarRapido = (k: RelatorioKey, formato: string) => {
    const r = relatorios.find(x => x.key === k)!;
    toast.success(`${r.nome} exportado`, { description: `Formato ${formato} · período padrão (30 dias) · todas as colunas.` });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Exportação em Excel, PDF e CSV. Agendamento por e-mail.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => abrir("financeiro")}>Agendar envio</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {relatorios.map((r) => {
          const Icon = r.icon;
          return (
            <Card key={r.nome} className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">{r.nome}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.desc}</p>
                </div>
              </div>

              <Button size="sm" className="mt-4 w-full" onClick={() => abrir(r.key)}>
                <Filter className="mr-2 h-3.5 w-3.5" /> Filtros e exportação
              </Button>

              <div className="mt-2 flex gap-1.5">
                <Button size="sm" variant="outline" className="h-8 flex-1 gap-1 text-xs" onClick={() => exportarRapido(r.key, "Excel")}>
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Excel
                </Button>
                <Button size="sm" variant="outline" className="h-8 flex-1 gap-1 text-xs" onClick={() => exportarRapido(r.key, "PDF")}>
                  <FileType className="h-3.5 w-3.5 text-rose-600" /> PDF
                </Button>
                <Button size="sm" variant="outline" className="h-8 flex-1 gap-1 text-xs" onClick={() => exportarRapido(r.key, "CSV")}>
                  <FileText className="h-3.5 w-3.5 text-blue-600" /> CSV
                </Button>
              </div>
              <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">{r.ult}</p>
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
          <Badge variant="secondary" className="text-[10px]">18 arquivos · 142 MB</Badge>
        </div>
        <div className="mt-3 space-y-1.5">
          {[
            { f: "base_clientes_2026-06-06.xlsx", t: "Excel", who: "Anderson", when: "Hoje 14:22" },
            { f: "financeiro_maio_2026.pdf", t: "PDF", who: "Maria S.", when: "Hoje 09:05" },
            { f: "sicaf_ativos.csv", t: "CSV", who: "Sistema", when: "Ontem 06:00" },
            { f: "google_ads_30d.xlsx", t: "Excel", who: "João P.", when: "2d atrás" },
          ].map((h, i) => (
            <div key={i} className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span className="font-mono">{h.f}</span>
                <Badge variant="outline" className="text-[10px]">{h.t}</Badge>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span>{h.who}</span>
                <span>·</span>
                <span>{h.when}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toast.success(`Baixando ${h.f}`)}>
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
      />
    </div>
  );
}
