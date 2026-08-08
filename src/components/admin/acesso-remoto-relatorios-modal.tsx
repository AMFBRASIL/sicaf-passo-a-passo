import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Clock3,
  Headphones,
  Loader2,
  MessageCircle,
  Monitor,
  MonitorUp,
  Search,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChatText } from "@/components/suporte-remoto/remote-support-chat";
import {
  fetchAcessoRemotoDetalhe,
  fetchAcessoRemotoRelatorios,
  type AcessoRemotoMensagemRelatorio,
  type AcessoRemotoSessaoRelatorio,
} from "@/lib/admin-relatorios-api";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AcessoRemotoRelatoriosModal({ open, onOpenChange }: Props) {
  const [periodo, setPeriodo] = useState("30d");
  const [stRemoto, setStRemoto] = useState("concluidos");
  const [comTela, setComTela] = useState("todos");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessoes, setSessoes] = useState<AcessoRemotoSessaoRelatorio[]>([]);
  const [detalheId, setDetalheId] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await fetchAcessoRemotoRelatorios({ periodo, stRemoto, comTela });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao carregar acessos remotos");
      return;
    }
    setSessoes(res.sessoes || []);
  }, [periodo, stRemoto, comTela]);

  useEffect(() => {
    if (!open) return;
    void carregar();
  }, [open, carregar]);

  useEffect(() => {
    if (!open) setDetalheId(null);
  }, [open]);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessoes;
    return sessoes.filter((s) =>
      [s.codigoFormatado, s.codigo, s.clienteNome, s.atendenteNome, s.statusLabel]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [sessoes, search]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100%-1.5rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
          <DialogTitle className="sr-only">Relatórios de acesso remoto</DialogTitle>
          <div className="border-b bg-gradient-to-br from-violet-500/10 via-background to-background px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-white">
                <MonitorUp className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Acessos remotos</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Atendimentos gravados no banco · tempo de tela, chat e encerramento.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="mes">Mês atual</SelectItem>
                  <SelectItem value="ano">Ano atual</SelectItem>
                </SelectContent>
              </Select>
              <Select value={stRemoto} onValueChange={setStRemoto}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="concluidos">Somente concluídos</SelectItem>
                  <SelectItem value="todos">Todos os acessos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={comTela} onValueChange={setComTela}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Tela: todos</SelectItem>
                  <SelectItem value="sim">Com tela compartilhada</SelectItem>
                  <SelectItem value="nao">Sem compartilhamento</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar código, cliente..."
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <ScrollArea className="max-h-[calc(92vh-210px)]">
            <div className="space-y-2 p-4 sm:p-6">
              {loading && (
                <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando atendimentos…
                </div>
              )}
              {!loading && filtradas.length === 0 && (
                <div className="rounded-2xl border border-dashed py-16 text-center text-sm text-muted-foreground">
                  Nenhum acesso remoto encontrado neste período.
                </div>
              )}
              {!loading &&
                filtradas.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-lg font-semibold">{s.codigoFormatado}</p>
                        <Badge variant={s.status === "ended" ? "secondary" : "outline"}>{s.statusLabel}</Badge>
                        {s.compartilhou ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600">Tela compartilhada</Badge>
                        ) : (
                          <Badge variant="outline">Sem tela</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {s.clienteNome} · {s.atendenteNome || "Sem atendente"} · {s.createdAtLabel || "—"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> Atendimento {s.tempoAtendimento}</span>
                        <span className="inline-flex items-center gap-1"><Monitor className="h-3.5 w-3.5" /> Tela {s.tempoTela}</span>
                        <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {s.mensagensCount} msg</span>
                      </div>
                    </div>
                    <Button onClick={() => setDetalheId(s.id)} className="shrink-0">
                      Detalhar
                    </Button>
                  </div>
                ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AcessoRemotoDetalheModal
        sessaoId={detalheId}
        open={detalheId != null}
        onOpenChange={(o) => !o && setDetalheId(null)}
      />
    </>
  );
}

function AcessoRemotoDetalheModal({
  sessaoId,
  open,
  onOpenChange,
}: {
  sessaoId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [sessao, setSessao] = useState<AcessoRemotoSessaoRelatorio | null>(null);

  useEffect(() => {
    if (!open || !sessaoId) {
      setSessao(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchAcessoRemotoDetalhe(sessaoId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok || !res.sessao) {
        toast.error(res.error || "Não foi possível abrir o atendimento.");
        return;
      }
      setSessao(res.sessao);
    });
    return () => {
      cancelled = true;
    };
  }, [open, sessaoId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94vh] w-[calc(100%-1rem)] max-w-7xl flex-col gap-0 overflow-hidden p-0 sm:max-w-7xl">
        <DialogTitle className="sr-only">Detalhe do acesso remoto</DialogTitle>
        <div className="border-b bg-slate-950 px-6 py-5 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Atendimento remoto</p>
              <h2 className="mt-1 font-mono text-3xl font-semibold tracking-[0.12em]">
                {sessao?.codigoFormatado || "—"}
              </h2>
              <p className="mt-2 text-sm text-white/70">
                {sessao?.clienteNome || "Cliente"} · {sessao?.atendenteNome || "Sem atendente"}
              </p>
            </div>
            {sessao && (
              <Badge className="bg-white/10 text-white hover:bg-white/10">{sessao.statusLabel}</Badge>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[calc(94vh-96px)]">
          {loading || !sessao ? (
            <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando detalhe…
            </div>
          ) : (
            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Kpi icon={<Clock3 className="h-4 w-4" />} label="Tempo de atendimento" value={sessao.tempoAtendimento} />
                  <Kpi icon={<Monitor className="h-4 w-4" />} label="Tempo de tela" value={sessao.tempoTela} />
                  <Kpi icon={<MessageCircle className="h-4 w-4" />} label="Mensagens" value={String(sessao.mensagensCount)} />
                </div>

                <div className="rounded-2xl border bg-card p-5">
                  <h3 className="text-sm font-semibold">Linha do tempo</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Info label="Iniciado em" value={sessao.createdAtLabel || "—"} />
                    <Info label="Atendente conectou" value={sessao.connectedAtLabel || "—"} />
                    <Info label="Compartilhou tela" value={sessao.sharingAtLabel || "—"} />
                    <Info label="Encerrado em" value={sessao.endedAtLabel || "—"} />
                  </div>
                </div>

                <div className="rounded-2xl border bg-card p-5">
                  <h3 className="text-sm font-semibold">Participantes e sessão</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Info icon={<User className="h-3.5 w-3.5" />} label="Cliente" value={sessao.clienteNome} />
                    <Info icon={<Headphones className="h-3.5 w-3.5" />} label="Atendente" value={sessao.atendenteNome || "—"} />
                    <Info label="Encerrado por" value={sessao.endedByLabel} />
                    <Info label="Resolução" value={sessao.resolucao || "—"} />
                    <Info label="WebRTC" value={sessao.webrtcState || "—"} />
                    <Info label="Status" value={sessao.statusLabel} />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">Conversa do chat</h3>
                    <p className="text-xs text-muted-foreground">Histórico completo gravado no banco</p>
                  </div>
                  <Badge variant="secondary">{sessao.mensagensCount}</Badge>
                </div>
                <div className="max-h-[58vh] space-y-3 overflow-y-auto pr-1">
                  {!sessao.mensagens?.length ? (
                    <p className="rounded-xl bg-white px-4 py-6 text-center text-sm text-muted-foreground">
                      Nenhuma mensagem neste atendimento.
                    </p>
                  ) : (
                    sessao.mensagens.map((m) => <ChatBubble key={m.id} mensagem={m} />)
                  )}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function ChatBubble({ mensagem }: { mensagem: AcessoRemotoMensagemRelatorio }) {
  const mine = mensagem.remetente === "atendente";
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[92%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          mine ? "bg-primary text-primary-foreground" : "bg-white text-slate-800",
        )}
      >
        <p className={cn("mb-0.5 text-[10px] font-medium uppercase tracking-wide", mine ? "opacity-80" : "text-slate-400")}>
          {mensagem.remetenteNome} · {mensagem.createdAtLabel}
        </p>
        <ChatText text={mensagem.texto} mine={mine} />
      </div>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Info({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
