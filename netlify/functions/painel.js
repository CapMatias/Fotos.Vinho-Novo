// POST /api/painel — tudo o que o painel precisa mostrar: todos os álbuns,
// inclusive os que ainda não foram publicados, com quantas fotos cada um tem.
const { guarda, listarAlbuns, contarFotos, resposta } = require("./lib/comum");
const { urlsDeLeitura, onde } = require("./lib/armazenamento");

exports.handler = async (event) => {
  const porta = guarda(event);
  if (porta.erro) return porta.erro;

  try {
    const albuns = await listarAlbuns(true);
    const contas = await contarFotos();
    const capas = await urlsDeLeitura(albuns.map((a) => a.capa).filter(Boolean), 21600);

    return resposta(200, {
      guardadas_em: onde(),
      albuns: albuns.map((a) => ({
        id: a.id,
        slug: a.slug,
        titulo: a.titulo,
        data_evento: a.data_evento,
        descricao: a.descricao || "",
        publicado: !!a.publicado,
        capa: a.capa ? (capas[a.capa] || null) : null,
        fotos: contas[a.id] || 0,
        visitas: a.visitas || 0
      }))
    });
  } catch (e) {
    console.error("Falha ao carregar o painel:", e.message);
    return resposta(502, { erro: "Não consegui carregar o painel agora." });
  }
};
