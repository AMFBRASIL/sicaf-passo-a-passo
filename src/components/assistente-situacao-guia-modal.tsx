import { Bot, ChevronRight, FileWarning } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import guiaSicafSituacao from "@/assets/guia-sicaf-situacao-fornecedor.jpg";

const SICAF_BUTTON_CLASS =
  "bg-accent-green text-accent-green-foreground hover:bg-accent-green/90";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAcessarSicaf: () => void;
  mensagem?: string | null;
};

export function AssistenteSituacaoGuiaModal({
  open,
  onOpenChange,
  onAcessarSicaf,
  mensagem,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid w-[calc(100%-1.5rem)] max-h-[min(94dvh,44rem)] max-w-3xl grid-rows-[auto_1fr_auto] gap-0 overflow-hidden p-0">
        <div className="shrink-0 border-b bg-gradient-to-br from-amber-50 via-background to-emerald-50/60 px-5 py-4 dark:from-amber-950/40 dark:to-emerald-950/20">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400">
              <FileWarning className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg leading-tight">
                Este PDF não é a Situação do Fornecedor
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-xs leading-relaxed sm:text-sm">
                {mensagem ||
                  "Envie somente o PDF da Situação do Fornecedor emitido no portal SICAF. Siga o passo a passo abaixo e depois anexe o arquivo no Assistente."}
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
          <ol className="grid gap-2 text-sm sm:grid-cols-2">
            <li className="rounded-xl border bg-card/80 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Passo 1
              </p>
              <p className="mt-0.5 font-semibold leading-snug">Acesse o SICAF</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Clique em <strong className="text-foreground">Acessar SICAF</strong> neste Assistente
                e entre no Compras.gov.br.
              </p>
            </li>
            <li className="rounded-xl border bg-card/80 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Passo 2–3
              </p>
              <p className="mt-0.5 font-semibold leading-snug">Emita a Situação</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Menu <strong className="text-foreground">Consulta → Situação do Fornecedor</strong>,
                pesquise e baixe o PDF pelo botão verde.
              </p>
            </li>
          </ol>

          <div className="overflow-hidden rounded-xl border bg-muted/20">
            <img
              src={guiaSicafSituacao}
              alt="Passo a passo no SICAF: Consulta → Situação do Fornecedor → Pesquisar → baixar PDF → enviar no Assistente CadBrasil"
              className="block h-auto w-full"
            />
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            Depois de baixar o PDF, volte aqui e envie no campo da etapa 3 (Situação do Fornecedor).
          </p>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t bg-muted/20 px-5 py-3 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            className={cn(SICAF_BUTTON_CLASS, "gap-2")}
            onClick={() => {
              onOpenChange(false);
              onAcessarSicaf();
            }}
          >
            <Bot className="h-4 w-4" />
            Acessar SICAF
            <ChevronRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
