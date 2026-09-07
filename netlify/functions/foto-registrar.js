// POST /api/foto-registrar — o painel avisa que a foto já subiu.
// Só aqui a foto entra na lista do álbum; se o envio falhar no meio do
// caminho, nada aparece quebrado para quem visita o site.
const { guarda, acharAlbum, gravarFoto, editarAlbum, limpar, resposta } = require("./lib/comum");

exports.handler = async (event) => {
  const porta = guarda(event);
  if (porta.erro) return porta.erro;
  const corpo = porta.corpo;

  const slug = limpar(corpo.slug, 80);
  const caminho = limpar(corpo.caminho, 300);
  const caminhoMini = limpar(corpo.caminho_mini, 300);
  const nome = limpar(corpo.nome_arquivo, 160) || "foto.jpg";
  const tamanho = Number(corpo.tamanho) || null;

  if (!slug || !caminho) return resposta(400, { erro: "Faltou o álbum ou o arquivo." });
  // O caminho tem de ser de dentro da pasta do álbum: ninguém grava fora dela.
  if (caminho.indexOf("albuns/" + slug + "/") !== 0) {
    return resposta(400, { erro: "Caminho fora do álbum." });
  }

  try {
    const album = await acharAlbum(slug);
    if (!album) return resposta(404, { erro: "Álbum não encontrado." });

    const foto = await gravarFoto({
      album_id: album.id,
      caminho: caminho,
      caminho_mini: caminhoMini || null,
      nome_arquivo: nome,
      tamanho: tamanho
    });

    // A primeira foto do álbum vira a capa.
    if (!album.capa) await editarAlbum(album.id, { capa: caminhoMini || caminho });

    return resposta(201, { ok: true, id: foto ? foto.id : null });
  } catch (e) {
    console.error("Falha ao registrar foto:", e.message);
    return resposta(502, { erro: "Não consegui registrar a foto agora." });
  }
};
