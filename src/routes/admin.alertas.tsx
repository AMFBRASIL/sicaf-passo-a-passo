import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  ShieldAlert,
  Receipt,
  Ticket,
  FileWarning,
  Clock,
  CheckCircle2,
  EyeOff,
  Loader2,
  RefreshCw,
  Search,
  ExternalLink,
} from "lucide-react";
import { TratarAlertaModal, type AlertaItem } from "@/components/admin/tratar-alerta-modal";
import { IgnorarAlertaModal } from "@/components/admin/ignorar-alerta-modal";
import { toast } from "sonner";
import {
  fetchAdminAlertas,
  ignorarAlertaAdmin,
  marcarAlertasVistos,
  tratarAlertaAdmin,
  type AdminAlerta,
} from "@/lib/admin-alertas-api";

export const Route = createFileRoute("/admin/alertas")({
  component: AlertasPage,
});

interface AlertaUi extends AdminAlerta {
  icon: typeof AlertTriangle;
}

const tomCls: Record<string, string> = {
  rose: "border-rose-500/40 bg-rose-500/5 text-rose-700 dark:text-rose-300",
  amber: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300",
  violet: "border-violet-500/40 bg-violet-500/5 text-violet-700 dark:text-violet-300",
};

function iconPorCategoria(categoria?: string) {
  switch (categoria) {
    case "certidao":
    case "sicaf":
    case "sicaf_pendente":
      return ShieldAlert;
    case "boleto":
    case "pagamento":
    case "taxa_sicaf":
      return Receipt;
    case "ticket":
      return Ticket;
    case "documento":
      return FileWarning;
    default:
      return AlertTriangle;
  }
}

function toAlertaUi(a: AdminAlerta): AlertaUi {
  return { ...a, icon: iconPorCategoria(a.categoria) };
}

function AlertaAcaoLink({ url }: { url: string }) {
  const sicafMatch = url.match(/^\/sicaf\?cnpj=(.+)$/);
  if (sicafMatch) {
    const cnpj = decodeURIComponent(sicafMatch[1]);
    return (
      <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
        <Link to="/sicaf" search={{ cnpj }}>
          <ExternalLink className="mr-1 h-3 w-3" />
          Abrir
        </Link>
      </Button>
    );
  }
  return (
    <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
      <Link to={url}>
        <ExternalLink className="mr-1 h-3 w-3" />
        Abrir
      </Link>
    </Button>
  );
}

