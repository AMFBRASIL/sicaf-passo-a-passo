import { createFileRoute } from "@tanstack/react-router";
import { empresasMock } from "@/routes/empresas";
import { AlertTriangle, CheckCircle2, ShieldCheck, X, Sparkles, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/faltam")({
  head: () => ({
    meta: [
      { title: "O que falta — CADBRASIL" },
      { name: "description", content: "Pendências e próximos passos de todas as suas empresas." },
    ],
  }),
  component: FaltamPage,
});

const pendencias = empresasMock.flatMap((e) => {
  const items: { empresa: string; cnpj: string; titulo: string; desc: string; status: "warn" | "danger"; acao: string }[] = [];
  if (e.sicaf === "vencido") {
    items.push({ empresa: e.nome, cnpj: e.cnpj, titulo: "SICAF vencido", desc: "Fora de licitações. Atualize urgentemente.", status: "danger", acao: "Atualizar" });
  } else if (e.sicaf === "atencao") {
    items.push({ empresa: e.nome, cnpj: e.cnpj, titulo: "SICAF vencendo", desc: `Validade: ${e.validade}`, status: "warn", acao: "Renovar" });
  }
  if (e.sicaf === "sem_cadastro") {
    items.push({ empresa: e.nome, cnpj: e.cnpj, titulo: "Sem cadastro SICAF", desc: "Empresa ainda não habilitada.", status: "danger", acao: "Cadastrar" });
  }
  return items;
});

function FaltamPage() {
  const total = pendencias.length;
  const criticas = pendencias.filter((p) => p.status === "danger").length;

  return (
    <div className="space-y-6">
      <PageHeader title="O que falta" subtitle={`${total} pendência${total !== 1 ? "s" : ""} em ${empresasMock.length} empresas`} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center">
              <X className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{criticas}</p>
              <p className="text-xs text-muted-foreground">Críticas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-warning/10 text-warning-foreground flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{total - criticas}</p>
              <p className="text-xs text-muted-foreground">Atenção</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-success/10 text-success flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{empresasMock.filter((e) => e.sicaf === "ativo").length}</p>
              <p className="text-xs text-muted-foreground">Em dia</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {pendencias.length === 0 && (
          <div className="rounded-2xl border bg-card p-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
            <p className="mt-3 font-semibold">Tudo em dia!</p>
            <p className="text-sm text-muted-foreground">Nenhuma pendência encontrada.</p>
          </div>
        )}
        {pendencias.map((p, i) => (
          <Card key={i} className={p.status === "danger" ? "border-danger/30" : "border-warning/30"}>
            <CardContent className="p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${
                  p.status === "danger" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning-foreground"
                }`}>
                  {p.status === "danger" ? <X className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{p.titulo}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.empresa} · CNPJ {p.cnpj}</p>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
              </div>
              <Button size="sm" variant={p.status === "danger" ? "default" : "outline"} className="shrink-0 gap-1">
                {p.acao} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
