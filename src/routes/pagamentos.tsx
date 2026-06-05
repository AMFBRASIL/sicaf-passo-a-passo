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
} from "lucide-react";

interface Produto {
  id: "licenca-anual" | "manutencao-sicaf";
  nome: string;
  subtitulo: string;
  descricao: string;
  preco: string;
  precoNumero: number;
  periodo: string;
  recorrencia: string;
  destaque?: boolean;
  obrigatorio?: boolean;
  benefícios: string[];
  cta: string;
  icone: React.ReactNode;
  cor: "primary" | "secondary";
}

const produtos: Produto[] = [
  {
    id: "licenca-anual",
    nome: "Licença Anual SICAF",
    subtitulo: "Renovação obrigatória do cadastro",
    descricao:
      "Taxa anual para manter o cadastro SICAF da sua empresa ativo junto ao Governo Federal. Sem essa licença, sua empresa não pode participar de licitações.",
    preco: "R$ 985,00",
    precoNumero: 985,
    periodo: "/ano",
    recorrencia: "Cobrança anual · vence sempre na mesma data",
    obrigatorio: true,
    cta: "Renovar licença anual",
    icone: <Award className="h-6 w-6" />,
    cor: "primary",
    benefícios: [
      "Renovação do cadastro SICAF por 12 meses",
      "Liberação para participar de licitações federais",
      "Emissão e validação de certificado digital",
      "Cadastro completo nos níveis I a VI",
      "Suporte na renovação e documentação",
      "Comprovante oficial de renovação",
    ],
  },
  {
    id: "manutencao-sicaf",
    nome: "Manutenção SICAF",
    subtitulo: "Atualização contínua mês a mês",
    descricao:
      "Serviço mensal de manutenção do SICAF junto à CADBRASIL. Mantemos seus dados, certidões e níveis sempre atualizados para você nunca perder uma licitação.",
    preco: "R$ 149,00",
    precoNumero: 149,
    periodo: "/mês",
    recorrencia: "Cobrança mensal · cancele quando quiser",
    destaque: true,
    cta: "Contratar manutenção",
    icone: <Wrench className="h-6 w-6" />,
    cor: "secondary",
    benefícios: [
      "Monitoramento contínuo do SICAF",
      "Atualização automática de certidões",
      "Alertas de vencimento por e-mail e WhatsApp",
      "Renovação de níveis (III, IV, V e VI)",
      "Gestão de pendências junto à Receita",
      "Relatório mensal de situação",
      "Suporte prioritário com especialista",
    ],
  },
];

const garantias = [
  {
    icone: <ShieldCheck className="h-5 w-5 text-success" />,
    titulo: "Cadastro oficial",
    texto: "Renovação direta no sistema do Governo Federal.",
  },
  {
    icone: <Lock className="h-5 w-5 text-primary" />,
    titulo: "Pagamento seguro",
    texto: "Criptografia SSL e processamento via gateway certificado.",
  },
  {
    icone: <Headphones className="h-5 w-5 text-primary" />,
    titulo: "Suporte humano",
    texto: "Especialistas em SICAF prontos para te atender.",
  },
  {
    icone: <AlertCircle className="h-5 w-5 text-warning" />,
    titulo: "Sem fidelidade na manutenção",
    texto: "Cancele o serviço mensal quando quiser, sem multa.",
  },
];

export const Route = createFileRoute("/pagamentos")({
  head: () => ({
    meta: [
      { title: "Pagamentos — CADBRASIL" },
      {
        name: "description",
        content:
          "Renove sua licença anual do SICAF e contrate o serviço de manutenção para manter sua empresa sempre apta a licitar.",
      },
    ],
  }),
  component: PagamentosPage,
});

