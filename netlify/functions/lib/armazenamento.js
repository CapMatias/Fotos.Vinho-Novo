// Onde as fotos ficam guardadas.
//
// Três lugares possíveis, escolhidos pelas variáveis de ambiente. Vale o
// primeiro que estiver configurado:
//
//   • Cloudinary — CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY /
//     CLOUDINARY_API_SECRET. 25 GB grátis e cadastro sem cartão.
//   • Cloudflare R2 — R2_ACCOUNT_ID / R2_ACCESS_KEY_ID /
//     R2_SECRET_ACCESS_KEY / R2_BUCKET. 10 GB, mas o cadastro pede cartão.
//   • Supabase Storage (padrão) — nada a configurar além do que o site já usa.
//
// O navegador nunca recebe chave nenhuma: ele só recebe endereços assinados,
// que valem por alguns minutos e servem para um arquivo só.
const crypto = require("crypto");
const { ambiente, cabecalhos } = require("./comum");

const BUCKET = process.env.SUPABASE_BUCKET || "fotos";
const R2 = {
  conta:  process.env.R2_ACCOUNT_ID || "",
  id:     process.env.R2_ACCESS_KEY_ID || "",
  chave:  process.env.R2_SECRET_ACCESS_KEY || "",
  bucket: process.env.R2_BUCKET || ""
};
const NUVEM = {
  nome:    process.env.CLOUDINARY_CLOUD_NAME || "",
  chave:   process.env.CLOUDINARY_API_KEY || "",
  segredo: process.env.CLOUDINARY_API_SECRET || ""
};
const usaCloudinary = !!(NUVEM.nome && NUVEM.chave && NUVEM.segredo);
const usaR2 = !usaCloudinary && !!(R2.conta && R2.id && R2.chave && R2.bucket);

function onde() {
  if (usaCloudinary) return "Cloudinary";
  return usaR2 ? "Cloudflare R2" : "Supabase Storage";
}

// Maior arquivo aceito. O plano grátis do Cloudinary para em 10 MB por imagem.
function limiteBytes() { return usaCloudinary ? 10 * 1024 * 1024 : 25 * 1024 * 1024; }

// ===================================================================
//  Assinatura da Amazon (SigV4) — é o que o R2 entende.
// ===================================================================
function hmac(chave, texto) { return crypto.createHmac("sha256", chave).update(texto, "utf8").digest(); }
function sha256(texto) { return crypto.createHash("sha256").update(texto, "utf8").digest("hex"); }

// Codifica para URL do jeito rígido que a assinatura exige.
function esc(texto) {
  return encodeURIComponent(texto).replace(/[!'()*]/g, function (c) {
    return "%" + c.charCodeAt(0).toString(16).toUpperCase();
  });
}
function escCaminho(caminho) {
  return String(caminho).split("/").map(esc).join("/");
}

function assinarR2(metodo, caminho, segundos, extras) {
  const host = R2.conta + ".r2.cloudflarestorage.com";
  const agora = new Date();
  const data = agora.toISOString().replace(/[:-]|\.\d{3}/g, "");   // 20260907T131500Z
  const dia = data.slice(0, 8);
  const escopo = dia + "/auto/s3/aws4_request";

  const params = Object.assign({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": R2.id + "/" + escopo,
    "X-Amz-Date": data,
    "X-Amz-Expires": String(segundos),
    "X-Amz-SignedHeaders": "host"
  }, extras || {});

  const consulta = Object.keys(params).sort().map(function (k) {
    return esc(k) + "=" + esc(params[k]);
  }).join("&");

  const rota = "/" + R2.bucket + (caminho ? "/" + escCaminho(caminho) : "");
  const pedido = [metodo, rota, consulta, "host:" + host + "\n", "host", "UNSIGNED-PAYLOAD"].join("\n");
  const paraAssinar = ["AWS4-HMAC-SHA256", data, escopo, sha256(pedido)].join("\n");

  const k1 = hmac("AWS4" + R2.chave, dia);
  const k2 = hmac(k1, "auto");
  const k3 = hmac(k2, "s3");
  const k4 = hmac(k3, "aws4_request");
  const assinatura = crypto.createHmac("sha256", k4).update(paraAssinar, "utf8").digest("hex");

  return "https://" + host + rota + "?" + consulta + "&X-Amz-Signature=" + assinatura;
}

