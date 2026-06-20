import { Barcode, Copy, Download, ExternalLink, CheckCircle2, Link2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type BoletoData = {
  barcode: string;
  link: string;
  pdf: string;
  valor: number;
  vencimento: string;
  protocolo: string;
  chargeId?: number;
};

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

function formatValor(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pickPdfUrl(data: BoletoData) {
  return data.pdf || data.link || "";
}

export function BoletoGeradoPanel({
  boletoData,
  documento,
  compact,
}: {
  boletoData: BoletoData;
  documento?: string;
  compact?: boolean;
}) {
  const barcode = boletoData.barcode || "";
  const pdfUrl = pickPdfUrl(boletoData);
  const linkUrl = boletoData.link || pdfUrl;

  const copyText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const openPdf = () => {
    if (!pdfUrl) {
      toast.error("Link do PDF não disponível");
      return;
    }
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

  const downloadPdf = () => {
    if (!pdfUrl) {
      toast.error("Link do PDF não disponível");
      return;
    }
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = `boleto-${boletoData.protocolo || "cadbrasil"}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Download iniciado");
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      {compact ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              <span className="font-semibold">Boleto gerado</span>
              <span className="text-muted-foreground">
                {formatValor(boletoData.valor)} · vence {formatDate(boletoData.vencimento)}
              </span>
            </div>
            {boletoData.protocolo && (
              <span className="text-xs font-mono text-muted-foreground">{boletoData.protocolo}</span>
            )}
          </div>

          <div className="rounded-xl border-2 border-primary bg-primary/5 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Pague agora — link do boleto
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button type="button" size="lg" className="gap-2 h-11 font-semibold" onClick={openPdf} disabled={!pdfUrl}>
                <ExternalLink className="h-4 w-4" />
                Abrir boleto (PDF)
              </Button>
              <Button type="button" size="lg" variant="outline" className="gap-2 h-11" onClick={downloadPdf} disabled={!pdfUrl}>
                <Download className="h-4 w-4" />
                Baixar PDF
              </Button>
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="gap-2 h-11"
                onClick={() => copyText(linkUrl, "Link do boleto")}
                disabled={!linkUrl}
              >
                <Copy className="h-4 w-4" />
                Copiar link
              </Button>
            </div>
            {linkUrl && (
              <p className="text-[11px] text-muted-foreground truncate" title={linkUrl}>
                {linkUrl}
              </p>
            )}
          </div>

          {barcode && (
            <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Barcode className="h-3 w-3" /> Linha digitável
              </p>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[11px] font-mono leading-snug break-all line-clamp-2">{barcode}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-8 gap-1 text-xs"
                  onClick={() => copyText(barcode.replace(/[.\s]/g, ""), "Código de barras")}
                >
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
      <div className="flex items-center gap-3 bg-success/10 border border-success/30 rounded-xl p-4">
        <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
        <div>
          <p className="font-semibold">Boleto gerado com sucesso!</p>
          <p className="text-sm text-muted-foreground">
            Valor {formatValor(boletoData.valor)} · vencimento {formatDate(boletoData.vencimento)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Protocolo</p>
          <p className="font-mono font-semibold mt-0.5">{boletoData.protocolo || "—"}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Vencimento</p>
          <p className="font-semibold mt-0.5">{formatDate(boletoData.vencimento)}</p>
        </div>
      </div>

      {barcode && (
        <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Barcode className="h-3.5 w-3.5" /> Linha digitável
          </p>
          <div className="flex items-center gap-2 rounded-lg border bg-background p-3">
            <span className="flex-1 text-xs font-mono break-all">{barcode}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1"
              onClick={() => copyText(barcode.replace(/[.\s]/g, ""), "Código de barras")}
            >
              <Copy className="h-3.5 w-3.5" /> Copiar
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          PDF e link do boleto
        </p>

        {linkUrl ? (
          <div className="flex items-center gap-2 rounded-lg border bg-background p-3">
            <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-xs text-muted-foreground truncate" title={linkUrl}>
              {linkUrl}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => copyText(linkUrl, "Link")}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Link ainda não disponível — tente abrir o PDF em instantes.</p>
        )}

        <div className="grid sm:grid-cols-3 gap-2">
          <Button type="button" className="gap-2" onClick={openPdf} disabled={!pdfUrl}>
            <ExternalLink className="h-4 w-4" />
            Abrir PDF
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={downloadPdf} disabled={!pdfUrl}>
            <Download className="h-4 w-4" />
            Baixar PDF
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            onClick={() => copyText(linkUrl, "Link do boleto")}
            disabled={!linkUrl}
          >
            <Copy className="h-4 w-4" />
            Copiar link
          </Button>
        </div>
      </div>
        </>
      )}

      {documento && !compact && (
        <p className="text-xs text-muted-foreground text-center font-mono">{documento}</p>
      )}
    </div>
  );
}
