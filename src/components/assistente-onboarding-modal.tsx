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
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="border-b bg-gradient-to-br from-primary/15 via-background to-accent/30 px-6 py-5">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl leading-tight">
                Como atualizar seu SICAF por aqui
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm leading-relaxed">
                Primeiro acesse o portal pelo botão{" "}
                <span className="font-semibold text-foreground">Acessar SICAF</span> (canto superior
                direito). Depois envie aqui o PDF da{" "}
                <span className="font-medium text-foreground">Situação do Fornecedor</span> para
                atualizar os níveis do cadastro.
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-3 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Botão no topo da página, à direita:
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-accent-green px-3 py-1.5 text-xs font-semibold text-accent-green-foreground shadow-sm">
              <Bot className="h-3.5 w-3.5" />
              Acessar SICAF
            </span>
          </div>

          {PASSOS.map((passo, i) => {
            const Icon = passo.icon;
            return (
              <div
                key={passo.titulo}
                className="flex gap-3 rounded-xl border bg-card/80 p-3.5"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Passo {i + 1}
                  </p>
                  <p className="text-sm font-semibold">{passo.titulo}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {passo.desc}
                  </p>
                </div>
              </div>
            );
          })}

          <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2.5 text-xs text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <p>
              Depois do envio, as bolinhas dos níveis ficam coloridas conforme forem validadas. Você
              pode reenviar sempre que renovar certidões ou atualizar o cadastro no portal.
            </p>
          </div>
        </div>

        <DialogFooter className="border-t bg-muted/20 px-6 py-4 sm:justify-between">
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
