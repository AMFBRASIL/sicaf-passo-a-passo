import { useState } from "react";
import { PageHeader, StatusBadge } from "@/components/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export function PlanosPage() {
  const [hovered, setHovered] = useState<string | null>(null);

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
    </div>
  );
}
