/**
 * Serviço de navegação e detecção de estado do portal SICAF.
 * Detecta em qual tela o usuário está e executa ações (clicar nível, navegar menu, etc.).
 */
const { sleep } = require('../../../utils/helpers');
const { NIVEL_URLS } = require('../constants');

// ═══════════════════════════════════════════════════════════════════════════════
// DETECÇÃO DE ESTADO DA PÁGINA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detecta o estado atual da página SICAF (em qual tela o usuário está).
 * @param {import('puppeteer').Page} page
 * @returns {Object} { step, url, text, clientData }
 */
async function detectPageState(page) {
  try {
    const result = await page.evaluate(() => {
      const url = location.href;
      const fullText = document.body ? document.body.innerText : '';
      const bodyText = fullText.toLowerCase();
      let step = 'unknown';
      let clientData = null;

      // SICAF logado
      if ((url.includes('sicaf-web') || url.includes('comprasnet.gov.br/sicaf')) && !url.includes('acesso.gov.br')) {
        if (bodyText.includes('sair') || bodyText.includes('logout') || bodyText.includes('credenciamento') || bodyText.includes('nível')) {
          step = 'dashboard';

          // Detectar nível específico pela URL
          var nivelMatch = url.match(/manterNivel(\d)/);
          if (nivelMatch) step = 'nivel_' + nivelMatch[1];
          else if (url.includes('consultarCRC')) step = 'crc';
          else if (url.includes('consultarFornecedor')) step = 'situacao_fornecedor';

          // ═══ Ler dados do cliente ═══
          let nome = '';
          let doc = '';
          let tipo = '';

          const cpfMatch = fullText.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
          const cnpjMatch = fullText.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
          if (cnpjMatch) doc = cnpjMatch[1];
          else if (cpfMatch) doc = cpfMatch[1];

          if (fullText.includes('Fornecedor Brasileiro')) tipo = 'Fornecedor Brasileiro';
          else if (fullText.includes('Fornecedor Estrangeiro')) tipo = 'Fornecedor Estrangeiro';

          // Nome: linhas em MAIÚSCULAS
          const lines = fullText.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (trimmed.length < 5 || trimmed.length > 80) continue;
            if (/^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ\s\-\.\/\&]+$/.test(trimmed)) {
              const blocklist = ['SICAF', 'SISTEMA', 'CADASTRO', 'UNIFICADO', 'GOVERNO', 'FEDERAL', 'CREDENCIAMENTO', 'MENU', 'CONSULTA', 'SEGURANÇA'];
              if (!blocklist.some((w) => trimmed.includes(w))) {
                nome = trimmed;
                break;
              }
            }
          }

          // Fallback nome: linha antes/depois do CNPJ/CPF
          if (!nome && doc) {
            for (let j = 0; j < lines.length; j++) {
              if (lines[j].includes(doc)) {
                if (j > 0) {
                  const prev = lines[j - 1].trim();
                  if (prev.length >= 5 && prev.length <= 80) { nome = prev; break; }
                }
                if (j < lines.length - 1) {
                  const next = lines[j + 1].trim();
                  if (next.length >= 5 && next.length <= 80) { nome = next; break; }
                }
                break;
              }
            }
          }

          // Fallback nome: elementos específicos do SICAF
          if (!nome) {
            const possibleEls = document.querySelectorAll('.ui-outputlabel, .ui-outputtext, span[id*="nome"], span[id*="razao"], td');
            for (const el of possibleEls) {
              const t = (el.textContent || '').trim();
              if (t.length >= 5 && t.length <= 80 && t === t.toUpperCase() && /[A-Z]/.test(t)) {
                const blocklist = ['SICAF', 'SISTEMA', 'CADASTRO', 'CREDENCIAMENTO'];
                if (!blocklist.some((w) => t.includes(w))) {
                  nome = t;
                  break;
                }
              }
            }
          }

          if (doc || nome) {
            clientData = { nome, doc, tipo };
          }
        } else {
          step = 'sicaf_home';
        }
      }
      // Gov.br
      else if (url.includes('acesso.gov.br')) {
        if (document.querySelector('.h-captcha') || document.querySelector('iframe[src*="hcaptcha"]')) {
          step = 'captcha';
        } else if (bodyText.includes('aguarde') || bodyText.includes('redirecionando') || url.includes('authorize')) {
          step = 'processing';
        } else {
          step = 'gov_login';
        }
      }

      return { step, url, text: fullText.substring(0, 1500), clientData };
    });
    return result;
  } catch (e) {
    return { step: 'unknown', url: '', text: '', clientData: null };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AÇÕES PRIMEFACES (CLICAR BOTÕES DO SICAF)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clica no botão PrimeFaces "Pesquisar" ou "Relatório" na página.
 */
async function clickPrimeFacesButton(page, buttonText, maxAttempts = 8) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const clicked = await page.evaluate((text) => {
        const pesquisarById = document.querySelector(
          'button[id*="btnPesquisar"], button[id*="btnRelatorio"], button[id*="btnConsultar"]'
        );
        if (pesquisarById) {
          const spanText = pesquisarById.querySelector('span.ui-button-text');
          if (spanText && spanText.textContent.trim() === text) {
            pesquisarById.click();
            return 'id: ' + pesquisarById.id;
          }
        }

        const spans = document.querySelectorAll('span.ui-button-text.ui-c, span.ui-button-text');
        for (const span of spans) {
          if (span.textContent.trim() === text) {
            const btn = span.closest('button[type="submit"], button, a, [role="button"]') || span.parentElement;
            if (btn) { btn.click(); return 'span: ' + (btn.id || btn.className); }
          }
        }

        const buttons = document.querySelectorAll('button, input[type="submit"], a.ui-button');
        for (const btn of buttons) {
          const btnText = (btn.textContent || btn.value || '').trim();
          if (btnText === text || btnText.includes(text)) {
            btn.click();
            return 'btn: ' + (btn.id || btnText);
          }
        }

        return null;
      }, buttonText);

      if (clicked) {
        console.log(`    ✔ Clicou "${buttonText}" (${clicked}) — tentativa ${attempt}`);
        return true;
      }
    } catch (_) {}

    if (attempt < maxAttempts) {
      await sleep(1500);
    }
  }
  console.log(`    ⚠ Botão "${buttonText}" não encontrado após ${maxAttempts} tentativas`);
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUÇÃO DE AÇÕES DO ASSISTENTE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Executa uma ação no portal SICAF (navegar para nível, abrir CRC, etc.).
 * @param {import('puppeteer').Page} page
 * @param {string} action - Nome da ação (ex: 'clicar_nivel_1', 'abrir_crc')
 */
