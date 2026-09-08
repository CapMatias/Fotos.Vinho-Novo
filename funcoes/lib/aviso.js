// Avisos no celular (Web Push) quando entra um álbum novo.
//
// Isto aqui é a parte chata: para o navegador aceitar um aviso, a mensagem
// precisa ir assinada (VAPID, RFC 8292) e criptografada de ponta a ponta
// (RFC 8291). Nem o serviço de push do Google/Apple consegue ler o texto.
//
// Está tudo escrito com o "crypto" que já vem no Node — sem biblioteca de
// fora, para não depender de instalação na hospedagem.
const crypto = require("crypto");
const { ambiente, cabecalhos, banco } = require("./comum");

const CHAVES = {
  publica:  process.env.VAPID_PUBLIC_KEY || "",
  privada:  process.env.VAPID_PRIVATE_KEY || "",
  contato:  process.env.VAPID_SUBJECT || "mailto:contato@vinhonovosaquarema.com.br"
};

function temChaves() { return !!(CHAVES.publica && CHAVES.privada); }

// ---------------------------------------------------------------- base64url
function paraBase64Url(buffer) {
  return Buffer.from(buffer).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function deBase64Url(texto) {
  return Buffer.from(String(texto).replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

// ------------------------------------------------------- gerar par de chaves
// Usado uma vez só, pelo comando: node gerar-chaves-aviso.js
function gerarChaves() {
  const par = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const publica = par.publicKey.export({ format: "jwk" });
  const privada = par.privateKey.export({ format: "jwk" });
  return {
    publica: paraBase64Url(Buffer.concat([
      Buffer.from([4]), deBase64Url(publica.x), deBase64Url(publica.y)
    ])),
    privada: privada.d
  };
}

// ------------------------------------------------------- assinatura (VAPID)
// Diz ao serviço de push quem está mandando. Vale 12 horas.
function assinarVapid(endpoint) {
  const origem = new URL(endpoint).origin;
  const cabecalho = { typ: "JWT", alg: "ES256" };
  const conteudo = {
    aud: origem,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: CHAVES.contato
  };

  const inicio = paraBase64Url(JSON.stringify(cabecalho)) + "." +
                 paraBase64Url(JSON.stringify(conteudo));

  const bruta = deBase64Url(CHAVES.publica);   // 04 || x(32) || y(32)
  const chave = crypto.createPrivateKey({
    key: {
      kty: "EC", crv: "P-256",
      d: CHAVES.privada,
      x: paraBase64Url(bruta.subarray(1, 33)),
      y: paraBase64Url(bruta.subarray(33, 65))
    },
    format: "jwk"
  });

  // O JWT exige a assinatura crua (r||s), não o empacotamento DER.
  const assinatura = crypto.sign("sha256", Buffer.from(inicio), {
    key: chave, dsaEncoding: "ieee-p1363"
  });
  return inicio + "." + paraBase64Url(assinatura);
}

// ------------------------------------------------------ criptografia (8291)
// Os dois últimos parâmetros só existem para o teste conseguir repetir o
// exemplo oficial da RFC; no uso real eles são sorteados.
function criptografar(texto, p256dhUsuario, authUsuario, salParaTeste, privadaParaTeste) {
  const uaPublica = deBase64Url(p256dhUsuario);
  const authSecret = deBase64Url(authUsuario);
  const sal = salParaTeste || crypto.randomBytes(16);

  // Par de chaves só desta mensagem.
  const efemero = crypto.createECDH("prime256v1");
  if (privadaParaTeste) efemero.setPrivateKey(privadaParaTeste);
  else efemero.generateKeys();
  const asPublica = efemero.getPublicKey();
  const segredoEcdh = efemero.computeSecret(uaPublica);

  // Mistura o segredo da conversa com o segredo do aparelho.
  const infoChave = Buffer.concat([
    Buffer.from("WebPush: info\0"), uaPublica, asPublica
  ]);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", segredoEcdh, authSecret, infoChave, 32));

  const cek = Buffer.from(crypto.hkdfSync(
    "sha256", ikm, sal, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync(
    "sha256", ikm, sal, Buffer.from("Content-Encoding: nonce\0"), 12));

  // Cabeçalho aberto: sal, tamanho do bloco, e a chave pública desta mensagem.
  const cabecalhoAberto = Buffer.alloc(21);
  sal.copy(cabecalhoAberto, 0);
  cabecalhoAberto.writeUInt32BE(4096, 16);
  cabecalhoAberto.writeUInt8(asPublica.length, 20);

  // 0x02 marca o fim do conteúdo (é o último bloco).
  const aberto = Buffer.concat([Buffer.from(texto, "utf8"), Buffer.from([2])]);
  const cifrador = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const fechado = Buffer.concat([cifrador.update(aberto), cifrador.final(), cifrador.getAuthTag()]);

  return Buffer.concat([cabecalhoAberto, asPublica, fechado]);
}

// ------------------------------------------------------------------ enviar
// Devolve o que aconteceu com cada aparelho, para o chamador limpar os que
// não existem mais (404/410 = a pessoa desinstalou ou desativou).
async function enviarPara(inscricao, texto) {
  const corpo = criptografar(texto, inscricao.p256dh, inscricao.auth);
  const r = await fetch(inscricao.endpoint, {
    method: "POST",
    headers: {
      "TTL": "86400",
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "Content-Length": String(corpo.length),
      "Authorization": "vapid t=" + assinarVapid(inscricao.endpoint) + ", k=" + CHAVES.publica
    },
    body: corpo
  });
  return r.status;
}

// ------------------------------------------------------ lista de inscritos
async function listarInscricoes() {
  return banco("inscricoes?select=*&limit=5000");
}

async function guardarInscricao(dados) {
  // "merge-duplicates": se o aparelho já estava inscrito, atualiza em vez de
  // dar erro de repetido.
  const { url } = ambiente();
  const r = await fetch(url + "/rest/v1/inscricoes?on_conflict=endpoint", {
    method: "POST",
    headers: cabecalhos({
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=minimal"
    }),
    body: JSON.stringify(dados)
  });
  if (!r.ok) throw new Error("Supabase respondeu " + r.status + ": " + (await r.text()));
}

async function apagarInscricao(endpoint) {
  await banco("inscricoes?endpoint=eq." + encodeURIComponent(endpoint), { method: "DELETE" });
}

// Manda para todo mundo. Nunca estoura: aviso é enfeite, não pode derrubar
// a criação do álbum.
async function avisarTodos(titulo, texto, endereco) {
  if (!temChaves()) return { enviados: 0, motivo: "sem chaves de aviso" };

  let inscritos = [];
  try { inscritos = await listarInscricoes(); } catch (e) { return { enviados: 0, motivo: e.message }; }

  const recado = JSON.stringify({ titulo: titulo, texto: texto, endereco: endereco });
  let enviados = 0, sumiram = 0;

  for (const inscrito of inscritos) {
    try {
      const status = await enviarPara(inscrito, recado);
      if (status === 404 || status === 410) {
        await apagarInscricao(inscrito.endpoint);
        sumiram += 1;
      } else if (status >= 200 && status < 300) {
        enviados += 1;
      }
    } catch (e) {
      console.error("Aviso falhou:", e.message);
    }
  }
  return { enviados: enviados, sumiram: sumiram, total: inscritos.length };
}

module.exports = {
  temChaves, gerarChaves, chavePublica: () => CHAVES.publica,
  assinarVapid, criptografar, enviarPara,
  listarInscricoes, guardarInscricao, apagarInscricao, avisarTodos,
  paraBase64Url, deBase64Url
};
