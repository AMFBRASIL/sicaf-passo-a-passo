/**
 * Serviço reutilizável NFS-e Nacional (Emissor Público / SEFIN + ADN).
 *
 * Uso em qualquer parte do portal:
 *   const nfse = require('./nfse.service');
 *   await nfse.emitir({ useSystemCert: true, dps: {...} });
 *   await nfse.consultarPorChave({ chaveAcesso, clienteId });
 *
 * Docs oficiais:
 *   https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao
 *   Manual Contribuintes Emissor Público API v1.2
 */
const fs = require('fs');
const https = require('https');
const zlib = require('zlib');
const { URL } = require('url');
const forge = require('node-forge');

const NFSE_TABLE = 'nfse_emissoes';

/** Runtime cache (DB + .env) preenchido por refreshRuntime(). */
let _rt = null;

async function refreshRuntime(force = false) {
  const cfg = require('./nfse-config.service');
  _rt = await cfg.getNfseRuntime(force);
  return _rt;
}

function getAmbiente() {
  if (_rt) {
    return require('./nfse-config.service').getAmbienteFromRuntime(_rt);
  }
  const raw = String(process.env.NFSE_AMBIENTE || 'producaorestrita').toLowerCase().trim();
  if (raw === 'producao' || raw === 'prod' || raw === 'production') return 'producao';
  return 'producaorestrita';
}

function getBaseUrls(ambiente = getAmbiente()) {
  const sefinOverride = (_rt?.nfse_sefin_url || process.env.NFSE_SEFIN_URL || '').trim();
  const adnOverride = (_rt?.nfse_adn_contribuintes_url || process.env.NFSE_ADN_CONTRIBUINTES_URL || '').trim();
  const danfseOverride = (_rt?.nfse_danfse_url || process.env.NFSE_DANFSE_URL || '').trim();

  if (ambiente === 'producao') {
    return {
      ambiente: 'producao',
      sefin: (sefinOverride || 'https://sefin.nfse.gov.br/SefinNacional').replace(/\/$/, ''),
      adnContribuintes: (adnOverride || 'https://adn.nfse.gov.br/contribuintes').replace(/\/$/, ''),
      danfse: (danfseOverride || 'https://adn.nfse.gov.br/danfse').replace(/\/$/, ''),
    };
  }
  return {
    ambiente: 'producaorestrita',
    sefin: (
      sefinOverride || 'https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional'
    ).replace(/\/$/, ''),
    adnContribuintes: (
      adnOverride || 'https://adn.producaorestrita.nfse.gov.br/contribuintes'
    ).replace(/\/$/, ''),
    danfse: (danfseOverride || 'https://adn.producaorestrita.nfse.gov.br/danfse').replace(/\/$/, ''),
  };
}

async function getStatusConfig() {
  const rt = await refreshRuntime();
  const urls = getBaseUrls();
  const hasSystem = Boolean(
    (rt.nfse_cert_pfx_path && fs.existsSync(rt.nfse_cert_pfx_path)) ||
      rt.nfse_cert_pfx_base64 ||
      process.env.CERT_PFX_PATH,
  );
  return {
    ok: true,
    enabled: rt.nfse_enabled !== 'false',
    ambiente: urls.ambiente,
    configSource: rt._meta?.configSource || 'env',
    urls: {
      sefin: urls.sefin,
      adnContribuintes: urls.adnContribuintes,
      danfse: urls.danfse,
      swaggerSefin:
        urls.ambiente === 'producao'
          ? 'https://sefin.nfse.gov.br/SefinNacional/docs/index'
          : 'https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional/docs/index',
    },
    certificadoSistemaConfigurado: hasSystem,
  };
}

function gzipBase64(bufferOrString) {
  const input = Buffer.isBuffer(bufferOrString)
    ? bufferOrString
    : Buffer.from(String(bufferOrString), 'utf8');
  return zlib.gzipSync(input).toString('base64');
}

