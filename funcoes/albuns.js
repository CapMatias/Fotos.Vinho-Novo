// GET /api/albuns — a lista de álbuns que aparece na página inicial.
// Só devolve os álbuns publicados; os escondidos ficam para o painel.
const { listarAlbuns, contarFotos, resposta } = require("./lib/comum");
const { urlsDeLeitura } = require("./lib/armazenamento");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return resposta(405, { erro: "Método não permitido." }, null, { "Allow": "GET" });
  }
  try {
    const albuns = await listarAlbuns(false);
    const contas = await contarFotos();
    const capas = await urlsDeLeitura(albuns.map((a) => a.capa).filter(Boolean), 21600);

    return resposta(200, {
      albuns: albuns.map((a) => ({
        slug: a.slug,
        titulo: a.titulo,
        data_evento: a.data_evento,
        descricao: a.descricao || "",
        capa: a.capa ? (capas[a.capa] || null) : null,
        fotos: contas[a.id] || 0
      }))
    });
  } catch (e) {
    console.error("Falha ao listar álbuns:", e.message);
    return resposta(502, { erro: "Não consegui carregar os álbuns agora." });
  }
};
