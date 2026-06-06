import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  Building2,
  Crown,
  Eye,
  FileSignature,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Shield,
  UserCog,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, StatusBadge } from "@/components/page-header";
import { NovoColaboradorModal } from "@/components/novo-colaborador-modal";
import { empresasMock } from "@/routes/empresas";

const searchSchema = z.object({
  cnpj: z.string().optional(),
});

export const Route = createFileRoute("/colaboradores")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Colaboradores — CADBRASIL" },
      { name: "description", content: "Gerencie os colaboradores vinculados aos seus CNPJs." },
    ],
  }),
  component: ColaboradoresPage,
});

type Vinculo = "socio" | "admin" | "operador" | "consulta";

type Colaborador = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cargo: string;
  vinculo: Vinculo;
  cnpjs: string[];
  status: "ativo" | "convite";
  ultimoAcesso?: string;
};

const vinculoMeta: Record<Vinculo, { label: string; icon: typeof Crown; cls: string }> = {
  socio: { label: "Sócio", icon: Crown, cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  admin: { label: "Administrador", icon: UserCog, cls: "bg-primary/10 text-primary border-primary/20" },
  operador: { label: "Operador", icon: FileSignature, cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" },
  consulta: { label: "Consulta", icon: Eye, cls: "bg-muted text-muted-foreground border-border" },
};

const colaboradoresMock: Colaborador[] = [
  {
    id: "1",
    nome: "João da Silva",
    email: "joao@empresademo.com.br",
    telefone: "(11) 99888-7766",
    cargo: "Diretor",
    vinculo: "socio",
    cnpjs: ["00.000.000/0001-00"],
    status: "ativo",
    ultimoAcesso: "Hoje, 09:42",
  },
  {
    id: "2",
    nome: "Maria Souza",
    email: "maria@empresademo.com.br",
    telefone: "(11) 97777-1122",
    cargo: "Gerente Administrativa",
    vinculo: "admin",
    cnpjs: ["00.000.000/0001-00", "12.345.678/0001-99"],
    status: "ativo",
    ultimoAcesso: "Ontem, 17:08",
  },
  {
    id: "3",
    nome: "Carlos Pereira",
    email: "carlos@jrcomercio.com.br",
    telefone: "(31) 98888-4455",
    cargo: "Analista Fiscal",
    vinculo: "operador",
    cnpjs: ["12.345.678/0001-99"],
    status: "ativo",
    ultimoAcesso: "2 dias atrás",
  },
  {
    id: "4",
    nome: "Ana Lima",
    email: "ana.lima@contabil.com",
    telefone: "(11) 96666-2233",
    cargo: "Contadora externa",
    vinculo: "consulta",
    cnpjs: ["00.000.000/0001-00", "23.456.789/0001-11"],
    status: "convite",
  },
];

function ColaboradoresPage() {
  const { cnpj } = Route.useSearch();
  const [busca, setBusca] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>(colaboradoresMock);

  const empresaFiltro = useMemo(
    () => empresasMock.find((e) => e.cnpj === cnpj) ?? null,
    [cnpj],
  );

  const lista = useMemo(() => {
    return colaboradores.filter((c) => {
      if (cnpj && !c.cnpjs.includes(cnpj)) return false;
      if (busca && !`${c.nome} ${c.email} ${c.cargo}`.toLowerCase().includes(busca.toLowerCase()))
        return false;
      return true;
    });
  }, [colaboradores, cnpj, busca]);

  const total = lista.length;
  const ativos = lista.filter((c) => c.status === "ativo").length;
  const convites = lista.filter((c) => c.status === "convite").length;

  const handleCreate = (c: {
    nome: string;
    email: string;
    telefone: string;
    cargo: string;
    vinculo: Vinculo;
    cnpjs: string[];
  }) => {
    setColaboradores((p) => [
      {
        id: String(Date.now()),
        nome: c.nome,
        email: c.email,
        telefone: c.telefone,
        cargo: c.cargo || "—",
        vinculo: c.vinculo,
        cnpjs: c.cnpjs,
        status: "convite",
      },
      ...p,
    ]);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="gap-2 -ml-2">
          <Link to="/empresas">
            <ArrowLeft className="h-4 w-4" />
            Voltar para Empresas
          </Link>
        </Button>
      </div>

      <PageHeader
        icon={<Users className="h-5 w-5" />}
        title="Colaboradores"
        subtitle={
          empresaFiltro
            ? `Equipe vinculada a ${empresaFiltro.nome}`
            : "Pessoas com acesso aos CNPJs da sua organização."
        }
        action={
          <Button size="lg" className="gap-2" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Novo Colaborador
          </Button>
        }
      />

      {empresaFiltro && (
        <div className="mt-4 rounded-xl border bg-primary/5 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">{empresaFiltro.nome}</p>
              <p className="text-xs text-muted-foreground">CNPJ {empresaFiltro.cnpj}</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/colaboradores">Ver todos os colaboradores</Link>
          </Button>
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total</p>
          <p className="mt-1 text-3xl font-bold">{total}</p>
        </CardContent></Card>
        <Card className="border-success/30 bg-success/5"><CardContent className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Ativos</p>
          <p className="mt-1 text-3xl font-bold text-success">{ativos}</p>
        </CardContent></Card>
        <Card className="border-warning/40 bg-warning/5"><CardContent className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Convites pendentes</p>
          <p className="mt-1 text-3xl font-bold text-warning-foreground">{convites}</p>
        </CardContent></Card>
      </div>

      <Card className="mt-6 shadow-soft">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base font-semibold">Equipe</CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-9"
              placeholder="Buscar por nome ou e-mail"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {lista.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed bg-muted/20 p-10 text-center">
              <Users className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="mt-3 font-semibold">Nenhum colaborador encontrado</p>
              <p className="text-sm text-muted-foreground mt-1">
                Adicione o primeiro colaborador para esta empresa.
              </p>
              <Button className="mt-4 gap-2" onClick={() => setModalOpen(true)}>
                <Plus className="h-4 w-4" /> Novo Colaborador
              </Button>
            </div>
          ) : (
            lista.map((c) => {
              const vm = vinculoMeta[c.vinculo];
              const VIcon = vm.icon;
              return (
                <div
                  key={c.id}
                  className="flex flex-col gap-4 rounded-xl border bg-card p-5 transition hover:shadow-soft sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-12 w-12 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                      {c.nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold leading-tight">{c.nome}</p>
                        {c.status === "convite" ? (
                          <StatusBadge status="warn">Convite pendente</StatusBadge>
                        ) : (
                          <StatusBadge status="ok">Ativo</StatusBadge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.cargo}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>
                        <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.telefone}</span>
                        {c.ultimoAcesso && (
                          <span className="inline-flex items-center gap-1"><Shield className="h-3 w-3" />Último acesso: {c.ultimoAcesso}</span>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${vm.cls}`}>
                          <VIcon className="h-3 w-3" /> {vm.label}
                        </span>
                        {c.cnpjs.map((cn) => {
                          const emp = empresasMock.find((e) => e.cnpj === cn);
                          return (
                            <span key={cn} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                              <Building2 className="h-3 w-3" />
                              {emp ? emp.nome.split(" ").slice(0, 3).join(" ") : cn}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 sm:flex-col sm:items-stretch">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <UserCog className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1.5">
                      <MoreHorizontal className="h-3.5 w-3.5" /> Mais
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <NovoColaboradorModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        defaultCnpj={cnpj}
        onCreate={handleCreate}
      />
    </div>
  );
}
