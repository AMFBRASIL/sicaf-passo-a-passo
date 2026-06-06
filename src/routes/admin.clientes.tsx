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
  Building2,
} from "lucide-react";
import {
  ClienteEmpresasModal,
  type ClienteGrupo,
} from "@/components/admin/cliente-empresas-modal";
import {
  ClienteDetalheModal,
  type ClienteDetalhe,
} from "@/components/admin/cliente-detalhe-modal";
import type { NivelStatus } from "@/components/admin/nivel-dots";

export const Route = createFileRoute("/admin/clientes")({
  component: ClientesPage,
});

type Status = "ok" | "pendente" | "vencido";

const e = (
  id: string,
  razao: string,
  cnpj: string,
  cidade: string,
  sicaf: Status,
  niveis: Record<number, NivelStatus>,
  extras: Partial<ClienteDetalhe> = {},
): ClienteDetalhe => ({
  id,
  razao,
  cnpj,
  responsavel: extras.responsavel ?? "—",
  cidade,
  sicaf,
  pagou: extras.pagou ?? true,
  manutencao: extras.manutencao ?? true,
  novo: extras.novo ?? false,
  mrr: extras.mrr ?? 0,
  ultimoContato: extras.ultimoContato ?? "—",
  niveis,
  plano: extras.plano,
  desde: extras.desde,
  validadeSicaf: extras.validadeSicaf,
  email: extras.email,
  telefone: extras.telefone,
});

