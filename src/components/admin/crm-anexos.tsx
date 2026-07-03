import { useRef } from "react";
import {
  Paperclip,
  Receipt,
  MessageSquare,
  FileText,
  Trash2,
  Upload,
  ImageIcon,
  FileIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CrmAnexoTipo = "comprovante" | "conversa" | "outro";

export interface CrmAnexo {
  id: string;
  nome: string;
  tipo: CrmAnexoTipo;
  mime: string;
  tamanho: number;
  url: string; // data URL (mock local)
  descricao?: string;
  criadoEm: string;
}

export const TIPO_ANEXO_META: Record<
  CrmAnexoTipo,
  { label: string; cor: string; icon: React.ComponentType<{ className?: string }> }
> = {
  comprovante: {
    label: "Comprovante de pagamento",
    cor: "from-emerald-500 to-teal-600",
    icon: Receipt,
  },
  conversa: {
    label: "Print da conversa",
    cor: "from-sky-500 to-blue-600",
    icon: MessageSquare,
  },
  outro: {
    label: "Outro documento",
    cor: "from-slate-500 to-slate-700",
    icon: FileText,
  },
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface UploaderProps {
  anexos: CrmAnexo[];
  onChange: (next: CrmAnexo[]) => void;
  tipoPadrao?: CrmAnexoTipo;
  compact?: boolean;
}

export function CrmAnexosUploader({
  anexos,
  onChange,
  tipoPadrao = "comprovante",
  compact,
}: UploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null, tipo: CrmAnexoTipo) {
    if (!files || !files.length) return;
    const novos: CrmAnexo[] = [];
    for (const f of Array.from(files)) {
      const url = await fileToDataUrl(f);
      novos.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        nome: f.name,
        tipo,
        mime: f.type || "application/octet-stream",
        tamanho: f.size,
        url,
        criadoEm: new Date().toLocaleDateString("pt-BR"),
      });
    }
    onChange([...anexos, ...novos]);
  }

  function remover(id: string) {
    onChange(anexos.filter((a) => a.id !== id));
  }

  function alterarTipo(id: string, tipo: CrmAnexoTipo) {
    onChange(anexos.map((a) => (a.id === id ? { ...a, tipo } : a)));
  }

  return (
    <div className="space-y-3">
      <div className={cn("grid gap-2", compact ? "sm:grid-cols-3" : "sm:grid-cols-3")}>
        {(Object.keys(TIPO_ANEXO_META) as CrmAnexoTipo[]).map((t) => {
          const meta = TIPO_ANEXO_META[t];
          const Icon = meta.icon;
          return (
            <label
              key={t}
              className={cn(
                "group flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-muted/30 p-3 text-center transition hover:border-primary hover:bg-primary/5",
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
                  meta.cor,
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-[11px] font-bold leading-tight">{meta.label}</p>
              <p className="text-[10px] text-muted-foreground">Clique para enviar</p>
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files, t);
                  e.target.value = "";
                }}
              />
            </label>
          );
        })}
      </div>

      {/* Fallback botão genérico */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5" />
          {anexos.length} arquivo{anexos.length === 1 ? "" : "s"} anexado{anexos.length === 1 ? "" : "s"}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 font-semibold text-foreground hover:bg-muted"
        >
          <Upload className="h-3 w-3" /> Enviar outro
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files, tipoPadrao);
            e.target.value = "";
          }}
        />
      </div>

      {anexos.length > 0 && (
        <ul className="space-y-2">
          {anexos.map((a) => {
            const meta = TIPO_ANEXO_META[a.tipo];
            const isImg = a.mime.startsWith("image/");
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                  {isImg ? (
                    <img src={a.url} alt={a.nome} className="h-full w-full object-cover" />
                  ) : (
                    <FileIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">{a.nome}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatSize(a.tamanho)} · {a.criadoEm}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(Object.keys(TIPO_ANEXO_META) as CrmAnexoTipo[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => alterarTipo(a.id, t)}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold transition",
                          a.tipo === t
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-muted",
                        )}
                      >
                        {TIPO_ANEXO_META[t].label.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remover(a.id)}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Remover anexo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function CrmAnexosLista({ anexos }: { anexos: CrmAnexo[] }) {
  if (!anexos.length) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-6 text-center">
        <ImageIcon className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-xs text-muted-foreground">
          Nenhum comprovante ou print anexado ainda.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {anexos.map((a) => {
        const meta = TIPO_ANEXO_META[a.tipo];
        const Icon = meta.icon;
        const isImg = a.mime.startsWith("image/");
        return (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="group overflow-hidden rounded-xl border border-border bg-card transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <div className="relative aspect-video w-full bg-muted">
              {isImg ? (
                <img src={a.url} alt={a.nome} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <FileIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div
                className={cn(
                  "absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-br px-2 py-0.5 text-[10px] font-bold text-white shadow",
                  meta.cor,
                )}
              >
                <Icon className="h-3 w-3" /> {meta.label}
              </div>
            </div>
            <div className="p-2.5">
              <p className="truncate text-xs font-bold">{a.nome}</p>
              <p className="text-[10px] text-muted-foreground">
                {formatSize(a.tamanho)} · {a.criadoEm}
              </p>
            </div>
          </a>
        );
      })}
    </div>
  );
}