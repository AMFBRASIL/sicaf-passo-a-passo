import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Banknote,
  X,
  Plus,
  GripVertical,
  Trash2,
  Mail,
  MessageSquare,
  Send,
  Phone,
  Ban,
  Save,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchReguaCobranca,
  saveReguaCobranca,
  type CanalCobranca,
  type ReguaEtapa,
} from "@/lib/cobranca-api";

const CANAIS: { key: CanalCobranca; label: string; icon: typeof Mail; color: string }[] = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageSquare, color: "text-green-600 border-green-500 bg-green-50" },
  { key: "email", label: "E-mail", icon: Mail, color: "text-blue-600 border-blue-500 bg-blue-50" },
  { key: "sms", label: "SMS", icon: Send, color: "text-violet-600 border-violet-500 bg-violet-50" },
  { key: "ligacao", label: "Ligação", icon: Phone, color: "text-amber-600 border-amber-500 bg-amber-50" },
  { key: "nenhum", label: "Nenhum", icon: Ban, color: "text-muted-foreground border-border bg-muted" },
];

function diasLabel(dias: number) {
  if (dias < 0) return `${Math.abs(dias)}d antes`;
  if (dias === 0) return "No vencimento";
  return `${dias}d após`;
}

function novaEtapa(ordem: number): ReguaEtapa {
  return {
    ordem,
    diasRelativo: 7,
    canal: "email",
    titulo: `Nova etapa ${ordem}`,
    mensagem: "{nome}, seu pagamento de {valor} segue em aberto há {dias} dias. Link: {link}",
    ativo: true,
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSalvo?: () => void;
}

export function ReguaCobrancaModal({ open, onOpenChange, onSalvo }: Props) {
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [automacaoAtiva, setAutomacaoAtiva] = useState(false);
  const [etapas, setEtapas] = useState<ReguaEtapa[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const carregar = async () => {
    setLoading(true);
    const res = await fetchReguaCobranca();
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao carregar régua");
      return;
    }
    setAutomacaoAtiva(!!res.automacaoAtiva);
    setEtapas(res.etapas || []);
  };

  useEffect(() => {
    if (open) void carregar();
  }, [open]);

  const ativas = etapas.filter((e) => e.ativo).length;

  const updateEtapa = (idx: number, patch: Partial<ReguaEtapa>) => {
    setEtapas((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };

  const removerEtapa = (idx: number) => {
    setEtapas((prev) => prev.filter((_, i) => i !== idx));
  };

  const adicionarEtapa = () => {
    setEtapas((prev) => [...prev, novaEtapa(prev.length + 1)]);
  };

  const moverEtapa = (from: number, to: number) => {
    if (to < 0 || to >= etapas.length) return;
    setEtapas((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next.map((e, i) => ({ ...e, ordem: i + 1 }));
    });
  };

  const handleSalvar = async () => {
    setSalvando(true);
    const res = await saveReguaCobranca({
      automacaoAtiva,
      etapas: etapas.map((e, i) => ({ ...e, ordem: i + 1 })),
    });
    setSalvando(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao salvar régua");
      return;
    }
    toast.success("Régua de cobrança salva com sucesso");
    if (res.etapas) setEtapas(res.etapas);
    onOpenChange(false);
    onSalvo?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <div className="flex items-start justify-between border-b px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Régua de cobrança</h2>
              <p className="text-sm text-muted-foreground">
                Defina a sequência automática de avisos e cobranças por dias de atraso.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Automação</span>
              <Switch checked={automacaoAtiva} onCheckedChange={setAutomacaoAtiva} />
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between border-b px-6 py-3">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{ativas}</strong> etapas ativas de{" "}
            <strong className="text-foreground">{etapas.length}</strong>
          </p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={adicionarEtapa}>
            <Plus className="h-3.5 w-3.5" /> Nova etapa
          </Button>
        </div>

        <ScrollArea className="max-h-[55vh] px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando régua…
            </div>
          ) : (
            <div className="space-y-3">
              {etapas.map((etapa, idx) => {
                const canalInfo = CANAIS.find((c) => c.key === etapa.canal) || CANAIS[1];
                return (
                  <div
                    key={etapa.id ?? `new-${idx}`}
                    className="rounded-xl border bg-card p-4 shadow-sm"
                    draggable
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIdx !== null && dragIdx !== idx) moverEtapa(dragIdx, idx);
                      setDragIdx(null);
                    }}
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="flex items-center gap-2 pt-1 text-muted-foreground">
                        <GripVertical className="h-4 w-4 cursor-grab" />
                        <span className="text-xs font-bold text-rose-600">#{idx + 1}</span>
                      </div>

                      <div className="w-28 shrink-0">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Dias
                        </p>
                        <Input
                          type="number"
                          value={etapa.diasRelativo}
                          onChange={(e) =>
                            updateEtapa(idx, { diasRelativo: parseInt(e.target.value, 10) || 0 })
                          }
                          className="h-9"
                        />
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {diasLabel(etapa.diasRelativo)}
                        </p>
                      </div>

                      <div className="shrink-0">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Canal
                        </p>
                        <div className="flex gap-1">
                          {CANAIS.map(({ key, icon: Icon }) => (
                            <button
                              key={key}
                              type="button"
                              title={key}
                              onClick={() => updateEtapa(idx, { canal: key })}
                              className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                                etapa.canal === key
                                  ? CANAIS.find((c) => c.key === key)?.color
                                  : "border-border hover:bg-muted/50"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <Input
                          value={etapa.titulo}
                          onChange={(e) => updateEtapa(idx, { titulo: e.target.value })}
                          placeholder="Título da etapa"
                          className="h-9 font-medium"
                        />
                        <Textarea
                          value={etapa.mensagem}
                          onChange={(e) => updateEtapa(idx, { mensagem: e.target.value })}
                          rows={2}
                          className="resize-none text-sm"
                        />
                        <Badge variant="outline" className={canalInfo.color}>
                          {canalInfo.label}
                        </Badge>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <Switch
                          checked={etapa.ativo}
                          onCheckedChange={(v) => updateEtapa(idx, { ativo: v })}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removerEtapa(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!etapas.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma etapa configurada. Clique em &quot;Nova etapa&quot; para começar.
                </p>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 border-t bg-muted/30 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            className="gap-2 bg-rose-600 hover:bg-rose-700"
            disabled={salvando || loading}
            onClick={() => void handleSalvar()}
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar régua
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
