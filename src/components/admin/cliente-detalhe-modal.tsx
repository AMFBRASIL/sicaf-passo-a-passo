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
  Send,
  CreditCard,
  History,
  StickyNote,
} from "lucide-react";
import { useState } from "react";
import wizardBg from "@/assets/wizard-bg.jpg";
import { Check, X as XIcon } from "lucide-react";
import { PagamentoModal } from "@/components/pagamento-modal";
import { AutorizarPagamentoModal } from "@/components/admin/autorizar-pagamento-modal";
import { CancelarFaturaModal } from "@/components/admin/cancelar-fatura-modal";
import { TicketRespostaModal, type TicketItem } from "@/components/admin/ticket-resposta-modal";
import { RenovarSicafModal } from "@/components/admin/renovar-sicaf-modal";
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
  open: boolean;
  onOpenChange: (v: boolean) => void;
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
  { key: "notas", label: "Notas", desc: "Internas da equipe", icon: StickyNote },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export function ClienteDetalheModal({ cliente, open, onOpenChange }: Props) {
  const [step, setStep] = useState<StepKey>("resumo");
  const [renovarOpen, setRenovarOpen] = useState(false);
  const [renovarPagOpen, setRenovarPagOpen] = useState(false);
  if (!cliente) return null;

  const iniciais = cliente.razao
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("");

  const validados = Object.values(cliente.niveis).filter((s) => s === "validado").length;
  const totalNiveis = NIVEIS_SICAF.length;
  const completude = Math.round((validados / totalNiveis) * 100);

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">{cliente.razao}</DialogTitle>

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
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{cliente.razao}</p>
                <p className="text-[11px] font-mono text-white/70 truncate">{cliente.cnpj}</p>
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

            <div className="mt-4 rounded-lg bg-white/10 p-3 backdrop-blur">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/70">
                <ShieldCheck className="h-3 w-3" /> SICAF
              </div>
              <p className="mt-0.5 text-lg font-bold">{completude}% completo</p>
              <div className="mt-2">
                <NivelDots niveis={cliente.niveis} size="sm" />
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
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sicafTone[cliente.sicaf]}`}
                  >
                    SICAF{" "}
                    {cliente.sicaf === "ok"
                      ? "OK"
                      : cliente.sicaf === "pendente"
                        ? "Pendente"
                        : "Vencido"}
                  </span>
                  {cliente.novo && (
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
              <div className="p-5">
                {step === "resumo" && <ResumoTab cliente={cliente} completude={completude} />}
                {step === "sicaf" && <SicafTab cliente={cliente} onRenovar={() => setRenovarOpen(true)} />}
                {step === "financeiro" && <FinanceiroTab cliente={cliente} />}
                {step === "documentos" && <DocumentosTab />}
                {step === "suporte" && <SuporteTab cliente={cliente} />}
                {step === "historico" && <HistoricoTab />}
                {step === "notas" && <NotasTab />}
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
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Edit3 className="h-3.5 w-3.5" /> Editar
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5">
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
        cliente={{ razao: cliente.razao, cnpj: cliente.cnpj }}
        validade={cliente.validadeSicaf ?? "05/06/2027"}
        onGerarTaxa={() => {
          setRenovarOpen(false);
          setRenovarPagOpen(true);
        }}
      />
      <PagamentoModal
        open={renovarPagOpen}
        onOpenChange={setRenovarPagOpen}
        empresa={{
          nome: cliente.razao,
          cnpj: cliente.cnpj,
          sicaf: "ativo",
          proximoPasso: "",
          acao: { label: "", icon: CreditCard as never },
          endereco: "",
          cidade: cliente.cidade,
          uf: "",
          telefone: cliente.telefone ?? "",
          email: cliente.email ?? "",
          responsavel: cliente.responsavel,
          inscricaoEstadual: "",
          inscricaoMunicipal: "",
          ramoAtividade: "",
        } as unknown as EmpresaData}
        descricao="Renovação SICAF Anual"
        valor={985}
      />
    </Dialog>
  );
}


/* ---------- TABS ---------- */

function ResumoTab({
  cliente,
  completude,
}: {
  cliente: ClienteDetalhe;
  completude: number;
}) {
  const alerts: { tone: "danger" | "warn" | "ok"; text: string; icon: any }[] = [];
  if (cliente.sicaf === "vencido")
    alerts.push({ tone: "danger", text: "SICAF vencido — renovar imediatamente", icon: AlertTriangle });
  if (!cliente.pagou)
    alerts.push({ tone: "danger", text: "Cliente inadimplente neste ciclo", icon: AlertTriangle });
  if (cliente.sicaf === "pendente")
    alerts.push({ tone: "warn", text: "Há níveis SICAF pendentes de validação", icon: AlertTriangle });
  if (!alerts.length)
    alerts.push({ tone: "ok", text: "Tudo em dia — cliente saudável", icon: CheckCircle2 });

  return (
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

function SicafTab({ cliente }: { cliente: ClienteDetalhe }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Níveis SICAF</h3>
          <p className="text-xs text-muted-foreground">
            Status detalhado por nível — clique em renovar quando vencido.
          </p>
        </div>
        <Button size="sm" className="gap-1.5">
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

type FaturaItem = {
  id: string;
  desc: string;
  valor: number;
  venc: string;
  forma: "Boleto" | "PIX";
  status: "pago" | "aberto" | "cancelado";
  motivoCancelamento?: string;
};

function FinanceiroTab({ cliente }: { cliente: ClienteDetalhe }) {
  const [pagOpen, setPagOpen] = useState(false);
  const [autorizarOpen, setAutorizarOpen] = useState(false);
  const [faturaAtiva, setFaturaAtiva] = useState<FaturaItem | null>(null);
  const [cancelarOpen, setCancelarOpen] = useState(false);
  const [faturaCancelId, setFaturaCancelId] = useState<string | null>(null);
  const valorCobranca = cliente.mrr || 890;

  const [faturas, setFaturas] = useState<FaturaItem[]>([
    { id: "#4830", desc: "Renovação SICAF 2026", valor: 985, venc: "12/06/2026", forma: "Boleto", status: "aberto" },
    { id: "#4821", desc: "Mensalidade Manutenção SICAF", valor: cliente.mrr || 890, venc: "10/06/2026", forma: "PIX", status: cliente.pagou ? "pago" : "aberto" },
    { id: "#4720", desc: "Mensalidade Manutenção SICAF", valor: cliente.mrr || 890, venc: "10/05/2026", forma: "PIX", status: "pago" },
    { id: "#4612", desc: "Renovação SICAF anual", valor: 1290, venc: "15/04/2026", forma: "Boleto", status: "pago" },
    { id: "#4501", desc: "Mensalidade Manutenção SICAF", valor: cliente.mrr || 890, venc: "10/03/2026", forma: "PIX", status: "pago" },
  ]);

  const empresaPagto = {
    nome: cliente.razao,
    cnpj: cliente.cnpj,
    sicaf: "ativo",
    proximoPasso: "",
    acao: { label: "", icon: CreditCard as never },
    endereco: "",
    cidade: cliente.cidade,
    uf: "",
    telefone: cliente.telefone ?? "",
    email: cliente.email ?? "",
    responsavel: cliente.responsavel,
    inscricaoEstadual: "",
    inscricaoMunicipal: "",
    ramoAtividade: "",
  } as unknown as EmpresaData;

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
  const confirmarAutorizacao = () => {
    if (!faturaAtiva) return;
    setFaturas((prev) => prev.map((f) => (f.id === faturaAtiva.id ? { ...f, status: "pago" } : f)));
  };

  const statusMeta: Record<FaturaItem["status"], { cls: string; txt: string }> = {
    pago: { cls: "bg-success/10 text-success", txt: "Pago" },
    aberto: { cls: "bg-danger/10 text-danger", txt: "Em aberto" },
    cancelado: { cls: "bg-muted text-muted-foreground line-through", txt: "Cancelado" },
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="MRR" value={`R$ ${(cliente.mrr || 0).toLocaleString("pt-BR")}`} />
        <MiniStat label="Total faturado (12m)" value={`R$ ${((cliente.mrr || 890) * 12 + 1290).toLocaleString("pt-BR")}`} />
        <MiniStat label="Em aberto" value={cliente.pagou ? "R$ 0" : `R$ ${(cliente.mrr || 890).toLocaleString("pt-BR")}`} tone={cliente.pagou ? "ok" : "danger"} />
        <MiniStat label="Método preferido" value="PIX" />
      </div>
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Faturas</h3>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Exportar
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setPagOpen(true)}>
              <CreditCard className="h-3.5 w-3.5" /> Gerar cobrança
            </Button>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 font-medium">Fatura</th>
                <th className="py-2 font-medium">Descrição</th>
                <th className="py-2 font-medium">Vencimento</th>
                <th className="py-2 font-medium text-right">Valor</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {faturas.map((f) => (
                <tr key={f.id} className="border-b border-border/40">
                  <td className="py-2 font-mono text-xs">{f.id}</td>
                  <td className="py-2">{f.desc}</td>
                  <td className="py-2 text-xs">{f.venc}</td>
                  <td className="py-2 text-right font-medium">R$ {f.valor.toLocaleString("pt-BR")}</td>
                  <td className="py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusMeta[f.status].cls}`}>
                      {statusMeta[f.status].txt}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    {f.status === "aberto" ? (
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs gap-1 border-danger/30 text-danger hover:bg-danger/10 hover:text-danger"
                          onClick={() => abrirCancelar(f.id)}
                        >
                          <XIcon className="h-3 w-3" /> Cancelar
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => abrirAutorizar(f)}
                        >
                          <ShieldCheck className="h-3 w-3" /> Autorizar
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <PagamentoModal
        open={pagOpen}
        onOpenChange={setPagOpen}
        empresa={empresaPagto}
        descricao="cobrança"
        valor={valorCobranca}
      />
      <AutorizarPagamentoModal
        open={autorizarOpen}
        onOpenChange={setAutorizarOpen}
        dados={
          faturaAtiva
            ? {
                descricao: `${faturaAtiva.desc} — ${cliente.razao}`,
                cliente: cliente.razao,
                valor: faturaAtiva.valor,
                ano: new Date().getFullYear(),
                forma: faturaAtiva.forma,
                dataGeracao: faturaAtiva.venc,
                novaValidade: nextYearDate(faturaAtiva.venc),
                diasRenovados: 365,
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

function nextYearDate(d: string) {
  const [dd, mm, yyyy] = d.split("/");
  return `${dd}/${mm}/${Number(yyyy) + 1}`;
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

function DocumentosTab() {
  const docs = [
    { nome: "Contrato Social", validade: "—", status: "ok" },
    { nome: "Certidão Federal", validade: "15/05/2026", status: "ok" },
    { nome: "Certidão FGTS", validade: "30/03/2026", status: "ok" },
    { nome: "CNDT", validade: "Vencida 12/11/2025", status: "danger" },
    { nome: "Certidão Estadual", validade: "—", status: "warn" },
    { nome: "Certidão Municipal", validade: "10/06/2026", status: "ok" },
  ];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Documentos do cliente</h3>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Enviar documento
        </Button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {docs.map((d) => (
          <div
            key={d.nome}
            className="flex items-center justify-between rounded-md border bg-card px-3 py-2.5"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">{d.nome}</p>
                <p className="text-xs text-muted-foreground">Validade: {d.validade}</p>
              </div>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7">
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SuporteTab({ cliente }: { cliente: ClienteDetalhe }) {
  const tickets: TicketItem[] = [
    { id: "#T-2310", titulo: "Atualizar nível IV — Estadual", status: "Em andamento", prio: "alta", data: "Hoje 09:11" },
    { id: "#T-2287", titulo: "Dúvida sobre CNDT", status: "Aguardando cliente", prio: "média", data: "Ontem" },
    { id: "#T-2204", titulo: "Renovação SICAF concluída", status: "Fechado", prio: "baixa", data: "12/05" },
  ];
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

function HistoricoTab() {
  const eventos = [
    { d: "Hoje 14:22", t: "Ligação atendida — confirmou renovação", icon: Phone },
    { d: "Hoje 09:11", t: "Ticket #T-2310 aberto: Atualizar nível IV", icon: Ticket },
    { d: "Ontem", t: "E-mail enviado: lembrete de vencimento SICAF", icon: Mail },
    { d: "12/05", t: "Pagamento confirmado fatura #4720", icon: CheckCircle2 },
    { d: "15/04", t: "Renovação SICAF anual concluída", icon: ShieldCheck },
    { d: "10/03", t: "Cliente entrou em manutenção mensal", icon: Sparkles },
  ];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <History className="h-4 w-4" /> Linha do tempo
        </h3>
      </div>
      <ol className="mt-4 relative border-l border-border ml-2 space-y-4">
        {eventos.map((e, i) => (
          <li key={i} className="pl-4">
            <span className="absolute -left-[7px] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <e.icon className="h-2 w-2" />
            </span>
            <p className="text-xs text-muted-foreground">{e.d}</p>
            <p className="text-sm">{e.t}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function NotasTab() {
  const [nota, setNota] = useState("");
  const notas = [
    { autor: "Ana (Atendimento)", data: "Hoje 09:30", texto: "Cliente prefere ser contactado via WhatsApp à tarde." },
    { autor: "Carlos (SICAF)", data: "Ontem", texto: "Documentação do nível IV depende da Sefaz local — prazo médio 5 dias." },
  ];
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <StickyNote className="h-4 w-4" /> Notas internas
      </h3>
      <div className="mt-3 flex gap-2">
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          placeholder="Escreva uma nota visível apenas para a equipe..."
          className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button size="sm" className="gap-1.5 self-start">
          <Send className="h-3.5 w-3.5" /> Salvar
        </Button>
      </div>
      <Separator className="my-4" />
      <div className="space-y-3">
        {notas.map((n, i) => (
          <div key={i} className="rounded-md bg-muted/40 p-3 text-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{n.autor}</span>
              <span>{n.data}</span>
            </div>
            <p className="mt-1">{n.texto}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
