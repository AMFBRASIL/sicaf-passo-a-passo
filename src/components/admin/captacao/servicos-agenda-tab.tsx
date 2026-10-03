import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, Layers, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Campanha, Rotina } from "@/lib/admin-servicos-captacao-api";
import { CampanhasPanel } from "./campanhas-panel";
import { EnvioLogModal } from "./envio-log-modal";
import { RotinasPanel } from "./rotinas-panel";
import { numero } from "./servicos-visual";

/** Visão, dentro do Email Marketing, dos processos preparados em Admin → Serviços. */
export function ServicosAgendaTab({
  rotinas,
  campanhas,
  onAtualizar,
}: {
  rotinas: Rotina[];
  campanhas: Campanha[];
  onAtualizar: () => void | Promise<void>;
}) {
  const [logId, setLogId] = useState<number | null>(null);
  const ativas = rotinas.filter((r) => r.ativa).length;
  const emEnvio = campanhas.filter((c) => c.status === "enviando" || c.status === "agendada");
  const enviados30 = campanhas
    .filter((c) => Date.now() - new Date(c.criadaEm).getTime() < 30 * 86400000)
    .reduce((acc, c) => acc + c.enviados, 0);

  useEffect(() => {
    if (!emEnvio.length) return;
    const t = window.setInterval(onAtualizar, 15000);
    return () => window.clearInterval(t);
  }, [emEnvio.length, onAtualizar]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-3 gap-3 sm:max-w-xl">
          <Resumo label="Rotinas agendadas" valor={numero(ativas)} />
          <Resumo label="Em envio agora" valor={numero(emEnvio.length)} />
          <Resumo label="E-mails enviados (30d)" valor={numero(enviados30)} />
        </div>
        <Button variant="outline" asChild>
          <Link to="/admin/servicos">
            <Layers className="mr-1.5 h-4 w-4" />
            Preparar novo processo
          </Link>
        </Button>
      </div>

      <section className="space-y-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <CalendarClock className="h-4 w-4 text-primary" />
          Rotinas agendadas
        </h3>
        <RotinasPanel
          rotinas={rotinas}
          mostrarServico
          vazio="Nenhuma rotina ainda. Em Admin → Serviços, abra um serviço, prepare o e-mail e use “Enviar para o Email Marketing”."
          onAtualizar={onAtualizar}
          onVerLog={setLogId}
        />
      </section>

      <section className="space-y-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <Send className="h-4 w-4 text-primary" />
          Envios dos serviços
        </h3>
        <CampanhasPanel
          campanhas={campanhas}
          mostrarServico
          onAtualizar={onAtualizar}
          onVerLog={setLogId}
        />
      </section>

      <EnvioLogModal campanhaId={logId} onClose={() => setLogId(null)} onAtualizar={onAtualizar} />
    </div>
  );
}

function Resumo({ label, valor }: { label: string; valor: string }) {
  return (
    <Card className="p-3">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tracking-tight">{valor}</p>
    </Card>
  );
}
