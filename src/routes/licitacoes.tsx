import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Gavel,
  Search,
  MapPin,
  Calendar,
  Building2,
  Sparkles,
  Filter,
  Star,
  TrendingUp,
  X,
  CheckCircle2,
  FileText,
  Users,
  Target,
  Bot,
  Rocket,
  ChevronRight,
  Clock,
  DollarSign,
  ShieldCheck,
  Download,
  ExternalLink,
  AlertTriangle,
  Trophy,
  Briefcase,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/licitacoes")({
  head: () => ({
    meta: [
      { title: "Licitações — CADBRASIL" },
      {
        name: "description",
        content: "Encontre licitações compatíveis com sua empresa, com filtros simples.",
      },
    ],
  }),
  component: LicitacoesPage,
});

type Licitacao = {
  id: string;
  orgao: string;
  objeto: string;
  uf: string;
  modalidade: string;
  valor: string;
  valorNum: number;
  abertura: string;
  prazo: string;
  diasRestantes: number;
  match: number;
  destaque?: boolean;
  segmento: string;
  descricao: string;
};

const licitacoes: Licitacao[] = [
  {
    id: "PE-2025-001",
    orgao: "Prefeitura de Belo Horizonte / MG",
    objeto: "Fornecimento de materiais de escritório para secretarias municipais",
    uf: "MG",
    modalidade: "Pregão Eletrônico",
    valor: "R$ 280.000",
    valorNum: 280000,
    abertura: "12/06/2026",
    prazo: "Encerra em 6 dias",
    diasRestantes: 6,
    match: 96,
    destaque: true,
    segmento: "Material de Escritório",
    descricao:
      "Aquisição de materiais de escritório (papel, canetas, toner, organizadores) para abastecimento das secretarias municipais durante o ano de 2026. Entrega parcelada conforme cronograma.",
  },
  {
    id: "PE-2025-002",
    orgao: "Governo do Estado de São Paulo",
    objeto: "Aquisição de equipamentos de informática (notebooks e monitores)",
    uf: "SP",
    modalidade: "Pregão Eletrônico",
    valor: "R$ 1.450.000",
    valorNum: 1450000,
    abertura: "15/06/2026",
    prazo: "Encerra em 9 dias",
    diasRestantes: 9,
    match: 88,
    segmento: "Tecnologia",
    descricao:
      "Aquisição de 1.200 notebooks e 800 monitores para modernização do parque tecnológico das escolas estaduais. Inclui garantia de 36 meses e suporte on-site.",
  },
  {
    id: "DI-2025-014",
    orgao: "Tribunal Regional Federal 1ª Região",
    objeto: "Serviço de manutenção predial preventiva e corretiva",
    uf: "DF",
    modalidade: "Dispensa Eletrônica",
    valor: "R$ 95.000",
    valorNum: 95000,
    abertura: "10/06/2026",
    prazo: "Encerra em 4 dias",
    diasRestantes: 4,
    match: 72,
    segmento: "Serviços Prediais",
    descricao:
      "Contratação de empresa especializada para serviços de manutenção predial preventiva e corretiva nas instalações do TRF 1ª Região por 12 meses.",
  },
  {
    id: "PE-2025-003",
    orgao: "Universidade Federal do Rio de Janeiro",
    objeto: "Material de laboratório e reagentes químicos",
    uf: "RJ",
    modalidade: "Pregão Eletrônico",
    valor: "R$ 540.000",
    valorNum: 540000,
    abertura: "18/06/2026",
    prazo: "Encerra em 12 dias",
    diasRestantes: 12,
    match: 64,
    segmento: "Laboratório",
    descricao:
      "Fornecimento de materiais de laboratório e reagentes químicos para pesquisa acadêmica nos institutos de química, biologia e farmácia da UFRJ.",
  },
  {
    id: "CC-2025-007",
    orgao: "Ministério da Saúde",
    objeto: "Concorrência para construção de UBS no interior do Nordeste",
    uf: "BA",
    modalidade: "Concorrência",
    valor: "R$ 8.200.000",
    valorNum: 8200000,
    abertura: "30/06/2026",
    prazo: "Encerra em 24 dias",
    diasRestantes: 24,
    match: 58,
    segmento: "Construção Civil",
    descricao:
      "Construção de 12 Unidades Básicas de Saúde em municípios do interior da Bahia, conforme projeto padrão do Ministério da Saúde. Prazo de execução: 18 meses.",
  },
  {
    id: "PE-2025-004",
    orgao: "Prefeitura de Curitiba / PR",
    objeto: "Serviços de limpeza e conservação predial",
    uf: "PR",
    modalidade: "Pregão Eletrônico",
    valor: "R$ 420.000",
    valorNum: 420000,
    abertura: "20/06/2026",
    prazo: "Encerra em 14 dias",
    diasRestantes: 14,
    match: 81,
    segmento: "Serviços Prediais",
    descricao:
      "Prestação de serviços continuados de limpeza, conservação e higienização nos prédios administrativos da Prefeitura de Curitiba pelo período de 12 meses.",
  },
];

