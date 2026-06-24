import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  HandCoins,
  Search,
  AlertTriangle,
  Clock,
  DollarSign,
  Users,
  FileText,
  Building2,
  Loader2,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Bell,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchCobrancasAdmin,
  formatBRL,
  type ClienteCobrancaPendente,
  type CobrancaPendentesResumo,
  type SeveridadeCobranca,
} from "@/lib/cobranca-api";
import { DisparoMassaModal } from "@/components/admin/disparo-massa-modal";
import { ReguaCobrancaModal } from "@/components/admin/regua-cobranca-modal";
import { CobrancaClienteModal } from "@/components/admin/cobranca-cliente-modal";

export const Route = createFileRoute("/admin/cobranca")({
  component: CobrancaPage,
});

const sevBadge: Record<SeveridadeCobranca, { label: string; cls: string }> = {
  leve: { label: "Leve", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  media: { label: "Atenção", cls: "bg-orange-100 text-orange-700 border-orange-200" },
  critica: { label: "Crítico", cls: "bg-rose-100 text-rose-700 border-rose-200" },
};

function CobrancaPage() {
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<ClienteCobrancaPendente[]>([]);
  const [resumo, setResumo] = useState<CobrancaPendentesResumo | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [filtro, setFiltro] = useState<"todos" | SeveridadeCobranca>("todos");
  const [selecionado, setSelecionado] = useState<ClienteCobrancaPendente | null>(null);
  const [disparoOpen, setDisparoOpen] = useState(false);
  const [reguaOpen, setReguaOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), 350);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    setPagination((p) => ({ ...p, page: 1 }));
  }, [buscaDebounced, filtro]);

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await fetchCobrancasAdmin({
      page: pagination.page,
      pageSize: pagination.pageSize,
      q: buscaDebounced || undefined,
      severidade: filtro,
    });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao carregar cobranças");
      return;
    }
    setClientes(res.clientes || []);
    setResumo(res.resumo || null);
    if (res.pagination) setPagination(res.pagination);
  }, [pagination.page, pagination.pageSize, buscaDebounced, filtro]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl flex items-center gap-2">
            <HandCoins className="h-7 w-7 text-rose-600" /> Cobrança
          </h1>
          <p className="text-sm text-muted-foreground">
            Clientes com pagamentos em aberto — execute cobranças, envie avisos e renegocie.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setDisparoOpen(true)}
          >
            <Bell className="h-3.5 w-3.5" />
            Disparo em massa
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-rose-600 hover:bg-rose-700"
            onClick={() => setReguaOpen(true)}
          >
            <Banknote className="h-3.5 w-3.5" />
            Régua de cobrança
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={loading} onClick={() => void carregar()}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
        <KPI icon={Users} tone="slate" label="Clientes em aberto" value={String(resumo?.total ?? "—")} />
        <KPI icon={DollarSign} tone="emerald" label="Valor total pendente" value={resumo ? formatBRL(resumo.valorTotal) : "—"} />
        <KPI icon={AlertTriangle} tone="rose" label="Casos críticos" value={String(resumo?.totalCriticos ?? resumo?.totalVencidos ?? "—")} />
        <KPI icon={Clock} tone="amber" label="Média de atraso" value={resumo?.mediaAtrasoDias != null ? `${resumo.mediaAtrasoDias} dias` : "—"} />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por empresa, CNPJ ou responsável..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Tabs value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="critica">Críticos</TabsTrigger>
              <TabsTrigger value="media">Atenção</TabsTrigger>
              <TabsTrigger value="leve">Leves</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="rounded-lg border">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando clientes...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Pendente desde</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cobrança</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((c) => {
                  const sev = (c.severidade || "leve") as SeveridadeCobranca;
                  return (
                    <TableRow key={c.clienteId} className="cursor-pointer" onClick={() => setSelecionado(c)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-md bg-slate-100 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-slate-500" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{c.company}</div>
                            <div className="text-xs text-muted-foreground">{c.cnpj}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate">{c.descricao}</TableCell>
                      <TableCell className="text-sm">
                        {c.pendenteDesdeFormatado || "—"}
                        <span className="block text-xs text-rose-600">{c.diasPendente} dias</span>
                      </TableCell>
                      <TableCell className="font-semibold text-sm">{formatBRL(c.valor)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={sevBadge[sev].cls}>
                          {sevBadge[sev].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {c.foiCobrado ? (
                          <span className="text-xs text-emerald-700">{c.ultimaCobrancaFormatada}</span>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 border-amber-200 text-[10px]">
                            Não cobrado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelecionado(c);
                          }}
                        >
                          Cobrar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {clientes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      Nenhum cliente pendente encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Página {pagination.page} de {pagination.totalPages} · {pagination.total} clientes
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1 || loading}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <CobrancaClienteModal
        cliente={selecionado}
        onClose={() => setSelecionado(null)}
        onAtualizado={() => void carregar()}
      />

      <DisparoMassaModal
        open={disparoOpen}
        onOpenChange={setDisparoOpen}
        onConcluido={() => void carregar()}
      />
      <ReguaCobrancaModal
        open={reguaOpen}
        onOpenChange={setReguaOpen}
        onSalvo={() => void carregar()}
      />
    </div>
  );
}

function KPI({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "slate" | "emerald" | "rose" | "amber";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-700",
    rose: "bg-rose-100 text-rose-700",
    amber: "bg-amber-100 text-amber-700",
  };
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </Card>
  );
}
