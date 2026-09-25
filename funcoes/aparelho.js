// POST /api/aparelho — marca presença de um aparelho que abriu o site como
// aplicativo (ícone na tela de início).
//
// Nem o iPhone nem o Android avisam quando alguém adiciona o site à tela de
// início. O que dá para saber é quando o site abre em modo aplicativo: a
// página manda a marca sorteada pelo próprio aparelho, uma vez por dia.
// Nenhum dado pessoal: a marca é um número aleatório, sem nome nem telefone.
//
// Sem chave de propósito: quem chama é a página pública.
const { banco, limpar, corpoDoPedido, resposta } = require("./lib/comum");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return resposta(405, { erro: "Método não permitido." }, null, { "Allow": "POST" });
  }

  const corpo = corpoDoPedido(event) || {};
  const marca = limpar(corpo.marca, 64).replace(/[^A-Za-z0-9-]/g, "");
  const sistema = limpar(corpo.sistema, 12).toLowerCase().replace(/[^a-z]/g, "");
  if (marca.length < 8) return resposta(400, { erro: "Faltou a marca do aparelho." });

  try {
    // Aparelho que já existe só tem o "visto_em" atualizado.
    await banco("aparelhos?on_conflict=marca", {
      method: "POST",
      body: [{ marca: marca, sistema: sistema || "outro", visto_em: new Date().toISOString() }],
      prefer: "resolution=merge-duplicates,return=minimal"
    });
    return resposta(200, { ok: true });
  } catch (e) {
    // Contagem é enfeite: se falhar, o site abre igual.
    console.error("Falha ao contar aparelho:", e.message);
    return resposta(200, { ok: false });
  }
};
