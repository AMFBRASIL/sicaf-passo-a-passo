import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, Plus, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { MembroEquipeModal, type MembroEdit } from "@/components/admin/membro-equipe-modal";
import { toast } from "sonner";
import {
  createMembroEquipe,
  fetchEquipe,
  updateMembroEquipe,
  type MembroEquipe,
  type PerfilEquipeOpcao,
} from "@/lib/admin-equipe-api";
import { fetchPerfisAcesso } from "@/lib/admin-perfis-api";

export const Route = createFileRoute("/admin/equipe")({
  component: EquipePage,
});

const perfilCores: Record<string, string> = {
  admin: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  gestor: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  colaborador: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  analista: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
  visualizador: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
};

function toMembroEdit(m: MembroEquipe): MembroEdit {
  return {
    id: m.id,
    nome: m.nome,
    cargo: m.cargo,
    perfil: m.perfil,
    perfilId: m.perfilId,
    perfilTipo: m.perfilTipo,
    email: m.email,
    telefone: m.telefone,
    ativo: m.ativo,
    tickets: m.tickets,
    media: m.media,
    sla: m.sla,
    clientes: m.clientes,
    avaliacao: m.avaliacao,
  };
}

function EquipePage() {
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [perfis, setPerfis] = useState<PerfilEquipeOpcao[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<MembroEdit | null>(null);
  const [isNew, setIsNew] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const [equipeRes, perfisRes] = await Promise.all([fetchEquipe(), fetchPerfisAcesso()]);
    setLoading(false);

    const perfisDb: PerfilEquipeOpcao[] =
      perfisRes.ok && perfisRes.perfis?.length
        ? perfisRes.perfis
            .filter((p) => p.ativo && p.tipo !== "cliente")
            .map((p) => ({
              id: p.id,
              nome: p.nome,
              descricao: p.descricao,
              tipo: p.tipo,
              cor: p.cor,
            }))
        : (equipeRes.perfis || []);

    setPerfis(perfisDb);

    if (!equipeRes.ok) {
      toast.error(equipeRes.error || "Erro ao carregar equipe");
    } else {
      setEquipe(equipeRes.membros || []);
    }

    if (!perfisRes.ok && !perfisDb.length) {
      toast.error(perfisRes.error || "Erro ao carregar perfis de acesso");
    } else if (!perfisDb.length) {
      toast.warning("Nenhum perfil de equipe em perfis_acesso (exceto Cliente). Cadastre em Gestão de Perfis.");
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abrir = (m: MembroEquipe) => {
    setSelected(toMembroEdit(m));
    setIsNew(false);
    setOpen(true);
  };

  const salvar = async (atualizado: MembroEdit) => {
    const nome = atualizado.nome?.trim();
    const email = atualizado.email?.trim().toLowerCase();

    if (!nome) {
      toast.error("Informe o nome do colaborador");
      return;
    }
    if (!email || !email.includes("@")) {
      toast.error("Informe um e-mail válido");
      return;
    }

    const perfilId =
      atualizado.perfilId ?? perfis.find((p) => p.nome === atualizado.perfil)?.id;

    if (!perfilId) {
      toast.error("Selecione um perfil de acesso");
      return;
    }

    setSaving(true);

    if (isNew || !atualizado.id) {
      const res = await createMembroEquipe({
        nome,
        email,
        telefone: atualizado.telefone?.trim(),
        cargo: atualizado.cargo?.trim(),
        perfilId,
        senha: atualizado.senha,
        ativo: atualizado.ativo !== false,
      });

      setSaving(false);
      if (!res.ok) {
        toast.error(res.error || "Erro ao criar colaborador");
        return;
      }

      if (res.senhaTemporaria) {
        toast.success(`Colaborador criado. Senha temporária: ${res.senhaTemporaria}`);
      } else {
        toast.success(res.message || "Colaborador criado");
      }
    } else {
      const res = await updateMembroEquipe(atualizado.id, {
        nome,
        email,
        telefone: atualizado.telefone?.trim(),
        cargo: atualizado.cargo?.trim(),
        perfilId,
        ativo: atualizado.ativo !== false,
        senha: atualizado.senha,
      });

      setSaving(false);
      if (!res.ok) {
        toast.error(res.error || "Erro ao salvar colaborador");
        return;
      }
      toast.success(res.message || "Colaborador atualizado");
    }

    setOpen(false);
    await carregar();
  };

  const novoColaborador = () => {
    if (!perfis.length) {
      toast.error("Cadastre perfis de equipe em Gestão de Perfis antes de adicionar colaboradores.");
      return;
    }

    const perfilPadrao = perfis.find((p) => p.tipo === "analista") ?? perfis[0];
    setSelected({
      nome: "",
      cargo: "",
      perfil: perfilPadrao.nome,
      perfilId: perfilPadrao.id,
      perfilTipo: perfilPadrao.tipo,
      email: "",
      telefone: "",
      senha: "",
      ativo: true,
      tickets: 0,
      media: "—",
      sla: 0,
      clientes: 0,
      avaliacao: 0,
    });
    setIsNew(true);
    setOpen(true);
  };

  const ranked = [...equipe].sort((a, b) => b.tickets - a.tickets);
  const ativos = equipe.filter((m) => m.ativo).length;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Gestão de Equipe</h1>
          <p className="text-sm text-muted-foreground">
            {ativos} de {equipe.length} colaboradores ativos · {perfis.length} perfil(is) disponível(is) ·
            métricas de tickets (30 dias).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void carregar()}>
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
          <Button size="sm" className="gap-1.5" onClick={novoColaborador} disabled={!perfis.length}>
            <Plus className="h-3.5 w-3.5" /> Adicionar colaborador
          </Button>
        </div>
      </div>

      {equipe.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <p>Nenhum colaborador interno cadastrado.</p>
          <p className="text-xs mt-2">
            Colaboradores são usuários com perfil diferente de <strong>Cliente</strong> em{" "}
            <code>perfis_acesso</code>.
          </p>
          <Button className="mt-4 gap-1.5" size="sm" onClick={novoColaborador} disabled={!perfis.length}>
            <Plus className="h-3.5 w-3.5" /> Adicionar primeiro colaborador
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {ranked.map((m, i) => (
            <Card
              key={m.id}
              onClick={() => abrir(m)}
              className={`group p-5 cursor-pointer transition hover:shadow-lg hover:border-primary/50 ${
                !m.ativo ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12 border border-border">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {m.avatarIniciais ||
                      m.nome
                        .split(" ")
                        .map((s) => s[0])
                        .slice(0, 2)
                        .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold">{m.nome}</p>
                    {i === 0 && m.tickets > 0 && (
                      <Badge className="gap-0.5 bg-amber-500 text-[10px] text-white">
                        <Star className="h-2.5 w-2.5" /> Top
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{m.cargo}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{m.email}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${perfilCores[m.perfilTipo] || "border-muted"}`}
                    >
                      {m.perfil}
                    </Badge>
                    {m.avaliacao > 0 && (
                      <div className="flex items-center gap-0.5 text-xs">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span className="font-medium">{m.avaliacao.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Cell label="Tickets" value={m.tickets.toString()} />
                <Cell label="Tempo médio" value={m.media} />
                <Cell
                  label="SLA"
                  value={m.tickets > 0 ? `${m.sla}%` : "—"}
                  tone={m.sla >= 95 ? "emerald" : m.sla >= 85 ? "amber" : m.tickets > 0 ? "rose" : "default"}
                />
              </div>
              <div className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                Clientes atendidos: <span className="font-semibold text-foreground">{m.clientes}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <MembroEquipeModal
        open={open}
        onOpenChange={setOpen}
        membro={selected}
        isNew={isNew}
        saving={saving}
        perfisOpcoes={perfis}
        onSave={(m) => void salvar(m)}
      />
    </div>
  );
}

function Cell({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "emerald" | "amber" | "rose";
}) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
  };
  return (
    <div className="rounded-md bg-muted/40 p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm font-bold ${tones[tone]}`}>{value}</p>
    </div>
  );
}
