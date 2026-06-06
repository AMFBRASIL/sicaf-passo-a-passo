import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Filter,
  MoreVertical,
  FileCheck2,
  DollarSign,
  Sparkles,
  Plus,
  Download,
  Phone,
  Mail,
  FolderOpen,
  Ticket,
  ShieldCheck,
} from "lucide-react";
import { NivelDots } from "@/components/admin/nivel-dots";
import {
  ClienteDetalheModal,
  type ClienteDetalhe,
} from "@/components/admin/cliente-detalhe-modal";
import type { NivelStatus } from "@/components/admin/nivel-dots";

export const Route = createFileRoute("/admin/clientes")({
  component: ClientesPage,
});

type Status = "ok" | "pendente" | "vencido";

interface Cliente {
  id: string;
  razao: string;
  cnpj: string;
  responsavel: string;
  cidade: string;
  sicaf: Status;
  pagou: boolean;
  manutencao: boolean;
  novo: boolean;
  mrr: number;
  ultimoContato: string;
  niveis: Record<number, NivelStatus>;
  plano?: string;
  desde?: string;
  validadeSicaf?: string;
  email?: string;
  telefone?: string;
}

const clientes: Cliente[] = [
  {
    id: "1",
    razao: "JR Construtora EIRELI",
    cnpj: "12.345.678/0001-90",
    responsavel: "João Silva",
    cidade: "Brasília/DF",
    sicaf: "vencido",
    pagou: true,
    manutencao: true,
    novo: false,
    mrr: 890,
    ultimoContato: "Hoje 14:22",
    niveis: { 1: "validado", 2: "validado", 3: "vencido", 4: "vencido", 5: "validado", 6: "vencendo" },
    plano: "Manutenção SICAF",
    desde: "03/2023",
    validadeSicaf: "Vencido 22/05/2026",
    email: "contato@jrconstrutora.com.br",
    telefone: "(61) 99812-4422",
  },
  {
    id: "2",
    razao: "Nova Filial Brasília LTDA",
    cnpj: "98.765.432/0001-10",
    responsavel: "Maria Souza",
    cidade: "Taguatinga/DF",
    sicaf: "pendente",
    pagou: false,
    manutencao: false,
    novo: true,
    mrr: 0,
    ultimoContato: "Ontem 09:10",
    niveis: { 1: "validado", 2: "pendente", 3: "pendente", 4: "nao_cadastrado", 5: "nao_cadastrado", 6: "nao_cadastrado" },
    plano: "Onboarding",
    desde: "05/2026",
  },
  {
    id: "3",
    razao: "Engemax Serviços",
    cnpj: "55.111.222/0001-44",
    responsavel: "Carlos Lima",
    cidade: "Goiânia/GO",
    sicaf: "pendente",
    pagou: true,
    manutencao: true,
    novo: false,
    mrr: 1290,
    ultimoContato: "2 dias",
    niveis: { 1: "validado", 2: "validado", 3: "validado", 4: "vencendo", 5: "pendente", 6: "nao_cadastrado" },
    plano: "Manutenção SICAF Plus",
    desde: "11/2022",
  },
  {
    id: "4",
    razao: "Pavimar Obras",
    cnpj: "33.444.555/0001-77",
    responsavel: "Ana Paula",
    cidade: "Anápolis/GO",
    sicaf: "ok",
    pagou: true,
    manutencao: false,
    novo: false,
    mrr: 590,
    ultimoContato: "1 semana",
    niveis: { 1: "validado", 2: "validado", 3: "validado", 4: "validado", 5: "validado", 6: "nao_cadastrado" },
    plano: "Essencial",
    desde: "08/2024",
  },
  {
    id: "5",
    razao: "Construtora Aurora",
    cnpj: "22.333.444/0001-88",
    responsavel: "Pedro Henrique",
    cidade: "Brasília/DF",
    sicaf: "ok",
    pagou: true,
    manutencao: true,
    novo: false,
    mrr: 1490,
    ultimoContato: "Hoje 11:05",
    niveis: { 1: "validado", 2: "validado", 3: "validado", 4: "validado", 5: "validado", 6: "validado" },
    plano: "Premium",
    desde: "02/2021",
  },
  {
    id: "6",
    razao: "MEI José Roberto",
    cnpj: "44.555.666/0001-22",
    responsavel: "José Roberto",
    cidade: "Luziânia/GO",
    sicaf: "vencido",
    pagou: false,
    manutencao: false,
    novo: true,
    mrr: 0,
    ultimoContato: "3 dias",
    niveis: { 1: "vencido", 2: "vencido", 3: "nao_cadastrado", 4: "nao_cadastrado", 5: "nao_cadastrado", 6: "nao_cadastrado" },
  },
  {
    id: "7",
    razao: "Solar Brasil Energia",
    cnpj: "77.888.999/0001-11",
    responsavel: "Larissa Mendes",
    cidade: "Brasília/DF",
    sicaf: "ok",
    pagou: true,
    manutencao: true,
    novo: false,
    mrr: 2100,
    ultimoContato: "Hoje 16:40",
    niveis: { 1: "validado", 2: "validado", 3: "validado", 4: "validado", 5: "validado", 6: "vencendo" },
    plano: "Premium",
    desde: "07/2022",
  },
  {
    id: "8",
    razao: "TecnoLimp Servicos",
    cnpj: "11.222.333/0001-55",
    responsavel: "Rafael Costa",
    cidade: "Águas Claras/DF",
    sicaf: "pendente",
    pagou: true,
    manutencao: false,
    novo: true,
    mrr: 690,
    ultimoContato: "Ontem 17:30",
    niveis: { 1: "validado", 2: "validado", 3: "pendente", 4: "pendente", 5: "nao_cadastrado", 6: "nao_cadastrado" },
    plano: "Essencial",
    desde: "04/2026",
  },
];