function PagamentosPage() {
  const [contratados, setContratados] = useState<Record<string, { formaPagamento: "pix" | "boleto" }>>({});
  const [modalAberto, setModalAberto] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [formaPagamento, setFormaPagamento] = useState<"pix" | "boleto" | null>(null);
  const [processando, setProcessando] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const abrirPagamento = (produto: Produto) => {
    setProdutoSelecionado(produto);
    setFormaPagamento(null);
    setModalAberto(true);
  };

  const confirmarPagamento = () => {
    if (!formaPagamento || !produtoSelecionado) return;
    setProcessando(true);
    setTimeout(() => {
      setProcessando(false);
      setModalAberto(false);
      setContratados((c) => ({
        ...c,
        [produtoSelecionado.id]: { formaPagamento },
      }));
    }, 1600);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const todosContratados = produtos.every((p) => contratados[p.id]);
  const algumContratado = produtos.some((p) => contratados[p.id]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<CreditCard className="h-5 w-5" />}
        title={todosContratados ? "Meus serviços" : "Pagamentos"}
        subtitle={
          todosContratados
            ? "Sua licença SICAF e a manutenção estão ativas e em dia."
            : "Mantenha sua empresa apta a licitar com a licença anual + manutenção mensal."
        }
      />

      {/* Resumo no topo quando há contratações */}
      {algumContratado && !todosContratados && (
        <Card className="mt-6 border-warning/30 bg-warning/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Você ainda não contratou todos os serviços</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                A Licença Anual e a Manutenção funcionam juntas. A licença mantém seu cadastro válido,
                e a manutenção garante que ele esteja sempre atualizado.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards de produtos */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {produtos.map((produto) => {
          const ativo = !!contratados[produto.id];
          return (
            <Card
              key={produto.id}
              className={`relative flex flex-col transition-all duration-300 ${
                ativo
                  ? "border-success/40 shadow-lift ring-1 ring-success/20"
                  : produto.destaque
                  ? "border-primary/40 shadow-lift ring-1 ring-primary/20"
                  : "border-border/60 shadow-soft"
              } ${hovered === produto.id && !ativo ? "-translate-y-1" : ""}`}
              onMouseEnter={() => setHovered(produto.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {ativo && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-success text-success-foreground px-3 py-1 text-xs font-semibold shadow-md">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Serviço ativo
                  </Badge>
                </div>
              )}
              {!ativo && produto.obrigatorio && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold shadow-md">
                    Obrigatório
                  </Badge>
                </div>
              )}
              {!ativo && produto.destaque && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-secondary text-secondary-foreground px-3 py-1 text-xs font-semibold shadow-md">
                    Recomendado
                  </Badge>
                </div>
              )}

              <CardHeader className="pb-2 pt-6">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                      ativo
                        ? "bg-success text-success-foreground"
                        : produto.cor === "primary"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {produto.icone}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold leading-tight">{produto.nome}</h3>
                    <p className="text-xs text-muted-foreground">{produto.subtitulo}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {produto.descricao}
                </p>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col">
                <div className="my-4 rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-3xl font-bold ${
                        produto.cor === "primary" ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {produto.preco}
                    </span>
                    <span className="text-sm text-muted-foreground">{produto.periodo}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <RefreshCw className="h-3 w-3" />
                    {produto.recorrencia}
                  </div>
                </div>

                <ul className="mb-6 space-y-2.5">
                  {produto.benefícios.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm">
                      <Check
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          produto.cor === "primary" ? "text-primary" : "text-success"
                        }`}
                      />
                      <span className="text-muted-foreground">{b}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto space-y-2">
                  {ativo ? (
                    <>
                      <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          {contratados[produto.id].formaPagamento === "pix" ? (
                            <QrCode className="h-3.5 w-3.5" />
                          ) : (
                            <Receipt className="h-3.5 w-3.5" />
                          )}
                          Pago via {contratados[produto.id].formaPagamento === "pix" ? "PIX" : "Boleto"}
                        </span>
                        <span className="font-medium text-success">Confirmado</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <Download className="h-3.5 w-3.5" />
                          2ª via
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <Receipt className="h-3.5 w-3.5" />
                          Nota fiscal
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button
                      className="w-full"
                      size="lg"
                      variant={produto.cor === "primary" ? "default" : "secondary"}
                      onClick={() => abrirPagamento(produto)}
                    >
                      {produto.cta}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detalhes da assinatura quando há algo ativo */}
      {algumContratado && (
        <Card className="mt-8 border-border/60 shadow-soft">
          <CardHeader className="pb-2 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Detalhes da contratação</h3>
                <p className="text-xs text-muted-foreground">
                  Datas de cobrança, vigência e dados do cliente.
                </p>
              </div>
              <StatusBadge status="ok">Em dia</StatusBadge>
            </div>
          </CardHeader>
          <CardContent>
            <Separator className="my-3" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {contratados["licenca-anual"] && (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Próxima renovação anual</p>
                    <p className="text-sm font-medium">05/06/2027</p>
                  </div>
                </div>
              )}
              {contratados["manutencao-sicaf"] && (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Clock className="h-4 w-4 text-muted-foreground" />
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
                    <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono">CAD-2026-8842</code>
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
              <h4 className="text-base font-semibold">Dúvidas sobre licença ou manutenção?</h4>
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
              {produtoSelecionado && (
                <span>
                  <strong>{produtoSelecionado.nome}</strong> — {produtoSelecionado.preco}
                  {produtoSelecionado.periodo}
                </span>
              )}
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
