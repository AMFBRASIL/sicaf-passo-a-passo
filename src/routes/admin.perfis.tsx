import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Shield,
  Crown,
  Headphones,
  FileText,
  DollarSign,
  Users,
  Plus,
  Search,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/perfis")({
  component: PerfisPage,
});

interface Perfil {
  id: string;
  nome: string;
  descricao: string;
  cor: string;
  icon: any;
  membros: number;
  permissoes: Record<string, boolean>;
}

const grupos: { titulo: string; descricao: string; itens: { key: string; label: string; hint: string }[] }[] = [
  {
    titulo: "Clientes",
    descricao: "Acesso e operação de clientes",
    itens: [
      { key: "clientes.view", label: "Visualizar clientes", hint: "Ver lista e detalhes" },
      { key: "clientes.edit", label: "Editar clientes", hint: "Alterar dados cadastrais" },
      { key: "clientes.delete", label: "Excluir clientes", hint: "Remoção definitiva" },
    ],
  },
  {
    titulo: "Financeiro",
    descricao: "Cobranças, boletos e PIX",
    itens: [
      { key: "fin.view", label: "Ver faturas", hint: "Listagem e histórico" },
      { key: "fin.create", label: "Gerar cobranças", hint: "Boleto / PIX" },
      { key: "fin.authorize", label: "Autorizar pagamentos", hint: "Conciliação manual" },
      { key: "fin.cancel", label: "Cancelar boletos", hint: "Com motivo" },
    ],
  },
  {
    titulo: "SICAF",
    descricao: "Renovações e níveis",
    itens: [
      { key: "sicaf.view", label: "Visualizar SICAF", hint: "Status e níveis" },
      { key: "sicaf.renovar", label: "Renovar SICAF", hint: "Executar renovação" },
      { key: "sicaf.docs", label: "Anexar documentos", hint: "Upload no portal" },
    ],
  },
  {
    titulo: "Suporte",
    descricao: "Tickets e atendimento",
    itens: [
      { key: "sup.view", label: "Ver tickets", hint: "Acessar kanban" },
      { key: "sup.reply", label: "Responder tickets", hint: "Enviar mensagens" },
      { key: "sup.close", label: "Fechar tickets", hint: "Marcar como resolvido" },
    ],
  },
  {
    titulo: "Administração",
    descricao: "Gestão da plataforma",
    itens: [
      { key: "adm.equipe", label: "Gerenciar equipe", hint: "Adicionar/remover" },
      { key: "adm.perfis", label: "Gerenciar perfis", hint: "Permissões" },
      { key: "adm.config", label: "Configurações", hint: "Sistema" },
      { key: "adm.audit", label: "Auditoria", hint: "Logs e histórico" },
    ],
  },
];

const todasKeys = grupos.flatMap((g) => g.itens.map((i) => i.key));
const todas = (v: boolean) => Object.fromEntries(todasKeys.map((k) => [k, v]));

const perfisIniciais: Perfil[] = [
  {
    id: "admin",
    nome: "Administrador",
    descricao: "Acesso total à plataforma",
    cor: "from-amber-500 to-orange-600",
    icon: Crown,
    membros: 2,
    permissoes: todas(true),
  },
  {
    id: "operador",
    nome: "Operador SICAF",
    descricao: "Renovação e gestão de níveis SICAF",
    cor: "from-emerald-500 to-teal-600",
    icon: Shield,
    membros: 5,
    permissoes: {
      ...todas(false),
      "clientes.view": true,
      "clientes.edit": true,
      "sicaf.view": true,
      "sicaf.renovar": true,
      "sicaf.docs": true,
      "sup.view": true,
    },
  },
  {
    id: "financeiro",
    nome: "Financeiro",
    descricao: "Cobranças, conciliações e cancelamentos",
    cor: "from-blue-500 to-indigo-600",
    icon: DollarSign,
    membros: 3,
    permissoes: {
      ...todas(false),
      "clientes.view": true,
      "fin.view": true,
      "fin.create": true,
      "fin.authorize": true,
      "fin.cancel": true,
    },
  },
  {
    id: "suporte",
    nome: "Suporte N1",
    descricao: "Atendimento e tickets",
    cor: "from-violet-500 to-purple-600",
    icon: Headphones,
    membros: 7,
    permissoes: {
      ...todas(false),
      "clientes.view": true,
      "sup.view": true,
      "sup.reply": true,
      "sup.close": true,
    },
  },
  {
    id: "docs",
    nome: "Documentação",
    descricao: "Upload e organização de documentos",
    cor: "from-rose-500 to-pink-600",
    icon: FileText,
    membros: 2,
    permissoes: {
      ...todas(false),
      "clientes.view": true,
      "sicaf.view": true,
      "sicaf.docs": true,
    },
  },
];

