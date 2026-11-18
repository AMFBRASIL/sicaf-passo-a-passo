import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Receipt,
  Loader2,
  FileText,
  Download,
  Mail,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import {
  listarFiscalCliente,
  emitirFiscalCliente,
  cancelarFiscalCliente,
  arquivoNfseUrl,
  type NfseFiscalItem,
} from "@/lib/nfse-api";
import { apiFetch } from "@/lib/api-fetch";

function formatMoney(v: number) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return String(v);
  }
  return d.toLocaleDateString("pt-BR");
}

export function FiscalTab({ clienteId }: { clienteId: number }) {
  const [loading, setLoading] = useState(true);
  const [emittingKey, setEmittingKey] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [itens, setItens] = useState<NfseFiscalItem[]>([]);
  const [resumo, setResumo] = useState({ totalPagos: 0, totalComNfse: 0, totalPendentes: 0 });
  const [ambiente, setAmbiente] = useState<string>("");

  const carregar = useCallback(async () => {
    if (!Number.isFinite(clienteId) || clienteId <= 0) return;
    setLoading(true);
    try {
      const res = await listarFiscalCliente(clienteId);
      if (!res.ok) {
        toast.error(res.error || "Falha ao carregar fiscal");
        setItens([]);
        return;
      }
      setItens(res.itens || []);
      setResumo({
        totalPagos: res.totalPagos || 0,
        totalComNfse: res.totalComNfse || 0,
        totalPendentes: res.totalPendentes || 0,
      });
      setAmbiente(res.prestador?.ambiente || "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar fiscal");
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const baixarArquivo = async (item: NfseFiscalItem, tipo: "pdf" | "xml") => {
    if (!item.nfse?.id) return;
    // PDF sempre via API (DANFSe oficial do ADN). XML pode usar storage direto.
    if (tipo === "xml" && item.nfse.xmlUrl) {
      window.open(item.nfse.xmlUrl, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      toast.message(tipo === "pdf" ? "Buscando DANFSe oficial…" : "Baixando XML…");
      const res = await apiFetch(arquivoNfseUrl(clienteId, item.nfse.id, tipo));
      if (!res.ok) {
        toast.error(`Falha ao baixar ${tipo.toUpperCase()}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = tipo === "pdf" ? `DANFSe_${item.nfse.id}.pdf` : `NFSe_${item.nfse.id}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${tipo.toUpperCase()} baixado`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Erro no download ${tipo}`);
    }
  };

  const emitir = async (item: NfseFiscalItem) => {
    setEmittingKey(item.key);
    try {
      const res = await emitirFiscalCliente(clienteId, { key: item.key });
      if (!res.ok) {
        toast.error(res.error || "Falha ao emitir NFS-e");
        if (res.resposta && typeof res.resposta === "object") {
          const msgs = (res.resposta as { mensagens?: { Descricao?: string }[] }).mensagens;
          if (msgs?.[0]?.Descricao) toast.message(msgs[0].Descricao);
        }
        await carregar();
        return;
      }
      if (res.alreadyIssued) {
        toast.message("NFS-e já existia para este pagamento");
      } else {
        toast.success("NFS-e emitida — XML/PDF salvos e e-mail enviado");
      }
      if (res.email && typeof res.email === "object" && (res.email as { ok?: boolean }).ok === false) {
        toast.warning(
          `Nota ok, e-mail: ${(res.email as { error?: string }).error || "não enviado"}`,
        );
      }
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na emissão");
    } finally {
      setEmittingKey(null);
    }
  };

  const cancelar = async (item: NfseFiscalItem) => {
    if (!item.nfse?.id) return;
    const ok = window.confirm(
      `Cancelar a NFS-e deste pagamento?\n\n${item.descricao}\nChave: ${item.nfse.chaveAcesso || "—"}\n\nEssa ação envia o evento 101101 à SEFIN e não pode ser desfeita.`,
    );
    if (!ok) return;

    setCancellingId(item.nfse.id);
    try {
      const res = await cancelarFiscalCliente(clienteId, {
        emissaoId: item.nfse.id,
        motivo: "Cancelamento solicitado no painel Fiscal CadBrasil",
        cMotivo: "1",
      });
      if (!res.ok) {
        toast.error(res.error || "Falha ao cancelar NFS-e");
        await carregar();
        return;
      }
      if (res.alreadyCancelled) {
        toast.message("NFS-e já estava cancelada");
      } else {
        toast.success("NFS-e cancelada na SEFIN");
      }
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no cancelamento");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Receipt className="h-4 w-4 text-teal-600" /> Fiscal — NFS-e CadBrasil
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Pagamentos quitados deste cliente. Emita a nota, baixe PDF/XML e o cliente recebe e-mail
              automático.
              {ambiente ? ` Ambiente: ${ambiente}.` : ""}
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void carregar()} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <MiniStat label="Pagos" value={resumo.totalPagos} />
          <MiniStat label="Com NFS-e" value={resumo.totalComNfse} tone="ok" />
          <MiniStat label="Pendentes" value={resumo.totalPendentes} tone="warn" />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <FileText className="h-4 w-4" /> Pagamentos pagos
          </h4>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : itens.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center px-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Nenhum pagamento pago encontrado.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {itens.map((item) => {
              const status = item.nfse?.status;
              const autorizada = status === "autorizada";
              const cancelada = status === "cancelada";
              const emitting = emittingKey === item.key;
              const cancelling = cancellingId === item.nfse?.id;
              return (
                <li key={item.key} className="px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium truncate">{item.descricao}</p>
                      <Badge variant="secondary" className="text-[10px]">
                        {item.tipoLabel}
                      </Badge>
                      {autorizada ? (
                        <Badge className="bg-teal-600/15 text-teal-700 hover:bg-teal-600/20 text-[10px]">
                          NFS-e emitida
                        </Badge>
                      ) : cancelada ? (
                        <Badge className="bg-rose-600/10 text-rose-700 hover:bg-rose-600/15 text-[10px]">
                          Cancelada
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
                          Sem nota
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatMoney(item.valor)} · pago em {formatDate(item.dataPagamento)}
                      {item.nfse?.chaveAcesso
                        ? ` · chave …${String(item.nfse.chaveAcesso).slice(-8)}`
                        : ""}
                      {item.nfse?.emailEnviadoEm ? " · e-mail enviado" : ""}
                    </p>
                    {item.nfse?.erro && !autorizada && (
                      <p className="mt-1 text-[11px] text-rose-600 line-clamp-2">{item.nfse.erro}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {autorizada && item.nfse?.id ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-xs"
                          onClick={() => void baixarArquivo(item, "pdf")}
                        >
                          <Download className="h-3.5 w-3.5" /> PDF
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-xs"
                          onClick={() => void baixarArquivo(item, "xml")}
                        >
                          <Download className="h-3.5 w-3.5" /> XML
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-xs border-rose-300 text-rose-700 hover:bg-rose-50"
                          disabled={cancelling}
                          onClick={() => void cancelar(item)}
                        >
                          {cancelling ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Ban className="h-3.5 w-3.5" />
                          )}
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 bg-teal-700 hover:bg-teal-800 text-xs"
                        disabled={emitting}
                        onClick={() => void emitir(item)}
                      >
                        {emitting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        {cancelada ? "Reemitir NFS-e" : "Emitir NFS-e"}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <Separator />
        <div className="px-4 py-2.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Mail className="h-3.5 w-3.5" />
          Ao emitir: salva PDF/XML no armazenamento e envia e-mail &quot;CADBRASIL - Nota Fiscal&quot;.
        </div>
      </Card>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn";
}) {
  const cls =
    tone === "ok"
      ? "bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200"
      : tone === "warn"
        ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        : "bg-muted/60 text-foreground";
  return (
    <div className={`rounded-lg px-3 py-2 ${cls}`}>
      <p className="text-[10px] uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
