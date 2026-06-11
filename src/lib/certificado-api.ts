import { apiFetch } from "@/lib/api-fetch";

export type CertificadoDigitalInfo = {
  id: number;
  clienteId: number;
  arquivoNome: string;
  titularNome?: string | null;
  titularDocumento?: string | null;
  emissor?: string | null;
  validoDe?: string | null;
  validoAte?: string | null;
  validadoEm?: string | null;
  status: "valido" | "vencendo" | "expirado" | string;
  cadastrado?: boolean;
};

export async function fetchCertificadoDigital(clienteId: number): Promise<{
  ok: boolean;
  certificado?: CertificadoDigitalInfo | null;
  error?: string;
}> {
  const res = await apiFetch(`/api/clients/${clienteId}/certificado-digital`);
  const data = await res.json();
  if (!data.ok) {
    return { ok: false, error: data.error || "Erro ao carregar certificado" };
  }
  return { ok: true, certificado: (data.certificado as CertificadoDigitalInfo) || null };
}

export async function uploadCertificadoDigital(
  clienteId: number,
  arquivo: File,
  senha: string,
): Promise<{
  ok: boolean;
  error?: string;
  message?: string;
  certificado?: CertificadoDigitalInfo;
}> {
  const formData = new FormData();
  formData.append("file", arquivo);
  formData.append("senha", senha);

  const res = await apiFetch(`/api/clients/${clienteId}/certificado-digital`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!data.ok) {
    return { ok: false, error: data.error || "Erro ao validar certificado" };
  }
  return {
    ok: true,
    message: data.message,
    certificado: data.certificado as CertificadoDigitalInfo,
  };
}

export function certificadoEstaValido(cert?: CertificadoDigitalInfo | null): boolean {
  if (!cert?.cadastrado && !cert?.id) return false;
  return cert.status === "valido" || cert.status === "vencendo";
}

export function formatCertValidade(cert?: CertificadoDigitalInfo | null): string | null {
  if (!cert?.validoAte) return null;
  const d = new Date(cert.validoAte);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR");
}
