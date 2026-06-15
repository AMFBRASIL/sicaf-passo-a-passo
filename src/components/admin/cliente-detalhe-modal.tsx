import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NivelDots, NIVEIS_SICAF, type NivelStatus } from "./nivel-dots";
import { CopyButton } from "@/components/copy-button";
import {
  Phone,
  Mail,
  MessageCircle,
  FileCheck2,
  DollarSign,
  Ticket,
  FolderOpen,
  RefreshCw,
  Download,
  Edit3,
  Wrench,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Sparkles,
  Plus,
  CreditCard,
  History,
  LayoutGrid,
  KeyRound,
  Eye,
  EyeOff,
  Shield,
  ExternalLink,
  Copy,
  Loader2,
} from "lucide-react";
import { AcoesTab } from "./cliente-acoes";
import { SituacaoTab } from "./cliente-situacao-tab";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  atualizarAdminCliente,
  fetchAdminClienteDetalhe,
  fetchAdminClienteFinanceiro,
  fetchAdminTicketsCliente,
  fetchAdminClienteDocumentos,
  downloadCertificadoDigital,
  flattenChecklistDocumentos,
  mapFinanceiroToFaturas,
  autorizarPagamentoComComprovante,
  novaValidadeSicafAposPagamento,
  diasAteNovaValidadeSicaf,
  parseTaxaIdFromFaturaId,
  mapHistoricoFromApi,
  mapTicketsToUi,
  mergeDetalheFromApi,
  type DocumentoUi,
  type DocumentosPainelUi,
  type FaturaUi,
  type HistoricoUi,
} from "@/lib/admin-clientes-api";
import { toast } from "sonner";
import wizardBg from "@/assets/wizard-bg.jpg";
import { Check, X as XIcon } from "lucide-react";
import { PagamentoSicafModal } from "@/components/pagamento-sicaf-modal";
import { AutorizarPagamentoModal } from "@/components/admin/autorizar-pagamento-modal";
import { CancelarFaturaModal } from "@/components/admin/cancelar-fatura-modal";
import { TicketRespostaModal, type TicketItem } from "@/components/admin/ticket-resposta-modal";
import { RenovarSicafModal } from "@/components/admin/renovar-sicaf-modal";
import { EditarClienteModal } from "@/components/admin/editar-cliente-modal";
import { ManutencaoModal } from "@/components/manutencao-modal";
import type { EmpresaData } from "@/routes/empresas";

export interface ClienteDetalhe {
  id: string;
  razao: string;
  cnpj: string;
  responsavel: string;
  cidade: string;
  email?: string;
  telefone?: string;
  sicaf: "ok" | "pendente" | "vencido";
  pagou: boolean;
  manutencao: boolean;
  novo: boolean;
  mrr: number;
  ultimoContato: string;
  niveis: Record<number, NivelStatus>;
  plano?: string;
  desde?: string;
  validadeSicaf?: string;
  ltv?: number;
}

