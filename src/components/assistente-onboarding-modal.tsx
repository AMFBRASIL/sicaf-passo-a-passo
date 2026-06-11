import {
  Bot,
  CheckCircle2,
  FileText,
  MousePointerClick,
  Sparkles,
  Upload,
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

/** Incremente a versão ao mudar o conteúdo do tutorial (exibe de novo para quem já viu). */
const STORAGE_KEY = "cadbrasil-assistente-onboarding-v2";

const PASSOS = [
  {
    icon: MousePointerClick,
    titulo: 'Clique em "Acessar SICAF"',
    desc: "No canto superior direito desta página, use o botão verde Acessar SICAF para abrir o Compras.gov.br com o Assistente.",
  },
  {
    icon: FileText,
    titulo: "Emita a Situação do Fornecedor",
    desc: "Dentro do portal, gere o PDF da Situação do Fornecedor do seu cadastro SICAF e salve no computador.",
  },
  {
    icon: Upload,
    titulo: "Envie o PDF aqui",
    desc: "Volte a esta página e anexe o arquivo na área Situação do Fornecedor (PDF).",
  },
  {
    icon: Sparkles,
    titulo: "Níveis atualizados",
    desc: "A IA lê o documento e sincroniza os níveis I a VI no seu painel — você acompanha o progresso em tempo real.",
  },
] as const;

export function hasSeenAssistenteOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markAssistenteOnboardingSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComecar?: () => void;
};

export function AssistenteOnboardingModal({ open, onOpenChange, onComecar }: Props) {
  const confirmar = () => {
    markAssistenteOnboardingSeen();
    onOpenChange(false);
    onComecar?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid w-[calc(100%-1.5rem)] max-h-[min(92dvh,36rem)] max-w-md grid-rows-[auto_1fr_auto] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="shrink-0 border-b bg-gradient-to-br from-primary/15 via-background to-accent/30 px-5 py-4">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg leading-tight">
                Como atualizar seu SICAF por aqui
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-xs leading-relaxed sm:text-sm">
                Primeiro acesse o portal pelo botão{" "}
                <span className="font-semibold text-foreground">Acessar SICAF</span> (canto superior
                direito). Depois envie aqui o PDF da{" "}
                <span className="font-medium text-foreground">Situação do Fornecedor</span> para
                atualizar os níveis do cadastro.
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">Botão no topo da página, à direita:</p>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-accent-green px-2.5 py-1 text-[11px] font-semibold text-accent-green-foreground shadow-sm">
              <Bot className="h-3.5 w-3.5" />
              Acessar SICAF
            </span>
          </div>

          {PASSOS.map((passo, i) => {
            const Icon = passo.icon;
            return (
              <div
                key={passo.titulo}
                className="flex gap-2.5 rounded-lg border bg-card/80 p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Passo {i + 1}
                  </p>
                  <p className="text-sm font-semibold leading-snug">{passo.titulo}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                    {passo.desc}
                  </p>
                </div>
              </div>
            );
          })}

          <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            <p>
              Depois do envio, as bolinhas dos níveis ficam coloridas conforme forem validadas. Você
              pode reenviar sempre que renovar certidões ou atualizar o cadastro no portal.
            </p>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t bg-muted/20 px-5 py-3 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Lembrar depois
          </Button>
          <Button className="gap-2" onClick={confirmar}>
            <Upload className="h-4 w-4" />
            Entendi, vamos começar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
