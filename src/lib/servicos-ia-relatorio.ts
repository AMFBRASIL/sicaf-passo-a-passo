import type { ResultadoIA } from "@/lib/servicos-ia-api";

export type ServicosIaRelatorioMeta = {
  moduloTitulo: string;
  moduloId: string;
  objetivoTitulo?: string;
  arquivoNome?: string;
  perguntaCliente?: string;
  geradoEm?: Date;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function formatMarkdownBasic(raw: string): string {
  const lines = raw.split("\n");
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }
    if (trimmed.startsWith("## ")) {
      closeList();
      out.push(`<h2>${escapeHtml(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith("### ")) {
      closeList();
      out.push(`<h3>${escapeHtml(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (!inList) {
        out.push('<ul class="analysis-list">');
        inList = true;
      }
      out.push(`<li>${inlineMarkdown(escapeHtml(trimmed.slice(2)))}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inlineMarkdown(escapeHtml(trimmed))}</p>`);
  }
  closeList();
  return out.join("\n");
}

function metricToneClass(tom: "ok" | "warn" | "info"): string {
  if (tom === "ok") return "metric-ok";
  if (tom === "warn") return "metric-warn";
  return "metric-info";
}

function formatDateBr(date: Date): string {
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildServicosIaRelatorioHtml(
  meta: ServicosIaRelatorioMeta,
  resultado: ResultadoIA,
): string {
  const geradoEm = meta.geradoEm ?? new Date();
  const corpo =
    resultado.corpoCompleto?.trim() ||
    resultado.pontos.map((p) => `## ${p.titulo}\n\n${p.texto}`).join("\n\n");

  const metricasHtml = resultado.metricas
    .map(
      (m) => `
      <div class="metric ${metricToneClass(m.tom)}">
        <span class="metric-label">${escapeHtml(m.label)}</span>
        <span class="metric-value">${escapeHtml(m.valor)}</span>
      </div>`,
    )
    .join("");

  const contextoItems = [
    meta.objetivoTitulo ? `<li><strong>Objetivo:</strong> ${escapeHtml(meta.objetivoTitulo)}</li>` : "",
    meta.arquivoNome ? `<li><strong>Documento:</strong> ${escapeHtml(meta.arquivoNome)}</li>` : "",
    meta.perguntaCliente
      ? `<li><strong>Pedido do cliente:</strong> ${escapeHtml(meta.perguntaCliente)}</li>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(resultado.titulo)} — CADBRASIL</title>
  <style>
    :root {
      --brand: #0d9488;
      --brand-dark: #0f766e;
      --ink: #0f172a;
      --muted: #64748b;
      --border: #e2e8f0;
      --bg: #f8fafc;
      --card: #ffffff;
      --ok: #059669;
      --warn: #d97706;
      --info: #2563eb;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      color: var(--ink);
      background: linear-gradient(160deg, #f0fdfa 0%, #f8fafc 45%, #eff6ff 100%);
      line-height: 1.6;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 24px;
      background: rgba(255,255,255,0.92);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border);
    }
    .toolbar-title { font-size: 13px; font-weight: 600; color: var(--muted); }
    .btn-print {
      appearance: none;
      border: none;
      border-radius: 10px;
      padding: 10px 18px;
      font-size: 14px;
      font-weight: 600;
      color: #fff;
      background: linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 100%);
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(13,148,136,0.25);
    }
    .btn-print:hover { filter: brightness(1.05); }
    .page {
      max-width: 860px;
      margin: 0 auto;
      padding: 32px 24px 56px;
    }
    .hero {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 32px;
      box-shadow: 0 20px 50px rgba(15,23,42,0.06);
      margin-bottom: 24px;
    }
    .badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--brand-dark);
      background: #ccfbf1;
      padding: 6px 10px;
      border-radius: 999px;
      margin-bottom: 14px;
    }
    h1 {
      margin: 0 0 10px;
      font-size: 28px;
      line-height: 1.2;
      letter-spacing: -0.02em;
    }
    .lead {
      margin: 0;
      font-size: 16px;
      color: var(--muted);
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-top: 22px;
    }
    .meta-item {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 12px;
      color: var(--muted);
    }
    .meta-item strong { display: block; color: var(--ink); font-size: 13px; margin-bottom: 2px; }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }
    .metric {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 18px;
    }
    .metric-ok { border-color: rgba(5,150,105,0.35); background: #ecfdf5; }
    .metric-warn { border-color: rgba(217,119,6,0.35); background: #fffbeb; }
    .metric-info { border-color: rgba(37,99,235,0.2); background: #eff6ff; }
    .metric-label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 6px;
    }
    .metric-value { font-size: 22px; font-weight: 700; }
    .panel {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 28px 32px;
      box-shadow: 0 12px 40px rgba(15,23,42,0.04);
      margin-bottom: 24px;
    }
    .panel h2.section-title {
      margin: 0 0 18px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .context-list {
      margin: 0;
      padding-left: 18px;
      color: var(--ink);
      font-size: 14px;
    }
    .context-list li { margin-bottom: 8px; }
    .analysis h2 {
      margin: 28px 0 10px;
      font-size: 20px;
      color: var(--brand-dark);
    }
    .analysis h2:first-child { margin-top: 0; }
    .analysis h3 {
      margin: 20px 0 8px;
      font-size: 16px;
      color: var(--ink);
    }
    .analysis p {
      margin: 0 0 12px;
      font-size: 14px;
      color: #334155;
    }
    .analysis-list {
      margin: 0 0 14px 0;
      padding-left: 20px;
      color: #334155;
      font-size: 14px;
    }
    .analysis-list li { margin-bottom: 6px; }
    .footer {
      text-align: center;
      font-size: 11px;
      color: var(--muted);
      padding: 8px 0 24px;
    }
    .footer strong { color: var(--ink); }
    @media print {
      body { background: #fff; }
      .toolbar { display: none !important; }
      .page { padding: 0; max-width: none; }
      .hero, .panel, .metric { box-shadow: none; break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="toolbar-title">Relatório CADBRASIL — pronto para impressão ou salvar como PDF</span>
    <button class="btn-print" type="button" onclick="window.print()">Imprimir / Salvar PDF</button>
  </div>

  <main class="page">
    <header class="hero">
      <span class="badge">${escapeHtml(meta.moduloTitulo)}</span>
      <h1>${escapeHtml(resultado.titulo)}</h1>
      <p class="lead">${escapeHtml(resultado.resumo)}</p>
      <div class="meta-grid">
        <div class="meta-item"><strong>Gerado em</strong>${escapeHtml(formatDateBr(geradoEm))}</div>
        <div class="meta-item"><strong>Serviço</strong>${escapeHtml(meta.moduloTitulo)}</div>
        <div class="meta-item"><strong>Plataforma</strong>CADBRASIL — Serviços IA</div>
      </div>
    </header>

    <section class="metrics">${metricasHtml}</section>

    ${
      contextoItems
        ? `<section class="panel">
      <h2 class="section-title">Contexto da análise</h2>
      <ul class="context-list">${contextoItems}</ul>
    </section>`
        : ""
    }

    <section class="panel analysis">
      <h2 class="section-title">Relatório completo</h2>
      ${formatMarkdownBasic(corpo)}
    </section>

    <footer class="footer">
      <p><strong>CADBRASIL</strong> — Consultoria em licitações e SICAF</p>
      <p>Documento gerado automaticamente por IA. Revise antes de decisões contratuais ou protocolos oficiais.</p>
    </footer>
  </main>
</body>
</html>`;
}

export function openServicosIaRelatorioPreview(
  meta: ServicosIaRelatorioMeta,
  resultado: ResultadoIA,
): boolean {
  const html = buildServicosIaRelatorioHtml(meta, resultado);
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  return true;
}
