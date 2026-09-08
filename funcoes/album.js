// GET /api/album?slug=batismo-2026 — as fotos de um álbum.
// Cada foto vai com três endereços temporários: a miniatura (para a grade),
// a foto inteira (para ver de perto) e o link que salva o arquivo no aparelho.
const { acharAlbum, listarFotos, resposta } = require("./lib/comum");
const { urlsDeLeitura } = require("./lib/armazenamento");

const SEIS_HORAS = 21600;

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return resposta(405, { erro: "Método não permitido." }, null, { "Allow": "GET" });
  }
  const slug = String((event.queryStringParameters || {}).slug || "").slice(0, 80);
  if (!slug) return resposta(400, { erro: "Faltou dizer qual álbum." });

  try {
    const album = await acharAlbum(slug);
    if (!album || !album.publicado) return resposta(404, { erro: "Álbum não encontrado." });

    const fotos = await listarFotos(album.id);
    const porCaminho = {};
    fotos.forEach((f) => { porCaminho[f.caminho] = f; });

    const grandes = await urlsDeLeitura(fotos.map((f) => f.caminho), SEIS_HORAS);
    const minis = await urlsDeLeitura(fotos.map((f) => f.caminho_mini).filter(Boolean), SEIS_HORAS);
    const baixar = await urlsDeLeitura(
      fotos.map((f) => f.caminho),
      SEIS_HORAS,
      (caminho) => (porCaminho[caminho] ? porCaminho[caminho].nome_arquivo : "foto.jpg")
    );

    return resposta(200, {
      album: {
        slug: album.slug,
        titulo: album.titulo,
        data_evento: album.data_evento,
        descricao: album.descricao || ""
      },
      fotos: fotos.map((f) => ({
        id: f.id,
        nome: f.nome_arquivo,
        tamanho: f.tamanho || 0,
        mini: f.caminho_mini ? (minis[f.caminho_mini] || grandes[f.caminho]) : grandes[f.caminho],
        grande: grandes[f.caminho],
        baixar: baixar[f.caminho]
      })).filter((f) => f.grande)
    });
  } catch (e) {
    console.error("Falha ao abrir álbum:", e.message);
    return resposta(502, { erro: "Não consegui abrir o álbum agora." });
  }
};
