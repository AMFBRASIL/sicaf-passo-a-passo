import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatusBadge } from "@/components/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CreditCard,
  Check,
  ShieldCheck,
  Sparkles,
  Headphones,
  FileText,
  Zap,
  Lock,
  AlertCircle,
  QrCode,
  Receipt,
  Calendar,
  Clock,
  Download,
  Copy,
  CheckCircle,
  ArrowLeft,
  Loader2,
} from "lucide-react";

interface Plano {
  id: string;
  nome: string;
  descricao: string;
  preco: string;
  periodo: string;
  precoAntigo?: string;
  destaque?: boolean;
  benefícios: string[];
  cta: string;
  icone: React.ReactNode;
}

const planos: Plano[] = [
  {
    id: "essencial",
    nome: "Essencial",
    descricao: "Ideal para quem está começando no mundo das licitações.",
    preco: "R$ 197",
    periodo: "/mês",
    cta: "Contratar Essencial",
    icone: <FileText className="h-6 w-6" />,
    benefícios: [
      "Cadastro e atualização SICAF",
      "Gestão de certidões (5 documentos)",
      "Alertas de vencimento por e-mail",
      "Suporte por chat",
      "Relatório mensal de situação",
    ],
  },
  {
    id: "anual",
    nome: "Licença Anual",
    descricao: "O mais escolhido por empresas que participam de licitações regularmente.",
    preco: "R$ 149",
    periodo: "/mês",
    precoAntigo: "R$ 197",
    destaque: true,
    cta: "Contratar Anual",
    icone: <Zap className="h-6 w-6" />,
    benefícios: [
      "Tudo do plano Essencial",
      "Desconto de 24% no ano",
      "Monitoramento contínuo do SICAF",
      "Renovação automática de certidões",
      "Assistente de IA para licitações",
      "Análise de editais compatíveis",
      "Suporte prioritário",
    ],
  },
  {
    id: "empresarial",
    nome: "Empresarial",
    descricao: "Para grupos com múltiplas empresas e alta demanda de licitações.",
    preco: "Sob consulta",
    periodo: "",
    cta: "Falar com consultor",
    icone: <Sparkles className="h-6 w-6" />,
    benefícios: [
      "Tudo do plano Anual",
      "Múltiplas empresas no mesmo painel",
      "Gestor de contas dedicado",
      "Leitura de editais com IA avançada",
      "Match automático de licitações",
      "Sugestão de preço vencedor",
      "Relatórios estratégicos mensais",
      "Atendimento VIP telefone + WhatsApp",
    ],
  },
];

const garantias = [
  {
    icone: <ShieldCheck className="h-5 w-5 text-success" />,
    titulo: "Garantia de 7 dias",
    texto: "Não gostou? Devolvemos 100% do valor, sem burocracia.",
  },
  {
    icone: <Lock className="h-5 w-5 text-primary" />,
    titulo: "Pagamento seguro",
    texto: "Criptografia SSL e processamento via gateway certificado.",
  },
  {
    icone: <Headphones className="h-5 w-5 text-primary" />,
    titulo: "Suporte humano",
    texto: "Especialistas em licitações disponíveis para te ajudar.",
  },
  {
    icone: <AlertCircle className="h-5 w-5 text-warning" />,
    titulo: "Cancele quando quiser",
    texto: "Sem multa, sem fidelidade. Você está no controle.",
  },
];

export const Route = createFileRoute("/pagamentos")({
  head: () => ({
    meta: [
      { title: "Pagamentos — CADBRASIL" },
      { name: "description", content: "Escolha o plano ideal para proteger sua empresa e nunca perder uma licitação." },
    ],
  }),
  component: PagamentosPage,
});

