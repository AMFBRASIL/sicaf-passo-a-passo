import type { ReactNode } from "react";
import { Download, FileArchive, Hash, MonitorUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ACESSO_REMOTO_DOWNLOAD_URL } from "@/lib/acesso-remoto-download";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: Download,
    title: "Baixe o app de suporte",
    desc: "Faça o download do aplicativo CADBRASIL Remoto no botão abaixo.",
  },
  {
    icon: FileArchive,
    title: "Abra o arquivo dentro do ZIP",
    desc: "Após o download, extraia o ZIP e clique no executável para iniciar o app.",
  },
  {
    icon: Hash,
    title: "Informe o ID ao agente",
    desc: "O app gera um ID. Passe esse código para o agente CADBRASIL que está falando com você.",
  },
] as const;

type Props = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
};

export function AcessoRemotoModal({ open, onOpenChange, trigger }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="overflow-hidden border-0 p-0 sm:max-w-2xl lg:max-w-3xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-red-700 via-red-600 to-rose-700 px-6 pb-8 pt-7 text-white sm:px-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-black/10 blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/90">
              <MonitorUp className="h-3.5 w-3.5" />
              CADBRASIL Remoto
            </div>
            <DialogTitle className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
              Como iniciar o Acesso Remoto
            </DialogTitle>
            <DialogDescription className="mt-2 max-w-xl text-sm text-white/85 sm:text-base">
              Siga os 3 passos abaixo para o atendente conectar com segurança na sua tela.
            </DialogDescription>
          </div>
        </div>

        <div className="space-y-5 bg-white px-6 py-6 sm:px-8 sm:py-7">
          <ol className="space-y-3">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.title}
                  className={cn(
                    "flex gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4",
                    "transition hover:border-red-200/80 hover:bg-red-50/40",
                  )}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-600 text-sm font-bold text-white shadow-sm shadow-red-600/25">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-red-600" />
                      <p className="font-semibold text-slate-900">{step.title}</p>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.desc}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Fique com o WhatsApp ou chamada aberta com o agente enquanto o app estiver em execução.
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Arquivo seguro · Windows · fornecido pela equipe CADBRASIL
            </p>
            <Button
              asChild
              size="lg"
              className="h-12 gap-2 bg-red-600 px-6 text-base font-semibold text-white shadow-md shadow-red-600/25 hover:bg-red-700 hover:text-white"
            >
              <a href={ACESSO_REMOTO_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
                <Download className="h-5 w-5" />
                Acessar Suporte Remoto
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
