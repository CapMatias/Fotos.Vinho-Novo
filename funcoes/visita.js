// POST /api/visita — soma 1 no contador do álbum.
// Sem chave de propósito: quem chama é a página pública. A própria tela só
// chama uma vez por aparelho, então o número aproxima "pessoas", não cliques.
const { ambiente, cabecalhos, limpar, corpoDoPedido, resposta } = require("./lib/comum");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return resposta(405, { erro: "Método não permitido." }, null, { "Allow": "POST" });
  }
  const corpo = corpoDoPedido(event);
  const slug = corpo ? limpar(corpo.slug, 80) : "";
  if (!slug) return resposta(400, { erro: "Faltou o álbum." });

  try {
    const { url } = ambiente();
    const r = await fetch(url + "/rest/v1/rpc/contar_visita", {
      method: "POST",
      headers: cabecalhos({ "Content-Type": "application/json" }),
      body: JSON.stringify({ p_slug: slug })
    });
    if (!r.ok) throw new Error("Supabase respondeu " + r.status + ": " + (await r.text()));
    return resposta(200, { ok: true });
  } catch (e) {
    // Contador é enfeite: se falhar, ninguém fica sabendo e o álbum abre igual.
    console.error("Falha ao contar visita:", e.message);
    return resposta(200, { ok: false });
  }
};
