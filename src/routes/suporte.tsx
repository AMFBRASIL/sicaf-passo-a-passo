import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  FileText,
  Headphones,
  HelpCircle,
  MessageCircle,
  Paperclip,
  PhoneCall,
  Plus,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader, StatusBadge } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/suporte")({
  head: () => ({
    meta: [
      { title: "Suporte — CADBRASIL" },
      { name: "description", content: "Fale com nossos especialistas." },
    ],
  }),
  component: SupportPage,
});

const chamados = [
  { titulo: "Dúvida sobre Nível IV", data: "02/12/2025", status: "warn" as const, label: "Em atendimento" },
  { titulo: "Renovação de certidão estadual", data: "20/11/2025", status: "ok" as const, label: "Resolvido" },
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

function NovoChamadoDialog() {
  const [open, setOpen] = useState(false);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [prioridade, setPrioridade] = useState<string>("media");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");

  const podeEnviar = categoria && assunto.trim().length > 3 && mensagem.trim().length > 10;

  const reset = () => {
    setCategoria(null);
    setPrioridade("media");
    setAssunto("");
    setMensagem("");
  };

  const enviar = () => {
    toast.success("Chamado aberto! Em breve um especialista vai te responder.");
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2">
          <Plus className="h-4 w-4" />
          Abrir chamado
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-2xl">
        <div className="border-b bg-gradient-to-br from-primary/5 to-transparent px-6 py-5">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Abrir novo chamado</DialogTitle>
            <DialogDescription className="text-base">
              Conte o que está acontecendo. Nosso time responde em até 1 hora útil.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-7 px-6 py-6">
          {/* Categoria */}
          <section>
            <Label className="mb-3 block text-sm font-semibold">
              1. Qual o assunto? <span className="text-destructive">*</span>
            </Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {categorias.map((c) => {
                const Icon = c.icon;
                const ativo = categoria === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoria(c.id)}
                    className={cn(
                      "group flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5",
                      ativo ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-card",
                    )}
                  >
                    <div className={cn("rounded-lg bg-muted p-2 transition-colors", ativo && "bg-primary/15")}>
                      <Icon className={cn("h-5 w-5", c.cor)} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold leading-tight">{c.titulo}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{c.descricao}</p>
                    </div>
                    {ativo && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Prioridade */}
          <section>
            <Label className="mb-3 block text-sm font-semibold">2. Qual a urgência?</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {prioridades.map((p) => {
                const ativo = prioridade === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPrioridade(p.id)}
                    className={cn(
                      "rounded-xl border-2 p-3 text-left transition-all hover:border-primary/50",
                      ativo ? "border-primary bg-primary/5" : p.cor,
                    )}
                  >
                    <p className="font-semibold">{p.label}</p>
                    <p className="text-xs text-muted-foreground">{p.desc}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Assunto */}
          <section className="space-y-2">
            <Label htmlFor="assunto" className="text-sm font-semibold">
              3. Resuma em uma frase <span className="text-destructive">*</span>
            </Label>
            <Input
              id="assunto"
              placeholder="Ex.: Não consigo atualizar meu SICAF"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              className="h-12 text-base"
            />
          </section>

          {/* Mensagem */}
          <section className="space-y-2">
            <Label htmlFor="mensagem" className="text-sm font-semibold">
              4. Descreva com detalhes <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="mensagem"
              placeholder="Conte o que você estava fazendo, o que aconteceu e qualquer mensagem de erro que apareceu. Quanto mais detalhes, mais rápido resolvemos."
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              className="min-h-[160px] resize-none text-base leading-relaxed"
            />
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Paperclip className="h-3.5 w-3.5" />
                Anexar print ou documento
              </button>
              <span className="text-xs text-muted-foreground">{mensagem.length} caracteres</span>
            </div>
          </section>

          {/* Aviso */}
          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-muted-foreground">
              Responderemos no seu e-mail cadastrado e também aqui no portal, em <strong className="text-foreground">Suporte → Seus chamados</strong>.
            </p>
          </div>
        </div>

        <DialogFooter className="sticky bottom-0 gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur sm:justify-between">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button size="lg" disabled={!podeEnviar} onClick={enviar} className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Enviar chamado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
