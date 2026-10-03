import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  Building,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  Globe,
  GraduationCap,
  Info,
  Landmark,
  Loader2,
  MessageCircle,
  Radar,
  RefreshCw,
  ScanText,
  Search,
  ShieldCheck,
  Telescope,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PageHeader } from "@/components/page-header";
import { SelecionarEmpresaModal } from "@/components/selecionar-empresa-modal";
import { ModuloGate } from "@/components/modulos/modulo-assinatura";
import { fetchEmpresas } from "@/lib/empresas-api";
import { resolveEmpresaPorCnpj } from "@/lib/documentos-api";
import { useMarcarServicoVisto } from "@/lib/servicos-novidades-api";
import type { EmpresaData } from "@/lib/empresas-shared";
import { lerEditalComIa, type AnaliseEdital } from "@/lib/licitacoes-e-api";
import { buildWhatsAppSuporteUrl } from "@/lib/whatsapp-suporte";
import {
  fetchLicitacoesFilters,
  fetchLicitacoesList,
  mapApiToDisplay,
  resolveLicitacaoPncpUrl,
  toggleLicitacaoMira,
  type LicitacaoDisplay,
  type LicitacoesListParams,
} from "@/lib/licitacoes-api";
import { fetchPncpInteligencia, linksPncp, type PncpInteligencia } from "@/lib/pncp-api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type PncpSearch = { cnpj?: string };

export const Route = createFileRoute("/pncp")({
  head: () => ({
    meta: [
      { title: "PNCP Inteligente — Portal CADBRASIL" },
      {
        name: "description",
        content:
          "Pesquisa de oportunidades, inteligência de mercado público e treinamento no Portal Nacional de Contratações Públicas.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): PncpSearch => ({
    cnpj: typeof search.cnpj === "string" ? search.cnpj : undefined,
  }),
  component: PncpPage,
});

const UFS =
  "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" ");

function moeda(v: number | null | undefined, compacto = false) {
  if (!v) return "—";
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
    ...(compacto ? { notation: "compact" as const } : {}),
  });
}

function dataFmt(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("pt-BR");
}

const ABAS: [string, string, typeof Search][] = [
  ["pesquisa", "Pesquisar oportunidades", Search],
  ["inteligencia", "Inteligência de mercado", BarChart3],
  ["edital", "Leitura de edital", ScanText],
  ["antecipe", "Antecipar oportunidades", Telescope],
  ["treinamento", "Treinamento PNCP", GraduationCap],
];