interface Props {
  cliente: ClienteDetalhe | null;
  grupoEmpresas?: ClienteDetalhe[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated?: () => void;
  onSelectEmpresa?: (empresa: ClienteDetalhe) => void;
  onVerTodasEmpresas?: () => void;
}

const sicafTone: Record<string, string> = {
  ok: "bg-success/10 text-success ring-1 ring-success/30",
  pendente: "bg-warning/10 text-warning-foreground ring-1 ring-warning/30",
  vencido: "bg-danger/10 text-danger ring-1 ring-danger/30",
};

const STEPS = [
  { key: "resumo", label: "Resumo", desc: "Visão geral e saúde", icon: Sparkles },
  { key: "sicaf", label: "SICAF", desc: "Níveis I a VI", icon: FileCheck2 },
  { key: "financeiro", label: "Financeiro", desc: "Faturas e MRR", icon: DollarSign },
  { key: "documentos", label: "Documentos", desc: "Certidões e contratos", icon: FolderOpen },
  { key: "suporte", label: "Suporte", desc: "Tickets e SLA", icon: Ticket },
  { key: "historico", label: "Histórico", desc: "Linha do tempo", icon: History },
  { key: "situacao", label: "Situação", desc: "Status manual do SICAF", icon: ShieldCheck },
  { key: "acoes", label: "Ações", desc: "Funcionalidades do cliente", icon: LayoutGrid },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export function ClienteDetalheModal({
  cliente,
  grupoEmpresas,
  open,
  onOpenChange,
  onUpdated,
  onSelectEmpresa,
  onVerTodasEmpresas,
}: Props) {
  const [step, setStep] = useState<StepKey>("resumo");
  const [renovarOpen, setRenovarOpen] = useState(false);
  const [renovarPagOpen, setRenovarPagOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [manutOpen, setManutOpen] = useState(false);
  const [detalhe, setDetalhe] = useState<ClienteDetalhe | null>(null);
  const [faturas, setFaturas] = useState<FaturaUi[]>([]);
  const [documentosPainel, setDocumentosPainel] = useState<DocumentosPainelUi | null>(null);
  const [tickets, setTickets] = useState<ReturnType<typeof mapTicketsToUi>>([]);
  const [historico, setHistorico] = useState<HistoricoUi[]>([]);

  const recarregarDados = useCallback(async (baseCliente: ClienteDetalhe) => {
    const clienteId = parseInt(baseCliente.id, 10);
    if (!Number.isFinite(clienteId)) return;

    const [det, fin, tks, docs] = await Promise.all([
      fetchAdminClienteDetalhe(clienteId),
      fetchAdminClienteFinanceiro(clienteId),
      fetchAdminTicketsCliente(clienteId),
      fetchAdminClienteDocumentos(clienteId),
    ]);

    if (det.ok && det.client) {
      const merged = mergeDetalheFromApi(baseCliente, det.client);
      setDetalhe(merged);
      setHistorico(mapHistoricoFromApi(det.client.historico, det.client.loginLogs));
    }

    if (fin.ok && fin.financeiro) {
      setFaturas(mapFinanceiroToFaturas(fin.financeiro));
    }

    if (tks.ok && tks.tickets) {
      setTickets(mapTicketsToUi(tks.tickets));
    }

    if (docs.ok && docs.painel) {
      setDocumentosPainel(docs.painel);
    } else {
      setDocumentosPainel(null);
    }
  }, []);

  const atualizarPainel = useCallback(() => {
    const base = detalhe || cliente;
    if (!base) return;
    void recarregarDados(base);
    onUpdated?.();
  }, [cliente, detalhe, onUpdated, recarregarDados]);

  useEffect(() => {
    if (!open || !cliente) return;
    const clienteId = parseInt(cliente.id, 10);
    if (!Number.isFinite(clienteId)) return;

    setStep("resumo");
    setDetalhe(cliente);
    void recarregarDados(cliente);
  }, [open, cliente?.id, recarregarDados]);

  const exibicao = detalhe || cliente;
  if (!cliente || !exibicao) return null;

  const iniciais = exibicao.razao
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("");

  const validados = Object.values(exibicao.niveis).filter((s) => s === "validado").length;
  const totalNiveis = NIVEIS_SICAF.length;
  const completude = Math.round((validados / totalNiveis) * 100);

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">{exibicao.razao}</DialogTitle>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] min-h-[640px]">
          {/* LEFT WIZARD RAIL */}
          <aside
            className="relative hidden md:flex flex-col p-5 text-white overflow-hidden"
            style={{
              backgroundImage: `linear-gradient(180deg, oklch(0.28 0.12 248 / 0.92), oklch(0.18 0.08 250 / 0.96)), url(${wizardBg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="flex items-center gap-2.5">
              <Avatar className="h-10 w-10 ring-2 ring-white/30">
                <AvatarFallback className="bg-white/15 text-sm font-bold text-white">
                  {iniciais}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{exibicao.razao}</p>
                <div className="flex items-center gap-0.5 min-w-0">
                  <p className="text-[11px] font-mono text-white/70 truncate">{exibicao.cnpj}</p>
                  <CopyButton
                    value={exibicao.cnpj}
                    label="CNPJ"
                    className="h-6 w-6 shrink-0 text-white/70 hover:text-white hover:bg-white/10 [&_svg]:text-inherit"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/70">
                <span>Progresso</span>
                <span>{progress}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-white/90 to-white/60 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <nav className="mt-5 space-y-1 flex-1 overflow-y-auto pr-1 -mr-1">
              {STEPS.map((s, i) => {
                const active = s.key === step;
                const done = i < stepIndex;
                return (
                  <button
                    key={s.key}
                    onClick={() => setStep(s.key)}
                    className={`group flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition ${
                      active
                        ? "bg-white text-foreground shadow-lg"
                        : "text-white/85 hover:bg-white/10"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : done
                            ? "bg-white/90 text-primary"
                            : "bg-white/15 text-white"
                      }`}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-semibold leading-tight ${active ? "text-foreground" : ""}`}>
                        {s.label}
                      </p>
                      <p
                        className={`text-[11px] leading-tight ${
                          active ? "text-muted-foreground" : "text-white/60"
                        }`}
                      >
                        {s.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </nav>

            {grupoEmpresas && grupoEmpresas.length > 1 && (
              <div className="mt-3 rounded-lg bg-white/10 p-2.5 backdrop-blur">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-wider text-white/70">
                    CNPJs vinculados ({grupoEmpresas.length})
                  </p>
                  {onVerTodasEmpresas && (
                    <button
                      type="button"
                      onClick={onVerTodasEmpresas}
                      className="text-[10px] font-medium text-white/90 underline-offset-2 hover:underline"
                    >
                      Ver lista
                    </button>
                  )}
                </div>
                <div className="mt-2 max-h-28 space-y-1 overflow-y-auto pr-0.5">
                  {grupoEmpresas.map((emp) => {
                    const ativo = emp.id === exibicao.id;
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => onSelectEmpresa?.(emp)}
                        className={`w-full rounded-md px-2 py-1.5 text-left transition ${
                          ativo ? "bg-white text-foreground shadow-sm" : "text-white/85 hover:bg-white/10"
                        }`}
                      >
                        <p className="truncate text-[11px] font-semibold leading-tight">{emp.razao}</p>
                        <p className="truncate font-mono text-[10px] opacity-80">{emp.cnpj}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-4 rounded-lg bg-white/10 p-3 backdrop-blur">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/70">
                <ShieldCheck className="h-3 w-3" /> SICAF
              </div>
              <p className="mt-0.5 text-lg font-bold">{completude}% completo</p>
              <div className="mt-2">
                <NivelDots niveis={exibicao.niveis} size="sm" />
              </div>
            </div>
          </aside>

          {/* RIGHT CONTENT */}
          <section className="flex min-w-0 flex-col">
            {/* Header */}
            <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-5 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold tracking-tight truncate">
                    {STEPS[stepIndex].label}
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sicafTone[exibicao.sicaf]}`}
                  >
                    SICAF{" "}
                    {exibicao.sicaf === "ok"
                      ? "OK"
                      : exibicao.sicaf === "pendente"
                        ? "Pendente"
                        : "Vencido"}
                  </span>
                  {exibicao.novo && (
                    <Badge className="bg-blue-500 text-white border-0 text-[10px]">Novo</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Etapa {stepIndex + 1} de {STEPS.length} · {STEPS[stepIndex].desc}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-8 gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Ligar
                </Button>
                <Button size="sm" variant="ghost" className="h-8 gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </Button>
                <Button size="sm" variant="ghost" className="h-8 gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> E-mail
                </Button>
              </div>
            </header>

            {/* Content */}
            <ScrollArea className="flex-1 max-h-[520px]">
              <div className="min-w-0 p-5">
                {step === "resumo" && (
                  <ResumoTab cliente={exibicao} completude={completude} faturas={faturas} />
                )}
                {step === "sicaf" && <SicafTab cliente={exibicao} onRenovar={() => setRenovarOpen(true)} />}
                {step === "financeiro" && (
                  <FinanceiroTab cliente={exibicao} faturasIniciais={faturas} onPagamentoAutorizado={atualizarPainel} />
                )}
                {step === "documentos" && (
                  <DocumentosTab painel={documentosPainel} clienteId={parseInt(exibicao.id, 10)} />
                )}
                {step === "suporte" && <SuporteTab cliente={exibicao} tickets={tickets} />}
                {step === "historico" && <HistoricoTab eventos={historico} />}
                {step === "situacao" && (
                  <SituacaoTab
                    cliente={exibicao}
                    clienteId={parseInt(exibicao.id, 10)}
                    onUpdated={atualizarPainel}
                  />
                )}
                {step === "acoes" && <AcoesTab cliente={exibicao} clienteId={parseInt(exibicao.id, 10)} />}
              </div>
            </ScrollArea>

            {/* Footer */}
            <footer className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-5 py-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={stepIndex === 0}
                  onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)].key)}
                >
                  Voltar
                </Button>
                {stepIndex < STEPS.length - 1 ? (
                  <Button
                    size="sm"
                    onClick={() => setStep(STEPS[stepIndex + 1].key)}
                  >
                    Próxima etapa
                  </Button>
                ) : (
                  <Button size="sm" className="gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Concluir revisão
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditarOpen(true)}>
                  <Edit3 className="h-3.5 w-3.5" /> Editar
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setManutOpen(true)}>
                  <Wrench className="h-3.5 w-3.5" /> Manutenção
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => setRenovarOpen(true)}>
                  <RefreshCw className="h-3.5 w-3.5" /> Renovar SICAF
                </Button>
              </div>
            </footer>
          </section>
        </div>
      </DialogContent>
      <RenovarSicafModal
        open={renovarOpen}
        onOpenChange={setRenovarOpen}
        cliente={{ razao: exibicao.razao, cnpj: exibicao.cnpj }}
        validade={exibicao.validadeSicaf ?? "05/06/2027"}
        onGerarTaxa={() => {
          setRenovarOpen(false);
          setRenovarPagOpen(true);
        }}
      />
      <PagamentoSicafModal
        open={renovarPagOpen}
        onOpenChange={setRenovarPagOpen}
        empresa={{
          nome: exibicao.razao,
          cnpj: exibicao.cnpj,
          clienteId: parseInt(exibicao.id, 10),
        }}
        onGerado={() => {
          setStep("financeiro");
          atualizarPainel();
        }}
        onPago={() => {
          setStep("financeiro");
          atualizarPainel();
        }}
      />
      <EditarClienteModal
        cliente={exibicao}
        open={editarOpen}
        onOpenChange={setEditarOpen}
        onSalvar={async (data) => {
          const res = await atualizarAdminCliente(parseInt(exibicao.id, 10), { ...data });
          if (!res.ok) {
            toast.error(res.error || "Erro ao salvar");
            return false;
          }
          toast.success("Cliente atualizado");
          onUpdated?.();
          return true;
        }}
      />
      <ManutencaoModal
        open={manutOpen}
        onOpenChange={setManutOpen}
        mode={exibicao.manutencao ? "gerenciar" : "ativar"}
        diaVencimento={10}
        onAtivar={() => {
          setDetalhe((d) => (d ? { ...d, manutencao: true } : d));
          atualizarPainel();
        }}
        onCancelar={() => {
          setDetalhe((d) => (d ? { ...d, manutencao: false } : d));
          atualizarPainel();
        }}
        onPaymentGenerated={atualizarPainel}
        empresa={{
          clienteId: parseInt(exibicao.id, 10),
          nome: exibicao.razao,
          cnpj: exibicao.cnpj,
          sicaf: "ativo",
          proximoPasso: "",
          acao: { label: "", icon: CreditCard as never },
          endereco: "",
          cidade: exibicao.cidade,
          uf: "",
          telefone: exibicao.telefone ?? "",
          email: exibicao.email ?? "",
          responsavel: exibicao.responsavel,
          inscricaoEstadual: "",
          inscricaoMunicipal: "",
          ramoAtividade: "",
        } as unknown as EmpresaData}
      />
    </Dialog>
  );
}


/* ---------- TABS ---------- */

type ResumoCardTone = "ok" | "warn" | "danger" | "muted";

function parseBrDate(value?: string | null): Date | null {
  if (!value || value === "—") return null;
  const br = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const d = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = new Date(value);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function diasAteVencimento(validade?: string | null): number | null {
  const fim = parseBrDate(validade);
  if (!fim) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  fim.setHours(0, 0, 0, 0);
  return Math.ceil((fim.getTime() - hoje.getTime()) / 86_400_000);
}

function formatVigenciaSicaf(validade: string, dias: number): string {
  if (dias <= 0) return `Venceu em ${validade}`;
  if (dias === 1) return `Vence amanhã (${validade})`;
  if (dias <= 30) return `Vence em ${dias} dias (${validade})`;
  if (dias <= 60) return `Válido até ${validade} · faltam ${dias} dias`;
  return `Válido até ${validade}`;
}

function faturasSicafOnly(faturas: FaturaUi[]) {
  return faturas.filter((f) => !/^manuten[cç][aã]o\b/i.test(f.desc.trim()));
}

function derivePagamentoSicafCard(cliente: ClienteDetalhe, faturas: FaturaUi[]) {
  const faturasSicaf = faturasSicafOnly(faturas);
  const emAberto = faturasSicaf.filter((f) => f.status === "aberto");
  const pagas = faturasSicaf.filter((f) => f.status === "pago");

  const validade = cliente.validadeSicaf;
  const dias = diasAteVencimento(validade);
  const vigente =
    dias !== null &&
    dias > 0 &&
    cliente.sicaf !== "vencido";
  const vencendoEmBreve = vigente && dias !== null && dias <= 30;

  if (vigente && validade) {
    const vigenciaTxt = formatVigenciaSicaf(validade, dias!);
    if (emAberto.length > 0) {
      const prox = emAberto[0];
      const abertoTxt =
        prox.venc !== "—" ? ` · renovação em aberto (venc. ${prox.venc})` : " · renovação em aberto";
      return {
        tone: (vencendoEmBreve ? "warn" : "ok") as ResumoCardTone,
        status: vencendoEmBreve ? "Vencendo" : "Vigente",
        detail: `${vigenciaTxt}${abertoTxt}`,
      };
    }
    if (pagas.length > 0 || cliente.pagou || cliente.sicaf === "ok") {
      return {
        tone: (vencendoEmBreve || cliente.sicaf === "pendente" ? "warn" : "ok") as ResumoCardTone,
        status:
          vencendoEmBreve || cliente.sicaf === "pendente" ? "Vencendo" : "Pago e válido",
        detail: vigenciaTxt,
      };
    }
    return {
      tone: (vencendoEmBreve ? "warn" : "ok") as ResumoCardTone,
      status: "Vigente",
      detail: vigenciaTxt,
    };
  }

  if (dias !== null && dias <= 0) {
    if (emAberto.length > 0) {
      const prox = emAberto[0];
      return {
        tone: "danger" as ResumoCardTone,
        status: "Vencido",
        detail: `Credenciamento expirou${validade ? ` em ${validade}` : ""}${
          prox.venc !== "—" ? ` · taxa em aberto (venc. ${prox.venc})` : ""
        }`,
      };
    }
    return {
      tone: "danger" as ResumoCardTone,
      status: "Vencido",
      detail: validade ? `Validade expirada em ${validade}` : "Sem credenciamento vigente",
    };
  }

  if (emAberto.length > 0) {
    const prox = emAberto[0];
    return {
      tone: "warn" as ResumoCardTone,
      status: "Pendente",
      detail: `${emAberto.length} taxa(s) em aberto${
        prox.venc !== "—" ? ` · venc. ${prox.venc}` : ""
      } · sem vigência ativa no cadastro`,
    };
  }

  if (pagas.length > 0) {
    return {
      tone: "warn" as ResumoCardTone,
      status: "Verificar vigência",
      detail: "Há pagamento registrado, mas sem data de validade no cadastro SICAF",
    };
  }

  return {
    tone: "danger" as ResumoCardTone,
    status: "Sem vigência",
    detail: "Nenhum credenciamento SICAF vigente no sistema",
  };
}

function deriveSicafNiveisCard(cliente: ClienteDetalhe, completude: number) {
  const niveis = Object.values(cliente.niveis);
  const validados = niveis.filter((s) => s === "validado").length;
  const vencidos = niveis.filter((s) => s === "vencido").length;
  const pendentes = niveis.filter((s) => s === "pendente" || s === "vencendo").length;

  if (cliente.sicaf === "vencido" || vencidos > 0) {
    return {
      tone: "danger" as ResumoCardTone,
      status: "Desatualizado",
      detail:
        vencidos > 0
          ? `${vencidos} nível(is) vencido(s) — renovação necessária`
          : "Cadastro SICAF vencido — renovar imediatamente",
    };
  }
  if (cliente.sicaf === "pendente" || pendentes > 0) {
    return {
      tone: "warn" as ResumoCardTone,
      status: "Atenção",
      detail: `${validados}/6 níveis validados — há pendências de atualização`,
    };
  }
  if (validados >= 2 && completude >= 33) {
    return {
      tone: "ok" as ResumoCardTone,
      status: "Em ordem",
      detail: `${validados}/6 níveis validados e atualizados`,
    };
  }
  return {
    tone: "warn" as ResumoCardTone,
    status: "Incompleto",
    detail: `${validados}/6 níveis validados — cadastro ainda em andamento`,
  };
}

function deriveManutencaoCard(cliente: ClienteDetalhe) {
  if (cliente.manutencao) {
    return {
      tone: "ok" as ResumoCardTone,
      status: "Ativa",
      detail: cliente.plano ? `Plano ${cliente.plano}` : "Plano de manutenção mensal ativo",
    };
  }
  return {
    tone: "muted" as ResumoCardTone,
    status: "Inativa",
    detail: "Nenhum plano de manutenção contratado",
  };
}

function ResumoStatusCard({
  icon: Icon,
  titulo,
  subtitulo,
  status,
  detail,
  tone,
}: {
  icon: React.ElementType;
  titulo: string;
  subtitulo: string;
  status: string;
  detail: string;
  tone: ResumoCardTone;
}) {
  const styles: Record<
    ResumoCardTone,
    { ring: string; iconBg: string; iconFg: string; badge: string }
  > = {
    ok: {
      ring: "ring-success/25 border-success/20",
      iconBg: "bg-success/10",
      iconFg: "text-success",
      badge: "bg-success/10 text-success ring-success/30",
    },
    warn: {
      ring: "ring-warning/30 border-warning/25",
      iconBg: "bg-warning/10",
      iconFg: "text-warning-foreground",
      badge: "bg-warning/10 text-warning-foreground ring-warning/40",
    },
    danger: {
      ring: "ring-danger/30 border-danger/25",
      iconBg: "bg-danger/10",
      iconFg: "text-danger",
      badge: "bg-danger/10 text-danger ring-danger/30",
    },
    muted: {
      ring: "ring-border border-border",
      iconBg: "bg-muted",
      iconFg: "text-muted-foreground",
      badge: "bg-muted text-muted-foreground ring-border",
    },
  };
  const s = styles[tone];

  return (
    <Card className={`p-4 ring-1 ${s.ring}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.iconBg}`}>
          <Icon className={`h-5 w-5 ${s.iconFg}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {subtitulo}
          </p>
          <p className="text-sm font-bold leading-tight">{titulo}</p>
          <span
            className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${s.badge}`}
          >
            {status}
          </span>
          <p className="mt-2 text-xs text-muted-foreground leading-snug">{detail}</p>
        </div>
      </div>
    </Card>
  );
}

function ResumoTab({
  cliente,
  completude,
  faturas = [],
}: {
  cliente: ClienteDetalhe;
  completude: number;
  faturas?: FaturaUi[];
}) {
  const sicafNiveis = deriveSicafNiveisCard(cliente, completude);
  const pagamentoSicaf = derivePagamentoSicafCard(cliente, faturas);
  const manutencao = deriveManutencaoCard(cliente);

  const alerts: { tone: "danger" | "warn" | "ok"; text: string; icon: typeof AlertTriangle }[] = [];
  if (cliente.sicaf === "vencido")
    alerts.push({ tone: "danger", text: "SICAF vencido — renovar imediatamente", icon: AlertTriangle });
  if (!cliente.pagou)
    alerts.push({ tone: "danger", text: "Cliente inadimplente neste ciclo", icon: AlertTriangle });
  if (cliente.sicaf === "pendente")
    alerts.push({ tone: "warn", text: "Há níveis SICAF pendentes de validação", icon: AlertTriangle });
  if (!alerts.length)
    alerts.push({ tone: "ok", text: "Tudo em dia — cliente saudável", icon: CheckCircle2 });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ResumoStatusCard
          icon={ShieldCheck}
          subtitulo="Cadastro"
          titulo="SICAF — Níveis"
          status={sicafNiveis.status}
          detail={sicafNiveis.detail}
          tone={sicafNiveis.tone}
        />
        <ResumoStatusCard
          icon={CreditCard}
          subtitulo="Taxa anual"
          titulo="Pagamento SICAF"
          status={pagamentoSicaf.status}
          detail={pagamentoSicaf.detail}
          tone={pagamentoSicaf.tone}
        />
        <ResumoStatusCard
          icon={Wrench}
          subtitulo="Plano mensal"
          titulo="Manutenção"
          status={manutencao.status}
          detail={manutencao.detail}
          tone={manutencao.tone}
        />
      </div>

    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2 p-4">
        <h3 className="text-sm font-semibold">Situação do cliente</h3>
        <div className="mt-3 space-y-2">
          {alerts.map((a, i) => {
            const cls =
              a.tone === "danger"
                ? "bg-danger/10 text-danger ring-danger/30"
                : a.tone === "warn"
                  ? "bg-warning/10 text-warning-foreground ring-warning/40"
                  : "bg-success/10 text-success ring-success/30";
            return (
              <div
                key={i}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium ring-1 ${cls}`}
              >
                <a.icon className="h-3.5 w-3.5" />
                {a.text}
              </div>
            );
          })}
        </div>

        <Separator className="my-4" />

        <h3 className="text-sm font-semibold">Saúde da conta</h3>
        <div className="mt-3 space-y-3">
          <HealthBar label="SICAF completude" value={completude} tone="primary" />
          <HealthBar
            label="Pagamentos em dia"
            value={cliente.pagou ? 100 : 30}
            tone={cliente.pagou ? "ok" : "danger"}
          />
          <HealthBar
            label="Engajamento (últimos 30d)"
            value={72}
            tone="primary"
          />
          <HealthBar label="Risco de cancelamento" value={cliente.pagou ? 12 : 78} tone="danger" />
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold">Contato & Plano</h3>
        <div className="mt-3 space-y-2.5 text-sm">
          <InfoLine icon={Phone} label="Telefone" value={cliente.telefone ?? "(61) 99999-0000"} />
          <InfoLine icon={Mail} label="E-mail" value={cliente.email ?? "contato@cliente.com.br"} />
          <InfoLine icon={Sparkles} label="Plano" value={cliente.plano ?? "Manutenção SICAF"} />
          <InfoLine
            icon={Calendar}
            label="Validade SICAF"
            value={cliente.validadeSicaf ?? "—"}
          />
        </div>
        <Separator className="my-4" />
        <h3 className="text-sm font-semibold">Próximas ações</h3>
        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          <li>• Validar Certidão Trabalhista (CNDT)</li>
          <li>• Confirmar recebimento do boleto #4821</li>
          <li>• Agendar revisão trimestral</li>
        </ul>
      </Card>
    </div>
    </div>
  );
}

function InfoLine({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground w-24">{label}</span>
      <span className="font-medium truncate">{value}</span>
    </div>
  );
}

function HealthBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "ok" | "danger";
}) {
  const bar =
    tone === "ok"
      ? "[&>div]:bg-success"
      : tone === "danger"
        ? "[&>div]:bg-danger"
        : "[&>div]:bg-primary";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}%</span>
      </div>
      <Progress value={value} className={`h-1.5 ${bar}`} />
    </div>
  );
}

