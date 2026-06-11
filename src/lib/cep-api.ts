export type CepConsulta = {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
};

export function formatCepInput(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function formatCepDisplay(cep?: string | null): string {
  if (!cep) return "";
  const d = cep.replace(/\D/g, "");
  if (d.length !== 8) return cep;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function enderecoFromCep(data: CepConsulta): string {
  const parts: string[] = [];
  if (data.logradouro) parts.push(data.logradouro);
  if (data.bairro) parts.push(data.bairro);
  return parts.join(", ");
}

export async function fetchCep(cep: string): Promise<{
  ok: boolean;
  error?: string;
  data?: CepConsulta;
}> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) {
    return { ok: false, error: "CEP deve ter 8 dígitos" };
  }

  try {
    const res = await fetch(`/api/cep/${digits}`);
    const json = (await res.json()) as {
      success?: boolean;
      error?: string;
      data?: CepConsulta;
    };
    if (!json.success || !json.data) {
      return { ok: false, error: json.error || "CEP não encontrado" };
    }
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, error: "Erro de conexão ao consultar CEP" };
  }
}
