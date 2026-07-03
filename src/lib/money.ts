const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  
  export function parseRealToNumber(valor: string | number): number | null {
    if (typeof valor === "number") return valor;
    if (!valor || valor.trim() === "") return null;
    const normalized = valor
      .replace(/\s/g, "")
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".");
    const num = Number.parseFloat(normalized || "0");
    return Number.isNaN(num) ? null : num;
  }
  
  export function formatarReal(valor: string | number): string {
    const num = parseRealToNumber(valor);
    if (num === null) return "—";
    return currencyFormatter.format(num);
  }
  
  export function mascararInputReal(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    const cents = Number.parseInt(digits, 10);
    return currencyFormatter.format(cents / 100);
  }
  