import { useState } from "react";
import {
  Bell,
  Clock,
  Zap,
  FolderOpen,
  CreditCard,
  FileText,
  Upload,
  Receipt,
  X,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "@tanstack/react-router";
import { PagamentoSicafModal } from "@/components/pagamento-sicaf-modal";
import type { EmpresaData } from "@/routes/empresas";

export function PendenciasModal({
  open,
  onOpenChange,
  empresas,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresas: EmpresaData[];
}) {
  const [pagamentoEmpresa, setPagamentoEmpresa] = useState<EmpresaData | null>(
    null,
  );

  if (empresas.length === 0) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-2xl p-0 overflow-hidden gap-0 sm:rounded-2xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          {/* Header gradiente */}
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 px-6 py-5 text-white">
            <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute top-0 right-0 h-32 w-32 rounded-full border border-white/20" />
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute right-4 top-4 rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white transition"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                <Bell className="h-6 w-6" />
              </div>
              <div className="min-w-0 pr-8">
                <h2 className="text-xl font-bold leading-tight">
                  Atenção — Pendências
                </h2>
                <p className="text-sm opacity-90 mt-0.5">
                  {empresas.length}{" "}
                  {empresas.length === 1 ? "empresa" : "empresas"} com
                  pendências que requerem ação
                </p>
              </div>
            </div>

            <div className="relative mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-semibold">
                <Clock className="h-3.5 w-3.5" />
                {empresas.length}{" "}
                {empresas.length === 1
                  ? "Cadastro Pendente"
                  : "Cadastros Pendentes"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-semibold">
                <Zap className="h-3.5 w-3.5" />
                Ação necessária
              </span>
            </div>
          </div>

          {/* Conteúdo */}
          <ScrollArea className="max-h-[60vh]">
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning" />
                <h3 className="font-bold text-base">
                  {empresas.length === 1
                    ? "Cadastro Pendente"
                    : "Cadastros Pendentes"}
                </h3>
              </div>

              {/* Cards explicativos */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-blue-200/60 bg-blue-50/60 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                      <FolderOpen className="h-4 w-4" />
                    </div>
                    <p className="font-bold text-sm">Documentação</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Acesse{" "}
                    <Link
                      to="/documentos"
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      Documentos
                    </Link>{" "}
                    →{" "}
                    <Link
                      to="/certidoes"
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      Certidões
                    </Link>{" "}
                    e anexe toda a documentação necessária para o cadastro
                    SICAF.
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <p className="font-bold text-sm">Pagamento</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Existe uma{" "}
                    <span className="font-semibold text-emerald-700">
                      taxa pendente
                    </span>
                    . Clique em{" "}
                    <span className="font-semibold text-emerald-700">
                      Gerar Taxa Cadbrasil
                    </span>{" "}
                    para gerar o boleto/PIX.
                  </p>
                </div>
              </div>

              {/* Lista de empresas */}
              <div className="space-y-3">
                {empresas.map((emp) => (
                  <div
                    key={emp.cnpj}
                    className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning-foreground">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm leading-tight truncate">
                          {emp.nome}
                        </p>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className="border-warning/40 bg-warning/10 text-warning-foreground text-[10px] font-semibold"
                          >
                            Pendente
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                          {emp.cnpj}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                      >
                        <Link to="/documentos">
                          <Upload className="h-3.5 w-3.5" />
                          Documentos
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => setPagamentoEmpresa(emp)}
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        Gerar Taxa
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t bg-muted/30 px-6 py-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Este alerta é exibido uma vez por dia •{" "}
              <span className="font-semibold text-foreground">
                Licença Cadbrasil 2026: R$ 985,00
              </span>
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Revisar depois
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {pagamentoEmpresa && (
        <PagamentoSicafModal
          open={Boolean(pagamentoEmpresa)}
          onOpenChange={(v) => !v && setPagamentoEmpresa(null)}
          empresa={{ nome: pagamentoEmpresa.nome, cnpj: pagamentoEmpresa.cnpj }}
        />
      )}
    </>
  );
}
