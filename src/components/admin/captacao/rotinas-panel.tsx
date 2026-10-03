import { useState } from "react";
import { CalendarClock, Loader2, Pause, Play, Repeat, ScrollText, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { alterarRotina, type Rotina } from "@/lib/admin-servicos-captacao-api";
import { FREQUENCIA_ROTINA, dataHora, numero } from "./servicos-visual";

export function RotinasPanel({
  rotinas,
  mostrarServico = false,
  vazio,
  onAtualizar,
  onVerLog,
}: {
  rotinas: Rotina[];
  mostrarServico?: boolean;
  vazio?: string;
  onAtualizar: () => void;
  onVerLog: (campanhaId: number) => void;
}) {
  const [acaoEm, setAcaoEm] = useState<number | null>(null);

  const executar = async (r: Rotina, acao: "pausar" | "ativar" | "executar" | "excluir") => {
    if (acao === "excluir" && !window.confirm(`Excluir a rotina “${r.nome}”?`)) return;
    if (
      acao === "executar" &&
      !window.confirm(`Executar “${r.nome}” agora? Uma nova campanha entra na fila de envio.`)
    ) {
      return;
    }
    setAcaoEm(r.id);
    const res = await alterarRotina(r.id, acao);
    setAcaoEm(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (acao === "executar" && res.campanhaId) {
      toast.success(`Campanha #${res.campanhaId} criada com ${numero(res.total || 0)} e-mails`);
      onVerLog(res.campanhaId);
    } else {
      toast.success(
        acao === "pausar"
          ? "Rotina pausada"
          : acao === "ativar"
            ? "Rotina ativada"
            : "Rotina excluída",
      );
    }
    onAtualizar();
  };

  if (!rotinas.length) {
    return (
      <Card className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
        <CalendarClock className="h-7 w-7" />
        <p className="max-w-md text-sm">
          {vazio ||
            "Nenhuma rotina agendada. Prepare o e-mail na aba E-mail em massa e use “Enviar para o Email Marketing”."}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {rotinas.map((r) => (
        <Card key={r.id} className={`p-4 ${r.ativa ? "" : "opacity-70"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    r.ativa
                      ? "border-sky-200 bg-sky-50 text-sky-700"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  }
                >
                  {r.ativa
                    ? "Agendada"
                    : r.frequencia === "uma_vez" && r.execucoes
                      ? "Executada"
                      : "Pausada"}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Repeat className="h-3 w-3" />
                  {FREQUENCIA_ROTINA[r.frequencia]}
                </Badge>
                {mostrarServico && (
                  <span
                    className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-white"
                    style={{ background: r.cor || "#64748b" }}
                  >
                    {r.servicoNome}
                  </span>
                )}
              </div>
              <p className="truncate font-medium" title={r.nome}>
                {r.nome}
              </p>
              <p className="truncate text-xs text-muted-foreground" title={r.assunto}>
                {r.segmentoNome}
                {r.uf ? ` · ${r.uf}` : ""}
                {r.limite ? ` · até ${numero(r.limite)} por execução` : ""}
                {r.cooldownDias ? ` · sem repetir por ${r.cooldownDias} dias` : ""} — “{r.assunto}”
              </p>
              <p className="text-xs text-muted-foreground">
                {r.ativa && r.proximaExecucao ? (
                  <span className="font-medium text-foreground">
                    Próximo envio: {dataHora(r.proximaExecucao)}
                  </span>
                ) : null}
                {r.ultimaExecucao
                  ? `${r.ativa ? " · " : ""}Última execução ${dataHora(r.ultimaExecucao)}: ${r.ultimoResultado || ""}`
                  : !r.ativa
                    ? "Nunca executada"
                    : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {r.ultimaCampanhaId && (
                <Button size="sm" variant="ghost" onClick={() => onVerLog(r.ultimaCampanhaId!)}>
                  <ScrollText className="mr-1 h-3.5 w-3.5" />
                  Último envio
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={acaoEm === r.id}
                onClick={() => void executar(r, "executar")}
              >
                {acaoEm === r.id ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Zap className="mr-1 h-3.5 w-3.5" />
                )}
                Executar agora
              </Button>
              {r.ativa ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={acaoEm === r.id}
                  onClick={() => void executar(r, "pausar")}
                >
                  <Pause className="mr-1 h-3.5 w-3.5" />
                  Pausar
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={acaoEm === r.id}
                  onClick={() => void executar(r, "ativar")}
                >
                  <Play className="mr-1 h-3.5 w-3.5" />
                  Ativar
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-rose-600 hover:text-rose-700"
                title="Excluir rotina"
                disabled={acaoEm === r.id}
                onClick={() => void executar(r, "excluir")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
