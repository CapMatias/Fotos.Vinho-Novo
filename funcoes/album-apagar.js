// POST /api/album-apagar — apaga o álbum inteiro: todas as fotos do
// armazenamento e depois o álbum. Só o painel chama, e a tela pede
// confirmação escrevendo o nome do álbum antes.
const { guarda, acharAlbumPorId, listarFotos, apagarAlbum, resposta } = require("./lib/comum");
const { apagarArquivos } = require("./lib/armazenamento");

exports.handler = async (event) => {
  const porta = guarda(event);
  if (porta.erro) return porta.erro;

  const id = Number(porta.corpo.id);
  if (!id) return resposta(400, { erro: "Faltou dizer qual álbum." });

  try {
    const album = await acharAlbumPorId(id);
    if (!album) return resposta(200, { ok: true, jaSaiu: true });

    const fotos = await listarFotos(id);
    const caminhos = [];
    fotos.forEach((f) => { caminhos.push(f.caminho); if (f.caminho_mini) caminhos.push(f.caminho_mini); });

    // De 100 em 100 para não estourar o tempo da função em álbuns grandes.
    for (let i = 0; i < caminhos.length; i += 100) {
      await apagarArquivos(caminhos.slice(i, i + 100));
    }
    // As fotos saem da tabela junto com o álbum (on delete cascade).
    await apagarAlbum(id);

    return resposta(200, { ok: true, fotos: fotos.length });
  } catch (e) {
    console.error("Falha ao apagar álbum:", e.message);
    return resposta(502, { erro: "Não consegui apagar o álbum agora." });
  }
};
