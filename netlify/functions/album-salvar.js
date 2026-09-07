// POST /api/album-salvar — cria um álbum novo ou muda um que já existe.
// O endereço (slug) nasce do título e nunca muda depois: links já enviados
// para a igreja continuam funcionando mesmo se o título for corrigido.
const { guarda, limpar, apelido, acharAlbum, criarAlbum, editarAlbum, resposta } = require("./lib/comum");

async function slugLivre(base) {
  let tentativa = base;
  for (let n = 2; n < 200; n++) {
    if (!(await acharAlbum(tentativa))) return tentativa;
    tentativa = base + "-" + n;
  }
  return base + "-" + Date.now();
}

exports.handler = async (event) => {
  const porta = guarda(event);
  if (porta.erro) return porta.erro;
  const corpo = porta.corpo;

  const titulo = limpar(corpo.titulo, 120);
  const data = limpar(corpo.data_evento, 10);
  const descricao = limpar(corpo.descricao, 400);
  const publicado = corpo.publicado !== false;

  const problemas = [];
  if (titulo.length < 3) problemas.push("titulo");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(data))) problemas.push("data_evento");
  if (problemas.length) return resposta(400, { erro: "Confira os campos do álbum.", campos: problemas });

  try {
    if (corpo.id) {
      const album = await editarAlbum(corpo.id, {
        titulo: titulo, data_evento: data, descricao: descricao || null, publicado: publicado
      });
      if (!album) return resposta(404, { erro: "Álbum não encontrado." });
      return resposta(200, { ok: true, album: album });
    }

    const album = await criarAlbum({
      slug: await slugLivre(apelido(titulo)),
      titulo: titulo,
      data_evento: data,
      descricao: descricao || null,
      publicado: publicado
    });
    return resposta(201, { ok: true, album: album });
  } catch (e) {
    console.error("Falha ao salvar álbum:", e.message);
    return resposta(502, { erro: "Não consegui salvar o álbum agora." });
  }
};