function PerfisPage() {
  const [perfis, setPerfis] = useState<Perfil[]>(perfisIniciais);
  const [selectedId, setSelectedId] = useState<string>(perfis[0].id);
  const [busca, setBusca] = useState("");

  const selected = perfis.find((p) => p.id === selectedId)!;
  const filtrados = perfis.filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase()));

  const togglePerm = (key: string, value: boolean) => {
    setPerfis((prev) =>
      prev.map((p) => (p.id === selectedId ? { ...p, permissoes: { ...p.permissoes, [key]: value } } : p))
    );
  };

  const toggleGrupo = (keys: string[], value: boolean) => {
    setPerfis((prev) =>
      prev.map((p) =>
        p.id === selectedId
          ? { ...p, permissoes: { ...p.permissoes, ...Object.fromEntries(keys.map((k) => [k, value])) } }
          : p
      )
    );
  };

  const novoPerfil = () => {
    const id = `perfil-${Date.now()}`;
    const novo: Perfil = {
      id,
      nome: "Novo Perfil",
      descricao: "Descreva este perfil",
      cor: "from-slate-500 to-slate-700",
      icon: Users,
      membros: 0,
      permissoes: todas(false),
    };
    setPerfis([...perfis, novo]);
    setSelectedId(id);
    toast.success("Novo perfil criado");
  };

  const removerPerfil = () => {
    if (perfis.length <= 1) {
      toast.error("Mantenha pelo menos um perfil");
      return;
    }
    setPerfis((prev) => prev.filter((p) => p.id !== selectedId));
    setSelectedId(perfis[0].id);
    toast.success("Perfil removido");
  };

  const salvar = () => toast.success(`Perfil "${selected.nome}" salvo`);

  const totalAtivas = Object.values(selected.permissoes).filter(Boolean).length;
  const totalPerms = todasKeys.length;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Gestão de Perfis</h1>
          <p className="text-sm text-muted-foreground">
            Defina o que cada perfil pode fazer dentro do CADBRASIL.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={novoPerfil}>
            <Plus className="h-3.5 w-3.5" /> Novo perfil
          </Button>
          <Button size="sm" className="gap-1.5" onClick={salvar}>
            <Save className="h-3.5 w-3.5" /> Salvar alterações
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        {/* Coluna esquerda - cards de perfis */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar perfil..."
              className="h-9 pl-8 text-sm"
            />
          </div>

          <ScrollArea className="h-[calc(100vh-260px)] pr-2">
            <div className="space-y-3">
              {filtrados.map((p) => {
                const Icon = p.icon;
                const active = p.id === selectedId;
                const ativas = Object.values(p.permissoes).filter(Boolean).length;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full text-left rounded-xl border bg-card p-4 transition hover:shadow-md ${
                      active ? "border-primary ring-2 ring-primary/20 shadow-md" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${p.cor} text-white shadow`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-semibold text-sm truncate">{p.nome}</h3>
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {p.membros} {p.membros === 1 ? "membro" : "membros"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.descricao}</p>
                        <div className="mt-2.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${p.cor}`}
                              style={{ width: `${(ativas / totalPerms) * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                            {ativas}/{totalPerms}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Coluna direita - permissões */}
        <Card className="p-0 overflow-hidden">
          <div className={`bg-gradient-to-r ${selected.cor} p-5 text-white`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                  <selected.icon className="h-6 w-6" />
                </div>
                <div>
                  <Input
                    value={selected.nome}
                    onChange={(e) =>
                      setPerfis((prev) =>
                        prev.map((p) => (p.id === selectedId ? { ...p, nome: e.target.value } : p))
                      )
                    }
                    className="border-0 bg-transparent text-lg font-bold text-white placeholder:text-white/60 h-auto p-0 focus-visible:ring-0"
                  />
                  <Input
                    value={selected.descricao}
                    onChange={(e) =>
                      setPerfis((prev) =>
                        prev.map((p) => (p.id === selectedId ? { ...p, descricao: e.target.value } : p))
                      )
                    }
                    className="border-0 bg-transparent text-xs text-white/80 placeholder:text-white/60 h-auto p-0 focus-visible:ring-0 mt-0.5"
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={removerPerfil}
                className="text-white/90 hover:bg-white/15 hover:text-white"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs">
              <div>
                <div className="text-white/70">Permissões ativas</div>
                <div className="text-base font-bold">
                  {totalAtivas}/{totalPerms}
                </div>
              </div>
              <Separator orientation="vertical" className="h-8 bg-white/20" />
              <div>
                <div className="text-white/70">Membros</div>
                <div className="text-base font-bold">{selected.membros}</div>
              </div>
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-360px)]">
            <div className="p-5 space-y-5">
              {grupos.map((g) => {
                const keys = g.itens.map((i) => i.key);
                const allOn = keys.every((k) => selected.permissoes[k]);
                const anyOn = keys.some((k) => selected.permissoes[k]);
                return (
                  <div key={g.titulo} className="rounded-lg border bg-card/50">
                    <div className="flex items-center justify-between border-b px-4 py-3">
                      <div>
                        <h4 className="text-sm font-semibold">{g.titulo}</h4>
                        <p className="text-xs text-muted-foreground">{g.descricao}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {keys.filter((k) => selected.permissoes[k]).length}/{keys.length}
                        </span>
                        <Switch
                          checked={allOn}
                          onCheckedChange={(v) => toggleGrupo(keys, v)}
                          aria-label={`Toggle todos ${g.titulo}`}
                          className={anyOn && !allOn ? "data-[state=unchecked]:bg-amber-500/40" : ""}
                        />
                      </div>
                    </div>
                    <div className="divide-y">
                      {g.itens.map((it) => (
                        <div key={it.key} className="flex items-center justify-between px-4 py-2.5">
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{it.label}</div>
                            <div className="text-[11px] text-muted-foreground">{it.hint}</div>
                          </div>
                          <Switch
                            checked={!!selected.permissoes[it.key]}
                            onCheckedChange={(v) => togglePerm(it.key, v)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
