import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  FileSignature,
  ShieldCheck,
  Wrench,
  ArrowRight,
  Building2,
  CheckCircle2,
  Ban,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge } from "@/components/page-header";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ManutencaoModal } from "@/components/manutencao-modal";
import { empresasMock, statusLabel, type EmpresaData } from "./empresas";

export const Route = createFileRoute("/servicos")({
  head: () => ({
    meta: [
      { title: "Meus Serviços — CADBRASIL" },
      { name: "description", content: "Veja os serviços ativos da sua empresa." },
    ],
  }),
  component: ServPage,
});

const servicos = [
  { id: "sicaf", nome: "Cadastro SICAF Completo", descricao: "Cadastro e atualização nos níveis I a VI.", status: "ok" as const, label: "Ativo" },
  { id: "cert", nome: "Monitoramento de Certidões", descricao: "Acompanhamento diário de validade.", status: "ok" as const, label: "Ativo" },
  { id: "ia", nome: "Assistente IA para Licitações", descricao: "Recomendações personalizadas todos os dias.", status: "ok" as const, label: "Ativo" },
  { id: "manutencao", nome: "Manutenção Mensal", descricao: "Renovação automática de documentos.", status: "idle" as const, label: "Não contratado" },
];

function ServPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeEmpresa, setActiveEmpresa] = useState<EmpresaData | null>(null);
  const [modalMode, setModalMode] = useState<"ativar" | "gerenciar">("ativar");
  const [ativadas, setAtivadas] = useState<Record<string, number>>({});

  const handleContratar = (empresa: EmpresaData) => {
    setActiveEmpresa(empresa);
    setModalMode(ativadas[empresa.cnpj] ? "gerenciar" : "ativar");
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<FileSignature className="h-5 w-5" />}
        title="Meus Serviços"
        subtitle="Tudo que a CADBRASIL faz pela sua empresa."
      />

      <div className="mt-6 grid gap-3">
        {servicos.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {s.id === "manutencao" ? <Wrench className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-semibold">{s.nome}</p>
                  <p className="text-sm text-muted-foreground">{s.descricao}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={s.status}>{s.label}</StatusBadge>
                {s.status === "idle" && (
                  <Button size="sm" onClick={() => s.id === "manutencao" && setSheetOpen(true)}>
                    Contratar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Contrato vigente</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">CADBRASIL Licença Anual 2025/2026</span> — assinado em
            15/03/2025. Próxima renovação automática em 15/03/2026.
          </p>
          <Button variant="link" className="mt-2 h-auto p-0">Baixar contrato em PDF →</Button>
        </CardContent>
      </Card>

      {/* Lateral - escolha de empresa */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-br from-primary/5 to-transparent">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-lg">Manutenção SICAF</SheetTitle>
                <SheetDescription>Selecione a empresa para contratar o plano</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="px-6 py-5 space-y-3">
              {empresasMock.map((e) => {
                const meta = statusLabel[e.sicaf];
                const podeContratar = e.sicaf === "ativo";
                const jaContratada = !!ativadas[e.cnpj];
                return (
                  <div
                    key={e.cnpj}
                    className="rounded-2xl border bg-card p-4 hover:shadow-soft transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="h-10 w-10 shrink-0 rounded-xl bg-muted flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{e.nome}</p>
                          <p className="text-xs text-muted-foreground font-mono">{e.cnpj}</p>
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <StatusBadge status={meta.status}>{meta.label}</StatusBadge>
                            {jaContratada && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 text-success px-2 py-0.5 text-[11px] font-semibold">
                                <CheckCircle2 className="h-3 w-3" /> Manutenção ativa
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {jaContratada
                          ? `Ativada · vencimento dia ${ativadas[e.cnpj]}`
                          : podeContratar
                          ? "Pronto para contratar"
                          : "Requer SICAF ativo para contratar"}
                      </p>
                      <Button
                        size="sm"
                        variant={jaContratada ? "outline" : "default"}
                        disabled={!podeContratar && !jaContratada}
                        onClick={() => handleContratar(e)}
                        className="shrink-0"
                      >
                        {jaContratada ? (
                          <>Ver painel <ArrowRight className="ml-1 h-4 w-4" /></>
                        ) : podeContratar ? (
                          <>Contratar Manutenção <Sparkles className="ml-1 h-4 w-4" /></>
                        ) : (
                          <>Indisponível <Ban className="ml-1 h-4 w-4" /></>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Mesmo modal usado em /empresas */}
      <ManutencaoModal
        open={activeEmpresa !== null}
        onOpenChange={(v) => !v && setActiveEmpresa(null)}
        empresa={activeEmpresa}
        mode={modalMode}
        diaVencimento={activeEmpresa ? ativadas[activeEmpresa.cnpj] : undefined}
        onAtivar={(cnpj, dia) => setAtivadas((p) => ({ ...p, [cnpj]: dia }))}
      />
    </div>
  );
}
