/* Servidor de TESTE, só para rodar no seu computador (node dev-local.js).
   Ele imita a Netlify, o banco do Supabase e o lugar onde as fotos ficam
   guardadas, para você conferir o site antes de publicar. Nada aqui vai
   para o ar: a Netlify publica apenas a pasta site/.
   As fotos enviadas no teste ficam na pasta .dev-fotos/ deste computador. */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORTA = 8888;
const CHAVE_TESTE = "chave-de-teste";
const PASTA_FOTOS = path.join(__dirname, ".dev-fotos");

// Se existir um arquivo .env aqui do lado, ele manda. Assim dá para testar
// contra o Supabase de verdade antes de publicar. Sem .env, o servidor usa
// um Supabase de mentira e não precisa de internet nem de conta.
try {
  fs.readFileSync(path.join(__dirname, ".env"), "utf8").split(/\r?\n/).forEach(function (linha) {
    const corte = linha.indexOf("=");
    if (corte < 1 || linha.trim()[0] === "#") return;
    const nome = linha.slice(0, corte).trim();
    const valor = linha.slice(corte + 1).trim().replace(/^["']|["']$/g, "");
    if (nome && valor) process.env[nome] = valor;
  });
} catch (e) { /* sem .env: segue no modo faz-de-conta */ }

const DE_MENTIRA = !process.env.SUPABASE_URL;
if (DE_MENTIRA) {
  process.env.SUPABASE_URL = "http://127.0.0.1:" + PORTA + "/faz-de-conta";
  process.env.SUPABASE_SERVICE_KEY = "servico-de-teste";
}
if (!process.env.PAINEL_KEY) process.env.PAINEL_KEY = CHAVE_TESTE;

const funcoes = {
  "albuns": require("./funcoes/albuns"),
  "album": require("./funcoes/album"),
  "painel": require("./funcoes/painel"),
  "painel-fotos": require("./funcoes/painel-fotos"),
  "album-salvar": require("./funcoes/album-salvar"),
  "album-apagar": require("./funcoes/album-apagar"),
  "album-capa": require("./funcoes/album-capa"),
  "upload-url": require("./funcoes/upload-url"),
  "foto-registrar": require("./funcoes/foto-registrar"),
  "foto-apagar": require("./funcoes/foto-apagar"),
  "diagnostico": require("./funcoes/diagnostico"),
  "visita": require("./funcoes/visita"),
  "chave-aviso": require("./funcoes/chave-aviso"),
  "inscrever": require("./funcoes/inscrever"),
  "avisar": require("./funcoes/avisar")
};

// ================= banco de mentira, só na memória =================
const banco = { albuns: [], fotos: [], inscricoes: [] };
const proximo = { albuns: 1, fotos: 1, inscricoes: 1 };

banco.albuns.push({
  id: proximo.albuns++,
  slug: "culto-de-domingo",
  titulo: "Culto de Domingo",
  data_evento: new Date().toISOString().slice(0, 10),
  descricao: "Álbum de exemplo criado pelo servidor de teste.",
  capa: null,
  publicado: true,
  criado_em: new Date().toISOString()
});

function filtrar(tabela, url) {
  let linhas = banco[tabela].slice();
  url.searchParams.forEach(function (valor, campo) {
    if (["select", "order", "limit", "offset"].indexOf(campo) !== -1) return;
    const partes = String(valor).split(".");
    const jeito = partes.shift();
    const alvo = partes.join(".");
    linhas = linhas.filter(function (linha) {
      const tem = String(linha[campo]);
      if (jeito === "eq") return tem === alvo;
      if (jeito === "neq") return tem !== alvo;
      return true;
    });
  });

  const ordem = url.searchParams.get("order");
  if (ordem) {
    const regras = ordem.split(",").map(function (r) {
      const p = r.split(".");
      return { campo: p[0], desc: p[1] === "desc" };
    });
    linhas.sort(function (a, b) {
      for (const regra of regras) {
        const x = String(a[regra.campo] || ""), y = String(b[regra.campo] || "");
        if (x !== y) return regra.desc ? y.localeCompare(x) : x.localeCompare(y);
      }
      return 0;
    });
  }
  return linhas;
}

function corpoDe(req) {
  return new Promise(function (resolve) {
    const pedacos = [];
    req.on("data", function (p) { pedacos.push(p); });
    req.on("end", function () { resolve(Buffer.concat(pedacos)); });
  });
}

function guardarArquivo(caminho, dados) {
  const destino = path.join(PASTA_FOTOS, caminho);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, dados);
}

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js":  "text/javascript; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4":  "video/mp4",
  ".json": "application/json; charset=utf-8"
};

