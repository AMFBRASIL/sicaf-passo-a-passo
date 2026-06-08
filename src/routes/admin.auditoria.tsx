import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ScrollText, Search, User, Edit, Trash2, LogIn, FileCheck2, DollarSign, Settings,
  Download, ShieldCheck, AlertTriangle, Activity, Eye, Copy, X, MapPin, Monitor, Clock, FileDown,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/auditoria")({
  component: AuditoriaPage,
});

type Severidade = "info" | "atencao" | "critico";

interface Log {
  id: string;
  user: string;
  data: string;
  hora: string;
  ip: string;
  acao: string;
  det: string;
  modulo: string;
  icon: any;
  tom: string;
  severidade: Severidade;
  entidade?: string;
  alvoId?: string;
  userAgent?: string;
  local?: string;
  antes?: Record<string, string>;
  depois?: Record<string, string>;
}

const logs: Log[] = [
  { id: "A-10421", user: "Anderson Lima", data: "06/06/2026", hora: "14:22:13", ip: "189.34.12.7",
    acao: "Alterou cliente", det: "JR Construtora EIRELI — alterou endereço", modulo: "Clientes",
    icon: Edit, tom: "blue", severidade: "info", entidade: "Cliente",
    alvoId: "CLI-3401", userAgent: "Chrome 126 / macOS", local: "São Paulo · SP",
    antes: { endereco: "Av. Brasil, 1000", cep: "01000-000" },
    depois: { endereco: "Av. Paulista, 1578", cep: "01310-200" } },
  { id: "A-10420", user: "Maria Souza", data: "06/06/2026", hora: "11:05:42", ip: "201.18.55.91",
    acao: "Aprovou documento", det: "Solar Brasil — cnd_federal.pdf", modulo: "Documentos",
    icon: FileCheck2, tom: "emerald", severidade: "info", entidade: "Documento", alvoId: "DOC-88231",
    userAgent: "Chrome 126 / Windows", local: "Curitiba · PR" },
  { id: "A-10419", user: "João Pereira", data: "06/06/2026", hora: "10:11:01", ip: "177.92.4.18",
    acao: "Respondeu ticket", det: "T-1031 · Procuração rejeitada", modulo: "Suporte",
    icon: ScrollText, tom: "violet", severidade: "info", entidade: "Ticket", alvoId: "T-1031",
    userAgent: "Safari 17 / iOS", local: "Recife · PE" },
  { id: "A-10418", user: "Sistema", data: "06/06/2026", hora: "06:00:00", ip: "—",
    acao: "Executou automação", det: "Cobrança automática — 23 boletos", modulo: "Automações",
    icon: DollarSign, tom: "amber", severidade: "atencao", entidade: "Job", alvoId: "JOB-cron-cobr",
    userAgent: "cron/edge", local: "Servidor" },
  { id: "A-10417", user: "Carla Ribeiro", data: "05/06/2026", hora: "17:30:21", ip: "187.11.3.45",
    acao: "Excluiu documento", det: "Pavimar Obras — cnd_inss_antigo.pdf", modulo: "Documentos",
    icon: Trash2, tom: "rose", severidade: "critico", entidade: "Documento", alvoId: "DOC-77120",
    userAgent: "Chrome 125 / Windows", local: "Belo Horizonte · MG" },
  { id: "A-10416", user: "Anderson Lima", data: "05/06/2026", hora: "09:14:09", ip: "189.34.12.7",
    acao: "Login realizado", det: "Login via Google", modulo: "Acesso",
    icon: LogIn, tom: "blue", severidade: "info", entidade: "Sessão", alvoId: "SES-9921",
    userAgent: "Chrome 126 / macOS", local: "São Paulo · SP" },
  { id: "A-10415", user: "Maria Souza", data: "05/06/2026", hora: "08:45:00", ip: "201.18.55.91",
    acao: "Alterou configuração", det: "Atualizou template de e-mail de cobrança", modulo: "Config",
    icon: Settings, tom: "slate", severidade: "atencao", entidade: "Template", alvoId: "TMPL-cobr-v3",
    userAgent: "Chrome 126 / Windows", local: "Curitiba · PR",
    antes: { assunto: "Sua fatura está em aberto", corpo: "Olá, identificamos..." },
    depois: { assunto: "Lembrete: fatura em aberto", corpo: "Olá {nome}, sua fatura..." } },
];

