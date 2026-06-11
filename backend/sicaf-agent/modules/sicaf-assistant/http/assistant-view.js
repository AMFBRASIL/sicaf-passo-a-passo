/**
 * Gerador do HTML do painel do Assistente SICAF.
 * Retorna HTML completo com CSS + JS inline para o painel lateral.
 */
const config = require('../../../config');

function buildAssistantHTML() {
  const ASSISTANT_PORT = config.sicaf.assistantPort;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Assistente Cadbrasil - Orientador gratuito para SICAF</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif;background:#f8fafc;height:100vh;display:flex;flex-direction:column;overflow:hidden}

/* ═══ HEADER ═══ */
.hd{background:linear-gradient(135deg,#071D41,#1351B4);padding:14px 16px;color:#fff;flex-shrink:0}
.hd-top{display:flex;align-items:center;gap:10px}
.hd .logo{font-size:28px}
.hd h2{font-size:15px;font-weight:700;flex:1}
.hd .badge{font-size:9px;background:rgba(255,255,255,.15);padding:2px 8px;border-radius:10px}
.hd-client{margin-top:8px;display:none;padding:10px 12px;background:rgba(255,255,255,.1);border-radius:10px;border:1px solid rgba(255,255,255,.12)}
.hd-client.show{display:flex;align-items:center;gap:10px}
.hd-avatar{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.hd-info{overflow:hidden;flex:1}
.hd-name{font-size:13px;font-weight:700;line-height:1.3;word-wrap:break-word;white-space:normal}
.hd-doc{font-size:12px;opacity:.9;font-family:'Courier New',monospace;margin-top:2px;font-weight:600;letter-spacing:.3px}
.hd-tipo{font-size:10px;opacity:.65;margin-top:2px}

/* ═══ PROGRESS ═══ */
.prog{height:3px;background:#e2e8f0;flex-shrink:0}.prog .fill{height:100%;background:linear-gradient(90deg,#10B981,#059669);transition:width .6s ease;width:0%}

/* ═══ STEP INFO ═══ */
.step-bar{padding:8px 14px;background:#EFF6FF;border-bottom:1px solid #e2e8f0;flex-shrink:0;font-size:12px;color:#1351B4;font-weight:600;display:flex;align-items:center;gap:8px}
.step-bar .icon{font-size:14px}

/* ═══ CHECKLIST ═══ */
.cl-wrap{padding:10px 14px;background:#fff;border-bottom:1px solid #e8e8e8;flex-shrink:0;display:none}
.cl-wrap.show{display:block}
.cl-title{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;margin-bottom:6px;font-weight:700}
.ck{display:flex;align-items:center;gap:8px;padding:3px 0;font-size:12px;color:#94a3b8}
.ck.done{color:#059669}.ck.done .ci{background:#10B981;color:#fff}
.ck.now{color:#1351B4;font-weight:600}.ck.now .ci{background:#1351B4;color:#fff}
.ci{width:20px;height:20px;border-radius:50%;background:#e8e8e8;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0}

/* ═══ CHAT ═══ */
.chat{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.chat::-webkit-scrollbar{width:5px}
.chat::-webkit-scrollbar-thumb{background:#ccc;border-radius:3px}

.msg{padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.6;word-wrap:break-word;max-width:92%;animation:fadeIn .25s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.msg-sys{background:#f1f5f9;color:#64748b;font-size:11px;text-align:center;border-radius:12px;align-self:center;padding:5px 12px}
.msg-user{background:#1351B4;color:#fff;align-self:flex-end;border-radius:12px 12px 2px 12px}
.msg-ai{background:#fff;color:#1a202c;border:1px solid #e2e8f0;align-self:flex-start;border-radius:12px 12px 12px 2px}
.msg-ai strong{color:#1351B4}
.msg-err{background:#FEF2F2;color:#991B1B;font-size:12px;border-radius:12px;align-self:center;padding:6px 12px}
.msg-action{background:#EFF6FF;color:#1351B4;font-size:11px;border-radius:8px;align-self:center;padding:4px 10px}
.msg-debug{background:#0f172a;color:#93c5fd;font-size:10px;border:1px solid #1e293b;border-radius:8px;align-self:stretch;padding:5px 8px;font-family:Consolas,Monaco,monospace;line-height:1.45}

/* ═══ INPUT ═══ */
.input-area{padding:8px 12px;border-top:1px solid #e2e8f0;display:flex;gap:6px;flex-shrink:0;background:#fff}
.input-area.locked .input-lock{display:block}.input-area.locked input,.input-area.locked button{display:none}
.input-area:not(.locked) .input-lock{display:none}
.input-lock{width:100%;text-align:center;font-size:12px;color:#94a3b8;padding:8px 0}
.input-area input{flex:1;border:1.5px solid #d1d5db;border-radius:10px;padding:9px 14px;font-size:13px;outline:none;font-family:inherit;transition:border .2s}
.input-area input:focus{border-color:#1351B4;box-shadow:0 0 0 2px rgba(19,81,180,.12)}
.input-area button{width:38px;height:38px;border:none;background:linear-gradient(135deg,#1351B4,#071D41);color:#fff;border-radius:10px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity .2s}
.input-area button:disabled{opacity:.35;cursor:not-allowed}

/* ═══ FOOTER ═══ */
.ft{padding:6px 14px;text-align:center;border-top:1px solid #e8e8e8;flex-shrink:0;background:#fff}
.ft-brand{font-size:9px;color:#a0aec0;margin-bottom:4px}
.ft-links{display:flex;align-items:center;justify-content:center;gap:8px}
.ft-btn{display:flex;align-items:center;gap:3px;font-size:10px;text-decoration:none;color:#64748b;padding:2px 8px;border-radius:6px;cursor:pointer;border:1px solid #e2e8f0;background:#fff;transition:all .15s}
.ft-btn:hover{background:#f0f4ff}
.ft-btn.wpp{color:#25D366;border-color:#25D366}
.ft-btn.email{color:#1351B4;border-color:#1351B4}

.typing{display:inline-block;width:6px;height:6px;border-radius:50%;background:#1351B4;animation:blink 1.2s infinite;margin-right:4px}
.typing:nth-child(2){animation-delay:.2s}.typing:nth-child(3){animation-delay:.4s}
@keyframes blink{0%,80%,100%{opacity:.3}40%{opacity:1}}

/* ═══ ALERTA DOCUMENTOS ═══ */
.doc-alert{display:none;margin:0 14px 8px;padding:12px 14px;background:linear-gradient(135deg,#FFF7ED,#FFFBEB);border:1.5px solid #F59E0B;border-radius:12px;animation:fadeIn .3s ease}
.doc-alert.show{display:block}
.doc-alert-header{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.doc-alert-header .alert-icon{font-size:22px}
.doc-alert-header .alert-title{font-size:13px;font-weight:700;color:#92400E}
.doc-alert-close{margin-left:auto;background:none;border:none;font-size:16px;cursor:pointer;color:#92400E;opacity:.6;padding:0 4px}
.doc-alert-close:hover{opacity:1}
.doc-alert-body{font-size:12px;color:#78350F;line-height:1.6}
.doc-alert-body ul{margin:6px 0 8px 18px}
.doc-alert-body li{margin-bottom:3px}
.doc-alert-body .highlight{background:#FEF3C7;padding:1px 6px;border-radius:4px;font-weight:600}
.doc-alert-btn{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:7px 14px;background:linear-gradient(135deg,#F59E0B,#D97706);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s}
.doc-alert-btn:hover{transform:translateY(-1px);box-shadow:0 2px 8px rgba(245,158,11,.4)}

/* ═══ DOC ALERT READY STATE ═══ */
.doc-alert.ready{background:linear-gradient(135deg,#ECFDF5,#F0FDF4)!important;border-color:#10B981!important}
.doc-alert.ready .alert-title{color:#059669!important}
.doc-alert.ready .alert-icon{font-size:22px}
.doc-alert.ready .doc-alert-body{color:#065F46}
.doc-alert.ready .doc-alert-close{color:#059669}
.doc-alert.ready .doc-alert-btn{background:linear-gradient(135deg,#10B981,#059669)}

/* ═══ DOC ACTION BUTTONS ═══ */
.doc-alert-actions{display:flex;gap:8px;margin-top:10px}
.doc-action-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 12px;background:#fff;border:1.5px solid #D1D5DB;border-radius:8px;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;color:#374151;transition:all .2s}
.doc-action-btn:hover:not(.done):not(.loading){border-color:#1351B4;color:#1351B4;background:#EFF6FF}
.doc-action-btn.loading{opacity:.8;cursor:wait;border-color:#F59E0B;background:#FFFBEB}
.doc-action-btn.done{background:#ECFDF5;border-color:#10B981;color:#059669;cursor:default}
.doc-action-btn .doc-action-icon{font-size:16px;flex-shrink:0}
.doc-action-spinner{display:inline-block;width:14px;height:14px;border:2px solid #F59E0B;border-top-color:transparent;border-radius:50%;animation:s .6s linear infinite}

/* ═══ BOTÃO ANEXAR ═══ */
.btn-attach{width:38px;height:38px;border:1.5px solid #d1d5db;background:#fff;color:#64748b;border-radius:10px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s;position:relative}
.btn-attach:hover{border-color:#1351B4;color:#1351B4;background:#EFF6FF}
.btn-attach:disabled{opacity:.35;cursor:not-allowed}
.btn-attach input[type=file]{position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;cursor:pointer}
.upload-progress{font-size:11px;color:#64748b;padding:4px 12px;text-align:center;display:none}
.upload-progress.show{display:block}
.msg-file{background:#EFF6FF;color:#1351B4;font-size:12px;border-radius:10px;align-self:flex-end;padding:8px 12px;display:flex;align-items:center;gap:8px}
.msg-file .file-icon{font-size:20px}
</style>
</head>
<body>

<div class="hd">
  <div class="hd-top">
    <span class="logo">🤖</span>
    <h2>Assistente Cadbrasil - Orientador gratuito para SICAF</h2>
    <span class="badge">IA + Cadbrasil</span>
  </div>
  <div class="hd-client" id="client-info">
    <div class="hd-avatar">👤</div>
    <div class="hd-info">
      <div class="hd-name" id="cl-name">—</div>
      <div class="hd-doc" id="cl-doc">—</div>
      <div class="hd-tipo" id="cl-tipo"></div>
    </div>
  </div>
</div>
<div class="prog"><div class="fill" id="prog"></div></div>
<div class="step-bar"><span class="icon" id="step-icon">🏛️</span> <span id="step-text">Aguardando...</span></div>

<div class="cl-wrap show" id="cl-wrap">
  <div class="cl-title">Etapas do Login</div>
  <div id="checklist"></div>
</div>

<div class="doc-alert" id="doc-alert">
  <div class="doc-alert-header">
    <span class="alert-icon">📋</span>
    <span class="alert-title">Documentos Necessários — Nível IV</span>
    <button class="doc-alert-close" id="doc-alert-close" title="Fechar">✕</button>
  </div>
  <div class="doc-alert-body">
    Para analisarmos as <span class="highlight">certidões e níveis SICAF</span> do fornecedor, obtenha o documento abaixo diretamente do SICAF:
    <ul>
      <li>📄 <strong>Situação do Fornecedor</strong></li>
    </ul>
    Clique no botão abaixo. Após obter, salve como PDF e use <strong>"Anexar"</strong> para enviar à IA.
  </div>
  <div class="doc-alert-actions" id="doc-alert-actions">
    <button class="doc-action-btn" id="btn-obter-situacao">
      <span class="doc-action-icon">🔍</span>
      <span class="doc-action-text">Obter Situação</span>
    </button>
  </div>
  <button class="doc-alert-btn" id="doc-alert-attach" style="display:none">📎 Anexar Documento Agora</button>
</div>

<div class="chat" id="chat"></div>

<div class="upload-progress" id="upload-progress"></div>
<div class="input-area locked" id="input-area">
  <div class="input-lock">🔒 Chat IA disponível após o login</div>
  <div class="btn-attach" id="btn-attach" title="Anexar CRC ou Situação do Fornecedor (PDF)">
    📎<input type="file" id="file-input" accept=".pdf,.png,.jpg,.jpeg" />
  </div>
  <input type="text" id="chat-input" placeholder="Pergunte sobre o SICAF..." />
  <button id="chat-send" title="Enviar">➤</button>
</div>

<div class="ft">
  <div class="ft-brand">Assistente Virtual IA - Cadbrasil Gratuito para SICAF<br>Assistente Educacional para Regularização no SICAF</div>
  <div class="ft-links">
    <a class="ft-btn wpp" href="https://wa.me/551121220202" target="_blank">📱 WhatsApp</a>
    <a class="ft-btn email" href="#" id="copy-email">✉ E-mail</a>
  </div>
</div>

<script>
var API = 'http://localhost:${ASSISTANT_PORT}';
var chat = document.getElementById('chat');
var chatInput = document.getElementById('chat-input');
var chatSend = document.getElementById('chat-send');
var inputArea = document.getElementById('input-area');
var prog = document.getElementById('prog');
var stepIcon = document.getElementById('step-icon');
var stepText = document.getElementById('step-text');
var clWrap = document.getElementById('cl-wrap');
var clDiv = document.getElementById('checklist');
var clientInfo = document.getElementById('client-info');

var chatEnabled = false;
var aiResponding = false;
var currentStep = '';
var checklistIdx = -1;
var LOCAL_CHAT_DEBUG = /localhost|127\.0\.0\.1/i.test(window.location.hostname) ||
  /localhost|127\.0\.0\.1/i.test(API);
function _debugString(v) {
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch (_) { return String(v); }
}
function _escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function dbg() {
  if (!LOCAL_CHAT_DEBUG) return;
  var args = [].slice.call(arguments);
  try { console.log.apply(console, ['[SICAF Chat][DEBUG]'].concat(args)); } catch (_) {}
  try {
    var stamp = new Date().toLocaleTimeString('pt-BR');
    var line = args.map(_debugString).join(' | ');
    addMsg('debug', _escapeHtml('[' + stamp + '] ' + line));
  } catch (_) {}
}
dbg('Debug local ativo.', { api: API, host: window.location.hostname });

var LOGIN_STEPS = ['Acessar o portal SICAF','Entrar com Gov.br','Certificado Digital','Autenticação','Painel do fornecedor'];
var STEP_MAP = {
  welcome:{idx:0,prog:5,icon:'⏳',label:'Iniciando assistente...',msg:'🤖 Aguardando o portal Gov oficial Conectar para te ajudar...'},
  sicaf_home:{idx:1,prog:16,icon:'🏛️',label:'Portal CADBRASIL Auxilio ao SICAF',msg:'👉 Clique em <strong>"Entrar com gov.br"</strong>'},
  gov_login:{idx:2,prog:32,icon:'🔐',label:'Gov.br — Login',msg:'👉 Selecione <strong>"Certificado Digital"</strong>'},
  cert_select:{idx:4,prog:60,icon:'🪪',label:'Certificado',msg:'🪪 Selecione o certificado digital'},
  processing:{idx:5,prog:72,icon:'⏳',label:'Autenticando...',msg:'⏳ Aguarde a autenticação...'},
  logged_in:{idx:5,prog:85,icon:'✅',label:'Login OK!',msg:'⏳ Carregando painel...'},
  dashboard:{idx:6,prog:100,icon:'📊',label:'Painel de Assistente Cadbrasil - Orientador gratuito',msg:'✅ Login concluído!'}
};

function renderCL(activeIdx) {
  var h = '';
  for (var i = 0; i < LOGIN_STEPS.length; i++) {
    var cls = i < activeIdx ? 'done' : i === activeIdx ? 'now' : '';
    var icon = i < activeIdx ? '✓' : (i + 1);
    h += '<div class="ck ' + cls + '"><div class="ci">' + icon + '</div>' + LOGIN_STEPS[i] + '</div>';
  }
  clDiv.innerHTML = h;
}
renderCL(0);

function addMsg(type, html) {
  var div = document.createElement('div');
  div.className = 'msg msg-' + type;
  div.innerHTML = html;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

function setStep(step) {
  lastStepTime = Date.now();
  if (step === currentStep) return;
  currentStep = step;
  dbg('Mudança de step:', step);

  var nivelMap = {
    nivel_1: {icon:'📋',label:'Nível I — Credenciamento'},
    nivel_2: {icon:'📜',label:'Nível II — Habilitação Jurídica'},
    nivel_3: {icon:'🏦',label:'Nível III — Regularidade Fiscal Federal'},
    nivel_4: {icon:'🏛️',label:'Nível IV — Regularidade Fiscal Estadual/Municipal'},
    nivel_5: {icon:'🔧',label:'Nível V — Qualificação Técnica'},
    nivel_6: {icon:'💰',label:'Nível VI — Qualificação Econômico-Financeira'},
    crc: {icon:'📑',label:'CRC — Certificado de Registro Cadastral'},
    situacao_fornecedor: {icon:'🔍',label:'Situação do Fornecedor'},
  };

  var nivel = nivelMap[step];
  if (nivel) {
    prog.style.width = '100%';
    stepIcon.textContent = nivel.icon;
    stepText.textContent = nivel.label;
    clWrap.classList.remove('show');
    enableChat();
    if (step === 'nivel_4') showDocAlert(true);
    return;
  }

  var s = STEP_MAP[step];
  if (!s) return;
  prog.style.width = s.prog + '%';
  stepIcon.textContent = s.icon;
  stepText.textContent = s.label;
  renderCL(s.idx);
  if (s.msg && step !== 'dashboard') addMsg('sys', s.msg);
  if (step === 'dashboard') goDashboard();
}

function goDashboard() {
  clWrap.classList.remove('show');
  enableChat();
  addMsg('ai', '📊 <strong>Painel Cadbrasil - Assistente do SICAF carregado!</strong><br><br>Estou pronto para te ajudar. Pergunte qualquer coisa:<br><br>• "Como preencher o Nível I?"<br>• "Abra o Cadastro"<br>• "O que preciso para Habilitação Jurídica?"<br>• "Como obter o meu CRC"<br>• "Atualizar meu SICAF agora"');
}

function setClientData(data) {
  if (!data) return;
  var hasAny = false;
  if (data.nome) { document.getElementById('cl-name').textContent = data.nome; hasAny = true; }
  if (data.doc) {
    var label = data.doc.indexOf('/') >= 0 ? 'CNPJ' : 'CPF';
    document.getElementById('cl-doc').textContent = label + ': ' + data.doc;
    hasAny = true;
  }
  if (data.tipo) { document.getElementById('cl-tipo').textContent = data.tipo; }
  if (hasAny) {
    clientInfo.classList.add('show');
    if (currentStep === 'dashboard' && data.nome && chat.children.length <= 2) {
      addMsg('ai', '👤 <strong>' + data.nome + '</strong>' + (data.doc ? '<br><span style="opacity:.7">' + data.doc + '</span>' : '') + '<br><br>Como posso ajudar?');
    }
  }
}

function enableChat() {
  if (chatEnabled) return;
  chatEnabled = true;
  inputArea.classList.remove('locked');
  chatInput.focus();
}

function formatMd(t) {
  return t
    .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
    .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
    .replace(/\`(.+?)\`/g, '<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:12px">$1</code>')
    .replace(/\\n/g, '<br>');
}

async function sendMsg() {
  var text = chatInput.value.trim();
  if (!text || aiResponding || !chatEnabled) return;
  dbg('Enviando mensagem do usuário:', text);

  // Interceptar "Situação do Fornecedor" e "Atualizar meu SICAF" → mostrar painel de documentos
  var lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if ((lower.includes('situacao') && lower.includes('fornecedor')) || (lower.includes('atualizar') && lower.includes('sicaf'))) {
    addMsg('user', text);
    chatInput.value = '';
    showDocAlert(true);
    return;
  }

  addMsg('user', text);
  chatInput.value = '';
  aiResponding = true;
  chatSend.disabled = true;

  var typingDiv = addMsg('ai', '<span class="typing"></span><span class="typing"></span><span class="typing"></span>');

  try {
    dbg('POST /chat iniciado');
    var res = await fetch(API + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    dbg('POST /chat status:', res.status);
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var aiText = '';
    var started = false;

    while (true) {
      var r = await reader.read();
      if (r.done) break;
      var chunk = decoder.decode(r.value, { stream: true });
      var lines = chunk.split('\\n');
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.indexOf('data: ') !== 0) continue;
        var d = line.substring(6);
        if (d === '[DONE]') continue;
        try {
          var parsed = JSON.parse(d);
          if (parsed.chunk) {
            if (!started) { typingDiv.innerHTML = ''; started = true; }
            aiText += parsed.chunk;
            typingDiv.innerHTML = formatMd(aiText.replace(/\\[AÇÃO:.*?\\]/g, ''));
            chat.scrollTop = chat.scrollHeight;
          }
          if (parsed.done) {
            var cleanText = (parsed.fullText || aiText).replace(/\\[AÇÃO:.*?\\]/g, '');
            typingDiv.innerHTML = formatMd(cleanText);
            dbg('Resposta final IA recebida.', { actions: parsed.actions || [] });
            if (parsed.actions && parsed.actions.length) {
              for (var a = 0; a < parsed.actions.length; a++) {
                addMsg('action', '⚡ Executando: ' + parsed.actions[a]);
              }
            }
          }
        } catch(e2) {}
      }
    }
    if (!started) typingDiv.innerHTML = formatMd(aiText || '(sem resposta)');
  } catch(e) {
    dbg('Erro sendMsg:', e);
    typingDiv.innerHTML = '';
    addMsg('err', '⚠ Erro: ' + e.message);
  }
  aiResponding = false;
  chatSend.disabled = false;
  chatInput.focus();
}

chatSend.addEventListener('click', sendMsg);
chatInput.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) sendMsg(); });

var fileInput = document.getElementById('file-input');
var uploadProgress = document.getElementById('upload-progress');

fileInput.addEventListener('change', async function() {
  var file = fileInput.files[0];
  if (!file || !chatEnabled) { fileInput.value = ''; return; }
  dbg('Upload iniciado:', file ? { name: file.name, size: file.size, type: file.type } : null);

  var maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    addMsg('err', '⚠ Arquivo muito grande (máx 10MB)');
    fileInput.value = '';
    return;
  }

  var ext = file.name.split('.').pop().toUpperCase();
  var icon = ext === 'PDF' ? '📄' : '🖼️';
  addMsg('file', '<span class="file-icon">' + icon + '</span><div><strong>' + file.name + '</strong><br><span style="opacity:.6;font-size:10px">' + (file.size / 1024).toFixed(0) + ' KB</span></div>');

  uploadProgress.textContent = '📤 Enviando arquivo para análise...';
  uploadProgress.classList.add('show');
  aiResponding = true;
  chatSend.disabled = true;

  try {
    var formData = new FormData();
    formData.append('file', file);

    var res = await fetch(API + '/upload', { method: 'POST', body: formData });
    var result = await res.json();
    dbg('POST /upload retorno:', result);

    uploadProgress.textContent = '🤖 IA analisando documento...';

    if (result.error) {
      addMsg('err', '⚠ ' + result.error);
    } else {
      var aiDiv = addMsg('ai', '<span class="typing"></span><span class="typing"></span><span class="typing"></span>');

      var analyzeRes = await fetch(API + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: result.prompt })
      });
      dbg('POST /chat (analise PDF) status:', analyzeRes.status);
      var reader = analyzeRes.body.getReader();
      var decoder = new TextDecoder();
      var aiText = '';
      var started = false;

      while (true) {
        var r = await reader.read();
        if (r.done) break;
        var chunk = decoder.decode(r.value, { stream: true });
        var lines = chunk.split('\\n');
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i];
          if (line.indexOf('data: ') !== 0) continue;
          var d = line.substring(6);
          if (d === '[DONE]') continue;
          try {
            var parsed = JSON.parse(d);
            if (parsed.chunk) {
              if (!started) { aiDiv.innerHTML = ''; started = true; }
              aiText += parsed.chunk;
              aiDiv.innerHTML = formatMd(aiText.replace(/\\[AÇÃO:.*?\\]/g, ''));
              chat.scrollTop = chat.scrollHeight;
            }
            if (parsed.done) {
              var cleanText = (parsed.fullText || aiText).replace(/\\[AÇÃO:.*?\\]/g, '');
              aiDiv.innerHTML = formatMd(cleanText);
            }
          } catch(e2) {}
        }
      }
      if (!started) aiDiv.innerHTML = formatMd(aiText || '(sem resposta)');
    }
  } catch(e) {
    dbg('Erro upload/análise:', e);
    addMsg('err', '⚠ Erro no upload: ' + e.message);
  }

  uploadProgress.classList.remove('show');
  aiResponding = false;
  chatSend.disabled = false;
  fileInput.value = '';
  chatInput.focus();
});

document.getElementById('copy-email').addEventListener('click', function(e) {
  e.preventDefault();
  navigator.clipboard.writeText('documentos@fornecedordigital.com.br').then(function() {
    e.target.textContent = '✓ Copiado!';
    setTimeout(function() { e.target.innerHTML = '✉ E-mail'; }, 2000);
  });
});

var docAlert = document.getElementById('doc-alert');
var docAlertClose = document.getElementById('doc-alert-close');
var docAlertAttach = document.getElementById('doc-alert-attach');
var docAlertShown = false;

var situacaoObtida = false;

function showDocAlert(show) {
  if (show) {
    docAlert.classList.add('show');
    if (!docAlertShown) {
      docAlertShown = true;
      addMsg('sys', '📋 Clique em <strong>"Obter CRC"</strong> e <strong>"Obter Situação"</strong> para buscar os documentos do SICAF. Após obter ambos, salve como PDF e envie para análise.');
    }
  }
}

docAlertClose.addEventListener('click', function() { docAlert.classList.remove('show'); });
docAlertAttach.addEventListener('click', function() { fileInput.click(); });

document.getElementById('btn-obter-situacao').addEventListener('click', function() {
  obterDocumento('btn-obter-situacao', 'abrir_situacao_fornecedor', 'Situação do Fornecedor');
});

async function obterDocumento(btnId, action, label) {
  var btn = document.getElementById(btnId);
  if (btn.classList.contains('done') || btn.classList.contains('loading')) return;

  btn.classList.add('loading');
  var iconEl = btn.querySelector('.doc-action-icon');
  var textEl = btn.querySelector('.doc-action-text');
  var origIcon = iconEl.textContent;
  var origText = textEl.textContent;
  iconEl.innerHTML = '<span class="doc-action-spinner"></span>';
  textEl.textContent = 'Obtendo...';

  addMsg('action', '⚡ Navegando para ' + label + ' no SICAF...');

  try {
    dbg('Executando ação manual:', { action: action, label: label });
    var res = await fetch(API + '/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action })
    });
    var result = await res.json();
    dbg('Retorno /action:', result);

    if (result.ok) {
      btn.classList.remove('loading');
      btn.classList.add('done');
      iconEl.textContent = '✅';
      textEl.textContent = 'Situação Obtida';
      situacaoObtida = true;

      addMsg('sys', '✅ <strong>' + label + '</strong> obtido com sucesso! Salve o documento como PDF e clique em <strong>"Anexar"</strong> para enviar.');
      // Transformar painel para estado "pronto para upload"
      docAlert.classList.add('ready');
      document.querySelector('.doc-alert-header .alert-icon').textContent = '✅';
      document.querySelector('.doc-alert-header .alert-title').textContent = 'Documento Obtido — Enviar para Análise';
      document.querySelector('.doc-alert-body').innerHTML =
        '<strong>Situação do Fornecedor</strong> obtida com sucesso!<br>' +
        'Salve o documento como PDF (se ainda não salvou) e clique no botão abaixo para enviar à IA.';
      document.getElementById('doc-alert-actions').style.display = 'none';
      document.getElementById('doc-alert-attach').style.display = 'inline-flex';
    } else {
      btn.classList.remove('loading');
      iconEl.textContent = origIcon;
      textEl.textContent = origText;
      addMsg('err', '⚠ Erro ao obter ' + label + ': ' + (result.error || 'Falha na navegação'));
    }
  } catch(e) {
    btn.classList.remove('loading');
    iconEl.textContent = origIcon;
    textEl.textContent = origText;
    addMsg('err', '⚠ Erro de conexão: ' + e.message);
  }
}

// (verificarAmbosObtidos removido — agora só Situação do Fornecedor é necessária)

// SSE + Fallback polling
var lastStepTime = Date.now();

// Fallback: se SSE não enviar nada em 4s, consultar /status diretamente
setInterval(function() {
  if (Date.now() - lastStepTime > 4000) {
    fetch(API + '/status').then(function(r) { return r.json(); }).then(function(d) {
      if (d.step && d.step !== currentStep) setStep(d.step);
    }).catch(function() {});
  }
}, 4000);

var es = new EventSource(API + '/events');
dbg('EventSource conectado em /events');
es.onmessage = function(e) {
  try {
    var data = JSON.parse(e.data);
    dbg('SSE evento recebido:', data.type, data);
    if (data.type === 'step') setStep(data.step);
    if (data.type === 'client-data') setClientData(data.data);
    if (data.type === 'action-done') {
      if (data.action === 'abrir_situacao_fornecedor' && !situacaoObtida) {
        situacaoObtida = true;
        var sitBtn = document.getElementById('btn-obter-situacao');
        if (sitBtn) {
          sitBtn.classList.remove('loading');
          sitBtn.classList.add('done');
          sitBtn.querySelector('.doc-action-icon').textContent = '✅';
          sitBtn.querySelector('.doc-action-text').textContent = 'Situação Obtida';
        }
      }
    }
    if (data.type === 'processing' && data.message) {
      addMsg('sys', '⏳ ' + data.message);
    }
    if (data.type === 'db-saved' && data.data) {
      var d = data.data;
      var niveisHtml = '';
      if (d.sicafStatus && d.sicafStatus.niveis) {
        var niveis = d.sicafStatus.niveis;
        var nivelKeys = Object.keys(niveis);
        if (nivelKeys.length > 0) {
          niveisHtml = '<br><strong>📊 Níveis SICAF atualizados:</strong><br>';
          var nivelIcons = { 'Regular': '✅', 'Válido': '✅', 'Vencendo': '⚠️', 'Vencido': '❌', 'Parcial': '🟡', 'Pendente': '⚪', 'Não informado': '⚪' };
          for (var nk in niveis) {
            var nv = niveis[nk];
            var statusText = nv.status || nv.situacao || '—';
            var ni = nivelIcons[statusText] || '✅';
            var desc = nv.descricao ? ' — ' + nv.descricao : '';
            if (nv.cobertas !== undefined) {
              niveisHtml += '&nbsp;&nbsp;' + ni + ' Nível ' + nk + ': <strong>' + statusText + '</strong> (' + nv.cobertas + '/' + nv.total + ')' + desc + '<br>';
            } else {
              niveisHtml += '&nbsp;&nbsp;' + ni + ' Nível ' + nk + ': <strong>' + statusText + '</strong>' + desc + '<br>';
            }
          }
        }
      }
      var statusBadge = '';
      if (d.sicafStatus && d.sicafStatus.status) {
        var badgeColors = { 'Ativo': '#10B981', 'Vencendo': '#F59E0B', 'Vencido': '#EF4444', 'Pendente': '#6B7280' };
        var bc = badgeColors[d.sicafStatus.status] || '#6B7280';
        statusBadge = '<br><span style="display:inline-block;padding:3px 10px;border-radius:12px;background:' + bc + ';color:#fff;font-size:11px;font-weight:700">' + d.sicafStatus.status + ' — ' + (d.sicafStatus.completude || 0) + '% completo</span>';
      }
      addMsg('sys', '💾 <strong>Dados salvos no sistema CadBrasil!</strong><br>' +
        '• Cliente: <strong>' + (d.clienteNome || 'N/A') + '</strong><br>' +
        '• CNPJ: <strong>' + d.cnpj + '</strong><br>' +
        '• ' + (d.certidoesInserted || 0) + ' certidões inseridas, ' + (d.certidoesUpdated || 0) + ' atualizadas' +
        niveisHtml + statusBadge);
    }
    if (data.type === 'db-error' && data.data) {
      addMsg('sys', '⚠️ <strong>Erro ao salvar dados:</strong> ' + (data.data.message || 'Erro desconhecido'));
    }
    if (data.type === 'restart') {
      // Logout detectado — limpar chat e resetar UI
      chat.innerHTML = '';
      currentStep = 'sicaf_home';
      renderCL(0);
      situacaoObtida = false;
      var sitBtn = document.getElementById('btn-obter-situacao');
      if (sitBtn) {
        sitBtn.classList.remove('done', 'loading');
        sitBtn.querySelector('.doc-action-icon').textContent = '🔍';
        sitBtn.querySelector('.doc-action-text').textContent = 'Obter Situação';
      }
      // Cliente data
      var clientEl = document.getElementById('client-info');
      if (clientEl) clientEl.innerHTML = '<span style="color:#94a3b8">Aguardando login...</span>';
      addMsg('sys', '🔄 <strong>Sessão encerrada.</strong> O assistente está reiniciando automaticamente...');
      addMsg('sys', '🔐 Faça login novamente no portal Gov.br para continuar.');
    }
  } catch(x) {}
};
es.onerror = function(err) {
  dbg('SSE error:', err);
};

addMsg('sys', '🤖 Assistente Digital SICAF iniciado');
</script>
</body>
</html>`;
}

/**
 * HTML da tela de boas-vindas (loading inicial).
 */
function buildWelcomeHTML() {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Agente Digital CADBRASIL</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:linear-gradient(135deg,#071D41,#1351B4,#155BCB);min-height:100vh;display:flex;align-items:center;justify-content:center;color:#fff}
.c{text-align:center;max-width:520px;padding:40px;animation:f .8s ease}@keyframes f{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}
.logo{font-size:72px;margin-bottom:28px;filter:drop-shadow(0 4px 20px rgba(0,0,0,.3))}h1{font-size:34px;font-weight:800;margin-bottom:10px;letter-spacing:-.5px}
.sub{font-size:16px;opacity:.7;margin-bottom:32px;line-height:1.5}
.ld{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:16px}
.sp{width:20px;height:20px;border:2.5px solid rgba(255,255,255,.25);border-top-color:#fff;border-radius:50%;animation:s .6s linear infinite}
@keyframes s{to{transform:rotate(360deg)}}.ld span{font-size:14px;opacity:.7}
.pb{width:100%;height:4px;background:rgba(255,255,255,.12);border-radius:2px;overflow:hidden;margin-bottom:20px}
.pi{height:100%;background:#fff;border-radius:2px;animation:l 3s ease-in-out forwards}@keyframes l{from{width:0}to{width:100%}}
.badge{display:inline-block;background:rgba(255,255,255,.1);padding:6px 18px;border-radius:20px;font-size:11px}
</style></head><body><div class="c"><div class="logo">🤖</div><h1>Agente Digital CADBRASIL</h1>
<p class="sub">Assistente inteligente para cadastro SICAF<br>com IA integrada</p>
<div class="pb"><div class="pi"></div></div>
<div class="ld"><div class="sp"></div><span>Carregando portal SICAF oficial do governo...</span></div>
<div class="ld"><div class="sp"></div><span>A CADBRASIL não possui vínculo com o Governo Federal ou com o portal Compras.gov. A ferramenta é meramente orientativa</span></div>
<div class="badge">🔒 Conexão segura</div></div></body></html>`;
}

module.exports = { buildAssistantHTML, buildWelcomeHTML };
