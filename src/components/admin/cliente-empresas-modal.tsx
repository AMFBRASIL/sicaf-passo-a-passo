import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NivelDots } from "./nivel-dots";
import {
  Building2,
  MapPin,
  Plus,
  Search,
  ChevronRight,
  Briefcase,
  Mail,
  Phone,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ClienteDetalhe } from "./cliente-detalhe-modal";

export interface ClienteGrupo {
  id: string;
  nome: string;
  contatoPrincipal: string;
  email?: string;
  telefone?: string;
  cidade?: string;
  desde?: string;
  plano?: string;
  empresas: ClienteDetalhe[];
}

interface Props {
  cliente: ClienteGrupo | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelectEmpresa: (empresa: ClienteDetalhe) => void;
}

const sicafBadge: Record<string, { txt: string; cls: string }> = {
  ok: { txt: "🟢 OK", cls: "bg-success/10 text-success ring-1 ring-success/30" },
  pendente: { txt: "🟡 Pendente", cls: "bg-warning/10 text-warning-foreground ring-1 ring-warning/40" },
  vencido: { txt: "🔴 Vencido", cls: "bg-danger/10 text-danger ring-1 ring-danger/30" },
};

export function ClienteEmpresasModal({
  cliente,
  open,
  onOpenChange,
  onSelectEmpresa,
}: Props) {
  const [q, setQ] = useState("");

  const lista = useMemo(() => {
    if (!cliente) return [];
    if (!q) return cliente.empresas;
    const term = q.toLowerCase();
    return cliente.empresas.filter(
      (e) =>
        e.razao.toLowerCase().includes(term) ||
        e.cnpj.includes(q) ||
        e.cidade.toLowerCase().includes(term),
    );
  }, [cliente, q]);

  if (!cliente) return null;

  const iniciais = cliente.nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("");

  const mrrTotal = cliente.empresas.reduce((s, e) => s + (e.mrr || 0), 0);
  const ativas = cliente.empresas.filter((e) => e.pagou && e.manutencao).length;
  const vencidas = cliente.empresas.filter((e) => e.sicaf === "vencido").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">{cliente.nome} — Empresas</DialogTitle>
        <DialogDescription className="sr-only">
          Selecione uma empresa para abrir o painel detalhado.
        </DialogDescription>

        {/* Header */}
        <div className="border-b bg-gradient-to-br from-primary via-primary to-primary/80 px-6 py-5 text-primary-foreground">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 ring-2 ring-white/30">
              <AvatarFallback className="bg-white/15 text-base font-bold text-white">
                {iniciais}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold tracking-tight">{cliente.nome}</h2>
              <p className="text-xs text-white/85">
                {cliente.contatoPrincipal}
                {cliente.cidade ? ` · ${cliente.cidade}` : ""}
                {cliente.desde ? ` · Cliente desde ${cliente.desde}` : ""}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-white/85">
                {cliente.telefone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {cliente.telefone}
                  </span>
                )}
                {cliente.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {cliente.email}
                  </span>
                )}
              </div>
            </div>
            <div className="hidden sm:grid grid-cols-3 gap-2 text-right">
              <Mini label="Empresas" value={cliente.empresas.length.toString()} />
              <Mini label="Ativas" value={ativas.toString()} />
              <Mini label="MRR" value={`R$ ${mrrTotal.toLocaleString("pt-BR")}`} />
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-5 py-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por razão social, CNPJ ou cidade..."
              className="h-9 pl-8"
            />
          </div>
          {vencidas > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {vencidas} SICAF vencido(s)
            </Badge>
          )}
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Vincular CNPJ
          </Button>
        </div>

        {/* Empresas list */}
        <div className="max-h-[60vh] overflow-y-auto p-5 space-y-2.5">
          {lista.map((emp) => (
            <button
              key={emp.id}
              onClick={() => onSelectEmpresa(emp)}
              className="group w-full text-left"
            >
              <Card className="p-4 transition hover:border-primary/40 hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold truncate">{emp.razao}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${sicafBadge[emp.sicaf].cls}`}
                      >
                        {sicafBadge[emp.sicaf].txt}
                      </span>
                      {emp.novo && (
                        <Badge className="bg-blue-500 text-[10px] text-white border-0">
                          Novo
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-mono">{emp.cnpj}</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {emp.cidade}
                      </span>
                      {emp.plano && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-3 w-3" /> {emp.plano}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <NivelDots niveis={emp.niveis} />
                      <div className="flex items-center gap-2 text-xs">
                        {emp.pagou ? (
                          <Badge variant="secondary" className="text-[10px]">Em dia</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">Inadimplente</Badge>
                        )}
                        {emp.manutencao && (
                          <Badge variant="outline" className="text-[10px]">Manutenção</Badge>
                        )}
                        <span className="font-semibold text-foreground">
                          {emp.mrr ? `R$ ${emp.mrr}` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 self-center text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
              </Card>
            </button>
          ))}

          {lista.length === 0 && (
            <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              Nenhuma empresa encontrada para essa busca.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/10 px-2.5 py-1.5 text-left backdrop-blur">
      <p className="text-[9px] uppercase tracking-wider text-white/70">{label}</p>
      <p className="text-sm font-bold leading-tight">{value}</p>
    </div>
  );
}