function PncpPage() {
  const { cnpj } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [aba, setAba] = useState("pesquisa");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [empresa, setEmpresa] = useState<EmpresaData | null>(null);
  const [trocarOpen, setTrocarOpen] = useState(false);
  useMarcarServicoVisto("pncp", empresa?.clienteId);

  const selecionar = useCallback(
    (c: string, replace?: boolean) => void navigate({ search: { cnpj: c }, replace }),
    [navigate],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErro(null);
      if (!cnpj) {
        const res = await fetchEmpresas();
        if (cancelled) return;
        const primeira = res.ok ? res.empresas?.[0] : undefined;
        if (primeira) selecionar(primeira.cnpj, true);
        else {
          setErro(res.ok ? "Nenhuma empresa cadastrada" : res.error || "Erro ao carregar empresas");
          setLoading(false);
        }
        return;
      }
      const resolved = await resolveEmpresaPorCnpj(cnpj);
      if (cancelled) return;
      if (!resolved.ok || !resolved.empresa?.clienteId) {
        setErro(resolved.error || "Empresa não encontrada");
        setEmpresa(null);
      } else setEmpresa(resolved.empresa);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [cnpj, selecionar]);

  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-6 sm:py-10 lg:px-8 xl:px-10 2xl:px-12">
      <PageHeader
        icon={<Globe className="h-5 w-5" />}
        title="PNCP Inteligente"
        subtitle="Transforme dados públicos em oportunidades para sua empresa."
      />

      <Card className="overflow-hidden border-indigo-300/50 bg-gradient-to-br from-indigo-500/10 via-background to-emerald-500/5">
        <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              O{" "}
              <strong className="text-foreground">
                Portal Nacional de Contratações Públicas (PNCP)
              </strong>{" "}
              concentra licitações, editais, contratações, atas, contratos e planejamentos de
              compras de órgãos públicos de todo o Brasil. Encontrar os dados é só o começo: com o{" "}
              <strong className="text-foreground">Módulo PNCP da CADBRASIL</strong>, sua empresa
              recebe orientação, ferramentas e inteligência para pesquisar o mercado público e
              identificar oportunidades ligadas ao que vende.
            </p>
            <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
              Menos tempo procurando e mais tempo avaliando oportunidades realmente relevantes.
            </p>
            <div className="flex flex-wrap gap-2">
              {ABAS.map(([id, label, I]) => (
                <Button
                  key={id}
                  size="sm"
                  variant={aba === id ? "default" : "outline"}
                  className="gap-1.5"
                  onClick={() => setAba(id)}
                >
                  <I className="h-4 w-4" /> {label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border bg-background/70 p-4">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground">A CADBRASIL não é órgão do governo.</strong>{" "}
              Usamos os dados públicos do PNCP, captados diariamente pela nossa tecnologia, para
              orientar sua empresa. A disputa acontece sempre na plataforma indicada em cada edital.
            </p>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Carregando a empresa...
        </div>
      ) : !empresa || erro ? (
        <Card className="border-danger/30">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertTriangle className="h-10 w-10 text-danger" />
            <p className="font-semibold">{erro || "Empresa não encontrada"}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => setTrocarOpen(true)}>
                Escolher empresa
              </Button>
              <Button asChild>
                <Link to="/empresas">Ir para Empresas</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/35 bg-primary/5 px-4 py-3 shadow-sm ring-1 ring-primary/10">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Building2 className="h-4 w-4" />
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-success text-white shadow-sm">
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Empresa selecionada
                </p>
                <p className="truncate text-sm font-semibold">{empresa.nome}</p>
                <p className="font-mono text-[11px] text-muted-foreground">{empresa.cnpj}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setTrocarOpen(true)}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Trocar empresa
            </Button>
          </div>

          <ModuloGate
            key={empresa.clienteId}
            modulo="pncp"
            empresa={{
              clienteId: empresa.clienteId!,
              nome: empresa.nome,
              documento: empresa.cnpj,
            }}
          >
            <Tabs value={aba} onValueChange={setAba}>
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-5">
                {ABAS.map(([id, label, I]) => (
                  <TabsTrigger key={id} value={id} className="gap-1.5">
                    <I className="h-4 w-4" /> {label.split(" ")[0]}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="pesquisa" className="pt-4">
                <PesquisaOportunidades />
              </TabsContent>
              <TabsContent value="inteligencia" className="pt-4">
                <InteligenciaMercado clienteId={empresa.clienteId!} />
              </TabsContent>
              <TabsContent value="edital" className="pt-4">
                <LeituraEdital clienteId={empresa.clienteId!} cnpj={empresa.cnpj} />
              </TabsContent>
              <TabsContent value="antecipe" className="pt-4">
                <AnteciparOportunidades />
              </TabsContent>
              <TabsContent value="treinamento" className="pt-4">
                <TreinamentoPncp />
              </TabsContent>
            </Tabs>
          </ModuloGate>
        </>
      )}

      <SelecionarEmpresaModal
        open={trocarOpen}
        onOpenChange={setTrocarOpen}
        empresaAtualCnpj={cnpj}
        titulo="Trocar empresa"
        descricao="Selecione a empresa que vai usar o PNCP Inteligente."
        onSelect={(e) => selecionar(e.cnpj)}
      />
    </div>
  );
}

/* ───────────────────────── Leitura de edital ───────────────────────── */

function LeituraEdital({ clienteId, cnpj }: { clienteId: number; cnpj: string }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [lendo, setLendo] = useState(false);
  const [analise, setAnalise] = useState<AnaliseEdital | null>(null);

  const ler = async () => {
    if (!arquivo) return;
    setLendo(true);
    const res = await lerEditalComIa(clienteId, arquivo);
    setLendo(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setAnalise(res.resultado);
    toast.success(
      res.incluidoNoModulo ? "Edital lido (incluído no seu plano)" : "Edital lido com sucesso",
    );
  };

  const campos: [string, string | null | undefined][] = analise
    ? [
        ["Órgão", analise.orgao],
        ["Modalidade", analise.modalidade],
        ["Número", analise.numero],
        ["Valor estimado", analise.valorEstimado],
        ["Sessão pública", analise.dataSessao],
        ["Local", analise.localidade],
        ["Critério de julgamento", analise.criterioJulgamento],
        [
          "Exclusiva ME/EPP",
          analise.exclusivaME == null ? null : analise.exclusivaME ? "Sim" : "Não",
        ],
      ]
    : [];

  return (
    <div className="space-y-4">
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ScanText className="h-4 w-4 text-primary" /> Leitura de edital com inteligência
            artificial
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Envie o PDF do edital (baixado no PNCP) e receba o resumo: objeto, datas, documentos de
            habilitação, pontos de atenção e cronograma. Incluído na mensalidade do PNCP
            Inteligente.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setArquivo(e.target.files?.[0] || null)}
            className="flex-1"
          />
          <Button className="gap-1.5" disabled={!arquivo || lendo} onClick={() => void ler()}>
            {lendo ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ScanText className="h-4 w-4" />
            )}
            {lendo ? "Lendo o edital..." : "Ler edital"}
          </Button>
        </CardContent>
      </Card>

      {analise && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Pergunta icon={FileSearch} titulo="Resumo do edital">
            {analise.objeto && <p className="mb-3 text-sm">{analise.objeto}</p>}
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
              {campos
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {k}
                    </dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
            </dl>
          </Pergunta>

          <Pergunta icon={AlertTriangle} titulo="Pontos de atenção">
            {analise.pontosAtencao?.length ? (
              <ul className="space-y-1.5 text-sm">
                {analise.pontosAtencao.map((p) => (
                  <li key={p} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
                    {p}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum ponto crítico identificado.</p>
            )}
          </Pergunta>

          <Pergunta icon={ShieldCheck} titulo="Documentos de habilitação exigidos">
            {analise.requisitosHabilitacao?.length ? (
              <div className="space-y-3">
                {analise.requisitosHabilitacao.map((r, i) => (
                  <div key={`${r.categoria}-${i}`}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {r.categoria || "Outros"}
                    </p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {(r.itens || []).map((item) => (
                        <li key={item} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : analise.documentos?.length ? (
              <ul className="space-y-1 text-sm">
                {analise.documentos.map((d) => (
                  <li key={d} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {d}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sem lista de documentos no edital.</p>
            )}
            <Button asChild size="sm" variant="outline" className="mt-3 gap-1.5">
              <Link to="/documentos" search={{ cnpj }}>
                <FileSearch className="h-3.5 w-3.5" /> Conferir meus documentos
              </Link>
            </Button>
          </Pergunta>

          <Pergunta icon={CalendarClock} titulo="Cronograma">
            {analise.cronograma?.length ? (
              <ul className="space-y-1.5 text-sm">
                {analise.cronograma.map((c, i) => (
                  <li key={`${c.evento}-${i}`} className="flex justify-between gap-3">
                    <span>{c.evento}</span>
                    <span className="shrink-0 font-medium">{c.data || "—"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Datas não identificadas no edital.</p>
            )}
          </Pergunta>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Pesquisa de oportunidades ───────────────────────── */

function PesquisaOportunidades() {
  const [q, setQ] = useState("");
  const [uf, setUf] = useState("");
  const [modalidade, setModalidade] = useState("");
  const [situacao, setSituacao] = useState("abertas");
  const [periodo, setPeriodo] = useState("");
  const [modalidades, setModalidades] = useState<string[]>([]);
  const [statusOpcoes, setStatusOpcoes] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<{
    total: number;
    totalPaginas: number;
    itens: LicitacaoDisplay[];
  } | null>(null);
  const [mira, setMira] = useState<Record<number, boolean>>({});

  useEffect(() => {
    void fetchLicitacoesFilters().then((res) => {
      if (!res.ok || !res.filters) return;
      setModalidades(res.filters.modalidades.map((m) => m.value));
      setStatusOpcoes(res.filters.status.map((s) => s.value));
    });
  }, []);

  const buscar = async (p = 1) => {
    setBuscando(true);
    const params: LicitacoesListParams = { page: p, limit: 15 };
    if (q.trim()) params.q = q.trim();
    if (uf) params.uf = [uf];
    if (modalidade) params.modalidade = [modalidade];
    if (status) params.status = [status];
    if (situacao === "abertas") {
      params.prazo_max_days = 365;
      params.order_by = "data_encerramento";
      params.order_dir = "asc";
    } else if (situacao === "semana") {
      params.prazo_max_days = 7;
      params.order_by = "data_encerramento";
      params.order_dir = "asc";
    } else {
      params.order_by = "data_publicacao";
      params.order_dir = "desc";
    }
    if (periodo) {
      const d = new Date();
      d.setDate(d.getDate() - Number(periodo));
      params.created_from = d.toISOString().slice(0, 10);
    }
    const res = await fetchLicitacoesList(params);
    setBuscando(false);
    if (!res.ok) {
      toast.error(res.error || "Erro na pesquisa");
      return;
    }
    const itens = (res.licitacoes || []).map(mapApiToDisplay);
    setMira(Object.fromEntries(itens.map((i) => [i.idNum, !!i.na_mira])));
    setPagina(p);
    setResultado({ total: res.total, totalPaginas: res.total_pages, itens });
  };

  const alternarMira = async (id: number) => {
    const res = await toggleLicitacaoMira(id);
    if (!res.ok) {
      toast.error(res.error || "Não foi possível atualizar");
      return;
    }
    setMira((m) => ({ ...m, [id]: !!res.na_mira }));
    toast.success(res.na_mira ? "Licitação colocada na mira" : "Licitação removida da mira");
  };

  const selectCls = "h-10 w-full rounded-md border bg-background px-2 text-sm";

  return (
    <div className="space-y-4">
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4 text-primary" /> Pesquisa de oportunidades
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Localize contratações do seu segmento por produto ou serviço, órgão, estado, modalidade,
            período e situação do processo.
          </p>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"
            onSubmit={(e) => {
              e.preventDefault();
              void buscar(1);
            }}
          >
            <div className="md:col-span-2">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Produto, serviço, palavra-chave ou órgão"
              />
            </div>
            <select value={uf} onChange={(e) => setUf(e.target.value)} className={selectCls}>
              <option value="">Todos os estados</option>
              {UFS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <select
              value={modalidade}
              onChange={(e) => setModalidade(e.target.value)}
              className={selectCls}
            >
              <option value="">Todas as modalidades</option>
              {modalidades.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={situacao}
              onChange={(e) => setSituacao(e.target.value)}
              className={selectCls}
            >
              <option value="abertas">Recebendo propostas</option>
              <option value="semana">Encerram em até 7 dias</option>
              <option value="todas">Todas (inclui encerradas)</option>
            </select>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className={selectCls}
            >
              <option value="">Qualquer período</option>
              <option value="1">Captadas hoje</option>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
            </select>
            {statusOpcoes.length > 0 && (
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={selectCls}
              >
                <option value="">Situação no PNCP: todas</option>
                {statusOpcoes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
            <Button
              type="submit"
              className="gap-1.5 md:col-span-2 xl:col-span-1"
              disabled={buscando}
            >
              {buscando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Pesquisar
            </Button>
          </form>
        </CardContent>
      </Card>

      {resultado && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{resultado.total.toLocaleString("pt-BR")}</strong>{" "}
              contratação(ões) encontrada(s)
            </p>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/licitacoes">
                <Radar className="h-4 w-4" /> Abrir o Radar de Licitações completo
              </Link>
            </Button>
          </div>
          {resultado.itens.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma contratação com esses filtros. Tente sinônimos do produto ou amplie o
                período.
              </CardContent>
            </Card>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {resultado.itens.map((l) => {
                const url = resolveLicitacaoPncpUrl(l);
                const naMira = mira[l.idNum];
                return (
                  <li
                    key={l.id}
                    className="flex flex-col rounded-xl border bg-card p-4 shadow-soft"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {l.modalidade}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {l.uf}
                      </Badge>
                      {l.status && (
                        <span className="text-[10px] text-muted-foreground">{l.status}</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm font-semibold">{l.orgao}</p>
                    <p className="line-clamp-3 flex-1 text-xs text-muted-foreground">{l.objeto}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
                      <span className="text-muted-foreground">
                        {l.valor} · <CalendarClock className="inline h-3 w-3" /> {l.prazo}
                      </span>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant={naMira ? "default" : "outline"}
                          className="h-7 gap-1 px-2 text-[11px]"
                          onClick={() => void alternarMira(l.idNum)}
                        >
                          {naMira ? (
                            <BookmarkCheck className="h-3.5 w-3.5" />
                          ) : (
                            <Bookmark className="h-3.5 w-3.5" />
                          )}
                          {naMira ? "Na mira" : "Mira"}
                        </Button>
                        {url && (
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 px-2 text-[11px]"
                          >
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" /> PNCP
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {resultado.totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pagina <= 1 || buscando}
                onClick={() => void buscar(pagina - 1)}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                {pagina} / {resultado.totalPaginas}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={pagina >= resultado.totalPaginas || buscando}
                onClick={() => void buscar(pagina + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Inteligência de mercado ───────────────────────── */

function InteligenciaMercado({ clienteId }: { clienteId: number }) {
  const [q, setQ] = useState("");
  const [uf, setUf] = useState("");
  const [meses, setMeses] = useState(12);
  const [carregando, setCarregando] = useState(false);
  const [dados, setDados] = useState<PncpInteligencia | null>(null);

  const analisar = async () => {
    if (q.trim().length < 3) {
      toast.error("Informe o produto ou serviço que sua empresa vende (mín. 3 letras).");
      return;
    }
    setCarregando(true);
    const res = await fetchPncpInteligencia({
      clienteId,
      q: q.trim(),
      uf: uf || undefined,
      meses,
    });
    setCarregando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDados(res);
  };

  const r = dados?.resumo;
  const maxMes = Math.max(1, ...(dados?.porMes.map((m) => m.quantidade) || [1]));
  const maxUf = Math.max(1, ...(dados?.porUf.map((u) => u.quantidade) || [1]));
  const maxMod = Math.max(1, ...(dados?.porModalidade.map((m) => m.quantidade) || [1]));

  return (
    <div className="space-y-4">
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" /> Como o Governo compra o que você vende?
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Digite o produto ou serviço da sua empresa. Cruzamos licitações e contratos publicados
            no PNCP para mostrar quem compra, quanto, com que frequência e quem já vende.
          </p>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_180px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              void analisar();
            }}
          >
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ex.: notebook, material de limpeza, manutenção predial"
            />
            <select
              value={uf}
              onChange={(e) => setUf(e.target.value)}
              className="h-10 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">Brasil inteiro</option>
              {UFS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <select
              value={meses}
              onChange={(e) => setMeses(Number(e.target.value))}
              className="h-10 rounded-md border bg-background px-2 text-sm"
            >
              <option value={3}>Últimos 3 meses</option>
              <option value={6}>Últimos 6 meses</option>
              <option value={12}>Últimos 12 meses</option>
              <option value={24}>Últimos 24 meses</option>
            </select>
            <Button type="submit" className="gap-1.5" disabled={carregando}>
              {carregando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TrendingUp className="h-4 w-4" />
              )}
              Analisar mercado
            </Button>
          </form>
        </CardContent>
      </Card>

      {!dados && !carregando && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            [Landmark, "Quem compra o que você vende?"],
            [Wallet, "Quanto os órgãos estão contratando?"],
            [TrendingUp, "Quais órgãos compram com maior frequência?"],
            [FileSearch, "Quais oportunidades estão abertas?"],
            [Telescope, "Quais compras estão sendo planejadas?"],
            [Users, "Quais empresas estão participando desse mercado?"],
          ].map(([Icon, t]) => {
            const I = Icon as typeof Search;
            return (
              <Card key={t as string} className="border-dashed">
                <CardContent className="flex items-center gap-3 p-4">
                  <I className="h-5 w-5 shrink-0 text-indigo-600" />
                  <p className="text-sm font-medium">{t as string}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {dados && r && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              icon={FileSearch}
              label="Licitações no período"
              valor={r.licitacoes.toLocaleString("pt-BR")}
            />
            <Kpi icon={Wallet} label="Valor estimado" valor={moeda(r.valorEstimado, true)} />
            <Kpi
              icon={Landmark}
              label="Órgãos compradores"
              valor={r.orgaos.toLocaleString("pt-BR")}
            />
            <Kpi
              icon={CalendarClock}
              label="Abertas agora"
              valor={r.abertas.toLocaleString("pt-BR")}
              destaque
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Pergunta icon={Landmark} titulo="Quem compra o que você vende — e com que frequência?">
              {dados.orgaos.length === 0 ? (
                <Vazio />
              ) : (
                <ol className="space-y-2">
                  {dados.orgaos.map((o, i) => (
                    <li key={o.nome} className="flex items-start justify-between gap-3 text-sm">
                      <span className="flex min-w-0 gap-2">
                        <span className="w-5 shrink-0 text-right text-xs font-bold text-muted-foreground">
                          {i + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{o.nome}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {[o.municipio, o.uf].filter(Boolean).join(" / ") || "Várias unidades"} ·
                            última em {dataFmt(o.ultima)}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-semibold">{o.quantidade}x</span>
                        <span className="text-[11px] text-muted-foreground">
                          {moeda(o.valor, true)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Pergunta>

            <Pergunta icon={Wallet} titulo="Quanto os órgãos estão contratando?">
              {dados.porMes.length === 0 ? (
                <Vazio />
              ) : (
                <div className="space-y-1.5">
                  {dados.porMes.map((m) => (
                    <Barra
                      key={m.mes}
                      label={`${m.mes.slice(5)}/${m.mes.slice(2, 4)}`}
                      valor={m.quantidade}
                      max={maxMes}
                      extra={moeda(m.valor, true)}
                    />
                  ))}
                </div>
              )}
            </Pergunta>

            <Pergunta icon={FileSearch} titulo="Quais oportunidades estão abertas?">
              {dados.abertas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma recebendo propostas agora com esse termo na base. Confira também direto no
                  PNCP:{" "}
                  <a
                    href={linksPncp(dados.termo).editaisAbertos}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    editais abertos
                  </a>
                  .
                </p>
              ) : (
                <ul className="space-y-2">
                  {dados.abertas.map((a) => {
                    const url = resolveLicitacaoPncpUrl({
                      link_portal: a.linkPortal,
                      link_edital: a.linkEdital,
                      numero_controle_pncp: a.numeroControlePncp,
                    });
                    return (
                      <li key={a.id} className="rounded-lg border p-2.5 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{a.orgao}</span>
                            <span className="line-clamp-2 text-xs text-muted-foreground">
                              {a.objeto}
                            </span>
                          </span>
                          {url && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-primary"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {a.uf} · {a.modalidade} · até <strong>{dataFmt(a.encerramento)}</strong> ·{" "}
                          {moeda(a.valor)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Pergunta>

            <Pergunta icon={Users} titulo="Quais empresas estão vendendo esse objeto?">
              <p className="mb-2 text-[11px] text-muted-foreground">
                {r.contratos.toLocaleString("pt-BR")} contratos · {moeda(r.valorContratado, true)} ·{" "}
                {r.empresasContratadas.toLocaleString("pt-BR")} empresas contratadas no período
                (Brasil)
              </p>
              {dados.fornecedores.length === 0 ? (
                <Vazio />
              ) : (
                <ol className="space-y-1.5">
                  {dados.fornecedores.map((f, i) => (
                    <li
                      key={`${f.nome}-${i}`}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        <span className="mr-2 text-xs font-bold text-muted-foreground">
                          {i + 1}
                        </span>
                        {f.nome}
                      </span>
                      <span className="shrink-0 text-xs">
                        <strong>{f.contratos}</strong> · {moeda(f.valor, true)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Pergunta>

            <Pergunta icon={Globe} titulo="Onde estão as compras (por estado)?">
              {dados.porUf.length === 0 ? (
                <Vazio />
              ) : (
                <div className="space-y-1.5">
                  {dados.porUf.slice(0, 12).map((u) => (
                    <Barra
                      key={u.uf}
                      label={u.uf}
                      valor={u.quantidade}
                      max={maxUf}
                      extra={moeda(u.valor, true)}
                    />
                  ))}
                </div>
              )}
            </Pergunta>

            <Pergunta icon={Building} titulo="Como compram (modalidades)?">
              {dados.porModalidade.length === 0 ? (
                <Vazio />
              ) : (
                <div className="space-y-1.5">
                  {dados.porModalidade.map((m) => (
                    <Barra
                      key={m.modalidade}
                      label={m.modalidade}
                      valor={m.quantidade}
                      max={maxMod}
                      largo
                    />
                  ))}
                </div>
              )}
            </Pergunta>
          </div>

          <Card className="border-indigo-300/50 bg-indigo-50/50 dark:bg-indigo-950/20">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Telescope className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
                <div>
                  <p className="text-sm font-semibold">Quais compras estão sendo planejadas?</p>
                  <p className="text-xs text-muted-foreground">
                    Consulte os Planos de Contratações Anuais (PCA) publicados no PNCP para “
                    {dados.termo}”.
                  </p>
                </div>
              </div>
              <AtalhosPncp termo={dados.termo} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  valor,
  destaque,
}: {
  icon: typeof Search;
  label: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <Card className={cn("shadow-soft", destaque && "border-success/40 bg-success/5")}>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            destaque ? "bg-success/15 text-success" : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xl font-bold leading-none">{valor}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Pergunta({
  icon: Icon,
  titulo,
  children,
}: {
  icon: typeof Search;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="h-4 w-4 text-indigo-600" /> {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Barra({
  label,
  valor,
  max,
  extra,
  largo,
}: {
  label: string;
  valor: number;
  max: number;
  extra?: string;
  largo?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={cn("shrink-0 truncate text-muted-foreground", largo ? "w-44" : "w-12")}>
        {label}
      </span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-indigo-500"
          style={{ width: `${(valor / max) * 100}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right font-semibold">{valor}</span>
      {extra && (
        <span className="hidden w-16 shrink-0 text-right text-muted-foreground sm:block">
          {extra}
        </span>
      )}
    </div>
  );
}

function Vazio() {
  return <p className="text-sm text-muted-foreground">Sem dados para esse termo no período.</p>;
}

function AtalhosPncp({ termo }: { termo: string }) {
  const l = linksPncp(termo);
  return (
    <div className="flex flex-wrap gap-2">
      {[
        [l.pca, "Planejamento (PCA)"],
        [l.editaisAbertos, "Editais abertos"],
        [l.atas, "Atas"],
        [l.contratos, "Contratos"],
      ].map(([href, label]) => (
        <Button key={label} asChild size="sm" variant="outline" className="gap-1.5">
          <a href={href} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" /> {label}
          </a>
        </Button>
      ))}
    </div>
  );
}

/* ───────────────────────── Antecipe oportunidades ───────────────────────── */

function AnteciparOportunidades() {
  const [termo, setTermo] = useState("");
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Telescope className="h-4 w-4 text-indigo-600" /> Não espere só o edital aparecer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Pela Lei 14.133/2021, os órgãos publicam no PNCP o{" "}
            <strong className="text-foreground">Plano de Contratações Anual (PCA)</strong>: a lista
            do que pretendem comprar no ano. Imagine descobrir que um órgão planeja adquirir
            justamente o produto ou serviço que sua empresa vende — dá tempo de organizar
            documentos, preço e fornecedores antes do edital.
          </p>
          <ul className="space-y-2">
            {[
              "Identifique órgãos que planejam comprar o seu produto ou serviço.",
              "Prepare a documentação e o cadastro na plataforma de disputa com antecedência.",
              "Acompanhe atas vigentes: muitas permitem adesão (carona) por outros órgãos.",
              "Consulte contratos que estão vencendo — eles costumam gerar nova licitação.",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                {t}
              </li>
            ))}
          </ul>
          <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
            <p className="text-sm font-semibold text-foreground">
              Pesquise no PNCP pelo seu produto
            </p>
            <Input
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Ex.: uniformes, software de gestão, merenda escolar"
            />
            {termo.trim().length >= 3 ? (
              <AtalhosPncp termo={termo} />
            ) : (
              <p className="text-[11px]">Digite ao menos 3 letras para gerar os atalhos.</p>
            )}
          </div>
        </CardContent>
      </Card>
      <Card className="border-indigo-300/50 bg-gradient-to-br from-indigo-500/10 to-background">
        <CardContent className="space-y-3 p-5">
          <p className="text-sm font-semibold">A CADBRASIL interpreta para você</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Nossa equipe ajuda a localizar e interpretar os planejamentos de compras, atas e
            contratos do seu segmento, e a transformar essas informações em uma agenda de
            oportunidades.
          </p>
          <Button asChild className="w-full gap-1.5">
            <a
              href={buildWhatsAppSuporteUrl(
                `Olá! Quero ajuda da CADBRASIL para antecipar oportunidades no PNCP (planejamento de compras) para o meu segmento${termo.trim() ? `: ${termo.trim()}` : ""}.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-4 w-4" /> Falar com a equipe
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────────────────────── Treinamento PNCP ───────────────────────── */

const MODULOS_TREINAMENTO: { id: string; titulo: string; pontos: string[]; link: string }[] = [
  {
    id: "navegar",
    titulo: "Navegar pelo PNCP",
    pontos: [
      "O que o PNCP reúne: editais, atas, contratos e planos de contratação de todos os entes.",
      "Diferença entre o PNCP (divulgação) e a plataforma de disputa indicada no edital.",
    ],
    link: "https://pncp.gov.br/app/",
  },
  {
    id: "pesquisar",
    titulo: "Pesquisar oportunidades",
    pontos: [
      "Busca por palavra-chave, sinônimos e termos técnicos do seu produto.",
      "Filtros por status (recebendo propostas), UF, município, modalidade e órgão.",
    ],
    link: "https://pncp.gov.br/app/editais?status=recebendo_proposta&pagina=1",
  },
  {
    id: "interpretar",
    titulo: "Interpretar os resultados",
    pontos: [
      "Ler modalidade, critério de julgamento, valor estimado e datas da contratação.",
      "Identificar se é registro de preços (SRP), exclusiva ME/EPP ou ampla concorrência.",
    ],
    link: "https://pncp.gov.br/app/editais?pagina=1",
  },
  {
    id: "editais",
    titulo: "Localizar e consultar editais",
    pontos: [
      "Abrir a contratação, baixar o edital e os anexos (termo de referência, planilhas).",
      "Encontrar o link da plataforma onde a disputa vai acontecer.",
    ],
    link: "https://pncp.gov.br/app/editais?pagina=1",
  },
  {
    id: "acompanhar",
    titulo: "Acompanhar contratações",
    pontos: [
      "Acompanhar avisos, esclarecimentos, impugnações e alterações publicadas.",
      "Conferir o resultado e o valor homologado de cada item.",
    ],
    link: "https://pncp.gov.br/app/editais?pagina=1",
  },
  {
    id: "atas",
    titulo: "Consultar atas e contratos",
    pontos: [
      "Atas de registro de preços vigentes: preços praticados e possibilidade de adesão.",
      "Contratos: quem venceu, por quanto e até quando vale.",
    ],
    link: "https://pncp.gov.br/app/atas?pagina=1",
  },
  {
    id: "orgaos",
    titulo: "Pesquisar órgãos compradores",
    pontos: [
      "Ver o histórico de compras de um órgão específico.",
      "Montar uma lista de órgãos-alvo para o seu segmento.",
    ],
    link: "https://pncp.gov.br/app/contratos?pagina=1",
  },
  {
    id: "planejamento",
    titulo: "Usar o planejamento das contratações",
    pontos: [
      "Consultar o Plano de Contratações Anual (PCA) dos órgãos.",
      "Antecipar demandas antes da abertura do processo.",
    ],
    link: "https://pncp.gov.br/app/pca?pagina=1",
  },
];

const STORAGE_TREINAMENTO = "cadbrasil_pncp_treinamento";

function TreinamentoPncp() {
  const [feitos, setFeitos] = useState<string[]>([]);

  useEffect(() => {
    try {
      setFeitos(JSON.parse(localStorage.getItem(STORAGE_TREINAMENTO) || "[]"));
    } catch {
      setFeitos([]);
    }
  }, []);

  const alternar = (id: string, v: boolean) => {
    const novo = v ? [...new Set([...feitos, id])] : feitos.filter((f) => f !== id);
    setFeitos(novo);
    localStorage.setItem(STORAGE_TREINAMENTO, JSON.stringify(novo));
  };

  const pct = Math.round((feitos.length / MODULOS_TREINAMENTO.length) * 100);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-indigo-600" /> Trilha de treinamento PNCP
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {feitos.length}/{MODULOS_TREINAMENTO.length} módulos
            </span>
          </CardTitle>
          <Progress value={pct} className="h-2" />
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            {MODULOS_TREINAMENTO.map((m, i) => {
              const feito = feitos.includes(m.id);
              return (
                <AccordionItem key={m.id} value={m.id}>
                  <AccordionTrigger className="py-3 hover:no-underline">
                    <span className="flex items-center gap-3 text-left">
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                          feito ? "bg-success text-white" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {feito ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                      </span>
                      <span className="text-sm font-semibold">{m.titulo}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pl-10">
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      {m.pontos.map((p) => (
                        <li key={p} className="flex gap-2">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-indigo-500" />
                          {p}
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button asChild size="sm" variant="outline" className="gap-1.5">
                        <a href={m.link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" /> Praticar no PNCP
                        </a>
                      </Button>
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                        <Checkbox
                          checked={feito}
                          onCheckedChange={(v) => alternar(m.id, v === true)}
                        />
                        Módulo concluído
                      </label>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
      <Card className="h-fit border-indigo-300/50 bg-gradient-to-br from-indigo-500/10 to-background">
        <CardContent className="space-y-3 p-5">
          <p className="text-sm font-semibold">Treinamento com a equipe CADBRASIL</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Nossa equipe orienta sua empresa no uso do portal e dos recursos de pesquisa, com
            exemplos reais do seu segmento.
          </p>
          <Button asChild className="w-full gap-1.5">
            <a
              href={buildWhatsAppSuporteUrl(
                "Olá! Quero agendar o treinamento PNCP da CADBRASIL para a minha empresa.",
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-4 w-4" /> Agendar treinamento
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
