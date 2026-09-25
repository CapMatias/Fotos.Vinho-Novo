// POST /api/painel — tudo o que o painel precisa mostrar: todos os álbuns,
// inclusive os que ainda não foram publicados, com quantas fotos cada um tem.
const { guarda, listarAlbuns, contarFotos, bancoTudo, resposta } = require("./lib/comum");
const { urlsDeLeitura, onde } = require("./lib/armazenamento");

const TRINTA_DIAS = 30 * 24 * 60 * 60 * 1000;

// Quantos aparelhos têm o site na tela de início e quantos recebem aviso.
// Se a tabela ainda não existir no banco, o painel abre do mesmo jeito.
async function contarAparelhos() {
  try {
    const corte = Date.now() - TRINTA_DIAS;
    const aparelhos = await bancoTudo("aparelhos?select=visto_em&order=id");
    const inscritos = await bancoTudo("inscricoes?select=id&order=id");
    return {
      total: aparelhos.length,
      ativos: aparelhos.filter((a) => new Date(a.visto_em).getTime() >= corte).length,
      avisos: inscritos.length
    };
  } catch (e) {
    console.error("Sem contagem de aparelhos:", e.message);
    return null;
  }
}

exports.handler = async (event) => {
  const porta = guarda(event);
  if (porta.erro) return porta.erro;

  try {
    const albuns = await listarAlbuns(true);
    const contas = await contarFotos();
    const capas = await urlsDeLeitura(albuns.map((a) => a.capa).filter(Boolean), 21600);

    return resposta(200, {
      guardadas_em: onde(),
      aparelhos: await contarAparelhos(),
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
