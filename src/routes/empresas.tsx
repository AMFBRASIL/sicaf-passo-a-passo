import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, ChevronRight, Edit3, FileText, MapPin, Plus, Rocket, Save, RefreshCw, ShieldCheck, User, X, Search, Loader2, QrCode, Receipt, Check, ArrowRight, ArrowLeft, Sparkles, CheckCircle2, Mail, Phone, Briefcase, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { PageHeader, StatusBadge } from "@/components/page-header";

export const Route = createFileRoute("/empresas")({
  head: () => ({
    meta: [
      { title: "Minhas Empresas — CADBRASIL" },
      { name: "description", content: "Gerencie o SICAF de todas as suas empresas em um só lugar." },
    ],
  }),
  component: EmpresasPage,
});

type SicafStatus = "ativo" | "atencao" | "vencido" | "sem_cadastro";

interface EmpresaData {
  nome: string;
  cnpj: string;
  sicaf: SicafStatus;
  validade?: string;
  proximoPasso: string;
  acao: { label: string; variant?: "default" | "outline"; icon: typeof Rocket };
  endereco: string;
  cidade: string;
  uf: string;
  telefone: string;
  email: string;
  responsavel: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  ramoAtividade: string;
}

const empresasMock: EmpresaData[] = [
  {
    nome: "Empresa Demonstração LTDA",
    cnpj: "00.000.000/0001-00",
    sicaf: "atencao",
    validade: "28/02/2026",
    proximoPasso: "Atualizar Nível III e IV antes do vencimento.",
    acao: { label: "Atualizar SICAF", icon: Rocket },
    endereco: "Av. Paulista, 1000 - Sala 1201",
    cidade: "São Paulo",
    uf: "SP",
    telefone: "(11) 3456-7890",
    email: "contato@empresademo.com.br",
    responsavel: "João da Silva",
    inscricaoEstadual: "123.456.789.000",
    inscricaoMunicipal: "9876543210",
    ramoAtividade: "Serviços de Consultoria em TI",
  },
  {
    nome: "JR Comércio e Serviços ME",
    cnpj: "12.345.678/0001-99",
    sicaf: "ativo",
    validade: "10/09/2026",
    proximoPasso: "Tudo em dia. Vamos monitorar por você.",
    acao: { label: "Ver detalhes", variant: "outline", icon: RefreshCw },
    endereco: "Rua Rio de Janeiro, 450 - Centro",
    cidade: "Belo Horizonte",
    uf: "MG",
    telefone: "(31) 2345-6789",
    email: "contato@jrcomercio.com.br",
    responsavel: "Maria Oliveira",
    inscricaoEstadual: "987.654.321.000",
    inscricaoMunicipal: "1234567890",
    ramoAtividade: "Comércio Varejista",
  },
  {
    nome: "JR Construtora EIRELI",
    cnpj: "23.456.789/0001-11",
    sicaf: "vencido",
    validade: "Vencido em 14/10/2025",
    proximoPasso: "Sua empresa está fora de licitações. Atualize agora.",
    acao: { label: "Resolver agora", icon: Rocket },
    endereco: "Av. das Américas, 5000 - Bloco 2",
    cidade: "Rio de Janeiro",
    uf: "RJ",
    telefone: "(21) 3456-7890",
    email: "obras@jrconstrutora.com.br",
    responsavel: "Pedro Costa",
    inscricaoEstadual: "456.789.123.000",
    inscricaoMunicipal: "5678901234",
    ramoAtividade: "Construção Civil",
  },
  {
    nome: "Nova Filial Brasília LTDA",
    cnpj: "34.567.890/0001-22",
    sicaf: "sem_cadastro",
    proximoPasso: "Esta empresa ainda não possui SICAF. Vamos cadastrar?",
    acao: { label: "Cadastrar SICAF", icon: Plus },
    endereco: "SHS Qd. 6, Bloco C - Asa Sul",
    cidade: "Brasília",
    uf: "DF",
    telefone: "(61) 3456-7890",
    email: "filial@novabrasilia.com.br",
    responsavel: "Ana Souza",
    inscricaoEstadual: "N/A",
    inscricaoMunicipal: "N/A",
    ramoAtividade: "Prestação de Serviços Administrativos",
  },
];