function gunzipBase64(b64) {
  const buf = Buffer.from(String(b64 || ''), 'base64');
  return zlib.gunzipSync(buf).toString('utf8');
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function padLeft(value, size, ch = '0') {
  const s = String(value ?? '');
  return s.length >= size ? s.slice(0, size) : ch.repeat(size - s.length) + s;
}

/**
 * TSDateTimeUTC do XSD nacional: AAAA-MM-DDThh:mm:ss±hh:00
 * (sem milissegundos; sem "Z"; offset em horas cheias).
 */
function formatDateTimeUtc(input) {
  if (typeof input === 'string') {
    const s = input.trim();
    // Já no formato aceito pelo pattern
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:00$/.test(s)) return s;
    // ISO com Z ou milissegundos → normaliza
    const parsed = Date.parse(s);
    if (!Number.isNaN(parsed)) input = new Date(parsed);
    else return s;
  }
  const d = input instanceof Date ? input : new Date();
  // Usa horário de Brasília (-03:00) — pattern só aceita minutos :00 no offset
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}-03:00`;
}

/**
 * Monta Id da DPS: DPS + cMun(7) + tpInsc(1) + CNPJ/CPF(14) + série(5) + nDPS(15)
 */
function buildDpsId({ cMun, tpInsc, inscricao, serie, nDPS }) {
  const insc = padLeft(onlyDigits(inscricao), 14, '0');
  return `DPS${padLeft(cMun, 7)}${tpInsc}${insc}${padLeft(serie, 5)}${padLeft(nDPS, 15)}`;
}

/**
 * Builder mínimo da DPS (XML nacional). Campos essenciais; municípios podem exigir extras.
 * Estrutura alinhada ao XSD v1.01 / exemplos SEFIN (locPrest, cServ, vServPrest/vServ, trib).
 * @param {object} dps
 */
function buildDpsXml(dps) {
  if (!dps || typeof dps !== 'object') {
    throw new Error('Dados da DPS inválidos');
  }

  const cMun = padLeft(onlyDigits(dps.cMun || dps.codigoMunicipio), 7);
  // Id: 1=CPF, 2=CNPJ (convenção oficial do Id da DPS)
  const tpInsc = String(
    dps.tpInscPrestador ||
      (onlyDigits(dps.cnpjPrestador || dps.prestador?.cnpj).length === 14 ? '2' : '1')
  );
  const inscricao = onlyDigits(dps.cnpjPrestador || dps.cpfPrestador || dps.prestador?.cnpj || dps.prestador?.cpf);
  const serie = padLeft(onlyDigits(dps.serie || '1') || '1', 5);
  // nDPS no XML: sem zeros à esquerda (TSNumDPS). No Id da DPS: 15 dígitos com pad.
  const nDPSRaw = onlyDigits(dps.nDPS || dps.numero || Date.now().toString().slice(-15)) || '1';
  const nDPS = String(Number(nDPSRaw) || 1); // remove leading zeros
  const nDPSId = padLeft(nDPS, 15);
  const id = dps.id || buildDpsId({ cMun, tpInsc, inscricao, serie, nDPS: nDPSId });

  const dhEmi = formatDateTimeUtc(dps.dhEmi || dps.dataEmissao || new Date());
  const dCompet = dps.dCompet || dps.competencia || dhEmi.slice(0, 10);
  const tpAmb = dps.tpAmb || (getAmbiente() === 'producao' ? '1' : '2');
  const verAplic = escapeXml(dps.verAplic || 'CadBrasilNFSe_1.0');

  const prest = dps.prestador || {};
  const prestCnpj = onlyDigits(prest.cnpj || dps.cnpjPrestador);
  const prestCpf = onlyDigits(prest.cpf || dps.cpfPrestador);
  const prestIM = escapeXml(prest.im || dps.imPrestador || '');
  // tpEmit=1: SEFIN rejeita xNome/end no prest (preenche do CNC)
  const prestFone = onlyDigits(prest.fone || prest.telefone || '');
  const prestEmail = escapeXml(prest.email || '');
  const regTrib = prest.regTrib || dps.regTrib || {};
  // 1=Não optante SN, 2=MEI, 3=ME/EPP
  const opSimpNac = String(regTrib.opSimpNac ?? '1');
  const regApTribSN =
    regTrib.regApTribSN != null && regTrib.regApTribSN !== ''
      ? String(regTrib.regApTribSN)
      : opSimpNac === '3'
        ? '1'
        : '';
  const regEspTrib = String(regTrib.regEspTrib ?? '0');
  // NT 009: finNFSe sob infDPS — obrigatório em produção restrita (tpAmb=2).
  // Em produção (tpAmb=1) o XSD ainda é o antigo: após tpEmit vem cMotivoEmisTI/chNFSeRej/cLocEmi (sem finNFSe).
  const useNt009InfDps = String(tpAmb) === '2' || dps.forceFinNFSe === true;
  const finNFSe = String(dps.finNFSe ?? '0');
  const tpNFSeCredito = dps.tpNFSeCredito != null ? String(dps.tpNFSeCredito) : '';
  const tpNFSeDebito = dps.tpNFSeDebito != null ? String(dps.tpNFSeDebito) : '';
  const cMotivoEmisTI = dps.cMotivoEmisTI != null ? String(dps.cMotivoEmisTI) : '';
  const chNFSeRej = dps.chNFSeRej != null ? onlyDigits(dps.chNFSeRej) : '';

  const tom = dps.tomador || {};
  const tomCnpj = onlyDigits(tom.cnpj);
  const tomCpf = onlyDigits(tom.cpf);
  const tomNome = escapeXml(tom.xNome || tom.nome || '');
  const tomEmail = escapeXml(tom.email || '');
  const tomEnd = tom.end || tom.endereco || null;

  const serv = dps.servico || {};
  // TSCodTribNac: 6 dígitos. Valor inválido (ex.: '3' de opSimpNac) quebra o XSD (E1235).
  let cTribNacDigits = onlyDigits(serv.cTribNac || serv.codigoTributacaoNacional || '');
  if (!/^\d{6}$/.test(cTribNacDigits)) cTribNacDigits = '010501';
  const cTribNac = escapeXml(cTribNacDigits);
  const cTribMun = escapeXml(serv.cTribMun || serv.codigoTributacaoMunicipal || '');
  const xDescServ = escapeXml(serv.xDescServ || serv.descricao || '');
  let cNBSDigits = onlyDigits(serv.cNBS || '');
  if (cNBSDigits && !/^\d{9}$/.test(cNBSDigits)) cNBSDigits = '';
  const cNBS = escapeXml(cNBSDigits);
  const cLocalPrestacao = padLeft(onlyDigits(serv.cLocPrestacao || serv.cMun || cMun), 7);

  const valores = dps.valores || serv.valores || {};
  const vServ = Number(valores.vServ || valores.vServPrest || valores.valorServico || 0).toFixed(2);
  const pAliqRaw = valores.pAliq ?? valores.aliquota;
  const pAliq = pAliqRaw != null && pAliqRaw !== '' ? Number(pAliqRaw).toFixed(2) : '';
  const tribISSQN = String(valores.tribISSQN || valores.tributacaoIss || '1');
  const tpRetISSQN = String(valores.tpRetISSQN || valores.tipoRetencaoIss || '1');

  // Choice totTrib: indTotTrib (MEI), pTotTribSN (ME/EPP), ou vTotTrib/pTotTrib (qualquer/Não optante)
  let totTribXml = '';
  if (valores.vTotTrib) {
    const v = valores.vTotTrib;
    totTribXml = `<totTrib>
          <vTotTrib>
            <vTotTribFed>${Number(v.vTotTribFed || 0).toFixed(2)}</vTotTribFed>
            <vTotTribEst>${Number(v.vTotTribEst || 0).toFixed(2)}</vTotTribEst>
            <vTotTribMun>${Number(v.vTotTribMun || 0).toFixed(2)}</vTotTribMun>
          </vTotTrib>
        </totTrib>`;
  } else if (valores.pTotTrib) {
    const p = valores.pTotTrib;
    totTribXml = `<totTrib>
          <pTotTrib>
            <pTotTribFed>${Number(p.pTotTribFed || 0).toFixed(2)}</pTotTribFed>
            <pTotTribEst>${Number(p.pTotTribEst || 0).toFixed(2)}</pTotTribEst>
            <pTotTribMun>${Number(p.pTotTribMun || 0).toFixed(2)}</pTotTribMun>
          </pTotTrib>
        </totTrib>`;
  } else if (valores.pTotTribSN != null && valores.pTotTribSN !== '') {
    totTribXml = `<totTrib>
          <pTotTribSN>${Number(valores.pTotTribSN).toFixed(2)}</pTotTribSN>
        </totTrib>`;
  } else if (valores.indTotTrib != null && valores.indTotTrib !== '') {
    totTribXml = `<totTrib>
          <indTotTrib>${String(valores.indTotTrib)}</indTotTrib>
        </totTrib>`;
  } else if (opSimpNac === '2') {
    totTribXml = `<totTrib>
          <indTotTrib>0</indTotTrib>
        </totTrib>`;
  } else {
    // Default seguro p/ Não Optante / ME-EPP sem params: percentuais aproximados IBPT
    totTribXml = `<totTrib>
          <pTotTrib>
            <pTotTribFed>0.00</pTotTribFed>
            <pTotTribEst>0.00</pTotTribEst>
            <pTotTribMun>0.00</pTotTribMun>
          </pTotTrib>
        </totTrib>`;
  }

  const includeTribFed = Boolean(valores.CST || valores.cstPisCofins || valores.tribFed);
  const cstPisCofins = String(valores.CST || valores.cstPisCofins || '07');
  const tpRetPisCofins = String(
    valores.tpRetPisCofins ?? valores.tribFed?.piscofins?.tpRetPisCofins ?? '2'
  );
  const tomFone = onlyDigits(tom.fone || tom.telefone || '');

  const prestadorXml = prestCnpj
    ? `<CNPJ>${prestCnpj}</CNPJ>`
    : `<CPF>${padLeft(prestCpf, 11)}</CPF>`;
  const tomadorDocXml = tomCnpj
    ? `<CNPJ>${tomCnpj}</CNPJ>`
    : tomCpf
      ? `<CPF>${padLeft(tomCpf, 11)}</CPF>`
      : '';

  let tomEndXml = '';
  if (tomEnd) {
    const cMunTom = padLeft(onlyDigits(tomEnd.cMun || tomEnd.codigoMunicipio || ''), 7);
    const cep = onlyDigits(tomEnd.CEP || tomEnd.cep || '');
    const xLgr = escapeXml(tomEnd.xLgr || tomEnd.logradouro || '');
    const nro = escapeXml(tomEnd.nro || tomEnd.numero || 'S/N');
    const xCpl = escapeXml(tomEnd.xCpl || tomEnd.complemento || '');
    const xBairro = escapeXml(tomEnd.xBairro || tomEnd.bairro || '');
    if (cMunTom && xLgr) {
      tomEndXml = `
      <end>
        <endNac>
          <cMun>${cMunTom}</cMun>
          ${cep ? `<CEP>${cep}</CEP>` : ''}
        </endNac>
        <xLgr>${xLgr}</xLgr>
        <nro>${nro}</nro>
        ${xCpl ? `<xCpl>${xCpl}</xCpl>` : ''}
        ${xBairro ? `<xBairro>${xBairro}</xBairro>` : ''}
      </end>`;
    }
  }

  // Namespace padrão DPS nacional (versão conforme XSD vigente / NT 009 prod. restrita)
  return `<?xml version="1.0" encoding="utf-8"?>
