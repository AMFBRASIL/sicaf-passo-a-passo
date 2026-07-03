import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Kanban,
  Plus,
  Search,
  Filter,
  DollarSign,
  CalendarClock,
  UserCog,
  MessageCircle,
  PhoneCall,
  Mail,
  Users2,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  CrmClienteWizardModal,
  STAGES,
  PRIORIDADES,
  type CrmStage,
  type NovoCrmCard,
  type CrmConsultor,
} from "@/components/admin/crm-cliente-wizard-modal";
import {
  CrmClienteDetalheModal,
  type CrmCardData,
} from "@/components/admin/crm-cliente-detalhe-modal";
import { CrmClienteEditarModal } from "@/components/admin/crm-cliente-editar-modal";
import {
  atualizarCrmCard,
  criarCrmCard,
  fetchCrmCards,
  fetchCrmConsultores,
  searchCrmClientes,
  syncCrmAnexosPendentes,
} from "@/lib/admin-crm-api";
import type { CrmCliente } from "@/components/admin/crm-cliente-wizard-modal";

export const Route = createFileRoute("/admin/crm-clientes")({
  component: CrmClientesPage,
});

const CANAL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  whatsapp: MessageCircle,
  ligacao: PhoneCall,
  email: Mail,
  presencial: Users2,
};

