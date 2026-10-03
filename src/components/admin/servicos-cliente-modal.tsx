import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileSignature,
  FileText,
  Mail,
  Send,
  Gift,
  Landmark,
  LifeBuoy,
  Loader2,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AutorizarPagamentoModal } from "@/components/admin/autorizar-pagamento-modal";
import { autorizarServicoComComprovante, avisoEmailAtivacao } from "@/lib/admin-clientes-api";
import {
  atualizarAcompanhamentoAdmin,
  atualizarProcessoAssessoriaAdmin,
  definirCortesiaModulo,
  enviarModeloTermoAdmin,
  fetchServicosCliente,
  previewEmailAtivacao,
  reenviarEmailAtivacao,
  responderApoioLicitacoesE,
  type ServicoEmail,
  type AssessoriaResumo,
  type ModuloAssinaturaAdmin,
  type ServicosCliente,
} from "@/lib/admin-servicos-api";
import {
  enviarDocumentoAssessoria,
  enviarTermoAssinado,
  fetchAssessoriaPainel,
  type AssessoriaDocumento,
  type AssessoriaPainel,
  type AssessoriaPortal,
  type AssessoriaStatus,
  type AssessoriaTermo,
  type TermoStatus,
} from "@/lib/assessoria-portal-api";
import {
  RESULTADOS,
  SITUACOES_PORTAL,
  calcularAptidao,
  type Acompanhamento,
  type ResultadoLicitacao,
  type SituacaoPortal,
} from "@/lib/licitacoes-e-api";
import { dataModuloFmt, valorModuloFmt, type ModuloPago } from "@/lib/modulos-api";
import { cn } from "@/lib/utils";

type Aba = "caufesp" | "bll" | "licitacoes_e" | "pncp";

const STATUS_ASSESSORIA: Record<AssessoriaStatus, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  documentacao: "Cliente enviando documentos",
  conferencia_cadbrasil: "Conferência CADBRASIL",
  pendencia_documentos: "Pendência de documentos",
  protocolado: "Protocolado no portal",
  analise_governo: "Em análise no portal",
  exigencia_governo: "Exigência do portal",
  aprovado: "Aprovado",
  indeferido: "Indeferido",
};

const PORTAIS: Record<
  AssessoriaPortal,
  {
    nome: string;
    rotuloEscolha: string;
    escolhas: Record<string, string>;
    grupos: Record<string, string>;
    rotuloProtocolo: string;
    rotuloValidade: string;
  }
> = {
  caufesp: {
    nome: "CAUFESP (BEC/SP)",
    rotuloEscolha: "Atividade",
    escolhas: { bens: "Fornecimento de bens", servicos: "Prestação de serviços", ambos: "Bens e serviços" },
    grupos: {
      habilitacao_juridica: "Habilitação jurídica",
      regularidade_fiscal: "Regularidade fiscal e trabalhista",
      qualificacao_tecnica: "Qualificação técnica",
      qualificacao_economica: "Qualificação econômico-financeira",
      declaracoes: "Declarações",
    },
    rotuloProtocolo: "Protocolo CAUFESP",
    rotuloValidade: "CRC válido até",
  },
  bll: {
    nome: "BLL Compras",
    rotuloEscolha: "Plano",
    escolhas: { trimestral: "Plano trimestral", exito: "Plano por êxito" },
    grupos: {
      cadastro_bll: "Cadastro na BLL",
      habilitacao: "Kit de habilitação",
      complementares: "Complementares",
    },
    rotuloProtocolo: "Login / identificação na BLL",
    rotuloValidade: "Plano válido até",
  },
};

const STATUS_ALERTA: AssessoriaStatus[] = ["pendencia_documentos", "exigencia_governo", "indeferido"];