function PagamentosPage() {
  const [view, setView] = useState<"planos" | "pago">("planos");
  const [modalAberto, setModalAberto] = useState(false);
  const [planoSelecionado, setPlanoSelecionado] = useState<Plano | null>(null);
  const [formaPagamento, setFormaPagamento] = useState<"pix" | "boleto" | null>(null);
  const [processando, setProcessando] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const abrirPagamento = (plano: Plano) => {
    if (plano.id === "empresarial") {
      // empresarial não abre modal de pagamento imediato
      return;
    }
    setPlanoSelecionado(plano);
    setFormaPagamento(null);
    setModalAberto(true);
  };

  const confirmarPagamento = () => {
    if (!formaPagamento || !planoSelecionado) return;
    setProcessando(true);
    setTimeout(() => {
      setProcessando(false);
      setModalAberto(false);
      setView("pago");
    }, 1800);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (view === "pago" && planoSelecionado) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <PageHeader
          icon={<CreditCard className="h-5 w-5" />}
          title="Meu plano"
          subtitle="Gerencie sua assinatura e acompanhe os detalhes do serviço."
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Card principal do plano */}
          <Card className="lg:col-span-2 border-primary/20 shadow-lift ring-1 ring-primary/10">
            <CardHeader className="pb-2 pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    {planoSelecionado.icone}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{planoSelecionado.nome}</h3>
                    <StatusBadge status="ok">Plano ativo</StatusBadge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-baseline gap-2 justify-end">
                    {planoSelecionado.precoAntigo && (
                      <span className="text-sm text-muted-foreground line-through">
                        {planoSelecionado.precoAntigo}
                      </span>
                    )}
                    <span className="text-3xl font-bold text-primary">
                      {planoSelecionado.preco}
                    </span>
                    <span className="text-sm text-muted-foreground">{planoSelecionado.periodo}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-6">
              <Separator className="my-4" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Próxima cobrança</p>
                    <p className="text-sm font-medium">05/07/2026</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    {formaPagamento === "pix" ? (
                      <QrCode className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Receipt className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Forma de pagamento</p>
                    <p className="text-sm font-medium capitalize">{formaPagamento}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Início da vigência</p>
                    <p className="text-sm font-medium">05/06/2026</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <CheckCircle className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="text-sm font-medium text-success">Pagamento confirmado</p>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />
              <h4 className="text-sm font-semibold mb-3">Benefícios inclusos</h4>
              <ul className="grid gap-2 sm:grid-cols-2">
                {planoSelecionado.benefícios.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-muted-foreground">{b}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Ações rápidas */}
          <div className="flex flex-col gap-4">
            <Card className="border-border/60 shadow-soft">
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold">Ações rápidas</h4>
                <div className="mt-3 flex flex-col gap-2">
                  <Button variant="outline" className="w-full justify-start gap-2" size="sm">
                    <Download className="h-4 w-4" />
                    Gerar 2ª via
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2" size="sm">
                    <Receipt className="h-4 w-4" />
                    Nota fiscal
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2" size="sm">
                    <ArrowLeft className="h-4 w-4" />
                    Alterar plano
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-soft">
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold">Código do cliente</h4>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono text-muted-foreground">
                    CAD-2026-8842
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => copyToClipboard("CAD-2026-8842")}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Garantias */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {garantias.map((g) => (
            <Card key={g.titulo} className="border-border/50 shadow-soft">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  {g.icone}
                </div>
                <div>
                  <p className="text-sm font-semibold">{g.titulo}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{g.texto}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<CreditCard className="h-5 w-5" />}
        title="Escolha seu plano"
        subtitle="Proteja sua empresa e nunca perca uma licitação por documento vencido."
      />

      {/* Cards de planos */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {planos.map((plano) => (
          <Card
            key={plano.id}
            className={`relative flex flex-col transition-all duration-300 ${
              plano.destaque
                ? "border-primary/40 shadow-lift ring-1 ring-primary/20"
                : "border-border/60 shadow-soft"
            } ${hovered === plano.id ? "-translate-y-1" : ""}`}
            onMouseEnter={() => setHovered(plano.id)}
            onMouseLeave={() => setHovered(null)}
          >
            {plano.destaque && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge
                  variant="default"
                  className="bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold shadow-md"
                >
                  Mais popular
                </Badge>
              </div>
            )}

            <CardHeader className="pb-2 pt-6">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    plano.destaque
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {plano.icone}
                </div>
                <div>
                  <h3 className="text-lg font-bold">{plano.nome}</h3>
                  {plano.destaque && (
                    <StatusBadge status="ok">Recomendado</StatusBadge>
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {plano.descricao}
              </p>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col">
              <div className="mt-2 mb-4">
                <div className="flex items-baseline gap-2">
                  {plano.precoAntigo && (
                    <span className="text-sm text-muted-foreground line-through">
                      {plano.precoAntigo}
                    </span>
                  )}
                  <span
                    className={`text-3xl font-bold ${
                      plano.destaque ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {plano.preco}
                  </span>
                  {plano.periodo && (
                    <span className="text-sm text-muted-foreground">
                      {plano.periodo}
                    </span>
                  )}
                </div>
                {plano.id === "anual" && (
                  <p className="mt-1 text-xs text-success font-medium">
                    Economize R$ 576 no ano
                  </p>
                )}
              </div>

              <ul className="mb-6 space-y-2.5">
                {plano.benefícios.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm">
                    <Check
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        plano.destaque ? "text-primary" : "text-success"
                      }`}
                    />
                    <span className="text-muted-foreground">{b}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto">
                <Button
                  className="w-full"
                  size="lg"
                  variant={plano.destaque ? "default" : "outline"}
                  onClick={() => abrirPagamento(plano)}
                >
                  {plano.cta}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Garantias */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {garantias.map((g) => (
          <Card
            key={g.titulo}
            className="border-border/50 shadow-soft"
          >
            <CardContent className="flex items-start gap-3 p-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                {g.icone}
              </div>
              <div>
                <p className="text-sm font-semibold">{g.titulo}</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  {g.texto}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* FAQ resumido */}
      <Card className="mt-8 border-border/50">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-base font-semibold">Ainda tem dúvidas?</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Nosso time de especialistas pode te ajudar a escolher o plano ideal.
              </p>
            </div>
            <Button variant="outline" className="shrink-0">
              <Headphones className="mr-2 h-4 w-4" />
              Falar com especialista
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal de pagamento */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Forma de pagamento
            </DialogTitle>
            <DialogDescription>
              {planoSelecionado && (
                <span>
                  Plano <strong>{planoSelecionado.nome}</strong> — {planoSelecionado.preco}
                  {planoSelecionado.periodo}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* PIX */}
            <button
              onClick={() => setFormaPagamento("pix")}
              className={`relative flex flex-col items-center gap-3 rounded-xl border-2 p-6 text-center transition-all ${
                formaPagamento === "pix"
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border bg-card hover:border-primary/30 hover:bg-accent/30"
              }`}
            >
              {formaPagamento === "pix" && (
                <div className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3.5 w-3.5" />
                </div>
              )}
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                  formaPagamento === "pix"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <QrCode className="h-7 w-7" />
              </div>
              <div>
                <p className="text-base font-semibold">PIX</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pagamento instantâneo com QR Code
                </p>
              </div>
            </button>

            {/* Boleto */}
            <button
              onClick={() => setFormaPagamento("boleto")}
              className={`relative flex flex-col items-center gap-3 rounded-xl border-2 p-6 text-center transition-all ${
                formaPagamento === "boleto"
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border bg-card hover:border-primary/30 hover:bg-accent/30"
              }`}
            >
              {formaPagamento === "boleto" && (
                <div className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3.5 w-3.5" />
                </div>
              )}
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                  formaPagamento === "boleto"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Receipt className="h-7 w-7" />
              </div>
              <div>
                <p className="text-base font-semibold">Boleto Bancário</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Compensação em até 2 dias úteis
                </p>
              </div>
            </button>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setModalAberto(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!formaPagamento || processando}
              onClick={confirmarPagamento}
              className="gap-2"
            >
              {processando && <Loader2 className="h-4 w-4 animate-spin" />}
              {processando ? "Processando..." : "Confirmar pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
