import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

export type NivelStatus =
  | "validado"
  | "vencendo"
  | "vencido"
  | "pendente"
  | "nao_cadastrado";

export const NIVEIS_SICAF = [
  { num: 1, roman: "I", nome: "Habilitação", color: "#16a34a" },
  { num: 2, roman: "II", nome: "Habilitação Jurídica", color: "#16a34a" },
  { num: 3, roman: "III", nome: "Regularidade Fiscal Federal", color: "#f59e0b" },
  { num: 4, roman: "IV", nome: "Reg. Fiscal Estadual/Municipal", color: "#2563eb" },
  { num: 5, roman: "V", nome: "Qualificação Técnica", color: "#dc2626" },
  { num: 6, roman: "VI", nome: "Qualif. Econômico-Financeira", color: "#dc2626" },
] as const;

const statusMeta: Record<
  NivelStatus,
  { label: string; dot: string }
> = {
  validado: { label: "Validado", dot: "bg-success" },
  vencendo: { label: "Vencendo em breve", dot: "bg-warning" },
  vencido: { label: "Vencido", dot: "bg-danger" },
  pendente: { label: "Pendente", dot: "bg-warning" },
  nao_cadastrado: { label: "Não cadastrado", dot: "bg-muted-foreground/50" },
};

export interface NivelDotsProps {
  niveis: Record<number, NivelStatus>;
  size?: "sm" | "md";
}

export function NivelDots({ niveis, size = "sm" }: NivelDotsProps) {
  const dim = size === "sm" ? "h-5 w-5 text-[9px]" : "h-7 w-7 text-[11px]";
  return (
    <div className="flex items-center gap-1">
      {NIVEIS_SICAF.map((n) => {
        const status = niveis[n.num] ?? "nao_cadastrado";
        const inativo = status === "nao_cadastrado";
        const meta = statusMeta[status];
        return (
          <HoverCard key={n.num} openDelay={120} closeDelay={60}>
            <HoverCardTrigger asChild>
              <span
                role="img"
                aria-label={`Nível ${n.roman} - ${meta.label}`}
                className={`relative inline-flex items-center justify-center rounded-full font-bold text-white outline-none transition hover:scale-110 ${dim} ${
                  inativo ? "opacity-25 grayscale" : "shadow-sm"
                }`}
                style={{ backgroundColor: n.color }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {n.roman}
                {!inativo && (
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-card ${meta.dot}`}
                  />
                )}
              </span>
            </HoverCardTrigger>
            <HoverCardContent className="w-60 p-3 text-xs" side="top">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: n.color }}
                >
                  {n.roman}
                </span>
                <div>
                  <p className="font-semibold leading-tight">Nível {n.roman}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    {n.nome}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between border-t pt-2">
                <span className="text-muted-foreground">Status</span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                  {meta.label}
                </span>
              </div>
            </HoverCardContent>
          </HoverCard>
        );
      })}
    </div>
  );
}
