import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { Bot, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY_ASSISTENTE = "cadbrasil-assistente-tour-ignorar";
const STORAGE_KEY_SICAF = "cadbrasil-sicaf-tour-ignorar";

function readFlag(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}

export function hasIgnoredAssistenteTour(): boolean {
  return readFlag(STORAGE_KEY_ASSISTENTE);
}

export function markAssistenteTourIgnored(): void {
  writeFlag(STORAGE_KEY_ASSISTENTE);
}

export function hasIgnoredSicafTour(): boolean {
  return readFlag(STORAGE_KEY_SICAF);
}

export function markSicafTourIgnored(): void {
  writeFlag(STORAGE_KEY_SICAF);
}

type Props = {
  open: boolean;
  targetRef: RefObject<HTMLElement | null>;
  title?: string;
  description?: ReactNode;
  onDismiss: () => void;
  onIgnore: () => void;
};

export function AssistenteAcessarSicafTour({
  open,
  targetRef,
  title = "Clique em Acessar SICAF",
  description,
  onDismiss,
  onIgnore,
}: Props) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    const update = () => {
      const el = targetRef.current;
      if (!el) return;
      setRect(el.getBoundingClientRect());
    };
    update();
    const timer = window.setTimeout(update, 80);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, targetRef]);

  if (!open || !rect) return null;

  const spaceBelow = window.innerHeight - rect.bottom;
  const showBelow = spaceBelow > 230;
  const tooltipTop = showBelow ? rect.bottom + 16 : Math.max(12, rect.top - 216);
  const tooltipLeft = Math.min(
    Math.max(12, rect.left + rect.width / 2 - 180),
    window.innerWidth - 372,
  );

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="assistente-tour-title">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-slate-950/55"
        aria-label="Fechar dica"
        onClick={onDismiss}
      />

      <div
        className="absolute z-[81] w-[min(360px,calc(100vw-24px))] rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl"
        style={{ top: tooltipTop, left: tooltipLeft }}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Bot className="h-4 w-4" />
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={onDismiss}
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p id="assistente-tour-title" className="text-sm font-semibold text-slate-900">
          {title}
        </p>
        <div className="mt-1 text-sm leading-relaxed text-slate-600">
          {description ?? (
            <p>
              Para entrar no Compras.gov.br e validar os documentos, clique no botão verde{" "}
              <span className="font-semibold text-emerald-700">Acessar SICAF</span>. O Assistente abre o
              portal e você conclui a validação por lá.
            </p>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" className="text-slate-500" onClick={onIgnore}>
            Ignorar ajuda
          </Button>
          <Button type="button" size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={onDismiss}>
            Entendi
          </Button>
        </div>
      </div>
    </div>
  );
}
