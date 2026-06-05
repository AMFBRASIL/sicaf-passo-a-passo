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
  Headphones,
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
  Award,
  Wrench,
  RefreshCw,
  Zap,
  Timer,
  Lock as LockIcon,
} from "lucide-react";

type PlanoSicafId = "sicaf-24h" | "sicaf-emergencial";

interface PlanoSicaf {
  id: PlanoSicafId;
  nome: string;
  subtitulo: string;
  preco: string;
  precoNumero: number;
  prazo: string;
  prazoIcone: React.ReactNode;
  destaque?: boolean;
  badge?: string;
  beneficios: string[];
  cor: "primary" | "warning";
}

const planosSicaf: PlanoSicaf[] = [
  {
    id: "sicaf-24h",
    nome: "Cadastro / Renovação SICAF",
    subtitulo: "Processamento padrão em até 24 horas úteis",
    preco: "R$ 985,00",
    precoNumero: 985,
    prazo: "Em até 24 horas úteis",
    prazoIcone: <Clock className="h-4 w-4" />,
    badge: "Mais escolhido",
    cor: "primary",
    beneficios: [
      "Cadastro completo no SICAF (níveis I a VI)",
      "Validação e envio do certificado digital",
      "Análise documental por especialista",
      "Comprovante oficial de registro",
      "Suporte por WhatsApp e e-mail",
      "Conclusão em até 24 horas úteis",
    ],
  },
  {
    id: "sicaf-emergencial",
    nome: "Cadastro / Renovação Emergencial",
    subtitulo: "Atendimento imediato para licitações em andamento",
    preco: "R$ 1.450,00",
    precoNumero: 1450,
    prazo: "Início imediato — prioridade máxima",
    prazoIcone: <Zap className="h-4 w-4" />,
    destaque: true,
    badge: "Imediato",
    cor: "warning",
    beneficios: [
      "Tudo do plano padrão incluso",
      "Início imediato após pagamento",
      "Fila prioritária com especialista dedicado",
      "Atendimento fora do horário comercial",
      "Ideal para empresas com licitação aberta",
      "Acompanhamento em tempo real do processo",
    ],
  },
];

const manutencao = {
  nome: "Manutenção SICAF",
  subtitulo: "Atualização contínua mês a mês",
  descricao:
    "Após seu cadastro SICAF estar validado, ative a manutenção mensal e mantenha certidões, níveis e documentos sempre em dia — sem risco de perder licitações por pendência.",
  preco: "R$ 149,00",
  periodo: "/mês",
  recorrencia: "Cobrança mensal · cancele quando quiser",
  beneficios: [
    "Monitoramento contínuo do SICAF",
    "Atualização automática de certidões",
    "Alertas de vencimento por e-mail e WhatsApp",
    "Renovação de níveis (III, IV, V e VI)",
    "Gestão de pendências junto à Receita",
    "Relatório mensal de situação",
    "Suporte prioritário com especialista",
  ],
};

const garantias = [
  {
    icone: <ShieldCheck className="h-5 w-5 text-success" />,
    titulo: "Cadastro oficial",
    texto: "Registro direto no sistema do Governo Federal.",
  },
  {
    icone: <Lock className="h-5 w-5 text-primary" />,
    titulo: "Pagamento seguro",
    texto: "Criptografia SSL e gateway certificado.",
  },
  {
    icone: <Headphones className="h-5 w-5 text-primary" />,
    titulo: "Suporte humano",
    texto: "Especialistas em SICAF prontos para te atender.",
  },
  {
    icone: <AlertCircle className="h-5 w-5 text-warning" />,
    titulo: "Sem fidelidade",
    texto: "Cancele a manutenção mensal quando quiser.",
  },
];

type ProdutoPagto =
  | { tipo: "sicaf"; plano: PlanoSicaf }
  | { tipo: "manutencao" };

export const Route = createFileRoute("/pagamentos")({
  head: () => ({
    meta: [
      { title: "Pagamentos — CADBRASIL" },
      {
        name: "description",
        content:
          "Escolha o plano de cadastro ou renovação do SICAF (padrão ou emergencial) e, depois de validado, ative a manutenção mensal.",
      },
    ],
  }),
  component: PagamentosPage,
});

