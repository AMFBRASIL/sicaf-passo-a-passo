import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  ExternalLink,
  FileText,
  Info,
  Landmark,
  LineChart,
  Loader2,
  Search,
  Sparkles,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageContainer, PageHeader } from "@/components/page-header";
import {
  fetchConcorrenciaBusca,
  formatBRL,
  formatCnpjInput,
  type ConcorrenciaBuscaResponse,
  type ConcorrenciaGrupo,
} from "@/lib/concorrencia-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/concorrencia")({
  head: () => ({
    meta: [
      { title: "Concorrência — CADBRASIL" },
      {
        name: "description",
        content: "Analise contratos públicos executados por empresas concorrentes via PNCP.",
      },
    ],
  }),
  component: ConcorrenciaPage,
});

function GrupoCard({
  titulo,
  icon,
  itens,
  valorDestaque = false,
}: {
  titulo: string;
  icon: React.ReactNode;
  itens: ConcorrenciaGrupo[];
  valorDestaque?: boolean;
}) {
  const maxQtd = Math.max(...itens.map((i) => i.quantidade), 1);

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          {icon}
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados para exibir.</p>
        ) : (
          itens.map((item) => (
            <div key={`${titulo}-${item.nome}`} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 text-sm font-medium leading-snug">{item.nome}</p>
                <Badge variant="secondary" className="shrink-0 font-mono text-[11px]">
                  {item.quantidade}
                </Badge>
              </div>
              <div className="space-y-1">
                <Progress value={(item.quantidade / maxQtd) * 100} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{item.percentual}% dos contratos</span>
                  <span className="font-semibold text-foreground">
                    {valorDestaque ? formatBRL(item.valor) : formatBRL(item.valor)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function KpiCard({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "default" | "primary" | "success";
}) {
  return (
    <Card className="overflow-hidden shadow-soft">
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
            tone === "primary" && "bg-primary/10 text-primary",
            tone === "success" && "bg-success/10 text-success",
            tone === "default" && "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ConcorrenciaPage() {
  const [cnpjInput, setCnpjInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ConcorrenciaBuscaResponse | null>(null);

  const cnpjDigits = useMemo(() => cnpjInput.replace(/\D/g, ""), [cnpjInput]);
  const podeBuscar = cnpjDigits.length === 14;

  async function buscar() {
    if (!podeBuscar) {
      toast.error("Informe um CNPJ válido com 14 dígitos.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetchConcorrenciaBusca(cnpjDigits);
      if (!res.ok) {
        setResultado(null);
        toast.error(res.error || "Nenhum contrato encontrado para este CNPJ.");
        return;
      }
      setResultado(res);
    } catch (e) {
      setResultado(null);
      toast.error(e instanceof Error ? e.message : "Erro ao consultar concorrência.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        icon={<Users className="h-6 w-6" />}
        title="Buscar contratos dos Concorrentes"
        subtitle="Pesquise e analise empresas concorrentes com inteligência de mercado a partir dos dados do PNCP."
      />

      <Card className="mt-6 border-sky-200/80 bg-gradient-to-r from-sky-50 to-blue-50/80 shadow-soft dark:border-sky-900/40 dark:from-sky-950/30 dark:to-blue-950/20">
        <CardContent className="flex gap-3 p-4 sm:p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-700 dark:text-sky-300">
            <Info className="h-5 w-5" />
          </div>
          <div className="min-w-0 text-sm leading-relaxed text-sky-950/90 dark:text-sky-100/90">
            <p className="font-semibold">Inteligência competitiva para licitações</p>
            <p className="mt-1 text-sky-900/80 dark:text-sky-100/75">
              Informe o CNPJ de um concorrente para visualizar o histórico consolidado de contratos
              públicos no Portal da Transparência e PNCP: valores totais, órgãos contratantes, modalidades de contratação e
              distribuição por órgãos superiores.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5 text-primary" />
            Buscar Concorrente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={cnpjInput}
              onChange={(e) => setCnpjInput(formatCnpjInput(e.target.value))}
              placeholder="00.000.000/0000-00"
              className="h-12 text-base font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter") void buscar();
              }}
            />
            <Button
              size="lg"
              className="h-12 shrink-0 gap-2 px-6"
              disabled={!podeBuscar || loading}
              onClick={() => void buscar()}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </Button>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Consulta ao vivo no Portal da Transparência (contratos federais) e PNCP.
          </p>
        </CardContent>
      </Card>

      {loading && (
        <div className="mt-10 flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Analisando contratos públicos do concorrente...</p>
        </div>
      )}

      {!loading && resultado?.ok && resultado.empresa && resultado.kpis && (
        <div className="mt-8 space-y-6">
          <Card className="overflow-hidden border-primary/20 shadow-lift">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Concorrente</Badge>
                  <Badge variant="outline">{resultado.empresa.fonteDados}</Badge>
                </div>
                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  {resultado.empresa.razaoSocial}
                </h2>
                <p className="mt-1 font-mono text-sm text-muted-foreground">
                  CNPJ: {resultado.empresa.cnpj}
                </p>
                {(resultado.empresa.municipio || resultado.empresa.uf) && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[resultado.empresa.municipio, resultado.empresa.uf].filter(Boolean).join(" / ")}
                  </p>
                )}
              </div>
              {resultado.links?.portalTransparencia && (
                <Button asChild variant="outline" className="shrink-0 gap-2">
                  <a href={resultado.links.portalTransparencia} target="_blank" rel="noopener noreferrer">
                    Portal da Transparência
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Contratos"
              value={String(resultado.kpis.totalContratos)}
              icon={<FileText className="h-5 w-5" />}
              tone="primary"
            />
            <KpiCard
              label="Valor Total"
              value={formatBRL(resultado.kpis.valorTotal)}
              icon={<Wallet className="h-5 w-5" />}
              tone="success"
            />
            <KpiCard
              label="Valor Médio"
              value={formatBRL(resultado.kpis.valorMedio)}
              icon={<LineChart className="h-5 w-5" />}
            />
            <KpiCard
              label="Órgãos"
              value={String(resultado.kpis.totalOrgaos)}
              icon={<Building2 className="h-5 w-5" />}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <GrupoCard
              titulo="Órgãos Contratantes"
              icon={<Building2 className="h-4 w-4 text-primary" />}
              itens={resultado.orgaos || []}
              valorDestaque
            />
            <GrupoCard
              titulo="Modalidades de Contratação"
              icon={<Target className="h-4 w-4 text-primary" />}
              itens={resultado.modalidades || []}
              valorDestaque
            />
            <GrupoCard
              titulo="Ministérios / Órgãos Superiores"
              icon={<Landmark className="h-4 w-4 text-primary" />}
              itens={resultado.ministerios || []}
              valorDestaque
            />
          </div>

          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Contratos identificados</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Últimos contratos públicos vinculados ao CNPJ pesquisado.
                </p>
              </div>
              <Badge variant="secondary">{resultado.contratos?.length || 0} exibidos</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {(resultado.contratos || []).map((contrato) => (
                  <div key={contrato.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug">
                        {contrato.orgao || "Órgão não informado"}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {contrato.objeto || "Objeto não informado"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline">{contrato.modalidade}</Badge>
                        {contrato.situacao && <Badge variant="secondary">{contrato.situacao}</Badge>}
                        {contrato.numeroContrato && (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {contrato.numeroContrato}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <p className="text-lg font-bold text-primary">{formatBRL(contrato.valor)}</p>
                      <p className="text-xs text-muted-foreground">
                        {contrato.dataAssinatura
                          ? `Assinatura: ${contrato.dataAssinatura}`
                          : contrato.dataPublicacao
                            ? `Publicação: ${contrato.dataPublicacao}`
                            : "Data não informada"}
                      </p>
                      {contrato.urlPncp && (
                        <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
                          <a href={contrato.urlPncp} target="_blank" rel="noopener noreferrer">
                            Ver detalhes
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && !resultado && (
        <Card className="mt-8 border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-semibold">Comece pela busca de um CNPJ</p>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Descubra onde seus concorrentes estão ganhando contratos, com quais órgãos trabalham
                e qual o volume financeiro movimentado.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && resultado && !resultado.ok && (
        <Card className="mt-8 border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">Nenhum resultado encontrado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {resultado.error || "Tente outro CNPJ ou verifique se a empresa possui contratos públicos."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
