import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  FileSearch,
  ShieldCheck,
  Calculator,
  MessageSquareText,
  FileSignature,
  TrendingUp,
  Upload,
  ArrowRight,
  ArrowLeft,
  Check,
  FileText,
  Loader2,
  CheckCircle2,
  Download,
  X,
  Settings2,
  Zap,
  Target,
  Award,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader, PageContainer } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { executarModuloIA, type ResultadoIA } from "@/lib/servicos-ia-api";
import { toast } from "sonner";

export const Route = createFileRoute("/servicos-ia")({
  head: () => ({
    meta: [
      { title: "Serviços com IA — CADBRASIL" },
      {
        name: "description",
        content:
          "Ferramentas inteligentes para ler editais, analisar sua empresa e ganhar mais licitações.",
      },
    ],
  }),
  component: ServicosIAPage,
});

type OpcaoCard = { id: string; titulo: string; descricao: string; icon: typeof Sparkles };

type Modulo = {
  id: string;
  titulo: string;
  resumo: string;
  descricao: string;
  icon: typeof Sparkles;
  tag: string;
  destaque?: boolean;
  cta: string;
  // Wizard config
  objetivoLabel: string;
  opcoesObjetivo: OpcaoCard[];
  documentoLabel: string;
  documentoHint: string;
  resultadoTitulo: string;
  resultadoResumo: string;
  metricas: { label: string; valor: string; tom: "ok" | "warn" | "info" }[];
  pontos: { titulo: string; texto: string }[];
};

const baseUploadHint = "Arraste o PDF ou clique para selecionar — até 20MB";

