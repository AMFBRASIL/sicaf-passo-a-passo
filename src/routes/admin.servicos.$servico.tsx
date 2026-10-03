import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  MessagesSquare,
  RefreshCw,
  Send,
  Target,
  Telescope,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  atualizarBaseFornecedores,
  baixarPublico,
  fetchServicoDetalhe,
  type Campanha,
  type FornecedoresStatus,
  type Rotina,
  type Segmento,
  type ServicoDetalhe,
  type ServicoKpis,
} from "@/lib/admin-servicos-captacao-api";
import {
  ICONE_SERVICO,
  TIPO_SEGMENTO,
  UFS,
  dataHora,
  moeda,
  numero,
} from "@/components/admin/captacao/servicos-visual";
import { EmailMassaPanel } from "@/components/admin/captacao/email-massa-panel";
import { ContatosPanel } from "@/components/admin/captacao/contatos-panel";
import { CampanhasPanel } from "@/components/admin/captacao/campanhas-panel";
import { RotinasPanel } from "@/components/admin/captacao/rotinas-panel";
import { EnvioLogModal } from "@/components/admin/captacao/envio-log-modal";

export const Route = createFileRoute("/admin/servicos/$servico")({
  component: ServicoCaptacaoPage,
});

type Detalhe = {
  servico: ServicoDetalhe;
  kpis: ServicoKpis;
  segmentos: Segmento[];
  fornecedores: FornecedoresStatus;
  campanhas: Campanha[];
  rotinas: Rotina[];
};

const COOLDOWNS = [
  { value: "0", label: "Pode repetir" },
  { value: "7", label: "Não repetir por 7 dias" },
  { value: "15", label: "Não repetir por 15 dias" },
  { value: "30", label: "Não repetir por 30 dias" },
];