const servidor = http.createServer(async function (req, res) {
  const url = new URL(req.url, "http://" + req.headers.host);
  const rota = decodeURIComponent(url.pathname);

  // O Supabase de verdade libera o envio direto do navegador; aqui imitamos
  // isso, senão o teste local esbarra em CORS ao mandar a foto.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }

  // a funcao contar_visita do banco
  if (rota === "/faz-de-conta/rest/v1/rpc/contar_visita" && req.method === "POST") {
    const pedido = JSON.parse((await corpoDe(req)).toString());
    const alvo = banco.albuns.filter(function (a) { return a.slug === pedido.p_slug; })[0];
    if (alvo) alvo.visitas = (alvo.visitas || 0) + 1;
    res.writeHead(204).end();
    return;
  }

  // ---------------- banco de mentira ----------------
  const tabela = rota.replace("/faz-de-conta/rest/v1/", "");
  if (rota.indexOf("/faz-de-conta/rest/v1/") === 0 && banco[tabela]) {
    if (req.method === "POST") {
      const novo = JSON.parse((await corpoDe(req)).toString());
      novo.id = proximo[tabela]++;
      novo.criado_em = new Date().toISOString();
      banco[tabela].push(novo);
      res.writeHead(201, { "Content-Type": "application/json" }).end(JSON.stringify([novo]));
      return;
    }
    if (req.method === "PATCH") {
      const mudanca = JSON.parse((await corpoDe(req)).toString());
      const alvos = filtrar(tabela, url);
      alvos.forEach(function (linha) { Object.assign(linha, mudanca); });
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(alvos));
      return;
    }
    if (req.method === "DELETE") {
      const alvos = filtrar(tabela, url);
      banco[tabela] = banco[tabela].filter(function (l) { return alvos.indexOf(l) === -1; });
      // imita o "on delete cascade": apagar álbum apaga as fotos dele
      if (tabela === "albuns") {
        const ids = alvos.map(function (a) { return a.id; });
        banco.fotos = banco.fotos.filter(function (f) { return ids.indexOf(f.album_id) === -1; });
      }
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(alvos));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(filtrar(tabela, url)));
    return;
  }

  // ---------------- armazenamento de mentira ----------------
  if (rota.indexOf("/faz-de-conta/storage/v1/") === 0) {
    const resto = rota.replace("/faz-de-conta/storage/v1/", "");

    if (resto.indexOf("bucket/") === 0) {
      res.writeHead(200, { "Content-Type": "application/json" }).end('{"name":"fotos"}');
      return;
    }

    // pedir endereço de envio
    if (req.method === "POST" && resto.indexOf("object/upload/sign/fotos/") === 0) {
      const caminho = resto.replace("object/upload/sign/fotos/", "");
      res.writeHead(200, { "Content-Type": "application/json" })
         .end(JSON.stringify({ url: "/object/upload/sign/fotos/" + caminho + "?token=teste" }));
      return;
    }
    // enviar de fato
    if (req.method === "PUT" && resto.indexOf("object/upload/sign/fotos/") === 0) {
      const caminho = resto.replace("object/upload/sign/fotos/", "");
      guardarArquivo(caminho, await corpoDe(req));
      console.log("  + foto guardada em .dev-fotos/" + caminho);
      res.writeHead(200, { "Content-Type": "application/json" }).end('{"Key":"' + caminho + '"}');
      return;
    }
    // assinar leitura em lote
    if (req.method === "POST" && resto === "object/sign/fotos") {
      const pedido = JSON.parse((await corpoDe(req)).toString());
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(
        (pedido.paths || []).map(function (p) {
          return { path: p, signedURL: "/object/sign/fotos/" + p + "?token=teste" };
        })
      ));
      return;
    }
    // servir a foto
    if (req.method === "GET" && resto.indexOf("object/sign/fotos/") === 0) {
      const caminho = resto.replace("object/sign/fotos/", "");
      const arquivo = path.join(PASTA_FOTOS, caminho);
      fs.readFile(arquivo, function (erro, conteudo) {
        if (erro) { res.writeHead(404).end("sem foto"); return; }
        const cabecalhos = { "Content-Type": TIPOS[path.extname(arquivo)] || "image/jpeg" };
        const baixar = url.searchParams.get("download");
        if (baixar) cabecalhos["Content-Disposition"] = 'attachment; filename="' + baixar + '"';
        res.writeHead(200, cabecalhos).end(conteudo);
      });
      return;
    }
    // apagar
    if (req.method === "DELETE" && resto === "object/fotos") {
      const pedido = JSON.parse((await corpoDe(req)).toString());
      (pedido.prefixes || []).forEach(function (p) {
        try { fs.unlinkSync(path.join(PASTA_FOTOS, p)); } catch (e) { /* já não existia */ }
      });
      res.writeHead(200, { "Content-Type": "application/json" }).end("[]");
      return;
    }

    res.writeHead(404).end("storage de teste: rota desconhecida " + resto);
    return;
  }

  // ---------------- funções da Netlify ----------------
  if (rota.indexOf("/api/") === 0) {
    const nome = rota.slice(5);
    const funcao = funcoes[nome];
    if (!funcao) { res.writeHead(404).end("função não encontrada"); return; }

    const evento = {
      httpMethod: req.method,
      body: (await corpoDe(req)).toString(),
      queryStringParameters: Object.fromEntries(url.searchParams)
    };
    const r = await funcao.handler(evento);
    console.log("  " + req.method + " " + rota + " -> " + r.statusCode);
    res.writeHead(r.statusCode, r.headers || {}).end(r.body);
    return;
  }

  // ---------------- arquivos do site ----------------
  let arquivo = rota === "/" ? "/index.html" : rota;
  if (rota.indexOf("/painel") === 0) arquivo = "/painel.html";
  if (rota.indexOf("/album/") === 0) arquivo = "/album.html";

  const caminho = path.join(__dirname, "site", arquivo);
  fs.readFile(caminho, function (erro, conteudo) {
    if (erro) { res.writeHead(404).end("não encontrado"); return; }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(caminho)] || "application/octet-stream" });
    res.end(conteudo);
  });
});

servidor.listen(PORTA, function () {
  console.log("\n  Banco e fotos: " + (DE_MENTIRA
    ? "de mentira, só na memória (sem .env)"
    : "Supabase de verdade — " + process.env.SUPABASE_URL));
  console.log("\n  Galeria da igreja:  http://localhost:" + PORTA + "/");
  console.log("  Painel das fotos:   http://localhost:" + PORTA + "/painel/" + process.env.PAINEL_KEY);
  console.log("  Diagnóstico:        http://localhost:" + PORTA + "/api/diagnostico\n");
});
