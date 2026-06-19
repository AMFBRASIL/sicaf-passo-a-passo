import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Target,
  Loader2,
  Globe,
  Search,
  MapPin,
  ExternalLink,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import type { ClienteDetalhe } from "@/components/admin/cliente-detalhe-modal";
import {
  fetchAdminClienteTracking,
  type ClienteTrackingResumo,
  type ClienteTrackingSessao,
} from "@/lib/admin-clientes-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: ClienteDetalhe;
  clienteId?: number;
};

function InfoRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  if (!value || value === "—") return null;
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`min-w-0 text-right text-sm font-medium break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function formatDuracao(segundos: number) {
  if (!segundos || segundos <= 0) return "—";
  if (segundos < 60) return `${segundos}s`;
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return s > 0 ? `${m}min ${s}s` : `${m}min`;
}

function SessaoCard({ s, destaque }: { s: ClienteTrackingSessao; destaque?: boolean }) {
  return (
    <Card className={`p-3 ${destaque ? "ring-2 ring-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/10" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold">{s.primeiraVisita}</span>
          {s.googleAds && (
            <Badge className="bg-red-500/90 text-white border-0 text-[10px] hover:bg-red-500/90">Google Ads</Badge>
          )}
          {s.converted && (
            <Badge className="bg-emerald-600 text-white border-0 text-[10px] hover:bg-emerald-600">Convertido</Badge>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">{s.canal}</span>
      </div>

      {s.utmTerm && (
        <p className="mt-2 text-sm">
          <Search className="mr-1 inline h-3.5 w-3.5 text-red-500" />
          <span className="font-semibold text-foreground">{s.utmTerm}</span>
        </p>
      )}

      <div className="mt-2 grid gap-1.5 text-xs text-muted-foreground">
        {s.utmCampaign && <p>Campanha: <span className="text-foreground">{s.utmCampaign}</span></p>}
        {s.utmMedium && <p>Mídia: <span className="text-foreground">{s.utmMedium}</span></p>}
        {s.utmSource && <p>Origem: <span className="text-foreground">{s.utmSource}</span></p>}
        {s.gclid && (
          <p className="font-mono text-[10px] break-all">
            GCLID: <span className="text-foreground">{s.gclid}</span>
          </p>
        )}
        {s.landingPage && (
          <p className="break-all">
            Landing:{" "}
            <a href={s.landingPage} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
              {s.landingPage.length > 60 ? `${s.landingPage.slice(0, 60)}…` : s.landingPage}
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          </p>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
          <span>{s.pagesViewed} páginas</span>
          <span>{formatDuracao(s.sessionDuration)}</span>
          {s.deviceType && s.deviceType !== "unknown" && <span>{s.deviceType}</span>}
          {(s.geoCity || s.geoState) && (
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              {[s.geoCity, s.geoState].filter(Boolean).join(" / ")}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

export function GoogleTrackingModal({ open, onOpenChange, cliente, clienteId }: Props) {
  const [loading, setLoading] = useState(false);
  const [resumo, setResumo] = useState<ClienteTrackingResumo | null>(null);
  const [sessoes, setSessoes] = useState<ClienteTrackingSessao[]>([]);
  const [vazioMsg, setVazioMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    try {
      const res = await fetchAdminClienteTracking(clienteId);
      if (!res.ok) {
        toast.error(res.error || "Erro ao carregar tracking");
        setResumo(null);
        setSessoes([]);
        return;
      }
      setResumo(res.resumo ?? null);
      setSessoes(res.sessoes || []);
      setVazioMsg(res.message || null);
    } catch {
      toast.error("Erro ao carregar tracking");
      setResumo(null);
      setSessoes([]);
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    if (open) void carregar();
  }, [open, carregar]);

  const sessaoConvertida = sessoes.find((s) => s.converted);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(90vh,880px)] max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-red-500" /> Google Tracking
          </DialogTitle>
          <DialogDescription>
            Origem, campanhas e palavras-chave de <span className="font-medium text-foreground">{cliente.razao}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          <div className="space-y-5 p-6 pb-8">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" /> Carregando tracking...
              </div>
            ) : !resumo ? (
              <div className="rounded-xl border border-dashed py-12 text-center">
                <Globe className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium">Nenhum dado de tracking encontrado</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                  {vazioMsg ||
                    "Este cliente ainda não possui sessões registradas em tracking_sessoes (visita antes do cadastro ou acesso direto)."}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Card className="p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sessões</p>
                    <p className="text-xl font-bold">{resumo.totalSessoes}</p>
                  </Card>
                  <Card className="p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Google Ads</p>
                    <p className="text-xl font-bold">{resumo.sessoesGoogleAds}</p>
                  </Card>
                  <Card className="p-3 text-center col-span-2 sm:col-span-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Canal principal</p>
                    <p className="text-sm font-bold truncate">{resumo.canalPrincipal}</p>
                  </Card>
                </div>

                {(resumo.palavraChave || resumo.palavraConvertida) && (
                  <Card className="p-4 bg-red-50/50 dark:bg-red-950/10 border-red-200/60 dark:border-red-900/40">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
                      Palavra-chave
                    </p>
                    <p className="mt-1 text-lg font-bold">{resumo.palavraConvertida || resumo.palavraChave}</p>
                    {resumo.palavraConvertida && resumo.palavraChave && resumo.palavraConvertida !== resumo.palavraChave && (
                      <p className="mt-1 text-xs text-muted-foreground">Primeira palavra rastreada: {resumo.palavraChave}</p>
                    )}
                  </Card>
                )}

                <Card className="p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resumo da jornada</p>
                  <InfoRow label="Origem" value={resumo.origem} />
                  <InfoRow label="Mídia" value={resumo.midia} />
                  <InfoRow label="Campanha" value={resumo.campanha} />
                  <InfoRow label="GCLID" value={resumo.gclid} mono />
                  <InfoRow label="Primeira visita" value={resumo.primeiraVisita} />
                  <InfoRow label="Última visita" value={resumo.ultimaVisita} />
                  {resumo.landingPage && <InfoRow label="Landing page" value={resumo.landingPage} />}
                  {resumo.referrer && <InfoRow label="Referrer" value={resumo.referrer} />}
                </Card>

                {resumo.convertido && (
                  <div className="flex items-start gap-3 rounded-lg border border-emerald-200/70 bg-emerald-50/60 dark:bg-emerald-950/20 p-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Conversão registrada</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {resumo.tipoConversao || "Conversão"}
                        {resumo.valorConversao != null && resumo.valorConversao > 0
                          ? ` · R$ ${resumo.valorConversao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                          : ""}
                        {resumo.conversaoEm && resumo.conversaoEm !== "—" ? ` · ${resumo.conversaoEm}` : ""}
                      </p>
                    </div>
                  </div>
                )}

                <Separator />

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      Histórico de sessões
                    </p>
                    <Badge variant="secondary" className="text-[10px]">{sessoes.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {sessaoConvertida && (
                      <>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Sessão convertida</p>
                        <SessaoCard s={sessaoConvertida} destaque />
                      </>
                    )}
                    {sessoes
                      .filter((s) => !s.converted)
                      .map((s) => (
                        <SessaoCard key={s.id} s={s} />
                      ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t bg-background px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
