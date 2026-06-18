import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  criarTicket,
  fetchTicket,
  fetchTickets,
  mapTicketStatusUi,
  responderTicket,
  uploadTicketAnexo,
  type TicketAnexo as ApiTicketAnexo,
  type TicketDetalhe,
  type TicketMensagem,
  type TicketResumo,
} from "@/lib/tickets-api";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  Clock,
  Download,
  Mail,
  Reply,
  Tag,
  User,
  CheckCircle2,
  CreditCard,
  File as FileIcon,
  FileText,
  Headphones,
  HelpCircle,
  Image as ImageIcon,
  MessageCircle,
  Paperclip,
  PhoneCall,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  Wrench,
  X,
  Zap,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader, StatusBadge } from "@/components/page-header";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import wizardBg from "@/assets/wizard-bg.jpg";

export const Route = createFileRoute("/suporte")({
  head: () => ({
    meta: [
      { title: "Suporte — CADBRASIL" },
      { name: "description", content: "Fale com nossos especialistas." },
    ],
  }),
  component: SupportPage,
});

type ChamadoMsg = {
  autor: "voce" | "suporte";
  nome: string;
  data: string;
  texto: string;
  anexos?: TicketAnexo[];
};

type TicketAnexo = {
  id: string;
  name: string;
  size: number;
  type: string;
  enviadoPor: string;
  data: string;
  url?: string;
};

type Chamado = {
  codigo: string;
  titulo: string;
  data: string;
  status: "ok" | "warn" | "danger";
  label: string;
  categoria: string;
  prioridade: "Baixa" | "Média" | "Alta";
  responsavel: string;
  abertoPor: string;
  email: string;
  empresa: string;
  ultimaAtualizacao: string;
  sla: string;
  anexos: TicketAnexo[];
  mensagens: ChamadoMsg[];
};

const CATEGORIA_DB_LABELS: Record<string, string> = {
  sicaf: "SICAF / Cadastro",
  suporte: "Documentos & Certidões",
  financeiro: "Pagamentos & Faturas",
  bug: "Problema técnico",
  melhoria: "Serviços com IA",
  outro: "Outro assunto",
};

function categoriaExibicao(idOuEnum: string): string {
  const cat = categorias.find((c) => c.id === idOuEnum);
  if (cat) return cat.titulo;
  return CATEGORIA_DB_LABELS[idOuEnum] || idOuEnum;
}

function prioridadeExibicao(p: string): Chamado["prioridade"] {
  const s = String(p || "").toLowerCase();
  if (s === "alta" || s === "urgente") return "Alta";
  if (s === "baixa") return "Baixa";
  return "Média";
}

function mapAnexoApi(a: ApiTicketAnexo, enviadoPor = "Anexo"): TicketAnexo {
  return {
    id: String(a.id),
    name: a.nomeOriginal,
    size: a.tamanho || 0,
    type: a.mimetype || "",
    enviadoPor,
    data: "",
    url: a.url,
  };
}

function mapMensagens(msgs: TicketMensagem[]): ChamadoMsg[] {
  return msgs.map((m) => ({
    autor: m.sender === "client" ? "voce" : "suporte",
    nome: m.senderName,
    data: m.date,
    texto: m.message,
    anexos: (m.anexos || []).map((a) =>
      mapAnexoApi(a, m.sender === "client" ? "Você" : m.senderName || "Suporte"),
    ),
  }));
}

function mapTicketDetalheToChamado(t: TicketDetalhe, usuarioNome?: string): Chamado {
  const ui = mapTicketStatusUi(t.status);
  const msgs = mapMensagens(t.messages || []);
  const anexosTicket = (t.anexos || []).map((a) => mapAnexoApi(a, "Você"));
  const anexosMsgs = msgs.flatMap((m) => m.anexos || []);
  const anexos = [...anexosTicket, ...anexosMsgs];
  const ultima = msgs[msgs.length - 1];

  return {
    codigo: t.id,
    titulo: t.title,
    data: t.createdAt?.split(" ")[0] || t.createdAt,
    status: ui.status,
    label: ui.label,
    categoria: categoriaExibicao(t.category),
    prioridade: prioridadeExibicao(t.priority),
    responsavel: t.assignee || "Suporte CADBRASIL",
    abertoPor: usuarioNome || "Você",
    email: "",
    empresa: "",
    ultimaAtualizacao: ultima?.data || t.createdAt,
    sla: "Resposta em até 1h útil",
    anexos,
    mensagens: msgs,
  };
}

