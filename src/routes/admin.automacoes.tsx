import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Bot,
  Zap,
  Mail,
  MessageCircle,
  FileCheck2,
  DollarSign,
  ArrowRight,
  Plus,
  Pencil,
  Bell,
  Calendar,
  CheckCircle2,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { FluxoAutomacaoModal, type FluxoAutomacao } from "@/components/admin/fluxo-automacao-modal";
import { FLUXOS_EXEMPLO } from "@/lib/automacoes-catalog";
import {
  fetchAutomacaoFluxos,
  salvarAutomacaoFluxo,
  toggleAutomacaoFluxo,
} from "@/lib/automacoes-api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/automacoes")({
  component: AutomacoesPage,
});

const ICONS: Record<string, any> = {
  email: Mail,
  whatsapp: MessageCircle,
  ticket: FileCheck2,
  tarefa: CheckCircle2,
  cobranca: DollarSign,
  acesso: Zap,
  alerta: Bell,
  agendar: Calendar,
  renovar_manutencao: RefreshCw,
};

function AutomacoesPage() {
  const [fluxos, setFluxos] = useState<FluxoAutomacao[]>(FLUXOS_EXEMPLO);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<FluxoAutomacao | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const res = await fetchAutomacaoFluxos();
      if (res.ok && res.fluxos?.length) {
        // Mantém exemplos locais se a API ainda não tiver todos (merge por id)
        const byId = new Map(FLUXOS_EXEMPLO.map((f) => [f.id!, f]));
        for (const f of res.fluxos) {
          if (f.id) byId.set(f.id, f);
        }
        setFluxos(Array.from(byId.values()));
      } else if (!res.ok) {
        setFluxos(FLUXOS_EXEMPLO);
        toast.error(res.error || "Não foi possível carregar os fluxos.");
      } else {
        setFluxos(FLUXOS_EXEMPLO);
      }
    } catch {
      setFluxos(FLUXOS_EXEMPLO);
      toast.error("Erro ao carregar automações.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const novo = () => {
    setEditando(null);
    setModalOpen(true);
  };

  const editar = (f: FluxoAutomacao) => {
    setEditando(f);
    setModalOpen(true);
  };

  const salvar = async (f: FluxoAutomacao) => {
    const res = await salvarAutomacaoFluxo(f);
    if (!res.ok || !res.fluxo) {
      toast.error(res.error || "Falha ao salvar fluxo");
      return;
    }
    setFluxos((prev) => {
      const idx = prev.findIndex((x) => x.id === res.fluxo!.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = res.fluxo!;
        return next;
      }
      return [res.fluxo!, ...prev];
    });
    toast.success(res.message || "Fluxo salvo");
  };

  const toggle = async (id: string, v: boolean) => {
    setFluxos((prev) => prev.map((x) => (x.id === id ? { ...x, ativo: v } : x)));
    const res = await toggleAutomacaoFluxo(id, v);
    if (!res.ok) {
      setFluxos((prev) => prev.map((x) => (x.id === id ? { ...x, ativo: !v } : x)));
      toast.error(res.error || "Falha ao atualizar fluxo");
      return;
    }
    if (res.fluxo) {
      setFluxos((prev) => prev.map((x) => (x.id === id ? res.fluxo! : x)));
    }
    toast.success(res.message || (v ? "Fluxo ativado" : "Fluxo pausado"));
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-500" />
            <Badge variant="outline" className="text-[10px]">
              Automações
            </Badge>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight lg:text-3xl">Fluxos automáticos</h1>
          <p className="text-sm text-muted-foreground">
            Quando isso acontecer, faça aquilo — sem ninguém precisar lembrar.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={novo}>
          <Plus className="h-3.5 w-3.5" /> Novo fluxo
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando fluxos…
        </div>
      )}

      {!loading && (
        <div className="grid gap-3 md:grid-cols-2">
          {fluxos.map((f) => (
            <Card key={f.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">{f.nome}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Gatilho: {f.gatilho}</p>
                </div>
                <Switch checked={f.ativo} onCheckedChange={(v) => void toggle(f.id!, v)} />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                {f.acoes.map((a, i) => {
                  const Icon = ICONS[a.tipo] ?? Zap;
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs">
                        <Icon className="h-3 w-3" /> {a.label}
                      </span>
                      {i < f.acoes.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
                <span>Executou {(f.rodou ?? 0).toLocaleString("pt-BR")} vezes</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => editar(f)}>
                  <Pencil className="h-3 w-3" /> Editar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <FluxoAutomacaoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        fluxo={editando}
        onSalvar={(f) => void salvar(f)}
      />
    </div>
  );
}