const modulos: Modulo[] = [
  {
    id: "edital",
    titulo: "Leitura de Edital com IA",
    resumo: "Envie o PDF do edital e receba um resumo claro em segundos.",
    descricao:
      "A IA lê o edital inteiro, destaca os pontos mais importantes e diz se sua empresa pode participar.",
    icon: FileSearch,
    tag: "Mais usado",
    destaque: true,
    cta: "Analisar edital agora",
    objetivoLabel: "O que você quer descobrir nesse edital?",
    opcoesObjetivo: [
      { id: "resumo", titulo: "Resumo executivo", descricao: "Pontos principais em 1 página", icon: FileText },
      { id: "habilitacao", titulo: "Posso participar?", descricao: "Checklist de habilitação", icon: ShieldCheck },
      { id: "riscos", titulo: "Riscos e armadilhas", descricao: "Cláusulas perigosas", icon: Target },
      { id: "completo", titulo: "Análise completa", descricao: "Tudo acima + cronograma", icon: Sparkles },
    ],
    documentoLabel: "Envie o PDF do edital",
    documentoHint: baseUploadHint,
    resultadoTitulo: "Edital analisado com sucesso",
    resultadoResumo:
      "Pregão Eletrônico para fornecimento de equipamentos de TI. Sua empresa atende aos requisitos principais.",
    metricas: [
      { label: "Compatibilidade", valor: "87%", tom: "ok" },
      { label: "Risco geral", valor: "Baixo", tom: "ok" },
      { label: "Margem estimada", valor: "12 a 18%", tom: "info" },
    ],
    pontos: [
      { titulo: "Objeto", texto: "Aquisição de 320 notebooks e 50 servidores com garantia de 36 meses." },
      { titulo: "Habilitação", texto: "SICAF nível VI exigido. Sua empresa já está apta." },
      { titulo: "Atenção", texto: "Item 7.3 exige atestado técnico com volume mínimo de 200 unidades." },
      { titulo: "Prazo de entrega", texto: "30 dias corridos após assinatura — verifique estoque." },
    ],
  },
  {
    id: "situacao",
    titulo: "Análise da Situação do Fornecedor",
    resumo: "Diagnóstico completo da sua empresa em 30 segundos.",
    descricao:
      "Verificamos SICAF, certidões, documentos e capacidade técnica para mostrar exatamente o que falta para você vender mais.",
    icon: ShieldCheck,
    tag: "Recomendado",
    cta: "Fazer análise",
    objetivoLabel: "Qual o foco da análise?",
    opcoesObjetivo: [
      { id: "geral", titulo: "Diagnóstico geral", descricao: "Visão 360° da empresa", icon: ShieldCheck },
      { id: "sicaf", titulo: "Foco no SICAF", descricao: "Níveis e pendências", icon: Award },
      { id: "certidoes", titulo: "Certidões", descricao: "Federal, estadual e municipal", icon: FileText },
      { id: "tecnica", titulo: "Capacidade técnica", descricao: "Atestados e qualificação", icon: Zap },
    ],
    documentoLabel: "Envie o último relatório SICAF (opcional)",
    documentoHint: "PDF do SICAF — pulamos a coleta automática se enviar",
    resultadoTitulo: "Diagnóstico concluído",
    resultadoResumo: "Sua empresa está com 82% de prontidão para participar de licitações federais.",
    metricas: [
      { label: "Prontidão", valor: "82%", tom: "ok" },
      { label: "Pendências", valor: "3", tom: "warn" },
      { label: "Nível SICAF", valor: "V", tom: "info" },
    ],
    pontos: [
      { titulo: "SICAF", texto: "Cadastro ativo no nível V. Falta apenas qualificação técnica para nível VI." },
      { titulo: "Certidões", texto: "Certidão municipal vence em 12 dias — renove o quanto antes." },
      { titulo: "Capacidade", texto: "Atestados cobrem 70% dos CNAEs habilitados. Recomendamos ampliar." },
    ],
  },
  {
    id: "match",
    titulo: "Match de Licitações",
    resumo: "Descubra as licitações com mais chance de você ganhar.",
    descricao:
      "A IA cruza seu histórico, sua região e seu CNAE com milhares de licitações em aberto.",
    icon: TrendingUp,
    tag: "Novo",
    cta: "Ver licitações compatíveis",
    objetivoLabel: "Qual perfil de licitação você quer encontrar?",
    opcoesObjetivo: [
      { id: "altachance", titulo: "Alta chance de vitória", descricao: "Acima de 70% de match", icon: Target },
      { id: "novosmercados", titulo: "Novos mercados", descricao: "CNAEs adjacentes", icon: TrendingUp },
      { id: "grandevalor", titulo: "Grande valor", descricao: "Acima de R$ 500 mil", icon: Award },
      { id: "rapidas", titulo: "Encerramento rápido", descricao: "Prazo até 7 dias", icon: Zap },
    ],
    documentoLabel: "Envie um edital de referência (opcional)",
    documentoHint: "A IA usa o PDF como base para encontrar similares",
    resultadoTitulo: "Encontramos 12 licitações compatíveis",
    resultadoResumo: "Selecionadas por região, CNAE, histórico de vitórias e capacidade técnica da sua empresa.",
    metricas: [
      { label: "Match alto", valor: "5", tom: "ok" },
      { label: "Match médio", valor: "7", tom: "info" },
      { label: "Volume total", valor: "R$ 3,2M", tom: "info" },
    ],
    pontos: [
      { titulo: "Pregão 045/2026 — MEC", texto: "Compatibilidade 92%. Valor estimado R$ 480 mil." },
      { titulo: "Pregão 119/2026 — Prefeitura SP", texto: "Compatibilidade 88%. Valor estimado R$ 320 mil." },
      { titulo: "Pregão 077/2026 — TRF3", texto: "Compatibilidade 85%. Valor estimado R$ 720 mil." },
    ],
  },
  {
    id: "preco",
    titulo: "Sugestão de Preço Vencedor",
    resumo: "Saiba o preço ideal para vencer sem perder margem.",
    descricao:
      "Analisamos vencedores anteriores de licitações semelhantes para sugerir o melhor lance.",
    icon: Calculator,
    tag: "Beta",
    cta: "Calcular preço sugerido",
    objetivoLabel: "Qual sua estratégia?",
    opcoesObjetivo: [
      { id: "agressivo", titulo: "Preço agressivo", descricao: "Maximizar chance de vitória", icon: Zap },
      { id: "equilibrado", titulo: "Equilibrado", descricao: "Bom preço com margem saudável", icon: Target },
      { id: "premium", titulo: "Margem premium", descricao: "Foco em rentabilidade", icon: Award },
      { id: "custom", titulo: "Personalizado", descricao: "Defina sua margem alvo", icon: Settings2 },
    ],
    documentoLabel: "Envie o edital para precificação",
    documentoHint: baseUploadHint,
    resultadoTitulo: "Preço sugerido calculado",
    resultadoResumo:
      "Com base em 47 licitações semelhantes nos últimos 12 meses, esta é a faixa recomendada.",
    metricas: [
      { label: "Lance sugerido", valor: "R$ 248 mil", tom: "ok" },
      { label: "Margem estimada", valor: "14%", tom: "info" },
      { label: "Probabilidade", valor: "76%", tom: "ok" },
    ],
    pontos: [
      { titulo: "Mínimo viável", texto: "R$ 232 mil — empresa ainda preserva ~8% de margem." },
      { titulo: "Lance ideal", texto: "R$ 248 mil — equilíbrio entre chance de vitória e margem." },
      { titulo: "Teto recomendado", texto: "R$ 268 mil — só vence se concorrentes principais não comparecerem." },
    ],
  },
  {
    id: "impugnacao",
    titulo: "Gerador de Impugnação",
    resumo: "Crie uma impugnação profissional em poucos cliques.",
    descricao:
      "Descreva o problema do edital e a IA monta o documento jurídico completo no formato correto.",
    icon: FileSignature,
    tag: "Pro",
    cta: "Gerar impugnação",
    objetivoLabel: "Qual o motivo da impugnação?",
    opcoesObjetivo: [
      { id: "restritivo", titulo: "Edital restritivo", descricao: "Cláusulas que limitam concorrência", icon: ShieldCheck },
      { id: "tecnico", titulo: "Erro técnico", descricao: "Especificação direcionada", icon: Settings2 },
      { id: "prazo", titulo: "Prazo insuficiente", descricao: "Cronograma inviável", icon: Zap },
      { id: "legal", titulo: "Vício legal", descricao: "Descumprimento da lei", icon: FileSignature },
    ],
    documentoLabel: "Envie o edital alvo da impugnação",
    documentoHint: baseUploadHint,
    resultadoTitulo: "Impugnação gerada",
    resultadoResumo: "Documento de 4 páginas pronto para protocolo, com fundamentação legal e jurisprudência.",
    metricas: [
      { label: "Páginas", valor: "4", tom: "info" },
      { label: "Jurisprudência", valor: "8 citações", tom: "info" },
      { label: "Prazo restante", valor: "3 dias", tom: "warn" },
    ],
    pontos: [
      { titulo: "Fundamentação", texto: "Lei 14.133/2021, art. 25 e jurisprudência do TCU (Acórdão 1.631/2023)." },
      { titulo: "Pedido", texto: "Suspensão do certame e retificação dos itens 7.2 e 9.4 do edital." },
      { titulo: "Próximo passo", texto: "Revise o documento e protocole no portal de compras até 18/06." },
    ],
  },
  {
    id: "assistente",
    titulo: "Assistente de Licitações",
    resumo: "Tire qualquer dúvida em linguagem simples.",
    descricao:
      "Pergunte sobre SICAF, prazos, documentos, recursos — a IA responde como se fosse seu consultor pessoal.",
    icon: MessageSquareText,
    tag: "24/7",
    cta: "Conversar agora",
    objetivoLabel: "Sobre o que você quer falar?",
    opcoesObjetivo: [
      { id: "sicaf", titulo: "SICAF e cadastros", descricao: "Níveis, prazos e pendências", icon: ShieldCheck },
      { id: "edital", titulo: "Interpretar edital", descricao: "Cláusulas e exigências", icon: FileText },
      { id: "recurso", titulo: "Recursos e impugnações", descricao: "Prazos e estratégia", icon: FileSignature },
      { id: "geral", titulo: "Dúvida geral", descricao: "Qualquer assunto de licitação", icon: MessageSquareText },
    ],
    documentoLabel: "Anexe um documento de referência (opcional)",
    documentoHint: "PDF, contrato, edital — a IA usa como contexto",
    resultadoTitulo: "Resposta do assistente",
    resultadoResumo:
      "Com base na sua dúvida e nos documentos enviados, a IA preparou esta resposta completa.",
    metricas: [
      { label: "Confiança", valor: "Alta", tom: "ok" },
      { label: "Fontes", valor: "5", tom: "info" },
      { label: "Tempo de leitura", valor: "2 min", tom: "info" },
    ],
    pontos: [
      { titulo: "Resposta direta", texto: "O Nível VI do SICAF exige qualificação técnica comprovada por atestados." },
      { titulo: "Como atingir", texto: "Reúna ao menos 2 atestados de capacidade técnica do seu CNAE principal." },
      { titulo: "Base legal", texto: "Instrução Normativa SEGES/ME nº 03/2018, art. 43 e seguintes." },
    ],
  },
];