function SicafTab({ cliente, onRenovar }: { cliente: ClienteDetalhe; onRenovar?: () => void }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Níveis SICAF</h3>
          <p className="text-xs text-muted-foreground">
            Status detalhado por nível — clique em renovar quando vencido.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={onRenovar}>
          <RefreshCw className="h-3.5 w-3.5" /> Renovar agora
        </Button>
      </div>
      <div className="mt-4 grid gap-2">
        {NIVEIS_SICAF.map((n) => {
          const status = cliente.niveis[n.num] ?? "nao_cadastrado";
          const meta: Record<
            NivelStatus,
            { txt: string; cls: string }
          > = {
            validado: { txt: "Validado", cls: "bg-success/10 text-success" },
            vencendo: { txt: "Vencendo", cls: "bg-warning/10 text-warning-foreground" },
            vencido: { txt: "Vencido", cls: "bg-danger/10 text-danger" },
            pendente: { txt: "Pendente", cls: "bg-warning/10 text-warning-foreground" },
            nao_cadastrado: { txt: "Não cadastrado", cls: "bg-muted text-muted-foreground" },
          };
          return (
            <div
              key={n.num}
              className="flex items-center justify-between rounded-md border bg-card px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: n.color }}
                >
                  {n.roman}
                </span>
                <div>
                  <p className="text-sm font-medium">Nível {n.roman}</p>
                  <p className="text-xs text-muted-foreground">{n.nome}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta[status].cls}`}
                >
                  {meta[status].txt}
                </span>
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  Ver detalhe
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

type FaturaItem = FaturaUi & {
  motivoCancelamento?: string;
};

function FinanceiroTab({
  cliente,
  faturasIniciais = [],
  onPagamentoAutorizado,
}: {
  cliente: ClienteDetalhe;
  faturasIniciais?: FaturaUi[];
  onPagamentoAutorizado?: () => void;
}) {
  const [autorizarOpen, setAutorizarOpen] = useState(false);
  const [faturaAtiva, setFaturaAtiva] = useState<FaturaItem | null>(null);
  const [cancelarOpen, setCancelarOpen] = useState(false);
  const [faturaCancelId, setFaturaCancelId] = useState<string | null>(null);

  const faturasSicaf = useMemo(
    () => faturasIniciais.filter((f) => !/^manuten[cç][aã]o\b/i.test(f.desc.trim())),
    [faturasIniciais],
  );

  const [faturas, setFaturas] = useState<FaturaItem[]>(faturasSicaf);

  useEffect(() => {
    setFaturas(faturasSicaf);
  }, [faturasSicaf]);

  const totalEmAberto = faturas
    .filter((f) => f.status === "aberto")
    .reduce((acc, f) => acc + f.valor, 0);

  const totalFaturado12m = faturas
    .filter((f) => f.status === "pago")
    .reduce((acc, f) => acc + f.valor, 0);

  const formaPreferida = useMemo(() => {
    const pix = faturas.filter((f) => f.forma === "PIX").length;
    const boleto = faturas.filter((f) => f.forma === "Boleto").length;
    if (pix > boleto) return "PIX";
    if (boleto > pix) return "Boleto";
    return faturas[0]?.forma ?? "—";
  }, [faturas]);

  const abrirAutorizar = (f: FaturaItem) => {
    setFaturaAtiva(f);
    setAutorizarOpen(true);
  };
  const abrirCancelar = (id: string) => {
    setFaturaCancelId(id);
    setCancelarOpen(true);
  };
  const confirmarCancelamento = (id: string, motivo: string) => {
    setFaturas((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: "cancelado", motivoCancelamento: motivo } : f)),
    );
  };
  const confirmarAutorizacao = async (payload: { comprovante: File; observacoes?: string }) => {
    if (!faturaAtiva) return;
    const taxaId = faturaAtiva.taxaId ?? parseTaxaIdFromFaturaId(faturaAtiva.id);
    const clienteId = parseInt(cliente.id, 10);
    if (!taxaId) {
      toast.error("Não foi possível identificar a taxa SICAF.");
      throw new Error("taxa_invalida");
    }
    if (!Number.isFinite(clienteId)) {
      toast.error("Cliente inválido.");
      throw new Error("cliente_invalido");
    }

    const res = await autorizarPagamentoComComprovante({
      taxaId,
      clienteId,
      pagamentoId: faturaAtiva.pagamentoId,
      formaPagamento: faturaAtiva.forma,
      valor: faturaAtiva.valor,
      observacoes: payload.observacoes,
      comprovante: payload.comprovante,
    });

    if (!res.ok) {
      toast.error(res.error || "Erro ao autorizar pagamento");
      throw new Error("autorizacao_falhou");
    }

    toast.success(res.message || "Pagamento autorizado e comprovante registrado");
    setFaturas((prev) =>
      prev.map((f) =>
        f.id === faturaAtiva.id
          ? { ...f, status: "pago", dataPago: new Date().toLocaleDateString("pt-BR") }
          : f,
      ),
    );
    onPagamentoAutorizado?.();
  };

  const statusMeta: Record<FaturaItem["status"], { cls: string; txt: string }> = {
    pago: { cls: "bg-success/10 text-success", txt: "Pago" },
    aberto: { cls: "bg-danger/10 text-danger", txt: "Aberto" },
    cancelado: { cls: "bg-muted text-muted-foreground line-through", txt: "Cancel." },
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="MRR" value={`R$ ${(cliente.mrr || 0).toLocaleString("pt-BR")}`} />
        <MiniStat label="Total faturado (12m)" value={`R$ ${totalFaturado12m.toLocaleString("pt-BR")}`} />
        <MiniStat
          label="Em aberto"
          value={`R$ ${totalEmAberto.toLocaleString("pt-BR")}`}
          tone={totalEmAberto > 0 ? "danger" : "ok"}
        />
        <MiniStat label="Método preferido" value={formaPreferida} />
      </div>
      <Card className="min-w-0 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Faturas</h3>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Exportar
          </Button>
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border">
          <table className="w-full table-fixed text-xs">
            <colgroup>
              <col className="w-[52px]" />
              <col className="w-[72px]" />
              <col className="w-[52px]" />
              <col className="w-[68px]" />
              <col className="w-[68px]" />
              <col className="w-[68px]" />
              <col className="w-[64px]" />
              <col className="w-[72px]" />
              <col className="w-[118px]" />
            </colgroup>
            <thead>
              <tr className="border-b bg-muted/30 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2 font-medium">Fatura</th>
                <th className="px-2 py-2 font-medium">Descrição</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Forma</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Gerado</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Vence</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Pago</th>
                <th className="px-2 py-2 font-medium text-right whitespace-nowrap">Valor</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Status</th>
                <th className="px-2 py-2 font-medium text-right whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody>
              {faturas.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-2 py-8 text-center text-sm text-muted-foreground">
                    Nenhuma fatura SICAF registrada.
                  </td>
                </tr>
              )}
              {faturas.map((f) => (
                <tr key={f.id} className="border-b border-border/40 last:border-0">
                  <td className="px-2 py-2 font-mono whitespace-nowrap align-middle">{f.id}</td>
                  <td className="px-2 py-2 align-middle truncate" title={f.desc}>
                    {f.desc}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap align-middle">
                    <Badge
                      variant="outline"
                      className={`rounded-full px-1.5 py-0 text-[9px] font-semibold ${
                        f.forma === "PIX"
                          ? "bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/20"
                          : "bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/20"
                      }`}
                    >
                      {f.forma}
                    </Badge>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap align-middle tabular-nums">
                    {f.dataGeracao}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap align-middle tabular-nums">
                    {f.venc}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap align-middle tabular-nums">
                    {f.status === "pago" ? f.dataPago : "—"}
                  </td>
                  <td className="px-2 py-2 text-right font-medium whitespace-nowrap tabular-nums align-middle">
                    {f.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap align-middle">
                    <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusMeta[f.status].cls}`}>
                      {statusMeta[f.status].txt}
                    </span>
                  </td>
                  <td className="px-2 py-2 align-middle">
                    {f.status === "aberto" ? (
                      <div className="flex flex-nowrap justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          title="Cancelar fatura"
                          aria-label="Cancelar fatura"
                          className="h-7 w-7 shrink-0 p-0 border-danger/30 text-danger hover:bg-danger/10 hover:text-danger"
                          onClick={() => abrirCancelar(f.id)}
                        >
                          <XIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          title="Autorizar pagamento"
                          aria-label="Autorizar pagamento"
                          className="h-7 shrink-0 px-2 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => abrirAutorizar(f)}
                        >
                          <ShieldCheck className="h-3 w-3 shrink-0" />
                          Autorizar
                        </Button>
                      </div>
                    ) : (
                      <span className="block text-right text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <AutorizarPagamentoModal
        open={autorizarOpen}
        onOpenChange={setAutorizarOpen}
        dados={
          faturaAtiva
            ? {
                descricao: faturaAtiva.desc,
                cliente: cliente.razao,
                valor: faturaAtiva.valor,
                ano: faturaAtiva.anoReferencia ?? new Date().getFullYear(),
                forma: faturaAtiva.forma,
                dataGeracao: faturaAtiva.dataGeracao,
                novaValidade: novaValidadeSicafAposPagamento(),
                diasRenovados: diasAteNovaValidadeSicaf(),
              }
            : null
        }
        onConfirmar={confirmarAutorizacao}
      />
      <CancelarFaturaModal
        open={cancelarOpen}
        onOpenChange={setCancelarOpen}
        faturaId={faturaCancelId}
        onConfirmar={confirmarCancelamento}
      />
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "ok" | "danger";
}) {
  const t =
    tone === "ok"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : "text-foreground";
  return (
    <Card className="p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold ${t}`}>{value}</p>
    </Card>
  );
}

function formatDatePainel(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return String(d);
  }
}

function abrirArquivo(url?: string | null) {
  if (!url) {
    toast.error("Arquivo não disponível");
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function statusDocBadge(status: DocumentoUi["status"]) {
  if (status === "danger") return <Badge variant="destructive" className="text-[10px]">Vencido</Badge>;
  if (status === "warn") return <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500">Vencendo</Badge>;
  if (status === "ok") return <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">Válido</Badge>;
  return <Badge variant="secondary" className="text-[10px]">Pendente</Badge>;
}

function DocumentosTab({ painel, clienteId }: { painel: DocumentosPainelUi | null; clienteId: number }) {
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [baixandoCert, setBaixandoCert] = useState(false);
  const cert = painel?.certificadoDigital;
  const checklist = painel ? flattenChecklistDocumentos(painel.docsPorNivel) : [];
  const outros = (painel?.arquivos || []).filter((a) => a.origem === "doc");

  const copiarSenha = () => {
    if (!cert?.senha) return;
    void navigator.clipboard.writeText(cert.senha);
    toast.success("Senha copiada");
  };

  const baixarCertificado = async () => {
    if (!Number.isFinite(clienteId)) return;
    setBaixandoCert(true);
    try {
      await downloadCertificadoDigital(clienteId, cert?.arquivoNome || "certificado.pfx");
      toast.success("Certificado baixado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao baixar certificado");
    } finally {
      setBaixandoCert(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Certificado digital */}
      <Card className="p-4 border-violet-200/60 dark:border-violet-900/40 bg-violet-50/30 dark:bg-violet-950/20">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500 text-white">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Certificado digital (A1)</h3>
              <p className="text-xs text-muted-foreground">Arquivo e senha cadastrados pelo cliente</p>
            </div>
          </div>
          {cert && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:text-violet-300"
                disabled={baixandoCert}
                onClick={() => void baixarCertificado()}
              >
                {baixandoCert ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Baixar .pfx
              </Button>
              <Badge
                variant="outline"
                className={
                  cert.status === "expirado"
                    ? "border-rose-500/40 text-rose-600"
                    : cert.status === "vencendo"
                      ? "border-amber-500/40 text-amber-700"
                      : "border-emerald-500/40 text-emerald-700"
                }
              >
                {cert.status === "expirado" ? "Expirado" : cert.status === "vencendo" ? "Vencendo" : "Válido"}
              </Badge>
            </div>
          )}
        </div>

        {!cert ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhum certificado digital cadastrado.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoLinha label="Arquivo" value={cert.arquivoNome} />
            <InfoLinha label="Titular" value={cert.titularNome || "—"} />
            <InfoLinha label="CPF/CNPJ titular" value={cert.titularDocumento || "—"} />
            <InfoLinha label="Emissor" value={cert.emissor || "—"} />
            <InfoLinha label="Válido de" value={formatDatePainel(cert.validoDe)} />
            <InfoLinha label="Válido até" value={formatDatePainel(cert.validoAte)} />
            <div className="sm:col-span-2 rounded-lg border bg-background p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Senha do certificado</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono">
                  {cert.senha ? (mostrarSenha ? cert.senha : "••••••••••") : "—"}
                </code>
                {cert.senha && (
                  <>
                    <Button type="button" size="icon" variant="outline" className="h-9 w-9" onClick={() => setMostrarSenha((v) => !v)}>
                      {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button type="button" size="icon" variant="outline" className="h-9 w-9" onClick={copiarSenha}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Certidões SICAF (checklist) */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-emerald-600" /> Certidões e documentos SICAF
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {painel?.sicafStatus ? `Status SICAF: ${painel.sicafStatus}` : "Checklist por nível"}
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {checklist.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-2 py-4 text-center">Nenhum documento no checklist SICAF.</p>
          )}
          {checklist.map((d) => (
            <DocumentoCard key={`${d.nivel}-${d.nome}`} doc={d} onDownload={() => abrirArquivo(d.url)} />
          ))}
        </div>
      </Card>

      {/* Outros arquivos / uploads gerais */}
      {outros.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Outros arquivos enviados</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {outros.map((a) => (
              <div
                key={`${a.origem}-${a.id}`}
                className="flex items-center justify-between rounded-md border bg-card px-3 py-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {a.pasta || "Geral"} · {a.dataUpload ? formatDatePainel(a.dataUpload) : "—"}
                    </p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  disabled={!a.arquivoUrl}
                  onClick={() => abrirArquivo(a.arquivoUrl)}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function InfoLinha({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/80 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5 truncate" title={value}>
        {value}
      </p>
    </div>
  );
}

function DocumentoCard({ doc, onDownload }: { doc: DocumentoUi; onDownload: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-card px-3 py-2.5 gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-medium truncate">{doc.nome}</p>
            {doc.nivel ? (
              <Badge variant="outline" className="text-[9px] px-1 py-0">
                Nível {doc.nivel}
              </Badge>
            ) : null}
            {statusDocBadge(doc.status)}
          </div>
          <p className="text-xs text-muted-foreground">Validade: {doc.validade}</p>
        </div>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0"
        disabled={!doc.url}
        onClick={onDownload}
        title={doc.url ? "Baixar / abrir" : "Sem arquivo"}
      >
        {doc.url ? <ExternalLink className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5 opacity-40" />}
      </Button>
    </div>
  );
}

function SuporteTab({ cliente, tickets = [] }: { cliente: ClienteDetalhe; tickets?: TicketItem[] }) {
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketSel, setTicketSel] = useState<TicketItem | null>(null);

  const abrirTicket = (t: TicketItem) => {
    setTicketSel(t);
    setTicketOpen(true);
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Tickets de suporte</h3>
        <Button size="sm" className="gap-1.5">
          <Ticket className="h-3.5 w-3.5" /> Novo ticket
        </Button>
      </div>
      <div className="mt-3 space-y-2">
        {tickets.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum ticket para este cliente.</p>
        )}
        {tickets.map((t) => (
          <button
            key={t.id}
            onClick={() => abrirTicket(t)}
            className="w-full flex items-center justify-between rounded-md border bg-card px-3 py-2.5 text-left transition hover:bg-accent hover:border-primary/40"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{t.id}</span>
                <span className="text-sm font-medium">{t.titulo}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t.status} · {t.data}
              </p>
            </div>
            <Badge variant={t.prio === "alta" ? "destructive" : "secondary"} className="text-[10px]">
              {t.prio}
            </Badge>
          </button>
        ))}
      </div>
      <TicketRespostaModal
        open={ticketOpen}
        onOpenChange={setTicketOpen}
        ticket={ticketSel}
        cliente={{ razao: cliente.razao, responsavel: cliente.responsavel }}
      />
    </Card>
  );
}

function HistoricoTab({ eventos = [] }: { eventos?: HistoricoUi[] }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <History className="h-4 w-4" /> Linha do tempo
        </h3>
      </div>
      <ol className="mt-4 relative border-l border-border ml-2 space-y-4">
        {eventos.length === 0 && (
          <li className="pl-4 text-sm text-muted-foreground">Nenhum evento registrado.</li>
        )}
        {eventos.map((e, i) => (
          <li key={i} className="pl-4">
            <span className="absolute -left-[7px] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <History className="h-2 w-2" />
            </span>
            <p className="text-xs text-muted-foreground">{e.d}</p>
            <p className="text-sm">{e.t}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

