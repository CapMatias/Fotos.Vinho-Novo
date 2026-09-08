// POST /api/painel-fotos — as fotos de um álbum para quem cuida do painel.
// Diferente de /api/album: mostra também álbuns ainda não publicados.
const { guarda, acharAlbum, listarFotos, limpar, resposta } = require("./lib/comum");
const { urlsDeLeitura } = require("./lib/armazenamento");

exports.handler = async (event) => {
  const porta = guarda(event);
  if (porta.erro) return porta.erro;

  const slug = limpar(porta.corpo.slug, 80);
  if (!slug) return resposta(400, { erro: "Faltou dizer qual álbum." });

  try {
    const album = await acharAlbum(slug);
    if (!album) return resposta(404, { erro: "Álbum não encontrado." });

    const fotos = await listarFotos(album.id);
    const minis = await urlsDeLeitura(fotos.map((f) => f.caminho_mini || f.caminho), 21600);

    return resposta(200, {
      album: {
        id: album.id, slug: album.slug, titulo: album.titulo,
        data_evento: album.data_evento, descricao: album.descricao || "",
        publicado: !!album.publicado
      },
      fotos: fotos.map((f) => ({
        id: f.id,
        nome: f.nome_arquivo,
        tamanho: f.tamanho || 0,
        mini: minis[f.caminho_mini || f.caminho] || null,
        capa: album.capa === (f.caminho_mini || f.caminho)
      }))
    });
  } catch (e) {
    console.error("Falha ao listar fotos do painel:", e.message);
    return resposta(502, { erro: "Não consegui carregar as fotos agora." });
  }
};