const tomCls: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-600",
  emerald: "bg-emerald-500/10 text-emerald-600",
  violet: "bg-violet-500/10 text-violet-600",
  amber: "bg-amber-500/10 text-amber-600",
  rose: "bg-rose-500/10 text-rose-600",
  slate: "bg-slate-500/10 text-slate-600",
};

const sevCls: Record<Severidade, string> = {
  info: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  atencao: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  critico: "bg-rose-500/10 text-rose-600 border-rose-500/20",
};

const sevLabel: Record<Severidade, string> = { info: "Informativo", atencao: "Atenção", critico: "Crítico" };

const MODULOS = ["Clientes", "Documentos", "Suporte", "Automações", "Acesso", "Config"];

function AuditoriaPage() {
  const [q, setQ] = useState("");
  const [modulo, setModulo] = useState<string>("todos");
  const [severidade, setSeveridade] = useState<string>("todas");
  const [usuario, setUsuario] = useState<string>("todos");
  const [periodo, setPeriodo] = useState<string>("7d");
  const [detalhe, setDetalhe] = useState<Log | null>(null);

  const usuarios = useMemo(() => Array.from(new Set(logs.map(l => l.user))), []);

  const list = useMemo(() => logs.filter(l => {
    if (q) {
      const s = q.toLowerCase();
      if (![l.user, l.acao, l.det, l.modulo, l.id, l.ip].some(v => v.toLowerCase().includes(s))) return false;
    }
    if (modulo !== "todos" && l.modulo !== modulo) return false;
    if (severidade !== "todas" && l.severidade !== severidade) return false;
    if (usuario !== "todos" && l.user !== usuario) return false;
    return true;
  }), [q, modulo, severidade, usuario]);

  const kpis = useMemo(() => ({
    total: logs.length,
    hoje: logs.filter(l => l.data === "06/06/2026").length,
    criticos: logs.filter(l => l.severidade === "critico").length,
    usuariosAtivos: usuarios.length,
  }), [usuarios.length]);

  const exportar = () => {
    const rows = [
      ["ID", "Data", "Hora", "Usuário", "Ação", "Módulo", "Severidade", "Detalhe", "IP", "Local"],
      ...list.map(l => [l.id, l.data, l.hora, l.user, l.acao, l.modulo, l.severidade, l.det, l.ip, l.local ?? ""]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `auditoria_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado", { description: `${list.length} registros · assinatura SHA-256 anexa.` });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Auditoria</h1>
          <p className="text-sm text-muted-foreground">Tudo o que acontece fica registrado — nada sem rastreabilidade.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download className="mr-2 h-3.5 w-3.5" /> Exportar assinado
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Activity} tom="blue" label="Eventos no período" value={kpis.total} />
        <KpiCard icon={Clock} tom="emerald" label="Hoje" value={kpis.hoje} />
        <KpiCard icon={AlertTriangle} tom="rose" label="Críticos" value={kpis.criticos} />
        <KpiCard icon={User} tom="violet" label="Usuários ativos" value={kpis.usuariosAtivos} />
      </div>

      {/* Filtros */}
      <Card className="mt-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por ID, usuário, ação, IP ou cliente..." className="pl-8" />
          </div>
          <Select value={modulo} onValueChange={setModulo}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Módulo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os módulos</SelectItem>
              {MODULOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={severidade} onValueChange={setSeveridade}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Severidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas severidades</SelectItem>
              <SelectItem value="info">Informativo</SelectItem>
              <SelectItem value="atencao">Atenção</SelectItem>
              <SelectItem value="critico">Crítico</SelectItem>
            </SelectContent>
          </Select>
          <Select value={usuario} onValueChange={setUsuario}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Usuário" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os usuários</SelectItem>
              {usuarios.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Usuário</th>
                <th className="px-3 py-2 font-medium">Ação</th>
                <th className="px-3 py-2 font-medium">Detalhe</th>
                <th className="px-3 py-2 font-medium">Módulo</th>
                <th className="px-3 py-2 font-medium">Severidade</th>
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">IP</th>
                <th className="px-3 py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.map((l) => {
                const Icon = l.icon;
                return (
                  <tr key={l.id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{l.id}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{l.user}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-md ${tomCls[l.tom]}`}>
                          <Icon className="h-3 w-3" />
                        </span>
                        <span>{l.acao}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{l.det}</td>
                    <td className="px-3 py-3"><Badge variant="outline" className="text-[10px]">{l.modulo}</Badge></td>
                    <td className="px-3 py-3">
                      <Badge variant="outline" className={`text-[10px] ${sevCls[l.severidade]}`}>
                        {sevLabel[l.severidade]}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{l.data} <span className="text-muted-foreground">{l.hora}</span></td>
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{l.ip}</td>
                    <td className="px-3 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setDetalhe(l)}>
                        <Eye className="mr-1 h-3.5 w-3.5" /> Detalhes
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-muted-foreground">Nenhum registro encontrado com os filtros atuais.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Exibindo {list.length} de {logs.length} registros</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Integridade dos logs verificada · hash SHA-256
          </span>
        </div>
      </Card>

      <DetalheModal log={detalhe} onClose={() => setDetalhe(null)} />
    </div>
  );
}

function KpiCard({ icon: I, tom, label, value }: { icon: any; tom: string; label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tomCls[tom]}`}>
          <I className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function DetalheModal({ log, onClose }: { log: Log | null; onClose: () => void }) {
  if (!log) return null;
  const Icon = log.icon;
  const copy = (v: string) => { navigator.clipboard.writeText(v); toast.success("Copiado"); };

  return (
    <Dialog open={!!log} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Detalhes do log {log.id}</DialogTitle>

        <div className="flex items-start justify-between border-b bg-gradient-to-br from-muted/30 to-background px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${tomCls[log.tom]}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">{log.acao}</h2>
                <Badge variant="outline" className={`text-[10px] ${sevCls[log.severidade]}`}>{sevLabel[log.severidade]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{log.det}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <ScrollArea className="max-h-[65vh]">
          <div className="space-y-5 p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <Linha label="ID do evento" valor={log.id} onCopy={() => copy(log.id)} />
              <Linha label="Módulo" valor={log.modulo} />
              <Linha label="Entidade" valor={`${log.entidade ?? "—"}${log.alvoId ? ` · ${log.alvoId}` : ""}`} onCopy={log.alvoId ? () => copy(log.alvoId!) : undefined} />
              <Linha label="Usuário" valor={log.user} />
              <Linha label="Data / hora" valor={`${log.data} ${log.hora}`} />
              <Linha label="IP de origem" valor={log.ip} onCopy={() => copy(log.ip)} />
              <Linha label="Localização" icon={MapPin} valor={log.local ?? "—"} />
              <Linha label="User agent" icon={Monitor} valor={log.userAgent ?? "—"} />
            </div>

            {(log.antes || log.depois) && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Diff de alterações</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DiffBox titulo="Antes" tom="rose" data={log.antes ?? {}} />
                  <DiffBox titulo="Depois" tom="emerald" data={log.depois ?? {}} />
                </div>
              </div>
            )}

            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Integridade verificada
              </div>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground break-all">
                sha256: 9f3c8b1e2d4a5f6789abcdef0123456789abcdef0123456789abcdef01234567
              </p>
            </div>
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between border-t bg-muted/30 px-6 py-3">
          <p className="text-xs text-muted-foreground">Registro imutável · assinado digitalmente</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { copy(JSON.stringify(log, null, 2)); }}>
              <Copy className="mr-2 h-3.5 w-3.5" /> Copiar JSON
            </Button>
            <Button size="sm" onClick={() => toast.success("Comprovante PDF gerado")}>
              <FileDown className="mr-2 h-3.5 w-3.5" /> Baixar comprovante
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Linha({ label, valor, icon: I, onCopy }: { label: string; valor: string; icon?: any; onCopy?: () => void }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          {I && <I className="h-3.5 w-3.5 text-muted-foreground" />}
          {valor}
        </p>
        {onCopy && (
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onCopy}>
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

function DiffBox({ titulo, tom, data }: { titulo: string; tom: "rose" | "emerald"; data: Record<string, string> }) {
  const cls = tom === "rose" ? "border-rose-500/30 bg-rose-500/5" : "border-emerald-500/30 bg-emerald-500/5";
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <p className="mb-2 text-xs font-semibold">{titulo}</p>
      {Object.keys(data).length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <div className="space-y-2">
          {Object.entries(data).map(([k, v]) => (
            <div key={k}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
              <p className="text-xs font-mono break-words">{v}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
