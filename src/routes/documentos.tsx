import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  CheckCircle2,
  Building2,
  Loader2,
  Bot,
  AlertTriangle,
  Lock,
  Receipt,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageContainer } from "@/components/page-header";
import { SaudeDocumentalCard } from "@/components/saude-documental-card";
import { NIVEIS_SICAF, type EmpresaData } from "@/lib/empresas-shared";
import { resolveEmpresaPorCnpj } from "@/lib/documentos-api";
import { fetchEmpresaGerenciar, type EmpresaGerenciarPainel } from "@/lib/empresas-api";
import { pagamentoSicafConfirmado } from "@/lib/sicaf-page-api";
import { SelecionarEmpresaModal } from "@/components/selecionar-empresa-modal";
import { toast } from "sonner";

type DocSearch = { cnpj?: string };

export const Route = createFileRoute("/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos da empresa — CADBRASIL" },
      { name: "description", content: "Acompanhe a validação dos níveis SICAF no Assistente." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): DocSearch => ({
    cnpj: typeof search.cnpj === "string" ? search.cnpj : undefined,
  }),
  component: DocsPage,
});

function mapSicafFromStatus(status?: string): EmpresaData["sicaf"] {
  const s = String(status || "").toLowerCase();
  if (s === "ativo") return "ativo";
  if (s === "vencendo") return "atencao";
  if (s === "vencido") return "vencido";
  return "sem_cadastro";
}

function nivelStatus(
  niveisDetail: EmpresaGerenciarPainel["niveisDetail"] | undefined,
  num: number,
  roman: string,
) {
  const raw = String(niveisDetail?.[roman]?.status || niveisDetail?.[String(num)]?.status || "")
    .toLowerCase()
    .trim();
  return raw;
}

function nivelValidado(status: string) {
  return status === "validado" || status === "vencendo";
}

