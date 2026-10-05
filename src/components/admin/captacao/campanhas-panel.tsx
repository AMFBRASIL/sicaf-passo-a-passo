import { useState } from "react";
import { Ban, Loader2, Mail, Pause, Play, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { alterarCampanha, type Campanha } from "@/lib/admin-servicos-captacao-api";
import { STATUS_CAMPANHA, dataHora, moeda, numero, pct } from "./servicos-visual";

export function CampanhasPanel({
  campanhas,
  mostrarServico = false,
  onAtualizar,
  onVerLog,
}: {
  campanhas: Campanha[];
  mostrarServico?: boolean;
  onAtualizar: () => void;
  onVerLog: (campanhaId: number) => void;
}) {
  const [acaoEm, setAcaoEm] = useState<number | null>(null);

  const executar = async (c: Campanha, acao: "pausar" | "retomar" | "cancelar") => {
    if (
      acao === "cancelar" &&
      !window.confirm("Cancelar esta campanha? Os e-mails pendentes não serão enviados.")
    ) {
      return;
    }
    setAcaoEm(c.id);
    const res = await alterarCampanha(c.id, acao);
    setAcaoEm(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      acao === "pausar"
        ? "Campanha pausada"
        : acao === "retomar"
          ? "Envio retomado"
          : "Campanha cancelada",
    );
    onAtualizar();
  };

  if (!campanhas.length) {
    return (
      <Card className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
        <Mail className="h-8 w-8" />
        <p className="font-medium text-foreground">Nenhuma campanha ainda</p>
        <p className="max-w-sm text-sm">
          {mostrarServico
            ? "As campanhas criadas em Admin → Serviços aparecem aqui."
            : "Escolha um público acima e use a aba E-mail em massa para enviar a primeira campanha deste serviço."}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Conversão = cliente que recebeu o e-mail e pagou este serviço em até 60 dias depois.
        Aberturas dependem do cliente de e-mail exibir imagens, então são uma estimativa.
      </p>
      {campanhas.map((c) => {
        const st = STATUS_CAMPANHA[c.status];
        const processados = c.enviados + c.falhas + c.cancelados;
        const progresso = c.total ? Math.round((processados / c.total) * 100) : 0;
        return (
          <Card key={c.id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={st.classe}>
                    {st.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    #{c.id} · {mostrarServico ? `${c.servicoNome} · ` : ""}
                    {c.segmentoNome}
                    {c.uf ? ` · ${c.uf}` : ""}
                    {c.rotinaId ? " · via rotina" : ""}
                  </span>
                </div>
                <p className="mt-1 truncate font-medium" title={c.assunto}>
                  {c.assunto}
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.status === "agendada"
                    ? `Agendada para ${dataHora(c.agendadaPara)}`
                    : `Criada em ${dataHora(c.criadaEm)}`}
                  {c.concluidaEm ? ` · finalizada em ${dataHora(c.concluidaEm)}` : ""}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => onVerLog(c.id)}>
                  <ScrollText className="mr-1 h-3.5 w-3.5" />
                  Ver log
                </Button>
                {(c.status === "enviando" || c.status === "agendada") && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acaoEm === c.id}
                    onClick={() => void executar(c, "pausar")}
                  >
                    {acaoEm === c.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Pause className="mr-1 h-3.5 w-3.5" />
                    )}
                    Pausar
                  </Button>
                )}
                {c.status === "pausada" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acaoEm === c.id}
                    onClick={() => void executar(c, "retomar")}
                  >
                    <Play className="mr-1 h-3.5 w-3.5" />
                    Retomar
                  </Button>
                )}
                {!["concluida", "cancelada"].includes(c.status) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-600 hover:text-rose-700"
                    disabled={acaoEm === c.id}
                    onClick={() => void executar(c, "cancelar")}
                  >
                    <Ban className="mr-1 h-3.5 w-3.5" />
                    Cancelar
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {numero(c.enviados)} de {numero(c.total)} enviados
                  {c.falhas ? ` · ${numero(c.falhas)} falhas` : ""}
                  {c.pendentes && c.status !== "cancelada"
                    ? ` · ${numero(c.pendentes)} na fila`
                    : ""}
                </span>
                <span>{progresso}%</span>
              </div>
              <Progress value={progresso} className="h-1.5" />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Indicador
                label="Aberturas"
                valor={numero(c.aberturas)}
                detalhe={pct(c.aberturas, c.enviados)}
              />
              <Indicador
                label="Cliques"
                valor={numero(c.cliques)}
                detalhe={pct(c.cliques, c.enviados)}
              />
              <Indicador
                label="Conversões"
                valor={numero(c.conversoes)}
                detalhe={pct(c.conversoes, c.enviados)}
              />
              <Indicador label="Receita gerada" valor={moeda(c.receita)} />
            </div>

            {c.ultimoErro && (c.falhas > 0 || c.status === "pausada") && (
              <p className="break-words rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {c.status === "pausada" ? c.ultimoErro : `Último erro: ${c.ultimoErro}`}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function Indicador({ label, valor, detalhe }: { label: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-bold">
        {valor}
        {detalhe && (
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">{detalhe}</span>
        )}
      </p>
    </div>
  );
}
