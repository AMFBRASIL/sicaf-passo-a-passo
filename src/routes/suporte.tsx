import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
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
  mensagens: ChamadoMsg[];
};

const chamadosIniciais: Chamado[] = [
  {
    codigo: "CB-2025-0482",
    titulo: "Dúvida sobre Nível IV",
    data: "02/12/2025",
    status: "warn",
    label: "Em atendimento",
    categoria: "SICAF / Cadastro",
    prioridade: "Média",
    responsavel: "Marina Costa",
    mensagens: [
      {
        autor: "voce",
        nome: "Você",
        data: "02/12/2025 09:14",
        texto:
          "Olá! Tentei avançar para o Nível IV do SICAF mas o sistema retorna um erro de qualificação técnica. Podem me ajudar a entender o que falta?",
      },
      {
        autor: "suporte",
        nome: "Marina • Suporte CADBRASIL",
        data: "02/12/2025 10:02",
        texto:
          "Oi! Já estou analisando seu cadastro. Notei que faltam 2 atestados de capacidade técnica vigentes. Posso te enviar o modelo padrão aceito pelo SICAF?",
      },
    ],
  },
  {
    codigo: "CB-2025-0471",
    titulo: "Renovação de certidão estadual",
    data: "20/11/2025",
    status: "ok",
    label: "Resolvido",
    categoria: "Documentos & Certidões",
    prioridade: "Baixa",
    responsavel: "Rafael Lima",
    mensagens: [
      {
        autor: "voce",
        nome: "Você",
        data: "20/11/2025 14:22",
        texto: "Minha certidão estadual venceu, como faço para renovar pelo portal?",
      },
      {
        autor: "suporte",
        nome: "Rafael • Suporte CADBRASIL",
        data: "20/11/2025 14:41",
        texto:
          "Já emitimos a nova certidão e anexamos ao seu cadastro. Tudo regularizado!",
      },
    ],
  },
];


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

type Anexo = { id: string; name: string; size: number; type: string };

const steps = [
  { id: 1, title: "Categoria", desc: "Sobre o que é o chamado?" },
  { id: 2, title: "Urgência", desc: "Qual a prioridade?" },
  { id: 3, title: "Detalhes", desc: "Conte o que aconteceu" },
  { id: 4, title: "Anexos", desc: "Documentos, prints, PDFs" },
  { id: 5, title: "Revisão", desc: "Confira e envie" },
];

function NovoChamadoDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [prioridade, setPrioridade] = useState<string>("media");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [drag, setDrag] = useState(false);
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

  const enviar = () => {
    toast.success("Chamado aberto! Em breve um especialista vai te responder.");
    reset();
    setOpen(false);
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const novos: Anexo[] = Array.from(files).map((f) => ({
      id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`,
      name: f.name,
      size: f.size,
      type: f.type,
    }));
    setAnexos((prev) => [...prev, ...novos]);
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
                <Button size="lg" onClick={enviar} className="gap-2">
                  <Send className="h-4 w-4" />
                  Enviar chamado
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
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<Headphones className="h-5 w-5" />}
        title="Suporte"
        subtitle="Estamos aqui para te ajudar — sem termos técnicos."
        action={<NovoChamadoDialog />}
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
          <ul className="divide-y divide-border">
            {chamados.map((c) => (
              <li key={c.titulo} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium">{c.titulo}</p>
                  <p className="text-xs text-muted-foreground">Aberto em {c.data}</p>
                </div>
                <StatusBadge status={c.status}>{c.label}</StatusBadge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
