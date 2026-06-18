import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Copy, Eye, Building2, Mail, Phone, FileText, Award } from "lucide-react";
import { toast } from "sonner";
import {
  criarAdminCliente,
  fetchAdminClientes,
  fetchAdminGrupo,
  mapApiClientToDetalhe,
  mapApiGroupToClienteGrupo,
  mapNiveisFromApi,
  isClienteApto,
  type ApiAdminClient,
} from "@/lib/admin-clientes-api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Filter,
  Plus,
  Download,
  ShieldCheck,
} from "lucide-react";
import {
  ClienteEmpresasModal,
  type ClienteGrupo,
} from "@/components/admin/cliente-empresas-modal";
import {
  ClienteDetalheModal,
  type ClienteDetalhe,
} from "@/components/admin/cliente-detalhe-modal";
import { NovoClienteModal } from "@/components/admin/novo-cliente-modal";
import { NivelDots } from "@/components/admin/nivel-dots";

export const Route = createFileRoute("/admin/clientes")({
  component: ClientesPage,
});

type FiltroKey =
  | "todos"
  | "sicaf_ok"
  | "sicaf_pendente"
  | "pagou"
  | "nao_pagou"
  | "manutencao"
  | "novo"
  | "apto"
  | "inapto";

const filtros: { key: FiltroKey; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "sicaf_ok", label: "SICAF Ativo" },
  { key: "sicaf_pendente", label: "SICAF Inativo" },
  { key: "pagou", label: "SICAF Pago" },
  { key: "nao_pagou", label: "SICAF Não pago" },
  { key: "apto", label: "APTO" },
  { key: "inapto", label: "INAPTO" },
  { key: "manutencao", label: "Em manutenção" },
  { key: "novo", label: "Cliente novo" },
];