function dataHoraFmt(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function isoMaisDias(dias: number, base?: string | null) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicio = base ? new Date(`${base}T00:00:00`) : hoje;
  const d = inicio > hoje ? inicio : hoje;
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function resumoAssessoria(r: AssessoriaResumo | undefined) {
  if (!r || !r.existe) return { texto: "Não iniciado", tom: "muted" as const };
  if (!r.pago) return { texto: "Aguardando pagamento", tom: "warn" as const };
  if (r.status === "conferencia_cadbrasil") return { texto: "Conferir documentos", tom: "acao" as const };
  if (r.termoStatus === "assinado") return { texto: "Conferir termo assinado", tom: "acao" as const };
  if (r.status === "aprovado") return { texto: "Aprovado", tom: "ok" as const };
  if (STATUS_ALERTA.includes(r.status)) return { texto: STATUS_ASSESSORIA[r.status], tom: "warn" as const };
  return { texto: STATUS_ASSESSORIA[r.status], tom: "info" as const };
}

function resumoModulo(m: ModuloAssinaturaAdmin | undefined, apoios = 0) {
  if (apoios > 0) return { texto: `${apoios} pedido(s) de apoio`, tom: "acao" as const };
  if (!m) return { texto: "Não contratado", tom: "muted" as const };
  if (m.ativo) return { texto: `Ativo até ${dataModuloFmt(m.validoAte)}`, tom: "ok" as const };
  if (m.pagamentoAberto) return { texto: "Mensalidade em aberto", tom: "warn" as const };
  if (m.historico.length || m.validoAte) return { texto: "Vencido", tom: "warn" as const };
  return { texto: "Não contratado", tom: "muted" as const };
}

const TOM_CLS = {
  muted: "bg-muted text-muted-foreground",
  warn: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  acao: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  info: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
};

export function ServicosClienteModal({
  open,
  onOpenChange,
  clienteId,
  clienteNome,
  onAlterado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clienteId: number;
  clienteNome: string;
  onAlterado?: () => void;
}) {
  const [dados, setDados] = useState<ServicosCliente | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [aba, setAba] = useState<Aba>("caufesp");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await fetchServicosCliente(clienteId);
    setCarregando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDados(res);
  }, [clienteId]);

  useEffect(() => {
    if (open) void carregar();
  }, [open, carregar]);

  const alterado = useCallback(() => {
    void carregar();
    onAlterado?.();
  }, [carregar, onAlterado]);

  const modulo = (m: ModuloPago) => dados?.modulos.find((x) => x.modulo === m);
  const apoios = dados?.licitacoesE.acompanhamentos.filter((a) => a.apoioSolicitadoEm).length ?? 0;

  const abas: { id: Aba; nome: string; icon: typeof Landmark; status: ReturnType<typeof resumoAssessoria> }[] = [
    { id: "caufesp", nome: "CAUFESP · BEC", icon: Landmark, status: resumoAssessoria(dados?.caufesp) },
    { id: "bll", nome: "BLL Compras", icon: Briefcase, status: resumoAssessoria(dados?.bll) },
    {
      id: "licitacoes_e",
      nome: "Licitações-e",
      icon: BookOpenCheck,
      status: resumoModulo(modulo("licitacoes_e"), apoios),
    },
    { id: "pncp", nome: "PNCP Inteligente", icon: Search, status: resumoModulo(modulo("pncp")) },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[96vw] p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Serviços de {clienteNome}</DialogTitle>
        <div className="flex items-start justify-between gap-3 bg-gradient-to-br from-indigo-700 via-indigo-600 to-sky-600 px-6 py-4 text-white">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
              Central de serviços
            </p>
            <h2 className="truncate text-lg font-bold">{clienteNome}</h2>
            <p className="text-xs text-white/80">
              Assessorias CAUFESP e BLL, módulos Licitações-e e PNCP — processo, documentos, acesso e
              suporte ao cliente.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="mr-6 h-8 gap-1.5 bg-white/15 text-white hover:bg-white/25"
            disabled={carregando}
            onClick={() => void carregar()}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", carregando && "animate-spin")} /> Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b bg-muted/30 p-3 md:grid-cols-4">
          {abas.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAba(a.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 text-left transition",
                aba === a.id
                  ? "border-indigo-500 ring-2 ring-indigo-500/20"
                  : "border-border/60 hover:border-indigo-300",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  aba === a.id ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground",
                )}
              >
                <a.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{a.nome}</span>
                <span
                  className={cn(
                    "mt-0.5 inline-flex max-w-full truncate rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    TOM_CLS[a.status.tom],
                  )}
                >
                  {dados ? a.status.texto : "…"}
                </span>
              </span>
            </button>
          ))}
        </div>

        <ScrollArea className="max-h-[min(620px,calc(90vh-230px))]">
          <div className="p-5">
            {!dados ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando serviços…
              </div>
            ) : aba === "caufesp" || aba === "bll" ? (
              <AssessoriaAdmin
                key={aba}
                portal={aba}
                clienteId={clienteId}
                clienteNome={clienteNome}
                resumo={dados[aba]}
                onAlterado={alterado}
              />
            ) : aba === "licitacoes_e" ? (
              <div className="space-y-4">
                <ModuloAdmin
                  clienteId={clienteId}
                  clienteNome={clienteNome}
                  modulo="licitacoes_e"
                  assinatura={modulo("licitacoes_e")}
                  onAlterado={alterado}
                />
                <LicitacoesEAdmin
                  clienteId={clienteId}
                  acessoEtapas={dados.licitacoesE.acessoEtapas.length}
                  acompanhamentos={dados.licitacoesE.acompanhamentos}
                  onAlterado={alterado}
                />
              </div>
            ) : (
              <ModuloAdmin
                clienteId={clienteId}
                clienteNome={clienteNome}
                modulo="pncp"
                assinatura={modulo("pncp")}
                onAlterado={alterado}
              />
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Assessorias CAUFESP / BLL                                           */
/* ------------------------------------------------------------------ */

function AssessoriaAdmin({
  portal,
  clienteId,
  clienteNome,
  resumo,
  onAlterado,
}: {
  portal: AssessoriaPortal;
  clienteId: number;
  clienteNome: string;
  resumo: AssessoriaResumo;
  onAlterado: () => void;
}) {
  const cfg = PORTAIS[portal];
  const [painel, setPainel] = useState<AssessoriaPainel | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [autorizarOpen, setAutorizarOpen] = useState(false);
  const [form, setForm] = useState({ status: "" as AssessoriaStatus | "", protocolo: "", validade: "", mensagem: "" });

  const aplicar = useCallback((p: AssessoriaPainel) => {
    setPainel(p);
    setForm({
      status: p.processo.status,
      protocolo: p.processo.protocoloPortal ?? "",
      validade: p.processo.cadastroValidade ?? "",
      mensagem: p.processo.observacaoCadbrasil ?? "",
    });
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await fetchAssessoriaPainel(portal, clienteId);
    setCarregando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    aplicar(res);
  }, [portal, clienteId, aplicar]);

  useEffect(() => {
    if (resumo.existe) void carregar();
  }, [resumo.existe, carregar]);

  const concluir = (res: Awaited<ReturnType<typeof atualizarProcessoAssessoriaAdmin>>, sucesso: string) => {
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    aplicar(res);
    toast.success(sucesso, { description: avisoEmailTermo(res.emailTermo) });
    onAlterado();
    return true;
  };

  const patch = async (campos: Parameters<typeof atualizarProcessoAssessoriaAdmin>[2], sucesso: string) => {
    setSalvando(true);
    const res = await atualizarProcessoAssessoriaAdmin(portal, clienteId, campos);
    setSalvando(false);
    return concluir(res, sucesso);
  };

  if (!resumo.existe) {
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <Landmark className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-semibold">O cliente ainda não iniciou a assessoria {cfg.nome}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Abra o processo para gerar a cobrança pelo portal do cliente ou acompanhar o atendimento.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          disabled={carregando}
          onClick={() => {
            void (async () => {
              await carregar();
              onAlterado();
            })();
          }}
        >
          {carregando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Abrir processo
        </Button>
      </Card>
    );
  }

  if (!painel) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando processo…
      </div>
    );
  }

  const { processo, pagamento, documentos, resumo: res } = painel;
  const alterou =
    form.status !== processo.status ||
    form.protocolo !== (processo.protocoloPortal ?? "") ||
    form.validade !== (processo.cadastroValidade ?? "") ||
    form.mensagem !== (processo.observacaoCadbrasil ?? "");
  const aguardando = documentos.filter((d) => d.enviado?.status === "enviado");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Mini label="Situação" valor={STATUS_ASSESSORIA[processo.status]} destaque />
        <Mini
          label="Pagamento"
          valor={processo.pago ? `Pago ${dataModuloFmt(processo.dataPagamento)}` : "Pendente"}
          tom={processo.pago ? "ok" : "warn"}
        />
        <Mini
          label={cfg.rotuloEscolha}
          valor={processo.atividade ? (cfg.escolhas[processo.atividade] ?? processo.atividade) : "Não informado"}
        />
        <Mini label="Documentos" valor={`${res.obrigatoriosEnviados}/${res.obrigatoriosTotal} obrigatórios`} />
      </div>

      {!processo.pago && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-amber-300/60 bg-amber-50/60 p-4 dark:bg-amber-500/5">
          <div className="text-sm">
            <p className="font-semibold text-amber-900 dark:text-amber-200">Assessoria ainda não paga</p>
            <p className="text-amber-800/80 dark:text-amber-200/70">
              {pagamento
                ? `Cobrança ${pagamento.tipo === "pix" ? "PIX" : "boleto"} de ${valorModuloFmt(pagamento.valor)} · vence ${dataModuloFmt(pagamento.vencimento)}.`
                : "Nenhuma cobrança gerada — o cliente gera pelo portal ou pela aba Financeiro."}
            </p>
          </div>
          {pagamento && (
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setAutorizarOpen(true)}
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Cliente pagou · autorizar
            </Button>
          )}
        </Card>
      )}

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Andamento do processo</h3>
          {processo.enviadoAnaliseEm && (
            <span className="text-[11px] text-muted-foreground">
              Enviado para conferência em {dataHoraFmt(processo.enviadoAnaliseEm)}
            </span>
          )}
        </div>
        {processo.observacaoCliente && (
          <div className="rounded-lg border bg-muted/40 p-3 text-xs">
            <p className="font-semibold">Observação do cliente</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{processo.observacaoCliente}</p>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1 text-xs font-medium">
            Situação
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as AssessoriaStatus }))}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_ASSESSORIA) as AssessoriaStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_ASSESSORIA[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1 text-xs font-medium">
            {cfg.rotuloProtocolo}
            <Input
              className="h-9"
              value={form.protocolo}
              onChange={(e) => setForm((f) => ({ ...f, protocolo: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-xs font-medium">
            {cfg.rotuloValidade}
            <Input
              type="date"
              className="h-9"
              value={form.validade}
              onChange={(e) => setForm((f) => ({ ...f, validade: e.target.value }))}
            />
          </label>
        </div>
        <label className="block space-y-1 text-xs font-medium">
          Mensagem para o cliente (aparece na tela da assessoria)
          <Textarea
            rows={3}
            value={form.mensagem}
            placeholder="Ex.: Recebemos seus documentos. A certidão estadual está vencida — reenvie a versão atual."
            onChange={(e) => setForm((f) => ({ ...f, mensagem: e.target.value }))}
          />
        </label>
        <div className="flex justify-end">
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!alterou || salvando}
            onClick={() =>
              void patch(
                {
                  status: form.status || undefined,
                  protocoloPortal: form.protocolo.trim() || null,
                  cadastroValidade: form.validade || null,
                  observacaoCadbrasil: form.mensagem.trim() || null,
                },
                "Processo atualizado",
              )
            }
          >
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar andamento
          </Button>
        </div>
      </Card>

      {painel.termo && processo.pago && (
        <TermoAdmin
          termo={painel.termo}
          portalNome={portal === "bll" ? "BLL" : cfg.nome}
          ocupado={salvando}
          onEnviarModelo={async (arquivo) => {
            const r = await enviarModeloTermoAdmin(portal, clienteId, arquivo);
            concluir(r, `${painel.termo!.nome} disponibilizado ao cliente`);
          }}
          onEnviarAssinado={async (arquivo) => {
            const r = await enviarTermoAssinado({ portal, clienteId, arquivo });
            if (!r.ok) {
              toast.error(r.error);
              return;
            }
            aplicar(r);
            toast.success("Termo assinado registrado — confira e aprove");
            onAlterado();
          }}
          onAprovar={() =>
            void patch(
              { termoAvaliacao: { status: "aprovado" }, status: "analise_governo" },
              `${painel.termo!.nome} aprovado — processo em validação pela ${portal === "bll" ? "BLL" : cfg.nome}`,
            )
          }
          onRecusar={(motivo) =>
            patch(
              { termoAvaliacao: { status: "recusado", observacao: motivo } },
              `${painel.termo!.nome} recusado — reenvio liberado para o cliente`,
            )
          }
        />
      )}

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Documentos</h3>
            <p className="text-xs text-muted-foreground">
              {aguardando.length
                ? `${aguardando.length} aguardando conferência`
                : "Nenhum documento aguardando conferência"}
            </p>
          </div>
          {aguardando.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-emerald-500/40 text-emerald-700"
              disabled={salvando}
              onClick={() =>
                void patch(
                  { documentos: aguardando.map((d) => ({ codigo: d.codigo, status: "aprovado" as const })) },
                  "Documentos aprovados",
                )
              }
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar todos enviados
            </Button>
          )}
        </div>
        <ul className="mt-3 divide-y rounded-lg border">
          {documentos.map((d) => (
            <DocumentoAdmin
              key={d.codigo}
              doc={d}
              grupo={cfg.grupos[d.grupo] ?? d.grupo}
              podeEnviar={processo.pago && processo.editavel}
              ocupado={salvando}
              onAprovar={() =>
                void patch({ documentos: [{ codigo: d.codigo, status: "aprovado" }] }, `${d.nome}: aprovado`)
              }
              onRecusar={(motivo) =>
                patch(
                  {
                    documentos: [{ codigo: d.codigo, status: "recusado", observacao: motivo }],
                    ...(processo.status === "conferencia_cadbrasil"
                      ? { status: "pendencia_documentos" as const }
                      : {}),
                  },
                  processo.status === "conferencia_cadbrasil"
                    ? `${d.nome}: recusado — envio liberado para o cliente corrigir`
                    : `${d.nome}: recusado`,
                )
              }
              onEnviar={async (arquivo) => {
                const r = await enviarDocumentoAssessoria({ portal, clienteId, codigo: d.codigo, arquivo });
                if (!r.ok) {
                  toast.error(r.error);
                  return;
                }
                aplicar(r);
                toast.success(`${d.nome}: arquivo enviado`);
                onAlterado();
              }}
            />
          ))}
        </ul>
      </Card>

      <EmailAtivacao clienteId={clienteId} servico={portal} ativo={processo.pago} />

      {pagamento && (
        <AutorizarPagamentoModal
          open={autorizarOpen}
          onOpenChange={setAutorizarOpen}
          dados={{
            descricao: `Assessoria ${cfg.nome}`,
            cliente: clienteNome,
            valor: pagamento.valor,
            forma: pagamento.tipo === "pix" ? "PIX" : "Boleto",
            dataGeracao: dataModuloFmt(pagamento.criadoEm),
            referencia: { label: "Vencimento", valor: dataModuloFmt(pagamento.vencimento) },
            aposAutorizacao: {
              destaques: [
                { label: "Assessoria", valor: "Paga" },
                { label: "Próxima etapa", valor: "Documentação" },
              ],
              itens: [
                "Cobrança marcada como Pago",
                "Comprovante salvo no histórico",
                "Cliente liberado para enviar os documentos",
              ],
            },
          }}
          onConfirmar={async ({ comprovante, observacoes }) => {
            const r = await autorizarServicoComComprovante({
              pagamentoId: pagamento.id,
              clienteId,
              formaPagamento: pagamento.tipo,
              observacoes,
              comprovante,
            });
            if (!r.ok) {
              toast.error(r.error || "Erro ao autorizar pagamento");
              throw new Error("autorizacao_falhou");
            }
            toast.success(r.message || "Pagamento autorizado", {
              description: avisoEmailAtivacao(r.emailNotificacao),
            });
            await carregar();
            onAlterado();
          }}
        />
      )}
    </div>
  );
}

function DocumentoAdmin({
  doc,
  grupo,
  podeEnviar,
  ocupado,
  onAprovar,
  onRecusar,
  onEnviar,
}: {
  doc: AssessoriaDocumento;
  grupo: string;
  podeEnviar: boolean;
  ocupado: boolean;
  onAprovar: () => void;
  onRecusar: (motivo: string) => Promise<boolean>;
  onEnviar: (arquivo: File) => Promise<void>;
}) {
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const env = doc.enviado;

  const badge = !env
    ? { txt: doc.obrigatorio ? "Não enviado" : "Opcional", cls: "bg-muted text-muted-foreground" }
    : env.status === "aprovado"
      ? { txt: "Aprovado", cls: "bg-emerald-500/15 text-emerald-700" }
      : env.status === "recusado"
        ? { txt: "Recusado", cls: "bg-rose-500/15 text-rose-700" }
        : { txt: "Aguardando conferência", cls: "bg-sky-500/15 text-sky-700" };

  return (
    <li className="px-3 py-2.5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 font-semibold">
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {doc.nome}
            {doc.obrigatorio && (
              <span className="rounded bg-rose-500/10 px-1 text-[9px] font-semibold uppercase text-rose-700">
                Obrigatório
              </span>
            )}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            {grupo}
            {env?.dataValidade ? ` · válido até ${dataModuloFmt(env.dataValidade)}` : ""}
            {env?.enviadoEm ? ` · enviado ${dataHoraFmt(env.enviadoEm)}` : ""}
          </p>
          {env?.status === "recusado" && env.observacao && (
            <p className="mt-0.5 text-rose-700">Motivo: {env.observacao}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", badge.cls)}>{badge.txt}</span>
          {env && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-[10px]"
              onClick={() => window.open(env.arquivoUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="h-3 w-3" /> Abrir
            </Button>
          )}
          {env && env.status !== "aprovado" && (
            <Button
              size="sm"
              className="h-7 gap-1 bg-emerald-600 px-2 text-[10px] hover:bg-emerald-700"
              disabled={ocupado}
              onClick={onAprovar}
            >
              <CheckCircle2 className="h-3 w-3" /> Aprovar
            </Button>
          )}
          {env && env.status !== "recusado" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 border-rose-500/30 px-2 text-[10px] text-rose-700 hover:bg-rose-500/10"
              disabled={ocupado}
              onClick={() => setRecusando((v) => !v)}
            >
              <XCircle className="h-3 w-3" /> Recusar
            </Button>
          )}
          {podeEnviar && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setEnviando(true);
                  void onEnviar(f).finally(() => setEnviando(false));
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-[10px]"
                title="Enviar arquivo em nome do cliente"
                disabled={enviando}
                onClick={() => inputRef.current?.click()}
              >
                {enviando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                {env ? "Substituir" : "Enviar"}
              </Button>
            </>
          )}
        </div>
      </div>
      {recusando && (
        <div className="mt-2 flex gap-2">
          <Input
            className="h-8 text-xs"
            autoFocus
            placeholder="Motivo da recusa (o cliente verá esta mensagem)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <Button
            size="sm"
            variant="destructive"
            className="h-8 text-xs"
            disabled={!motivo.trim() || ocupado}
            onClick={() => {
              void onRecusar(motivo.trim()).then((ok) => {
                if (ok) {
                  setRecusando(false);
                  setMotivo("");
                }
              });
            }}
          >
            Confirmar recusa
          </Button>
        </div>
      )}
    </li>
  );
}

const TERMO_ADMIN: Record<TermoStatus, { txt: string; tom: keyof typeof TOM_CLS }> = {
  aguardando_modelo: { txt: "Anexar termo gerado pelo portal", tom: "acao" },
  aguardando_assinatura: { txt: "Aguardando assinatura do cliente", tom: "warn" },
  assinado: { txt: "Conferir termo assinado", tom: "acao" },
  aprovado: { txt: "Conferido e enviado", tom: "ok" },
  recusado: { txt: "Recusado · aguardando reenvio", tom: "warn" },
};

function avisoEmailTermo(e?: { enviado?: boolean; simulado?: boolean; motivo?: string }) {
  if (!e) return undefined;
  if (e.enviado) return "Cliente avisado por e-mail.";
  if (e.simulado) return "E-mail simulado (envio desativado neste ambiente).";
  if (e.motivo === "sem_email_destino") return "Cliente sem e-mail cadastrado — avise pelo WhatsApp.";
  return "Não foi possível enviar o e-mail ao cliente — avise pelo WhatsApp.";
}

function TermoAdmin({
  termo,
  portalNome,
  ocupado,
  onEnviarModelo,
  onEnviarAssinado,
  onAprovar,
  onRecusar,
}: {
  termo: AssessoriaTermo;
  portalNome: string;
  ocupado: boolean;
  onEnviarModelo: (arquivo: File) => Promise<void>;
  onEnviarAssinado: (arquivo: File) => Promise<void>;
  onAprovar: () => void;
  onRecusar: (motivo: string) => Promise<boolean>;
}) {
  const modeloRef = useRef<HTMLInputElement>(null);
  const assinadoRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState<"modelo" | "assinado" | null>(null);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const st = TERMO_ADMIN[termo.status];

  const arquivoInput = (ref: typeof modeloRef, tipo: "modelo" | "assinado", acao: (f: File) => Promise<void>) => (
    <input
      ref={ref}
      type="file"
      accept="application/pdf,image/*"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        setEnviando(tipo);
        void acao(f).finally(() => setEnviando(null));
      }}
    />
  );

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <FileSignature className="h-4 w-4 text-indigo-600" /> {termo.nome}
          </h3>
          <p className="text-xs text-muted-foreground">
            Gerado pela {portalNome} no pré-cadastro. O cliente baixa, assina como representante legal e
            devolve pelo portal.
          </p>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", TOM_CLS[st.tom])}>{st.txt}</span>
      </div>

      <ul className="divide-y rounded-lg border text-xs">
        <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
          <div className="min-w-0">
            <p className="font-semibold">1. Termo gerado pela {portalNome}</p>
            <p className="text-muted-foreground">
              {termo.modeloUrl
                ? `Disponibilizado ao cliente em ${dataHoraFmt(termo.disponibilizadoEm)}`
                : "Faça o pré-cadastro, baixe o termo no site do portal e anexe aqui. O cliente é avisado por e-mail."}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {termo.modeloUrl && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 px-2 text-[10px]"
                onClick={() => window.open(termo.modeloUrl!, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="h-3 w-3" /> Abrir
              </Button>
            )}
            {termo.status !== "aprovado" && (
              <>
                {arquivoInput(modeloRef, "modelo", onEnviarModelo)}
                <Button
                  size="sm"
                  variant={termo.modeloUrl ? "ghost" : "default"}
                  className="h-7 gap-1 px-2 text-[10px]"
                  disabled={ocupado || enviando !== null}
                  onClick={() => modeloRef.current?.click()}
                >
                  {enviando === "modelo" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3" />
                  )}
                  {termo.modeloUrl ? "Substituir" : "Anexar termo"}
                </Button>
              </>
            )}
          </div>
        </li>

        <li className="space-y-2 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">2. Termo assinado pelo cliente</p>
              <p className="text-muted-foreground">
                {termo.assinadoUrl
                  ? `Recebido em ${dataHoraFmt(termo.assinadoEm)}${termo.assinadoNome ? ` · ${termo.assinadoNome}` : ""}`
                  : termo.modeloUrl
                    ? "Aguardando o cliente enviar pelo portal."
                    : "Disponível depois que o termo for anexado."}
              </p>
              {termo.status === "recusado" && termo.observacao && (
                <p className="mt-0.5 text-rose-700">Motivo da recusa: {termo.observacao}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {termo.assinadoUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 px-2 text-[10px]"
                  onClick={() => window.open(termo.assinadoUrl!, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="h-3 w-3" /> Abrir
                </Button>
              )}
              {termo.status === "assinado" && (
                <>
                  <Button
                    size="sm"
                    className="h-7 gap-1 bg-emerald-600 px-2 text-[10px] hover:bg-emerald-700"
                    disabled={ocupado}
                    onClick={onAprovar}
                  >
                    <CheckCircle2 className="h-3 w-3" /> Aprovar e marcar como enviado à {portalNome}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 border-rose-500/30 px-2 text-[10px] text-rose-700 hover:bg-rose-500/10"
                    disabled={ocupado}
                    onClick={() => setRecusando((v) => !v)}
                  >
                    <XCircle className="h-3 w-3" /> Recusar
                  </Button>
                </>
              )}
              {termo.podeEnviarAssinado && (
                <>
                  {arquivoInput(assinadoRef, "assinado", onEnviarAssinado)}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-[10px]"
                    title="Quando o cliente mandar o termo assinado por WhatsApp ou e-mail"
                    disabled={ocupado || enviando !== null}
                    onClick={() => assinadoRef.current?.click()}
                  >
                    {enviando === "assinado" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                    Enviar pelo cliente
                  </Button>
                </>
              )}
            </div>
          </div>
          {recusando && (
            <div className="flex gap-2">
              <Input
                className="h-8 text-xs"
                autoFocus
                placeholder="Motivo da recusa (o cliente recebe por e-mail e vê no portal)"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
              <Button
                size="sm"
                variant="destructive"
                className="h-8 text-xs"
                disabled={!motivo.trim() || ocupado}
                onClick={() => {
                  void onRecusar(motivo.trim()).then((ok) => {
                    if (ok) {
                      setRecusando(false);
                      setMotivo("");
                    }
                  });
                }}
              >
                Confirmar recusa
              </Button>
            </div>
          )}
        </li>
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Módulos mensais (Licitações-e / PNCP)                               */
/* ------------------------------------------------------------------ */

const MODULO_NOME: Record<ModuloPago, string> = {
  licitacoes_e: "Assistente Licitações-e",
  pncp: "PNCP Inteligente",
};

function ModuloAdmin({
  clienteId,
  clienteNome,
  modulo,
  assinatura,
  onAlterado,
}: {
  clienteId: number;
  clienteNome: string;
  modulo: ModuloPago;
  assinatura?: ModuloAssinaturaAdmin;
  onAlterado: () => void;
}) {
  const [ate, setAte] = useState(assinatura?.cortesiaAte ?? "");
  const [salvando, setSalvando] = useState(false);
  const [autorizar, setAutorizar] = useState<ModuloAssinaturaAdmin["historico"][number] | null>(null);

  useEffect(() => {
    setAte(assinatura?.cortesiaAte ?? "");
  }, [assinatura?.cortesiaAte]);

  const salvarCortesia = async (data: string | null) => {
    setSalvando(true);
    const r = await definirCortesiaModulo(clienteId, modulo, data);
    setSalvando(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(data ? `Acesso liberado até ${dataModuloFmt(data)}` : "Cortesia removida");
    onAlterado();
  };

  const historico = assinatura?.historico ?? [];
  const nome = MODULO_NOME[modulo];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Mini
          label="Acesso"
          valor={assinatura?.ativo ? `Ativo até ${dataModuloFmt(assinatura.validoAte)}` : "Bloqueado"}
          tom={assinatura?.ativo ? "ok" : "warn"}
          destaque
        />
        <Mini label="Mensalidade" valor={valorModuloFmt(assinatura?.valor ?? (modulo === "pncp" ? 699 : 299))} />
        <Mini label="Pago até" valor={dataModuloFmt(assinatura?.validoAtePago)} />
        <Mini label="Cortesia até" valor={dataModuloFmt(assinatura?.cortesiaAte)} />
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-semibold">Acesso de cortesia / suporte</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Libera o {nome} sem cobrança até a data escolhida (ex.: compensar instabilidade, período de
          teste ou acerto comercial). Não altera as mensalidades pagas.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-xs font-medium">
            Liberar até
            <Input type="date" className="h-9 w-44" value={ate} onChange={(e) => setAte(e.target.value)} />
          </label>
          <Button size="sm" variant="outline" className="h-9" onClick={() => setAte(isoMaisDias(7, assinatura?.validoAte))}>
            +7 dias
          </Button>
          <Button size="sm" variant="outline" className="h-9" onClick={() => setAte(isoMaisDias(30, assinatura?.validoAte))}>
            +30 dias
          </Button>
          <Button
            size="sm"
            className="h-9 gap-1.5"
            disabled={!ate || ate === (assinatura?.cortesiaAte ?? "") || salvando}
            onClick={() => void salvarCortesia(ate)}
          >
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
            Liberar acesso
          </Button>
          {assinatura?.cortesiaAte && (
            <Button
              size="sm"
              variant="ghost"
              className="h-9 text-rose-700"
              disabled={salvando}
              onClick={() => void salvarCortesia(null)}
            >
              Remover cortesia
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold">Mensalidades</h3>
        {historico.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Nenhuma mensalidade gerada para este módulo.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-lg border text-xs">
            {historico.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.descricao || `Mensalidade #${p.id}`}</p>
                  <p className="text-muted-foreground">
                    {p.tipo === "pix" ? "PIX" : "Boleto"} · vence {dataModuloFmt(p.vencimento)}
                    {p.status === "pago" ? ` · pago ${dataModuloFmt(p.dataPagamento)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums">{valorModuloFmt(p.valor)}</span>
                  <Badge
                    variant="outline"
                    className={
                      p.status === "pago"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                        : p.status === "expirado"
                          ? "bg-muted text-muted-foreground"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-700"
                    }
                  >
                    {p.status === "pago" ? "Pago" : p.status === "expirado" ? "Expirado" : "Em aberto"}
                  </Badge>
                  {p.status !== "pago" && p.status !== "expirado" && (
                    <Button
                      size="sm"
                      className="h-7 gap-1 bg-emerald-600 px-2 text-[10px] hover:bg-emerald-700"
                      onClick={() => setAutorizar(p)}
                    >
                      <ShieldCheck className="h-3 w-3" /> Autorizar
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <EmailAtivacao clienteId={clienteId} servico={modulo} ativo={Boolean(assinatura?.ativo)} modulo />

      <AutorizarPagamentoModal
        open={!!autorizar}
        onOpenChange={(v) => {
          if (!v) setAutorizar(null);
        }}
        dados={
          autorizar
            ? {
                descricao: nome,
                cliente: clienteNome,
                valor: autorizar.valor,
                forma: autorizar.tipo === "pix" ? "PIX" : "Boleto",
                dataGeracao: dataModuloFmt(autorizar.criadoEm),
                referencia: { label: "Vencimento", valor: dataModuloFmt(autorizar.vencimento) },
                aposAutorizacao: {
                  destaques: [
                    { label: "Acesso", valor: "Liberado" },
                    { label: "Período", valor: "+1 mês" },
                  ],
                  itens: [
                    "Mensalidade marcada como Pago",
                    "Comprovante salvo no histórico",
                    `${nome} liberado por mais 1 mês`,
                  ],
                },
              }
            : null
        }
        onConfirmar={async ({ comprovante, observacoes }) => {
          if (!autorizar) return;
          const r = await autorizarServicoComComprovante({
            pagamentoId: autorizar.id,
            clienteId,
            formaPagamento: autorizar.tipo,
            observacoes,
            comprovante,
          });
          if (!r.ok) {
            toast.error(r.error || "Erro ao autorizar pagamento");
            throw new Error("autorizacao_falhou");
          }
          toast.success(r.message || "Pagamento autorizado", {
            description: [
              r.validoAte ? `${nome} liberado até ${dataModuloFmt(r.validoAte)}.` : "",
              avisoEmailAtivacao(r.emailNotificacao),
            ]
              .filter(Boolean)
              .join(" "),
          });
          setAutorizar(null);
          onAlterado();
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Acompanhamentos do Licitações-e                                     */
/* ------------------------------------------------------------------ */

function LicitacoesEAdmin({
  clienteId,
  acessoEtapas,
  acompanhamentos,
  onAlterado,
}: {
  clienteId: number;
  acessoEtapas: number;
  acompanhamentos: Acompanhamento[];
  onAlterado: () => void;
}) {
  const ordenados = useMemo(
    () =>
      [...acompanhamentos].sort(
        (a, b) => Number(Boolean(b.apoioSolicitadoEm)) - Number(Boolean(a.apoioSolicitadoEm)),
      ),
    [acompanhamentos],
  );

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Licitações acompanhadas pelo cliente</h3>
          <p className="text-xs text-muted-foreground">
            Acesso ao portal: {acessoEtapas}/6 etapas concluídas · {acompanhamentos.length} licitação(ões)
          </p>
        </div>
      </div>
      {ordenados.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">O cliente ainda não adicionou licitações.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {ordenados.map((a) => (
            <AcompanhamentoAdmin key={a.id} clienteId={clienteId} a={a} onAlterado={onAlterado} />
          ))}
        </div>
      )}
    </Card>
  );
}

function AcompanhamentoAdmin({
  clienteId,
  a,
  onAlterado,
}: {
  clienteId: number;
  a: Acompanhamento;
  onAlterado: () => void;
}) {
  const [aberto, setAberto] = useState(Boolean(a.apoioSolicitadoEm));
  const [mensagem, setMensagem] = useState(a.observacaoCadbrasil ?? "");
  const [resolver, setResolver] = useState(Boolean(a.apoioSolicitadoEm));
  const [salvando, setSalvando] = useState(false);
  const apt = calcularAptidao(a.checklist);
  const situacao = SITUACOES_PORTAL.find((s) => s.id === a.situacaoPortal)?.label ?? a.situacaoPortal;

  const atualizar = async (campos: { situacaoPortal?: SituacaoPortal; resultado?: ResultadoLicitacao | null }) => {
    const r = await atualizarAcompanhamentoAdmin(clienteId, a.id, campos);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Acompanhamento atualizado");
    onAlterado();
  };

  const responder = async () => {
    setSalvando(true);
    const r = await responderApoioLicitacoesE(clienteId, a.id, mensagem.trim(), resolver);
    setSalvando(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(resolver ? "Apoio respondido e marcado como atendido" : "Orientação salva");
    onAlterado();
  };

  return (
    <div
      className={cn(
        "rounded-lg border",
        a.apoioSolicitadoEm ? "border-rose-300 bg-rose-50/40 dark:bg-rose-500/5" : "border-border/60",
      )}
    >
      <button
        type="button"
        className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-left"
        onClick={() => setAberto((v) => !v)}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {a.numeroLicitacao ? `Nº ${a.numeroLicitacao}` : `Licitação #${a.id}`}
            {a.orgao ? ` · ${a.orgao}` : ""}
          </p>
          <p className="truncate text-xs text-muted-foreground">{a.objeto || "Sem objeto informado"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          {a.apoioSolicitadoEm && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-1.5 py-0.5 font-semibold text-rose-700">
              <LifeBuoy className="h-3 w-3" /> Pediu apoio
            </span>
          )}
          <span className="rounded-full bg-sky-500/15 px-1.5 py-0.5 font-medium text-sky-700">{situacao}</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">
            Etapas {a.etapas.length}/9
          </span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">
            Checklist {apt.ok}/{apt.total}
          </span>
        </div>
      </button>

      {aberto && (
        <div className="space-y-3 border-t px-3 py-3 text-xs">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
            <span>Disputa: {dataHoraFmt(a.dataDisputa)}</span>
            {a.valorEstimado != null && <span>Valor estimado: {valorModuloFmt(a.valorEstimado)}</span>}
            {a.link && (
              <a href={a.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                Licitação no portal <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {a.editalUrl && (
              <a href={a.editalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                Edital {a.analiseEm ? "(lido com IA)" : ""} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {a.apoioSolicitadoEm && (
            <div className="rounded-lg border border-rose-200 bg-white p-3 dark:bg-transparent">
              <p className="flex items-center gap-1.5 font-semibold text-rose-800">
                <AlertTriangle className="h-3.5 w-3.5" /> Pedido de apoio em {dataHoraFmt(a.apoioSolicitadoEm)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                {a.apoioMensagem || "O cliente não escreveu mensagem."}
              </p>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 font-medium">
              Situação no portal
              <Select value={a.situacaoPortal} onValueChange={(v) => void atualizar({ situacaoPortal: v as SituacaoPortal })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SITUACOES_PORTAL.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1 font-medium">
              Resultado
              <Select
                value={a.resultado ?? "sem"}
                onValueChange={(v) => void atualizar({ resultado: v === "sem" ? null : (v as ResultadoLicitacao) })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem">Sem resultado ainda</SelectItem>
                  {RESULTADOS.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          <label className="block space-y-1 font-medium">
            Orientação da CADBRASIL (aparece para o cliente nesta licitação)
            <Textarea
              rows={3}
              className="text-xs"
              value={mensagem}
              placeholder="Ex.: Conferimos o edital. Falta o atestado de capacidade técnica — envie até 2 dias antes da disputa."
              onChange={(e) => setMensagem(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {a.apoioSolicitadoEm ? (
              <label className="flex items-center gap-2">
                <Checkbox checked={resolver} onCheckedChange={(v) => setResolver(v === true)} />
                Marcar pedido de apoio como atendido
              </label>
            ) : (
              <span />
            )}
            <Button
              size="sm"
              className="h-8 gap-1.5"
              disabled={salvando || (mensagem === (a.observacaoCadbrasil ?? "") && !(resolver && a.apoioSolicitadoEm))}
              onClick={() => void responder()}
            >
              {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {a.apoioSolicitadoEm ? "Responder cliente" : "Salvar orientação"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmailAtivacao({
  clienteId,
  servico,
  ativo,
  modulo,
}: {
  clienteId: number;
  servico: ServicoEmail;
  ativo: boolean;
  modulo?: boolean;
}) {
  const [enviando, setEnviando] = useState(false);
  const [abrindo, setAbrindo] = useState(false);

  const visualizar = async (renovacao: boolean) => {
    const janela = window.open("", "_blank");
    setAbrindo(true);
    const r = await previewEmailAtivacao(clienteId, servico, renovacao);
    setAbrindo(false);
    if (!r.ok) {
      janela?.close();
      toast.error(r.error);
      return;
    }
    if (janela) {
      janela.document.open();
      janela.document.write(r.html);
      janela.document.title = r.assunto;
      janela.document.close();
    }
  };

  const reenviar = async () => {
    setEnviando(true);
    const r = await reenviarEmailAtivacao(clienteId, servico);
    setEnviando(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(r.simulado ? "E-mail registrado (SMTP em modo simulação)" : `E-mail enviado para ${r.para}`);
  };

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex items-start gap-2.5">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
        <div className="text-xs">
          <p className="text-sm font-semibold">E-mail de ativação</p>
          <p className="text-muted-foreground">
            Enviado automaticamente ao cliente quando o pagamento é confirmado, com o passo a passo
            completo{modulo ? ". Renovações recebem um aviso curto." : "."}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={abrindo} onClick={() => void visualizar(false)}>
          <Eye className="h-3.5 w-3.5" /> Visualizar
        </Button>
        {modulo && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={abrindo} onClick={() => void visualizar(true)}>
            <Eye className="h-3.5 w-3.5" /> Renovação
          </Button>
        )}
        <Button
          size="sm"
          className="h-8 gap-1.5"
          disabled={!ativo || enviando}
          title={ativo ? "Reenviar ao e-mail cadastrado do cliente" : "Disponível após o pagamento ser confirmado"}
          onClick={() => void reenviar()}
        >
          {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Reenviar ao cliente
        </Button>
      </div>
    </Card>
  );
}

function Mini({
  label,
  valor,
  tom,
  destaque,
}: {
  label: string;
  valor: string;
  tom?: "ok" | "warn";
  destaque?: boolean;
}) {
  return (
    <Card className={cn("p-3", destaque && "border-indigo-200 bg-indigo-50/40 dark:bg-indigo-500/5")}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-sm font-bold",
          tom === "ok" && "text-emerald-700",
          tom === "warn" && "text-amber-700",
        )}
      >
        {valor}
      </p>
    </Card>
  );
}
