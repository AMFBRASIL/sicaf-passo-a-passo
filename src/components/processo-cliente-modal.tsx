"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildProcessoClienteEtapas,
  type EtapaEstado,
  type ProcessoEtapa,
} from "@/lib/processo-cliente-etapas";
import type { EmpresaData } from "@/lib/empresas-shared";
import { cn } from "@/lib/utils";
import wizardBg from "@/assets/wizard-bg.jpg";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  Gavel,
  Rocket,
  Scale,
  Sparkles,
  Trophy,
} from "lucide-react";

const SESSION_KEY = "cadbrasil-processo-modal-visto";

const ETAPA_VISUAL: Record<
  ProcessoEtapa["id"],
  { icon: typeof Rocket; gradient: string; ring: string }
> = {
  ativacao: {
    icon: Rocket,
    gradient: "from-violet-600 via-indigo-600 to-blue-600",
    ring: "ring-violet-500/30",
  },
  juridica: {
    icon: Scale,
    gradient: "from-emerald-600 via-teal-600 to-cyan-600",
    ring: "ring-emerald-500/30",
  },
  licitacoes_federais: {
    icon: Gavel,
    gradient: "from-amber-500 via-orange-500 to-rose-500",
    ring: "ring-amber-500/30",
  },
};

function estadoLabel(estado: EtapaEstado): string {
  if (estado === "concluida") return "Concluída";
  if (estado === "em_andamento") return "Em andamento";
  return "Pendente";
}

function EstadoBadge({ estado }: { estado: EtapaEstado }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        estado === "concluida" && "border-success/40 bg-success/10 text-success",
        estado === "em_andamento" && "border-warning/40 bg-warning/10 text-warning-foreground",
        estado === "pendente" && "border-muted-foreground/30 bg-muted text-muted-foreground",
      )}
    >
      {estadoLabel(estado)}
    </Badge>
  );
}

function EtapaCard({ etapa, compact }: { etapa: ProcessoEtapa; compact?: boolean }) {
  const visual = ETAPA_VISUAL[etapa.id];
  const Icon = visual.icon;
  const concluida = etapa.estado === "concluida";

  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-1 flex-col rounded-2xl border bg-card/95 p-4 shadow-soft backdrop-blur-sm transition",
        concluida ? "border-success/35 shadow-success/5" : "border-border/80",
        etapa.estado === "em_andamento" && "border-warning/35 ring-2 ring-warning/15",
        compact ? "p-3" : "sm:p-5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md",
            visual.gradient,
            concluida && "shadow-success/20",
          )}
        >
          {concluida ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
        </div>
        <EstadoBadge estado={etapa.estado} />
      </div>

      <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Etapa {etapa.ordem}
      </p>
      <h3 className={cn("mt-1 font-bold leading-tight text-foreground", compact ? "text-sm" : "text-base")}>
        {etapa.titulo}
      </h3>
      <p className="mt-0.5 text-xs font-medium text-primary/80">{etapa.subtitulo}</p>
      {!compact && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{etapa.descricao}</p>
      )}
      <p
        className={cn(
          "mt-3 rounded-lg px-3 py-2 text-xs leading-relaxed",
          concluida && "bg-success/8 text-success",
          etapa.estado === "em_andamento" && "bg-warning/10 text-foreground",
          etapa.estado === "pendente" && "bg-muted/60 text-muted-foreground",
        )}
      >
        {etapa.detalhe}
      </p>
    </div>
  );
}

function SetaEtapa({ ativa }: { ativa: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center",
        "hidden md:flex",
      )}
      aria-hidden
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background shadow-sm",
          ativa ? "border-primary/40 text-primary" : "border-border text-muted-foreground/50",
        )}
      >
        <ChevronRight className="h-5 w-5" />
      </div>
    </div>
  );
}