// ===================================================================
//  Cloudinary
//
//  Lá o arquivo é identificado por um "public_id" (o caminho sem a
//  extensão) e o endereço de leitura é fixo — não precisa assinar para
//  mostrar. O que exige assinatura é enviar e apagar.
// ===================================================================
function idPublico(caminho) { return String(caminho).replace(/\.[^./]+$/, ""); }

function extensaoDe(caminho) {
  const achou = /\.([^./]+)$/.exec(String(caminho));
  return achou ? achou[1] : "jpg";
}

// Assinatura do Cloudinary: parâmetros em ordem alfabética + o segredo, em SHA-1.
function assinarNuvem(params) {
  const base = Object.keys(params).sort().map(function (k) {
    return k + "=" + params[k];
  }).join("&");
  return crypto.createHash("sha1").update(base + NUVEM.segredo, "utf8").digest("hex");
}

// fl_attachment faz o navegador salvar em vez de abrir; o nome vai sem extensão.
function nomeParaAnexo(nome) {
  return String(nome).replace(/\.[^./]+$/, "").replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 80) || "foto";
}

function entregaNuvem(caminho, transformacao) {
  return "https://res.cloudinary.com/" + NUVEM.nome + "/image/upload/" +
         (transformacao ? transformacao + "/" : "") +
         idPublico(caminho) + "." + extensaoDe(caminho);
}

async function apagarNaNuvem(caminho) {
  const params = { public_id: idPublico(caminho), timestamp: Math.floor(Date.now() / 1000) };
  const corpo = new URLSearchParams(Object.assign({}, params, {
    api_key: NUVEM.chave,
    signature: assinarNuvem(params)
  }));
  const r = await fetch("https://api.cloudinary.com/v1_1/" + NUVEM.nome + "/image/destroy", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: corpo.toString()
  });
  if (!r.ok) throw new Error("Cloudinary respondeu " + r.status + " ao apagar " + caminho);
}

// ===================================================================
//  Enviar: o painel pede um endereço, o navegador manda o arquivo direto
//  para lá. O arquivo não passa pelo servidor do site — por isso não
//  esbarra no limite de tamanho das funções da Netlify.
// ===================================================================
async function urlDeEnvio(caminho, tipo) {
  if (usaCloudinary) {
    // O Cloudinary recebe um formulário, não um PUT cru: por isso "campos".
    const params = { public_id: idPublico(caminho), timestamp: Math.floor(Date.now() / 1000) };
    return {
      url: "https://api.cloudinary.com/v1_1/" + NUVEM.nome + "/image/upload",
      metodo: "POST",
      cabecalhos: {},
      campos: Object.assign({}, params, {
        api_key: NUVEM.chave,
        signature: assinarNuvem(params)
      })
    };
  }
  if (usaR2) {
    return { url: assinarR2("PUT", caminho, 900), metodo: "PUT", cabecalhos: { "Content-Type": tipo } };
  }
  const { url } = ambiente();
  const r = await fetch(url + "/storage/v1/object/upload/sign/" + BUCKET + "/" + escCaminho(caminho), {
    method: "POST",
    headers: cabecalhos({ "Content-Type": "application/json" }),
    body: "{}"
  });
  if (!r.ok) throw new Error("Storage respondeu " + r.status + ": " + (await r.text()));
  const dado = await r.json();
  return {
    url: url + "/storage/v1" + dado.url,
    metodo: "PUT",
    cabecalhos: { "Content-Type": tipo, "x-upsert": "true" }
  };
}

