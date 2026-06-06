import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle2, XCircle, RotateCw, Eye, FolderOpen } from "lucide-react";

export const Route = createFileRoute("/admin/documentos")({
  component: DocumentosPage,
});

type Tipo = "Contrato Social" | "Certidão" | "Balanço" | "Procuração";
type Status = "Pendente" | "Aprovado" | "Rejeitado" | "Reenvio";

interface Doc { cli: string; arq: string; tipo: Tipo; status: Status; data: string; tamanho: string; }

const docs: Doc[] = [
  { cli: "JR Construtora EIRELI", arq: "contrato_social_v3.pdf", tipo: "Contrato Social", status: "Pendente", data: "Hoje 10:14", tamanho: "2.1 MB" },
  { cli: "Solar Brasil Energia", arq: "cnd_federal.pdf", tipo: "Certidão", status: "Aprovado", data: "Ontem 16:22", tamanho: "412 KB" },
  { cli: "Engemax Serviços", arq: "balanco_2024.pdf", tipo: "Balanço", status: "Pendente", data: "Hoje 09:01", tamanho: "5.8 MB" },
  { cli: "Construtora Aurora", arq: "procuracao_socio.pdf", tipo: "Procuração", status: "Reenvio", data: "2d atrás", tamanho: "1.2 MB" },
  { cli: "Pavimar Obras", arq: "cnd_inss.pdf", tipo: "Certidão", status: "Rejeitado", data: "3d atrás", tamanho: "330 KB" },
  { cli: "TecnoLimp Servicos", arq: "contrato_alteracao.pdf", tipo: "Contrato Social", status: "Aprovado", data: "1 semana", tamanho: "1.8 MB" },
];

const tipos: ("Todos" | Tipo)[] = ["Todos", "Contrato Social", "Certidão", "Balanço", "Procuração"];

const statusCls: Record<Status, string> = {
  Pendente: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Aprovado: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Rejeitado: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  Reenvio: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
};

function DocumentosPage() {
  const [tipo, setTipo] = useState<"Todos" | Tipo>("Todos");
  const list = docs.filter((d) => tipo === "Todos" || d.tipo === tipo);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Gestão de Documentos</h1>
          <p className="text-sm text-muted-foreground">Aprovar, rejeitar ou solicitar reenvio.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5"><FolderOpen className="h-3.5 w-3.5" /> Pasta do cliente</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Mini label="Pendentes" value={docs.filter(d => d.status === "Pendente").length} tone="amber" />
        <Mini label="Aprovados (mês)" value={42} tone="emerald" />
        <Mini label="Rejeitados (mês)" value={8} tone="rose" />
        <Mini label="Reenvios solicitados" value={5} tone="blue" />
      </div>

      <Card className="mt-5 p-4">
        <div className="flex flex-wrap gap-1.5">
          {tipos.map((t) => (
            <Button key={t} variant={tipo === t ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setTipo(t)}>
              {t}
            </Button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {list.map((d, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-3 transition hover:bg-muted/30">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.arq}</p>
                    <p className="truncate text-xs text-muted-foreground">{d.cli}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCls[d.status]}`}>{d.status}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{d.tipo}</Badge>
                  <span>{d.tamanho}</span>
                  <span>·</span>
                  <span>{d.data}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1"><Eye className="h-3 w-3" /> Visualizar</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3 w-3" /> Aprovar</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-rose-500/30 text-rose-700 dark:text-rose-300"><XCircle className="h-3 w-3" /> Rejeitar</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1"><RotateCw className="h-3 w-3" /> Solicitar reenvio</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Mini({ label, value, tone }: any) {
  const tones: Record<string, string> = {
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
    blue: "text-blue-600",
  };
  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </Card>
  );
}