export function ProcessoClienteModal({
  open,
  onOpenChange,
  empresas,
  empresaInicial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresas: EmpresaData[];
  empresaInicial?: EmpresaData | null;
}) {
  const [cnpjSelecionado, setCnpjSelecionado] = useState("");

  useEffect(() => {
    if (!open || empresas.length === 0) return;
    const inicial = empresaInicial?.cnpj ?? empresas[0]?.cnpj ?? "";
    setCnpjSelecionado((atual) => {
      if (atual && empresas.some((e) => e.cnpj === atual)) return atual;
      return inicial;
    });
  }, [open, empresas, empresaInicial]);

  const empresa = useMemo(
    () => empresas.find((e) => e.cnpj === cnpjSelecionado) ?? empresas[0] ?? null,
    [empresas, cnpjSelecionado],
  );

  const processo = useMemo(
    () => (empresa ? buildProcessoClienteEtapas(empresa) : null),
    [empresa],
  );

  if (!empresa || !processo) return null;

  const cnpjDigits = empresa.cnpj.replace(/\D/g, "");
  const ctaTo = processo.processoConcluido
    ? "/sicaf"
    : processo.proximaEtapa?.id === "ativacao" || empresa.taxaPendente
      ? "/empresas"
      : "/sicaf";
  const ctaSearch = ctaTo === "/sicaf" ? { cnpj: cnpjDigits } : undefined;

  const ctaLabel = processo.processoConcluido
    ? "Ver meu SICAF"
    : processo.proximoEtapa?.id === "ativacao"
      ? "Ativar SICAF"
      : "Continuar no SICAF";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-5xl w-[96vw] gap-0 overflow-hidden border-0 p-0",
          "max-h-[92vh] flex flex-col",
        )}
      >
        <div
          className="relative shrink-0 overflow-hidden px-6 pb-8 pt-6 text-white sm:px-8 sm:pt-8"
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(15,23,42,0.92), rgba(30,58,138,0.88)), url(${wizardBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="relative z-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-white/70">
                    Sua jornada CADBRASIL
                  </span>
                </div>
                <DialogTitle className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {processo.processoConcluido
                    ? "Processo concluído — parabéns!"
                    : "Acompanhe as etapas do seu processo"}
                </DialogTitle>
                <DialogDescription className="mt-2 max-w-2xl text-sm text-white/80">
                  {processo.processoConcluido
                    ? "Sua empresa concluiu as três etapas essenciais para operar com segurança no ecossistema de licitações federais."
                    : "Veja o que já foi validado e o que falta para concluir seu cadastro e habilitação no SICAF."}
                </DialogDescription>
              </div>

              {empresas.length > 1 && (
                <div className="w-full sm:w-64">
                  <Select value={cnpjSelecionado} onValueChange={setCnpjSelecionado}>
                    <SelectTrigger className="border-white/20 bg-white/10 text-white backdrop-blur-sm">
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map((e) => (
                        <SelectItem key={e.cnpj} value={e.cnpj}>
                          {e.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{empresa.nome}</p>
                <p className="font-mono text-xs text-white/70">{empresa.cnpj}</p>
              </div>
              <Badge
                className={cn(
                  "shrink-0 border-0",
                  processo.processoConcluido
                    ? "bg-emerald-500 text-white"
                    : "bg-white/20 text-white",
                )}
              >
                {processo.concluidas}/{processo.total} etapas
              </Badge>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs text-white/80">
                <span>Progresso geral</span>
                <span className="font-bold">{processo.percentual}%</span>
              </div>
              <Progress value={processo.percentual} className="h-2 bg-white/20 [&>div]:bg-emerald-400" />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-muted/20 px-4 py-6 sm:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
            {processo.etapas.map((etapa, i) => (
              <div key={etapa.id} className="flex min-w-0 flex-1 flex-col md:flex-row md:items-stretch">
                <EtapaCard etapa={etapa} />
                {i < processo.etapas.length - 1 && (
                  <SetaEtapa ativa={etapa.estado === "concluida"} />
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {processo.etapas.map((etapa) => {
              const Icon =
                etapa.estado === "concluida"
                  ? CheckCircle2
                  : etapa.estado === "em_andamento"
                    ? Clock3
                    : CircleDashed;
              return (
                <div
                  key={`resumo-${etapa.id}`}
                  className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs"
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      etapa.estado === "concluida" && "text-success",
                      etapa.estado === "em_andamento" && "text-warning",
                      etapa.estado === "pendente" && "text-muted-foreground",
                    )}
                  />
                  <span className="truncate text-muted-foreground">{etapa.titulo}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-card px-6 py-4 sm:px-8">
          <div className="min-w-0">
            {processo.proximoEtapa ? (
              <p className="text-sm text-muted-foreground">
                Próximo passo:{" "}
                <strong className="text-foreground">{processo.proximoEtapa.titulo}</strong>
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-sm font-medium text-success">
                <Trophy className="h-4 w-4" />
                Todas as etapas foram validadas
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button asChild className="gap-2">
              <Link
                to={ctaTo}
                search={ctaSearch}
                onClick={() => onOpenChange(false)}
              >
                {ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Abre o modal uma vez por sessão ao entrar na home (se houver empresas). */
export function useProcessoModalAutoOpen(empresas: EmpresaData[], loading: boolean) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || empresas.length === 0) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
      sessionStorage.setItem(SESSION_KEY, "1");
      const t = window.setTimeout(() => setOpen(true), 600);
      return () => window.clearTimeout(t);
    } catch {
      setOpen(true);
    }
  }, [loading, empresas.length]);

  return { open, setOpen };
}
