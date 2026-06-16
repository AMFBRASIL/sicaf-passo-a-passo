import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  FileUp,
  Globe,
  Rocket,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaNome?: string;
  cnpj?: string;
};

const PASSOS = [
  {
    icon: Bot,
    titulo: "Instale o Assistente CadBrasil",
    desc: "Extensão no Google Chrome para acessar o portal Compras.gov.br com suporte automatizado.",
  },
  {
    icon: Globe,
    titulo: "Acesse o portal GOV",
    desc: "Com o Assistente, entre no cadastro SICAF da sua empresa no Compras.gov.br.",
  },
  {
    icon: FileUp,
    titulo: "Envie a documentação",
    desc: "Emita a Situação do Fornecedor (PDF) e envie pelo Assistente para sincronizar os níveis I a VI.",
  },
] as const;

export function ResolverSicafInaptoModal({ open, onOpenChange, empresaNome, cnpj }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid w-[calc(100%-1.5rem)] max-h-[min(92dvh,40rem)] max-w-md grid-rows-[auto_1fr_auto] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="shrink-0 border-b bg-gradient-to-br from-amber-500/15 via-background to-red-500/10 px-5 py-4">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-soft">
              <Rocket className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg leading-tight">Regularize seu SICAF</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {empresaNome ? (
                <>
                  A empresa <strong className="text-foreground">{empresaNome}</strong> está com a{" "}
                  <strong className="text-foreground">taxa SICAF paga</strong>, porém ainda{" "}
                  <strong className="text-red-600">INAPTA</strong> para licitar.
                </>
              ) : (
                <>
                  Sua empresa está com a <strong className="text-foreground">taxa SICAF paga</strong>, porém ainda{" "}
                  <strong className="text-red-600">INAPTA</strong> para licitar.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-success">Pagamento confirmado</p>
              <p className="text-muted-foreground mt-0.5 leading-snug">
                A licença anual do SICAF está ativa. O financeiro está em dia.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-red-600/30 bg-red-600/5 px-4 py-3 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-red-700">Situação INAPTA</p>
              <p className="text-muted-foreground mt-0.5 leading-snug">
                Nenhum nível foi sincronizado pelo Assistente ainda. Para ficar APTO, é preciso
                regularizar o cadastro no portal do governo.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              O que fazer agora
            </p>
            {PASSOS.map((p, i) => {
              const Icon = p.icon;
              return (
                <div key={p.titulo} className="flex gap-3 rounded-lg border bg-card p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                      {p.titulo}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{p.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-col gap-2 border-t bg-muted/20 px-5 py-4 sm:flex-col">
          <Button asChild className="w-full gap-2" size="lg">
            <Link
              to="/assistente"
              search={cnpj ? { cnpj } : undefined}
              onClick={() => onOpenChange(false)}
            >
              <Bot className="h-4 w-4" />
              Ir para o Assistente
            </Link>
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Entendi, fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
