import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Plus, Rocket, RefreshCw, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge } from "@/components/page-header";

export const Route = createFileRoute("/empresas")({
  head: () => ({
    meta: [
      { title: "Minhas Empresas — CADBRASIL" },
      { name: "description", content: "Gerencie o SICAF de todas as suas empresas em um só lugar." },
    ],
  }),
  component: EmpresasPage,
});

type SicafStatus = "ativo" | "atencao" | "vencido" | "sem_cadastro";

const empresas: Array<{
  nome: string;
  cnpj: string;
  sicaf: SicafStatus;
  validade?: string;
  proximoPasso: string;
  acao: { label: string; variant?: "default" | "outline"; icon: typeof Rocket };
}> = [
  {
    nome: "Empresa Demonstração LTDA",
    cnpj: "00.000.000/0001-00",
    sicaf: "atencao",
    validade: "28/02/2026",
    proximoPasso: "Atualizar Nível III e IV antes do vencimento.",
    acao: { label: "Atualizar SICAF", icon: Rocket },
  },
  {
    nome: "JR Comércio e Serviços ME",
    cnpj: "12.345.678/0001-99",
    sicaf: "ativo",
    validade: "10/09/2026",
    proximoPasso: "Tudo em dia. Vamos monitorar por você.",
    acao: { label: "Ver detalhes", variant: "outline", icon: RefreshCw },
  },
  {
    nome: "JR Construtora EIRELI",
    cnpj: "23.456.789/0001-11",
    sicaf: "vencido",
    validade: "Vencido em 14/10/2025",
    proximoPasso: "Sua empresa está fora de licitações. Atualize agora.",
    acao: { label: "Resolver agora", icon: Rocket },
  },
  {
    nome: "Nova Filial Brasília LTDA",
    cnpj: "34.567.890/0001-22",
    sicaf: "sem_cadastro",
    proximoPasso: "Esta empresa ainda não possui SICAF. Vamos cadastrar?",
    acao: { label: "Cadastrar SICAF", icon: Plus },
  },
];

const statusLabel: Record<SicafStatus, { label: string; status: "ok" | "warn" | "danger" | "idle" }> = {
  ativo: { label: "SICAF Ativo", status: "ok" },
  atencao: { label: "Atualização recomendada", status: "warn" },
  vencido: { label: "SICAF Vencido", status: "danger" },
  sem_cadastro: { label: "Sem cadastro SICAF", status: "idle" },
};

function EmpresasPage() {
  const total = empresas.length;
  const ativos = empresas.filter((e) => e.sicaf === "ativo").length;
  const precisamAcao = empresas.filter(
    (e) => e.sicaf === "vencido" || e.sicaf === "atencao" || e.sicaf === "sem_cadastro",
  ).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<Building2 className="h-5 w-5" />}
        title="Minhas Empresas"
        subtitle="Gerencie o SICAF de cada CNPJ — atualize ou cadastre novos."
        action={
          <Button size="lg" className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar nova empresa
          </Button>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Empresas cadastradas</p>
            <p className="mt-1 text-3xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">SICAFs em dia</p>
            <p className="mt-1 text-3xl font-bold text-success">{ativos}</p>
          </CardContent>
        </Card>
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Precisam de ação</p>
            <p className="mt-1 text-3xl font-bold text-warning-foreground">{precisamAcao}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Selecione uma empresa para continuar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {empresas.map((e) => {
            const meta = statusLabel[e.sicaf];
            const Icon = e.acao.icon;
            return (
              <div
                key={e.cnpj}
                className={`flex flex-col gap-4 rounded-xl border p-5 transition hover:shadow-soft sm:flex-row sm:items-center sm:justify-between ${
                  e.sicaf === "vencido"
                    ? "border-danger/30 bg-danger/5"
                    : e.sicaf === "atencao"
                    ? "border-warning/40 bg-warning/5"
                    : e.sicaf === "sem_cadastro"
                    ? "border-dashed border-border bg-muted/30"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold leading-tight">{e.nome}</p>
                    <p className="text-xs text-muted-foreground">CNPJ {e.cnpj}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={meta.status}>{meta.label}</StatusBadge>
                      {e.validade && (
                        <span className="text-xs text-muted-foreground">
                          {e.sicaf === "vencido" ? e.validade : `Validade: ${e.validade}`}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{e.proximoPasso}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2 sm:flex-col sm:items-stretch">
                  <Button asChild variant={e.acao.variant ?? "default"} className="gap-2">
                    <Link to="/sicaf">
                      <Icon className="h-4 w-4" />
                      {e.acao.label}
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                    Definir como ativa
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="mt-4 border-dashed">
        <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Tem mais empresas para gerenciar?</p>
              <p className="text-sm text-muted-foreground">
                Adicione quantos CNPJs precisar — cuidamos do SICAF de todos.
              </p>
            </div>
          </div>
          <Button size="lg" variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar empresa
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