<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">
  <infDPS Id="${escapeXml(id)}">
    <tpAmb>${tpAmb}</tpAmb>
    <dhEmi>${escapeXml(dhEmi)}</dhEmi>
    <verAplic>${verAplic}</verAplic>
    <serie>${serie}</serie>
    <nDPS>${nDPS}</nDPS>
    <dCompet>${escapeXml(dCompet)}</dCompet>
    <tpEmit>1</tpEmit>
    ${cMotivoEmisTI ? `<cMotivoEmisTI>${escapeXml(cMotivoEmisTI)}</cMotivoEmisTI>` : ''}
    ${
      useNt009InfDps
        ? `<finNFSe>${finNFSe}</finNFSe>
    ${finNFSe === '2' && tpNFSeDebito ? `<tpNFSeDebito>${escapeXml(tpNFSeDebito)}</tpNFSeDebito>` : ''}
    ${finNFSe === '1' && tpNFSeCredito ? `<tpNFSeCredito>${escapeXml(tpNFSeCredito)}</tpNFSeCredito>` : ''}`
        : ''
    }
    ${chNFSeRej ? `<chNFSeRej>${chNFSeRej}</chNFSeRej>` : ''}
    <cLocEmi>${cMun}</cLocEmi>
    <prest>
      ${prestadorXml}
      ${prestIM ? `<IM>${prestIM}</IM>` : ''}
      ${prestFone ? `<fone>${prestFone}</fone>` : ''}
      ${prestEmail ? `<email>${prestEmail}</email>` : ''}
      <regTrib>
        <opSimpNac>${opSimpNac}</opSimpNac>
        ${regApTribSN ? `<regApTribSN>${regApTribSN}</regApTribSN>` : ''}
        <regEspTrib>${regEspTrib}</regEspTrib>
      </regTrib>
    </prest>
    <toma>
      ${tomadorDocXml}
      ${tomNome ? `<xNome>${tomNome}</xNome>` : ''}
      ${tomEndXml}
      ${tomFone ? `<fone>${tomFone}</fone>` : ''}
      ${tomEmail ? `<email>${tomEmail}</email>` : ''}
    </toma>
    <serv>
      <locPrest>
        <cLocPrestacao>${cLocalPrestacao}</cLocPrestacao>
      </locPrest>
      <cServ>
        ${cTribNac ? `<cTribNac>${cTribNac}</cTribNac>` : ''}
        ${cTribMun ? `<cTribMun>${cTribMun}</cTribMun>` : ''}
        <xDescServ>${xDescServ}</xDescServ>
        ${cNBS ? `<cNBS>${cNBS}</cNBS>` : ''}
      </cServ>
    </serv>
    <valores>
      <vServPrest>
        <vServ>${vServ}</vServ>
      </vServPrest>
      <trib>
        <tribMun>
          <tribISSQN>${tribISSQN}</tribISSQN>
          <tpRetISSQN>${tpRetISSQN}</tpRetISSQN>
          ${pAliq !== '' ? `<pAliq>${pAliq}</pAliq>` : ''}
        </tribMun>
        ${
          includeTribFed
            ? `<tribFed>
          <piscofins>
            <CST>${cstPisCofins}</CST>
            <tpRetPisCofins>${tpRetPisCofins}</tpRetPisCofins>
          </piscofins>
        </tribFed>`
            : ''
        }
        ${totTribXml}
      </trib>
    </valores>
  </infDPS>
