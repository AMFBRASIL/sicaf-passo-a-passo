import { useEffect, useState } from "react";
import {
  Bell,
  Clock,
  Zap,
  FolderOpen,
  CreditCard,
  Building2,
  Upload,
  Receipt,
  X,
  ArrowRight,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { PagamentoSicafModal } from "@/components/pagamento-sicaf-modal";
import { fetchSicafValores } from "@/lib/empresas-api";
import type { EmpresaData } from "@/routes/empresas";
import { cn } from "@/lib/utils";

function formatCnpj(doc: string) {
  const d = doc.replace(/\D/g, "");
  if (d.length === 14) {
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  return doc;
}

export function PendenciasModal({
  open,
  onOpenChange,
  empresas,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresas: EmpresaData[];
}) {
  const [pagamentoEmpresa, setPagamentoEmpresa] = useState<EmpresaData | null>(null);
  const [valorTaxa, setValorTaxa] = useState(985);

  useEffect(() => {
    if (!open) return;
    fetchSicafValores().then((r) => {
      if (r.ok && r.valores?.valorCadastroSicaf) {
        setValorTaxa(r.valores.valorCadastroSicaf);
      }
    });
  }, [open]);

  if (empresas.length === 0) return null;

  const count = empresas.length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "max-w-3xl w-[95vw] p-0 gap-0 overflow-hidden sm:rounded-2xl border-0 shadow-2xl",
            "[&>button:last-child]:hidden",
          )}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">Atenção — Pendências SICAF</DialogTitle>

          {/* Header */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600" />
            <div className="pointer-events-none absolute inset-0 opacity-[0.12]">
              <div className="absolute -right-6 -top-6 h-36 w-36 rounded-full border-[3px] border-white" />
              <div className="absolute bottom-2 left-8 h-20 w-20 rounded-full border-[3px] border-white" />
              <div className="absolute right-1/3 top-10 h-14 w-14 rounded-full border-2 border-white" />
            </div>
            <div className="absolute -left-16 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-white/10 blur-3xl" />

            <div className="relative px-6 pb-5 pt-6">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="absolute right-4 top-4 rounded-xl p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-start gap-4 pr-10">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-lg backdrop-blur-sm">
                  <Bell className="h-7 w-7 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-2xl font-extrabold tracking-tight text-white">
                    Atenção — Pendências
                  </h2>
                  <p className="mt-1 text-sm text-white/85">
                    {count} {count === 1 ? "empresa" : "empresas"} com pendências que requerem ação
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                  <Clock className="h-4 w-4" />
                  {count} Cadastro{count > 1 ? "s" : ""} Pendente{count > 1 ? "s" : ""}
                </span>
                <span className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                  <Zap className="h-4 w-4" />
                  Ação necessária
                </span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-[58vh] overflow-y-auto overscroll-contain bg-gradient-to-b from-muted/20 to-background">
            <div className="space-y-5 p-6">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <h3 className="text-base font-bold text-foreground">
                  {count === 1 ? "Cadastro Pendente" : "Cadastros Pendentes"}
                </h3>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Card className="overflow-hidden border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/[0.06] to-transparent shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                        <FolderOpen className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground">Documentação</p>
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                          Acesse{" "}
                          <Link to="/documentos" className="font-semibold text-blue-600 hover:underline">
                            Documentos
                          </Link>{" "}
                          <ArrowRight className="inline h-3 w-3 text-blue-500" />{" "}
                          <Link to="/certidoes" className="font-semibold text-blue-600 hover:underline">
                            Certidões
                          </Link>{" "}
                          e anexe toda a documentação necessária para o cadastro SICAF.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] to-transparent shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                        <CreditCard className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground">Pagamento</p>
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                          Existe uma{" "}
                          <span className="font-semibold text-emerald-600">taxa pendente</span>. Clique em{" "}
                          <span className="font-semibold text-emerald-600">Gerar Taxa</span> para emitir boleto ou PIX
                          e liberar o cadastro SICAF.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/[0.04] px-4 py-3">
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    Regularize documentação e pagamento para sair do status{" "}
                    <strong className="text-foreground">INAPTO</strong> e voltar a participar de licitações.
                  </span>
                </p>
              </div>

              <div className="space-y-3">
                {empresas.map((emp) => (
                  <div
                    key={emp.clienteId ?? emp.cnpj}
                    className="group rounded-2xl border-2 border-border bg-card p-4 shadow-sm transition-all hover:border-amber-500/40 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-500/15 to-orange-500/5">
                          <Building2 className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-bold leading-tight text-foreground">
                              {emp.nome}
                            </p>
                            <Badge
                              variant="outline"
                              className="border-amber-500/35 bg-amber-500/10 text-[10px] font-semibold text-amber-700"
                            >
                              Pendente
                            </Badge>
                          </div>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            {formatCnpj(emp.cnpj)}
                          </p>
                          {emp.proximoPasso && (
                            <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                              {emp.proximoPasso}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2 sm:flex-nowrap">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-blue-500/30 text-blue-700 hover:bg-blue-500/10"
                        >
                          <Link to="/documentos" search={{ cnpj: emp.cnpj }}>
                            <Upload className="h-3.5 w-3.5" />
                            Documentos
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1.5 bg-emerald-600 shadow-md shadow-emerald-600/20 hover:bg-emerald-700"
                          onClick={() => setPagamentoEmpresa(emp)}
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          Gerar Taxa
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-3 border-t bg-muted/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <p>
                Este alerta é exibido na primeira visita do dia • Licença Cadbrasil 2026:{" "}
                <span className="font-semibold text-foreground">
                  {valorTaxa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </p>
            </div>
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => onOpenChange(false)}>
              Revisar depois
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {pagamentoEmpresa?.clienteId ? (
        <PagamentoSicafModal
          open={Boolean(pagamentoEmpresa)}
          onOpenChange={(v) => !v && setPagamentoEmpresa(null)}
          empresa={{
            nome: pagamentoEmpresa.nome,
            cnpj: pagamentoEmpresa.cnpj,
            clienteId: pagamentoEmpresa.clienteId,
          }}
        />
      ) : null}
    </>
  );
}