const sicafBadge: Record<Status, { txt: string; cls: string }> = {
  ok: { txt: "🟢 OK", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20" },
  pendente: { txt: "🟡 Pendente", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20" },
  vencido: { txt: "🔴 Vencido", cls: "bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/20" },
};

type FiltroKey =
  | "todos"
  | "sicaf_ok"
  | "sicaf_pendente"
  | "pagou"
  | "nao_pagou"
  | "manutencao"
  | "sem_manutencao"
  | "novo"
  | "antigo";

const filtros: { key: FiltroKey; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "sicaf_ok", label: "SICAF OK" },
  { key: "sicaf_pendente", label: "SICAF Pendente" },
  { key: "pagou", label: "Pagou" },
  { key: "nao_pagou", label: "Não pagou" },
  { key: "manutencao", label: "Em manutenção" },
  { key: "sem_manutencao", label: "Sem manutenção" },
  { key: "novo", label: "Cliente novo" },
  { key: "antigo", label: "Cliente antigo" },
];

function ClientesPage() {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<FiltroKey>("todos");
  const [selecionado, setSelecionado] = useState<ClienteDetalhe | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const lista = useMemo(() => {
    return clientes.filter((c) => {
      const matchQ =
        !q ||
        c.razao.toLowerCase().includes(q.toLowerCase()) ||
        c.cnpj.includes(q) ||
        c.responsavel.toLowerCase().includes(q.toLowerCase());
      if (!matchQ) return false;
      switch (filtro) {
        case "sicaf_ok": return c.sicaf === "ok";
        case "sicaf_pendente": return c.sicaf !== "ok";
        case "pagou": return c.pagou;
        case "nao_pagou": return !c.pagou;
        case "manutencao": return c.manutencao;
        case "sem_manutencao": return !c.manutencao;
        case "novo": return c.novo;
        case "antigo": return !c.novo;
        default: return true;
      }
    });
  }, [q, filtro]);

  const total = clientes.length;
  const ativos = clientes.filter((c) => c.pagou && c.manutencao).length;
  const risco = clientes.filter((c) => !c.pagou || c.sicaf === "vencido").length;
  const mrr = clientes.reduce((s, c) => s + c.mrr, 0);

  const abrir = (c: Cliente) => {
    setSelecionado(c as ClienteDetalhe);
    setModalOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Gestão de Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Base unificada com filtros avançados e ações rápidas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Exportar
          </Button>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Novo cliente
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniKpi label="Total de clientes" value={total.toString()} hint="ativos + inativos" />
        <MiniKpi label="Clientes ativos" value={ativos.toString()} hint="pagaram + manutenção" tone="emerald" />
        <MiniKpi label="Em risco" value={risco.toString()} hint="inadimplência ou SICAF vencido" tone="rose" />
        <MiniKpi label="MRR estimado" value={`R$ ${mrr.toLocaleString("pt-BR")}`} hint="receita recorrente mensal" tone="violet" />
      </div>

      <Card className="mt-5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por razão social, CNPJ ou responsável..."
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filtros:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filtros.map((f) => (
              <Button
                key={f.key}
                variant={filtro === f.key ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setFiltro(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">CNPJ</th>
                <th className="px-3 py-2 font-medium">Níveis SICAF</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">MRR</th>
                <th className="px-3 py-2 font-medium">Último contato</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => abrir(c)}
                  className="cursor-pointer border-b border-border/40 transition hover:bg-muted/40"
                >
                  <td className="px-3 py-3">
                    <div className="font-medium">{c.razao}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.responsavel} · {c.cidade}
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{c.cnpj}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <NivelDots niveis={c.niveis} />
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${sicafBadge[c.sicaf].cls}`}>
                        {sicafBadge[c.sicaf].txt}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.pagou ? (
                        <Badge variant="secondary" className="text-[10px]">Pagou</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">Não pagou</Badge>
                      )}
                      {c.manutencao && <Badge variant="outline" className="text-[10px]">Manutenção</Badge>}
                      {c.novo && <Badge className="bg-blue-500 text-[10px] text-white">Novo</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-medium">
                    {c.mrr ? `R$ ${c.mrr}` : "—"}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{c.ultimoContato}</td>
                  <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel className="text-xs">Ações rápidas</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => abrir(c)}>
                          <Sparkles className="mr-2 h-4 w-4" /> Abrir cliente
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/admin/suporte"><Ticket className="mr-2 h-4 w-4" /> Abrir suporte</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/admin/financeiro"><DollarSign className="mr-2 h-4 w-4" /> Abrir financeiro</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/admin/documentos"><FolderOpen className="mr-2 h-4 w-4" /> Abrir documentos</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/admin/sicaf"><FileCheck2 className="mr-2 h-4 w-4" /> Abrir SICAF</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem><Phone className="mr-2 h-4 w-4" /> Ligar</DropdownMenuItem>
                        <DropdownMenuItem><Mail className="mr-2 h-4 w-4" /> Enviar e-mail</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {lista.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    Nenhum cliente encontrado com esses filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{lista.length} de {clientes.length} clientes</span>
          <div className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Dados sincronizados com Lovable Cloud (mock)
          </div>
        </div>
      </Card>

      <ClienteDetalheModal
        cliente={selecionado}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
}

function MiniKpi({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "emerald" | "rose" | "violet" }) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    emerald: "text-emerald-600 dark:text-emerald-400",
    rose: "text-rose-600 dark:text-rose-400",
    violet: "text-violet-600 dark:text-violet-400",
  };
  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