function mapTicketResumoToChamado(t: TicketResumo, usuarioNome?: string): Chamado {
  const ui = mapTicketStatusUi(t.status);
  return {
    codigo: t.id,
    titulo: t.title,
    data: t.createdAt?.split(" ")[0] || t.createdAt,
    status: ui.status,
    label: ui.label,
    categoria: categoriaExibicao(t.category),
    prioridade: prioridadeExibicao(t.priority),
    responsavel: t.assignee || "Suporte CADBRASIL",
    abertoPor: usuarioNome || "Você",
    email: "",
    empresa: "",
    ultimaAtualizacao: t.createdAt,
    sla: "Resposta em até 1h útil",
    anexos: [],
    mensagens: [],
  };
}

const MAX_ANEXO_BYTES = 20 * 1024 * 1024;

type Categoria = {
  id: string;
  titulo: string;
  descricao: string;
  icon: typeof Headphones;
  cor: string;
};

const categorias: Categoria[] = [
  { id: "sicaf", titulo: "SICAF / Cadastro", descricao: "Dúvidas sobre seu cadastro no SICAF", icon: ShieldCheck, cor: "text-primary" },
  { id: "documentos", titulo: "Documentos & Certidões", descricao: "Envio, validade ou pendências", icon: FileText, cor: "text-warning" },
  { id: "pagamento", titulo: "Pagamentos & Faturas", descricao: "Cobranças, boletos e planos", icon: CreditCard, cor: "text-success" },
  { id: "tecnico", titulo: "Problema técnico", descricao: "Algo não está funcionando", icon: Wrench, cor: "text-destructive" },
  { id: "ia", titulo: "Serviços com IA", descricao: "Leitura de edital, análises, match", icon: Sparkles, cor: "text-primary" },
  { id: "outro", titulo: "Outro assunto", descricao: "Não encontrei minha categoria", icon: HelpCircle, cor: "text-muted-foreground" },
];

const prioridades = [
  { id: "baixa", label: "Baixa", desc: "Posso esperar", cor: "border-border" },
  { id: "media", label: "Média", desc: "Preciso resolver em breve", cor: "border-warning/40" },
  { id: "alta", label: "Alta", desc: "Está me impedindo de trabalhar", cor: "border-destructive/40" },
];

type Anexo = { id: string; file: File; name: string; size: number; type: string };

const steps = [
  { id: 1, title: "Categoria", desc: "Sobre o que é o chamado?" },
  { id: 2, title: "Urgência", desc: "Qual a prioridade?" },
  { id: 3, title: "Detalhes", desc: "Conte o que aconteceu" },
  { id: 4, title: "Anexos", desc: "Documentos, prints, PDFs" },
  { id: 5, title: "Revisão", desc: "Confira e envie" },
];

function NovoChamadoDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [prioridade, setPrioridade] = useState<string>("media");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [drag, setDrag] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const total = steps.length;
  const podeAvancar =
    (step === 1 && !!categoria) ||
    (step === 2 && !!prioridade) ||
    (step === 3 && assunto.trim().length > 3 && mensagem.trim().length > 10) ||
    step === 4 ||
    step === 5;

  const reset = () => {
    setStep(1);
    setCategoria(null);
    setPrioridade("media");
    setAssunto("");
    setMensagem("");
    setAnexos([]);
  };

  const enviar = async () => {
    setEnviando(true);
    try {
      const res = await criarTicket({
        titulo: assunto.trim(),
        descricao: mensagem.trim(),
        categoria: categoria || "outro",
        prioridade: prioridade || "media",
      });
      if (!res.ok) {
        toast.error(res.error || "Erro ao abrir chamado");
        return;
      }

      const ticketRef = res.codigo || (res.id != null ? String(res.id) : "");
      if (ticketRef && anexos.length > 0) {
        let falhas = 0;
        for (const anexo of anexos) {
          const up = await uploadTicketAnexo(ticketRef, anexo.file);
          if (!up.ok) falhas += 1;
        }
        if (falhas > 0) {
          toast.warning(
            falhas === anexos.length
              ? "Chamado aberto, mas os anexos não foram enviados."
              : `Chamado aberto, mas ${falhas} anexo(s) falharam.`,
          );
        }
      }

      toast.success(res.message || `Chamado ${res.codigo || ""} aberto!`);
      reset();
      setOpen(false);
      onCreated?.();
    } finally {
      setEnviando(false);
    }
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const novos: Anexo[] = [];
    for (const f of Array.from(files)) {
      if (f.size > MAX_ANEXO_BYTES) {
        toast.error(`${f.name} excede o limite de 20 MB`);
        continue;
      }
      novos.push({
        id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        name: f.name,
        size: f.size,
        type: f.type,
      });
    }
    if (novos.length > 0) setAnexos((prev) => [...prev, ...novos]);
  };

  const catSel = categorias.find((c) => c.id === categoria);
  const priSel = prioridades.find((p) => p.id === prioridade);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2">
          <Plus className="h-4 w-4" />
          Abrir chamado
        </Button>
      </DialogTrigger>
      <DialogContent
        className="overflow-hidden p-0 sm:max-w-[960px] lg:max-w-[1080px]"
      >
        <DialogTitle className="sr-only">Abrir novo chamado</DialogTitle>
        <div className="grid h-[88vh] max-h-[760px] grid-cols-1 lg:grid-cols-[340px_1fr]">
          {/* LEFT — wizard sidebar with bg image */}
          <aside
            className="relative hidden flex-col justify-between overflow-hidden p-7 text-white lg:flex"
            style={{
              backgroundImage: `url(${wizardBg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/55 to-black/80" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_60%)]" />

            {/* Top brand */}
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                <Headphones className="h-4 w-4" />
                Suporte CADBRASIL
              </div>
              <h2 className="mt-4 text-3xl font-bold leading-tight">
                Vamos resolver<br />juntos.
              </h2>
              <p className="mt-2 text-sm text-white/75">
                Resposta em até <span className="font-semibold text-white">1 hora útil</span>.
              </p>
            </div>

            {/* Stepper */}
            <ol className="relative z-10 space-y-1">
              {steps.map((s, i) => {
                const done = step > s.id;
                const active = step === s.id;
                return (
                  <li key={s.id} className="relative">
                    {i < steps.length - 1 && (
                      <span
                        className={cn(
                          "absolute left-[14px] top-9 h-7 w-px",
                          done ? "bg-white/60" : "bg-white/15",
                        )}
                      />
                    )}
                    <button
                      type="button"
                      disabled={s.id > step}
                      onClick={() => setStep(s.id)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition",
                        active && "bg-white/10",
                        s.id < step && "hover:bg-white/5",
                        s.id > step && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition",
                          done && "border-white bg-white text-primary",
                          active && "border-white bg-white/15 text-white",
                          !done && !active && "border-white/30 text-white/70",
                        )}
                      >
                        {done ? <CheckCircle2 className="h-4 w-4" /> : s.id}
                      </span>
                      <span className="min-w-0">
                        <span className={cn("block text-sm font-semibold leading-tight", active ? "text-white" : "text-white/85")}>
                          {s.title}
                        </span>
                        <span className="block truncate text-[11px] text-white/55">{s.desc}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {/* Bottom badge */}
            <div className="relative z-10 rounded-xl border border-white/15 bg-white/5 p-3 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Zap className="h-4 w-4 text-warning" />
                Atendimento humano
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-white/70">
                Especialistas em licitações disponíveis seg–sex, 8h às 18h.
              </p>
            </div>
          </aside>

          {/* RIGHT — content */}
          <div className="flex h-full min-h-0 flex-col">
            {/* Header */}
            <header className="flex items-center justify-between border-b px-6 py-4 sm:px-8 sm:py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Etapa {step} de {total}
                </p>
                <h3 className="mt-0.5 text-xl font-bold tracking-tight">{steps[step - 1].title}</h3>
              </div>
              <div className="hidden items-center gap-1 sm:flex">
                {steps.map((s) => (
                  <span
                    key={s.id}
                    className={cn(
                      "h-1.5 w-6 rounded-full transition-all",
                      s.id < step && "bg-primary",
                      s.id === step && "w-10 bg-primary",
                      s.id > step && "bg-muted",
                    )}
                  />
                ))}
              </div>
            </header>

            {/* Step content (scroll) */}
            <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8 sm:py-7">
              {step === 1 && (
                <StepCategoria selected={categoria} onSelect={setCategoria} />
              )}
              {step === 2 && (
                <StepPrioridade selected={prioridade} onSelect={setPrioridade} />
              )}
              {step === 3 && (
                <StepDetalhes
                  assunto={assunto}
                  mensagem={mensagem}
                  onAssunto={setAssunto}
                  onMensagem={setMensagem}
                />
              )}
              {step === 4 && (
                <StepAnexos
                  anexos={anexos}
                  drag={drag}
                  setDrag={setDrag}
                  addFiles={addFiles}
                  remove={(id) => setAnexos((a) => a.filter((x) => x.id !== id))}
                  fileRef={fileRef}
                />
              )}
              {step === 5 && (
                <StepRevisao
                  categoria={catSel?.titulo}
                  prioridade={priSel?.label}
                  assunto={assunto}
                  mensagem={mensagem}
                  anexos={anexos}
                />
              )}
            </div>

            {/* Footer nav */}
            <footer className="flex items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4 sm:px-8">
              <Button
                variant="ghost"
                onClick={() => (step === 1 ? setOpen(false) : setStep((s) => s - 1))}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                {step === 1 ? "Cancelar" : "Voltar"}
              </Button>

              {step < total ? (
                <Button
                  size="lg"
                  disabled={!podeAvancar}
                  onClick={() => setStep((s) => Math.min(total, s + 1))}
                  className="gap-1.5"
                >
                  Próximo
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button size="lg" onClick={() => void enviar()} disabled={enviando} className="gap-2">
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {enviando ? "Enviando..." : "Enviar chamado"}
                </Button>
              )}
            </footer>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ───────── Step components ───────── */

function StepCategoria({
  selected, onSelect,
}: { selected: string | null; onSelect: (id: string) => void }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Escolha o tipo de assunto. Isso ajuda a direcionar para o especialista certo.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {categorias.map((c) => {
          const Icon = c.icon;
          const ativo = selected === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                "group relative flex items-start gap-4 overflow-hidden rounded-2xl border-2 p-5 text-left transition-all",
                "hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lift",
                ativo
                  ? "border-primary bg-primary/5 shadow-lift"
                  : "border-border bg-card",
              )}
            >
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors",
                  ativo ? "bg-primary/15" : "bg-muted",
                )}
              >
                <Icon className={cn("h-6 w-6", c.cor)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">{c.titulo}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.descricao}</p>
              </div>
              {ativo && (
                <span className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepPrioridade({
  selected, onSelect,
}: { selected: string; onSelect: (id: string) => void }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Isso define a fila de atendimento. Use "Alta" só quando estiver travado.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {prioridades.map((p) => {
          const ativo = selected === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              className={cn(
                "relative overflow-hidden rounded-2xl border-2 p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lift",
                ativo ? "border-primary bg-primary/5 shadow-lift" : "border-border bg-card",
              )}
            >
              <div
                className={cn(
                  "mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl",
                  p.id === "alta" && "bg-destructive/15 text-destructive",
                  p.id === "media" && "bg-warning/15 text-warning-foreground",
                  p.id === "baixa" && "bg-success/15 text-success",
                )}
              >
                <Zap className="h-5 w-5" />
              </div>
              <p className="text-lg font-semibold">{p.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{p.desc}</p>
              {ativo && (
                <span className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepDetalhes({
  assunto, mensagem, onAssunto, onMensagem,
}: {
  assunto: string; mensagem: string;
  onAssunto: (v: string) => void; onMensagem: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="assunto" className="text-sm font-semibold">
          Resuma em uma frase <span className="text-destructive">*</span>
        </Label>
        <Input
          id="assunto"
          placeholder="Ex.: Não consigo atualizar meu SICAF"
          value={assunto}
          onChange={(e) => onAssunto(e.target.value)}
          className="h-12 text-base"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="mensagem" className="text-sm font-semibold">
          Descreva com detalhes <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="mensagem"
          placeholder="Conte o que você estava fazendo, o que aconteceu e qualquer mensagem de erro. Quanto mais detalhes, mais rápido resolvemos."
          value={mensagem}
          onChange={(e) => onMensagem(e.target.value)}
          className="min-h-[200px] resize-none text-base leading-relaxed"
        />
        <p className="text-right text-xs text-muted-foreground">{mensagem.length} caracteres</p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-muted-foreground">
          Responderemos no seu e-mail cadastrado e também aqui no portal, em{" "}
          <strong className="text-foreground">Suporte → Seus chamados</strong>.
        </p>
      </div>
    </div>
  );
}

function StepAnexos({
  anexos, drag, setDrag, addFiles, remove, fileRef,
}: {
  anexos: Anexo[];
  drag: boolean;
  setDrag: (v: boolean) => void;
  addFiles: (files: FileList | null) => void;
  remove: (id: string) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Anexe prints, PDFs, planilhas ou qualquer arquivo que ajude a entender o problema. Opcional.
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-all",
          drag
            ? "border-primary bg-primary/10"
            : "border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5",
        )}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
          <Upload className="h-7 w-7" />
        </div>
        <p className="mt-4 text-base font-semibold">
          Arraste arquivos aqui ou <span className="text-primary underline-offset-4 hover:underline">clique para selecionar</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, PNG, JPG, DOCX, XLSX — até 20 MB cada
        </p>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.doc,.xls"
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {anexos.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {anexos.length} arquivo{anexos.length > 1 ? "s" : ""} anexado{anexos.length > 1 ? "s" : ""}
          </p>
          <ul className="space-y-2">
            {anexos.map((a) => {
              const isImg = a.type.startsWith("image/");
              const isPdf = a.type === "application/pdf" || a.name.toLowerCase().endsWith(".pdf");
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-xl border bg-card p-3 transition hover:border-primary/40"
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                      isPdf && "bg-destructive/10 text-destructive",
                      isImg && "bg-primary/10 text-primary",
                      !isPdf && !isImg && "bg-muted text-muted-foreground",
                    )}
                  >
                    {isImg ? <ImageIcon className="h-5 w-5" /> : isPdf ? <FileText className="h-5 w-5" /> : <FileIcon className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(a.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(a.id)}
                    className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remover"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function StepRevisao({
  categoria, prioridade, assunto, mensagem, anexos,
}: {
  categoria?: string; prioridade?: string;
  assunto: string; mensagem: string; anexos: Anexo[];
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Confira as informações abaixo antes de enviar.
      </p>

      <div className="space-y-3 rounded-2xl border bg-card p-5">
        <ReviewRow label="Categoria" value={categoria ?? "—"} />
        <ReviewRow label="Urgência" value={prioridade ?? "—"} />
        <ReviewRow label="Assunto" value={assunto || "—"} />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mensagem</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{mensagem || "—"}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Anexos ({anexos.length})
          </p>
          {anexos.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Nenhum arquivo anexado</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {anexos.map((a) => (
                <li
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs"
                >
                  <Paperclip className="h-3 w-3 text-muted-foreground" />
                  {a.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-success/30 bg-success/5 p-3 text-sm">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        <p className="text-muted-foreground">
          Tudo certo? Ao enviar, você recebe um número de protocolo e acompanha aqui no portal.
        </p>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}


function SupportPage() {
  const { user } = useAuth();
  const usuarioNome = user?.nome || "Você";
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const ticket = chamados.find((c) => c.codigo === aberto) ?? null;

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await fetchTickets();
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao carregar chamados");
      return;
    }
    setChamados((res.tickets || []).map((t) => mapTicketResumoToChamado(t, usuarioNome)));
  }, [usuarioNome]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abrirTicket = async (codigo: string) => {
    setAberto(codigo);
    setDetalheLoading(true);
    const det = await fetchTicket(codigo);
    setDetalheLoading(false);
    if (!det.ok || !det.ticket) {
      toast.error(det.error || "Erro ao carregar chamado");
      return;
    }
    setChamados((prev) =>
      prev.map((c) => (c.codigo === codigo ? mapTicketDetalheToChamado(det.ticket!, usuarioNome) : c)),
    );
  };

  const responder = async (codigo: string, texto: string, arquivos: File[] = []) => {
    const res = await responderTicket(codigo, texto);
    if (!res.ok) {
      toast.error(res.error || "Erro ao enviar resposta");
      return;
    }

    if (arquivos.length > 0) {
      let falhas = 0;
      for (const file of arquivos) {
        const up = await uploadTicketAnexo(codigo, file);
        if (!up.ok) falhas += 1;
      }
      if (falhas > 0) toast.warning(`${falhas} anexo(s) não foram enviados.`);
    }

    const det = await fetchTicket(codigo);
    if (det.ok && det.ticket) {
      setChamados((prev) =>
        prev.map((c) => (c.codigo === codigo ? mapTicketDetalheToChamado(det.ticket!, usuarioNome) : c)),
      );
    }
    toast.success("Resposta enviada!");
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<Headphones className="h-5 w-5" />}
        title="Suporte"
        subtitle="Estamos aqui para te ajudar — sem termos técnicos."
        action={<NovoChamadoDialog onCreated={() => void carregar()} />}
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="border-primary/20">
          <CardContent className="flex items-start gap-3 p-5">
            <MessageCircle className="mt-0.5 h-6 w-6 text-success" />
            <div>
              <p className="font-semibold">WhatsApp</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Resposta em até 5 minutos no horário comercial.</p>
              <Button variant="link" className="mt-1 h-auto p-0">Iniciar conversa →</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <PhoneCall className="mt-0.5 h-6 w-6 text-primary" />
            <div>
              <p className="font-semibold">Telefone</p>
              <p className="mt-0.5 text-sm text-muted-foreground">0800 123 4567 — seg a sex, 8h às 18h.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Seus chamados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Carregando chamados...
            </div>
          ) : chamados.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum chamado ainda. Clique em &quot;Abrir chamado&quot; para falar com o suporte.
            </p>
          ) : (
          <ul className="divide-y divide-border">
            {chamados.map((c) => (
              <li key={c.codigo}>
                <button
                  type="button"
                  onClick={() => void abrirTicket(c.codigo)}
                  className="group flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-muted/40 rounded-lg px-2 -mx-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
                        #{c.codigo}
                      </span>
                      <p className="font-medium truncate">{c.titulo}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Aberto em {c.data} • {c.categoria} • por {c.abertoPor}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {c.anexos.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        <Paperclip className="h-3 w-3" />
                        {c.anexos.length}
                      </span>
                    )}
                    <StatusBadge status={c.status}>{c.label}</StatusBadge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
          )}
        </CardContent>
      </Card>

      <TicketDetalheDialog
        ticket={ticket}
        open={!!ticket}
        carregando={detalheLoading}
        onOpenChange={(v) => !v && setAberto(null)}
        onResponder={responder}
      />
    </div>
  );
}

function TicketDetalheDialog({
  ticket,
  open,
  carregando,
  onOpenChange,
  onResponder,
}: {
  ticket: Chamado | null;
  open: boolean;
  carregando?: boolean;
  onOpenChange: (v: boolean) => void;
  onResponder: (codigo: string, texto: string, arquivos?: File[]) => void | Promise<void>;
}) {
  const [responderOpen, setResponderOpen] = useState(false);

  if (!ticket) return null;

  const prioCor =
    ticket.prioridade === "Alta"
      ? "bg-destructive/15 text-destructive"
      : ticket.prioridade === "Média"
        ? "bg-warning/15 text-warning-foreground"
        : "bg-success/15 text-success";

  const ultimaMsg = ticket.mensagens[ticket.mensagens.length - 1];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-[1100px] lg:max-w-[1200px]">
          <DialogTitle className="sr-only">Chamado {ticket.codigo}</DialogTitle>
          <div className="grid h-[90vh] max-h-[820px] grid-cols-1 lg:grid-cols-[1fr_360px]">
            {/* MAIN COLUMN */}
            <div className="flex h-full min-h-0 flex-col border-r">
              <header className="border-b bg-gradient-to-br from-primary/10 via-card to-card px-7 py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 font-mono text-[11px] font-bold text-primary-foreground">
                    #{ticket.codigo}
                  </span>
                  <StatusBadge status={ticket.status}>{ticket.label}</StatusBadge>
                  <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold", prioCor)}>
                    <Zap className="h-3 w-3" />
                    Prioridade {ticket.prioridade}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    <Tag className="h-3 w-3" />
                    {ticket.categoria}
                  </span>
                </div>
                <h3 className="mt-3 text-2xl font-bold tracking-tight">{ticket.titulo}</h3>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Aberto em <strong className="text-foreground">{ticket.data}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Atualizado <strong className="text-foreground">{ticket.ultimaAtualizacao}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {ticket.sla}
                  </span>
                </div>
              </header>

              <div className="flex-1 space-y-5 overflow-y-auto bg-muted/20 px-7 py-6">
                {carregando && (
                  <div className="flex items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Carregando conversa...
                  </div>
                )}
                {!carregando && ticket.mensagens.length === 0 && (
                  <p className="py-12 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
                )}
                {!carregando &&
                  ticket.mensagens.map((m, i) => {
                  const eu = m.autor === "voce";
                  return (
                    <div key={i} className={cn("flex gap-3", eu && "flex-row-reverse")}>
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-2 ring-background",
                          eu ? "bg-primary text-primary-foreground" : "bg-success text-success-foreground",
                        )}
                      >
                        {eu ? "EU" : <Headphones className="h-4 w-4" />}
                      </div>
                      <div className={cn("max-w-[82%] min-w-0", eu && "items-end")}>
                        <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", eu && "justify-end")}>
                          <span className="font-semibold text-foreground">{m.nome}</span>
                          <span>•</span>
                          <span>{m.data}</span>
                        </div>
                        <div
                          className={cn(
                            "mt-1 rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
                            eu
                              ? "rounded-tr-sm border-primary/20 bg-primary/10"
                              : "rounded-tl-sm border-border bg-card",
                          )}
                        >
                          {m.texto}
                        </div>
                        {(m.anexos || []).length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {(m.anexos || []).map((a) => (
                              <li key={a.id}>
                                <a
                                  href={a.url || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => !a.url && e.preventDefault()}
                                  className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs hover:border-primary/40"
                                >
                                  <Paperclip className="h-3 w-3" />
                                  {a.name}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <footer className="flex items-center justify-between gap-3 border-t bg-card px-7 py-4">
                <p className="text-xs text-muted-foreground">
                  {ultimaMsg && (
                    <>Última mensagem por <strong className="text-foreground">{ultimaMsg.nome}</strong> em {ultimaMsg.data}</>
                  )}
                </p>
                <Button size="lg" onClick={() => setResponderOpen(true)} className="gap-2">
                  <Reply className="h-4 w-4" />
                  Responder
                </Button>
              </footer>
            </div>

            {/* SIDEBAR */}
            <aside className="hidden h-full min-h-0 flex-col bg-muted/30 lg:flex">
              <div className="flex-1 overflow-y-auto p-6">
                <SectionTitle>Envolvidos</SectionTitle>
                <div className="mt-3 space-y-3">
                  <PersonRow
                    color="primary"
                    icon={<User className="h-4 w-4" />}
                    role="Aberto por"
                    name={ticket.abertoPor}
                    meta={ticket.email}
                  />
                  <PersonRow
                    color="success"
                    icon={<Headphones className="h-4 w-4" />}
                    role="Atendente"
                    name={ticket.responsavel}
                    meta="Especialista CADBRASIL"
                  />
                </div>

                <SectionTitle className="mt-7">Detalhes</SectionTitle>
                <dl className="mt-3 space-y-2.5 rounded-xl border bg-card p-4 text-xs">
                  <DetailRow icon={<Building2 className="h-3.5 w-3.5" />} label="Empresa" value={ticket.empresa} />
                  <DetailRow icon={<Mail className="h-3.5 w-3.5" />} label="E-mail" value={ticket.email} />
                  <DetailRow icon={<Tag className="h-3.5 w-3.5" />} label="Categoria" value={ticket.categoria} />
                  <DetailRow icon={<Zap className="h-3.5 w-3.5" />} label="Prioridade" value={ticket.prioridade} />
                  <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Abertura" value={ticket.data} />
                  <DetailRow icon={<Clock className="h-3.5 w-3.5" />} label="Atualizado" value={ticket.ultimaAtualizacao} />
                </dl>

                <SectionTitle className="mt-7">
                  Anexos
                  <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                    {ticket.anexos.length}
                  </span>
                </SectionTitle>
                {ticket.anexos.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-dashed bg-card p-4 text-center text-xs text-muted-foreground">
                    Nenhum anexo neste chamado.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {ticket.anexos.map((a) => {
                      const isImg = a.type.startsWith("image/");
                      const isPdf = a.type === "application/pdf" || a.name.toLowerCase().endsWith(".pdf");
                      return (
                        <li
                          key={a.id}
                          className="group flex items-center gap-3 rounded-xl border bg-card p-3 transition hover:border-primary/40 hover:shadow-sm"
                        >
                          <div
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                              isPdf && "bg-destructive/10 text-destructive",
                              isImg && "bg-primary/10 text-primary",
                              !isPdf && !isImg && "bg-muted text-muted-foreground",
                            )}
                          >
                            {isImg ? <ImageIcon className="h-5 w-5" /> : isPdf ? <FileText className="h-5 w-5" /> : <FileIcon className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold">{a.name}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {formatBytes(a.size)} • {a.enviadoPor}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (a.url) window.open(a.url, "_blank", "noopener,noreferrer");
                              else toast.error("Arquivo indisponível");
                            }}
                            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                            aria-label="Baixar"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </aside>
          </div>
        </DialogContent>
      </Dialog>

      <ResponderModal
        open={responderOpen}
        onOpenChange={setResponderOpen}
        ticket={ticket}
        onEnviar={(texto, arquivos) => {
          void onResponder(ticket.codigo, texto, arquivos).then(() => setResponderOpen(false));
        }}
      />
    </>
  );
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h4 className={cn("flex items-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground", className)}>
      {children}
    </h4>
  );
}

function PersonRow({
  color, icon, role, name, meta,
}: {
  color: "primary" | "success";
  icon: React.ReactNode;
  role: string;
  name: string;
  meta: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          color === "primary" && "bg-primary/15 text-primary",
          color === "success" && "bg-success/15 text-success",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{role}</p>
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="truncate text-[11px] text-muted-foreground">{meta}</p>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0 max-w-[60%] truncate text-right font-semibold text-foreground" title={value}>
        {value}
      </dd>
    </div>
  );
}

function ResponderModal({
  open, onOpenChange, ticket, onEnviar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticket: Chamado;
  onEnviar: (texto: string, arquivos: File[]) => void;
}) {
  const [resposta, setResposta] = useState("");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [drag, setDrag] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const novos: Anexo[] = [];
    for (const f of Array.from(files)) {
      if (f.size > MAX_ANEXO_BYTES) {
        toast.error(`${f.name} excede o limite de 20 MB`);
        continue;
      }
      novos.push({
        id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        name: f.name,
        size: f.size,
        type: f.type,
      });
    }
    if (novos.length > 0) setAnexos((prev) => [...prev, ...novos]);
  };

  const enviar = async () => {
    if (resposta.trim().length < 2) return;
    setEnviando(true);
    try {
      onEnviar(
        resposta.trim(),
        anexos.map((a) => a.file),
      );
      setResposta("");
      setAnexos([]);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setResposta(""); setAnexos([]); } }}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-[820px]">
        <DialogTitle className="sr-only">Responder chamado {ticket.codigo}</DialogTitle>
        <div className="flex h-[88vh] max-h-[760px] flex-col">
          <header className="border-b bg-gradient-to-br from-primary/10 via-card to-card px-7 py-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              <Reply className="h-4 w-4" />
              Responder chamado
            </div>
            <h3 className="mt-2 text-xl font-bold tracking-tight">{ticket.titulo}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-mono font-semibold text-primary">#{ticket.codigo}</span> • {ticket.categoria} • Para: <strong className="text-foreground">{ticket.responsavel}</strong>
            </p>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto px-7 py-6">
            <div className="space-y-2">
              <Label htmlFor="resposta-full" className="text-sm font-semibold">
                Sua mensagem <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="resposta-full"
                placeholder="Escreva sua resposta com o máximo de detalhes possível..."
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
                className="min-h-[220px] resize-none text-base leading-relaxed"
                autoFocus
              />
              <p className="text-right text-xs text-muted-foreground">{resposta.length} caracteres</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Anexar arquivos</Label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all",
                  drag
                    ? "border-primary bg-primary/10"
                    : "border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5",
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-semibold">
                  Arraste arquivos ou <span className="text-primary underline-offset-4 hover:underline">clique para selecionar</span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">PDF, PNG, JPG, DOCX — até 20 MB cada</p>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.doc,.xls"
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
              </div>
              {anexos.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {anexos.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 rounded-xl border bg-card p-2.5">
                      <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{a.name}</p>
                        <p className="text-[11px] text-muted-foreground">{formatBytes(a.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAnexos((p) => p.filter((x) => x.id !== a.id))}
                        className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remover"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <footer className="flex items-center justify-between gap-3 border-t bg-muted/30 px-7 py-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="lg" onClick={() => void enviar()} disabled={resposta.trim().length < 2 || enviando} className="gap-2">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {enviando ? "Enviando..." : "Enviar resposta"}
            </Button>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}
