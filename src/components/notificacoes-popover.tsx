import { useEffect, useState } from "react";
import { Bell, AlertTriangle, CheckCircle2, Info, Settings2, Mail, MessageCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Notificacao = {
  id: string;
  titulo: string;
  descricao: string;
  empresa?: string;
  tipo: "urgente" | "alerta" | "info" | "ok";
  quando: string;
  link?: string;
};

const NOTIFICACOES_BASE: Notificacao[] = [
  {
    id: "1",
    titulo: "Certidão Trabalhista vencida",
    descricao: "Serviços Modelo EIRELI — regularize para evitar bloqueio.",
    empresa: "Serviços Modelo EIRELI",
    tipo: "urgente",
    quando: "Há 3 dias",
    link: "/certidoes",
  },
  {
    id: "2",
    titulo: "Taxa CADBRASIL pendente",
    descricao: "Comércio Atlântico ME — pagamento aguardando confirmação.",
    empresa: "Comércio Atlântico ME",
    tipo: "urgente",
    quando: "Há 1 dia",
    link: "/empresas",
  },
  {
    id: "3",
    titulo: "SICAF expira em 12 dias",
    descricao: "Tech Solutions Brasil — agende a renovação.",
    empresa: "Tech Solutions Brasil",
    tipo: "alerta",
    quando: "18/12/2025",
    link: "/empresas",
  },
  {
    id: "4",
    titulo: "SICAF atualizado com sucesso",
    descricao: "Construtora Horizonte agora está 100% apta a licitar.",
    empresa: "Construtora Horizonte LTDA",
    tipo: "ok",
    quando: "Há 2h",
    link: "/sicaf",
  },
  {
    id: "5",
    titulo: "Nova oportunidade no PNCP",
    descricao: "3 editais compatíveis com seu portfólio.",
    tipo: "info",
    quando: "Hoje",
    link: "/licitacoes",
  },
];

const STORAGE_KEY = "cadbrasil-notif-lidas";

function iconFor(tipo: Notificacao["tipo"]) {
  if (tipo === "urgente") return <AlertTriangle className="h-4 w-4 text-destructive" />;
  if (tipo === "alerta") return <AlertTriangle className="h-4 w-4 text-warning-foreground" />;
  if (tipo === "ok") return <CheckCircle2 className="h-4 w-4 text-success" />;
  return <Info className="h-4 w-4 text-primary" />;
}

export function NotificacoesPopover() {
  const [lidas, setLidas] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLidas(new Set(JSON.parse(raw)));
    } catch {}
  }, []);

  const persist = (next: Set<string>) => {
    setLidas(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {}
  };

  const naoLidas = NOTIFICACOES_BASE.filter((n) => !lidas.has(n.id));
  const marcarTodas = () => persist(new Set(NOTIFICACOES_BASE.map((n) => n.id)));
  const marcarUma = (id: string) => {
    const next = new Set(lidas);
    next.add(id);
    persist(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Notificações">
          <Bell className="h-4 w-4" />
          {naoLidas.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {naoLidas.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notificações</p>
            <p className="text-xs text-muted-foreground">
              {naoLidas.length > 0 ? `${naoLidas.length} não lidas` : "Tudo em dia"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {naoLidas.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={marcarTodas}>
                Marcar todas
              </Button>
            )}
            <Button asChild variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <Link to="/notificacoes" aria-label="Preferências">
                <Settings2 className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        <ul className="max-h-[420px] overflow-y-auto">
          {NOTIFICACOES_BASE.map((n) => {
            const isLida = lidas.has(n.id);
            const content = (
              <div
                className={cn(
                  "flex gap-3 px-4 py-3 transition hover:bg-accent/40",
                  !isLida && "bg-primary/[0.04]",
                )}
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  {iconFor(n.tipo)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-sm leading-snug", !isLida && "font-semibold")}>{n.titulo}</p>
                    {!isLida && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.descricao}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{n.quando}</p>
                </div>
              </div>
            );
            return (
              <li key={n.id} className="border-b border-border last:border-b-0">
                {n.link ? (
                  <Link
                    to={n.link}
                    onClick={() => {
                      marcarUma(n.id);
                      setOpen(false);
                    }}
                    className="block"
                  >
                    {content}
                  </Link>
                ) : (
                  <button type="button" onClick={() => marcarUma(n.id)} className="block w-full text-left">
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Mail className="h-3 w-3" />
            <span>E-mail</span>
            <MessageCircle className="ml-2 h-3 w-3" />
            <span>WhatsApp</span>
          </div>
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
            <Link to="/notificacoes">Preferências</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
