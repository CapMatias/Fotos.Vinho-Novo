// POST /api/album-capa — escolhe qual foto aparece como capa do álbum.
const { guarda, acharFoto, editarAlbum, resposta } = require("./lib/comum");

exports.handler = async (event) => {
  const porta = guarda(event);
  if (porta.erro) return porta.erro;

  const id = Number(porta.corpo.foto_id);
  if (!id) return resposta(400, { erro: "Faltou dizer qual foto." });

  try {
    const foto = await acharFoto(id);
    if (!foto) return resposta(404, { erro: "Foto não encontrada." });
    await editarAlbum(foto.album_id, { capa: foto.caminho_mini || foto.caminho });
    return resposta(200, { ok: true });
  } catch (e) {
    console.error("Falha ao trocar a capa:", e.message);
    return resposta(502, { erro: "Não consegui trocar a capa agora." });
  }
};
