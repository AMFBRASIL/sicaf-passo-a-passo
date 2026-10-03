import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Barcode,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Hourglass,
  Info,
  Loader2,
  Lock,
  MessageCircle,
  QrCode,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { SelecionarEmpresaModal } from "@/components/selecionar-empresa-modal";
import { BoletoGeradoPanel } from "@/components/sicaf/BoletoGeradoPanel";
import { PixPaymentModal } from "@/components/sicaf/PixPaymentModal";
import {
  PagamentoServicoModal,
  type PagamentoServicoInfo,
} from "@/components/pagamento-servico-modal";
import { fetchEmpresas } from "@/lib/empresas-api";
import { resolveEmpresaPorCnpj } from "@/lib/documentos-api";
import type { EmpresaData } from "@/lib/empresas-shared";
import { apiFetch } from "@/lib/api-fetch";
import { buildWhatsAppSuporteUrl } from "@/lib/whatsapp-suporte";
import {
  definirEscolhaAssessoria,
  enviarAnaliseAssessoria,
  enviarDocumentoAssessoria,
  enviarTermoAssinado,
  fetchAssessoriaPainel,
  gerarCobrancaAssessoria,
  removerDocumentoAssessoria,
  type AssessoriaDocumento,
  type AssessoriaPagamento,
  type AssessoriaPainel,
  type AssessoriaPortal,
  type AssessoriaStatus,
  type AssessoriaTermo,
} from "@/lib/assessoria-portal-api";
import { useMarcarServicoVisto } from "@/lib/servicos-novidades-api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Aviso = { icon: typeof Info; titulo: string; texto: string };

export type AssessoriaPortalConfig = {
  portal: AssessoriaPortal;
  /** Nome curto do portal nos textos (ex.: "CAUFESP"). */
  nome: string;
  titulo: string;
  subtitulo: string;
  icon: ReactNode;
  statusLabel: Record<AssessoriaStatus, string>;
  /** Títulos das 6 etapas exibidas na linha do tempo. */
  passos: [string, string, string, string, string, string];
  avisos: Aviso[];
  semPrazo: string;
  pagamento: {
    rotulo: string;
    itens: string[];
    observacao?: ReactNode;
  };
  escolha: {
    pergunta: string;
    ajuda: string;
    opcoes: { id: string; label: string; hint: string }[];
    pendente: string;
  };
  grupos: { id: string; label: string }[];
  rotuloCondicional?: string;
  notaDocumentos: string;
  textoEnviado: string;
  etapas: {
    conferencia: string;
    protocolo: string;
    analise: string;
    aprovado: string;
  };
  rotuloProtocolo: string;
  rotuloValidade: string;
  linkPortal: { href: string; label: string };
  whatsappContexto: string;
};

/** Etapa em andamento para cada status; 7 = tudo concluído. */
const ETAPA_POR_STATUS: Record<AssessoriaStatus, number> = {
  aguardando_pagamento: 1,
  documentacao: 2,
  pendencia_documentos: 2,
  conferencia_cadbrasil: 3,
  protocolado: 4,
  analise_governo: 5,
  exigencia_governo: 5,
  indeferido: 5,
  aprovado: 7,
};

const STATUS_ALERTA: AssessoriaStatus[] = [
  "pendencia_documentos",
  "exigencia_governo",
  "indeferido",
];

type ResultadoPainel = Awaited<ReturnType<typeof fetchAssessoriaPainel>>;
type Aplicar = (res: ResultadoPainel, sucesso?: string) => boolean;

function valorFmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataFmt(v?: string | null) {
  if (!v) return "";
  const iso = String(v).slice(0, 10);
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export function AssessoriaPortalPage({
  config,
  cnpj,
  onSelecionarCnpj,
}: {
  config: AssessoriaPortalConfig;
  cnpj?: string;
  onSelecionarCnpj: (cnpj: string, replace?: boolean) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [empresa, setEmpresa] = useState<EmpresaData | null>(null);
  const [painel, setPainel] = useState<AssessoriaPainel | null>(null);
  const [trocarOpen, setTrocarOpen] = useState(false);

  const { portal } = config;
  const clienteId = empresa?.clienteId ?? null;
  useMarcarServicoVisto(portal, painel ? clienteId : null);
  const scrollToEtapa = useCallback(
    (n: number) =>
      document
        .getElementById(`${portal}-etapa-${n}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    [portal],
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
        if (primeira) {
          onSelecionarCnpj(primeira.cnpj, true);
        } else {
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
      const p = await fetchAssessoriaPainel(portal, resolved.empresa.clienteId);
      if (cancelled) return;
      if (!p.ok) setErro(p.error);
      else setPainel(p);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cnpj, portal]);

  const recarregar = useCallback(async () => {
    if (!clienteId) return;
    const p = await fetchAssessoriaPainel(portal, clienteId);
    if (p.ok) setPainel(p);
  }, [clienteId, portal]);

  const aplicar: Aplicar = (res, sucesso) => {
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setPainel(res);
    if (sucesso) toast.success(sucesso);
    return true;
  };

  const header = (
    <PageHeader icon={config.icon} title={config.titulo} subtitle={config.subtitulo} />
  );

  if (loading) {
    return (
      <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 px-4 py-10">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando processo {config.nome}...</p>
      </div>
    );
  }

  if (!empresa || !painel || erro) {
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
          titulo={`Escolher empresa para o ${config.nome}`}
          onSelect={(e) => onSelecionarCnpj(e.cnpj)}
        />
      </div>
    );
  }

  const { processo } = painel;
  const etapaAtual = ETAPA_POR_STATUS[processo.status];
  const statusDe = (n: number): EtapaStatus =>
    n < etapaAtual ? "done" : n === etapaAtual ? "current" : "pending";
  const totalPassos = config.passos.length;
  const concluidas = Math.min(etapaAtual - 1, totalPassos);
  const alerta = STATUS_ALERTA.includes(processo.status);

  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-10 lg:px-8 xl:px-10 2xl:px-12">
      {header}

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm font-semibold">
                <span>Etapas do processo</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {concluidas}/{totalPassos}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ol className="relative">
                {config.passos.map((titulo, i) => {
                  const n = i + 1;
                  const status = statusDe(n);
                  const isLast = i === totalPassos - 1;
                  const atencao = status === "current" && alerta;
                  return (
                    <li key={n} className="relative pb-5 pl-9 last:pb-0">
                      {!isLast && (
                        <span
                          className={cn(
                            "absolute bottom-0 left-[14px] top-7 w-0.5",
                            status === "done" ? "bg-success" : "bg-border",
                          )}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => scrollToEtapa(n)}
                        className="group -ml-1 w-full rounded-lg py-0.5 pl-1 pr-2 text-left transition hover:bg-muted/40"
                      >
                        <span
                          className={cn(
                            "absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold",
                            status === "done" && "bg-success text-success-foreground",
                            status === "current" &&
                              (atencao
                                ? "bg-warning text-white ring-4 ring-warning/20"
                                : "animate-pulse bg-primary text-primary-foreground ring-4 ring-primary/20"),
                            status === "pending" && "bg-muted text-muted-foreground",
                          )}
                        >
                          {status === "done" ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : status === "pending" ? (
                            <Lock className="h-3 w-3" />
                          ) : (
                            n
                          )}
                        </span>
                        <div className={status === "pending" ? "opacity-60" : ""}>
                          <p
                            className={cn(
                              "text-[10px] font-semibold uppercase tracking-wider",
                              status === "done" && "text-success",
                              status === "current" &&
                                (atencao ? "text-warning-foreground" : "text-primary"),
                              status === "pending" && "text-muted-foreground",
                            )}
                          >
                            {status === "done"
                              ? "Concluída"
                              : status === "current"
                                ? atencao
                                  ? "Requer atenção"
                                  : "Em andamento"
                                : `Etapa ${n}`}
                          </p>
                          <p className="mt-0.5 text-xs font-semibold leading-tight">{titulo}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Etapas concluídas</span>
                <span className="font-semibold text-primary">
                  {concluidas} de {totalPassos}
                </span>
              </div>
              <Progress value={(concluidas / totalPassos) * 100} className="h-2.5" />
              <p className="flex items-start gap-1.5 pt-1 text-[11px] leading-snug text-muted-foreground">
                <Hourglass className="mt-0.5 h-3 w-3 shrink-0" />
                {config.semPrazo}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="space-y-3 p-4">
              <p className="text-sm font-semibold">Precisa de ajuda?</p>
              <p className="text-xs text-muted-foreground">
                Fale com a equipe CADBRASIL sobre o seu cadastro no {config.nome}.
              </p>
              <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
                <a
                  href={buildWhatsAppSuporteUrl(
                    `Olá! Estou na página ${config.whatsappContexto} do Portal CADBRASIL, empresa ${empresa.nome} (CNPJ ${empresa.cnpj}), e preciso de ajuda.`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="h-4 w-4" /> Falar no WhatsApp
                </a>
              </Button>
            </CardContent>
          </Card>
        </aside>

        <div className="min-w-0 space-y-5">
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
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-semibold",
                  processo.status === "aprovado" && "border-success/30 bg-success/10 text-success",
                  alerta && "border-warning/30 bg-warning/10 text-warning-foreground",
                )}
              >
                {config.statusLabel[processo.status]}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setTrocarOpen(true)}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Trocar empresa
              </Button>
            </div>
          </div>

          <Card className="border-sky-300/60 bg-sky-50/60 dark:border-sky-900/50 dark:bg-sky-950/20">
            <CardContent
              className={cn(
                "grid gap-4 p-4 sm:p-5",
                config.avisos.length > 2 ? "md:grid-cols-3" : "sm:grid-cols-2",
              )}
            >
              {config.avisos.map(({ icon: Icon, titulo, texto }) => (
                <div key={titulo} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
                  <div>
                    <p className="text-sm font-semibold">{titulo}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{texto}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {processo.observacaoCadbrasil && processo.status !== "aprovado" && (
            <Card
              className={cn(
                alerta ? "border-warning/40 bg-warning/5" : "border-primary/30 bg-primary/5",
              )}
            >
              <CardContent className="flex items-start gap-3 py-4">
                <Info
                  className={cn(
                    "mt-0.5 h-5 w-5 shrink-0",
                    alerta ? "text-warning" : "text-primary",
                  )}
                />
                <div>
                  <p className="text-sm font-semibold">Mensagem da equipe CADBRASIL</p>
                  <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">
                    {processo.observacaoCadbrasil}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <EtapaPagamento
            config={config}
            painel={painel}
            clienteId={empresa.clienteId!}
            documento={empresa.cnpj}
            nomeEmpresa={empresa.nome}
            status={statusDe(1)}
            onAtualizar={recarregar}
            onPago={() => scrollToEtapa(2)}
          />

          <EtapaDocumentos
            config={config}
            painel={painel}
            clienteId={empresa.clienteId!}
            status={statusDe(2)}
            alerta={
              processo.status === "pendencia_documentos" || processo.status === "exigencia_governo"
            }
            onAplicar={aplicar}
            onEnviado={() => scrollToEtapa(3)}
          />

          <EtapaInfo
            id={`${portal}-etapa-3`}
            n={3}
            titulo={config.passos[2]}
            status={statusDe(3)}
            icon={FileCheck2}
            texto={config.etapas.conferencia}
          />

          <EtapaInfo
            id={`${portal}-etapa-4`}
            n={4}
            titulo={config.passos[3]}
            status={statusDe(4)}
            icon={Send}
            texto={config.etapas.protocolo}
            extra={
              processo.protocoloPortal || (painel.termo && etapaAtual >= 4) ? (
                <div className="space-y-3">
                  {processo.protocoloPortal && (
                    <p className="text-sm">
                      {config.rotuloProtocolo}:{" "}
                      <strong className="font-mono">{processo.protocoloPortal}</strong>
                    </p>
                  )}
                  {painel.termo && etapaAtual >= 4 && (
                    <TermoCliente
                      portal={portal}
                      nomePortal={config.nome}
                      termo={painel.termo}
                      clienteId={empresa.clienteId!}
                      onAplicar={aplicar}
                    />
                  )}
                </div>
              ) : null
            }
          />

          <EtapaInfo
            id={`${portal}-etapa-5`}
            n={5}
            titulo={config.passos[4]}
            status={statusDe(5)}
            icon={Clock}
            alerta={processo.status === "exigencia_governo" || processo.status === "indeferido"}
            texto={config.etapas.analise}
          />

          <EtapaInfo
            id={`${portal}-etapa-6`}
            n={6}
            titulo={config.passos[5]}
            status={processo.status === "aprovado" ? "done" : "pending"}
            icon={ShieldCheck}
            texto={config.etapas.aprovado}
            extra={
              processo.status === "aprovado" ? (
                <div className="flex flex-wrap gap-2">
                  {processo.cadastroValidade && (
                    <Badge className="bg-success text-white hover:bg-success">
                      {config.rotuloValidade} {dataFmt(processo.cadastroValidade)}
                    </Badge>
                  )}
                  <Button asChild size="sm" variant="outline" className="gap-1.5">
                    <a href={config.linkPortal.href} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> {config.linkPortal.label}
                    </a>
                  </Button>
                </div>
              ) : null
            }
          />
        </div>
      </div>

      <SelecionarEmpresaModal
        open={trocarOpen}
        onOpenChange={setTrocarOpen}
        empresaAtualCnpj={empresa.cnpj}
        titulo="Trocar empresa"
        descricao={`Selecione a empresa para acompanhar o cadastro no ${config.nome}.`}
        onSelect={(e) => onSelecionarCnpj(e.cnpj)}
      />
    </div>
  );
}

type EtapaStatus = "done" | "current" | "pending";

function EtapaShell({
  id,
  n,
  titulo,
  status,
  alerta,
  icon: Icon,
  children,
}: {
  id: string;
  n: number;
  titulo: string;
  status: EtapaStatus;
  alerta?: boolean;
  icon: typeof Info;
  children: ReactNode;
}) {
  return (
    <Card
      id={id}
      className={cn(
        "scroll-mt-6 shadow-soft transition",
        status === "current" && !alerta && "border-primary/50 ring-1 ring-primary/20",
        status === "current" && alerta && "border-warning/50 ring-1 ring-warning/20",
        status === "pending" && "opacity-75",
      )}
    >
      <CardHeader className="border-b bg-muted/30 py-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                status === "done" && "bg-success text-white",
                status === "current" &&
                  (alerta ? "bg-warning text-white" : "bg-primary text-primary-foreground"),
                status === "pending" && "bg-muted text-muted-foreground",
              )}
            >
              {status === "done" ? <CheckCircle2 className="h-4 w-4" /> : n}
            </span>
            <Icon className="h-4 w-4 text-muted-foreground" />
            {titulo}
          </CardTitle>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 text-[10px] font-semibold",
              status === "done" && "border-success/30 bg-success/10 text-success",
              status === "current" &&
                (alerta
                  ? "border-warning/30 bg-warning/10 text-warning-foreground"
                  : "border-primary/30 bg-primary/10 text-primary"),
            )}
          >
            {status === "done"
              ? "Concluída"
              : status === "current"
                ? alerta
                  ? "Requer atenção"
                  : "Em andamento"
                : "Aguardando"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}

function EtapaInfo({
  id,
  n,
  titulo,
  status,
  icon,
  texto,
  extra,
  alerta,
}: {
  id: string;
  n: number;
  titulo: string;
  status: EtapaStatus;
  icon: typeof Info;
  texto: string;
  extra?: ReactNode;
  alerta?: boolean;
}) {
  return (
    <EtapaShell id={id} n={n} titulo={titulo} status={status} icon={icon} alerta={alerta}>
      <p className="text-sm leading-relaxed text-muted-foreground">{texto}</p>
      {extra && <div className="mt-3">{extra}</div>}
    </EtapaShell>
  );
}

function dataHoraFmt(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function TermoCliente({
  portal,
  nomePortal,
  termo,
  clienteId,
  onAplicar,
}: {
  portal: AssessoriaPortal;
  nomePortal: string;
  termo: AssessoriaTermo;
  clienteId: number;
  onAplicar: Aplicar;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (arquivo: File) => {
    setEnviando(true);
    const r = await enviarTermoAssinado({ portal, clienteId, arquivo });
    setEnviando(false);
    onAplicar(r, `${termo.nome} assinado enviado. Vamos conferir e avisar você.`);
  };

  if (termo.status === "aguardando_modelo" || !termo.modeloUrl) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/30 p-3">
        <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Estamos fazendo o pré-cadastro na {nomePortal}. Assim que a {nomePortal} gerar o{" "}
          <strong>{termo.nome}</strong>, ele aparece aqui para você baixar e assinar — e avisamos
          você por e-mail.
        </p>
      </div>
    );
  }

  const aguardandoCliente = termo.status === "aguardando_assinatura" || termo.status === "recusado";
  const badge = {
    aguardando_assinatura: { txt: "Aguardando sua assinatura", cls: "border-primary/30 bg-primary/10 text-primary" },
    recusado: { txt: "Reenvio necessário", cls: "border-warning/30 bg-warning/10 text-warning-foreground" },
    assinado: { txt: "Em conferência pela CADBRASIL", cls: "border-sky-500/30 bg-sky-500/10 text-sky-700" },
    aprovado: { txt: `Enviado à ${nomePortal}`, cls: "border-success/30 bg-success/10 text-success" },
  }[termo.status];

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border p-4",
        aguardandoCliente ? "border-primary/40 bg-primary/5" : "bg-muted/20",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-primary" /> {termo.nome}
        </p>
        <Badge variant="outline" className={cn("text-[10px] font-semibold", badge.cls)}>
          {badge.txt}
        </Badge>
      </div>

      {termo.status === "recusado" && termo.observacao && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="font-semibold">O termo precisa ser ajustado</p>
            <p className="mt-0.5 text-muted-foreground">{termo.observacao}</p>
          </div>
        </div>
      )}

      {aguardandoCliente && (
        <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
          <li>Baixe o {termo.nome} gerado pela {nomePortal}.</li>
          <li>
            Assine como <strong>representante legal</strong>: com certificado digital ICP-Brasil
            (e-CPF ou e-CNPJ) ou imprima, assine e <strong>reconheça firma em cartório</strong>.
          </li>
          <li>Envie aqui o arquivo assinado (PDF legível). Nossa equipe confere e envia à {nomePortal}.</li>
        </ol>
      )}

      {termo.status === "assinado" && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Termo assinado recebido em {dataHoraFmt(termo.assinadoEm)}. Nossa equipe está conferindo a
          assinatura antes de enviar à {nomePortal}.
        </p>
      )}
      {termo.status === "aprovado" && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
          Termo conferido e enviado à {nomePortal}. Agora é só aguardar a validação.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant={aguardandoCliente ? "outline" : "ghost"} className="gap-1.5">
          <a href={termo.modeloUrl} target="_blank" rel="noopener noreferrer">
            <Download className="h-3.5 w-3.5" /> Baixar {termo.nome}
          </a>
        </Button>
        {termo.assinadoUrl && !aguardandoCliente && (
          <Button asChild size="sm" variant="ghost" className="gap-1.5">
            <a href={termo.assinadoUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" /> Ver termo enviado
            </a>
          </Button>
        )}
        {termo.podeEnviarAssinado && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void enviar(f);
              }}
            />
            <Button
              size="sm"
              variant={aguardandoCliente ? "default" : "outline"}
              className="gap-1.5"
              disabled={enviando}
              onClick={() => inputRef.current?.click()}
            >
              {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {aguardandoCliente ? "Enviar termo assinado" : "Substituir arquivo"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function EtapaPagamento({
  config,
  painel,
  clienteId,
  documento,
  nomeEmpresa,
  status,
  onAtualizar,
  onPago,
}: {
  config: AssessoriaPortalConfig;
  painel: AssessoriaPainel;
  clienteId: number;
  documento: string;
  nomeEmpresa: string;
  status: EtapaStatus;
  onAtualizar: () => Promise<void>;
  onPago: () => void;
}) {
  const { processo } = painel;
  const [pagamento, setPagamento] = useState<AssessoriaPagamento | null>(painel.pagamento);
  const [verificando, setVerificando] = useState(false);
  const [pixOpen, setPixOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => setPagamento(painel.pagamento), [painel.pagamento]);

  const infoPagamento: PagamentoServicoInfo = {
    titulo: `Pagamento da assessoria ${config.nome}`,
    descricao: `Para iniciar o seu cadastro no ${config.nome} é necessário confirmar o pagamento da assessoria CADBRASIL.`,
    etapaTitulo: "Confirme o serviço contratado",
    etapaSubtitulo: config.subtitulo,
    plano: {
      titulo: config.pagamento.rotulo,
      descricao: config.semPrazo,
      prazo: "Pagamento único",
      badge: "Assessoria",
      icon: ShieldCheck,
      itens: config.pagamento.itens,
    },
    valor: processo.valor,
    aviso: {
      titulo: "Pagamento único da assessoria",
      texto:
        "Pagamento via Gerencianet/Efí. O valor refere-se exclusivamente aos serviços de assessoria da CADBRASIL — não é taxa do governo nem do portal.",
    },
    liberacao:
      "Assim que o pagamento for compensado, o envio dos documentos é liberado e nossa equipe dá início ao processo.",
  };

  const verificar = async () => {
    if (!pagamento) return;
    setVerificando(true);
    try {
      const res = await apiFetch("/api/pagamentos/check-status", {
        method: "POST",
        body: JSON.stringify({ pagamentoId: pagamento.id }),
      });
      const data = await res.json();
      if (data.ok && data.status === "pago") {
        toast.success("Pagamento confirmado! Agora envie os documentos.");
        await onAtualizar();
        onPago();
      } else {
        toast.info(
          "Pagamento ainda não identificado. Boletos podem levar até 3 dias úteis para compensar.",
        );
      }
    } catch {
      toast.error("Não foi possível verificar o pagamento agora.");
    } finally {
      setVerificando(false);
    }
  };

  return (
    <EtapaShell
      id={`${config.portal}-etapa-1`}
      n={1}
      titulo={config.passos[0]}
      status={status}
      icon={Barcode}
    >
      {processo.pago ? (
        <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <div>
            <p className="text-sm font-semibold">Assessoria paga</p>
            <p className="text-xs text-muted-foreground">
              {valorFmt(processo.valor)}
              {processo.dataPagamento ? ` · confirmado em ${dataFmt(processo.dataPagamento)}` : ""}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 rounded-xl border bg-gradient-to-br from-sky-500/10 to-background p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {config.pagamento.rotulo}
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight">{valorFmt(processo.valor)}</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {config.pagamento.itens.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-2 sm:w-48">
              <Button className="h-11 gap-2" onClick={() => setModalOpen(true)}>
                <Barcode className="h-4 w-4" />
                {pagamento ? "Nova cobrança" : "Pagar agora"}
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">PIX ou boleto</p>
            </div>
          </div>

          {config.pagamento.observacao}

          {pagamento?.tipo === "boleto" && pagamento.barcode && (
            <BoletoGeradoPanel
              compact
              documento={documento}
              boletoData={{
                barcode: pagamento.barcode,
                link: pagamento.link,
                pdf: pagamento.pdf,
                valor: pagamento.valor,
                vencimento: pagamento.vencimento || "",
                protocolo: pagamento.protocolo,
              }}
            />
          )}

          {pagamento?.tipo === "pix" && pagamento.qrcodeText && (
            <Button variant="secondary" className="gap-2" onClick={() => setPixOpen(true)}>
              <QrCode className="h-4 w-4" /> Ver QR Code do PIX gerado
            </Button>
          )}

          {pagamento && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              disabled={verificando}
              onClick={() => void verificar()}
            >
              {verificando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Já paguei — verificar pagamento
            </Button>
          )}
        </div>
      )}

      <PixPaymentModal
        open={pixOpen}
        onOpenChange={setPixOpen}
        client={nomeEmpresa}
        documento={documento}
        pixData={
          pagamento?.tipo === "pix"
            ? {
                qrcodeText: pagamento.qrcodeText,
                qrcodeImage: pagamento.qrcodeImage,
                valor: pagamento.valor,
                protocolo: pagamento.protocolo,
                txid: pagamento.txid,
                pagamentoId: pagamento.id,
              }
            : null
        }
        onPaymentConfirmed={() => {
          setPixOpen(false);
          toast.success("Pagamento confirmado! Agora envie os documentos.");
          void onAtualizar().then(onPago);
        }}
      />

      <PagamentoServicoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        empresa={{ nome: nomeEmpresa, cnpj: documento }}
        info={infoPagamento}
        gerar={(forma) => gerarCobrancaAssessoria(config.portal, clienteId, forma)}
        onGerado={() => void onAtualizar()}
        onPago={() => {
          toast.success("Pagamento confirmado! Agora envie os documentos.");
          void onAtualizar().then(onPago);
        }}
      />
    </EtapaShell>
  );
}

function EtapaDocumentos({
  config,
  painel,
  clienteId,
  status,
  alerta,
  onAplicar,
  onEnviado,
}: {
  config: AssessoriaPortalConfig;
  painel: AssessoriaPainel;
  clienteId: number;
  status: EtapaStatus;
  alerta: boolean;
  onAplicar: Aplicar;
  onEnviado: () => void;
}) {
  const { processo, documentos, resumo } = painel;
  const bloqueado = !processo.pago;
  const editavel = processo.editavel;
  const [salvandoEscolha, setSalvandoEscolha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [observacao, setObservacao] = useState("");

  const porGrupo = useMemo(
    () =>
      config.grupos
        .map((g) => ({ ...g, docs: documentos.filter((d) => d.grupo === g.id) }))
        .filter((g) => g.docs.length > 0),
    [config.grupos, documentos],
  );

  const escolher = async (opcao: string) => {
    setSalvandoEscolha(true);
    onAplicar(await definirEscolhaAssessoria(config.portal, clienteId, opcao));
    setSalvandoEscolha(false);
  };

  const enviarAnalise = async () => {
    setEnviando(true);
    const ok = onAplicar(
      await enviarAnaliseAssessoria(config.portal, clienteId, observacao.trim() || undefined),
      "Documentação enviada para conferência da CADBRASIL",
    );
    setEnviando(false);
    if (ok) onEnviado();
  };

  const percentual = resumo.obrigatoriosTotal
    ? Math.round((resumo.obrigatoriosEnviados / resumo.obrigatoriosTotal) * 100)
    : 0;
  const colunasEscolha = config.escolha.opcoes.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";

  return (
    <EtapaShell
      id={`${config.portal}-etapa-2`}
      n={2}
      titulo={config.passos[1]}
      status={status}
      icon={FileText}
      alerta={alerta}
    >
      {bloqueado ? (
        <div className="flex items-start gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />O envio dos documentos é liberado assim que o
          pagamento da assessoria for confirmado.
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold">{config.escolha.pergunta}</p>
            <p className="text-xs text-muted-foreground">{config.escolha.ajuda}</p>
            <div className={cn("mt-2 grid gap-2", colunasEscolha)}>
              {config.escolha.opcoes.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  disabled={!editavel || salvandoEscolha}
                  onClick={() => void escolher(o.id)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition disabled:cursor-not-allowed",
                    processo.atividade === o.id
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "hover:bg-muted/40",
                  )}
                >
                  <p className="text-sm font-semibold">{o.label}</p>
                  <p className="text-[11px] text-muted-foreground">{o.hint}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Documentos obrigatórios enviados</span>
              <span className="font-semibold text-primary">
                {resumo.obrigatoriosEnviados} de {resumo.obrigatoriosTotal}
              </span>
            </div>
            <Progress value={percentual} className="h-2" />
          </div>

          {porGrupo.map(({ id, label, docs }) => (
            <div key={id}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
              <ul className="space-y-2">
                {docs.map((doc) => (
                  <DocumentoLinha
                    key={doc.codigo}
                    portal={config.portal}
                    rotuloCondicional={config.rotuloCondicional}
                    doc={doc}
                    clienteId={clienteId}
                    editavel={editavel}
                    onAplicar={onAplicar}
                  />
                ))}
              </ul>
            </div>
          ))}

          <p className="text-[11px] text-muted-foreground">{config.notaDocumentos}</p>

          {editavel ? (
            <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Observações para a equipe CADBRASIL (opcional)"
                className="min-h-[64px] resize-none bg-background"
                maxLength={2000}
              />
              <Button
                size="lg"
                className="h-12 w-full gap-2 text-base font-semibold"
                disabled={!resumo.podeEnviarAnalise || enviando}
                onClick={() => void enviarAnalise()}
              >
                {enviando ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
                Enviar para conferência da CADBRASIL
              </Button>
              {!resumo.podeEnviarAnalise && (
                <p className="text-center text-xs text-muted-foreground">
                  {!processo.atividade
                    ? config.escolha.pendente
                    : "Envie todos os documentos obrigatórios para liberar o envio."}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              <p className="text-sm">
                Documentação enviada
                {processo.enviadoAnaliseEm ? ` em ${dataFmt(processo.enviadoAnaliseEm)}` : ""}.{" "}
                {config.textoEnviado}
              </p>
            </div>
          )}
        </div>
      )}
    </EtapaShell>
  );
}

function DocumentoLinha({
  portal,
  rotuloCondicional,
  doc,
  clienteId,
  editavel,
  onAplicar,
}: {
  portal: AssessoriaPortal;
  rotuloCondicional?: string;
  doc: AssessoriaDocumento;
  clienteId: number;
  editavel: boolean;
  onAplicar: Aplicar;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [validade, setValidade] = useState(doc.enviado?.dataValidade || "");
  const [enviando, setEnviando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const env = doc.enviado;
  const recusado = env?.status === "recusado";

  const enviar = async (arquivo: File) => {
    setEnviando(true);
    onAplicar(
      await enviarDocumentoAssessoria({
        portal,
        clienteId,
        codigo: doc.codigo,
        arquivo,
        dataValidade: validade || undefined,
      }),
      "Documento enviado",
    );
    setEnviando(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remover = async () => {
    setRemovendo(true);
    onAplicar(
      await removerDocumentoAssessoria(portal, clienteId, doc.codigo),
      "Documento removido",
    );
    setRemovendo(false);
  };

  return (
    <li
      className={cn(
        "rounded-lg border bg-card px-3 py-2.5",
        recusado && "border-danger/40 bg-danger/5",
        env?.status === "aprovado" && "border-success/30",
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          {env ? (
            recusado ? (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            )
          ) : (
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-medium">{doc.nome}</p>
              {doc.obrigatorio ? (
                <Badge variant="outline" className="h-4 px-1.5 text-[9px]">
                  {doc.condicional ? rotuloCondicional || "Condicional" : "Obrigatório"}
                </Badge>
              ) : (
                <Badge variant="outline" className="h-4 px-1.5 text-[9px] text-muted-foreground">
                  Se aplicável
                </Badge>
              )}
              {env?.status === "aprovado" && (
                <Badge className="h-4 bg-success px-1.5 text-[9px] text-white hover:bg-success">
                  Aprovado
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{doc.descricao}</p>
            {env && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                <a
                  href={env.arquivoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {env.arquivoNome || "Ver arquivo"}
                </a>
                {env.dataValidade ? ` · validade ${dataFmt(env.dataValidade)}` : ""}
              </p>
            )}
            {recusado && env?.observacao && (
              <p className="mt-1 text-xs font-medium text-danger">
                Ajuste solicitado: {env.observacao}
              </p>
            )}
          </div>
        </div>

        {editavel && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {doc.pedeValidade && (
              <Input
                type="date"
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
                className="h-8 w-[140px] text-xs"
                title="Validade do documento"
              />
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void enviar(f);
              }}
            />
            <Button
              size="sm"
              variant={env && !recusado ? "outline" : "default"}
              className="h-8 gap-1.5"
              disabled={enviando}
              onClick={() => inputRef.current?.click()}
            >
              {enviando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {env ? "Substituir" : "Enviar"}
            </Button>
            {env && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-danger"
                disabled={removendo}
                onClick={() => void remover()}
                title="Remover documento"
              >
                {removendo ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
