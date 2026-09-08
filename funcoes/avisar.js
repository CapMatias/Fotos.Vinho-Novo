// POST /api/avisar — o painel dispara o aviso de um álbum para a igreja.
// É um botão, não automático: quem publica decide a hora, quando o álbum
// já está com as fotos dentro.
const { guarda, acharAlbum, listarFotos, limpar, resposta } = require("./lib/comum");
const { avisarTodos, temChaves } = require("./lib/aviso");

exports.handler = async (event) => {
  const porta = guarda(event);
  if (porta.erro) return porta.erro;
  if (!temChaves()) return resposta(503, { erro: "Avisos ainda não configurados." });

  const slug = limpar(porta.corpo.slug, 80);
  if (!slug) return resposta(400, { erro: "Faltou dizer qual álbum." });

  try {
    const album = await acharAlbum(slug);
    if (!album) return resposta(404, { erro: "Álbum não encontrado." });
    if (!album.publicado) return resposta(400, { erro: "Publique o álbum antes de avisar." });

    const fotos = await listarFotos(album.id);
    if (!fotos.length) return resposta(400, { erro: "O álbum ainda não tem fotos." });

    const resultado = await avisarTodos(
      "Fotos novas na igreja",
      album.titulo + " — " + fotos.length + (fotos.length === 1 ? " foto" : " fotos"),
      "/album/" + album.slug
    );
    return resposta(200, { ok: true, aviso: resultado });
  } catch (e) {
    console.error("Falha ao avisar:", e.message);
    return resposta(502, { erro: "Não consegui avisar agora." });
  }
};
