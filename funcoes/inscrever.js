// POST /api/inscrever — guarda o aparelho que quer receber aviso de álbum novo.
// Sem chave: quem chama é a própria pessoa, do navegador dela.
const { corpoDoPedido, limpar, resposta } = require("./lib/comum");
const { guardarInscricao, apagarInscricao, temChaves } = require("./lib/aviso");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return resposta(405, { erro: "Método não permitido." }, null, { "Allow": "POST" });
  }
  if (!temChaves()) return resposta(503, { erro: "Avisos ainda não configurados." });

  const corpo = corpoDoPedido(event);
  if (!corpo) return resposta(400, { erro: "Pedido inválido." });

  const endpoint = limpar(corpo.endpoint, 500);
  // Só aceita endereço dos serviços de push de verdade.
  if (!/^https:\/\/[a-z0-9.-]+\//i.test(endpoint)) {
    return resposta(400, { erro: "Endereço de aviso inválido." });
  }

  // Sair da lista
  if (corpo.sair) {
    try { await apagarInscricao(endpoint); } catch (e) { /* já não estava */ }
    return resposta(200, { ok: true });
  }

  const p256dh = limpar(corpo.p256dh, 200);
  const auth = limpar(corpo.auth, 100);
  if (!p256dh || !auth) return resposta(400, { erro: "Faltam as chaves do aparelho." });

  try {
    await guardarInscricao({ endpoint: endpoint, p256dh: p256dh, auth: auth });
    return resposta(201, { ok: true });
  } catch (e) {
    console.error("Falha ao inscrever:", e.message);
    return resposta(502, { erro: "Não consegui guardar o aviso agora." });
  }
};
