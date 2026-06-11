import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ViaCepResponse = {
  erro?: boolean;
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cep: string }> },
) {
  const { cep: cepRaw } = await params;
  const cep = String(cepRaw || "").replace(/\D/g, "");

  if (cep.length !== 8) {
    return NextResponse.json(
      { success: false, error: "CEP deve ter 8 dígitos." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 },
    });
    const data = (await response.json()) as ViaCepResponse;

    if (data.erro) {
      return NextResponse.json(
        { success: false, error: "CEP não encontrado." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        cep: data.cep || formatCep(cep),
        logradouro: data.logradouro || "",
        complemento: data.complemento || "",
        bairro: data.bairro || "",
        cidade: data.localidade || "",
        estado: data.uf || "",
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Erro ao consultar CEP" },
      { status: 500 },
    );
  }
}

function formatCep(digits: string): string {
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