function DocsPage() {
  const { cnpj } = Route.useSearch();
  const navigate = useNavigate();
  const [empresa, setEmpresa] = useState<EmpresaData | null>(null);
  const [niveisDetail, setNiveisDetail] = useState<EmpresaGerenciarPainel["niveisDetail"]>();
  const [pagamentoConfirmado, setPagamentoConfirmado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimaVerificacao, setUltimaVerificacao] = useState<string | null>(null);
  const [selecionarEmpresaOpen, setSelecionarEmpresaOpen] = useState(false);

  const recarregar = async (cnpjBusca?: string) => {
    setLoading(true);
    setErro(null);
    const resolved = await resolveEmpresaPorCnpj(cnpjBusca || cnpj || "");
    if (!resolved.ok || !resolved.empresa?.clienteId) {
      const msg = resolved.error || "Selecione uma empresa para ver os níveis SICAF";
      setErro(msg);
      setEmpresa(null);
      if (cnpjBusca || cnpj) toast.error(msg);
      setLoading(false);
      return;
    }
    const clienteId = resolved.empresa.clienteId;
    const gerenciar = await fetchEmpresaGerenciar(clienteId);
    if (!gerenciar.ok || !gerenciar.painel) {
      toast.error(gerenciar.error || "Erro ao carregar níveis SICAF");
      setLoading(false);
      return;
    }
    const painel = gerenciar.painel;
    setPagamentoConfirmado(pagamentoSicafConfirmado(painel));
    setNiveisDetail(painel.niveisDetail);
    const emp: EmpresaData = {
      ...resolved.empresa,
      nome: painel.cliente?.razaoSocial || resolved.empresa.nome,
      cnpj: painel.cliente?.documento || resolved.empresa.cnpj,
      email: painel.cliente?.email || resolved.empresa.email,
      telefone: painel.cliente?.telefone || resolved.empresa.telefone,
      endereco: painel.cliente?.endereco || resolved.empresa.endereco,
      cidade: painel.cliente?.cidade || resolved.empresa.cidade,
      uf: painel.cliente?.estado || resolved.empresa.uf,
      sicaf: mapSicafFromStatus(painel.sicaf?.status),
      proximoPasso: "",
      acao: resolved.empresa.acao,
    };
    setEmpresa(emp);
    setUltimaVerificacao(
      new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    );
    setLoading(false);
  };

  useEffect(() => {
    void recarregar(cnpj);
  }, [cnpj]);

  const saudeStats = useMemo(() => {
    let validas = 0;
    let vencendo = 0;
    let vencidas = 0;
    let pendentes = 0;
    for (const nivel of NIVEIS_SICAF) {
      const st = nivelStatus(niveisDetail, nivel.num, nivel.roman);
      if (st === "validado") validas += 1;
      else if (st === "vencendo") {
        validas += 1;
        vencendo += 1;
      } else if (st === "vencido") vencidas += 1;
      else pendentes += 1;
    }
    const total = NIVEIS_SICAF.length;
    const score = Math.round((validas / total) * 100);
    return {
      score,
      total,
      validas,
      vencendo,
      vencidas,
      pendentes,
      ultimaVerificacao,
      labelMonitorado: `${validas} de ${total} níveis SICAF validados`,
    };
  }, [niveisDetail, ultimaVerificacao]);

  const irAssistente = () => {
    if (!pagamentoConfirmado) {
      toast.error("Confirme o pagamento da taxa CADBRASIL para acessar o Assistente.");
      void navigate({
        to: "/sicaf",
        search: empresa?.cnpj ? { cnpj: empresa.cnpj.replace(/\D/g, "") } : {},
      });
      return;
    }
    void navigate({
      to: "/assistente",
      search: empresa?.cnpj ? { cnpj: empresa.cnpj.replace(/\D/g, "") } : {},
    });
  };

  const selecionarEmpresa = (empresaSelecionada: { cnpj: string }) => {
    void navigate({
      to: "/documentos",
      search: { cnpj: empresaSelecionada.cnpj },
    });
  };

  const cnpjSearch = empresa?.cnpj ? empresa.cnpj.replace(/\D/g, "") : undefined;

  return (
    <>
      <PageContainer>
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Carregando níveis SICAF da empresa...</p>
          </div>
        ) : !empresa ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">
              {cnpj ? erro || "Empresa não encontrada" : "Selecione uma empresa para ver os níveis SICAF"}
            </p>
            <p className="max-w-md text-xs text-muted-foreground">
              {cnpj
                ? `Não foi possível localizar o CNPJ ${cnpj}. Verifique o cadastro ou escolha outra empresa.`
                : "Escolha uma empresa cadastrada para acompanhar a validação dos níveis no Assistente."}
            </p>
            <Button onClick={() => setSelecionarEmpresaOpen(true)}>Selecionar empresa</Button>
          </div>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="mb-3 -ml-2 gap-1"
              onClick={() => setSelecionarEmpresaOpen(true)}
            >
              <ArrowLeft className="h-4 w-4" />
              Trocar empresa
            </Button>

            <PageHeader
              icon={<FileText className="h-5 w-5" />}
              title="Níveis SICAF"
              subtitle={<span className="font-mono text-sm">CNPJ {empresa.cnpj}</span>}
            />

            {!pagamentoConfirmado && (
              <Card className="mt-4 overflow-hidden border-warning/50 bg-gradient-to-br from-warning/15 via-warning/5 to-transparent">
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warning/20 text-warning-foreground">
                    <Lock className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Badge className="gap-1 border-warning/40 bg-warning/20 text-warning-foreground hover:bg-warning/25">
                      <AlertTriangle className="h-3 w-3" />
                      Assistente bloqueado
                    </Badge>
                    <p className="mt-2 text-sm font-semibold leading-snug">
                      Pagamento da taxa SICAF não confirmado
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      Regularize o pagamento para abrir o Assistente e validar os níveis no Compras.gov.br.
                    </p>
                    <Button
                      size="sm"
                      className="mt-4 gap-1.5"
                      onClick={() => void navigate({ to: "/sicaf", search: { cnpj: empresa.cnpj } })}
                    >
                      <Receipt className="h-4 w-4" />
                      Regularizar pagamento SICAF
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="mt-4">
              <SaudeDocumentalCard
                stats={saudeStats}
                cnpj={empresa.cnpj}
                assistenteDisponivel={pagamentoConfirmado}
                onAssistenteBloqueado={irAssistente}
              />
            </div>

            <div className="mt-6 space-y-3">
              {NIVEIS_SICAF.map((nivel) => {
                const st = nivelStatus(niveisDetail, nivel.num, nivel.roman);
                const validado = nivelValidado(st);
                return (
                  <Card key={nivel.num} className="overflow-hidden">
                    <CardHeader className="border-b bg-muted/30 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                            style={{ backgroundColor: nivel.color }}
                          >
                            {nivel.roman}
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="truncate text-base font-semibold">
                              Nível {nivel.roman} — {nivel.nome}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                              {validado
                                ? st === "vencendo"
                                  ? "Validado · vence em breve"
                                  : "Validado no Assistente"
                                : "Ainda não validado — use o Assistente"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {validado ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Validado
                            </span>
                          ) : (
                            <>
                              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning-foreground">
                                <AlertTriangle className="h-3.5 w-3.5" /> Não validado
                              </span>
                              {pagamentoConfirmado ? (
                                <Button asChild size="sm" className="gap-1.5">
                                  <Link to="/assistente" search={{ cnpj: cnpjSearch }}>
                                    <Bot className="h-3.5 w-3.5" />
                                    Abrir Assistente
                                  </Link>
                                </Button>
                              ) : (
                                <Button size="sm" className="gap-1.5" onClick={irAssistente}>
                                  <Bot className="h-3.5 w-3.5" />
                                  Abrir Assistente
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </PageContainer>

      <SelecionarEmpresaModal
        open={selecionarEmpresaOpen}
        onOpenChange={setSelecionarEmpresaOpen}
        empresaAtualCnpj={empresa?.cnpj ?? cnpj}
        titulo="Selecionar empresa"
        descricao="Escolha a empresa para acompanhar a validação dos níveis SICAF."
        onSelect={selecionarEmpresa}
      />
    </>
  );
}
