import { useEffect, useState } from "react";
import { CalendarClock, Bell, Trash2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Agendamento = {
  id: string;
  empresa: string;
  cnpj: string;
  dataAlvo: string;
  criadoEm: string;
};

const STORAGE_KEY = "cadbrasil-agendamentos";

function load(): Agendamento[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    return JSON.parse(raw);
  } catch {
    return SEED;
  }
}

function save(items: Agendamento[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

const SEED: Agendamento[] = [
  {
    id: "a1",
    empresa: "Construtora Horizonte LTDA",
    cnpj: "12.345.678/0001-90",
    dataAlvo: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(),
    criadoEm: new Date().toISOString(),
  },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function diasAte(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function AgendamentosCard() {
  const [items, setItems] = useState<Agendamento[]>([]);

  useEffect(() => {
    setItems(load());
  }, []);

  const remover = (id: string) => {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    save(next);
    toast.success("Agendamento removido");
  };

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <CalendarClock className="h-4 w-4 text-primary" />
          Próximas revisões agendadas
        </CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Lembretes automáticos antes da próxima atualização do SICAF.
        </p>
      </CardHeader>
      <CardContent>
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
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remover(a.id)} aria-label="Remover">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

type Props = {
  empresa: string;
  cnpj: string;
  onCriado?: () => void;
};

const OPCOES: { meses: number; label: string }[] = [
  { meses: 3, label: "3 meses" },
  { meses: 6, label: "6 meses" },
  { meses: 12, label: "12 meses" },
];

export function AgendarRevisao({ empresa, cnpj, onCriado }: Props) {
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [salvo, setSalvo] = useState(false);

  const agendar = (meses: number) => {
    setSelecionado(meses);
    const data = new Date();
    data.setMonth(data.getMonth() + meses);
    const novo: Agendamento = {
      id: `${Date.now()}`,
      empresa,
      cnpj,
      dataAlvo: data.toISOString(),
      criadoEm: new Date().toISOString(),
    };
    const lista = [...load(), novo];
    save(lista);
    setSalvo(true);
    toast.success(`Revisão agendada para ${formatDate(novo.dataAlvo)}`);
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
            Avisamos por e-mail e WhatsApp para você não perder o prazo.
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
              onClick={() => agendar(o.meses)}
              className="gap-1.5"
            >
              {ativo && <Check className="h-3.5 w-3.5" />}
              {o.label}
            </Button>
          );
        })}
      </div>
      {salvo && (
        <p className="mt-2 text-xs text-success">✓ Agendamento criado. Você pode editar a qualquer momento.</p>
      )}
    </div>
  );
}
