// Ponte entre a Vercel e as funções do site.
//
// As funções em netlify/functions/ falam o formato "evento -> resposta".
// A Vercel fala "req, res". Este arquivo traduz um no outro, para o código
// que já está testado continuar valendo em qualquer uma das duas hospedagens.
//
// O nome do arquivo entre colchetes faz a Vercel mandar para cá tudo que
// chegar em /api/qualquer-coisa, e o pedaço final vem em req.query.rota.
const rotas = {
  "albuns":         require("../netlify/functions/albuns"),
  "album":          require("../netlify/functions/album"),
  "visita":         require("../netlify/functions/visita"),
  "painel":         require("../netlify/functions/painel"),
  "painel-fotos":   require("../netlify/functions/painel-fotos"),
  "album-salvar":   require("../netlify/functions/album-salvar"),
  "album-apagar":   require("../netlify/functions/album-apagar"),
  "album-capa":     require("../netlify/functions/album-capa"),
  "upload-url":     require("../netlify/functions/upload-url"),
  "foto-registrar": require("../netlify/functions/foto-registrar"),
  "foto-apagar":    require("../netlify/functions/foto-apagar"),
  "diagnostico":    require("../netlify/functions/diagnostico")
};

module.exports = async (req, res) => {
  const nome = String((req.query && req.query.rota) || "");
  const funcao = rotas[nome];
  if (!funcao) {
    res.status(404).json({ erro: "Rota não encontrada." });
    return;
  }

  // A Vercel já transforma JSON em objeto; as funções esperam texto.
  let corpo = "";
  if (typeof req.body === "string") corpo = req.body;
  else if (req.body && Object.keys(req.body).length) corpo = JSON.stringify(req.body);

  const consulta = Object.assign({}, req.query);
  delete consulta.rota;   // "rota" é da Vercel, não do pedido

  try {
    const r = await funcao.handler({
      httpMethod: req.method,
      body: corpo,
      queryStringParameters: consulta,
      isBase64Encoded: false
    });
    Object.keys(r.headers || {}).forEach(function (h) { res.setHeader(h, r.headers[h]); });
    res.status(r.statusCode).send(r.body);
  } catch (e) {
    console.error("Falha na rota " + nome + ":", e.message);
    res.status(500).json({ erro: "Erro no servidor." });
  }
};