function ServicoCaptacaoPage() {
  const { servico: servicoId } = Route.useParams();
  const [dados, setDados] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uf, setUf] = useState("");
  const [cooldown, setCooldown] = useState("7");
  const [segmentoId, setSegmentoId] = useState<string | null>(null);
  const [aba, setAba] = useState("email");
  const [exportando, setExportando] = useState<"padrao" | "google" | null>(null);
  const [logId, setLogId] = useState<number | null>(null);
  const [atualizandoForn, setAtualizandoForn] = useState(false);

  const carregar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setLoading(true);
      const res = await fetchServicoDetalhe(servicoId, { uf, cooldown: Number(cooldown) });
      if (!silencioso) setLoading(false);
      if (!res.ok) {
        if (!silencioso) setErro(res.error);
        return;
      }
      setErro(null);
      setDados({
        servico: res.servico,
        kpis: res.kpis,
        segmentos: res.segmentos,
        fornecedores: res.fornecedores,
        campanhas: res.campanhas,
        rotinas: res.rotinas,
      });
      setSegmentoId((atual) =>
        atual && res.segmentos.some((s) => s.id === atual) ? atual : (res.segmentos[0]?.id ?? null),
      );
    },
    [servicoId, uf, cooldown],
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const emAndamento = dados?.campanhas.some(
    (c) => c.status === "enviando" || c.status === "agendada",
  );
  useEffect(() => {
    if (aba !== "campanhas" || !emAndamento) return;
    const t = window.setInterval(() => void carregar(true), 15000);
    return () => window.clearInterval(t);
  }, [aba, emAndamento, carregar]);

  const segmento = useMemo(
    () => dados?.segmentos.find((s) => s.id === segmentoId) ?? null,
    [dados, segmentoId],
  );

  const recarregarSilencioso = useCallback(() => void carregar(true), [carregar]);

  const atualizarFornecedores = async () => {
    setAtualizandoForn(true);
    const res = await atualizarBaseFornecedores();
    setAtualizandoForn(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Base de fornecedores atualizada: ${numero(res.fornecedores.total)} empresas`);
    void carregar(true);
  };

  const exportar = async (formato: "padrao" | "google") => {
    if (!segmento) return;
    setExportando(formato);
    const res = await baixarPublico(servicoId, {
      segmento: segmento.id,
      uf: uf || undefined,
      cooldown: Number(cooldown) || undefined,
      formato,
    });
    setExportando(null);
    if (!res.ok) toast.error(res.error);
    else toast.success(`${numero(res.total)} registros exportados`);
  };

  if (erro && !dados) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Link
          to="/admin/servicos"
          className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Serviços
        </Link>
        <Card className="p-8 text-center text-muted-foreground">{erro}</Card>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const { servico, kpis } = dados;
  const Icon = ICONE_SERVICO[servico.id];
  const ativas = dados.campanhas.filter(
    (c) => c.status === "enviando" || c.status === "agendada",
  ).length;
  const rotinasAtivas = dados.rotinas.filter((r) => r.ativa).length;
  const segClientes = dados.segmentos.filter((s) => s.base !== "fornecedores");
  const segFornecedores = dados.segmentos.filter((s) => s.base === "fornecedores");
  const prospeccao = segmento?.base === "fornecedores";
  const totalExportavel = segmento
    ? prospeccao
      ? Math.max(segmento.totalTelefone || 0, segmento.total)
      : segmento.total
    : 0;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <Link
          to="/admin/servicos"
          className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Serviços
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ background: servico.cor }}
            >
              <Icon className="h-7 w-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{servico.nome}</h1>
                <Badge variant="secondary">{servico.preco.texto}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{servico.abrangencia}</p>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{servico.resumo}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={servico.rota} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Página no portal
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={servico.ativoLabel} valor={numero(kpis.ativos)} />
        <Kpi label={servico.andamentoLabel} valor={numero(kpis.andamento)} />
        <Kpi label="Vendas pagas (30 dias)" valor={numero(kpis.vendas30d)} />
        <Kpi label="Receita (30 dias)" valor={moeda(kpis.receita30d)} />
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Target className="h-5 w-5 text-primary" />
              1. Escolha o público
            </h2>
            <p className="text-xs text-muted-foreground">
              Contagem de clientes com e-mail válido, já sem os descadastrados.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={uf || "todas"} onValueChange={(v) => setUf(v === "todas" ? "" : v)}>
              <SelectTrigger className="h-9 w-36 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as UFs</SelectItem>
                {UFS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={cooldown} onValueChange={setCooldown}>
              <SelectTrigger className="h-9 w-52 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COOLDOWNS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${loading ? "opacity-60" : ""}`}>
          {segClientes.map((s) => (
            <SegmentoCard
              key={s.id}
              segmento={s}
              ativo={s.id === segmentoId}
              cor={servico.cor}
              onClick={() => setSegmentoId(s.id)}
            />
          ))}
        </div>

        {segFornecedores.length > 0 && (
          <div className="space-y-3 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 font-semibold">
                  <Telescope className="h-4 w-4 text-emerald-700" />
                  Sugestão: prospectar fornecedores da base
                </h3>
                <p className="max-w-2xl text-xs text-muted-foreground">
                  Empresas que já vendem ao governo (cadastro público Compras.gov.br / PNCP) e ainda
                  não são clientes CADBRASIL. Elas também podem receber o e-mail marketing de{" "}
                  {servico.sigla}, com um texto de apresentação.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {numero(dados.fornecedores.total)} empresas com contato · atualizada{" "}
                  {dataHora(dados.fornecedores.atualizadoEm)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={atualizandoForn || dados.fornecedores.atualizando}
                  onClick={() => void atualizarFornecedores()}
                >
                  {atualizandoForn || dados.fornecedores.atualizando ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Atualizar base
                </Button>
              </div>
            </div>
            <div
              className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${loading ? "opacity-60" : ""}`}
            >
              {segFornecedores.map((s) => (
                <SegmentoCard
                  key={s.id}
                  segmento={s}
                  ativo={s.id === segmentoId}
                  cor={servico.cor}
                  onClick={() => setSegmentoId(s.id)}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {segmento && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Send className="h-5 w-5 text-primary" />
            2. Escolha a ferramenta
          </h2>
          <Tabs value={aba} onValueChange={setAba}>
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="email" className="gap-1.5">
                <Mail className="h-4 w-4" />
                E-mail em massa
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="gap-1.5">
                <MessageCircle className="h-4 w-4" />
                WhatsApp e ligações
              </TabsTrigger>
              <TabsTrigger value="exportar" className="gap-1.5">
                <Download className="h-4 w-4" />
                Exportar / anúncios
              </TabsTrigger>
              <TabsTrigger value="campanhas" className="gap-1.5">
                <Send className="h-4 w-4" />
                Campanhas e rotinas
                {ativas + rotinasAtivas > 0 && (
                  <span className="rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white">
                    {ativas + rotinasAtivas}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="roteiro" className="gap-1.5">
                <MessagesSquare className="h-4 w-4" />
                Roteiro de vendas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="mt-4">
              <EmailMassaPanel
                key={segmento.id}
                servico={servico}
                segmento={segmento}
                uf={uf}
                cooldown={Number(cooldown)}
                onCampanhaCriada={(id) => {
                  setAba("campanhas");
                  setLogId(id);
                  void carregar(true);
                }}
                onRotinaCriada={() => void carregar(true)}
                onIrParaAba={setAba}
              />
            </TabsContent>

            <TabsContent value="whatsapp" className="mt-4">
              <ContatosPanel key={segmento.id} servico={servico} segmento={segmento} uf={uf} />
            </TabsContent>

            <TabsContent value="exportar" className="mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="space-y-3 p-5">
                  <h3 className="font-semibold">Planilha do público</h3>
                  <p className="text-sm text-muted-foreground">
                    Empresa, CNPJ, responsável, e-mail, telefone, cidade e UF de quem está em “
                    {segmento.nome}” e tem e-mail ou telefone. Abre direto no Excel.
                  </p>
                  <Button
                    onClick={() => void exportar("padrao")}
                    disabled={!!exportando || !totalExportavel}
                  >
                    {exportando === "padrao" ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-1.5 h-4 w-4" />
                    )}
                    Baixar planilha (CSV)
                  </Button>
                </Card>
                <Card className="space-y-3 p-5">
                  <h3 className="font-semibold">Público para anúncios</h3>
                  <p className="text-sm text-muted-foreground">
                    Arquivo no formato Customer Match: suba no Google Ads (Gerenciador de públicos)
                    ou no Meta Ads (Público personalizado) para mostrar anúncios de {servico.sigla}{" "}
                    só para essas empresas — ou criar públicos semelhantes.
                    {prospeccao &&
                      " Para fornecedores o arquivo vai com telefone, já que a base pública não traz e-mail."}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => void exportar("google")}
                    disabled={!!exportando || !totalExportavel}
                  >
                    {exportando === "google" ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-1.5 h-4 w-4" />
                    )}
                    Baixar para Google / Meta Ads
                  </Button>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="campanhas" className="mt-4 space-y-6">
              {dados.rotinas.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Rotinas agendadas deste serviço</h3>
                  <RotinasPanel
                    rotinas={dados.rotinas}
                    onAtualizar={recarregarSilencioso}
                    onVerLog={setLogId}
                  />
                </div>
              )}
              <div className="space-y-2">
                {dados.rotinas.length > 0 && <h3 className="text-sm font-semibold">Envios</h3>}
                <CampanhasPanel
                  campanhas={dados.campanhas}
                  onAtualizar={recarregarSilencioso}
                  onVerLog={setLogId}
                />
              </div>
            </TabsContent>

            <TabsContent value="roteiro" className="mt-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="space-y-4 p-5">
                  <div>
                    <h3 className="font-semibold">Como apresentar</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{servico.pitch.gancho}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">Argumentos</h4>
                    <ul className="mt-2 space-y-2">
                      {servico.pitch.argumentos.map((a) => (
                        <li key={a} className="flex gap-2 text-sm">
                          <CheckCircle2
                            className="mt-0.5 h-4 w-4 shrink-0"
                            style={{ color: servico.cor }}
                          />
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">O que o cliente recebe</h4>
                    <ul className="mt-2 space-y-1.5">
                      {servico.beneficios.map((b) => (
                        <li key={b} className="text-sm text-muted-foreground">
                          • {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
                <Card className="space-y-3 p-5">
                  <h3 className="font-semibold">Objeções comuns</h3>
                  {servico.pitch.objecoes.map((o) => (
                    <div key={o.pergunta} className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-sm font-semibold">“{o.pergunta}”</p>
                      <p className="mt-1 text-sm text-muted-foreground">{o.resposta}</p>
                    </div>
                  ))}
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </section>
      )}

      <EnvioLogModal
        campanhaId={logId}
        onClose={() => setLogId(null)}
        onAtualizar={recarregarSilencioso}
      />
    </div>
  );
}

function SegmentoCard({
  segmento: s,
  ativo,
  cor,
  onClick,
}: {
  segmento: Segmento;
  ativo: boolean;
  cor: string;
  onClick: () => void;
}) {
  const tipo = TIPO_SEGMENTO[s.tipo];
  const TipoIcon = tipo.icon;
  const prospeccao = s.base === "fornecedores";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-xl border bg-card p-4 text-left transition-all hover:shadow-md ${
        ativo ? "ring-2 ring-offset-1" : "hover:border-foreground/20"
      }`}
      style={ativo ? ({ "--tw-ring-color": cor } as CSSProperties) : undefined}
    >
      {ativo && <CheckCircle2 className="absolute right-3 top-3 h-4 w-4" style={{ color: cor }} />}
      <Badge variant="outline" className={`gap-1 ${tipo.classe}`} title={tipo.dica}>
        <TipoIcon className="h-3 w-3" />
        {tipo.label}
      </Badge>
      <p className="mt-2 pr-5 text-sm font-semibold leading-snug">{s.nome}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{s.descricao}</p>
      {prospeccao ? (
        <div className="mt-3 flex items-end gap-4">
          <p className="text-2xl font-bold tracking-tight">
            {numero(s.totalTelefone || 0)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">com telefone</span>
          </p>
          <p className="pb-0.5 text-sm font-semibold">
            {numero(s.total)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">com e-mail</span>
          </p>
        </div>
      ) : (
        <p className="mt-3 text-2xl font-bold tracking-tight">
          {numero(s.total)}
          <span className="ml-1 text-xs font-normal text-muted-foreground">clientes</span>
        </p>
      )}
    </button>
  );
}

function Kpi({ label, valor }: { label: string; valor: string }) {
  return (
    <Card className="p-4">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{valor}</p>
    </Card>
  );
}
