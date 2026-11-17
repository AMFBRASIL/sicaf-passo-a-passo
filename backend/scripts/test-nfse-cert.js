/**
 * Teste local do certificado NFS-e (PFX + mTLS).
 * Não imprime a senha.
 */
require('dotenv').config();
const fs = require('fs');
const https = require('https');
const forge = require('node-forge');

const nfse = require('../sicaf-agent/services/nfse.service');

function validatePfx(pfxBuffer, passphrase) {
  const der = forge.util.createBuffer(pfxBuffer.toString('binary'));
  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, passphrase || '');
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const cert = (certBags[forge.pki.oids.certBag] || [])[0]?.cert;
  if (!cert) throw new Error('PFX sem certificado');
  const cn = cert.subject.getField('CN')?.value || '';
  return {
    cn,
    notBefore: cert.validity.notBefore,
    notAfter: cert.validity.notAfter,
    expired: cert.validity.notAfter.getTime() < Date.now(),
  };
}

function probeUrl(urlString, credentials) {
  return new Promise((resolve) => {
    const url = new URL(urlString);
    const agent = new https.Agent({
      pfx: credentials.pfxBuffer,
      passphrase: credentials.passphrase || '',
      rejectUnauthorized: true,
      keepAlive: false,
    });
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: 443,
        path: url.pathname + (url.search || ''),
        method: 'GET',
        agent,
        headers: { Accept: 'application/json' },
        timeout: 20000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            ok: true,
            status: res.statusCode,
            bodyPreview: Buffer.concat(chunks).toString('utf8').slice(0, 180),
          });
        });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'timeout' });
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.end();
  });
}

(async () => {
  console.log('=== Teste NFS-e certificado local ===\n');

  const status = await nfse.getStatusConfig();
  console.log('Config:', {
    enabled: status.enabled,
    ambiente: status.ambiente,
    sefin: status.urls.sefin,
    certificadoSistemaConfigurado: status.certificadoSistemaConfigurado,
  });

  const pathEnv = process.env.NFSE_CERT_PFX_PATH || '';
  console.log('\nArquivo configurado:', pathEnv);
  console.log('Arquivo existe:', pathEnv ? fs.existsSync(pathEnv) : false);

  const creds = await nfse.resolveCredentials({ useSystemCert: true });
  if (!creds.ok) {
    console.error('\nFalha ao carregar credenciais:', creds.error);
    process.exit(1);
  }
  console.log('\nCredenciais OK — origem:', creds.source, '| bytes PFX:', creds.pfxBuffer.length);

  try {
    const info = validatePfx(creds.pfxBuffer, creds.passphrase);
    console.log('PFX válido:', {
      titularCN: info.cn,
      validoDe: info.notBefore?.toISOString?.() || info.notBefore,
      validoAte: info.notAfter?.toISOString?.() || info.notAfter,
      expirado: info.expired,
    });
    if (info.expired) {
      console.warn('ATENÇÃO: certificado expirado.');
    }
  } catch (e) {
    console.error('\nSenha/PFX inválidos:', e.message);
    process.exit(1);
  }

  const probeTargets = [
    `${status.urls.sefin}/docs/index`,
    status.urls.swaggerSefin,
  ].filter(Boolean);

  console.log('\nTestando mTLS contra SEFIN...');
  for (const target of probeTargets) {
    const r = await probeUrl(target, creds);
    console.log('-', target);
    if (r.ok) {
      console.log('  HTTP', r.status, '|', r.bodyPreview.replace(/\s+/g, ' ').slice(0, 100));
    } else {
      console.log('  ERRO:', r.error);
    }
  }

  console.log('\nConclusão: certificado lido e handshake testado.');
  console.log('Emissão real exige DPS válida (município/serviço/tomador).');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
