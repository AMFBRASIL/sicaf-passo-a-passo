import { apiFetch } from "@/lib/api-fetch";

export type RelatorioKey = "clientes" | "financeiro" | "sicaf" | "suporte" | "googleads";

export type RelatorioCard = {
  key: RelatorioKey;
  registros: number;
  ultimaGeracao: string | null;
  ultimaLabel: string;
};

export type RelatorioHistorico = {
  id: number;
  filename: string;
  formato: string;
  usuario: string;
  quando: string;
  quandoLabel: string;
  total: number | null;
  tipo: string;
};

export type GerarRelatorioOpts = {
  tipo: RelatorioKey;
  periodo?: string;
  dataIni?: string;
  dataFim?: string;
  formato?: "csv" | "xlsx" | "pdf";
  colunas?: string[];
  filtros?: Record<string, string>;
  agendado?: boolean;
  frequencia?: string;
  emails?: string;
};

export type RelatorioGerado = {
  ok: boolean;
  error?: string;
  tipo?: RelatorioKey;
  filename?: string;
  formato?: string;
  total?: number;
  headers?: string[];
  rows?: (string | number)[][];
  agendamentoErro?: string;
};

function escapeCsvCell(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsvContent(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(escapeCsvCell).join(";")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(";"));
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

function buildHtmlTable(title: string, headers: string[], rows: (string | number)[][]): string {
  const th = headers.map((h) => `<th>${h}</th>`).join("");
  const trs = rows
    .map((row) => `<tr>${row.map((c) => `<td>${String(c ?? "")}</td>`).join("")}</tr>`)
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px}table{border-collapse:collapse;width:100%;font-size:12px}
th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f4f4f5}</style></head>
<body><h1>${title}</h1><table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></body></html>`;
}

export function downloadRelatorio(
  data: Pick<RelatorioGerado, "filename" | "formato" | "headers" | "rows">,
): void {
  if (!data.headers?.length || !data.rows) return;
  const filename = data.filename || "relatorio.csv";
  const formato = data.formato || "csv";

  if (formato === "pdf") {
    const html = buildHtmlTable(filename, data.headers, data.rows);
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    }
    return;
  }

  const csv = buildCsvContent(data.headers, data.rows);
  const mime =
    formato === "xlsx"
      ? "application/vnd.ms-excel;charset=utf-8"
      : "text/csv;charset=utf-8";
  const blob = new Blob([csv], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function fetchAdminRelatorios(): Promise<{
  ok: boolean;
  error?: string;
  cards?: RelatorioCard[];
  historico?: RelatorioHistorico[];
  resumo?: { totalArquivos: number; tamanhoEstimadoMb: number };
}> {
  const res = await apiFetch("/api/admin/relatorios");
  return res.json();
}

export async function gerarRelatorio(opts: GerarRelatorioOpts): Promise<RelatorioGerado> {
  const res = await apiFetch("/api/admin/relatorios/gerar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...opts,
      emails: opts.emails,
    }),
  });
  return res.json();
}