</DPS>`;
}

function loadPfxCredentialsFromBuffer(pfxBuffer, passphrase) {
  const password = passphrase || '';
  const der = forge.util.createBuffer(pfxBuffer.toString('binary'));
  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0];
  if (!keyBag?.key) throw new Error('Não foi possível extrair a chave privada do PFX');

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = (certBags[forge.pki.oids.certBag] || [])[0];
  if (!certBag?.cert) throw new Error('Não foi possível extrair o certificado do PFX');

  return {
    privateKeyPem: forge.pki.privateKeyToPem(keyBag.key),
    certificatePem: forge.pki.certificateToPem(certBag.cert),
    certificate: certBag.cert,
  };
}

/**
 * Assina XML enveloped SHA-256 sobre o elemento informado (infDPS / infPedReg).
 */
function signEnvelopedXml(xml, pfxBuffer, passphrase, elementLocalName) {
  const { SignedXml } = require('xml-crypto');
  const { DOMParser } = require('@xmldom/xmldom');
  const { privateKeyPem, certificatePem } = loadPfxCredentialsFromBuffer(pfxBuffer, passphrase);
  const elName = elementLocalName || 'infDPS';

  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const inf = doc.getElementsByTagName(elName)[0];
  if (!inf) throw new Error(`XML sem elemento <${elName}>`);
  const refId = inf.getAttribute('Id');
  if (!refId) throw new Error(`${elName} sem atributo Id`);

  const xpath = `//*[local-name(.)='${elName}']`;
  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certificatePem,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
  });

  sig.addReference({
    xpath,
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#',
    ],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    uri: `#${refId}`,
  });

  sig.computeSignature(xml, {
    location: { reference: xpath, action: 'after' },
    prefix: '',
  });

  return sig.getSignedXml();
}

/** Assina o XML da DPS (XMLDSig enveloped SHA-256 sobre infDPS). */
function signDpsXml(dpsXml, pfxBuffer, passphrase) {
  return signEnvelopedXml(dpsXml, pfxBuffer, passphrase, 'infDPS');
}

/**
 * Monta pedido de cancelamento (evento 101101).
 * Id = PRE + chave(50) + 101101 + nSeq(3)
 */
