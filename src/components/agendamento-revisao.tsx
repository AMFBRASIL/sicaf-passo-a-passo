import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Bell, Trash2, Check, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  criarRevisaoAgendada,
  fetchRevisoesAgendadas,
  removerRevisaoAgendada,
  type RevisaoAgendada,
} from "@/lib/revisoes-agendadas-api";

const LEGACY_STORAGE_KEY = "cadbrasil-agendamentos";

function parseDataAlvo(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function formatDate(iso: string) {
  return parseDataAlvo(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function diasAte(iso: string) {
  const alvo = parseDataAlvo(iso);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diff = alvo.getTime() - hoje.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function subtituloItem(item: RevisaoAgendada) {
  if (item.origem === "sicaf") {
    const st = item.statusSicaf?.toLowerCase();
    if (st === "vencendo") return "Vencimento do SICAF";
    return "Renovação do cadastro SICAF";
  }
  if (item.mesesLembrete) return `Lembrete em ${item.mesesLembrete} meses`;
  return "Revisão agendada";
}

export function AgendamentosCard() {
  const [items, setItems] = useState<RevisaoAgendada[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetchRevisoesAgendadas();
      if (!res.ok) {
        setItems([]);
        setErro(res.error || "Não foi possível carregar as revisões");
        return;
      }
      setItems(res.agendamentos || []);
    } catch {
      setItems([]);
      setErro("Falha na conexão com o servidor");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* ignore — remove mock antigo do navegador */
    }
    void carregar();
  }, [carregar]);

  const remover = async (item: RevisaoAgendada) => {
    if (!item.removivel) return;
    const res = await removerRevisaoAgendada(item.id);
    if (!res.ok) {
      toast.error(res.error || "Não foi possível remover");
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    toast.success("Agendamento removido");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando revisões…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <CalendarClock className="h-4 w-4 text-primary" />
          Próximas revisões agendadas
        </CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Lembretes salvos e SICAF vencendo nos próximos 90 dias — dados do seu cadastro.
        </p>
      </CardHeader>
      <CardContent>
        {erro ? (
          <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
            {erro}
          </p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma revisão agendada no momento. Quando o SICAF de uma empresa estiver vencendo
            ou você criar um lembrete, ele aparecerá aqui.
          </p>
        ) : (
        <ul className="space-y-2">
          {items.map((a) => {
            const dias = diasAte(a.dataAlvo);
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Bell className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{a.empresa}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(a.dataAlvo)} · em {dias} dia{dias !== 1 ? "s" : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground/80">{subtituloItem(a)}</p>
                </div>
                {a.removivel ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => void remover(a)}
                    aria-label="Remover agendamento"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
        )}
      </CardContent>
    </Card>
  );
}

type Props = {
  empresa: string;
  cnpj: string;
  clienteId: number;
  onCriado?: () => void;
};

const OPCOES: { meses: number; label: string }[] = [
  { meses: 3, label: "3 meses" },
  { meses: 6, label: "6 meses" },
  { meses: 12, label: "12 meses" },
];

export function AgendarRevisao({ empresa, cnpj, clienteId, onCriado }: Props) {
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const agendar = async (meses: number) => {
    setSelecionado(meses);
    setSalvando(true);
    const res = await criarRevisaoAgendada(clienteId, meses);
    setSalvando(false);
    if (!res.ok || !res.agendamento) {
      toast.error(res.error || "Não foi possível agendar");
      setSelecionado(null);
      return;
    }
    setSalvo(true);
    toast.success(`Revisão agendada para ${formatDate(res.agendamento.dataAlvo)}`);
    onCriado?.();
  };

  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Quer ser lembrado da próxima revisão?</p>
          <p className="text-xs text-muted-foreground">
            {empresa} · CNPJ {cnpj}. Avisamos por e-mail e WhatsApp para você não perder o prazo.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {OPCOES.map((o) => {
          const ativo = selecionado === o.meses;
          return (
            <Button
              key={o.meses}
              variant={ativo ? "default" : "outline"}
              size="sm"
              disabled={salvando}
              onClick={() => void agendar(o.meses)}
              className="gap-1.5"
            >
              {salvando && ativo ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : ativo && salvo ? (
                <Check className="h-3.5 w-3.5" />
              ) : null}
              {o.label}
            </Button>
          );
        })}
      </div>
      {salvo && (
        <p className="mt-2 text-xs text-success">✓ Agendamento salvo no seu cadastro.</p>
      )}
    </div>
  );
}