function CrmClientesPage() {
  const [cards, setCards] = useState<CrmCardData[]>([]);
  const [consultores, setConsultores] = useState<CrmConsultor[]>([]);
  const [clientesBusca, setClientesBusca] = useState<CrmCliente[]>([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [ativo, setAtivo] = useState<CrmCardData | null>(null);
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [consultorFiltro, setConsultorFiltro] = useState<string>("todos");
  const [kpis, setKpis] = useState({ emFunil: 0, pipeline: 0, liberado: 0, negociacao: 0 });

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 350);
    return () => clearTimeout(t);
  }, [busca]);

  const carregar = useCallback(async () => {
    setLoading(true);
    const [cardsRes, consRes] = await Promise.all([
      fetchCrmCards(buscaDebounced, consultorFiltro),
      fetchCrmConsultores(),
    ]);
    setLoading(false);

    if (!cardsRes.ok) {
      toast.error(cardsRes.error || "Erro ao carregar CRM");
      return;
    }
    if (!consRes.ok) {
      toast.error(consRes.error || "Erro ao carregar consultores");
    }

    setCards(cardsRes.cards || []);
    setKpis(cardsRes.kpis || { emFunil: 0, pipeline: 0, liberado: 0, negociacao: 0 });
    if (consRes.consultores?.length) setConsultores(consRes.consultores);
  }, [buscaDebounced, consultorFiltro]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const buscarClientes = useCallback(async (termo: string) => {
    setBuscandoClientes(true);
    const res = await searchCrmClientes(termo);
    setBuscandoClientes(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao buscar clientes");
      return;
    }
    setClientesBusca(res.clientes || []);
  }, []);

  useEffect(() => {
    if (wizardOpen) void buscarClientes("");
  }, [wizardOpen, buscarClientes]);

  const byStage = useMemo(() => {
    const map: Record<CrmStage, CrmCardData[]> = {
      em_negociacao: [], boleto: [], liberado: [], em_uso: [], cancelado: [],
    };
    cards.forEach((c) => map[c.stage].push(c));
    return map;
  }, [cards]);

  async function handleCreate(novo: NovoCrmCard) {
    const res = await criarCrmCard({
      clienteId: parseInt(novo.cliente.id, 10),
      stage: novo.stage,
      consultorId: novo.consultorId,
      prioridade: novo.prioridade,
      canal: novo.canal,
      valor: novo.valor,
      boleto: novo.boleto,
      proximaAcao: novo.proximaAcao,
      dataAcao: novo.dataAcao,
      notas: novo.notas,
      tags: novo.tags,
      progressoDocs: 10,
    });

    if (!res.ok || !res.card) {
      toast.error(res.error || "Erro ao criar card");
      throw new Error(res.error || "Erro ao criar card");
    }

    if (novo.anexos?.length) {
      try {
        await syncCrmAnexosPendentes(res.card.id, novo.anexos);
      } catch {
        toast.warning("Card criado, mas alguns anexos não foram enviados.");
      }
    }

    toast.success(`Card ${res.card.id} criado no funil`);
    await carregar();
  }

  function abrirDetalhe(c: CrmCardData) {
    setAtivo(c);
    setDetalheOpen(true);
  }

  function abrirEditar(c: CrmCardData) {
    setAtivo(c);
    setDetalheOpen(false);
    setEditarOpen(true);
  }

  async function handleSalvarEdicao(updated: CrmCardData, mudouEtapa: boolean, etapaAnterior: CrmStage) {
    const res = await atualizarCrmCard(updated.id, {
      stage: updated.stage,
      consultorId: updated.consultorId,
      prioridade: updated.prioridade,
      canal: updated.canal,
      valor: updated.valor,
      boleto: updated.boleto,
      proximaAcao: updated.proximaAcao,
      dataAcao: updated.dataAcao,
      notas: updated.notas,
      tags: updated.tags,
      progressoDocs: updated.progressoDocs,
    });

    if (!res.ok || !res.card) {
      toast.error(res.error || "Erro ao salvar card");
      return;
    }

    const anexosNovos = (updated.anexos || []).filter((a) => !/^\d+$/.test(a.id) || a.url.startsWith("data:"));
    if (anexosNovos.length) {
      await syncCrmAnexosPendentes(updated.id, anexosNovos);
    }

    toast.success(mudouEtapa ? `Etapa alterada de ${etapaAnterior}` : "Card atualizado");
    setAtivo(res.card);
    await carregar();
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        icon={<Kanban className="h-5 w-5" />}
        title="CRM Clientes"
        subtitle="Kanban dos clientes em atendimento pelos consultores CADBRASIL"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void carregar()} disabled={loading} className="gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar
            </Button>
            <Button onClick={() => setWizardOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Novo cliente no funil
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icone={<Users2 className="h-4 w-4" />} label="Clientes em funil" valor={String(kpis.emFunil)} cor="text-primary" />
        <KpiCard
          icone={<DollarSign className="h-4 w-4" />}
          label="Pipeline ativo"
          valor={`R$ ${kpis.pipeline.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          cor="text-emerald-600"
        />
        <KpiCard icone={<TrendingUp className="h-4 w-4" />} label="Financeiro liberado" valor={String(kpis.liberado)} cor="text-sky-600" />
        <KpiCard icone={<AlertTriangle className="h-4 w-4" />} label="Em uso" valor={String(kpis.negociacao)} cor="text-amber-600" />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, CNPJ ou ID do atendimento..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
          <button
            onClick={() => setConsultorFiltro("todos")}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold",
              consultorFiltro === "todos" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted",
            )}
          >
            Todos consultores
          </button>
          {consultores.map((c) => (
            <button
              key={c.id}
              onClick={() => setConsultorFiltro(c.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold",
                consultorFiltro === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted",
              )}
            >
              {c.nome.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {loading && cards.length === 0 ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Carregando funil CRM...
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {STAGES.map((s) => {
            const Icon = s.icon;
            const items = byStage[s.id];
            return (
              <div key={s.id} className="flex min-h-[240px] flex-col rounded-2xl border border-border bg-muted/30">
                <div className={cn("flex items-center justify-between rounded-t-2xl bg-gradient-to-br px-4 py-3 text-white", s.cor)}>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">Etapa</p>
                      <p className="text-sm font-bold leading-tight">{s.titulo}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">{items.length}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  {items.length === 0 && (
                    <div className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-8 text-center">
                      <Sparkles className="h-4 w-4 text-muted-foreground" />
                      <p className="mt-1 text-[11px] text-muted-foreground">Sem clientes nesta etapa</p>
                    </div>
                  )}
                  {items.map((c) => {
                    const cons = consultores.find((x) => x.id === c.consultorId);
                    const prio = PRIORIDADES.find((x) => x.id === c.prioridade);
                    const CanalIcon = CANAL_ICON[c.canal] ?? MessageCircle;
                    return (
                      <button
                        key={c.id}
                        onClick={() => abrirDetalhe(c)}
                        className="group rounded-xl border border-border bg-card p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold leading-tight">{c.cliente.razao}</p>
                            <p className="text-[11px] text-muted-foreground">{c.cliente.cnpj}</p>
                          </div>
                          <span className={cn("shrink-0 h-2 w-2 rounded-full mt-1.5", prio?.cor ?? "bg-muted")} />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {c.tags.slice(0, 2).map((t) => (
                            <span key={t} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                              {t}
                            </span>
                          ))}
                        </div>
                        {c.proximaAcao && (
                          <div className="mt-2 flex items-start gap-1.5 rounded-md bg-muted/60 px-2 py-1.5 text-[11px]">
                            <CalendarClock className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                            <span className="line-clamp-2">{c.proximaAcao}</span>
                          </div>
                        )}
                        <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <UserCog className="h-3 w-3" /> {cons?.nome.split(" ")[0] || "—"}
                          </span>
                          <span className="flex items-center gap-1">
                            <CanalIcon className="h-3 w-3" />
                            {c.valor && <span className="font-semibold text-foreground">{c.valor}</span>}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CrmClienteWizardModal
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreate={handleCreate}
        clientes={clientesBusca}
        consultores={consultores}
        onBuscaCliente={buscarClientes}
        buscandoClientes={buscandoClientes}
      />
      <CrmClienteDetalheModal
        open={detalheOpen}
        onOpenChange={setDetalheOpen}
        card={ativo}
        onEditar={abrirEditar}
        consultores={consultores}
      />
      <CrmClienteEditarModal
        open={editarOpen}
        onOpenChange={setEditarOpen}
        card={ativo}
        onSave={handleSalvarEdicao}
        consultores={consultores}
      />
    </div>
  );
}

function KpiCard({ icone, label, valor, cor }: { icone: React.ReactNode; label: string; valor: string; cor: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className={cn("flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider", cor)}>
        {icone} {label}
      </div>
      <p className="mt-1.5 text-2xl font-bold tabular-nums">{valor}</p>
    </div>
  );
}
