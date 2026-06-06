import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Clock,
  TrendingUp,
  Building2,
  MapPin,
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
import { Check } from "lucide-react";

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

export function ClienteDetalheModal({ cliente, open, onOpenChange }: Props) {
  const [tab, setTab] = useState("resumo");
  if (!cliente) return null;

  const iniciais = cliente.razao
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("");

  const validados = Object.values(cliente.niveis).filter((s) => s === "validado").length;
  const totalNiveis = NIVEIS_SICAF.length;
  const completude = Math.round((validados / totalNiveis) * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">{cliente.razao}</DialogTitle>

        {/* HERO */}
        <div className="relative bg-gradient-to-br from-primary/95 via-primary to-primary/80 p-6 text-primary-foreground">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <Avatar className="h-14 w-14 ring-2 ring-white/30">
                <AvatarFallback className="bg-white/15 text-base font-bold text-white">
                  {iniciais}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight">{cliente.razao}</h2>
                  {cliente.novo && (
                    <Badge className="bg-blue-500 text-white border-0">Novo</Badge>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${sicafTone[cliente.sicaf]}`}
                  >
                    SICAF{" "}
                    {cliente.sicaf === "ok"
                      ? "OK"
                      : cliente.sicaf === "pendente"
                        ? "Pendente"
                        : "Vencido"}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/85">
                  <span className="font-mono">{cliente.cnpj}</span>
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> {cliente.responsavel}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {cliente.cidade}
                  </span>
                  {cliente.desde && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Cliente desde {cliente.desde}
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <NivelDots niveis={cliente.niveis} size="md" />
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex flex-col gap-1.5">
              <Button size="sm" variant="secondary" className="h-8 justify-start gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Ligar
              </Button>
              <Button size="sm" variant="secondary" className="h-8 justify-start gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </Button>
              <Button size="sm" variant="secondary" className="h-8 justify-start gap-1.5">
                <Mail className="h-3.5 w-3.5" /> E-mail
              </Button>
            </div>
          </div>

          {/* Hero stats */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroStat
              icon={DollarSign}
              label="MRR"
              value={cliente.mrr ? `R$ ${cliente.mrr.toLocaleString("pt-BR")}` : "—"}
            />
            <HeroStat
              icon={TrendingUp}
              label="LTV estimado"
              value={`R$ ${(cliente.ltv ?? cliente.mrr * 18).toLocaleString("pt-BR")}`}
            />
            <HeroStat
              icon={FileCheck2}
              label="SICAF Completude"
              value={`${completude}%`}
            />
            <HeroStat
              icon={Clock}
              label="Último contato"
              value={cliente.ultimoContato}
            />
          </div>
        </div>

        {/* TABS */}
        <Tabs value={tab} onValueChange={setTab} className="flex flex-col">
          <div className="border-b bg-muted/30 px-4">
            <TabsList className="h-11 bg-transparent gap-1">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="sicaf">SICAF</TabsTrigger>
              <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
              <TabsTrigger value="suporte">Suporte</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
              <TabsTrigger value="notas">Notas</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="max-h-[60vh]">
            <div className="p-5">
              <TabsContent value="resumo" className="mt-0 space-y-4">
                <ResumoTab cliente={cliente} completude={completude} />
              </TabsContent>
              <TabsContent value="sicaf" className="mt-0 space-y-4">
                <SicafTab cliente={cliente} />
              </TabsContent>
              <TabsContent value="financeiro" className="mt-0 space-y-4">
                <FinanceiroTab cliente={cliente} />
              </TabsContent>
              <TabsContent value="documentos" className="mt-0">
                <DocumentosTab />
              </TabsContent>
              <TabsContent value="suporte" className="mt-0">
                <SuporteTab />
              </TabsContent>
              <TabsContent value="historico" className="mt-0">
                <HistoricoTab />
              </TabsContent>
              <TabsContent value="notas" className="mt-0">
                <NotasTab />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>

        {/* FOOTER */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-5 py-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            Auditoria: ações são registradas automaticamente
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Edit3 className="h-3.5 w-3.5" /> Editar cadastro
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Wrench className="h-3.5 w-3.5" /> Solicitar manutenção
            </Button>
            <Button size="sm" className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Renovar SICAF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HeroStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-white/10 px-3 py-2 backdrop-blur">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/70">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="mt-0.5 text-lg font-bold leading-tight">{value}</p>
    </div>
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

function FinanceiroTab({ cliente }: { cliente: ClienteDetalhe }) {
  const fatura = [
    { id: "#4821", desc: "Mensalidade Manutenção SICAF", valor: cliente.mrr || 890, venc: "10/06/2026", status: cliente.pagou ? "pago" : "aberto" },
    { id: "#4720", desc: "Mensalidade Manutenção SICAF", valor: cliente.mrr || 890, venc: "10/05/2026", status: "pago" },
    { id: "#4612", desc: "Renovação SICAF anual", valor: 1290, venc: "15/04/2026", status: "pago" },
    { id: "#4501", desc: "Mensalidade Manutenção SICAF", valor: cliente.mrr || 890, venc: "10/03/2026", status: "pago" },
  ];
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
            <Button size="sm" className="gap-1.5">
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
              </tr>
            </thead>
            <tbody>
              {fatura.map((f) => (
                <tr key={f.id} className="border-b border-border/40">
                  <td className="py-2 font-mono text-xs">{f.id}</td>
                  <td className="py-2">{f.desc}</td>
                  <td className="py-2 text-xs">{f.venc}</td>
                  <td className="py-2 text-right font-medium">R$ {f.valor.toLocaleString("pt-BR")}</td>
                  <td className="py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        f.status === "pago"
                          ? "bg-success/10 text-success"
                          : "bg-danger/10 text-danger"
                      }`}
                    >
                      {f.status === "pago" ? "Pago" : "Em aberto"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
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

function SuporteTab() {
  const tickets = [
    { id: "#T-2310", titulo: "Atualizar nível IV — Estadual", status: "Em andamento", prio: "alta", data: "Hoje 09:11" },
    { id: "#T-2287", titulo: "Dúvida sobre CNDT", status: "Aguardando cliente", prio: "média", data: "Ontem" },
    { id: "#T-2204", titulo: "Renovação SICAF concluída", status: "Fechado", prio: "baixa", data: "12/05" },
  ];
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
          <div key={t.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2.5">
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
          </div>
        ))}
      </div>
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