function buildPedRegCancelamentoXml({
  chaveAcesso,
  cnpjAutor,
  cMotivo = '1',
  xMotivo = 'Cancelamento de NFS-e',
  nPedRegEvento = '001',
  tpAmb,
}) {
  const chave = onlyDigits(chaveAcesso);
  if (chave.length < 50) {
    throw new Error('chaveAcesso inválida para cancelamento (esperado 50 dígitos)');
  }
  const nSeq = padLeft(onlyDigits(nPedRegEvento) || '1', 3);
  const id = `PRE${chave}101101${nSeq}`;
  const amb = String(tpAmb || (getAmbiente() === 'producao' ? '1' : '2'));
  const dhEvento = formatDateTimeUtc(new Date());
  const cnpj = onlyDigits(cnpjAutor);
  const motivo = escapeXml(String(xMotivo || 'Cancelamento de NFS-e').slice(0, 255));
  const codMotivo = String(cMotivo || '1');

  return `<?xml version="1.0" encoding="utf-8"?>
<pedRegEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">
  <infPedReg Id="${escapeXml(id)}">
    <tpAmb>${amb}</tpAmb>
    <verAplic>CadBrasilNFSe_1.0</verAplic>
    <dhEvento>${escapeXml(dhEvento)}</dhEvento>
    <CNPJAutor>${cnpj}</CNPJAutor>
    <chNFSe>${chave}</chNFSe>
    <nPedRegEvento>${nSeq}</nPedRegEvento>
    <e101101>
      <xDesc>Cancelamento de NFS-e</xDesc>
      <cMotivo>${escapeXml(codMotivo)}</cMotivo>
      <xMotivo>${motivo}</xMotivo>
    </e101101>
  </infPedReg>
</pedRegEvento>`;
}

/**
 * Cancela NFS-e na SEFIN (POST /nfse/{chave}/eventos — evento 101101).
 */
async function cancelar(opts = {}) {
  try {
    const rt = await refreshRuntime();
    if (rt.nfse_enabled === 'false') {
      return { ok: false, error: 'Módulo NFS-e desabilitado (nfse_enabled=false).' };
    }

    const chave = onlyDigits(opts.chaveAcesso || opts.chave || '');
    if (chave.length < 50) return { ok: false, error: 'chaveAcesso inválida' };

    const creds = await resolveCredentials(opts);
    if (!creds.ok) return creds;

    const cnpjAutor =
      onlyDigits(opts.cnpjAutor) ||
      onlyDigits(rt.nfse_prestador_cnpj) ||
      onlyDigits(process.env.NFSE_PRESTADOR_CNPJ) ||
      '52841613000155';

    const pedXml = buildPedRegCancelamentoXml({
      chaveAcesso: chave,
      cnpjAutor,
      cMotivo: opts.cMotivo || '1',
      xMotivo: opts.xMotivo || opts.motivo || 'Cancelamento de NFS-e',
      nPedRegEvento: opts.nPedRegEvento || '001',
    });

    const signedXml = signEnvelopedXml(pedXml, creds.pfxBuffer, creds.passphrase, 'infPedReg');
    const urls = getBaseUrls();
    const body = { pedidoRegistroEventoXmlGZipB64: gzipBase64(signedXml) };
    const endpoint = `${urls.sefin}/nfse/${chave}/eventos`;

    const res = await mtlsRequest(endpoint, {
      method: 'POST',
      body,
      credentials: creds,
    });

    const okHttp = res.status >= 200 && res.status < 300;
    const erros = res.json?.erro || res.json?.erros || res.json?.mensagens || null;
    const hasErroLista = Array.isArray(erros) && erros.length > 0;

    if (!okHttp || hasErroLista) {
      const msg =
        (Array.isArray(erros) && erros[0]?.descricao) ||
        (Array.isArray(erros) && erros[0]?.Descricao) ||
        res.json?.motivoStatus ||
        res.json?.mensagem ||
        `SEFIN rejeitou o cancelamento (HTTP ${res.status}).`;
      return {
        ok: false,
        error: msg,
        status: res.status,
        resposta: res.json || res.raw,
        ambiente: urls.ambiente,
        eventoXml: signedXml,
      };
    }

    return {
      ok: true,
      message: 'Cancelamento de NFS-e registrado com sucesso',
      chaveAcesso: chave,
      ambiente: urls.ambiente,
      resposta: res.json,
      eventoXml: signedXml,
    };
  } catch (e) {
    console.error('[NFSe] cancelar:', e.message);
    return { ok: false, error: e.message };
  }
}

async function resolveCredentials(opts = {}) {
  const useClientCert =
    opts.useSystemCert !== true && opts.clienteId != null && Number(opts.clienteId) > 0;

  if (useClientCert) {
    const certSvc = require('./certificado-digital.service');
    const dl = await certSvc.getCertificadoDownload(opts.clienteId);
    if (!dl.ok || !dl.buffer?.length) {
      return {
        ok: false,
        error: dl.error || 'Cliente sem certificado digital A1 cadastrado para NFS-e.',
      };
    }
    const meta = await certSvc.getCertificadoDigital(opts.clienteId, { includeSenha: true });
    const passphrase =
      opts.senhaCertificado ||
      meta?.certificado?.senha ||
      '';
    if (!passphrase) {
      return {
        ok: false,
        error: 'Senha do certificado digital do cliente não encontrada. Reenvie o PFX com a senha.',
      };
    }
    return {
      ok: true,
      source: 'cliente',
      clienteId: Number(opts.clienteId),
      pfxBuffer: dl.buffer,
      passphrase: String(passphrase),
    };
  }

  // Certificado do sistema / CadBrasil prestador (DB → .env)
  const rt = await refreshRuntime();
  let pfxBuffer = null;
  let passphrase =
    rt.nfse_cert_pfx_password ||
    process.env.NFSE_CERT_PFX_PASSWORD ||
    process.env.CERT_PFX_PASSWORD ||
    '';

  if (rt.nfse_cert_pfx_base64) {
    pfxBuffer = Buffer.from(rt.nfse_cert_pfx_base64, 'base64');
  } else {
    const candidates = [
      rt.nfse_cert_pfx_path,
      process.env.NFSE_CERT_PFX_PATH,
      process.env.CERT_PFX_PATH,
      // fallbacks locais (dev Windows / repo)
      require('path').join(__dirname, '../../private/certificados/cadbrasil.pfx'),
      require('path').join(process.cwd(), 'private/certificados/cadbrasil.pfx'),
    ].filter(Boolean);
    for (const pfxPath of candidates) {
      if (pfxPath && fs.existsSync(pfxPath)) {
        pfxBuffer = fs.readFileSync(pfxPath);
        break;
      }
    }
  }

  if (!pfxBuffer?.length) {
    return {
      ok: false,
      error:
        'Certificado NFS-e do sistema não configurado. Configure em Admin → Configurações → Fiscal Config (ou NFSE_CERT_PFX_* no .env).',
    };
  }

  return {
    ok: true,
    source: 'sistema',
    clienteId: opts.clienteId ? Number(opts.clienteId) : null,
    pfxBuffer,
    passphrase: String(passphrase || ''),
  };
}

