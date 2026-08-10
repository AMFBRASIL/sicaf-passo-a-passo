import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { RemoteSupportMensagem, RemoteSupportRole } from "@/lib/suporte-remoto-api";

const URL_RE = /((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]])/gi;

function normalizeHref(raw: string) {
  const href = raw.startsWith("www.") ? `https://${raw}` : raw;
  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

export function ChatText({ text, mine }: { text: string; mine: boolean }) {
  const parts = text.split(URL_RE);
  return (
    <p className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (!part) return null;
        const href = normalizeHref(part);
        if (!href) return <span key={i}>{part}</span>;
        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "break-all underline underline-offset-2",
              mine ? "text-white decoration-white/70 hover:decoration-white" : "text-primary hover:text-primary/80",
            )}
          >
            {part}
          </a>
        );
      })}
    </p>
  );
}

export type RemoteSupportQuickReply = string | { label: string; text: string };

type Props = {
  title?: string;
  subtitle?: string;
  badge?: ReactNode;
  mensagens: RemoteSupportMensagem[];
  selfRole: RemoteSupportRole;
  placeholder?: string;
  quickReplies?: RemoteSupportQuickReply[];
  disabled?: boolean;
  onSend: (texto: string) => Promise<unknown> | unknown;
};

function quickReplyLabel(q: RemoteSupportQuickReply) {
  return typeof q === "string" ? q : q.label;
}

function quickReplyText(q: RemoteSupportQuickReply) {
  return typeof q === "string" ? q : q.text;
}

export function RemoteSupportChat({
  title = "Chat",
  subtitle = "Conversa em tempo real",
  badge,
  mensagens,
  selfRole,
  placeholder = "Digite uma mensagem...",
  quickReplies,
  disabled,
  onSend,
}: Props) {
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens.length]);

  const enviar = async (value: string) => {
    const msg = value.trim();
    if (!msg || sending || disabled) return;
    setSending(true);
    try {
      const res = (await onSend(msg)) as { ok?: boolean; error?: string } | void;
      if (res && res.ok === false) {
        toast.error(res.error || "Não foi possível enviar a mensagem.");
        return;
      }
      setTexto("");
    } catch {
      toast.error("Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void enviar(texto);
  };

  return (
    <aside className="flex h-full min-h-0 w-full flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        {badge}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50/60 p-4">
        {mensagens.length === 0 ? (
          <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-slate-600">
            Nenhuma mensagem ainda. Diga olá para começar.
          </div>
        ) : (
          mensagens.map((m) => {
            const mine = m.remetente === selfRole;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[90%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                    mine ? "bg-primary text-primary-foreground" : "bg-white text-slate-800",
                  )}
                >
                  <p className={cn("mb-0.5 text-[10px] font-medium uppercase tracking-wide", mine ? "opacity-80" : "text-slate-400")}>
                    {mine ? "Você" : m.remetenteNome}
                  </p>
                  <ChatText text={m.texto} mine={mine} />
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {quickReplies && quickReplies.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-3 py-2">
          {quickReplies.map((q) => {
            const label = quickReplyLabel(q);
            const text = quickReplyText(q);
            return (
              <button
                key={`${label}:${text}`}
                type="button"
                disabled={disabled || sending}
                onClick={() => void enviar(text)}
                title={text !== label ? text : undefined}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:border-primary/40 hover:text-primary disabled:opacity-50"
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-slate-100 p-3">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || sending}
          className="h-10 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary/40 focus:bg-white"
        />
        <button
          type="submit"
          disabled={disabled || sending || !texto.trim()}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
          aria-label="Enviar"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </aside>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "ok" | "wait" | "idle" | "danger";
  children: ReactNode;
}) {
  const map = {
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
    wait: "bg-amber-50 text-amber-800 border-amber-200",
    idle: "bg-slate-100 text-slate-600 border-slate-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
  };
  const dot = {
    ok: "bg-emerald-500",
    wait: "bg-amber-500",
    idle: "bg-slate-400",
    danger: "bg-rose-500",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", map[tone])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dot[tone], tone === "wait" && "animate-pulse")} />
      {children}
    </span>
  );
}