// ===================================================================
//  Ler: endereços temporários para mostrar a foto na tela ou baixar.
//  "nomeParaBaixar" faz o navegador salvar o arquivo em vez de só abrir.
// ===================================================================
async function urlsDeLeitura(caminhos, segundos, nomeParaBaixar) {
  const limpos = (caminhos || []).filter(Boolean);
  const saida = {};
  if (!limpos.length) return saida;
  const validade = segundos || 3600;

  if (usaCloudinary) {
    limpos.forEach(function (c) {
      // Para ver: q_auto,f_auto entrega a foto no formato leve que o celular
      // aceita (economiza internet). Para baixar: o arquivo original, inteiro.
      saida[c] = nomeParaBaixar
        ? entregaNuvem(c, "fl_attachment:" + nomeParaAnexo(nomeParaBaixar(c)))
        : entregaNuvem(c, "q_auto,f_auto");
    });
    return saida;
  }

  if (usaR2) {
    limpos.forEach(function (c) {
      const extras = nomeParaBaixar
        ? { "response-content-disposition": "attachment; filename=\"" + String(nomeParaBaixar(c)).replace(/"/g, "") + "\"" }
        : null;
      saida[c] = assinarR2("GET", c, validade, extras);
    });
    return saida;
  }

  const { url } = ambiente();
  // O Supabase assina um lote por vez; vamos de 500 em 500.
  for (let i = 0; i < limpos.length; i += 500) {
    const lote = limpos.slice(i, i + 500);
    const r = await fetch(url + "/storage/v1/object/sign/" + BUCKET, {
      method: "POST",
      headers: cabecalhos({ "Content-Type": "application/json" }),
      body: JSON.stringify({ expiresIn: validade, paths: lote })
    });
    if (!r.ok) throw new Error("Storage respondeu " + r.status + ": " + (await r.text()));
    (await r.json()).forEach(function (item) {
      if (!item.signedURL) return;
      const caminho = String(item.path || "").replace(/^\/+/, "");
      let endereco = url + "/storage/v1" + item.signedURL;
      if (nomeParaBaixar) endereco += "&download=" + encodeURIComponent(nomeParaBaixar(caminho));
      saida[caminho] = endereco;
    });
  }
  return saida;
}

async function urlDeLeitura(caminho, segundos, baixarComo) {
  const lista = await urlsDeLeitura(
    [caminho],
    segundos,
    baixarComo ? function () { return baixarComo; } : null
  );
  return lista[caminho] || null;
}

// ===================================================================
//  Apagar
// ===================================================================
async function apagarArquivos(caminhos) {
  const limpos = (caminhos || []).filter(Boolean);
  if (!limpos.length) return;

  if (usaCloudinary) {
    for (const c of limpos) await apagarNaNuvem(c);
    return;
  }

  if (usaR2) {
    for (const c of limpos) {
      const r = await fetch(assinarR2("DELETE", c, 300), { method: "DELETE" });
      if (!r.ok && r.status !== 404) throw new Error("R2 respondeu " + r.status + " ao apagar " + c);
    }
    return;
  }

  const { url } = ambiente();
  const r = await fetch(url + "/storage/v1/object/" + BUCKET, {
    method: "DELETE",
    headers: cabecalhos({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prefixes: limpos })
  });
  if (!r.ok) throw new Error("Storage respondeu " + r.status + ": " + (await r.text()));
}

// Confere se o lugar de guardar as fotos está de pé (usado no diagnóstico).
async function testar() {
  if (usaCloudinary) {
    const cracha = Buffer.from(NUVEM.chave + ":" + NUVEM.segredo).toString("base64");
    const r = await fetch("https://api.cloudinary.com/v1_1/" + NUVEM.nome + "/resources/image?max_results=1",
                          { headers: { "Authorization": "Basic " + cracha } });
    if (!r.ok) {
      // O texto do Cloudinary diz se o problema é a chave, o segredo ou a nuvem.
      // Nunca ecoar o valor configurado: se alguém colar a chave secreta na
      // variável errada, ela não pode vazar por uma página pública.
      const recado = (await r.text()).replace(/\s+/g, " ").slice(0, 100);
      const pista = /^[a-z0-9_-]+$/i.test(NUVEM.nome)
        ? "o nome da nuvem tem formato válido"
        : "ATENCAO: o CLOUDINARY_CLOUD_NAME nao parece um nome de nuvem (deve ser so o apelido, ex: nhusipwg)";
      throw new Error("Cloudinary respondeu " + r.status + " — " + pista + ". Resposta: " + recado);
    }
    return "Cloudinary, nuvem " + NUVEM.nome;
  }
  if (usaR2) {
    const r = await fetch(assinarR2("GET", "", 60, { "list-type": "2", "max-keys": "1" }));
    if (!r.ok) throw new Error("R2 respondeu " + r.status);
    return "Cloudflare R2, balde " + R2.bucket;
  }
  const { url } = ambiente();
  const r = await fetch(url + "/storage/v1/bucket/" + BUCKET, { headers: cabecalhos() });
  if (!r.ok) {
    throw new Error("Storage respondeu " + r.status + " — o balde \"" + BUCKET + "\" existe? Rode o supabase.sql.");
  }
  return "Supabase Storage, balde " + BUCKET;
}

module.exports = { onde, limiteBytes, urlDeEnvio, urlDeLeitura, urlsDeLeitura, apagarArquivos, testar, BUCKET };
