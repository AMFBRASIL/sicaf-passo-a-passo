import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Info,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { SelecionarEmpresaModal } from "@/components/selecionar-empresa-modal";
import { AcompanhamentoDetalhe } from "@/components/licitacoes-e/acompanhamento-detalhe";
import { ModuloGate } from "@/components/modulos/modulo-assinatura";
import { fetchEmpresas } from "@/lib/empresas-api";
import { resolveEmpresaPorCnpj } from "@/lib/documentos-api";
import type { EmpresaData } from "@/lib/empresas-shared";
import {
  RESULTADOS,
  SITUACOES_PORTAL,
  buscarLicitacoesE,
  calcularAptidao,
  criarAcompanhamento,
  dataHoraFmt,
  fetchLicitacoesEPainel,
  salvarAcessoLicitacoesE,
  type Acompanhamento,
  type EtapaAcesso,
  type LicitacaoEncontrada,
  type LicitacoesEPainel,
} from "@/lib/licitacoes-e-api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type LicitacoesESearch = { cnpj?: string };

export const Route = createFileRoute("/licitacoes-e")({
  head: () => ({
    meta: [
      { title: "Assistente Licitações-e CADBRASIL — Portal CADBRASIL" },
      {
        name: "description",
        content:
          "Acesso, edital, aptidão, checklist, proposta, disputa, habilitação e resultado das licitações do Licitações-e (Banco do Brasil).",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): LicitacoesESearch => ({
    cnpj: typeof search.cnpj === "string" ? search.cnpj : undefined,
  }),
  component: LicitacoesEPage,
});

const ETAPAS_ACESSO: { id: EtapaAcesso; titulo: string; descricao: string }[] = [
  {
    id: "documentos",
    titulo: "Separar os documentos",
    descricao: "Contrato social, documentos do representante legal e procuração (se houver).",
  },
  {
    id: "certificado",
    titulo: "Certificado digital",
    descricao: "e-CNPJ ou e-CPF do representante válido — agiliza a validação do credenciamento.",
  },
  {
    id: "formulario",
    titulo: "Solicitar o credenciamento",
    descricao: "Preencher o cadastro de fornecedor/representante no site do Licitações-e.",
  },
  {
    id: "agencia",
    titulo: "Validar o representante",
    descricao:
      "Validação por certificado digital ou em agência do Banco do Brasil, conforme o caso.",
  },
  {
    id: "chave",
    titulo: "Chave e senha de acesso",
    descricao: "Receber a chave de acesso e cadastrar a senha do representante.",
  },
  {
    id: "primeiro_acesso",
    titulo: "Primeiro acesso",
    descricao: "Entrar no portal, conferir os dados da empresa e localizar uma licitação de teste.",
  },
];

const UFS =
  "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" ");

type Resp = ({ ok: true } & LicitacoesEPainel) | { ok: false; error: string };

function LicitacoesEPage() {
  const { cnpj } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [empresa, setEmpresa] = useState<EmpresaData | null>(null);
  const [trocarOpen, setTrocarOpen] = useState(false);

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
        setLoading(false);
        return;
      }
      setEmpresa(resolved.empresa);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [cnpj, selecionar]);

  const header = (
    <PageHeader
      icon={<Building2 className="h-5 w-5" />}
      title="Assistente Licitações-e CADBRASIL"
      subtitle="Do acesso ao resultado: acompanhe cada licitação do Licitações-e (Banco do Brasil) com orientação em todas as etapas."
    />
  );

  if (loading) {
    return (
      <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 px-4 py-10">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando o Assistente Licitações-e...</p>
      </div>
    );
  }

  if (!empresa || erro) {
    return (
      <div className="w-full px-4 py-6 sm:px-6 sm:py-10 lg:px-8 xl:px-10 2xl:px-12">
        {header}
        <Card className="mt-6 border-danger/30">
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
        <SelecionarEmpresaModal
          open={trocarOpen}
          onOpenChange={setTrocarOpen}
          empresaAtualCnpj={cnpj}
          titulo="Escolher empresa"
          onSelect={(e) => selecionar(e.cnpj)}
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-6 sm:py-10 lg:px-8 xl:px-10 2xl:px-12">
      {header}

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
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTrocarOpen(true)}>
          <RefreshCw className="h-3.5 w-3.5" /> Trocar empresa
        </Button>
      </div>

      <Card className="border-amber-300/60 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20">
        <CardContent className="flex items-start gap-3 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">A CADBRASIL não é o Banco do Brasil.</strong> O
            Licitações-e é o portal de licitações do Banco do Brasil; a CADBRASIL é uma assessoria
            privada que orienta e organiza a participação da sua empresa. Lances, prazos e decisões
            são definidos no portal e pelo órgão comprador.
          </p>
        </CardContent>
      </Card>

      <ModuloGate
        key={empresa.clienteId}
        modulo="licitacoes_e"
        empresa={{ clienteId: empresa.clienteId!, nome: empresa.nome, documento: empresa.cnpj }}
      >
        <LicitacoesEConteudo clienteId={empresa.clienteId!} empresaNome={empresa.nome} />
      </ModuloGate>

      <SelecionarEmpresaModal
        open={trocarOpen}
        onOpenChange={setTrocarOpen}
        empresaAtualCnpj={empresa.cnpj}
        titulo="Trocar empresa"
        descricao="Selecione a empresa para acompanhar as licitações do Licitações-e."
        onSelect={(e) => selecionar(e.cnpj)}
      />
    </div>
  );
}

function LicitacoesEConteudo({
  clienteId,
  empresaNome,
}: {
  clienteId: number;
  empresaNome: string;
}) {
  const [painel, setPainel] = useState<LicitacoesEPainel | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [localizarOpen, setLocalizarOpen] = useState(false);
  const [detalheId, setDetalheId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchLicitacoesEPainel(clienteId).then((p) => {
      if (cancelled) return;
      if (!p.ok) setErro(p.error);
      else setPainel(p);
    });
    return () => {
      cancelled = true;
    };
  }, [clienteId]);

  const aplicar = (res: Resp, sucesso?: string) => {
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setPainel(res);
    if (sucesso) toast.success(sucesso);
    return true;
  };

  if (erro) {
    return (
      <Card className="border-danger/30">
        <CardContent className="flex items-center gap-3 p-6 text-sm">
          <AlertTriangle className="h-5 w-5 text-danger" /> {erro}
        </CardContent>
      </Card>
    );
  }

  if (!painel) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" /> Carregando o Assistente
        Licitações-e...
      </div>
    );
  }

  const lista = painel.acompanhamentos;
  const detalhe = lista.find((a) => a.id === detalheId) || null;

  return (
    <>
      <FluxoPortal lista={lista} />

      <Indicadores lista={lista} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Minhas licitações no Licitações-e</h2>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setLocalizarOpen(true)}
            >
              <Search className="h-3.5 w-3.5" /> Localizar
            </Button>
          </div>
          {lista.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                <Search className="h-10 w-10 text-muted-foreground" />
                <p className="font-semibold">Nenhuma licitação em acompanhamento</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Localize uma licitação do Licitações-e na base da CADBRASIL ou cadastre pelo
                  número para o assistente guiar você do edital ao resultado.
                </p>
                <Button className="gap-1.5" onClick={() => setLocalizarOpen(true)}>
                  <Plus className="h-4 w-4" /> Localizar licitação
                </Button>
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-3">
              {lista.map((a) => (
                <AcompanhamentoCard key={a.id} a={a} onAbrir={() => setDetalheId(a.id)} />
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          <AcessoCard
            etapas={painel.acessoEtapas}
            onSalvar={async (etapas) => aplicar(await salvarAcessoLicitacoesE(clienteId, etapas))}
          />
          <Card className="shadow-soft">
            <CardContent className="space-y-2 p-4 text-sm">
              <p className="font-semibold">Links do Licitações-e</p>
              <a
                href="https://www.licitacoes-e.com.br"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Portal Licitações-e
              </a>
              <p className="text-xs text-muted-foreground">
                Pesquise licitações, acompanhe a Sala de Disputa e consulte atas e resultados
                diretamente no portal do Banco do Brasil.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <LocalizarDialog
        open={localizarOpen}
        onOpenChange={setLocalizarOpen}
        clienteId={clienteId}
        jaAcompanhadas={new Set(lista.map((a) => a.licitacaoId).filter(Boolean) as number[])}
        onCriado={(res) => {
          if (aplicar(res, "Licitação adicionada ao acompanhamento") && res.ok) {
            setLocalizarOpen(false);
            if (res.criadoId) setDetalheId(res.criadoId);
          }
        }}
      />

      <AcompanhamentoDetalhe
        open={!!detalhe}
        onOpenChange={(v) => !v && setDetalheId(null)}
        acompanhamento={detalhe}
        clienteId={clienteId}
        empresaNome={empresaNome}
        onAplicar={aplicar}
      />
    </>
  );
}

function FluxoPortal({ lista }: { lista: Acompanhamento[] }) {
  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Como a licitação anda no Licitações-e</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-2 md:grid-cols-5">
          {SITUACOES_PORTAL.map((s, i) => {
            const qtd = lista.filter((a) => a.situacaoPortal === s.id).length;
            return (
              <li
                key={s.id}
                className={cn(
                  "relative rounded-xl border p-3",
                  qtd > 0 ? "border-primary/40 bg-primary/5" : "bg-muted/20",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  {qtd > 0 && <Badge className="h-5 px-1.5 text-[10px]">{qtd}</Badge>}
                </div>
                <p className="mt-2 text-sm font-semibold">{s.label}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {s.descricao}
                </p>
                {i < SITUACOES_PORTAL.length - 1 && (
                  <ChevronRight className="absolute -right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground md:block" />
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function Indicadores({ lista }: { lista: Acompanhamento[] }) {
  const agora = Date.now();
  const semana = agora + 7 * 24 * 3600 * 1000;
  const proximas = lista.filter((a) => {
    const t = a.dataDisputa ? new Date(a.dataDisputa).getTime() : NaN;
    return t >= agora && t <= semana;
  }).length;
  const aptas = lista.filter((a) => calcularAptidao(a.checklist).apto).length;
  const vencidas = lista.filter((a) => a.resultado === "vencedora").length;
  const itens = [
    { label: "Em acompanhamento", valor: lista.length, icon: Search },
    { label: "Disputas nos próximos 7 dias", valor: proximas, icon: CalendarClock },
    { label: "Empresa apta (checklist completo)", valor: aptas, icon: ShieldCheck },
    { label: "Licitações vencidas", valor: vencidas, icon: Trophy },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {itens.map(({ label, valor, icon: Icon }) => (
        <Card key={label} className="shadow-soft">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{valor}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AcompanhamentoCard({ a, onAbrir }: { a: Acompanhamento; onAbrir: () => void }) {
  const apt = calcularAptidao(a.checklist);
  const idx = SITUACOES_PORTAL.findIndex((s) => s.id === a.situacaoPortal);
  const resultado = RESULTADOS.find((r) => r.id === a.resultado);
  return (
    <li>
      <button
        type="button"
        onClick={onAbrir}
        className="w-full rounded-xl border bg-card p-4 text-left shadow-soft transition hover:border-primary/40 hover:shadow-md"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="font-mono text-[10px]">
                {a.numeroLicitacao ? `nº ${a.numeroLicitacao}` : "Sem número"}
              </Badge>
              {a.uf && (
                <Badge variant="secondary" className="text-[10px]">
                  {a.uf}
                </Badge>
              )}
              {resultado && (
                <Badge
                  className={cn(
                    "text-[10px] text-white",
                    a.resultado === "vencedora"
                      ? "bg-success hover:bg-success"
                      : "bg-muted-foreground",
                  )}
                >
                  {resultado.label}
                </Badge>
              )}
            </div>
            <p className="mt-1 truncate text-sm font-semibold">
              {a.orgao || "Órgão não informado"}
            </p>
            <p className="line-clamp-2 text-xs text-muted-foreground">{a.objeto || "—"}</p>
          </div>
          <div className="text-right text-xs">
            <p className="text-muted-foreground">Disputa</p>
            <p className="font-semibold">{dataHoraFmt(a.dataDisputa)}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1">
          {SITUACOES_PORTAL.map((s, i) => (
            <div key={s.id} className="space-y-1">
              <div
                className={cn(
                  "h-1.5 rounded-full",
                  i < idx ? "bg-success" : i === idx ? "bg-primary" : "bg-muted",
                )}
              />
              <p
                className={cn(
                  "hidden text-[10px] sm:block",
                  i === idx ? "font-semibold text-primary" : "text-muted-foreground",
                )}
              >
                {s.label}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={apt.pct} className="h-1.5 flex-1" />
          <span
            className={cn(
              "text-[11px] font-semibold",
              apt.apto ? "text-success" : "text-warning-foreground",
            )}
          >
            {apt.apto ? "Apta" : `Aptidão ${apt.pct}%`}
          </span>
        </div>
      </button>
    </li>
  );
}

function AcessoCard({
  etapas,
  onSalvar,
}: {
  etapas: EtapaAcesso[];
  onSalvar: (etapas: EtapaAcesso[]) => Promise<boolean>;
}) {
  const [salvando, setSalvando] = useState(false);
  const feitas = ETAPAS_ACESSO.filter((e) => etapas.includes(e.id)).length;
  const alternar = async (id: EtapaAcesso, v: boolean) => {
    setSalvando(true);
    await onSalvar(v ? [...new Set([...etapas, id])] : etapas.filter((e) => e !== id));
    setSalvando(false);
  };
  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> Acesso e cadastro no Licitações-e
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {feitas}/{ETAPAS_ACESSO.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={(feitas / ETAPAS_ACESSO.length) * 100} className="h-2" />
        <ul className="space-y-2.5">
          {ETAPAS_ACESSO.map((e) => {
            const feita = etapas.includes(e.id);
            return (
              <li key={e.id}>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <Checkbox
                    className="mt-0.5"
                    checked={feita}
                    disabled={salvando}
                    onCheckedChange={(v) => void alternar(e.id, v === true)}
                  />
                  <span>
                    <span className={cn("block text-sm font-medium", feita && "text-success")}>
                      {e.titulo}
                    </span>
                    <span className="block text-[11px] leading-snug text-muted-foreground">
                      {e.descricao}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {feitas === ETAPAS_ACESSO.length && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-success">
            <CheckCircle2 className="h-4 w-4" /> Acesso pronto para disputar.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

type RespCriar =
  | ({ ok: true; criadoId?: number } & LicitacoesEPainel)
  | { ok: false; error: string };

function LocalizarDialog({
  open,
  onOpenChange,
  clienteId,
  jaAcompanhadas,
  onCriado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clienteId: number;
  jaAcompanhadas: Set<number>;
  onCriado: (res: RespCriar) => void;
}) {
  const [q, setQ] = useState("");
  const [uf, setUf] = useState("");
  const [abertas, setAbertas] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<{
    total: number;
    totalPaginas: number;
    licitacoes: LicitacaoEncontrada[];
  } | null>(null);
  const [adicionando, setAdicionando] = useState<number | null>(null);
  const [manual, setManual] = useState({
    numeroLicitacao: "",
    orgao: "",
    objeto: "",
    uf: "",
    dataDisputa: "",
    link: "",
  });
  const [salvandoManual, setSalvandoManual] = useState(false);

  const buscar = useCallback(
    async (p = 1) => {
      setBuscando(true);
      const res = await buscarLicitacoesE({
        clienteId,
        q: q.trim() || undefined,
        uf: uf || undefined,
        abertas,
        pagina: p,
      });
      setBuscando(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPagina(p);
      setResultado(res);
    },
    [clienteId, q, uf, abertas],
  );

  useEffect(() => {
    if (open && !resultado) void buscar(1);
  }, [open, resultado, buscar]);

  const acompanhar = async (id: number) => {
    setAdicionando(id);
    onCriado(await criarAcompanhamento(clienteId, { licitacaoId: id }));
    setAdicionando(null);
  };

  const salvarManual = async () => {
    setSalvandoManual(true);
    onCriado(
      await criarAcompanhamento(clienteId, {
        ...manual,
        dataDisputa: manual.dataDisputa ? manual.dataDisputa.replace("T", " ") : undefined,
      }),
    );
    setSalvandoManual(false);
  };

  const valorFmt = useMemo(
    () => (v: number | null) =>
      v
        ? v.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
            maximumFractionDigits: 0,
          })
        : "—",
    [],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Localizar uma licitação do Licitações-e</DialogTitle>
          <DialogDescription>
            Busque nas licitações captadas pela CADBRASIL que são disputadas no Licitações-e, ou
            cadastre pelo número.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="buscar">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buscar">Buscar na base CADBRASIL</TabsTrigger>
            <TabsTrigger value="manual">Cadastrar pelo número</TabsTrigger>
          </TabsList>

          <TabsContent value="buscar" className="space-y-3 pt-2">
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                void buscar(1);
              }}
            >
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Produto, serviço, órgão ou nº da licitação"
                className="flex-1"
              />
              <select
                value={uf}
                onChange={(e) => setUf(e.target.value)}
                className="h-10 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Todas as UFs</option>
                {UFS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <Button type="submit" className="gap-1.5" disabled={buscando}>
                {buscando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Buscar
              </Button>
            </form>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={abertas} onCheckedChange={setAbertas} />
              Somente com propostas abertas
            </label>

            {resultado && (
              <>
                <p className="text-xs text-muted-foreground">
                  {resultado.total} licitação(ões) encontrada(s)
                </p>
                <ul className="space-y-2">
                  {resultado.licitacoes.map((l) => {
                    const ja = jaAcompanhadas.has(l.id);
                    return (
                      <li key={l.id} className="rounded-lg border p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {l.numeroLicitacao && (
                                <Badge variant="outline" className="font-mono text-[10px]">
                                  nº {l.numeroLicitacao}
                                </Badge>
                              )}
                              {l.uf && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {l.uf}
                                </Badge>
                              )}
                              <span className="text-[11px] text-muted-foreground">
                                {l.modalidade}
                              </span>
                            </div>
                            <p className="mt-1 text-sm font-semibold">{l.orgao}</p>
                            <p className="line-clamp-2 text-xs text-muted-foreground">{l.objeto}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Propostas até <strong>{dataHoraFmt(l.dataEncerramento)}</strong> ·
                              Valor {valorFmt(l.valorEstimado)}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2 sm:flex-col">
                            <Button
                              size="sm"
                              className="gap-1"
                              disabled={ja || adicionando === l.id}
                              onClick={() => void acompanhar(l.id)}
                            >
                              {adicionando === l.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : ja ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <Plus className="h-3.5 w-3.5" />
                              )}
                              {ja ? "Acompanhando" : "Acompanhar"}
                            </Button>
                            {l.link && (
                              <Button asChild size="sm" variant="outline" className="gap-1">
                                <a href={l.link} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3.5 w-3.5" /> Ver
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
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
              </>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-3 pt-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Nº da licitação no Licitações-e</Label>
                <Input
                  value={manual.numeroLicitacao}
                  onChange={(e) => setManual({ ...manual, numeroLicitacao: e.target.value })}
                  placeholder="Ex.: 1100745"
                />
              </div>
              <div className="space-y-1">
                <Label>Data/hora da disputa (limite de propostas)</Label>
                <Input
                  type="datetime-local"
                  value={manual.dataDisputa}
                  onChange={(e) => setManual({ ...manual, dataDisputa: e.target.value })}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Órgão comprador</Label>
                <Input
                  value={manual.orgao}
                  onChange={(e) => setManual({ ...manual, orgao: e.target.value })}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Objeto</Label>
                <Textarea
                  value={manual.objeto}
                  onChange={(e) => setManual({ ...manual, objeto: e.target.value })}
                  className="min-h-[70px]"
                />
              </div>
              <div className="space-y-1">
                <Label>UF</Label>
                <select
                  value={manual.uf}
                  onChange={(e) => setManual({ ...manual, uf: e.target.value })}
                  className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">—</option>
                  {UFS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Link da licitação (opcional)</Label>
                <Input
                  value={manual.link}
                  onChange={(e) => setManual({ ...manual, link: e.target.value })}
                />
              </div>
            </div>
            <Button
              className="w-full gap-1.5"
              disabled={salvandoManual}
              onClick={() => void salvarManual()}
            >
              {salvandoManual ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Adicionar ao acompanhamento
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