function formatCadastroDateTime(raw?: string | null) {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClienteCls(status?: string) {
  switch (status) {
    case "Ativo":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20";
    case "Pendente":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20";
    case "Inativo":
      return "bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function truncateEmpresa(nome: string, max = 42) {
  if (nome.length <= max) return nome;
  return `${nome.slice(0, max).trim()}…`;
}

function ClienteBadges({
  c,
  apto,
  sicafAtivo,
  compact = false,
}: {
  c: ApiAdminClient;
  apto: boolean;
  sicafAtivo: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "" : "justify-center"}`}>
      <Badge variant="outline" className={`rounded-full text-[10px] ${statusClienteCls(c.status)}`}>
        {c.status || "—"}
      </Badge>
      <Badge
        variant="outline"
        className={`rounded-full text-[10px] ${
          sicafAtivo
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20"
            : "bg-slate-500/10 text-slate-600 dark:text-slate-300 ring-1 ring-slate-500/20"
        }`}
      >
        {sicafAtivo ? "SICAF Ativo" : "SICAF Inativo"}
      </Badge>
      <Badge
        variant="outline"
        className={`rounded-full text-[10px] ${
          c.pagou ?? c.sicafPago
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20"
            : "bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/20"
        }`}
      >
        {c.pagou ?? c.sicafPago ? "Pago" : "Não pago"}
      </Badge>
      <Badge
        variant="outline"
        className={`rounded-full text-[10px] font-semibold ${
          apto
            ? "bg-emerald-600 text-white ring-1 ring-emerald-600/30"
            : "bg-red-600 text-white ring-1 ring-red-600/30"
        }`}
      >
        {apto ? "APTO" : "INAPTO"}
      </Badge>
    </div>
  );
}

function ClienteMobileCard({
  c,
  onOpen,
}: {
  c: ApiAdminClient;
  onOpen: () => void;
}) {
  const niveis = mapNiveisFromApi(c.sicafNiveis, undefined, { sicafStatus: c.sicafStatus });
  const apto = isClienteApto(niveis);
  const sicafAtivo = c.sicafAtivo ?? (c.sicafStatus === "Ativo" || c.sicafStatus === "Vencendo");

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-lg border border-border/60 bg-card p-3 text-left transition hover:bg-muted/40 active:bg-muted/60"
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Building2 className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium leading-snug" title={c.name}>
            {c.name}
          </p>
          {c.createdAt && (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Cadastro: {formatCadastroDateTime(c.createdAt)}
            </p>
          )}
        </div>
        <Eye className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <span className="font-mono text-[11px] font-bold">{c.documento}</span>
        <button
          type="button"
          className="rounded p-0.5 hover:bg-muted"
          title="Copiar documento"
          onClick={(e) => {
            e.stopPropagation();
            void navigator.clipboard.writeText(c.documento.replace(/\D/g, ""));
            toast.success("Documento copiado");
          }}
        >
          <Copy className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>

      {(c.email || c.phone) && (
        <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
          {c.email && (
            <div className="flex items-center gap-1 min-w-0">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{c.email}</span>
            </div>
          )}
          {c.phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3 shrink-0" />
              <span>{c.phone}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-2.5">
        <ClienteBadges c={c} apto={apto} sicafAtivo={sicafAtivo} compact />
      </div>

      <div className="mt-2.5 -mx-1 overflow-x-auto pb-1" onClick={(e) => e.stopPropagation()}>
        <NivelDots niveis={niveis} size="sm" />
      </div>

      <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <FileText className="h-3 w-3" /> {c.activeBids ?? 0} lic.
        </span>
        <span className="inline-flex items-center gap-1">
          <Award className="h-3 w-3" /> {c.certificates ?? 0} cert.
        </span>
      </div>
    </button>
  );
}

function ClientesPage() {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<FiltroKey>("todos");
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [grupoSel, setGrupoSel] = useState<ClienteGrupo | null>(null);
  const [empresaSel, setEmpresaSel] = useState<ClienteDetalhe | null>(null);
  const [openEmpresas, setOpenEmpresas] = useState(false);
  const [openDetalhe, setOpenDetalhe] = useState(false);
  const [openNovo, setOpenNovo] = useState(false);
  const [empresas, setEmpresas] = useState<ApiAdminClient[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ totalClientes: 0, totalCnpjs: 0, emRisco: 0, mrr: 0 });
  const [loading, setLoading] = useState(true);
  const abrindoDetalheRef = useRef(false);

  const sicafApiParam = useMemo(() => {
    if (filtro === "sicaf_ok") return "ok";
    if (filtro === "sicaf_pendente") return "pending";
    return "all";
  }, [filtro]);

  const carregar = useCallback(async (search = "", p = page, limit = itemsPerPage) => {
    setLoading(true);
    const res = await fetchAdminClientes({
      search,
      page: p,
      limit,
      sicaf: sicafApiParam,
      filtro,
    });
    if (!res.ok) {
      toast.error(res.error || "Erro ao carregar clientes");
      setLoading(false);
      return;
    }
    setEmpresas(res.clients || []);
    setTotal(res.total ?? res.clients?.length ?? 0);
    setTotalPages(res.totalPages ?? 1);
    if (res.stats) setStats(res.stats);
    setLoading(false);
  }, [filtro, sicafApiParam]);

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar(q, page, itemsPerPage);
    }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, page, itemsPerPage, filtro, carregar]);

  useEffect(() => {
    setPage(1);
  }, [q, filtro, itemsPerPage]);

  const lista = empresas;

  const startIndex = total > 0 ? (page - 1) * itemsPerPage + 1 : 0;
  const endIndex = Math.min(page * itemsPerPage, total);

  const { totalClientes: totalGrupos, totalCnpjs, emRisco: risco, mrr } = stats;

  const abrirGrupoDoCliente = async (c: ApiAdminClient) => {
    setOpenDetalhe(false);
    setEmpresaSel(null);

    if (c.userId) {
      const res = await fetchAdminGrupo({ grupoId: `u-${c.userId}` });
      if (res.ok && res.grupo) {
        setGrupoSel(mapApiGroupToClienteGrupo(res.grupo));
        setOpenEmpresas(true);
        return;
      }
    }

    const niveis = mapNiveisFromApi(c.sicafNiveis, undefined, { sicafStatus: c.sicafStatus });
    const detalhe = mapApiClientToDetalhe(c, { niveis });
    setGrupoSel({
      id: c.userId ? `u-${c.userId}` : `c-${c.id}`,
      nome: c.usuarioNome || c.name,
      contatoPrincipal: c.usuarioNome || c.name,
      email: c.email,
      telefone: c.phone,
      empresas: [detalhe],
    });
    setOpenEmpresas(true);
  };

  const abrirDetalheEmpresa = (emp: ClienteDetalhe) => {
    abrindoDetalheRef.current = true;
    setEmpresaSel(emp);
    setOpenDetalhe(true);
    setOpenEmpresas(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Gestão de Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Listagem por CNPJ com níveis SICAF, situação de pagamento e APTO/INAPTO.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Exportar
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setOpenNovo(true)}>
            <Plus className="h-3.5 w-3.5" /> Novo cliente
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniKpi label="Grupos" value={totalGrupos.toString()} hint="logins cadastrados" />
        <MiniKpi label="CNPJs" value={totalCnpjs.toString()} hint="empresas no portfólio" tone="emerald" />
        <MiniKpi label="Em risco" value={risco.toString()} hint="inadimplência ou SICAF vencido" tone="rose" />
        <MiniKpi label="MRR estimado" value={`R$ ${mrr.toLocaleString("pt-BR")}`} hint="receita recorrente mensal" tone="violet" />
      </div>

      <Card className="mt-5 overflow-hidden p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por CNPJ, e-mail, nome ou razão social..."
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
                onClick={() => {
                  setFiltro(f.key);
                  setPage(1);
                }}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-b pb-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs sm:text-sm">
            {loading ? (
              "Carregando..."
            ) : (
              <>
                Exibindo <span className="font-semibold text-foreground">{total > 0 ? startIndex : 0}</span> a{" "}
                <span className="font-semibold text-foreground">{endIndex}</span> de{" "}
                <span className="font-semibold text-foreground">{total.toLocaleString("pt-BR")}</span> empresas
              </>
            )}
          </span>
          <div className="flex items-center gap-2">
            <Label htmlFor="items-per-page" className="text-xs">
              Itens por página:
            </Label>
            <Select
              value={String(itemsPerPage)}
              onValueChange={(v) => {
                setItemsPerPage(parseInt(v, 10));
                setPage(1);
              }}
            >
              <SelectTrigger id="items-per-page" className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Mobile — cards */}
        <div className="mt-3 space-y-2 md:hidden">
          {loading && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 inline h-5 w-5 animate-spin" />
              Carregando clientes...
            </div>
          )}
          {!loading &&
            lista.map((c) => (
              <ClienteMobileCard key={c.id} c={c} onOpen={() => void abrirGrupoDoCliente(c)} />
            ))}
          {!loading && lista.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma empresa encontrada com esses filtros.
            </p>
          )}
        </div>

        {/* Tablet/Desktop — tabela compacta */}
        <div className="mt-2 hidden overflow-x-auto md:block">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col style={{ width: "18%" }} />
              <col style={{ width: "128px" }} />
              <col style={{ width: "132px" }} />
              <col style={{ width: "52px" }} />
              <col style={{ width: "52px" }} />
              <col style={{ width: "64px" }} />
              <col style={{ width: "60px" }} />
              <col style={{ width: "64px" }} />
              <col style={{ width: "60px" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "40px" }} />
            </colgroup>
            <thead>
              <tr className="border-b text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-2 py-2 font-medium">Empresa</th>
                <th className="px-2 py-2 font-medium">CNPJ</th>
                <th className="hidden px-2 py-2 font-medium lg:table-cell">Contato</th>
                <th className="hidden px-2 py-2 text-center font-medium xl:table-cell">Lic.</th>
                <th className="hidden px-2 py-2 text-center font-medium xl:table-cell">Cert.</th>
                <th className="px-1 py-2 text-center font-medium">Status</th>
                <th className="px-1 py-2 text-center font-medium">SICAF</th>
                <th className="px-1 py-2 text-center font-medium">Pago</th>
                <th className="px-1 py-2 text-center font-medium">APTO</th>
                <th className="px-2 py-2 text-center font-medium">Níveis</th>
                <th className="px-1 py-2 text-center font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 inline h-5 w-5 animate-spin" />
                    Carregando clientes...
                  </td>
                </tr>
              )}
              {!loading &&
                lista.map((c) => {
                  const niveis = mapNiveisFromApi(c.sicafNiveis, undefined, { sicafStatus: c.sicafStatus });
                  const apto = isClienteApto(niveis);
                  const sicafAtivo =
                    c.sicafAtivo ?? (c.sicafStatus === "Ativo" || c.sicafStatus === "Vencendo");
                  return (
                    <tr
                      key={c.id}
                      onClick={() => void abrirGrupoDoCliente(c)}
                      className="cursor-pointer border-b border-border/40 transition hover:bg-muted/40"
                    >
                      <td className="max-w-0 px-2 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:flex">
                            <Building2 className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="min-w-0 overflow-hidden">
                            <div className="truncate text-xs font-medium leading-tight" title={c.name}>
                              {truncateEmpresa(c.name, 36)}
                            </div>
                            {c.createdAt && (
                              <div className="truncate text-[10px] text-muted-foreground">
                                {formatCadastroDateTime(c.createdAt)}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-0.5">
                          <span className="truncate font-mono text-[10px] font-bold" title={c.documento}>
                            {c.documento}
                          </span>
                          <button
                            type="button"
                            className="shrink-0 rounded p-0.5 hover:bg-muted"
                            title="Copiar documento"
                            onClick={(e) => {
                              e.stopPropagation();
                              void navigator.clipboard.writeText(c.documento.replace(/\D/g, ""));
                              toast.success("Documento copiado");
                            }}
                          >
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                      </td>
                      <td className="hidden max-w-0 px-2 py-2.5 lg:table-cell">
                        <div className="space-y-0.5 overflow-hidden">
                          {c.email && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate" title={c.email}>
                                {c.email}
                              </span>
                            </div>
                          )}
                          {c.phone && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span className="truncate">{c.phone}</span>
                            </div>
                          )}
                          {!c.email && !c.phone && (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                      <td className="hidden px-2 py-2.5 text-center xl:table-cell">
                        <span className="text-xs font-medium">{c.activeBids ?? 0}</span>
                      </td>
                      <td className="hidden px-2 py-2.5 text-center xl:table-cell">
                        <span className="text-xs font-medium">{c.certificates ?? 0}</span>
                      </td>
                      <td className="px-1 py-2.5 text-center">
                        <Badge
                          variant="outline"
                          className={`rounded-full px-1.5 py-0 text-[9px] ${statusClienteCls(c.status)}`}
                        >
                          {(c.status || "—").slice(0, 4)}
                        </Badge>
                      </td>
                      <td className="px-1 py-2.5 text-center">
                        <Badge
                          variant="outline"
                          className={`rounded-full px-1.5 py-0 text-[9px] ${
                            sicafAtivo
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "bg-slate-500/10 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {sicafAtivo ? "Ativo" : "Inat."}
                        </Badge>
                      </td>
                      <td className="px-1 py-2.5 text-center">
                        <Badge
                          variant="outline"
                          className={`rounded-full px-1.5 py-0 text-[9px] ${
                            c.pagou ?? c.sicafPago
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          {c.pagou ?? c.sicafPago ? "Sim" : "Não"}
                        </Badge>
                      </td>
                      <td className="px-1 py-2.5 text-center">
                        <Badge
                          variant="outline"
                          className={`rounded-full px-1.5 py-0 text-[9px] font-semibold ${
                            apto ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                          }`}
                        >
                          {apto ? "APTO" : "INAP."}
                        </Badge>
                      </td>
                      <td className="px-1 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center overflow-x-auto">
                          <NivelDots niveis={niveis} size="sm" />
                        </div>
                      </td>
                      <td className="px-1 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => void abrirGrupoDoCliente(c)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              {!loading && lista.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    Nenhuma empresa encontrada com esses filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{lista.length} exibidas nesta página</span>
          <div className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Dados sincronizados com cadbrasilv2
          </div>
        </div>
      </Card>

      <ClienteEmpresasModal
        cliente={grupoSel}
        open={openEmpresas}
        onOpenChange={(v) => {
          setOpenEmpresas(v);
          if (!v) {
            if (abrindoDetalheRef.current) {
              abrindoDetalheRef.current = false;
              return;
            }
            setGrupoSel(null);
            setEmpresaSel(null);
          }
        }}
        onSelectEmpresa={abrirDetalheEmpresa}
      />
      <ClienteDetalheModal
        cliente={empresaSel}
        grupoEmpresas={grupoSel?.empresas}
        open={openDetalhe}
        onOpenChange={(v) => {
          setOpenDetalhe(v);
          if (!v && grupoSel) setOpenEmpresas(true);
        }}
        onSelectEmpresa={abrirDetalheEmpresa}
        onVerTodasEmpresas={() => {
          setOpenDetalhe(false);
          if (grupoSel) setOpenEmpresas(true);
        }}
        onUpdated={() => void carregar(q, page, itemsPerPage)}
      />
      <NovoClienteModal
        open={openNovo}
        onOpenChange={setOpenNovo}
        onCriar={async (data) => {
          const res = await criarAdminCliente(data);
          if (!res.ok) {
            toast.error(res.error || "Erro ao criar cliente");
            throw new Error(res.error);
          }
          await carregar(q, page, itemsPerPage);
        }}
      />
    </div>
  );
}

function MiniKpi({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "emerald" | "rose" | "violet";
}) {
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
