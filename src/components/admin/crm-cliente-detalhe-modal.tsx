import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
  } from "@/components/ui/dialog";
  import { Button } from "@/components/ui/button";
  import { Progress } from "@/components/ui/progress";
  import {
    Building2,
    Phone,
    Mail,
    MessageCircle,
    MapPin,
    DollarSign,
    Receipt,
    CalendarClock,
    Flag,
    UserCog,
    Sparkles,
    X,
    FileText,
    ClipboardList,
    Activity,
    ArrowUpRight,
    MessageSquare,
    Clock,
    Send,
    Pencil,
    Paperclip,
  } from "lucide-react";
  import { cn } from "@/lib/utils";
  import { formatarReal } from "@/lib/money";
  import { STAGES, PRIORIDADES, CANAIS, type CrmConsultor } from "./crm-cliente-wizard-modal";
  import type { CrmStage, CrmCliente } from "./crm-cliente-wizard-modal";
  import { CrmAnexosLista, type CrmAnexo } from "./crm-anexos";
  
  export interface CrmCardData {
    id: string;
    cliente: CrmCliente;
    stage: CrmStage;
    consultorId: string;
    prioridade: string;
    canal: string;
    valor: string;
    boleto: string;
    proximaAcao: string;
    dataAcao: string;
    notas: string;
    tags: string[];
    criadoEm: string;
    ultimoContato: string;
    progressoDocs: number;
    anexos: CrmAnexo[];
    timeline: { data: string; titulo: string; descricao: string; tipo: "criacao" | "contato" | "mudanca" | "nota" | "financeiro" }[];
  }
  
  interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    card: CrmCardData | null;
    onEditar?: (card: CrmCardData) => void;
    consultores?: CrmConsultor[];
  }
  
  const TIPO_ICON = {
    criacao: Sparkles,
    contato: MessageSquare,
    mudanca: ArrowUpRight,
    nota: FileText,
    financeiro: Receipt,
  };
  
  const TIPO_COR = {
    criacao: "bg-primary text-primary-foreground",
    contato: "bg-sky-500 text-white",
    mudanca: "bg-violet-500 text-white",
    nota: "bg-muted text-foreground",
    financeiro: "bg-emerald-500 text-white",
  };
  
  export function CrmClienteDetalheModal({ open, onOpenChange, card, onEditar, consultores = [] }: Props) {
    if (!card) return null;
    const stageObj = STAGES.find((s) => s.id === card.stage)!;
    const consultor = consultores.find((c) => c.id === card.consultorId);
    const prioridade = PRIORIDADES.find((p) => p.id === card.prioridade);
    const canal = CANAIS.find((c) => c.id === card.canal);
    const StageIcon = stageObj.icon;
  
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl p-0 overflow-hidden gap-0 border-0">
          <DialogTitle className="sr-only">Detalhamento do cliente {card.cliente.razao}</DialogTitle>
          <DialogDescription className="sr-only">
            Visão 360 do atendimento no CRM.
          </DialogDescription>
  
          <div className="grid lg:grid-cols-[320px_1fr] min-h-[680px] max-h-[90vh]">
            <aside
              className="relative hidden lg:flex flex-col justify-between p-6 text-white overflow-hidden"
              style={{
                backgroundImage: `linear-gradient(160deg, rgba(15,23,42,0.94) 0%, rgba(30,41,59,0.9) 55%, rgba(2,6,23,0.96) 100%), url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=900&q=80')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-primary/30 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/70">
                  <Building2 className="h-3.5 w-3.5" /> Cliente CRM
                </div>
                <h2 className="mt-3 text-2xl font-bold leading-tight">{card.cliente.razao}</h2>
                <p className="mt-1 text-sm text-white/70">{card.cliente.cnpj}</p>
  
                <div className={cn("mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold text-white bg-gradient-to-br", stageObj.cor)}>
                  <StageIcon className="h-3.5 w-3.5" /> {stageObj.titulo}
                </div>
  
                <div className="mt-5 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-white/80">
                    <MapPin className="h-3.5 w-3.5" /> {card.cliente.cidade}
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <UserCog className="h-3.5 w-3.5" /> {consultor?.nome} · {consultor?.papel}
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <Flag className="h-3.5 w-3.5" />
                    <span className="flex items-center gap-1.5">
                      <span className={cn("h-2 w-2 rounded-full", prioridade?.cor ?? "bg-white/40")} />
                      Prioridade {prioridade?.label}
                    </span>
                  </div>
                </div>
  
                <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-white/70">
                    <span>Documentação</span>
                    <span className="text-white">{card.progressoDocs}%</span>
                  </div>
                  <Progress value={card.progressoDocs} className="mt-2 h-1.5 bg-white/15" />
                  <p className="mt-2 text-[11px] text-white/60">
                    Meta: 100% antes do próximo edital.
                  </p>
                </div>
              </div>
  
              <div className="relative space-y-2">
                <Button className="w-full gap-1.5" size="sm">
                  <MessageCircle className="h-3.5 w-3.5" /> Enviar WhatsApp
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" size="sm" className="gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> Ligar
                  </Button>
                  <Button variant="secondary" size="sm" className="gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> E-mail
                  </Button>
                </div>
              </div>
            </aside>
  
            <section className="flex flex-col bg-background overflow-hidden min-h-0">
              <header className="flex items-start justify-between border-b border-border px-6 py-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Atendimento #{card.id}
                  </p>
                  <h3 className="text-xl font-bold tracking-tight">Visão 360 do cliente</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Criado em {card.criadoEm} · Último contato {card.ultimoContato}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEditar?.(card)}
                    className="gap-1.5"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar etapa e detalhes
                  </Button>
                  <button
                    onClick={() => onOpenChange(false)}
                    className="rounded-md p-2 text-muted-foreground hover:bg-muted"
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </header>
  
              <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-6">
                {/* KPIs */}
                <div className="grid gap-3 sm:grid-cols-4">
                  <Kpi icon={<DollarSign className="h-4 w-4" />} label="Valor" valor={card.valor ? formatarReal(card.valor) : "—"} cor="text-emerald-600" />
                  <Kpi icon={<Receipt className="h-4 w-4" />} label="Boleto" valor={card.boleto || "—"} cor="text-amber-600" />
                  <Kpi icon={<CalendarClock className="h-4 w-4" />} label="Próxima ação" valor={card.dataAcao || "—"} cor="text-sky-600" />
                  <Kpi icon={<MessageSquare className="h-4 w-4" />} label="Canal" valor={canal?.label ?? "—"} cor="text-violet-600" />
                </div>
  
                {/* Próxima ação destacada */}
                {card.proximaAcao && (
                  <div className="rounded-xl border-l-4 border-primary bg-primary/5 p-4">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary">
                      <Clock className="h-3.5 w-3.5" /> Próxima ação planejada
                    </div>
                    <p className="mt-1 text-sm font-semibold">{card.proximaAcao}</p>
                    {card.dataAcao && (
                      <p className="text-xs text-muted-foreground">Agendada para {card.dataAcao}</p>
                    )}
                  </div>
                )}
  
                {/* Tags */}
                {card.tags.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {card.tags.map((t) => (
                        <span key={t} className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
  
                {/* Notas */}
                {card.notas && (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" /> Notas do consultor
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed">{card.notas}</p>
                  </div>
                )}
  
                {/* Anexos / Evidências */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <Paperclip className="h-3.5 w-3.5" /> Evidências e comprovantes
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {card.anexos.length} arquivo{card.anexos.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <CrmAnexosLista anexos={card.anexos} />
                </div>
  
                {/* Timeline */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Linha do tempo
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {card.timeline.length} eventos
                    </span>
                  </div>
                  <ol className="relative space-y-4 border-l border-border pl-6">
                    {card.timeline.map((ev, i) => {
                      const Icon = TIPO_ICON[ev.tipo];
                      return (
                        <li key={i} className="relative">
                          <span
                            className={cn(
                              "absolute -left-[34px] top-0 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background",
                              TIPO_COR[ev.tipo],
                            )}
                          >
                            <Icon className="h-3 w-3" />
                          </span>
                          <div className="rounded-lg border border-border bg-card p-3">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-semibold">{ev.titulo}</p>
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap">{ev.data}</span>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">{ev.descricao}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
  
                {/* Dados */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoBloco titulo="Dados cadastrais" icone={<Building2 className="h-4 w-4" />}>
                    <Linha label="Razão social" valor={card.cliente.razao} />
                    <Linha label="CNPJ" valor={card.cliente.cnpj} />
                    <Linha label="Segmento" valor={card.cliente.segmento} />
                    <Linha label="Cidade" valor={card.cliente.cidade} />
                    <Linha label="Ticket médio" valor={card.cliente.ticket} />
                  </InfoBloco>
                  <InfoBloco titulo="Atendimento" icone={<ClipboardList className="h-4 w-4" />}>
                    <Linha label="Consultor" valor={consultor?.nome ?? "—"} />
                    <Linha label="Prioridade" valor={prioridade?.label ?? "—"} />
                    <Linha label="Canal" valor={canal?.label ?? "—"} />
                    <Linha label="Etapa" valor={stageObj.titulo} />
                    <Linha label="Criado em" valor={card.criadoEm} />
                  </InfoBloco>
                </div>
              </div>
  
              <footer className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-6 py-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Activity className="h-3.5 w-3.5" /> Todas as ações ficam registradas na auditoria.
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                    Fechar
                  </Button>
                  <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => onEditar?.(card)}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button size="sm" className="gap-1.5">
                    <Send className="h-3.5 w-3.5" /> Registrar interação
                  </Button>
                </div>
              </footer>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  function Kpi({ icon, label, valor, cor }: { icon: React.ReactNode; label: string; valor: string; cor: string }) {
    return (
      <div className="rounded-xl border border-border bg-card p-3">
        <div className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider", cor)}>
          {icon} {label}
        </div>
        <p className="mt-1 truncate text-sm font-bold">{valor}</p>
      </div>
    );
  }
  
  function InfoBloco({ titulo, icone, children }: { titulo: string; icone: React.ReactNode; children: React.ReactNode }) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {icone} {titulo}
        </div>
        <div className="space-y-1.5">{children}</div>
      </div>
    );
  }
  
  function Linha({ label, valor }: { label: string; valor: string }) {
    return (
      <div className="flex items-start justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-right">{valor}</span>
      </div>
    );
  }