const ufs = ["SP", "MG", "RJ", "DF", "BA", "PR"];
const modalidades = ["Pregão Eletrônico", "Dispensa Eletrônica", "Concorrência"];
const faixasValor = [
  { id: "ate100", label: "Até R$ 100k", min: 0, max: 100000 },
  { id: "100a500", label: "R$ 100k – 500k", min: 100000, max: 500000 },
  { id: "500a2m", label: "R$ 500k – 2M", min: 500000, max: 2000000 },
  { id: "acima2m", label: "Acima de R$ 2M", min: 2000000, max: Infinity },
];
const matchOpts = [
  { id: "todos", label: "Todos", min: 0 },
  { id: "70", label: "70%+ (compatível)", min: 70 },
  { id: "85", label: "85%+ (alto match)", min: 85 },
  { id: "95", label: "95%+ (excelente)", min: 95 },
];
const prazos = [
  { id: "todos", label: "Todos prazos", max: 999 },
  { id: "7", label: "Encerram em 7 dias", max: 7 },
  { id: "15", label: "Encerram em 15 dias", max: 15 },
  { id: "30", label: "Encerram em 30 dias", max: 30 },
];

function matchTone(v: number) {
  if (v >= 85) return "bg-success/10 text-success border-success/20";
  if (v >= 70) return "bg-primary/10 text-primary border-primary/20";
  return "bg-muted text-muted-foreground border-border";
}

interface Filtros {
  ufs: string[];
  modalidades: string[];
  faixa: string;
  match: string;
  prazo: string;
}

const filtrosDefault: Filtros = {
  ufs: [],
  modalidades: [],
  faixa: "",
  match: "todos",
  prazo: "todos",
};

