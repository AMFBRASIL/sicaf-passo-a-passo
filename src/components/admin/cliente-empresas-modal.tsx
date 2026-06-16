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
  ShieldCheck,
  CreditCard,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { isClienteApto } from "@/lib/admin-clientes-api";
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

type FiltroLista = "todos" | "sicaf_ok" | "sicaf_pendente" | "pagou" | "nao_pagou" | "manutencao";

const FILTROS: { key: FiltroLista; label: string }[] = [
  { key: "todos", label: "Todas" },
  { key: "sicaf_ok", label: "SICAF OK" },
  { key: "sicaf_pendente", label: "SICAF pendente" },
  { key: "pagou", label: "Pagamento em dia" },
  { key: "nao_pagou", label: "Inadimplente" },
  { key: "manutencao", label: "Com manutenção" },
];

const sicafMeta: Record<
  ClienteDetalhe["sicaf"],
  { label: string; detail: string; cls: string; icon: typeof CheckCircle2 }
> = {
  ok: {
    label: "Em ordem",
    detail: "Cadastro regular",
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  pendente: {
    label: "Pendente",
    detail: "Requer atenção",
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    icon: AlertTriangle,
  },
  vencido: {
    label: "Vencido",
    detail: "Renovar SICAF",
    cls: "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300",
    icon: XCircle,
  },
};

function resumoGrupo(empresas: ClienteDetalhe[]) {
  return {
    sicafOk: empresas.filter((e) => e.sicaf === "ok").length,
    sicafPendente: empresas.filter((e) => e.sicaf === "pendente").length,
    sicafVencido: empresas.filter((e) => e.sicaf === "vencido").length,
    pagamentoOk: empresas.filter((e) => e.pagou).length,
    pagamentoAtrasado: empresas.filter((e) => !e.pagou).length,
    comManutencao: empresas.filter((e) => e.manutencao).length,
    semManutencao: empresas.filter((e) => !e.manutencao).length,
    aptos: empresas.filter((e) => isClienteApto(e.niveis)).length,
    inaptos: empresas.filter((e) => !isClienteApto(e.niveis)).length,
  };
}

function pagamentoEmpresaUi(emp: ClienteDetalhe) {
  const status = emp.pagamentoSicafStatus ?? (emp.pagou ? "Em dia" : "Atrasado");
  const detalhe =
    emp.pagamentoSicafDetalhe ??
    (emp.pagou ? "Taxa SICAF quitada" : "Taxa pendente ou vencida");

  if (status === "Vigente" || status === "Em dia") {
    return {
      valor: status,
      detalhe,
      cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
      statusIcon: CheckCircle2,
    };
  }
  if (status === "Vencendo") {
    return {
      valor: status,
      detalhe,
      cls: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
      statusIcon: AlertTriangle,
    };
  }
  if (status === "Pendente") {
    return {
      valor: status,
      detalhe,
      cls: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
      statusIcon: AlertTriangle,
    };
  }
  return {
    valor: status === "Vencido" ? "Vencido" : "Atrasado",
    detalhe,
    cls: "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300",
    statusIcon: XCircle,
  };
}

function passaFiltro(emp: ClienteDetalhe, filtro: FiltroLista): boolean {
  switch (filtro) {
    case "sicaf_ok":
      return emp.sicaf === "ok";
    case "sicaf_pendente":
      return emp.sicaf !== "ok";
    case "pagou":
      return emp.pagou;
    case "nao_pagou":
      return !emp.pagou;
    case "manutencao":
      return emp.manutencao;
    default:
      return true;
  }
}

export function ClienteEmpresasModal({
  cliente,
  open,
  onOpenChange,
  onSelectEmpresa,
}: Props) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<FiltroLista>("todos");

  const lista = useMemo(() => {
    if (!cliente) return [];
    const term = q.trim().toLowerCase();
    return cliente.empresas.filter((e) => {
      if (!passaFiltro(e, filtro)) return false;
      if (!term) return true;
      return (
        e.razao.toLowerCase().includes(term) ||
        e.cnpj.includes(q) ||
        e.cidade.toLowerCase().includes(term)
      );
    });
  }, [cliente, q, filtro]);

  if (!cliente) return null;

  const iniciais = cliente.nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("");

  const mrrTotal = cliente.empresas.reduce((s, e) => s + (e.mrr || 0), 0);
  const resumo = resumoGrupo(cliente.empresas);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] p-0 gap-0 overflow-hidden sm:max-w-5xl">
        <DialogTitle className="sr-only">{cliente.nome} — Empresas</DialogTitle>
        <DialogDescription className="sr-only">
          Selecione uma empresa para abrir o painel detalhado.
        </DialogDescription>

        {/* Header */}
        <div className="border-b bg-gradient-to-br from-primary via-primary to-primary/80 px-6 py-5 text-primary-foreground">
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12 shrink-0 ring-2 ring-white/30">
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

              {/* Resumo de saúde do grupo */}
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <ResumoHeader
                  icon={ShieldCheck}
                  titulo="SICAF"
                  linhas={[
                    resumo.sicafOk > 0 ? `${resumo.sicafOk} em ordem` : null,
                    resumo.sicafPendente > 0 ? `${resumo.sicafPendente} pendente(s)` : null,
                    resumo.sicafVencido > 0 ? `${resumo.sicafVencido} vencido(s)` : null,
                  ].filter(Boolean) as string[]}
                  alerta={resumo.sicafVencido > 0 || resumo.sicafPendente > 0}
                />
                <ResumoHeader
                  icon={CreditCard}
                  titulo="Pagamento SICAF"
                  linhas={[
                    resumo.pagamentoOk > 0 ? `${resumo.pagamentoOk} em dia` : null,
                    resumo.pagamentoAtrasado > 0 ? `${resumo.pagamentoAtrasado} atrasado(s)` : null,
                  ].filter(Boolean) as string[]}
                  alerta={resumo.pagamentoAtrasado > 0}
                />
                <ResumoHeader
                  icon={Wrench}
                  titulo="Manutenção"
                  linhas={[
                    resumo.comManutencao > 0 ? `${resumo.comManutencao} ativa(s)` : "Nenhuma ativa",
                    resumo.semManutencao > 0 ? `${resumo.semManutencao} sem contrato` : null,
                  ].filter(Boolean) as string[]}
                  alerta={resumo.comManutencao === 0}
                />
                <ResumoHeader
                  icon={CheckCircle2}
                  titulo="Licitação"
                  linhas={[
                    resumo.aptos > 0 ? `${resumo.aptos} APTO(s)` : null,
                    resumo.inaptos > 0 ? `${resumo.inaptos} INAPTO(s)` : null,
                  ].filter(Boolean) as string[]}
                  alerta={resumo.inaptos > 0}
                />
              </div>
            </div>
            <div className="hidden shrink-0 sm:grid grid-cols-2 gap-2 text-right">
              <Mini label="Empresas" value={cliente.empresas.length.toString()} />
              <Mini label="MRR total" value={`R$ ${mrrTotal.toLocaleString("pt-BR")}`} />
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="space-y-2.5 border-b bg-muted/30 px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por razão social, CNPJ ou cidade..."
                className="h-9 pl-8"
              />
            </div>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Vincular CNPJ
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTROS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFiltro(f.key)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  filtro === f.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-background text-muted-foreground ring-1 ring-border hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Empresas list */}
        <div className="max-h-[60vh] overflow-y-auto p-5 space-y-2.5">
          {lista.map((emp) => (
            <EmpresaCard key={emp.id} emp={emp} onSelect={() => onSelectEmpresa(emp)} />
          ))}

          {lista.length === 0 && (
            <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              Nenhuma empresa encontrada para essa busca ou filtro.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmpresaCard({ emp, onSelect }: { emp: ClienteDetalhe; onSelect: () => void }) {
  const sicaf = sicafMeta[emp.sicaf];
  const SicafIcon = sicaf.icon;
  const apto = isClienteApto(emp.niveis);
  const pagamento = pagamentoEmpresaUi(emp);
  const PagamentoIcon = pagamento.statusIcon;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className="group w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
    >
      <Card className="p-4 transition hover:border-primary/40 hover:shadow-md">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold truncate">{emp.razao}</span>
              {emp.novo && (
                <Badge className="bg-blue-500 text-[10px] text-white border-0">Novo</Badge>
              )}
              <Badge
                className={`text-[10px] font-semibold border-0 ${
                  apto
                    ? "bg-emerald-600 text-white ring-1 ring-emerald-600/30"
                    : "bg-red-600 text-white ring-1 ring-red-600/30"
                }`}
              >
                {apto ? "APTO" : "INAPTO"}
              </Badge>
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

            {/* Status principais — visíveis de imediato */}
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <StatusBox
                icon={ShieldCheck}
                titulo="SICAF"
                valor={sicaf.label}
                detalhe={emp.validadeSicaf ? `Válido até ${emp.validadeSicaf}` : sicaf.detail}
                cls={sicaf.cls}
                statusIcon={SicafIcon}
              />
              <StatusBox
                icon={CreditCard}
                titulo="Pagamento"
                valor={pagamento.valor}
                detalhe={pagamento.detalhe}
                cls={pagamento.cls}
                statusIcon={PagamentoIcon}
              />
              <StatusBox
                icon={Wrench}
                titulo="Manutenção"
                valor={emp.manutencao ? "Ativa" : "Sem contrato"}
                detalhe={
                  emp.manutencao && emp.mrr
                    ? `R$ ${emp.mrr.toLocaleString("pt-BR")}/mês`
                    : emp.manutencao
                      ? "Plano contratado"
                      : "Não contratada"
                }
                cls={
                  emp.manutencao
                    ? "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300"
                    : "border-border bg-muted/40 text-muted-foreground"
                }
                statusIcon={emp.manutencao ? CheckCircle2 : XCircle}
              />
            </div>

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-dashed pt-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Níveis I–VI
                </span>
                <NivelDots niveis={emp.niveis} />
              </div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide ${
                  apto ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                }`}
              >
                {apto ? "Pode licitar" : "Aguardando níveis SICAF"}
              </span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
      </Card>
    </div>
  );
}

function StatusBox({
  icon: Icon,
  titulo,
  valor,
  detalhe,
  cls,
  statusIcon: StatusIcon,
}: {
  icon: typeof ShieldCheck;
  titulo: string;
  valor: string;
  detalhe: string;
  cls: string;
  statusIcon: typeof CheckCircle2;
}) {
  return (
    <div className={`rounded-lg border px-2.5 py-2 ${cls}`}>
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
          <Icon className="h-3 w-3" />
          {titulo}
        </span>
        <StatusIcon className="h-3.5 w-3.5 shrink-0 opacity-90" />
      </div>
      <p className="mt-0.5 text-sm font-bold leading-tight">{valor}</p>
      <p className="mt-0.5 text-[10px] leading-snug opacity-80">{detalhe}</p>
    </div>
  );
}

function ResumoHeader({
  icon: Icon,
  titulo,
  linhas,
  alerta,
}: {
  icon: typeof ShieldCheck;
  titulo: string;
  linhas: string[];
  alerta: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-2.5 py-2 text-left backdrop-blur ${
        alerta ? "bg-amber-400/20 ring-1 ring-amber-300/40" : "bg-white/10"
      }`}
    >
      <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-white/75">
        <Icon className="h-3 w-3" />
        {titulo}
      </p>
      {linhas.map((l) => (
        <p key={l} className="text-[11px] font-medium leading-snug text-white">
          {l}
        </p>
      ))}
    </div>
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
