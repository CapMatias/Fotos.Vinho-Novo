// POST /api/upload-url — o painel pergunta "para onde mando estas fotos?".
// A resposta é um endereço assinado por arquivo, válido por 15 minutos.
// A foto sobe direto do celular para o armazenamento: não passa por aqui,
// então não esbarra no limite de tamanho das funções da Netlify.
const { guarda, acharAlbum, limpar, resposta } = require("./lib/comum");
const { urlDeEnvio, limiteBytes } = require("./lib/armazenamento");

const TIPOS = {
  "image/jpeg": "jpg",
  "image/jpg":  "jpg",
  "image/png":  "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic"
};

// Nome que não colide nem quebra endereço: hora + sorteio + extensão.
function nomeNovo(extensao) {
  const sorteio = Math.random().toString(36).slice(2, 8);
  return Date.now().toString(36) + "-" + sorteio + "." + extensao;
}

exports.handler = async (event) => {
  const porta = guarda(event);
  if (porta.erro) return porta.erro;
  const corpo = porta.corpo;

  const slug = limpar(corpo.slug, 80);
  const arquivos = Array.isArray(corpo.arquivos) ? corpo.arquivos.slice(0, 50) : [];
  if (!slug || !arquivos.length) return resposta(400, { erro: "Faltou o álbum ou os arquivos." });

  try {
    const album = await acharAlbum(slug);
    if (!album) return resposta(404, { erro: "Álbum não encontrado." });

    const saida = [];
    for (const arquivo of arquivos) {
      const tipo = String(arquivo.tipo || "").toLowerCase();
      const extensao = TIPOS[tipo];
      if (!extensao) { saida.push({ erro: "Formato não aceito: " + (tipo || "desconhecido") }); continue; }
      const limite = limiteBytes();
      if (Number(arquivo.tamanho) > limite) {
        saida.push({ erro: "Foto maior que " + Math.round(limite / 1048576) + " MB." });
        continue;
      }

      const nome = nomeNovo(extensao);
      const caminho = "albuns/" + slug + "/" + nome;
      const caminhoMini = "albuns/" + slug + "/mini/" + nome.replace(/\.\w+$/, ".jpg");

      saida.push({
        caminho: caminho,
        caminho_mini: caminhoMini,
        envio: await urlDeEnvio(caminho, tipo),
        envio_mini: await urlDeEnvio(caminhoMini, "image/jpeg")
      });
    }

    return resposta(200, { destinos: saida });
  } catch (e) {
    console.error("Falha ao preparar envio:", e.message);
    return resposta(502, { erro: "Não consegui preparar o envio agora." });
  }
};