async function executeAction(page, action) {
  console.log(`  [AÇÃO] ${action}`);
  try {
    // ═══ Ações que NAVEGAM para outra página ═══
    if (action.startsWith('clicar_nivel_')) {
      const nivel = action.replace('clicar_nivel_', '').trim();
      const nivelUrl = NIVEL_URLS[nivel];
      if (!nivelUrl) return;

      await page.evaluate((nivel, nivelUrl) => {
        const link = document.querySelector('a[href*="manterNivel' + nivel + '"]');
        if (link) link.click();
        else location.href = location.origin + nivelUrl;
      }, nivel, nivelUrl);

      try { await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }); } catch (_) {}
      await sleep(2000);
      await clickPrimeFacesButton(page, 'Pesquisar');
      return;
    }

    if (action === 'abrir_crc') {
      await page.evaluate(() => {
        const link = document.querySelector('a[href*="consultarCRC"]');
        if (link) link.click();
      });
      try { await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }); } catch (_) {}
      await sleep(2000);
      await clickPrimeFacesButton(page, 'Relatório');
      return;
    }

    if (action === 'abrir_situacao_fornecedor') {
      // Passo 1: Clicar no menu "Consulta"
      await page.evaluate(() => {
        const links = document.querySelectorAll('a');
        for (const link of links) {
          if (link.innerText.trim() === 'Consulta') { link.click(); return; }
        }
      });
      await sleep(1500);

      // Passo 2: Clicar no submenu "Situação do Fornecedor"
      const navOk = await page.evaluate(() => {
        const links = document.querySelectorAll('a');
        for (const link of links) {
          const text = link.innerText.trim().toLowerCase();
          if (text.includes('situação do fornecedor') || text.includes('situacao do fornecedor')) {
            link.click();
            return true;
          }
        }
        const byHref = document.querySelector('a[href*="consultarSituacaoFornecedor"], a[href*="situacaoFornecedor"], a[href*="consultarFornecedor"]');
        if (byHref) { byHref.click(); return true; }
        return false;
      });

      if (navOk) {
        try { await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }); } catch (_) {}
        await sleep(2000);
        await clickPrimeFacesButton(page, 'Pesquisar');
        await sleep(3000);

        // Passo 4: Clicar no link "Situação do Fornecedor" na tabela
        for (let attempt = 1; attempt <= 6; attempt++) {
          try {
            const clicked = await page.evaluate(() => {
              const byId = document.querySelector('a[id*="detalharLink"]');
              if (byId) { byId.click(); return 'id: ' + byId.id; }

              const links = document.querySelectorAll('a.ui-commandlink, a.linkButton');
              for (const link of links) {
                const spans = link.querySelectorAll('span');
                for (const span of spans) {
                  if (span.textContent.trim() === 'Situação do Fornecedor') {
                    link.click();
                    return 'span: ' + (link.id || link.className);
                  }
                }
              }
              return null;
            });
            if (clicked) {
              console.log(`    ✔ Clicou "Situação do Fornecedor" (${clicked}) — tentativa ${attempt}`);
              break;
            }
          } catch (_) {}
          if (attempt < 6) await sleep(1500);
        }
      }
      return;
    }

    // ═══ Ações simples (sem navegação) ═══
    await page.evaluate((action) => {
      function clickMenuLink(menuText) {
        const links = document.querySelectorAll('a');
        for (const link of links) {
          if (link.innerText.trim() === menuText) { link.click(); return; }
        }
      }
      if (action === 'navegar_cadastro') clickMenuLink('Cadastro');
      else if (action === 'navegar_consulta') clickMenuLink('Consulta');
      else if (action === 'navegar_seguranca' || action === 'navegar_segurança') clickMenuLink('Segurança');
      else if (action === 'navegar_sicaf') location.href = 'https://www3.comprasnet.gov.br/sicaf-web/index.jsf';
    }, action);
  } catch (e) {
    console.log(`  [AÇÃO] Erro: ${e.message.substring(0, 80)}`);
  }
}

module.exports = {
  detectPageState,
  clickPrimeFacesButton,
  executeAction,
};