function LicitacoesPage() {
  const [q, setQ] = useState("");
  const [filtros, setFiltros] = useState<Filtros>(filtrosDefault);
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [detalhe, setDetalhe] = useState<Licitacao | null>(null);

  const filtradas = useMemo(() => {
    return licitacoes.filter((l) => {
      const matchQ =
        q.trim() === "" ||
        l.objeto.toLowerCase().includes(q.toLowerCase()) ||
        l.orgao.toLowerCase().includes(q.toLowerCase());
      const matchUf = filtros.ufs.length === 0 || filtros.ufs.includes(l.uf);
      const matchMod =
        filtros.modalidades.length === 0 || filtros.modalidades.includes(l.modalidade);
      const faixa = faixasValor.find((f) => f.id === filtros.faixa);
      const matchFaixa = !faixa || (l.valorNum >= faixa.min && l.valorNum <= faixa.max);
      const matchOpt = matchOpts.find((m) => m.id === filtros.match);
      const matchM = !matchOpt || l.match >= matchOpt.min;
      const prazo = prazos.find((p) => p.id === filtros.prazo);
      const matchPrazo = !prazo || l.diasRestantes <= prazo.max;
      return matchQ && matchUf && matchMod && matchFaixa && matchM && matchPrazo;
    });
  }, [q, filtros]);

  const filtrosAtivos =
    filtros.ufs.length +
    filtros.modalidades.length +
    (filtros.faixa ? 1 : 0) +
    (filtros.match !== "todos" ? 1 : 0) +
    (filtros.prazo !== "todos" ? 1 : 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<Gavel className="h-5 w-5" />}
        title="Licitações"
        subtitle="Oportunidades compatíveis com a sua empresa, atualizadas todos os dias."
      />

      {/* Resumo */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> Compatíveis hoje
            </div>
            <p className="mt-1 text-2xl font-bold">
              {licitacoes.filter((l) => l.match >= 70).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Star className="h-3.5 w-3.5" /> Match alto (85%+)
            </div>
            <p className="mt-1 text-2xl font-bold">
              {licitacoes.filter((l) => l.match >= 85).length}
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" /> Encerram esta semana
            </div>
            <p className="mt-1 text-2xl font-bold">
              {licitacoes.filter((l) => l.diasRestantes <= 7).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Busca + Filtros */}
      <Card className="mt-6">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="O que você quer vender? Ex.: material de escritório"
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setFiltroAberto(true)}
            className="relative"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtros
            {filtrosAtivos > 0 && (
              <Badge className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                {filtrosAtivos}
              </Badge>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Chips de filtros ativos */}
      {filtrosAtivos > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {filtros.ufs.map((u) => (
            <ChipAtivo key={u} label={u} onRemove={() =>
              setFiltros({ ...filtros, ufs: filtros.ufs.filter((x) => x !== u) })
            } />
          ))}
          {filtros.modalidades.map((m) => (
            <ChipAtivo key={m} label={m} onRemove={() =>
              setFiltros({ ...filtros, modalidades: filtros.modalidades.filter((x) => x !== m) })
            } />
          ))}
          {filtros.faixa && (
            <ChipAtivo
              label={faixasValor.find((f) => f.id === filtros.faixa)?.label || ""}
              onRemove={() => setFiltros({ ...filtros, faixa: "" })}
            />
          )}
          {filtros.match !== "todos" && (
            <ChipAtivo
              label={matchOpts.find((m) => m.id === filtros.match)?.label || ""}
              onRemove={() => setFiltros({ ...filtros, match: "todos" })}
            />
          )}
          {filtros.prazo !== "todos" && (
            <ChipAtivo
              label={prazos.find((p) => p.id === filtros.prazo)?.label || ""}
              onRemove={() => setFiltros({ ...filtros, prazo: "todos" })}
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFiltros(filtrosDefault)}
          >
            Limpar todos
          </Button>
        </div>
      )}

      {/* Lista */}
      <div className="mt-4 grid gap-3">
        {filtradas.map((l) => (
          <Card
            key={l.id}
            className={l.destaque ? "border-primary/40 ring-1 ring-primary/20" : ""}
          >
            <CardContent className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[11px]">
                      {l.modalidade}
                    </Badge>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${matchTone(l.match)}`}
                    >
                      <Sparkles className="h-3 w-3" /> {l.match}% match
                    </span>
                    {l.destaque && (
                      <span className="text-[11px] font-medium text-primary">
                        ⭐ Recomendado para você
                      </span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 font-semibold leading-snug">{l.objeto}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" /> {l.orgao}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {l.uf}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> Abertura {l.abertura}
                    </span>
                  </div>
                </div>
                <div className="flex flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">Valor estimado</p>
                    <p className="text-base font-bold">{l.valor}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-warning-foreground">
                      {l.prazo}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setDetalhe(l)}>
                    Ver detalhes
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filtradas.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma licitação encontrada com esses filtros. Tente outra palavra-chave.
            </CardContent>
          </Card>
        )}
      </div>

      <FiltrosDialog
        open={filtroAberto}
        onOpenChange={setFiltroAberto}
        filtros={filtros}
        setFiltros={setFiltros}
        total={filtradas.length}
      />

      <DetalheDialog
        licitacao={detalhe}
        onClose={() => setDetalhe(null)}
      />
    </div>
  );
}

function ChipAtivo({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
      {label}
      <button onClick={onRemove} className="hover:text-primary/70">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

/* ---------------- FILTROS MODAL ---------------- */
function FiltrosDialog({
  open,
  onOpenChange,
  filtros,
  setFiltros,
  total,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filtros: Filtros;
  setFiltros: (f: Filtros) => void;
  total: number;
}) {
  const toggleUf = (uf: string) =>
    setFiltros({
      ...filtros,
      ufs: filtros.ufs.includes(uf)
        ? filtros.ufs.filter((u) => u !== uf)
        : [...filtros.ufs, uf],
    });

  const toggleMod = (m: string) =>
    setFiltros({
      ...filtros,
      modalidades: filtros.modalidades.includes(m)
        ? filtros.modalidades.filter((x) => x !== m)
        : [...filtros.modalidades, m],
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden p-0">
        <div className="border-b bg-gradient-to-br from-primary/5 to-transparent p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Filter className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Filtrar licitações</h2>
              <p className="text-sm text-muted-foreground">
                Selecione abaixo. A lista atualiza em tempo real.
              </p>
            </div>
          </div>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 p-6">
            <FiltroBloco icon={<MapPin className="h-4 w-4" />} titulo="Estado (UF)">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {ufs.map((u) => {
                  const ativo = filtros.ufs.includes(u);
                  return (
                    <ChipCard
                      key={u}
                      ativo={ativo}
                      onClick={() => toggleUf(u)}
                      label={u}
                    />
                  );
                })}
              </div>
            </FiltroBloco>

            <FiltroBloco icon={<Briefcase className="h-4 w-4" />} titulo="Modalidade">
              <div className="grid gap-2 sm:grid-cols-2">
                {modalidades.map((m) => {
                  const ativo = filtros.modalidades.includes(m);
                  return (
                    <ChipCard
                      key={m}
                      ativo={ativo}
                      onClick={() => toggleMod(m)}
                      label={m}
                    />
                  );
                })}
              </div>
            </FiltroBloco>

            <FiltroBloco icon={<DollarSign className="h-4 w-4" />} titulo="Faixa de valor">
              <div className="grid gap-2 sm:grid-cols-2">
                {faixasValor.map((f) => (
                  <ChipCard
                    key={f.id}
                    ativo={filtros.faixa === f.id}
                    onClick={() =>
                      setFiltros({ ...filtros, faixa: filtros.faixa === f.id ? "" : f.id })
                    }
                    label={f.label}
                  />
                ))}
              </div>
            </FiltroBloco>

            <FiltroBloco icon={<Sparkles className="h-4 w-4" />} titulo="Compatibilidade (match)">
              <div className="grid gap-2 sm:grid-cols-2">
                {matchOpts.map((m) => (
                  <ChipCard
                    key={m.id}
                    ativo={filtros.match === m.id}
                    onClick={() => setFiltros({ ...filtros, match: m.id })}
                    label={m.label}
                  />
                ))}
              </div>
            </FiltroBloco>

            <FiltroBloco icon={<Clock className="h-4 w-4" />} titulo="Prazo de encerramento">
              <div className="grid gap-2 sm:grid-cols-2">
                {prazos.map((p) => (
                  <ChipCard
                    key={p.id}
                    ativo={filtros.prazo === p.id}
                    onClick={() => setFiltros({ ...filtros, prazo: p.id })}
                    label={p.label}
                  />
                ))}
              </div>
            </FiltroBloco>
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 p-4">
          <Button variant="ghost" onClick={() => setFiltros(filtrosDefault)}>
            Limpar filtros
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            Ver {total} {total === 1 ? "licitação" : "licitações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FiltroBloco({
  icon,
  titulo,
  children,
}: {
  icon: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-primary">{icon}</span>
        {titulo}
      </div>
      {children}
    </div>
  );
}

function ChipCard({
  ativo,
  onClick,
  label,
}: {
  ativo: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
        ativo
          ? "border-primary bg-primary/5 text-primary shadow-sm"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
      }`}
    >
      <span className="font-medium">{label}</span>
      {ativo && <CheckCircle2 className="h-4 w-4 text-primary" />}
    </button>
  );
}

/* ---------------- DETALHE WIZARD ---------------- */
type Step = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

const steps: Step[] = [
  { id: "resumo", label: "Resumo", icon: <FileText className="h-4 w-4" /> },
  { id: "match", label: "Análise de Match", icon: <Target className="h-4 w-4" /> },
  { id: "documentos", label: "Documentos", icon: <ShieldCheck className="h-4 w-4" /> },
  { id: "concorrentes", label: "Concorrentes", icon: <Users className="h-4 w-4" /> },
  { id: "ia", label: "Análise IA", icon: <Bot className="h-4 w-4" /> },
  { id: "participar", label: "Participar", icon: <Rocket className="h-4 w-4" /> },
];

function DetalheDialog({
  licitacao,
  onClose,
}: {
  licitacao: Licitacao | null;
  onClose: () => void;
}) {
  const [step, setStep] = useState("resumo");

  if (!licitacao) return null;

  return (
    <Dialog open={!!licitacao} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="h-[92vh] max-h-[92vh] w-[96vw] max-w-6xl overflow-hidden p-0 sm:rounded-2xl">
        <div className="flex h-full flex-col md:flex-row">
          {/* SIDEBAR ESQUERDA - WIZARD */}
          <aside className="relative w-full overflow-hidden border-b md:w-72 md:shrink-0 md:border-b-0 md:border-r">
            {/* hero bg */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-[oklch(0.32_0.12_260)]" />
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)",
                backgroundSize: "32px 32px, 48px 48px",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

            <div className="relative flex h-full flex-col p-6 text-primary-foreground">
              <Badge
                variant="outline"
                className="w-fit border-white/30 bg-white/10 text-[10px] text-white backdrop-blur"
              >
                {licitacao.modalidade}
              </Badge>
              <h2 className="mt-3 text-lg font-bold leading-tight">
                {licitacao.objeto}
              </h2>
              <p className="mt-2 text-xs text-white/80">{licitacao.orgao}</p>

              <div className="mt-4 rounded-xl bg-white/10 p-3 backdrop-blur">
                <p className="text-[10px] uppercase tracking-wide text-white/70">
                  Compatibilidade
                </p>
                <p className="mt-0.5 text-2xl font-bold">{licitacao.match}%</p>
                <Progress
                  value={licitacao.match}
                  className="mt-2 h-1.5 bg-white/20 [&>div]:bg-white"
                />
              </div>

              <Separator className="my-4 bg-white/15" />

              <nav className="space-y-1">
                {steps.map((s, i) => {
                  const ativo = step === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setStep(s.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                        ativo
                          ? "bg-white text-primary shadow-md"
                          : "text-white/80 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                          ativo ? "bg-primary text-white" : "bg-white/15"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1 font-medium">{s.label}</span>
                      {ativo && <ChevronRight className="h-4 w-4" />}
                    </button>
                  );
                })}
              </nav>

              <div className="mt-auto pt-4">
                <div className="rounded-xl border border-white/20 bg-white/5 p-3 text-xs backdrop-blur">
                  <p className="flex items-center gap-1.5 text-white/80">
                    <Clock className="h-3.5 w-3.5" />
                    {licitacao.prazo}
                  </p>
                  <p className="mt-1 font-semibold">Abertura: {licitacao.abertura}</p>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur transition hover:bg-black/50 md:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </aside>

          {/* CONTEÚDO */}
          <div className="relative flex flex-1 flex-col overflow-hidden">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 hidden h-8 w-8 items-center justify-center rounded-full border bg-card text-muted-foreground transition hover:bg-muted md:flex"
            >
              <X className="h-4 w-4" />
            </button>

            <ScrollArea className="flex-1">
              <div className="p-6 sm:p-8">
                {step === "resumo" && <StepResumo l={licitacao} />}
                {step === "match" && <StepMatch l={licitacao} />}
                {step === "documentos" && <StepDocumentos />}
                {step === "concorrentes" && <StepConcorrentes />}
                {step === "ia" && <StepIA l={licitacao} />}
                {step === "participar" && <StepParticipar l={licitacao} />}
              </div>
            </ScrollArea>

            {/* Footer navegação */}
            <div className="flex items-center justify-between gap-3 border-t bg-muted/30 p-4">
              <Button
                variant="ghost"
                onClick={() => {
                  const idx = steps.findIndex((s) => s.id === step);
                  if (idx > 0) setStep(steps[idx - 1].id);
                }}
                disabled={step === steps[0].id}
              >
                Voltar
              </Button>
              {step === steps[steps.length - 1].id ? (
                <Button>
                  <Rocket className="mr-2 h-4 w-4" />
                  Confirmar participação
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    const idx = steps.findIndex((s) => s.id === step);
                    if (idx < steps.length - 1) setStep(steps[idx + 1].id);
                  }}
                >
                  Próximo passo
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- STEPS ---------- */
function StepResumo({ l }: { l: Licitacao }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold">Resumo da licitação</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão geral do edital e principais informações.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <InfoBox icon={<DollarSign className="h-4 w-4" />} label="Valor estimado" value={l.valor} />
        <InfoBox icon={<MapPin className="h-4 w-4" />} label="Local" value={l.uf} />
        <InfoBox icon={<Calendar className="h-4 w-4" />} label="Abertura" value={l.abertura} />
      </div>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h4 className="text-sm font-semibold">Objeto</h4>
          <p className="text-sm leading-relaxed text-muted-foreground">{l.descricao}</p>
          <Separator />
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <Linha label="Órgão" value={l.orgao} />
            <Linha label="Modalidade" value={l.modalidade} />
            <Linha label="Segmento" value={l.segmento} />
            <Linha label="Número" value={l.id} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
          <div>
            <p className="font-semibold">Atenção ao prazo</p>
            <p className="mt-0.5 text-muted-foreground">
              Esta licitação {l.prazo.toLowerCase()}. Recomendamos preparar a proposta com 48h de antecedência.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" /> Baixar edital
        </Button>
        <Button variant="outline" size="sm">
          <ExternalLink className="mr-2 h-4 w-4" /> Ver no Compras.gov.br
        </Button>
      </div>
    </div>
  );
}

function StepMatch({ l }: { l: Licitacao }) {
  const criterios = [
    { label: "CNAE compatível", score: 100, ok: true },
    { label: "Segmento de atuação", score: 95, ok: true },
    { label: "Porte da empresa", score: 90, ok: true },
    { label: "Localização geográfica", score: 85, ok: true },
    { label: "Histórico em licitações similares", score: l.match - 10, ok: l.match > 75 },
    { label: "Documentação atualizada", score: 100, ok: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold">Análise de compatibilidade</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Por que esta licitação é uma boa oportunidade para sua empresa.
        </p>
      </div>

      <Card className="bg-gradient-to-br from-primary/10 to-transparent">
        <CardContent className="flex items-center gap-5 p-6">
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
            <svg className="h-24 w-24 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted" />
              <circle
                cx="18" cy="18" r="16" fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={`${l.match} 100`}
                pathLength="100"
                strokeLinecap="round"
                className="text-primary"
              />
            </svg>
            <span className="absolute text-2xl font-bold text-primary">{l.match}%</span>
          </div>
          <div>
            <p className="text-sm font-semibold">Match {l.match >= 85 ? "excelente" : "bom"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sua empresa atende a {Math.round((l.match / 100) * 6)} de 6 critérios principais para esta licitação.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h4 className="text-sm font-semibold">Critérios avaliados</h4>
          <div className="space-y-3">
            {criterios.map((c) => (
              <div key={c.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    {c.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-warning" />
                    )}
                    {c.label}
                  </span>
                  <span className="font-medium">{c.score}%</span>
                </div>
                <Progress value={c.score} className="h-1.5" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StepDocumentos() {
  const docs = [
    { nome: "SICAF Nível IV", status: "ok" },
    { nome: "Certidão Federal", status: "ok" },
    { nome: "Certidão Estadual", status: "warn" },
    { nome: "Certidão Municipal", status: "ok" },
    { nome: "FGTS", status: "ok" },
    { nome: "Trabalhista (CNDT)", status: "danger" },
    { nome: "Contrato Social atualizado", status: "ok" },
    { nome: "Atestado de Capacidade Técnica", status: "warn" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold">Documentação exigida</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Verificamos automaticamente quais documentos você já tem prontos.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {docs.map((d) => (
          <Card
            key={d.nome}
            className={
              d.status === "danger"
                ? "border-danger/30 bg-danger/5"
                : d.status === "warn"
                ? "border-warning/30 bg-warning/5"
                : "border-success/30 bg-success/5"
            }
          >
            <CardContent className="flex items-center justify-between p-3 text-sm">
              <span className="font-medium">{d.nome}</span>
              {d.status === "ok" && <CheckCircle2 className="h-5 w-5 text-success" />}
              {d.status === "warn" && <Clock className="h-5 w-5 text-warning" />}
              {d.status === "danger" && <AlertTriangle className="h-5 w-5 text-danger" />}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-warning/30">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="font-semibold">2 documentos precisam de atenção</p>
            <p className="text-muted-foreground">
              Resolva pendências antes da data de abertura.
            </p>
          </div>
          <Button size="sm">Regularizar agora</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function StepConcorrentes() {
  const concorrentes = [
    { nome: "Alfa Suprimentos Ltda", cidade: "Belo Horizonte / MG", vitorias: 12, score: 87 },
    { nome: "Beta Distribuidora", cidade: "Contagem / MG", vitorias: 8, score: 74 },
    { nome: "Gamma Comércio S/A", cidade: "São Paulo / SP", vitorias: 18, score: 91 },
    { nome: "Delta Fornecimentos", cidade: "Belo Horizonte / MG", vitorias: 5, score: 62 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold">Concorrentes prováveis</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Empresas que historicamente participam de licitações similares.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="bg-primary/5">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Concorrentes estimados</p>
            <p className="mt-1 text-2xl font-bold">~{concorrentes.length + 8}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Nível de disputa</p>
            <p className="mt-1 text-2xl font-bold text-warning-foreground">Médio</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Sua posição estimada</p>
            <p className="mt-1 text-2xl font-bold text-success">Top 3</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y">
            {concorrentes.map((c, i) => (
              <li key={c.nome} className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-sm">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.cidade} · {c.vitorias} vitórias
                  </p>
                </div>
                <div className="text-right">
                  <Badge
                    variant="outline"
                    className={
                      c.score >= 85
                        ? "border-danger/30 bg-danger/10 text-danger"
                        : c.score >= 70
                        ? "border-warning/30 bg-warning/10 text-warning-foreground"
                        : "border-success/30 bg-success/10 text-success"
                    }
                  >
                    Força {c.score}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function StepIA({ l }: { l: Licitacao }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="flex items-center gap-2 text-xl font-bold">
          <Bot className="h-5 w-5 text-primary" />
          Análise gerada por IA
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Insights automatizados sobre esta oportunidade.
        </p>
      </div>

      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="space-y-4 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Resumo executivo
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              Esta licitação tem alta compatibilidade ({l.match}%) com o perfil da sua empresa.
              O órgão {l.orgao.split(" / ")[0]} costuma honrar pagamentos em até 30 dias e tem
              histórico positivo com fornecedores do seu porte.
            </p>
          </div>

          <Separator />

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Preço sugerido
            </p>
            <p className="mt-2 text-sm">
              Com base em editais similares, sugerimos lance entre{" "}
              <strong>{l.valor}</strong> e <strong>R$ {(l.valorNum * 0.92).toLocaleString("pt-BR")}</strong>{" "}
              para maximizar chances de vitória mantendo margem saudável.
            </p>
          </div>

          <Separator />

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Riscos identificados
            </p>
            <ul className="mt-2 space-y-1.5 text-sm">
              <li className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                Edital exige atestado de capacidade técnica recente (últimos 24 meses).
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                Prazo curto para impugnação — restam menos de 48h.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                Não há cláusulas restritivas relevantes detectadas.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full">
        <Sparkles className="mr-2 h-4 w-4 text-primary" />
        Gerar proposta com IA
      </Button>
    </div>
  );
}

function StepParticipar({ l }: { l: Licitacao }) {
  const checklist = [
    { item: "Documentação completa", ok: false },
    { item: "Proposta comercial preparada", ok: false },
    { item: "Análise de viabilidade concluída", ok: true },
    { item: "Cadastro no Compras.gov.br ativo", ok: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="flex items-center gap-2 text-xl font-bold">
          <Rocket className="h-5 w-5 text-primary" />
          Pronto para participar?
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Confira o checklist final antes de enviar sua proposta.
        </p>
      </div>

      <Card className="border-success/30 bg-gradient-to-br from-success/10 via-card to-card">
        <CardContent className="flex items-center gap-4 p-5">
          <Trophy className="h-10 w-10 text-success" />
          <div>
            <p className="font-bold">Você tem boas chances de vencer</p>
            <p className="text-sm text-muted-foreground">
              Match {l.match}% · Top 3 estimado entre os concorrentes.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h4 className="text-sm font-semibold">Checklist final</h4>
          <ul className="space-y-2.5">
            {checklist.map((c) => (
              <li key={c.item} className="flex items-center gap-2 text-sm">
                {c.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                )}
                <span className={c.ok ? "" : "text-muted-foreground"}>{c.item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Nosso time pode te acompanhar</p>
            <p className="text-sm text-muted-foreground">
              Consultor especialista revisa sua proposta antes do envio.
            </p>
          </div>
          <Button variant="outline">Falar com consultor</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoBox({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="text-primary">{icon}</span>
          {label}
        </p>
        <p className="mt-1 font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Linha({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