function PagamentosPage() {
  const [sicafContratado, setSicafContratado] = useState<{
    plano: PlanoSicaf;
    formaPagamento: "pix" | "boleto";
  } | null>(null);
  const [manutencaoContratada, setManutencaoContratada] = useState<{
    formaPagamento: "pix" | "boleto";
  } | null>(null);

  const [modalAberto, setModalAberto] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoPagto | null>(null);
  const [formaPagamento, setFormaPagamento] = useState<"pix" | "boleto" | null>(null);
  const [processando, setProcessando] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const abrirPagamentoSicaf = (plano: PlanoSicaf) => {
    setProdutoSelecionado({ tipo: "sicaf", plano });
    setFormaPagamento(null);
    setModalAberto(true);
  };
  const abrirPagamentoManutencao = () => {
    setProdutoSelecionado({ tipo: "manutencao" });
    setFormaPagamento(null);
    setModalAberto(true);
  };

  const confirmarPagamento = () => {
    if (!formaPagamento || !produtoSelecionado) return;
    setProcessando(true);
    setTimeout(() => {
      setProcessando(false);
      setModalAberto(false);
      if (produtoSelecionado.tipo === "sicaf") {
        setSicafContratado({ plano: produtoSelecionado.plano, formaPagamento });
      } else {
        setManutencaoContratada({ formaPagamento });
      }
    }, 1600);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tituloHeader = sicafContratado
    ? manutencaoContratada
      ? "Meus serviços"
      : "Cadastro SICAF ativo"
    : "Pagamentos";
  const subtituloHeader = sicafContratado
    ? manutencaoContratada
      ? "Seu cadastro SICAF está validado e a manutenção mensal está ativa."
      : "Seu cadastro SICAF está validado. Agora você pode ativar a manutenção mensal."
    : "Comece pelo cadastro ou renovação do SICAF e mantenha sua empresa apta a licitar.";

  const tituloProdutoModal =
    produtoSelecionado?.tipo === "sicaf"
      ? produtoSelecionado.plano.nome
      : produtoSelecionado?.tipo === "manutencao"
      ? manutencao.nome
      : "";
  const precoProdutoModal =
    produtoSelecionado?.tipo === "sicaf"
      ? produtoSelecionado.plano.preco
      : produtoSelecionado?.tipo === "manutencao"
      ? `${manutencao.preco}${manutencao.periodo}`
      : "";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<CreditCard className="h-5 w-5" />}
        title={tituloHeader}
        subtitle={subtituloHeader}
      />

      {/* Etapa 1 — Cadastro SICAF */}
      <section className="mt-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
            1
          </div>
          <div>
            <h2 className="text-base font-semibold">Cadastro ou renovação do SICAF</h2>
            <p className="text-xs text-muted-foreground">
              Escolha o prazo de processamento ideal para sua necessidade.
            </p>
          </div>
        </div>

        {sicafContratado ? (
          <Card className="border-success/40 shadow-lift ring-1 ring-success/20">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success text-success-foreground">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{sicafContratado.plano.nome}</h3>
                      <Badge className="bg-success text-success-foreground">Validado</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Pago via{" "}
                      {sicafContratado.formaPagamento === "pix" ? "PIX" : "Boleto"} ·{" "}
                      {sicafContratado.plano.preco} · Próxima renovação 05/06/2027
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    Comprovante
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Receipt className="h-3.5 w-3.5" />
                    Nota fiscal
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {planosSicaf.map((plano) => (
              <Card
                key={plano.id}
                className={`relative flex flex-col transition-all duration-300 ${
                  plano.destaque
                    ? "border-warning/40 shadow-lift ring-1 ring-warning/20"
                    : "border-primary/30 shadow-soft"
                } ${hovered === plano.id ? "-translate-y-1" : ""}`}
                onMouseEnter={() => setHovered(plano.id)}
                onMouseLeave={() => setHovered(null)}
              >
                {plano.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge
                      className={`px-3 py-1 text-xs font-semibold shadow-md ${
                        plano.destaque
                          ? "bg-warning text-warning-foreground"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      {plano.destaque && <Zap className="mr-1 h-3 w-3" />}
                      {plano.badge}
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-2 pt-6">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                        plano.destaque
                          ? "bg-warning text-warning-foreground"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      {plano.destaque ? (
                        <Zap className="h-6 w-6" />
                      ) : (
                        <Award className="h-6 w-6" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold leading-tight">{plano.nome}</h3>
                      <p className="text-xs text-muted-foreground">{plano.subtitulo}</p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col">
                  <div
                    className={`my-4 rounded-xl border p-4 ${
                      plano.destaque
                        ? "border-warning/30 bg-warning/5"
                        : "border-border bg-muted/30"
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`text-3xl font-bold ${
                          plano.destaque ? "text-warning" : "text-primary"
                        }`}
                      >
                        {plano.preco}
                      </span>
                      <span className="text-sm text-muted-foreground">/ pagamento único</span>
                    </div>
                    <div
                      className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${
                        plano.destaque ? "text-warning" : "text-primary"
                      }`}
                    >
                      {plano.prazoIcone}
                      {plano.prazo}
                    </div>
                  </div>

                  <ul className="mb-6 space-y-2.5">
                    {plano.beneficios.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm">
                        <Check
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            plano.destaque ? "text-warning" : "text-primary"
                          }`}
                        />
                        <span className="text-muted-foreground">{b}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="mt-auto w-full"
                    size="lg"
                    variant={plano.destaque ? "secondary" : "default"}
                    onClick={() => abrirPagamentoSicaf(plano)}
                  >
                    {plano.destaque ? (
                      <>
                        <Zap className="mr-1.5 h-4 w-4" />
                        Contratar emergencial
                      </>
                    ) : (
                      "Contratar agora"
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Etapa 2 — Manutenção */}
      <section className="mt-10">
        <div className="mb-4 flex items-center gap-3">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
              sicafContratado
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {sicafContratado ? "2" : <LockIcon className="h-4 w-4" />}
          </div>
          <div>
            <h2 className="text-base font-semibold">Manutenção mensal do SICAF</h2>
            <p className="text-xs text-muted-foreground">
              Disponível após o cadastro SICAF estar validado.
            </p>
          </div>
        </div>

        <Card
          className={`relative transition-all duration-300 ${
            !sicafContratado
              ? "border-dashed border-border/60 bg-muted/20"
              : manutencaoContratada
              ? "border-success/40 shadow-lift ring-1 ring-success/20"
              : "border-secondary/40 shadow-lift ring-1 ring-secondary/20"
          }`}
        >
          {manutencaoContratada && (
            <div className="absolute -top-3 left-6">
              <Badge className="bg-success text-success-foreground px-3 py-1 text-xs font-semibold shadow-md">
                <CheckCircle className="mr-1 h-3 w-3" />
                Manutenção ativa
              </Badge>
            </div>
          )}

          <CardContent className="p-6">
            {!sicafContratado ? (
              <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <LockIcon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    A manutenção é uma consequência do cadastro SICAF
                  </p>
                  <p className="mt-1 max-w-md text-xs text-muted-foreground">
                    Após contratar o cadastro ou renovação acima e termos validado seus dados, esta
                    opção será liberada para manter tudo sempre em dia.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                        manutencaoContratada
                          ? "bg-success text-success-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      <Wrench className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold leading-tight">{manutencao.nome}</h3>
                      <p className="text-xs text-muted-foreground">{manutencao.subtitulo}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    {manutencao.descricao}
                  </p>
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    {manutencao.beneficios.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span className="text-muted-foreground">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 lg:w-64">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">{manutencao.preco}</span>
                      <span className="text-sm text-muted-foreground">{manutencao.periodo}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <RefreshCw className="h-3 w-3" />
                      {manutencao.recorrencia}
                    </div>
                  </div>
                  {manutencaoContratada ? (
                    <>
                      <div className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-xs">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          {manutencaoContratada.formaPagamento === "pix" ? (
                            <QrCode className="h-3.5 w-3.5" />
                          ) : (
                            <Receipt className="h-3.5 w-3.5" />
                          )}
                          {manutencaoContratada.formaPagamento === "pix" ? "PIX" : "Boleto"}
                        </span>
                        <span className="font-medium text-success">Confirmado</span>
                      </div>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Download className="h-3.5 w-3.5" />
                        2ª via
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="w-full"
                      variant="secondary"
                      onClick={abrirPagamentoManutencao}
                    >
                      Ativar manutenção
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Detalhes da contratação */}
      {sicafContratado && (
        <Card className="mt-8 border-border/60 shadow-soft">
          <CardHeader className="pb-2 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Detalhes da contratação</h3>
                <p className="text-xs text-muted-foreground">
                  Vigência, próximas cobranças e dados do cliente.
                </p>
              </div>
              <StatusBadge status="ok">Em dia</StatusBadge>
            </div>
          </CardHeader>
          <CardContent>
            <Separator className="my-3" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Próxima renovação SICAF</p>
                  <p className="text-sm font-medium">05/06/2027</p>
                </div>
              </div>
              {manutencaoContratada && (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Próxima cobrança mensal</p>
                    <p className="text-sm font-medium">05/07/2026</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <CheckCircle className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Início da vigência</p>
                  <p className="text-sm font-medium">05/06/2026</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Código do cliente</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono">
                      CAD-2026-8842
                    </code>
                    <button
                      onClick={() => copyToClipboard("CAD-2026-8842")}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* FAQ resumido */}
      <Card className="mt-8 border-border/50">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-base font-semibold">
                Dúvidas sobre cadastro, renovação ou manutenção?
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Nossos especialistas em SICAF explicam tudo o que você precisa saber.
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
              <span>
                <strong>{tituloProdutoModal}</strong> — {precoProdutoModal}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
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
              <ArrowLeft className="mr-1.5 h-4 w-4" />
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
