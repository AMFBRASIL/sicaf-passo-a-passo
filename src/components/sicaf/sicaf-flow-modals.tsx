import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PagamentoSicafModal } from "@/components/pagamento-sicaf-modal";
import { PagamentosPendentesWizard } from "@/components/pagamentos-pendentes-wizard";
import { SelecionarEmpresaModal } from "@/components/selecionar-empresa-modal";
import { CertificadoUploadWizard } from "@/components/certificado-upload-wizard";
import { UploadNiveisModal } from "@/components/upload-niveis-modal";
import {
  AssistenteDialog,
  AssistenteRodandoDialog,
} from "@/components/sicaf/sicaf-step-dialogs";
import type { SicafFlow } from "@/hooks/use-sicaf-flow";
import { toast } from "sonner";

type Props = {
  flow: SicafFlow;
  onSelectEmpresa: (cnpj: string) => void;
};

export function SicafFlowModals({ flow, onSelectEmpresa }: Props) {
  const { cliente } = flow;
  if (!cliente) return null;

  return (
    <>
      <UploadNiveisModal
        open={flow.modalAberto === 2}
        onOpenChange={(v) => !v && flow.setModalAberto(null)}
        clienteId={cliente.clienteId}
        empresaNome={cliente.nome}
        empresaCnpj={cliente.cnpj}
        onConcluido={flow.concluirEtapa}
      />
      <AssistenteDialog
        open={flow.modalAberto === 3}
        onOpenChange={(v) => !v && flow.setModalAberto(null)}
        onConcluido={flow.concluirEtapa}
      />
      <AssistenteRodandoDialog
        open={flow.modalAberto === 4}
        onOpenChange={(v) => !v && flow.setModalAberto(null)}
        onConcluido={flow.concluirEtapa}
        onIniciar={() => {
          void flow.openSICAF();
        }}
        titulo="Atualizar Nível III — Receita Federal"
        subtitulo="O Assistente CADBRASIL vai acessar o Compras.gov.br e atualizar os documentos federais."
        etapas={[
          "Acessando Compras.gov.br",
          "Consultando documentos do Nível III na Receita Federal",
          "Baixando certidões negativas atualizadas",
          "Anexando ao seu cadastro SICAF",
          "Validando atualização junto ao sistema",
        ]}
      />
      <AssistenteRodandoDialog
        open={flow.modalAberto === 5}
        onOpenChange={(v) => !v && flow.setModalAberto(null)}
        onConcluido={flow.concluirEtapa}
        onIniciar={() => {
          void flow.openSICAF();
        }}
        titulo="Atualizar Nível IV — Qualificação técnica"
        subtitulo="O assistente vai consolidar e enviar seus documentos de qualificação técnica."
        etapas={[
          "Conferindo CNAEs cadastrados na Receita Federal",
          "Validando atestados e documentos técnicos",
          "Preenchendo formulário de qualificação no Compras.gov.br",
          "Confirmando envio do Nível IV",
        ]}
      />
      <AssistenteRodandoDialog
        open={flow.modalAberto === 6}
        onOpenChange={(v) => !v && flow.setModalAberto(null)}
        onConcluido={flow.concluirEtapa}
        onIniciar={() => {
          void flow.openSICAF();
        }}
        titulo="Validar e enviar"
        subtitulo="Última etapa! Confirmação final e ativação do seu SICAF."
        etapas={[
          "Revisando todos os níveis cadastrados",
          "Gerando comprovante de inscrição",
          "Confirmando ativação no SICAF",
        ]}
      />

      <CertificadoUploadWizard
        open={flow.certificadoModal}
        onOpenChange={flow.setCertificadoModal}
        clienteId={cliente.clienteId}
        onConcluido={(cert) => {
          flow.setCertificado(cert);
          flow.concluirEtapa();
          toast.success("Certificado digital validado e cadastrado.");
        }}
      />

      <Dialog open={flow.renovacaoModal} onOpenChange={flow.setRenovacaoModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <RefreshCw className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-xl">Renovar SICAF</DialogTitle>
            <DialogDescription className="text-center">
              Vamos reativar o SICAF de{" "}
              <span className="font-semibold text-foreground">{cliente.nome}</span>. O processo é
              idêntico ao cadastro inicial.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-muted/30 p-4 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Vencido em</span>
              <span className="font-semibold">{cliente.vencidoEm}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Taxa de renovação</span>
              <span className="font-semibold">{flow.valorRenovacaoFmt}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tempo estimado</span>
              <span className="font-semibold">Até 24h</span>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => flow.setRenovacaoModal(false)}>
              Cancelar
            </Button>
            <Button onClick={flow.iniciarRenovacao} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Iniciar renovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PagamentoSicafModal
        open={flow.pagamentoModal}
        onOpenChange={flow.setPagamentoModal}
        empresa={{ nome: cliente.nome, cnpj: cliente.cnpj, clienteId: cliente.clienteId }}
        onGerado={() => void flow.recarregar()}
        onPago={() => {
          flow.setPagamentoModal(false);
          flow.concluirEtapa();
        }}
      />
      <PagamentosPendentesWizard
        open={flow.pagamentosWizardOpen}
        onOpenChange={flow.setPagamentosWizardOpen}
        empresa={{ nome: cliente.nome, cnpj: cliente.cnpj, clienteId: cliente.clienteId }}
        onNovoPagamento={() => flow.setPagamentoModal(true)}
        onPago={() => {
          flow.setPagamentosWizardOpen(false);
          flow.concluirEtapa();
        }}
      />
      <SelecionarEmpresaModal
        open={flow.trocarEmpresaOpen}
        onOpenChange={flow.setTrocarEmpresaOpen}
        empresaAtualCnpj={cliente.cnpj}
        onSelect={(empresa) => onSelectEmpresa(empresa.cnpj)}
      />

      {flow.tudoConcluido && cliente.estado === "vencido" && !flow.renovando && (
        <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
          <button
            type="button"
            onClick={() => flow.setRenovacaoModal(true)}
            className="flex items-center gap-2 rounded-full bg-danger px-4 py-2 text-sm font-semibold text-danger-foreground shadow-lift hover:brightness-110 transition"
          >
            <AlertTriangle className="h-4 w-4" />
            SICAF Vencido · Renovar
          </button>
        </div>
      )}
    </>
  );
}