function ServicosIAPage() {
  const [active, setActive] = useState<Modulo | null>(null);

  return (
    <PageContainer>
      <PageHeader
        icon={<Sparkles className="h-5 w-5" />}
        title="Serviços com IA"
        subtitle="Use a inteligência da CADBRASIL para vender mais e errar menos."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {modulos.map((m) => (
          <button key={m.id} onClick={() => setActive(m)} className="group text-left">
            <Card
              className={`h-full transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                m.destaque ? "border-primary/40 ring-1 ring-primary/20" : ""
              }`}
            >
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <m.icon className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[11px]">
                    {m.tag}
                  </Badge>
                </div>
                <div>
                  <p className="font-semibold leading-snug">{m.titulo}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{m.resumo}</p>
                </div>
                <div className="mt-auto flex items-center gap-1.5 text-sm font-medium text-primary">
                  Abrir serviço
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <WizardDialog modulo={active} onClose={() => setActive(null)} />
    </PageContainer>
  );
}

/* ============================================================
   WIZARD DIALOG — mesmo shell para todos os serviços
   ============================================================ */

type StepKey = "objetivo" | "documento" | "processando" | "resultado";

const STEPS: { key: StepKey; titulo: string; descricao: string; icon: typeof Sparkles }[] = [
  { key: "objetivo", titulo: "Objetivo", descricao: "Defina o foco da análise", icon: Target },
  { key: "documento", titulo: "Documento", descricao: "Envie o PDF de referência", icon: Upload },
  { key: "processando", titulo: "Processando", descricao: "A IA está trabalhando", icon: Sparkles },
  { key: "resultado", titulo: "Resultado", descricao: "Análise pronta para uso", icon: CheckCircle2 },
];

function WizardDialog({ modulo, onClose }: { modulo: Modulo | null; onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [objetivo, setObjetivo] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [textoLivre, setTextoLivre] = useState("");
  const [iaProgress, setIaProgress] = useState(0);
  const [resultado, setResultado] = useState<ResultadoIA | null>(null);
  const [processando, setProcessando] = useState(false);

  const step = STEPS[stepIndex];
  const exibicao = resultado ?? {
    titulo: modulo?.resultadoTitulo ?? "",
    resumo: modulo?.resultadoResumo ?? "",
    metricas: modulo?.metricas ?? [],
    pontos: modulo?.pontos ?? [],
  };

  // Reset on open
  useEffect(() => {
    if (modulo) {
      setStepIndex(0);
      setObjetivo(null);
      setArquivo(null);
      setUploadProgress(0);
      setTextoLivre("");
      setIaProgress(0);
      setResultado(null);
      setProcessando(false);
    }
  }, [modulo?.id]);

  useEffect(() => {
    if (arquivo) setUploadProgress(100);
    else setUploadProgress(0);
  }, [arquivo]);

  useEffect(() => {
    if (step?.key !== "processando" || !modulo || processando) return;
    let cancelled = false;

    void (async () => {
      setProcessando(true);
      setIaProgress(5);
      const res = await executarModuloIA(modulo.id, {
        objetivo: objetivo || "geral",
        arquivo,
        textoLivre,
        onProgress: (pct) => {
          if (!cancelled) setIaProgress(pct);
        },
      });
      if (cancelled) return;
      setProcessando(false);
      if (!res.ok || !res.resultado) {
        toast.error(res.error || "Não foi possível concluir a análise");
        setStepIndex(2);
        return;
      }
      setResultado(res.resultado);
      setIaProgress(100);
      setTimeout(() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1)), 300);
    })();

    return () => {
      cancelled = true;
    };
  }, [step?.key, modulo?.id]);

  const progresso = useMemo(
    () => Math.round(((stepIndex + (step?.key === "resultado" ? 1 : 0)) / STEPS.length) * 100),
    [stepIndex, step?.key],
  );

  if (!modulo) return null;

  const documentoOk = (() => {
    if (modulo.id === "edital" || modulo.id === "preco" || modulo.id === "impugnacao") {
      return !!arquivo || textoLivre.trim().length > 0;
    }
    if (modulo.id === "assistente") return textoLivre.trim().length > 10;
    return uploadProgress === 100 || textoLivre.trim().length > 0 || modulo.id === "match" || modulo.id === "situacao";
  })();

  const podeAvancar =
    (step.key === "objetivo" && !!objetivo) ||
    (step.key === "documento" && documentoOk);

  const proximo = () => {
    if (step.key === "documento") {
      setResultado(null);
      setProcessando(false);
      setStepIndex((i) => i + 1);
    } else {
      setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
    }
  };

  return (
    <Dialog open={!!modulo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-5xl gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr]">
          {/* ===== Sidebar com steps ===== */}
          <aside className="relative hidden overflow-hidden border-r border-border bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6 md:block">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "radial-gradient(600px 200px at 0% 0%, hsl(var(--primary)/0.25), transparent), radial-gradient(400px 200px at 100% 100%, hsl(var(--primary)/0.15), transparent)",
              }}
            />
            <div className="relative">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                  <modulo.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Serviço IA
                  </p>
                  <p className="text-sm font-semibold leading-tight">{modulo.titulo}</p>
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Progresso</span>
                  <span>{progresso}%</span>
                </div>
                <Progress value={progresso} className="h-1.5" />
              </div>

              <ol className="mt-6 space-y-1">
                {STEPS.map((s, idx) => {
                  const done = idx < stepIndex || step.key === "resultado";
                  const current = idx === stepIndex && step.key !== "resultado";
                  return (
                    <li
                      key={s.key}
                      className={cn(
                        "flex items-start gap-3 rounded-lg p-2.5 transition-colors",
                        current && "bg-background shadow-sm ring-1 ring-border",
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                          done
                            ? "border-primary bg-primary text-primary-foreground"
                            : current
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground",
                        )}
                      >
                        {done ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium leading-tight",
                            !current && !done && "text-muted-foreground",
                          )}
                        >
                          {s.titulo}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{s.descricao}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
                Tudo o que você enviar fica criptografado e é usado apenas para gerar sua análise.
              </p>
            </div>
          </aside>

          {/* ===== Conteúdo ===== */}
          <section className="flex max-h-[88vh] min-h-[560px] flex-col">
            <header className="flex items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                    Etapa {Math.min(stepIndex + 1, STEPS.length)} de {STEPS.length}
                  </Badge>
                  <span className="hidden text-xs text-muted-foreground sm:inline">·</span>
                  <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                    {modulo.titulo}
                  </span>
                </div>
                <h2 className="mt-2 text-xl font-semibold leading-tight sm:text-2xl">
                  {step.key === "objetivo" && modulo.objetivoLabel}
                  {step.key === "documento" && modulo.documentoLabel}
                  {step.key === "processando" && "Nossa IA está analisando..."}
                  {step.key === "resultado" && exibicao.titulo}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {step.key === "objetivo" && "Escolha uma opção para personalizar o resultado."}
                  {step.key === "documento" && modulo.documentoHint}
                  {step.key === "processando" && "Em geral leva menos de 30 segundos."}
                  {step.key === "resultado" && exibicao.resumo}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6">
              {step.key === "objetivo" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {modulo.opcoesObjetivo.map((op) => {
                    const sel = objetivo === op.id;
                    return (
                      <button
                        key={op.id}
                        onClick={() => setObjetivo(op.id)}
                        className={cn(
                          "group relative flex h-full flex-col items-start gap-3 rounded-xl border p-5 text-left transition-all",
                          sel
                            ? "border-primary bg-primary/5 shadow-md shadow-primary/10 ring-1 ring-primary"
                            : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-11 w-11 items-center justify-center rounded-xl transition-colors",
                            sel ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
                          )}
                        >
                          <op.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold leading-tight">{op.titulo}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{op.descricao}</p>
                        </div>
                        {sel && (
                          <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {step.key === "documento" && (
                <div className="space-y-5">
                  <label
                    className={cn(
                      "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-muted/30 p-10 text-center transition-colors",
                      arquivo ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/50",
                    )}
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      {arquivo ? <FileText className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
                    </div>
                    {!arquivo ? (
                      <>
                        <p className="text-sm font-semibold">Clique para enviar o PDF</p>
                        <p className="text-xs text-muted-foreground">{modulo.documentoHint}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold">{arquivo.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(arquivo.size / 1024 / 1024).toFixed(2)} MB · enviando para análise
                        </p>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setArquivo(f);
                      }}
                    />
                  </label>

                  {arquivo && (
                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="font-medium">
                          {uploadProgress < 100 ? "Enviando..." : "Upload concluído"}
                        </span>
                        <span className="text-muted-foreground">{Math.round(uploadProgress)}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-1.5" />
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Ou descreva em texto
                    </p>
                    <Textarea
                      value={textoLivre}
                      onChange={(e) => setTextoLivre(e.target.value)}
                      placeholder="Cole aqui o trecho ou descreva o que quer analisar..."
                      className="min-h-[110px]"
                    />
                  </div>
                </div>
              )}

              {step.key === "processando" && (
                <div className="flex h-full flex-col items-center justify-center gap-5 py-10 text-center">
                  <div className="relative flex h-20 w-20 items-center justify-center">
                    <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                      <Sparkles className="h-8 w-8" />
                    </div>
                  </div>
                  <div>
                    <p className="text-base font-semibold">A IA está analisando seu pedido</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Lendo conteúdo, cruzando dados e gerando conclusões.
                    </p>
                  </div>
                  <div className="w-full max-w-sm">
                    <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                      <span>Processando</span>
                      <span>{Math.round(iaProgress)}%</span>
                    </div>
                    <Progress value={iaProgress} className="h-1.5" />
                  </div>
                  <ul className="grid w-full max-w-sm gap-1.5 text-left text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      {iaProgress > 20 ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      )}
                      Interpretando documento
                    </li>
                    <li className="flex items-center gap-2">
                      {iaProgress > 55 ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      )}
                      Cruzando com base CADBRASIL
                    </li>
                    <li className="flex items-center gap-2">
                      {iaProgress > 85 ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      )}
                      Gerando relatório final
                    </li>
                  </ul>
                </div>
              )}

              {step.key === "resultado" && (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {exibicao.metricas.map((m) => (
                      <div
                        key={m.label}
                        className={cn(
                          "rounded-xl border p-4",
                          m.tom === "ok" && "border-emerald-500/30 bg-emerald-500/5",
                          m.tom === "warn" && "border-amber-500/30 bg-amber-500/5",
                          m.tom === "info" && "border-border bg-muted/30",
                        )}
                      >
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          {m.label}
                        </p>
                        <p className="mt-1 text-xl font-semibold">{m.valor}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Pontos da análise
                    </p>
                    {exibicao.pontos.map((p, i) => (
                      <div
                        key={i}
                        className="flex gap-3 rounded-xl border border-border bg-card p-4"
                      >
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{p.titulo}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground">{p.texto}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold">Resultado pronto para uso</p>
                      <p className="text-xs text-muted-foreground">
                        Baixe em PDF ou compartilhe direto com seu time.
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Download className="h-4 w-4" />
                      Baixar relatório
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-border bg-muted/20 p-4 sm:p-5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                disabled={stepIndex === 0 || step.key === "processando"}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>

              {step.key !== "resultado" && step.key !== "processando" && (
                <Button onClick={proximo} disabled={!podeAvancar} className="gap-1.5">
                  {step.key === "documento" ? (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {modulo.cta}
                    </>
                  ) : (
                    <>
                      Continuar
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              )}

              {step.key === "processando" && (
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Aguarde a IA concluir
                </span>
              )}

              {step.key === "resultado" && (
                <Button onClick={onClose} className="gap-1.5">
                  Concluir
                  <Check className="h-4 w-4" />
                </Button>
              )}
            </footer>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
