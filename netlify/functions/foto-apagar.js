// POST /api/foto-apagar — tira uma foto do álbum e do armazenamento.
const { guarda, acharFoto, apagarFoto, acharAlbumPorId, editarAlbum, listarFotos, resposta } = require("./lib/comum");
const { apagarArquivos } = require("./lib/armazenamento");

exports.handler = async (event) => {
  const porta = guarda(event);
  if (porta.erro) return porta.erro;

  const id = Number(porta.corpo.id);
  if (!id) return resposta(400, { erro: "Faltou dizer qual foto." });

  try {
    const foto = await acharFoto(id);
    if (!foto) return resposta(200, { ok: true, jaSaiu: true });

    await apagarArquivos([foto.caminho, foto.caminho_mini]);
    await apagarFoto(id);

    // Se era a capa do álbum, promove a próxima foto que sobrou.
    const album = await acharAlbumPorId(foto.album_id);
    if (album && (album.capa === foto.caminho_mini || album.capa === foto.caminho)) {
      const restantes = await listarFotos(album.id);
      const nova = restantes.length ? (restantes[0].caminho_mini || restantes[0].caminho) : null;
      await editarAlbum(album.id, { capa: nova });
    }

    return resposta(200, { ok: true });
  } catch (e) {
    console.error("Falha ao apagar foto:", e.message);
    return resposta(502, { erro: "Não consegui apagar a foto agora." });
  }
};
