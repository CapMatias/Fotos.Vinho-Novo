// Conversa com o banco (tabelas albuns e fotos) e confere a chave do painel.
// A chave do Supabase fica só aqui no servidor; o navegador nunca a enxerga.
const crypto = require("crypto");

function ambiente() {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !chave) {
    throw new Error("Faltam as variáveis SUPABASE_URL / SUPABASE_SERVICE_KEY na Netlify.");
  }
  return { url: url.replace(/\/$/, ""), chave: chave };
}

function cabecalhos(extra) {
  const { chave } = ambiente();
  return Object.assign({
    "apikey": chave,
    "Authorization": "Bearer " + chave
  }, extra || {});
}

// Confere a chave secreta do painel sem dar pistas pelo tempo de resposta.
function chaveConfere(recebida) {
  const esperada = process.env.PAINEL_KEY || "";
  if (!esperada || !recebida) return false;
  const a = Buffer.from(String(recebida));
  const b = Buffer.from(esperada);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Chamada crua ao PostgREST do Supabase.
async function banco(caminho, opcoes) {
  const { url } = ambiente();
  const o = opcoes || {};
  const r = await fetch(url + "/rest/v1/" + caminho, {
    method: o.method || "GET",
    headers: cabecalhos(Object.assign(
      o.body ? { "Content-Type": "application/json" } : {},
      { "Prefer": o.prefer || "return=representation" },
      o.headers || {}
    )),
    body: o.body ? JSON.stringify(o.body) : undefined
  });
  const texto = await r.text();
  if (!r.ok) throw new Error("Supabase respondeu " + r.status + ": " + texto);
  try { return texto ? JSON.parse(texto) : null; } catch (e) { return null; }
}

// O Supabase devolve no máximo 1000 linhas por consulta. Esta função vai
// buscando de mil em mil até acabar, para álbuns com muitas fotos.
async function bancoTudo(caminho) {
  const PASSO = 1000;
  let de = 0;
  let tudo = [];
  for (;;) {
    const pagina = await banco(caminho + "&limit=" + PASSO + "&offset=" + de);
    if (!Array.isArray(pagina) || !pagina.length) break;
    tudo = tudo.concat(pagina);
    if (pagina.length < PASSO || tudo.length >= 100000) break;
    de += PASSO;
  }
  return tudo;
}

// ---------------------------------------------------------------- álbuns

// Lista os álbuns. Sem chave, só os publicados.
async function listarAlbuns(incluirOcultos) {
  const filtro = incluirOcultos ? "" : "&publicado=eq.true";
  return bancoTudo("albuns?select=*" + filtro + "&order=data_evento.desc,criado_em.desc");
}

async function acharAlbum(slug) {
  const lista = await banco("albuns?select=*&slug=eq." + encodeURIComponent(slug) + "&limit=1");
  return Array.isArray(lista) && lista.length ? lista[0] : null;
}

async function acharAlbumPorId(id) {
  const lista = await banco("albuns?select=*&id=eq." + encodeURIComponent(id) + "&limit=1");
  return Array.isArray(lista) && lista.length ? lista[0] : null;
}

async function criarAlbum(dados) {
  const criado = await banco("albuns", { method: "POST", body: dados });
  return Array.isArray(criado) ? criado[0] : criado;
}

async function editarAlbum(id, dados) {
  const mudou = await banco("albuns?id=eq." + encodeURIComponent(id), { method: "PATCH", body: dados });
  return Array.isArray(mudou) ? mudou[0] : mudou;
}

async function apagarAlbum(id) {
  const saiu = await banco("albuns?id=eq." + encodeURIComponent(id), { method: "DELETE" });
  return Array.isArray(saiu) ? saiu.length : 0;
}

// ----------------------------------------------------------------- fotos

async function listarFotos(albumId) {
  return bancoTudo("fotos?select=*&album_id=eq." + encodeURIComponent(albumId) +
                   "&order=criado_em.asc");
}

// Quantas fotos cada álbum tem, em uma consulta só.
async function contarFotos() {
  const linhas = await bancoTudo("fotos?select=album_id&order=id.asc");
  const conta = {};
  (linhas || []).forEach(function (l) {
    conta[l.album_id] = (conta[l.album_id] || 0) + 1;
  });
  return conta;
}

async function gravarFoto(dados) {
  const criada = await banco("fotos", { method: "POST", body: dados });
  return Array.isArray(criada) ? criada[0] : criada;
}

async function acharFoto(id) {
  const lista = await banco("fotos?select=*&id=eq." + encodeURIComponent(id) + "&limit=1");
  return Array.isArray(lista) && lista.length ? lista[0] : null;
}

async function apagarFoto(id) {
  const saiu = await banco("fotos?id=eq." + encodeURIComponent(id), { method: "DELETE" });
  return Array.isArray(saiu) ? saiu.length : 0;
}

// --------------------------------------------------------------- comuns

// Lê o corpo do pedido. A Netlify às vezes entrega em base64.
function corpoDoPedido(event) {
  const bruto = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : (event.body || "");
  try { return JSON.parse(bruto || "{}"); } catch (e) { return null; }
}

function limpar(valor, max) {
  // normalize("NFC") junta letra + acento: alguns teclados de celular separam
  return String(valor == null ? "" : valor).normalize("NFC").trim().replace(/\s+/g, " ").slice(0, max);
}

// "Batismo no Rio — 12/2026" vira "batismo-no-rio-12-2026"
function apelido(texto) {
  return String(texto || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "album";
}

function resposta(statusCode, corpo, tipo, extra) {
  return {
    statusCode: statusCode,
    headers: Object.assign({
      "Content-Type": tipo || "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }, extra || {}),
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo)
  };
}

// Toda função do painel começa igual: precisa ser POST e trazer a chave certa.
function guarda(event) {
  if (event.httpMethod !== "POST") {
    return { erro: resposta(405, { erro: "Método não permitido." }, null, { "Allow": "POST" }) };
  }
  const corpo = corpoDoPedido(event);
  if (!corpo) return { erro: resposta(400, { erro: "Pedido em formato inválido." }) };
  if (!chaveConfere(corpo.chave)) return { erro: resposta(401, { erro: "Chave inválida." }) };
  return { corpo: corpo };
}

module.exports = {
  ambiente, cabecalhos, chaveConfere, banco, bancoTudo, guarda,
  listarAlbuns, acharAlbum, acharAlbumPorId, criarAlbum, editarAlbum, apagarAlbum,
  listarFotos, contarFotos, gravarFoto, acharFoto, apagarFoto,
  corpoDoPedido, limpar, apelido, resposta
};
