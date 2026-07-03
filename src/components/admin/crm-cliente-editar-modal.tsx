import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  Flag,
  Pencil,
  Receipt,
  Save,
  Sparkles,
  UserCog,
  X,
  Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mascararInputReal } from "@/lib/money";
import {
  STAGES,
  PRIORIDADES,
  CANAIS,
  type CrmConsultor,
} from "./crm-cliente-wizard-modal";
import type { CrmCardData } from "./crm-cliente-detalhe-modal";
import type { CrmStage } from "./crm-cliente-wizard-modal";
import { CrmAnexosUploader, type CrmAnexo } from "./crm-anexos";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: CrmCardData | null;
  onSave: (updated: CrmCardData, mudouEtapa: boolean, etapaAnterior: CrmStage) => void | Promise<void>;
  consultores?: CrmConsultor[];
}

const TAGS_PRESET = ["Renovação", "SICAF", "Certidões", "Suporte", "Upsell", "Recuperação"];

export function CrmClienteEditarModal({ open, onOpenChange, card, onSave, consultores = [] }: Props) {
  const [stage, setStage] = useState<CrmStage>("em_negociacao");
  const [consultorId, setConsultorId] = useState("");
  const [prioridade, setPrioridade] = useState<string>("media");
  const [canal, setCanal] = useState("whatsapp");
  const [valor, setValor] = useState("");
  const [boleto, setBoleto] = useState("");
  const [proximaAcao, setProximaAcao] = useState("");
  const [dataAcao, setDataAcao] = useState("");
  const [notas, setNotas] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [progressoDocs, setProgressoDocs] = useState(0);
  const [anexos, setAnexos] = useState<CrmAnexo[]>([]);

  useEffect(() => {
    if (card && open) {
      setStage(card.stage);
      setConsultorId(card.consultorId);
      setPrioridade(card.prioridade);
      setCanal(card.canal);
      setValor(card.valor);
      setBoleto(card.boleto);
      setProximaAcao(card.proximaAcao);
      setDataAcao(card.dataAcao);
      setNotas(card.notas);
      setTags(card.tags);
      setProgressoDocs(card.progressoDocs);
      setAnexos(card.anexos ?? []);
    }
  }, [card, open]);

  if (!card) return null;

  const stageAtual = STAGES.find((s) => s.id === stage)!;
  const StageIcon = stageAtual.icon;

  function toggleTag(t: string) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function handleSalvar() {
    if (!card) return;
    const mudouEtapa = card.stage !== stage;
    const etapaAnterior = card.stage;
    const updated: CrmCardData = {
      ...card,
      stage,
      consultorId,
      prioridade,
      canal,
      valor,
      boleto,
      proximaAcao,
      dataAcao,
      notas,
      tags,
      progressoDocs,
      anexos,
      ultimoContato: "agora",
    };
    void onSave(updated, mudouEtapa, etapaAnterior);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden gap-0 border-0">
        <DialogTitle className="sr-only">Editar atendimento {card.id}</DialogTitle>
        <DialogDescription className="sr-only">
          Atualize etapa, consultor, valores e observações do card do CRM.
        </DialogDescription>

        <div className="grid lg:grid-cols-[300px_1fr] min-h-[680px] max-h-[90vh]">
          <aside
            className="relative hidden lg:flex flex-col justify-between p-6 text-white overflow-hidden"
            style={{
              backgroundImage:
                "linear-gradient(160deg, rgba(15,23,42,0.94) 0%, rgba(30,41,59,0.9) 55%, rgba(2,6,23,0.96) 100%), url('https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-primary/30 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/70">
                <Pencil className="h-3.5 w-3.5" /> Editar atendimento
              </div>
              <h2 className="mt-3 text-2xl font-bold leading-tight">{card.cliente.razao}</h2>
              <p className="mt-1 text-sm text-white/70">{card.cliente.cnpj}</p>

              <div className={cn("mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold text-white bg-gradient-to-br", stageAtual.cor)}>
                <StageIcon className="h-3.5 w-3.5" /> {stageAtual.titulo}
              </div>

              <div className="mt-6 space-y-2 text-xs text-white/80">
                <p className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5" /> #{card.id}
                </p>
                <p className="flex items-center gap-2">
                  <CalendarClock className="h-3.5 w-3.5" /> Criado em {card.criadoEm}
                </p>
              </div>
            </div>

            <div className="relative rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70 backdrop-blur">
              <div className="flex items-center gap-2 text-white">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Dica</span>
              </div>
              <p className="mt-1 leading-snug">
                Alterar a etapa move o card no Kanban e registra um evento na linha do tempo.
              </p>
            </div>
          </aside>

          <section className="flex flex-col bg-background overflow-hidden min-h-0">
            <header className="flex items-start justify-between border-b border-border px-6 py-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Atendimento #{card.id}
                </p>
                <h3 className="text-xl font-bold tracking-tight">Editar situação e detalhes</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ajuste a etapa do funil, o consultor responsável e as próximas ações.
                </p>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-6">
              {/* Etapa */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Etapa do funil
                  </p>
                  {card.stage !== stage && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                      Mudança pendente
                    </span>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  {STAGES.map((s) => {
                    const Icon = s.icon;
                    const sel = stage === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setStage(s.id)}
                        className={cn(
                          "relative overflow-hidden rounded-xl border-2 p-3 text-left transition",
                          sel
                            ? "border-primary bg-primary/5 shadow-md"
                            : "border-border bg-card hover:border-foreground/30 hover:bg-muted/40",
                        )}
                      >
                        {sel && (
                          <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <CheckCircle2 className="h-3 w-3" />
                          </div>
                        )}
                        <div className={cn("mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm", s.cor)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <p className="text-xs font-bold leading-tight">{s.titulo}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Consultor + Prioridade + Canal */}
              <div className="grid gap-5 lg:grid-cols-3">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Consultor
                  </p>
                  <div className="space-y-2">
                    {consultores.map((c) => {
                      const sel = consultorId === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setConsultorId(c.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg border-2 p-2 text-left transition",
                            sel ? "border-primary bg-primary/5" : "border-border bg-card hover:border-foreground/30",
                          )}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-[11px] font-bold text-primary-foreground">
                            {c.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold">{c.nome}</p>
                            <p className="truncate text-[10px] text-muted-foreground">{c.papel}</p>
                          </div>
                          {sel && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Prioridade
                  </p>
                  <div className="space-y-2">
                    {PRIORIDADES.map((p) => {
                      const sel = prioridade === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => setPrioridade(p.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg border-2 p-2.5 text-left transition",
                            sel ? "border-primary bg-primary/5" : "border-border bg-card hover:border-foreground/30",
                          )}
                        >
                          <span className={cn("h-2.5 w-2.5 rounded-full", p.cor)} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold">{p.label}</p>
                            <p className="text-[10px] text-muted-foreground">{p.desc}</p>
                          </div>
                          {sel && <CheckCircle2 className="h-4 w-4 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Canal preferencial
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {CANAIS.map((c) => {
                      const Icon = c.icon;
                      const sel = canal === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setCanal(c.id)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition",
                            sel ? "border-primary bg-primary/5 text-primary" : "border-border bg-card hover:border-foreground/30",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="text-[11px] font-semibold">{c.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Financeiro & Ação */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Valor negociado" icon={<DollarSign className="h-4 w-4" />}>
                  <Input value={valor} onChange={(e) => setValor(mascararInputReal(e.target.value))} placeholder="R$ 0,00" className="pl-9" />
                </Campo>
                <Campo label="Nº do boleto" icon={<Receipt className="h-4 w-4" />}>
                  <Input value={boleto} onChange={(e) => setBoleto(e.target.value)} placeholder="000000-0" className="pl-9" />
                </Campo>
                <Campo label="Próxima ação" icon={<Flag className="h-4 w-4" />}>
                  <Input value={proximaAcao} onChange={(e) => setProximaAcao(e.target.value)} placeholder="Ex.: Ligar para retomar" className="pl-9" />
                </Campo>
                <Campo label="Data da próxima ação" icon={<CalendarClock className="h-4 w-4" />}>
                  <Input type="date" value={dataAcao} onChange={(e) => setDataAcao(e.target.value)} className="pl-9" />
                </Campo>
              </div>

              {/* Progresso docs */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Progresso da documentação
                  </p>
                  <span className="text-xs font-bold tabular-nums">{progressoDocs}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progressoDocs}
                  onChange={(e) => setProgressoDocs(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              {/* Tags */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Tags do atendimento
                </p>
                <div className="flex flex-wrap gap-2">
                  {TAGS_PRESET.map((t) => {
                    const sel = tags.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={() => toggleTag(t)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-semibold transition",
                          sel
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-muted",
                        )}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notas / descrição */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Descrição / notas do consultor
                </p>
                <Textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Contexto, objeções, ganchos comerciais, combinados..."
                  rows={4}
                />
              </div>

              {/* Anexos / Evidências */}
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Paperclip className="h-3.5 w-3.5" /> Evidências (comprovante ou print da conversa)
                </p>
                <p className="mb-2 text-[11px] text-muted-foreground">
                  Anexe comprovantes de pagamento do boleto ou prints da conversa com o cliente.
                </p>
                <CrmAnexosUploader
                  anexos={anexos}
                  onChange={setAnexos}
                  tipoPadrao={boleto ? "comprovante" : "conversa"}
                />
              </div>
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-6 py-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <UserCog className="h-3.5 w-3.5" /> Alterações ficam registradas na auditoria.
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSalvar} className="gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Salvar alterações
                </Button>
              </div>
            </footer>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Campo({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}