const clientes: ClienteGrupo[] = [
  {
    id: "g1",
    nome: "Grupo JR",
    contatoPrincipal: "João Silva",
    email: "joao@grupojr.com.br",
    telefone: "(61) 99812-4422",
    cidade: "Brasília/DF",
    desde: "03/2023",
    plano: "Manutenção SICAF",
    empresas: [
      e("g1e1", "JR Construtora EIRELI", "12.345.678/0001-90", "Brasília/DF", "vencido",
        { 1: "validado", 2: "validado", 3: "vencido", 4: "vencido", 5: "validado", 6: "vencendo" },
        { responsavel: "João Silva", mrr: 890, ultimoContato: "Hoje 14:22", plano: "Manutenção SICAF", desde: "03/2023", validadeSicaf: "Vencido 22/05/2026" }),
      e("g1e2", "JR Engenharia LTDA", "12.345.678/0002-71", "Goiânia/GO", "ok",
        { 1: "validado", 2: "validado", 3: "validado", 4: "validado", 5: "vencendo", 6: "nao_cadastrado" },
        { responsavel: "João Silva", mrr: 690, ultimoContato: "Ontem 16:00", plano: "Essencial", desde: "07/2024" }),
      e("g1e3", "JR Locações ME", "12.345.678/0003-52", "Brasília/DF", "pendente",
        { 1: "validado", 2: "pendente", 3: "pendente", 4: "nao_cadastrado", 5: "nao_cadastrado", 6: "nao_cadastrado" },
        { responsavel: "João Silva", pagou: false, manutencao: false, mrr: 0, novo: true, ultimoContato: "3 dias" }),
    ],
  },
  {
    id: "g2",
    nome: "Maria Souza Holdings",
    contatoPrincipal: "Maria Souza",
    email: "maria@holdings.com.br",
    telefone: "(61) 99100-3344",
    cidade: "Taguatinga/DF",
    desde: "05/2026",
    plano: "Onboarding",
    empresas: [
      e("g2e1", "Nova Filial Brasília LTDA", "98.765.432/0001-10", "Taguatinga/DF", "pendente",
        { 1: "validado", 2: "pendente", 3: "pendente", 4: "nao_cadastrado", 5: "nao_cadastrado", 6: "nao_cadastrado" },
        { responsavel: "Maria Souza", pagou: false, manutencao: false, mrr: 0, novo: true, ultimoContato: "Ontem 09:10" }),
    ],
  },
  {
    id: "g3",
    nome: "Engemax",
    contatoPrincipal: "Carlos Lima",
    email: "carlos@engemax.com.br",
    telefone: "(62) 98800-1122",
    cidade: "Goiânia/GO",
    desde: "11/2022",
    plano: "Manutenção SICAF Plus",
    empresas: [
      e("g3e1", "Engemax Serviços", "55.111.222/0001-44", "Goiânia/GO", "pendente",
        { 1: "validado", 2: "validado", 3: "validado", 4: "vencendo", 5: "pendente", 6: "nao_cadastrado" },
        { responsavel: "Carlos Lima", mrr: 1290, ultimoContato: "2 dias", plano: "Plus", desde: "11/2022" }),
      e("g3e2", "Engemax Filial Anápolis", "55.111.222/0002-25", "Anápolis/GO", "ok",
        { 1: "validado", 2: "validado", 3: "validado", 4: "validado", 5: "validado", 6: "validado" },
        { responsavel: "Carlos Lima", mrr: 690, ultimoContato: "5 dias", plano: "Essencial", desde: "01/2024" }),
    ],
  },
  {
    id: "g4",
    nome: "Pavimar Obras",
    contatoPrincipal: "Ana Paula",
    cidade: "Anápolis/GO",
    desde: "08/2024",
    empresas: [
      e("g4e1", "Pavimar Obras", "33.444.555/0001-77", "Anápolis/GO", "ok",
        { 1: "validado", 2: "validado", 3: "validado", 4: "validado", 5: "validado", 6: "nao_cadastrado" },
        { responsavel: "Ana Paula", mrr: 590, ultimoContato: "1 semana", plano: "Essencial", desde: "08/2024" }),
    ],
  },
  {
    id: "g5",
    nome: "Construtora Aurora",
    contatoPrincipal: "Pedro Henrique",
    cidade: "Brasília/DF",
    desde: "02/2021",
    plano: "Premium",
    empresas: [
      e("g5e1", "Construtora Aurora", "22.333.444/0001-88", "Brasília/DF", "ok",
        { 1: "validado", 2: "validado", 3: "validado", 4: "validado", 5: "validado", 6: "validado" },
        { responsavel: "Pedro Henrique", mrr: 1490, ultimoContato: "Hoje 11:05", plano: "Premium", desde: "02/2021" }),
      e("g5e2", "Aurora Incorporadora", "22.333.444/0002-69", "Brasília/DF", "ok",
        { 1: "validado", 2: "validado", 3: "validado", 4: "validado", 5: "vencendo", 6: "validado" },
        { responsavel: "Pedro Henrique", mrr: 990, ultimoContato: "Hoje 11:05", plano: "Premium", desde: "06/2022" }),
    ],
  },
  {
    id: "g6",
    nome: "MEI José Roberto",
    contatoPrincipal: "José Roberto",
    cidade: "Luziânia/GO",
    empresas: [
      e("g6e1", "MEI José Roberto", "44.555.666/0001-22", "Luziânia/GO", "vencido",
        { 1: "vencido", 2: "vencido", 3: "nao_cadastrado", 4: "nao_cadastrado", 5: "nao_cadastrado", 6: "nao_cadastrado" },
        { responsavel: "José Roberto", pagou: false, manutencao: false, novo: true, ultimoContato: "3 dias" }),
    ],
  },
  {
    id: "g7",
    nome: "Solar Brasil Energia",
    contatoPrincipal: "Larissa Mendes",
    cidade: "Brasília/DF",
    desde: "07/2022",
    plano: "Premium",
    empresas: [
      e("g7e1", "Solar Brasil Energia", "77.888.999/0001-11", "Brasília/DF", "ok",
        { 1: "validado", 2: "validado", 3: "validado", 4: "validado", 5: "validado", 6: "vencendo" },
        { responsavel: "Larissa Mendes", mrr: 2100, ultimoContato: "Hoje 16:40", plano: "Premium", desde: "07/2022" }),
    ],
  },
  {
    id: "g8",
    nome: "TecnoLimp",
    contatoPrincipal: "Rafael Costa",
    cidade: "Águas Claras/DF",
    desde: "04/2026",
    plano: "Essencial",
    empresas: [
      e("g8e1", "TecnoLimp Servicos", "11.222.333/0001-55", "Águas Claras/DF", "pendente",
        { 1: "validado", 2: "validado", 3: "pendente", 4: "pendente", 5: "nao_cadastrado", 6: "nao_cadastrado" },
        { responsavel: "Rafael Costa", mrr: 690, novo: true, ultimoContato: "Ontem 17:30", plano: "Essencial", desde: "04/2026" }),
    ],
  },
];

