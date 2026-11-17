import type { ClienteRelatorio } from "@/lib/relatorio-api";

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const raw = String(value).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return formatDateTime(value);
}

function formatMoney(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function buildRelatorioHtml(data: ClienteRelatorio) {
  const at = data.atualizacoesSicaf;
  const usoPct = at && at.limite > 0 ? Math.min(100, Math.round((at.usadas / at.limite) * 100)) : 0;
  const mira = data.licitacoes?.itensMira || [];

  const miraRows = mira.length
    ? mira
        .map(
          (item) => `
      <tr>
        <td>
          <div style="font-weight:600;margin-bottom:2px">${esc(item.titulo)}</div>
          <div style="color:#64748b;font-size:11px">${esc([item.orgao, item.uf].filter(Boolean).join(" · ") || `ID ${item.id}`)}</div>
        </td>
        <td style="white-space:nowrap">${esc(item.pipelineStatus === "vai_participar" ? "Vai participar" : "Na mira")}</td>
        <td style="white-space:nowrap">${esc(formatDate(item.dataEncerramento))}</td>
        <td style="white-space:nowrap;text-align:right">${esc(formatMoney(item.valorEstimado))}</td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="4" style="color:#64748b">Nenhuma licitação na mira.</td></tr>`;

  const ips = data.acessos?.ipsRecentes || [];
  const ipRows = ips.length
    ? ips
        .map(
          (row) => `
      <tr>
        <td style="font-family:ui-monospace,monospace">${esc(row.ip)}</td>
        <td>${esc([row.navegador, row.dispositivo].filter(Boolean).join(" · ") || "Sessão")}</td>
        <td style="white-space:nowrap">${esc(formatDateTime(row.em))}</td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="3" style="color:#64748b">Nenhum IP recente.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Inter, Segoe UI, Arial, sans-serif;
    color: #0f172a;
    background: #ffffff;
    width: 920px;
  }
  .wrap { padding: 28px; }
  .hero {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #064e3b 100%);
    color: #fff;
    border-radius: 18px;
    padding: 22px 24px;
  }
  .eyebrow {
    font-size: 11px;
    letter-spacing: .16em;
    text-transform: uppercase;
    color: #a7f3d0;
    font-weight: 700;
    margin: 0 0 8px;
  }
  .code {
    font-family: ui-monospace, Consolas, monospace;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: .06em;
    margin: 0;
  }
  .sub { margin: 8px 0 0; color: #cbd5e1; font-size: 13px; }
  .badges { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px; }
  .badge {
    display: inline-block;
    padding: 5px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    background: rgba(255,255,255,.12);
  }
  .note {
    margin-top: 14px;
    padding: 12px 14px;
    border-radius: 12px;
    background: rgba(255,255,255,.08);
    border: 1px solid rgba(255,255,255,.12);
    font-size: 13px;
    color: #e2e8f0;
    line-height: 1.45;
  }
  .kpis {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-top: 16px;
  }
  .kpi {
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 14px;
    background: #fff;
  }
  .kpi .l {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: #64748b;
    font-weight: 700;
  }
  .kpi .v {
    margin-top: 6px;
    font-size: 26px;
    font-weight: 800;
  }
  .kpi .h { margin-top: 4px; font-size: 11px; color: #64748b; }
  .grid {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 14px;
    margin-top: 16px;
  }
  .card {
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 14px 16px;
    background: #fff;
  }
  .card h2 {
    margin: 0 0 12px;
    font-size: 15px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  th, td {
    border-bottom: 1px solid #e2e8f0;
    padding: 8px 6px;
    text-align: left;
    vertical-align: top;
  }
  th {
    color: #64748b;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .06em;
  }
  .bar {
    height: 8px;
    background: #e2e8f0;
    border-radius: 999px;
    overflow: hidden;
    margin-top: 6px;
  }
  .bar > span {
    display: block;
    height: 100%;
    background: #059669;
    width: ${usoPct}%;
  }
  .mini {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 10px;
  }
  .mini > div {
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 10px;
  }
  .mini .l { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: .06em; }
  .mini .v { margin-top: 4px; font-size: 18px; font-weight: 700; }
  .foot {
    margin-top: 16px;
    text-align: center;
    color: #94a3b8;
    font-size: 11px;
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <p class="eyebrow">Código da licença</p>
      <p class="code">${esc(data.licenca?.codigo || "—")}</p>
      <p class="sub">${esc(data.empresa?.razaoSocial || data.empresa?.nomeFantasia || "")}${
        data.empresa?.documento ? ` · CNPJ ${esc(data.empresa.documento)}` : ""
      }</p>
      <div class="badges">
        <span class="badge">SICAF ${esc(data.licenca?.status || "—")}</span>
        <span class="badge">${data.manutencao?.ativa ? "Manutenção ativa" : "Sem manutenção"}</span>
        ${
          data.licenca?.dataValidade
            ? `<span class="badge">Válida até ${esc(formatDate(data.licenca.dataValidade))}${
                data.licenca.diasRestantes != null
                  ? ` · ${esc(data.licenca.diasRestantes)} dia(s)`
                  : ""
              }</span>`
            : ""
        }
      </div>
      <div class="note">
        <strong>Licença contratada.</strong>
        Este código identifica a licença anual CADBRASIL contratada pela sua empresa.
        Use-o como referência em suporte, contratos e validações de acesso.
        ${
          data.acessos?.ultimoAcesso
            ? `<br/><br/>Último IP: <strong>${esc(data.acessos.ultimoAcesso.ip || "—")}</strong>
               · ${esc(data.acessos.ultimoAcesso.navegador || "Navegador")}
               · ${esc(formatDateTime(data.acessos.ultimoAcesso.em))}`
            : ""
        }
      </div>
    </div>

    <div class="kpis">
      <div class="kpi">
        <div class="l">Acessos Licitações</div>
        <div class="v">${esc(data.licitacoes?.acessosTela ?? 0)}</div>
        <div class="h">${esc(data.licitacoes?.acessosTela30d ?? 0)} nos últimos 30 dias</div>
      </div>
      <div class="kpi">
        <div class="l">Na mira</div>
        <div class="v">${esc(data.licitacoes?.naMira ?? 0)}</div>
        <div class="h">${esc(data.licitacoes?.vaiParticipar ?? 0)} marcadas para participar</div>
      </div>
      <div class="kpi">
        <div class="l">Atualizações SICAF</div>
        <div class="v">${esc(at?.usadas ?? 0)}/${esc(at?.limite ?? 0)}</div>
        <div class="h">${
          at?.manutencaoAtiva
            ? "Ilimitadas com manutenção ativa"
            : `${esc(at?.restantes ?? 0)} gratuitas restantes`
        }</div>
      </div>
      <div class="kpi">
        <div class="l">Logins</div>
        <div class="v">${esc(data.acessos?.loginsSucesso ?? 0)}</div>
        <div class="h">${esc(data.acessos?.loginsTotal ?? 0)} tentativas registradas</div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h2>Licitações na mira</h2>
        <table>
          <thead>
            <tr>
              <th>Licitação</th>
              <th>Status</th>
              <th>Encerra</th>
              <th style="text-align:right">Valor</th>
            </tr>
          </thead>
          <tbody>${miraRows}</tbody>
        </table>
      </div>

      <div>
        <div class="card" style="margin-bottom:14px">
          <h2>Manutenção &amp; SICAF</h2>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b">
            <span>Atualizações pelo Assistente</span>
            <strong style="color:#0f172a">${esc(at?.usadas ?? 0)}/${esc(at?.limite ?? 0)}</strong>
          </div>
          <div class="bar"><span></span></div>
          <div class="mini">
            <div>
              <div class="l">Manutenção</div>
              <div class="v" style="font-size:14px">${data.manutencao?.ativa ? "Ativa" : "Não contratada"}</div>
            </div>
            <div>
              <div class="l">Detalhes abertos</div>
              <div class="v">${esc(data.licitacoes?.detalhesAbertos ?? 0)}</div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:14px">
          <h2>IPs de acesso</h2>
          <table>
            <thead>
              <tr><th>IP</th><th>Dispositivo</th><th>Quando</th></tr>
            </thead>
            <tbody>${ipRows}</tbody>
          </table>
        </div>

        <div class="card">
          <h2>Outros indicadores</h2>
          <div class="mini">
            <div><div class="l">Central SICAF</div><div class="v">${esc(data.usoPortal?.sicaf ?? 0)}</div></div>
            <div><div class="l">Assistente</div><div class="v">${esc(data.usoPortal?.assistente ?? 0)}</div></div>
            <div><div class="l">Documentos</div><div class="v">${esc(data.usoPortal?.documentos ?? 0)}</div></div>
            <div><div class="l">Tickets abertos</div><div class="v">${esc(data.usoPortal?.ticketsAbertos ?? 0)}</div></div>
          </div>
        </div>
      </div>
    </div>

    <p class="foot">Relatório gerado em ${esc(formatDateTime(data.geradoEm))} · CADBRASIL</p>
  </div>
</body>
</html>`;
}

async function canvasToPdf(canvas: HTMLCanvasElement, fileName: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;
  const imgWidth = usableWidth;
  const pageCanvasHeight = Math.max(1, Math.floor((usableHeight * canvas.width) / imgWidth));

  let rendered = 0;
  let page = 0;
  while (rendered < canvas.height) {
    if (page > 0) pdf.addPage();
    const sliceHeight = Math.min(pageCanvasHeight, canvas.height - rendered);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceHeight;
    const ctx = slice.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D indisponível");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, rendered, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
    const sliceImgHeight = (sliceHeight * imgWidth) / canvas.width;
    pdf.addImage(
      slice.toDataURL("image/jpeg", 0.93),
      "JPEG",
      margin,
      margin,
      imgWidth,
      sliceImgHeight,
      undefined,
      "FAST",
    );
    rendered += sliceHeight;
    page += 1;
    if (page > 40) break;
  }
  pdf.save(fileName);
}

/** Gera PDF fiel dos dados do relatório (HTML próprio, sem oklch do tema). */
export async function exportClienteRelatorioPdf(data: ClienteRelatorio, fileName: string) {
  if (!data?.ok) throw new Error("Relatório sem dados para exportar");

  const html2canvasMod = await import("html2canvas");
  const html2canvas = html2canvasMod.default || (html2canvasMod as unknown as typeof html2canvasMod.default);
  if (typeof html2canvas !== "function") {
    throw new Error("html2canvas não carregou corretamente");
  }

  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:920px;background:#fff;z-index:-1;pointer-events:none;";
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "relatorio-pdf");
  iframe.style.cssText = "width:920px;height:1400px;border:0;background:#fff;";
  host.appendChild(iframe);
  document.body.appendChild(host);

  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("Não foi possível preparar o documento do PDF");
    doc.open();
    doc.write(buildRelatorioHtml(data));
    doc.close();

    // aguarda layout
    await new Promise((r) => setTimeout(r, 80));
    const body = doc.body;
    const height = Math.max(body.scrollHeight, body.offsetHeight, 1200);
    iframe.style.height = `${height}px`;
    await new Promise((r) => setTimeout(r, 40));

    const canvas = await html2canvas(body, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: 920,
      windowWidth: 920,
      height,
      windowHeight: height,
    });

    await canvasToPdf(canvas, fileName);
  } finally {
    host.remove();
  }
}