function mtlsRequest(urlString, { method = 'GET', body = null, credentials, accept = 'application/json', binary = false }) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlString);
      const agent = new https.Agent({
        pfx: credentials.pfxBuffer,
        passphrase: credentials.passphrase || '',
        rejectUnauthorized: process.env.NFSE_TLS_INSECURE === 'true' ? false : true,
        keepAlive: false,
        // SEFIN/ADN pedem HTTP/1.1
        ALPNProtocols: ['http/1.1'],
      });

      const payload = body == null ? null : Buffer.from(JSON.stringify(body), 'utf8');
      const req = https.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || 443,
          path: `${url.pathname}${url.search || ''}`,
          method,
          agent,
          headers: {
            Accept: accept,
            ...(payload
              ? {
                  'Content-Type': 'application/json; charset=utf-8',
                  'Content-Length': payload.length,
                }
              : {}),
          },
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const buf = Buffer.concat(chunks);
            if (binary) {
              resolve({
                status: res.statusCode || 0,
                headers: res.headers,
                buffer: buf,
                raw: null,
                json: null,
              });
              return;
            }
            const raw = buf.toString('utf8');
            let json = null;
            try {
              json = raw ? JSON.parse(raw) : null;
            } catch (_) {
              json = null;
            }
            resolve({
              status: res.statusCode || 0,
              headers: res.headers,
              raw,
              json,
              buffer: buf,
            });
          });
        },
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Gera DANFSe local (NT 008) a partir do XML autorizado da NFS-e.
 * Necessário porque a API ADN /danfse foi sobrestada (503 / NT 008).
 */
async function gerarDanfseLocalFromXml(nfseXml, opts = {}) {
  try {
    const xml = String(nfseXml || '').trim();
    if (!xml || !xml.includes('NFSe')) {
      return { ok: false, error: 'XML da NFS-e inválido para gerar DANFSe' };
    }
    const { parseNfseXml, generateDanfsePdf } = require('danfse-pdf-generator');
    const dados = parseNfseXml(xml);
    const ambiente =
      opts.ambiente ||
      getAmbiente() ||
      (String(dados?.ambienteGerador) === '2' ? 'producaorestrita' : 'producao');
    const pdf = await generateDanfsePdf(dados, {
      ambienteGerador: ambiente === 'producao' ? '1' : '2',
      hideWarnings: true,
    });
    if (!Buffer.isBuffer(pdf) || pdf.length < 100 || pdf.slice(0, 4).toString('utf8') !== '%PDF') {
      return { ok: false, error: 'Gerador local não retornou PDF válido' };
    }
    const chave =
      onlyDigits(opts.chaveAcesso || dados?.chaveAcesso || '').slice(-12) || 'nfse';
    return {
      ok: true,
      buffer: pdf,
      contentType: 'application/pdf',
      filename: `DANFSe_${chave}.pdf`,
      source: 'local-nt008',
      ambiente,
    };
  } catch (e) {
    console.error('[NFSe] gerarDanfseLocalFromXml:', e.message);
    return { ok: false, error: e.message || 'Falha ao gerar DANFSe local' };
  }
}

/**
 * Obtém DANFSe (PDF): tenta ADN; se indisponível, gera local a partir do XML
 * (opts.nfseXml ou consulta SEFIN pela chave).
 */