const sicafBadge: Record<Status, { txt: string; cls: string }> = {
  ok: { txt: "🟢 OK", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20" },
  pendente: { txt: "🟡 Pendente", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20" },
  vencido: { txt: "🔴 Vencido", cls: "bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/20" },
};

const ordemSicaf: Record<Status, number> = { vencido: 0, pendente: 1, ok: 2 };
function piorSicaf(grupo: ClienteGrupo): Status {
  return grupo.empresas.reduce<Status>(
    (acc, emp) => (ordemSicaf[emp.sicaf] < ordemSicaf[acc] ? emp.sicaf : acc),
    "ok",
  );
}

type FiltroKey =
  | "todos"
  | "sicaf_ok"
  | "sicaf_pendente"
  | "pagou"
  | "nao_pagou"
  | "manutencao"
  | "novo";

const filtros: { key: FiltroKey; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "sicaf_ok", label: "SICAF OK" },
  { key: "sicaf_pendente", label: "SICAF Pendente" },
  { key: "pagou", label: "Em dia" },
  { key: "nao_pagou", label: "Inadimplentes" },
  { key: "manutencao", label: "Em manutenção" },
  { key: "novo", label: "Cliente novo" },
];

function ClientesPage() {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<FiltroKey>("todos");
  const [grupoSel, setGrupoSel] = useState<ClienteGrupo | null>(null);
  const [empresaSel, setEmpresaSel] = useState<ClienteDetalhe | null>(null);
  const [openEmpresas, setOpenEmpresas] = useState(false);
  const [openDetalhe, setOpenDetalhe] = useState(false);

  const lista = useMemo(() => {
    return clientes.filter((g) => {
      const matchQ =
        !q ||
        g.nome.toLowerCase().includes(q.toLowerCase()) ||
        g.contatoPrincipal.toLowerCase().includes(q.toLowerCase()) ||
        g.empresas.some((e) => e.cnpj.includes(q) || e.razao.toLowerCase().includes(q.toLowerCase()));
      if (!matchQ) return false;
      const sicaf = piorSicaf(g);
      const algumPagou = g.empresas.some((e) => e.pagou);
      const algumNaoPagou = g.empresas.some((e) => !e.pagou);
      const temManutencao = g.empresas.some((e) => e.manutencao);
      const novo = g.empresas.some((e) => e.novo);
      switch (filtro) {
        case "sicaf_ok": return sicaf === "ok";
        case "sicaf_pendente": return sicaf !== "ok";
        case "pagou": return algumPagou && !algumNaoPagou;
        case "nao_pagou": return algumNaoPagou;
        case "manutencao": return temManutencao;
        case "novo": return novo;
        default: return true;
      }
    });
  }, [q, filtro]);

  const total = clientes.length;
  const totalCnpjs = clientes.reduce((s, g) => s + g.empresas.length, 0);
  const risco = clientes.filter((g) => piorSicaf(g) === "vencido" || g.empresas.some((e) => !e.pagou)).length;
  const mrr = clientes.reduce((s, g) => s + g.empresas.reduce((a, e) => a + e.mrr, 0), 0);

  const abrirGrupo = (g: ClienteGrupo) => {
    setGrupoSel(g);
    setOpenEmpresas(true);
  };

  const abrirEmpresa = (emp: ClienteDetalhe) => {
    setEmpresaSel(emp);
    setOpenEmpresas(false);
    setOpenDetalhe(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Gestão de Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Cada cliente pode ter múltiplos CNPJs. Clique para ver as empresas vinculadas.
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
        <MiniKpi label="Clientes" value={total.toString()} hint="grupos cadastrados" />
        <MiniKpi label="CNPJs vinculados" value={totalCnpjs.toString()} hint="empresas no portfólio" tone="emerald" />
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
              placeholder="Buscar por cliente, contato, CNPJ ou razão social..."
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
                <th className="px-3 py-2 font-medium">CNPJs</th>
                <th className="px-3 py-2 font-medium">Pior SICAF</th>
                <th className="px-3 py-2 font-medium">Contato</th>
                <th className="px-3 py-2 font-medium text-right">MRR total</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((g) => {
                const pior = piorSicaf(g);
                const mrrG = g.empresas.reduce((s, e) => s + e.mrr, 0);
                return (
                  <tr
                    key={g.id}
                    onClick={() => abrirGrupo(g)}
                    className="cursor-pointer border-b border-border/40 transition hover:bg-muted/40"
                  >
                    <td className="px-3 py-3">
                      <div className="font-medium">{g.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {g.contatoPrincipal}
                        {g.cidade ? ` · ${g.cidade}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">
                          {g.empresas.length}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {g.empresas.length === 1 ? "empresa" : "empresas"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${sicafBadge[pior].cls}`}>
                        {sicafBadge[pior].txt}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {g.telefone ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-medium">
                      {mrrG ? `R$ ${mrrG.toLocaleString("pt-BR")}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right" onClick={(ev) => ev.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel className="text-xs">Ações rápidas</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => abrirGrupo(g)}>
                            <Sparkles className="mr-2 h-4 w-4" /> Ver empresas
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
                );
              })}
              {lista.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
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

      <ClienteEmpresasModal
        cliente={grupoSel}
        open={openEmpresas}
        onOpenChange={setOpenEmpresas}
        onSelectEmpresa={abrirEmpresa}
      />
      <ClienteDetalheModal
        cliente={empresaSel}
        open={openDetalhe}
        onOpenChange={(v) => {
          setOpenDetalhe(v);
          if (!v && grupoSel) setOpenEmpresas(true);
        }}
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
