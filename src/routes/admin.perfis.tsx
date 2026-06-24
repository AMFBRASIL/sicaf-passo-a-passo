import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  createPerfilAcesso,
  deletePerfilAcesso,
  fetchPerfilPermissoes,
  fetchPerfisAcesso,
  savePerfilPermissoes,
  updatePerfilAcesso,
  type PerfilAcesso,
  type PermissaoPagina,
} from "@/lib/admin-perfis-api";

export const Route = createFileRoute("/admin/perfis")({
  component: PerfisPage,
});

const tipoIcon: Record<string, typeof Shield> = {
  admin: Crown,
  gestor: Shield,
  colaborador: Shield,
  analista: FileText,
  visualizador: Users,
  cliente: Users,
};

function iconForPerfil(p: PerfilAcesso) {
  return tipoIcon[p.tipo] || Headphones;
}

function PerfisPage() {
  const [perfis, setPerfis] = useState<PerfilAcesso[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);

  const [nomeEdit, setNomeEdit] = useState("");
  const [descricaoEdit, setDescricaoEdit] = useState("");
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [pages, setPages] = useState<PermissaoPagina[]>([]);
  const [orderedCategories, setOrderedCategories] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  const selected = perfis.find((p) => p.id === selectedId) ?? null;
  const isAdmin = selected?.tipo === "admin";

  const carregarPerfis = useCallback(async (keepSelection = true) => {
    setLoading(true);
    const res = await fetchPerfisAcesso();
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao carregar perfis");
      return;
    }
    const lista = res.perfis || [];
    setPerfis(lista);
    if (!lista.length) {
      setSelectedId(null);
      return;
    }
    if (keepSelection && selectedId != null && lista.some((p) => p.id === selectedId)) {
      return;
    }
    setSelectedId(lista[0].id);
  }, [selectedId]);

  const carregarPermissoes = useCallback(async (perfilId: number) => {
    setLoadingPerms(true);
    const res = await fetchPerfilPermissoes(perfilId);
    setLoadingPerms(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao carregar permissões");
      return;
    }
    setPermissions(res.permissions || {});
    setPages(res.pages || []);
    setOrderedCategories(res.orderedCategories || []);
    setDirty(false);
  }, []);

  useEffect(() => {
    void carregarPerfis(false);
  }, []);

  useEffect(() => {
    if (!selected) return;
    setNomeEdit(selected.nome);
    setDescricaoEdit(selected.descricao || "");
    void carregarPermissoes(selected.id);
  }, [selected?.id, carregarPermissoes]);

  const filtrados = perfis.filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase()));

  const grupos = useMemo(() => {
    const byCat: Record<string, PermissaoPagina[]> = {};
    for (const page of pages) {
      if (!byCat[page.categoria]) byCat[page.categoria] = [];
      byCat[page.categoria].push(page);
    }
    const cats = orderedCategories.length ? orderedCategories : Object.keys(byCat);
    return cats
      .filter((c) => byCat[c]?.length)
      .map((categoria) => ({
        titulo: categoria,
        descricao: `${byCat[categoria].length} permissão(ões)`,
        itens: byCat[categoria].map((p) => ({
          key: p.paginaId,
          label: p.paginaNome,
          hint: p.paginaId,
        })),
      }));
  }, [pages, orderedCategories]);

  const selecionarPerfil = (id: number) => {
    if (id === selectedId) return;
    if (dirty) {
      const ok = window.confirm("Há alterações não salvas. Descartar e trocar de perfil?");
      if (!ok) return;
      setDirty(false);
    }
    setSelectedId(id);
  };

  const totalPerms = pages.length || selected?.permTotal || 1;
  const totalAtivas = isAdmin
    ? totalPerms
    : Object.values(permissions).filter(Boolean).length;

  const togglePerm = (key: string, value: boolean) => {
    if (isAdmin) return;
    setPermissions((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const toggleGrupo = (keys: string[], value: boolean) => {
    if (isAdmin) return;
    setPermissions((prev) => ({
      ...prev,
      ...Object.fromEntries(keys.map((k) => [k, value])),
    }));
    setDirty(true);
  };

  const novoPerfil = async () => {
    const res = await createPerfilAcesso({
      nome: `Novo Perfil ${perfis.length + 1}`,
      descricao: "Descreva este perfil",
      tipo: "visualizador",
    });
    if (!res.ok) {
      toast.error(res.error || "Erro ao criar perfil");
      return;
    }
    toast.success(res.message || "Perfil criado");
    await carregarPerfis(false);
    if (res.id) setSelectedId(res.id);
  };

  const removerPerfil = async () => {
    if (!selected) return;
    if (!window.confirm(`Desativar o perfil "${selected.nome}"? Usuários vinculados impedem a exclusão.`)) {
      return;
    }
    const res = await deletePerfilAcesso(selected.id);
    if (!res.ok) {
      toast.error(res.error || "Erro ao remover perfil");
      return;
    }
    toast.success(res.message || "Perfil removido");
    await carregarPerfis(false);
  };

  const salvar = async () => {
    if (!selected) return;
    setSaving(true);

    const metaChanged =
      nomeEdit.trim() !== selected.nome || descricaoEdit.trim() !== (selected.descricao || "");

    if (metaChanged) {
      const metaRes = await updatePerfilAcesso(selected.id, {
        nome: nomeEdit.trim(),
        descricao: descricaoEdit.trim(),
      });
      if (!metaRes.ok) {
        setSaving(false);
        toast.error(metaRes.error || "Erro ao salvar dados do perfil");
        return;
      }
    }

    if (dirty && !isAdmin) {
      const permRes = await savePerfilPermissoes(selected.id, permissions);
      if (!permRes.ok) {
        setSaving(false);
        toast.error(permRes.error || "Erro ao salvar permissões");
        return;
      }
      toast.success(permRes.message || "Permissões salvas");
      setDirty(false);
    } else if (metaChanged) {
      toast.success("Perfil atualizado");
    } else {
      toast.info("Nenhuma alteração para salvar");
    }

    setSaving(false);
    await carregarPerfis(true);
    if (selected.id) await carregarPermissoes(selected.id);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!perfis.length) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Nenhum perfil cadastrado no banco.</p>
        <Button onClick={() => void novoPerfil()} className="gap-1.5">
          <Plus className="h-4 w-4" /> Criar primeiro perfil
        </Button>
      </div>
    );
  }

  if (!selected) return null;

  const SelectedIcon = iconForPerfil(selected);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Gestão de Perfis</h1>
          <p className="text-sm text-muted-foreground">
            Perfis e permissões do banco — painel admin e portal cliente.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={loading}
            onClick={() => void carregarPerfis(true)}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void novoPerfil()}>
            <Plus className="h-3.5 w-3.5" /> Novo perfil
          </Button>
          <Button size="sm" className="gap-1.5" disabled={saving} onClick={() => void salvar()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar alterações
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
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
                const Icon = iconForPerfil(p);
                const active = p.id === selectedId;
                const cardTotal = p.permTotal ?? totalPerms;
                const cardAtivas = p.tipo === "admin" ? cardTotal : p.permAtivas ?? 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selecionarPerfil(p.id)}
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
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {p.descricao || p.tipo}
                        </p>
                        {cardTotal > 0 && (
                          <div className="mt-2.5 flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r ${p.cor}`}
                                style={{ width: `${(cardAtivas / cardTotal) * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                              {cardAtivas}/{cardTotal}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className={`bg-gradient-to-r ${selected.cor} p-5 text-white`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur shrink-0">
                  <SelectedIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <Input
                    value={nomeEdit}
                    onChange={(e) => {
                      setNomeEdit(e.target.value);
                      setDirty(true);
                    }}
                    disabled={isAdmin}
                    className="border-0 bg-transparent text-lg font-bold text-white placeholder:text-white/60 h-auto p-0 focus-visible:ring-0"
                  />
                  <Input
                    value={descricaoEdit}
                    onChange={(e) => {
                      setDescricaoEdit(e.target.value);
                      setDirty(true);
                    }}
                    disabled={isAdmin}
                    className="border-0 bg-transparent text-xs text-white/80 placeholder:text-white/60 h-auto p-0 focus-visible:ring-0 mt-0.5"
                  />
                  <Badge className="mt-2 bg-white/20 text-white border-0 text-[10px]">{selected.tipo}</Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void removerPerfil()}
                disabled={isAdmin}
                className="text-white/90 hover:bg-white/15 hover:text-white shrink-0"
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
            {isAdmin && (
              <p className="mt-3 text-xs text-white/80">
                Perfil Administrador possui acesso total — permissões não podem ser alteradas.
              </p>
            )}
          </div>

          <ScrollArea className="h-[calc(100vh-360px)]">
            <div className="p-5 space-y-5">
              {loadingPerms ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" /> Carregando permissões...
                </div>
              ) : grupos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Nenhuma permissão cadastrada em <code>permissoes_pagina</code>.
                </p>
              ) : (
                grupos.map((g) => {
                  const keys = g.itens.map((i) => i.key);
                  const allOn = keys.every((k) => permissions[k]);
                  const anyOn = keys.some((k) => permissions[k]);
                  return (
                    <div key={g.titulo} className="rounded-lg border bg-card/50">
                      <div className="flex items-center justify-between border-b px-4 py-3">
                        <div>
                          <h4 className="text-sm font-semibold">{g.titulo}</h4>
                          <p className="text-xs text-muted-foreground">{g.descricao}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground">
                            {keys.filter((k) => permissions[k]).length}/{keys.length}
                          </span>
                          <Switch
                            checked={allOn}
                            disabled={isAdmin}
                            onCheckedChange={(v) => toggleGrupo(keys, v)}
                            className={anyOn && !allOn ? "data-[state=unchecked]:bg-amber-500/40" : ""}
                          />
                        </div>
                      </div>
                      <div className="divide-y">
                        {g.itens.map((it) => (
                          <div key={it.key} className="flex items-center justify-between px-4 py-2.5">
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{it.label}</div>
                              <div className="text-[11px] text-muted-foreground font-mono">{it.hint}</div>
                            </div>
                            <Switch
                              checked={!!permissions[it.key]}
                              disabled={isAdmin}
                              onCheckedChange={(v) => togglePerm(it.key, v)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