async function baixarDanfse(opts = {}) {
  try {
    await refreshRuntime();
    const chave = onlyDigits(opts.chaveAcesso || opts.chave || '');
    const urls = getBaseUrls();

    // 1) ADN (pode estar sobrestado / 503)
    if (chave.length >= 50) {
      const creds = await resolveCredentials(opts);
      if (creds.ok) {
        try {
          const endpoint = `${urls.danfse}/${chave}`;
          const res = await mtlsRequest(endpoint, {
            method: 'GET',
            credentials: creds,
            accept: 'application/pdf, application/octet-stream, */*',
            binary: true,
          });
          const contentType = String(res.headers?.['content-type'] || '');
          const isPdf =
            contentType.includes('pdf') ||
            (res.buffer && res.buffer.length > 4 && res.buffer.slice(0, 4).toString('utf8') === '%PDF');
          if (res.status >= 200 && res.status < 300 && isPdf && res.buffer?.length) {
            return {
              ok: true,
              buffer: res.buffer,
              contentType: 'application/pdf',
              filename: `DANFSe_${chave.slice(-12)}.pdf`,
              ambiente: urls.ambiente,
              source: 'adn-danfse',
            };
          }
        } catch (e) {
          console.warn('[NFSe] ADN DANFSe indisponível:', e.message);
        }
      }
    }

    // 2) XML informado
    let xml = opts.nfseXml || opts.xml || null;
    if (!xml && chave.length >= 50) {
      const consulta = await consultarPorChave({
        chaveAcesso: chave,
        useSystemCert: opts.useSystemCert !== false,
        clienteId: opts.clienteId,
      });
      if (consulta.ok && consulta.nfseXml) xml = consulta.nfseXml;
    }

    if (xml) {
      const local = await gerarDanfseLocalFromXml(xml, {
        chaveAcesso: chave,
        ambiente: urls.ambiente,
      });
      if (local.ok) return local;
      return local;
    }

    return {
      ok: false,
      error:
        'DANFSe indisponível: API ADN fora do ar e sem XML da NFS-e para gerar o PDF local (NT 008).',
      ambiente: urls.ambiente,
    };
  } catch (e) {
    console.error('[NFSe] baixarDanfse:', e.message);
    return { ok: false, error: e.message || 'Erro ao obter DANFSe' };
  }
}

async function ensureNfseTable(db) {
  const has = await db.schema.hasTable(NFSE_TABLE);
  if (has) return;
  await db.schema.createTable(NFSE_TABLE, (t) => {
    t.increments('id').primary();
    t.integer('cliente_id').unsigned().nullable().index();
    t.integer('usuario_id').unsigned().nullable().index();
    t.string('ambiente', 30).notNullable().defaultTo('producaorestrita');
    t.string('status', 40).notNullable().defaultTo('pendente').index();
    t.string('chave_acesso', 60).nullable().index();
    t.string('id_dps', 80).nullable().index();
    t.string('serie', 10).nullable();
    t.string('numero_dps', 20).nullable();
    t.decimal('valor', 14, 2).nullable();
    t.string('tomador_doc', 20).nullable();
    t.string('tomador_nome', 255).nullable();
    t.text('descricao').nullable();
    t.text('dps_xml').nullable();
    t.text('nfse_xml').nullable();
    t.text('resposta_json').nullable();
    t.text('erro').nullable();
    t.integer('pagamento_id').unsigned().nullable().index();
    t.timestamp('created_at').defaultTo(db.fn.now());
    t.timestamp('updated_at').nullable();
  });
}