const statusLabel: Record<SicafStatus, { label: string; status: "ok" | "warn" | "danger" | "idle" }> = {
  ativo: { label: "SICAF Ativo", status: "ok" },
  atencao: { label: "Atualização recomendada", status: "warn" },
  vencido: { label: "SICAF Vencido", status: "danger" },
  sem_cadastro: { label: "Sem cadastro SICAF", status: "idle" },
};

function EmpresaDetalhesSheet({
  empresa,
  open,
  onOpenChange,
}: {
  empresa: EmpresaData | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<Partial<EmpresaData>>({});

  const startEditing = () => {
    if (!empresa) return;
    setForm({ ...empresa });
    setEditando(true);
  };

  const cancelEditing = () => {
    setEditando(false);
    setForm({});
  };

  const saveEditing = () => {
    // Aqui viria a chamada ao backend para salvar
    setEditando(false);
    setForm({});
  };

  const updateField = (field: keyof EmpresaData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (!empresa) return null;

  const meta = statusLabel[empresa.sicaf];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-xl leading-tight">{empresa.nome}</SheetTitle>
              <SheetDescription className="mt-1">
                CNPJ {empresa.cnpj} · <StatusBadge status={meta.status}>{meta.label}</StatusBadge>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-5">
          {!editando ? (
            <div className="space-y-6">
              {/* SICAF */}
              <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Situação SICAF
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="text-sm font-medium mt-0.5"><StatusBadge status={meta.status}>{meta.label}</StatusBadge></p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Validade</p>
                    <p className="text-sm font-medium mt-0.5">{empresa.validade ?? "—"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Próximo passo</p>
                    <p className="text-sm font-medium mt-0.5">{empresa.proximoPasso}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Dados cadastrais */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  Dados Cadastrais
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Razão Social / Nome Fantasia</p>
                    <p className="text-sm font-medium mt-0.5">{empresa.nome}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">CNPJ</p>
                    <p className="text-sm font-medium mt-0.5">{empresa.cnpj}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Inscrição Estadual</p>
                    <p className="text-sm font-medium mt-0.5">{empresa.inscricaoEstadual}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Inscrição Municipal</p>
                    <p className="text-sm font-medium mt-0.5">{empresa.inscricaoMunicipal}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Ramo de Atividade</p>
                    <p className="text-sm font-medium mt-0.5">{empresa.ramoAtividade}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Endereço */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <MapPin className="h-4 w-4 text-primary" />
                  Endereço e Contato
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Endereço</p>
                    <p className="text-sm font-medium mt-0.5">{empresa.endereco}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cidade / UF</p>
                    <p className="text-sm font-medium mt-0.5">{empresa.cidade} / {empresa.uf}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="text-sm font-medium mt-0.5">{empresa.telefone}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">E-mail</p>
                    <p className="text-sm font-medium mt-0.5">{empresa.email}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Responsável */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <User className="h-4 w-4 text-primary" />
                  Responsável
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Nome do responsável legal</p>
                    <p className="text-sm font-medium mt-0.5">{empresa.responsavel}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* SICAF */}
              <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Situação SICAF
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="text-sm font-medium mt-0.5"><StatusBadge status={meta.status}>{meta.label}</StatusBadge></p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Validade</p>
                    <p className="text-sm font-medium mt-0.5">{empresa.validade ?? "—"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Próximo passo</p>
                    <p className="text-sm font-medium mt-0.5">{empresa.proximoPasso}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Dados cadastrais editáveis */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  Dados Cadastrais
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="nome">Razão Social / Nome Fantasia</Label>
                    <Input id="nome" value={form.nome ?? ""} onChange={(e) => updateField("nome", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input id="cnpj" value={form.cnpj ?? ""} onChange={(e) => updateField("cnpj", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ramoAtividade">Ramo de Atividade</Label>
                    <Input id="ramoAtividade" value={form.ramoAtividade ?? ""} onChange={(e) => updateField("ramoAtividade", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inscricaoEstadual">Inscrição Estadual</Label>
                    <Input id="inscricaoEstadual" value={form.inscricaoEstadual ?? ""} onChange={(e) => updateField("inscricaoEstadual", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inscricaoMunicipal">Inscrição Municipal</Label>
                    <Input id="inscricaoMunicipal" value={form.inscricaoMunicipal ?? ""} onChange={(e) => updateField("inscricaoMunicipal", e.target.value)} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Endereço editável */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <MapPin className="h-4 w-4 text-primary" />
                  Endereço e Contato
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input id="endereco" value={form.endereco ?? ""} onChange={(e) => updateField("endereco", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input id="cidade" value={form.cidade ?? ""} onChange={(e) => updateField("cidade", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="uf">UF</Label>
                    <Input id="uf" maxLength={2} value={form.uf ?? ""} onChange={(e) => updateField("uf", e.target.value.toUpperCase())} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input id="telefone" value={form.telefone ?? ""} onChange={(e) => updateField("telefone", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" value={form.email ?? ""} onChange={(e) => updateField("email", e.target.value)} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Responsável editável */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <User className="h-4 w-4 text-primary" />
                  Responsável
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="responsavel">Nome do responsável legal</Label>
                  <Input id="responsavel" value={form.responsavel ?? ""} onChange={(e) => updateField("responsavel", e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        <SheetFooter className="px-6 py-4 border-t flex flex-col sm:flex-row gap-3">
          {!editando ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-2">
                <X className="h-4 w-4" />
                Fechar
              </Button>
              <Button onClick={startEditing} className="gap-2">
                <Edit3 className="h-4 w-4" />
                Editar dados
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={cancelEditing} className="gap-2">
                <X className="h-4 w-4" />
                Cancelar
              </Button>
              <Button onClick={saveEditing} className="gap-2">
                <Save className="h-4 w-4" />
                Salvar alterações
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function EmpresasPage() {
  const [detalhesEmpresa, setDetalhesEmpresa] = useState<EmpresaData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const total = empresasMock.length;
  const ativos = empresasMock.filter((e) => e.sicaf === "ativo").length;
  const precisamAcao = empresasMock.filter(
    (e) => e.sicaf === "vencido" || e.sicaf === "atencao" || e.sicaf === "sem_cadastro",
  ).length;

  const abrirDetalhes = (empresa: EmpresaData) => {
    setDetalhesEmpresa(empresa);
    setSheetOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<Building2 className="h-5 w-5" />}
        title="Minhas Empresas"
        subtitle="Gerencie o SICAF de cada CNPJ — atualize ou cadastre novos."
        action={
          <Button size="lg" className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar nova empresa
          </Button>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Empresas cadastradas</p>
            <p className="mt-1 text-3xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">SICAFs em dia</p>
            <p className="mt-1 text-3xl font-bold text-success">{ativos}</p>
          </CardContent>
        </Card>
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Precisam de ação</p>
            <p className="mt-1 text-3xl font-bold text-warning-foreground">{precisamAcao}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Selecione uma empresa para continuar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {empresasMock.map((e) => {
            const meta = statusLabel[e.sicaf];
            const Icon = e.acao.icon;
            return (
              <div
                key={e.cnpj}
                className={`flex flex-col gap-4 rounded-xl border p-5 transition hover:shadow-soft sm:flex-row sm:items-center sm:justify-between ${
                  e.sicaf === "vencido"
                    ? "border-danger/30 bg-danger/5"
                    : e.sicaf === "atencao"
                    ? "border-warning/40 bg-warning/5"
                    : e.sicaf === "sem_cadastro"
                    ? "border-dashed border-border bg-muted/30"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold leading-tight">{e.nome}</p>
                    <p className="text-xs text-muted-foreground">CNPJ {e.cnpj}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={meta.status}>{meta.label}</StatusBadge>
                      {e.validade && (
                        <span className="text-xs text-muted-foreground">
                          {e.sicaf === "vencido" ? e.validade : `Validade: ${e.validade}`}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{e.proximoPasso}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2 sm:flex-col sm:items-stretch">
                  <Button asChild variant={e.acao.variant ?? "default"} className="gap-2">
                    <Link to="/sicaf">
                      <Icon className="h-4 w-4" />
                      {e.acao.label}
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => abrirDetalhes(e)}
                  >
                    Mais detalhes
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="mt-4 border-dashed">
        <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Tem mais empresas para gerenciar?</p>
              <p className="text-sm text-muted-foreground">
                Adicione quantos CNPJs precisar — cuidamos do SICAF de todos.
              </p>
            </div>
          </div>
          <Button size="lg" variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar empresa
          </Button>
        </CardContent>
      </Card>

      <EmpresaDetalhesSheet
        empresa={detalhesEmpresa}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
