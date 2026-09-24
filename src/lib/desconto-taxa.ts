export type DescontoTipoCalculo = "percentual" | "valor" | "valor_final";

/** Mínimo aceito pela Efí para boleto — espelha VALOR_MINIMO_BOLETO no backend. */
export const VALOR_MINIMO_BOLETO = 5;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Mesma regra de backend/sicaf-agent/services/sicaf-desconto.service.js (calcularDesconto). */
export function calcularDescontoTaxa(valorCheio: number, tipo: DescontoTipoCalculo, input: number) {
  let final = valorCheio;
  if (tipo === "percentual") final = valorCheio - (valorCheio * input) / 100;
  else if (tipo === "valor") final = valorCheio - input;
  else final = input;
  final = round2(Math.min(valorCheio, Math.max(0, final)));
  const desconto = round2(valorCheio - final);
  const percentual = valorCheio > 0 ? round2((desconto / valorCheio) * 100) : 0;
  return { final, desconto, percentual };
}

export function erroDescontoTaxa(
  valorCheio: number,
  tipo: DescontoTipoCalculo,
  input: number,
  valorMinimo = VALOR_MINIMO_BOLETO,
): string | null {
  if (!input) return null;
  if (tipo === "percentual" && input >= 100) return "O percentual deve ser menor que 100%.";
  if (tipo === "valor_final" && input > valorCheio)
    return "O valor final não pode ser maior que o valor do plano.";
  const calc = calcularDescontoTaxa(valorCheio, tipo, input);
  if (calc.desconto <= 0) return "Esse valor não gera desconto.";
  if (calc.final < valorMinimo) {
    return `O boleto não pode ficar abaixo de ${valorMinimo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (mínimo da Efí).`;
  }
  return null;
}