async function persistEmissao(row) {
  try {
    const { getDb } = require('../database/connection');
    const db = getDb();
    if (!db) return null;
    await ensureNfseTable(db);
    const [id] = await db(NFSE_TABLE).insert({
      ...row,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
    return id;
  } catch (e) {
    console.warn('[NFSe] persistEmissao:', e.message);
    return null;
  }
}

/**
 * Emite NFS-e a partir de objeto DPS (monta XML + assina) ou XML já pronto.
 */
async function emitir(opts = {}) {
  try {
    const rt = await refreshRuntime();
    if (rt.nfse_enabled === 'false') {
      return { ok: false, error: 'Módulo NFS-e desabilitado (nfse_enabled=false).' };
    }

    const creds = await resolveCredentials(opts);
    if (!creds.ok) return creds;

    let dpsXml = opts.dpsXml || opts.xml || null;
    if (!dpsXml) {
      if (!opts.dps) return { ok: false, error: 'Informe dps (objeto) ou dpsXml (string).' };
      dpsXml = buildDpsXml(opts.dps);
    }

    const signedXml = opts.jaAssinado
      ? dpsXml
      : signDpsXml(dpsXml, creds.pfxBuffer, creds.passphrase);

    const urls = getBaseUrls();
    const body = { dpsXmlGZipB64: gzipBase64(signedXml) };
    const endpoint = `${urls.sefin}/nfse`;

    const res = await mtlsRequest(endpoint, {
      method: 'POST',
      body,
      credentials: creds,
    });

    const okHttp = res.status >= 200 && res.status < 300;
    const chaveAcesso = res.json?.chaveAcesso || null;
    let nfseXml = null;
    if (res.json?.nfseXmlGZipB64) {
      try {
        nfseXml = gunzipBase64(res.json.nfseXmlGZipB64);
      } catch (_) {}
    }

    const dps = opts.dps || {};
    const valores = dps.valores || dps.servico?.valores || {};
    const valorNum = Number(
      valores.vServ ?? valores.vServPrest ?? valores.valorServico ?? opts.valor ?? 0,
    );
    const emissaoId = await persistEmissao({
      cliente_id: opts.clienteId || creds.clienteId || null,
      usuario_id: opts.usuarioId || null,
      ambiente: urls.ambiente,
      status: okHttp && chaveAcesso ? 'autorizada' : 'rejeitada',
      chave_acesso: chaveAcesso,
      id_dps: dps.id || null,
      serie: dps.serie || null,
      numero_dps: String(dps.nDPS || dps.numero || ''),
      valor: Number.isFinite(valorNum) && valorNum > 0 ? valorNum : null,
      tomador_doc: onlyDigits(dps.tomador?.cnpj || dps.tomador?.cpf || '') || null,
      tomador_nome: dps.tomador?.xNome || dps.tomador?.nome || null,
      descricao: dps.servico?.xDescServ || dps.servico?.descricao || null,
      dps_xml: signedXml,
      nfse_xml: nfseXml,
      resposta_json: res.raw ? String(res.raw).slice(0, 65000) : null,
      erro: okHttp ? null : res.json?.motivoStatus || res.json?.mensagem || res.raw?.slice(0, 2000) || `HTTP ${res.status}`,
      pagamento_id: opts.pagamentoId || null,
    });

    if (!okHttp) {
      return {
        ok: false,
        error: res.json?.motivoStatus || res.json?.mensagem || `SEFIN rejeitou a DPS (HTTP ${res.status}).`,
        status: res.status,
        resposta: res.json || res.raw,
        emissaoId,
        ambiente: urls.ambiente,
      };
    }

    return {
      ok: true,
      message: res.json?.motivoStatus || 'NFS-e gerada com sucesso',
      chaveAcesso,
      codigoStatus: res.json?.codigoStatus,
      nfseXml,
      nfseXmlGZipB64: res.json?.nfseXmlGZipB64 || null,
      dpsXmlAssinado: signedXml,
      emissaoId,
      ambiente: urls.ambiente,
      resposta: res.json,
    };
  } catch (e) {
    console.error('[NFSe] emitir:', e.message);
    return { ok: false, error: e.message };
  }
}

async function consultarPorChave(opts = {}) {
  try {
    const chave = String(opts.chaveAcesso || opts.chave || '').replace(/\D/g, '');
    if (chave.length < 40) return { ok: false, error: 'chaveAcesso inválida' };

    const creds = await resolveCredentials(opts);
    if (!creds.ok) return creds;

    const urls = getBaseUrls();
    const res = await mtlsRequest(`${urls.sefin}/nfse/${chave}`, {
      method: 'GET',
      credentials: creds,
    });

    if (res.status < 200 || res.status >= 300) {
      return {
        ok: false,
        error: res.json?.motivoStatus || res.json?.mensagem || `Consulta falhou (HTTP ${res.status})`,
        status: res.status,
        resposta: res.json || res.raw,
      };
    }

    let nfseXml = null;
    if (res.json?.nfseXmlGZipB64) {
      try {
        nfseXml = gunzipBase64(res.json.nfseXmlGZipB64);
      } catch (_) {}
    }

    return {
      ok: true,
      chaveAcesso: chave,
      nfseXml,
      resposta: res.json,
      ambiente: urls.ambiente,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function consultarDps(opts = {}) {
  try {
    const id = String(opts.idDps || opts.id || '').trim();
    if (!id) return { ok: false, error: 'idDps obrigatório' };

    const creds = await resolveCredentials(opts);
    if (!creds.ok) return creds;

    const urls = getBaseUrls();
    const res = await mtlsRequest(`${urls.sefin}/dps/${encodeURIComponent(id)}`, {
      method: 'GET',
      credentials: creds,
    });

    if (res.status < 200 || res.status >= 300) {
      return {
        ok: false,
        error: res.json?.motivoStatus || res.json?.mensagem || `Consulta DPS falhou (HTTP ${res.status})`,
        status: res.status,
        resposta: res.json || res.raw,
      };
    }

    return { ok: true, idDps: id, resposta: res.json, ambiente: urls.ambiente };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function listarEmissoes(opts = {}) {
  try {
    const { getDb } = require('../database/connection');
    const db = getDb();
    if (!db) return { ok: false, error: 'Banco indisponível' };
    await ensureNfseTable(db);

    let q = db(NFSE_TABLE).orderBy('id', 'desc');
    if (opts.clienteId) q = q.where('cliente_id', opts.clienteId);
    if (opts.status) q = q.where('status', opts.status);
    const limit = Math.min(100, Math.max(1, Number(opts.limit) || 30));
    const rows = await q.limit(limit).select(
      'id',
      'cliente_id',
      'ambiente',
      'status',
      'chave_acesso',
      'id_dps',
      'serie',
      'numero_dps',
      'valor',
      'tomador_doc',
      'tomador_nome',
      'descricao',
      'pagamento_id',
      'erro',
      'created_at',
    );

    return {
      ok: true,
      total: rows.length,
      emissoes: rows.map((r) => ({
        id: r.id,
        clienteId: r.cliente_id,
        ambiente: r.ambiente,
        status: r.status,
        chaveAcesso: r.chave_acesso,
        idDps: r.id_dps,
        serie: r.serie,
        numeroDps: r.numero_dps,
        valor: r.valor != null ? Number(r.valor) : null,
        tomadorDoc: r.tomador_doc,
        tomadorNome: r.tomador_nome,
        descricao: r.descricao,
        pagamentoId: r.pagamento_id,
        erro: r.erro,
        createdAt: r.created_at,
      })),
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  // config
  refreshRuntime,
  getAmbiente,
  getBaseUrls,
  getStatusConfig,
  // crypto / xml helpers (reutilizáveis)
  gzipBase64,
  gunzipBase64,
  buildDpsId,
  buildDpsXml,
  formatDateTimeUtc,
  signDpsXml,
  resolveCredentials,
  mtlsRequest,
  gerarDanfseLocalFromXml,
  baixarDanfse,
  // operações
  emitir,
  cancelar,
  consultarPorChave,
  consultarDps,
  listarEmissoes,
  ensureNfseTable,
  buildPedRegCancelamentoXml,
  signEnvelopedXml,
};
