import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { empresasMock, type EmpresaData } from "@/routes/empresas";
import {
  ClipboardCheck,
  RefreshCw,
  Download,
  Bell,
  Mail,
  MessageCircle,
  Smartphone,
  CalendarClock,
  ShieldCheck,
  History,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Sparkles,
  Building2,
  MapPin,
  User,
  Phone,
  CalendarIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { PageHeader, StatusBadge, StatusDot } from "@/components/page-header";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const certidoesSearchSchema = z.object({
  cnpj: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/certidoes")({
  validateSearch: zodValidator(certidoesSearchSchema),
  head: () => ({
    meta: [
      { title: "Monitoramento de Certidões — CADBRASIL" },
      { name: "description", content: "Monitoramos suas certidões 24h por dia e avisamos antes que vençam." },
    ],
  }),
  component: CertPage,
});

type Cert = {
  nome: string;
  emissor: string;
  status: "ok" | "warn" | "danger";
  validade: string;
  diasRestantes: number;
};

const certs: Cert[] = [
  { nome: "Certidão Federal (Receita + PGFN)", emissor: "Receita Federal", status: "ok", validade: "12/08/2026", diasRestantes: 187 },
  { nome: "Certidão Estadual", emissor: "SEFAZ/SP", status: "warn", validade: "30/12/2025", diasRestantes: 26 },
  { nome: "Certidão Municipal", emissor: "Prefeitura de São Paulo", status: "ok", validade: "05/04/2026", diasRestantes: 122 },
  { nome: "FGTS — CRF", emissor: "Caixa Econômica Federal", status: "ok", validade: "18/02/2026", diasRestantes: 77 },
  { nome: "Trabalhista — CNDT", emissor: "TST", status: "danger", validade: "Vencida em 02/11/2025", diasRestantes: -33 },
];

const historico = [
  { quando: "Hoje, 06:12", acao: "Varredura automática concluída", detalhe: "5 certidões verificadas no portal oficial", icon: Activity, tone: "ok" as const },
  { quando: "Ontem, 09:00", acao: "Alerta enviado por WhatsApp", detalhe: "Estadual vence em 27 dias", icon: MessageCircle, tone: "warn" as const },
  { quando: "Há 3 dias", acao: "CNDT detectada como vencida", detalhe: "Notificação enviada por e-mail e push", icon: AlertTriangle, tone: "danger" as const },
  { quando: "Há 7 dias", acao: "Nova certidão emitida automaticamente", detalhe: "FGTS — CRF renovada com sucesso", icon: CheckCircle2, tone: "ok" as const },
];

function CertPage() {
  const { cnpj } = Route.useSearch();
  const empresa = cnpj ? empresasMock.find((e) => e.cnpj === cnpj) : undefined;

  const [canais, setCanais] = useState({ email: true, whatsapp: true, push: true, sms: false });
  const [modalCert, setModalCert] = useState<Cert | null>(null);
  const [dataCertidao, setDataCertidao] = useState<Date | undefined>(undefined);
  const [codigoCertidao, setCodigoCertidao] = useState("");

  const validas = certs.filter((c) => c.status === "ok").length;
  const venceBreve = certs.filter((c) => c.status === "warn").length;
  const vencidas = certs.filter((c) => c.status === "danger").length;
  const score = Math.round((validas / certs.length) * 100);

  const handleOpenModal = (cert: Cert) => {
    setModalCert(cert);
    setDataCertidao(undefined);
    setCodigoCertidao("");
  };

  const handleCloseModal = () => {
    setModalCert(null);
    setDataCertidao(undefined);
    setCodigoCertidao("");
  };

  const handleSalvar = () => {
    // Aqui seria feita a lógica de salvar a certidão
    handleCloseModal();
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<ClipboardCheck className="h-5 w-5" />}
        title="Monitoramento de Certidões"
        subtitle="Acompanhamos suas certidões 24h por dia e avisamos antes que vençam."
        action={
          <Button variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Verificar agora
          </Button>
        }
      />

      {empresa && (
        <Card className="mt-4 border-l-4 border-l-primary">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">{empresa.nome}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{empresa.cidade}, {empresa.uf}</span>
                  <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{empresa.responsavel}</span>
                  <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{empresa.telefone}</span>
                </div>
              </div>
            </div>
            <div className="shrink-0 text-xs font-mono text-muted-foreground bg-muted rounded-lg px-3 py-1.5">
              {empresa.cnpj}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hero monitoring card */}
      <Card className="mt-6 overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background shadow-lift">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-success">Monitor ativo</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Saúde documental: {score}%</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Última varredura há 12 minutos · próxima em 1h47
              </p>
            </div>
            <Progress value={score} className="h-2.5" />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant="secondary" className="gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" />{validas} válidas</Badge>
              <Badge variant="secondary" className="gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-warning" />{venceBreve} vencendo</Badge>
              <Badge variant="secondary" className="gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-danger" />{vencidas} vencidas</Badge>
            </div>
          </div>
          <div className="flex flex-col gap-2 lg:items-end">
            <Button size="lg" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Renovar pendentes com IA
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/sicaf">Ver impacto no SICAF →</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left column — list */}
        <div className="space-y-4">
          {certs.map((c) => (
            <Card
              key={c.nome}
              className={
                c.status === "danger"
                  ? "border-danger/30"
                  : c.status === "warn"
                  ? "border-warning/40"
                  : ""
              }
            >
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{c.nome}</p>
                    <StatusBadge status={c.status}>
                      {c.status === "ok" ? "Válida" : c.status === "warn" ? "Vence em breve" : "Vencida"}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Emissor: {c.emissor}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">Validade: {c.validade}</p>

                  {/* Alert timeline 30/15/5 */}
                  {c.status !== "danger" && (
                    <div className="mt-3">
                      <AlertTrail dias={c.diasRestantes} />
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  {c.status === "ok" ? (
                    <Button variant="outline" size="sm">
                      <Download className="mr-1.5 h-4 w-4" />
                      Baixar
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => handleOpenModal(c)}>
                      Resolver agora
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Right column — channels + history */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Bell className="h-4 w-4 text-primary" />
                Canais de alerta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Avisamos automaticamente <strong>30, 15 e 5 dias</strong> antes de cada vencimento.
              </p>
              <Separator />
              <ChannelRow
                icon={<Mail className="h-4 w-4" />}
                label="E-mail"
                value="joao@empresa.com.br"
                checked={canais.email}
                onChange={(v) => setCanais((s) => ({ ...s, email: v }))}
              />
              <ChannelRow
                icon={<MessageCircle className="h-4 w-4" />}
                label="WhatsApp"
                value="(11) 9 8765-4321"
                checked={canais.whatsapp}
                onChange={(v) => setCanais((s) => ({ ...s, whatsapp: v }))}
              />
              <ChannelRow
                icon={<Smartphone className="h-4 w-4" />}
                label="Push no portal"
                value="Ativo neste navegador"
                checked={canais.push}
                onChange={(v) => setCanais((s) => ({ ...s, push: v }))}
              />
              <ChannelRow
                icon={<Bell className="h-4 w-4" />}
                label="SMS"
                value="Opcional"
                checked={canais.sms}
                onChange={(v) => setCanais((s) => ({ ...s, sms: v }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <History className="h-4 w-4 text-primary" />
                Histórico do monitor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {historico.map((h, i) => {
                  const Icon = h.icon;
                  return (
                    <li key={i} className="flex gap-3">
                      <div
                        className={
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full " +
                          (h.tone === "ok"
                            ? "bg-success/10 text-success"
                            : h.tone === "warn"
                            ? "bg-warning/15 text-warning-foreground"
                            : "bg-danger/10 text-danger")
                        }
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight">{h.acao}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{h.detalhe}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground/70">{h.quando}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex items-start gap-3 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
              <div className="text-sm">
                <p className="font-semibold">Garantia de validade</p>
                <p className="mt-1 text-muted-foreground">
                  Sua empresa nunca fica fora de uma licitação por documento vencido.
                </p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function ChannelRow({
  icon,
  label,
  value,
  checked,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight">{label}</p>
          <p className="truncate text-xs text-muted-foreground">{value}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function AlertTrail({ dias }: { dias: number }) {
  const marcos = [30, 15, 5];
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Alertas</span>
      <div className="flex items-center gap-1.5">
        {marcos.map((m) => {
          const passou = dias <= m;
          return (
            <span
              key={m}
              className={
                "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-medium " +
                (passou
                  ? "border-warning/40 bg-warning/15 text-warning-foreground"
                  : "border-border bg-muted/40 text-muted-foreground")
              }
            >
              <StatusDot status={passou ? "warn" : "idle"} />
              {m}d
            </span>
          );
        })}
      </div>
      <span className="ml-auto text-[11px] text-muted-foreground">
        {dias > 0 ? `${dias} dias restantes` : "vencida"}
      </span>
    </div>
  );
}