function AlertasPage() {
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [ativos, setAtivos] = useState<AlertaUi[]>([]);
  const [historico, setHistorico] = useState<AlertaUi[]>([]);
  const [totalComputados, setTotalComputados] = useState(0);
  const [tratarOpen, setTratarOpen] = useState(false);
  const [ignorarOpen, setIgnorarOpen] = useState(false);
  const [selected, setSelected] = useState<AlertaUi | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await fetchAdminAlertas();
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao carregar alertas");
      return;
    }
    setAtivos((res.ativos || []).map(toAlertaUi));
    setHistorico((res.historico || []).map(toAlertaUi));
    setTotalComputados(res.totalComputados ?? res.ativos?.length ?? 0);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return ativos;
    return ativos.filter(
      (a) =>
        a.tipo.toLowerCase().includes(q) ||
        a.cli.toLowerCase().includes(q) ||
        a.det.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q),
    );
  }, [ativos, busca]);

  const abrirTratar = (a: AlertaUi) => {
    setSelected(a);
    setTratarOpen(true);
  };
  const abrirIgnorar = (a: AlertaUi) => {
    setSelected(a);
    setIgnorarOpen(true);
  };

  const payloadBase = (a: AlertaItem & { id?: string; categoria?: string; referenciaId?: number }) => {
    if (!a.id || !a.categoria || a.referenciaId == null) return null;
    return {
      id: a.id,
      categoria: a.categoria,
      referenciaId: a.referenciaId,
      clienteId: a.clienteId,
      tipo: a.tipo,
      cli: a.cli,
      det: a.det,
      em: a.em,
      tom: a.tom,
      acaoUrl: a.acaoUrl,
    };
  };

  const marcarTratado = async (alerta: AlertaItem, acao: string, observacao: string) => {
    const payload = payloadBase(alerta);
    if (!payload) return;
    setSalvando(true);
    const res = await tratarAlertaAdmin({ ...payload, acao, observacao });
    setSalvando(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao tratar alerta");
      return;
    }
    await carregar();
  };

  const marcarIgnorado = async (alerta: AlertaItem, motivo: string) => {
    const payload = payloadBase(alerta);
    if (!payload) return;
    setSalvando(true);
    const res = await ignorarAlertaAdmin({ ...payload, motivo });
    setSalvando(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao ignorar alerta");
      return;
    }
    toast.info("Alerta ignorado", { description: motivo });
    await carregar();
  };

  const marcarTodos = async () => {
    if (ativos.length === 0) return;
    setSalvando(true);
    const res = await marcarAlertasVistos();
    setSalvando(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao marcar alertas");
      return;
    }
    toast.success(res.message || "Todos os alertas marcados como vistos");
    await carregar();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Central de Alertas</h1>
          <p className="text-sm text-muted-foreground">
            Tudo que está prestes a virar problema, em um único lugar ·{" "}
            <span className="font-medium text-foreground">{ativos.length}</span> ativos
            {totalComputados > ativos.length
              ? ` · ${totalComputados.toLocaleString("pt-BR")} detectados no total`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar alerta, cliente..."
              className="h-9 w-56 pl-8 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Atualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void marcarTodos()}
            disabled={ativos.length === 0 || salvando}
          >
            Marcar todos como vistos
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando alertas do sistema...
        </div>
      ) : filtrados.length === 0 ? (
        <Card className="border-dashed p-10 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <p className="mt-3 text-sm font-medium">
            {busca ? "Nenhum alerta encontrado para a busca" : "Nenhum alerta ativo no momento"}
          </p>
          <p className="text-xs text-muted-foreground">
            {busca ? "Tente outro termo ou limpe o filtro." : "Tudo sob controle. Bom trabalho!"}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((a) => {
            const Icon = a.icon;
            return (
              <Card key={a.id} className={`flex items-start gap-3 border p-4 ${tomCls[a.tom]}`}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background/60">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{a.tipo}</p>
                    <Badge variant="outline" className="shrink-0 gap-1 text-[10px]">
                      <Clock className="h-3 w-3" /> {a.em}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-foreground/80">{a.cli}</p>
                  <p className="mt-1 text-xs opacity-80">{a.det}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 bg-background text-xs"
                      onClick={() => abrirTratar(a)}
                      disabled={salvando}
                    >
                      Tratar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => abrirIgnorar(a)}
                      disabled={salvando}
                    >
                      Ignorar
                    </Button>
                    {a.acaoUrl && <AlertaAcaoLink url={a.acaoUrl} />}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {historico.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            Histórico recente ({historico.length})
          </h2>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {historico.map((a) => (
              <Card key={`${a.id}-${a.estado}`} className="flex items-center gap-3 p-3 opacity-70">
                {a.estado === "tratado" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <EyeOff className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{a.tipo}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{a.cli}</p>
                </div>
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {a.estado}
                </Badge>
              </Card>
            ))}
          </div>
        </div>
      )}

      <TratarAlertaModal
        open={tratarOpen}
        onOpenChange={setTratarOpen}
        alerta={selected}
        onResolver={(alerta, acao, observacao) => void marcarTratado(alerta, acao, observacao)}
      />
      <IgnorarAlertaModal
        open={ignorarOpen}
        onOpenChange={setIgnorarOpen}
        alerta={selected}
        onConfirmar={(alerta, motivo) => void marcarIgnorado(alerta, motivo)}
      />
    </div>
  );
}
