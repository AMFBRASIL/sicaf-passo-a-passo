import { createFileRoute, Link } from "@tanstack/react-router";
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
  Ban,
  Search,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Building2,
  Clock,
  Inbox,
  Scale,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import {
  type CancelamentoStatus,
  type CancelamentoResumo,
  type SolicitacaoCancelamento,
  STATUS_BADGE,
  fetchCancelamentos,
} from "@/lib/cancelamentos-api";
import { CancelamentoWizardModal } from "@/components/admin/cancelamento-wizard-modal";
import {
  ClienteDetalheModal,
  type ClienteDetalhe,
} from "@/components/admin/cliente-detalhe-modal";

export const Route = createFileRoute("/admin/cancelamentos")({
  component: CancelamentosPage,
});

type FiltroStatus = "todos" | CancelamentoStatus | "abertas";

function stubClienteDetalhe(id: number, s?: SolicitacaoCancelamento | null): ClienteDetalhe {
  return {
    id: String(id),
    razao: s?.razaoSocial || "Cliente",
    cnpj: s?.documento || "",
    responsavel: "—",
    cidade: [s?.cidade, s?.estado].filter(Boolean).join("/") || "—",
    email: s?.email || undefined,
    telefone: s?.telefone || undefined,
    sicaf: "pendente",
    pagou: false,
    manutencao: false,
    novo: false,
    mrr: 0,
    ultimoContato: "—",
    niveis: {},
  };
}

function CancelamentosPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SolicitacaoCancelamento[]>([]);
  const [resumo, setResumo] = useState<CancelamentoResumo | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [filtro, setFiltro] = useState<FiltroStatus>("abertas");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selId, setSelId] = useState<number | null>(null);
  const [empresaOpen, setEmpresaOpen] = useState(false);
  const [empresaSel, setEmpresaSel] = useState<ClienteDetalhe | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), 350);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    setPagination((p) => ({ ...p, page: 1 }));
  }, [buscaDebounced, filtro]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = filtro === "todos" ? "todos" : filtro;
      const res = await fetchCancelamentos({
        page: pagination.page,
        pageSize: pagination.pageSize,
        q: buscaDebounced,
        status: statusParam,
      });
      if (!res.ok) {
        toast.error(res.error || "Erro ao listar cancelamentos");
        setItems([]);
        return;
      }
      setItems(res.items || []);
      setResumo(res.resumo || null);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, buscaDebounced, filtro]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abrir = (id: number) => {
    setSelId(id);
    setWizardOpen(true);
  };

  const abrirEmpresa = (clienteId: number) => {
    const s = items.find((i) => i.clienteId === clienteId) || null;
    setEmpresaSel(stubClienteDetalhe(clienteId, s));
    setEmpresaOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-2">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground" asChild>
              <Link to="/admin/cobranca">
                <ArrowLeft className="h-3.5 w-3.5" /> Cobrança
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl flex items-center gap-2">
            <Ban className="h-7 w-7 text-rose-600" /> Solicitações de cancelamento
          </h1>
          <p className="text-sm text-muted-foreground">
            Disputas de cancelamento e reembolso — analise, responda por e-mail e acompanhe o status.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={loading} onClick={() => void carregar()}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
        <KPI icon={Inbox} tone="amber" label="Abertas" value={String(resumo?.abertas ?? "—")} />
        <KPI icon={Clock} tone="sky" label="Em andamento" value={String(resumo?.emAndamento ?? "—")} />
        <KPI icon={Scale} tone="violet" label="Em análise" value={String(resumo?.emAnalise ?? "—")} />
        <KPI
          icon={CheckCircle2}
          tone="emerald"
          label="Procedentes / processadas"
          value={String((resumo?.procedente ?? 0) + (resumo?.processada ?? 0))}
        />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por empresa, CNPJ, e-mail ou protocolo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Tabs value={filtro} onValueChange={(v) => setFiltro(v as FiltroStatus)}>
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="abertas">Abertas</TabsTrigger>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="solicitada">Solicitadas</TabsTrigger>
              <TabsTrigger value="em_analise">Em análise</TabsTrigger>
              <TabsTrigger value="procedente">Procedente</TabsTrigger>
              <TabsTrigger value="improcedente">Improcedente</TabsTrigger>
              <TabsTrigger value="processada">Processada</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="rounded-lg border">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando solicitações...
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Nenhuma solicitação encontrada.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Motivos</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => {
                  const badge = STATUS_BADGE[s.status] || STATUS_BADGE.solicitada;
                  return (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer"
                      onClick={() => abrir(s.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-md bg-rose-50 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-rose-500" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{s.razaoSocial || "—"}</div>
                            <div className="text-xs text-muted-foreground">{s.documento || "—"}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-mono text-xs">
                        {s.protocolo || `#${s.id}`}
                      </TableCell>
                      <TableCell className="text-sm max-w-[220px]">
                        <span className="line-clamp-2 text-muted-foreground">
                          {s.motivos.length ? s.motivos.join(" · ") : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.createdAt
                          ? new Date(s.createdAt).toLocaleDateString("pt-BR")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={badge.cls}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1.5">
                          {s.clienteId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8"
                              onClick={() => abrirEmpresa(s.clienteId!)}
                            >
                              Empresa
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => abrir(s.id)}>
                            Abrir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>
              Página {pagination.page} de {pagination.totalPages} · {pagination.total} registro(s)
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page <= 1 || loading}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <CancelamentoWizardModal
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        solicitacaoId={selId}
        onRespondido={() => void carregar()}
        onAbrirEmpresa={(clienteId) => {
          abrirEmpresa(clienteId);
        }}
      />

      <ClienteDetalheModal
        cliente={empresaSel}
        open={empresaOpen}
        onOpenChange={setEmpresaOpen}
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
  icon: typeof Inbox;
  label: string;
  value: string;
  tone: "amber" | "sky" | "violet" | "emerald";
}) {
  const tones: Record<string, string> = {
    amber: "text-amber-600 bg-amber-50",
    sky: "text-sky-600 bg-sky-50",
    violet: "text-violet-600 bg-violet-50",
    emerald: "text-emerald-600 bg-emerald-50",
  };
  return (
    <Card className="p-4 flex items-start gap-3">
      <div className={`rounded-lg p-2 ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      </div>
    </Card>
  );
}
