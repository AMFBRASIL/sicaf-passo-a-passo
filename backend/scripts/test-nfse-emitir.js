/**
 * Teste de emissão NFS-e (produção restrita) com dados do XML real CadBrasil.
 * Fonte: NFSe autorizada (Emissor Web) — mesma empresa/certificado.
 */
require('dotenv').config();
const nfse = require('../sicaf-agent/services/nfse.service');

(async () => {
  console.log('=== Teste emissão NFS-e (dados do XML CadBrasil) ===\n');

  const status = await nfse.getStatusConfig();
  console.log('Ambiente:', status.ambiente);
  console.log('SEFIN:', status.urls.sefin);

  // Dados extraídos da NFSe autorizada (produção) — nDPS novo p/ não colidir
  const cnpjPrestador = '52841613000155';
  const cMun = '3550308'; // São Paulo (local de emissão / incidência)
  const nDPS = String(Date.now()).slice(-8);

  const dps = {
    cMun,
    // Série 70000 = Emissor Web (E0010 na API). API usa faixa própria (ex.: 1).
    serie: '1',
    nDPS,
    finNFSe: '0', // NT 009 (prod. restrita): regular
    cnpjPrestador,
    // Em produção restrita a SEFIN rejeitou IM (E0120) — CNC local sem cadastro complementar.
    // Em produção real a IM do XML autorizado é 000000078999987.
    imPrestador: undefined,
    prestador: {
      cnpj: cnpjPrestador,
      fone: '1184401158',
      email: 'PROMAUTONE@GMAIL.COM',
      // ME/EPP apurando pelo SN
      regTrib: { opSimpNac: '3', regApTribSN: '1', regEspTrib: '0' },
    },
    tomador: {
      cnpj: '45707305000176',
      xNome: 'AEC BIM CONSULTORIA EM TECNOLOGIA LTDA',
      fone: '4196869828',
      email: 'contato@aecbimconsultoria.com',
      end: {
        cMun: '3106200', // Belo Horizonte
        CEP: '30411238',
        xLgr: 'CUIABA',
        nro: '1051',
        xCpl: 'APT 401',
        xBairro: 'PRADO',
      },
    },
    servico: {
      cTribNac: '010501',
      cTribMun: '001',
      cNBS: '111032200',
      cLocPrestacao: '3106200',
      xDescServ:
        'CADBRASIL - TESTE API NACIONAL (PRODUCAO RESTRITA) - ASSESSORIA SICAF',
    },
    valores: {
      vServ: 10.0, // valor simbólico no teste
      tribISSQN: '1',
      tpRetISSQN: '1',
      CST: '00',
      tpRetPisCofins: '0',
      pTotTribSN: 6.0,
    },
  };

  console.log('\nDPS resumida:', {
    cMun: dps.cMun,
    serie: dps.serie,
    nDPS: dps.nDPS,
    im: dps.imPrestador || '(omitida)',
    prestador: dps.cnpjPrestador,
    tomador: dps.tomador.cnpj,
    cTribNac: dps.servico.cTribNac,
    cNBS: dps.servico.cNBS,
    cLocPrestacao: dps.servico.cLocPrestacao,
    valor: dps.valores.vServ,
    regime: dps.prestador.regTrib,
  });

  try {
    const xml = nfse.buildDpsXml(dps);
    console.log('\nXML DPS (preview, sem assinatura) —', xml.length, 'chars');
    console.log(xml.slice(0, 500).replace(/\s+/g, ' '), '...');
  } catch (e) {
    console.error('Falha ao montar XML:', e.message);
    process.exit(1);
  }

  console.log('\nEnviando para SEFIN (mTLS + assinatura)...');
  const result = await nfse.emitir({
    useSystemCert: true,
    dps,
  });

  console.log('\nResultado:');
  console.log({
    ok: result.ok,
    message: result.message,
    error: result.error,
    status: result.status,
    chaveAcesso: result.chaveAcesso,
    emissaoId: result.emissaoId,
    ambiente: result.ambiente,
    codigoStatus: result.codigoStatus,
  });

  if (result.resposta && typeof result.resposta === 'object') {
    const r = result.resposta;
    console.log('\nResposta SEFIN (campos principais):', {
      codigoStatus: r.codigoStatus,
      motivoStatus: r.motivoStatus,
      chaveAcesso: r.chaveAcesso,
      mensagens: r.mensagens || r.erros || r.listaMensagens || undefined,
    });
  } else if (typeof result.resposta === 'string') {
    console.log('\nResposta raw:', String(result.resposta).slice(0, 500));
  }

  if (!result.ok) {
    process.exitCode = 1;
  } else {
    console.log('\nEmissão autorizada com sucesso.');
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
