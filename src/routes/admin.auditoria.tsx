import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollText, Search, User, Edit, Trash2, LogIn, FileCheck2, DollarSign, Settings } from "lucide-react";

export const Route = createFileRoute("/admin/auditoria")({
  component: AuditoriaPage,
});

interface Log { user: string; data: string; hora: string; ip: string; acao: string; det: string; modulo: string; icon: any; tom: string; }

const logs: Log[] = [
  { user: "Anderson Lima", data: "06/06/2026", hora: "14:22:13", ip: "189.34.12.7",  acao: "Alterou cliente", det: "JR Construtora EIRELI — alterou endereço", modulo: "Clientes", icon: Edit, tom: "blue" },
  { user: "Maria Souza",  data: "06/06/2026", hora: "11:05:42", ip: "201.18.55.91", acao: "Aprovou documento", det: "Solar Brasil — cnd_federal.pdf", modulo: "Documentos", icon: FileCheck2, tom: "emerald" },
  { user: "João Pereira", data: "06/06/2026", hora: "10:11:01", ip: "177.92.4.18",  acao: "Respondeu ticket", det: "T-1031 · Procuração rejeitada", modulo: "Suporte", icon: ScrollText, tom: "violet" },
  { user: "Sistema",       data: "06/06/2026", hora: "06:00:00", ip: "—",            acao: "Executou automação", det: "Cobrança automática — 23 boletos", modulo: "Automações", icon: DollarSign, tom: "amber" },
  { user: "Carla Ribeiro", data: "05/06/2026", hora: "17:30:21", ip: "187.11.3.45", acao: "Excluiu documento", det: "Pavimar Obras — cnd_inss_antigo.pdf", modulo: "Documentos", icon: Trash2, tom: "rose" },
  { user: "Anderson Lima", data: "05/06/2026", hora: "09:14:09", ip: "189.34.12.7", acao: "Login realizado", det: "Login via Google", modulo: "Acesso", icon: LogIn, tom: "blue" },
  { user: "Maria Souza",  data: "05/06/2026", hora: "08:45:00", ip: "201.18.55.91", acao: "Alterou configuração", det: "Atualizou template de e-mail de cobrança", modulo: "Config", icon: Settings, tom: "slate" },
];

const tomCls: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-600",
  emerald: "bg-emerald-500/10 text-emerald-600",
  violet: "bg-violet-500/10 text-violet-600",
  amber: "bg-amber-500/10 text-amber-600",
  rose: "bg-rose-500/10 text-rose-600",
  slate: "bg-slate-500/10 text-slate-600",
};

function AuditoriaPage() {
  const [q, setQ] = useState("");
  const list = logs.filter(l =>
    !q ||
    l.user.toLowerCase().includes(q.toLowerCase()) ||
    l.acao.toLowerCase().includes(q.toLowerCase()) ||
    l.det.toLowerCase().includes(q.toLowerCase()) ||
    l.modulo.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Auditoria</h1>
          <p className="text-sm text-muted-foreground">Tudo o que acontece fica registrado — nada sem rastreabilidade.</p>
        </div>
        <Button variant="outline" size="sm">Exportar assinado</Button>
      </div>

      <Card className="mt-2 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar usuário, ação, módulo ou cliente..." className="pl-8" />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">Usuário</th>
                <th className="px-3 py-2 font-medium">Ação</th>
                <th className="px-3 py-2 font-medium">Detalhe</th>
                <th className="px-3 py-2 font-medium">Módulo</th>
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {list.map((l, i) => {
                const Icon = l.icon;
                return (
                  <tr key={i} className="border-b border-border/40 hover:bg-muted/30">
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
                    <td className="px-3 py-3 font-mono text-xs">{l.data} <span className="text-muted-foreground">{l.hora}</span></td>
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{l.ip}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
