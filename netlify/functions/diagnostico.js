// GET /api/diagnostico — abre no navegador para conferir se está tudo ligado:
// variáveis de ambiente, tabelas do banco e a pasta das fotos.
const { banco, resposta, chaveConfere } = require("./lib/comum");
const { testar, onde } = require("./lib/armazenamento");

// Descreve o FORMATO de cada chave sem mostrar o conteúdo dela: tamanho,
// sujeira colada junto (aspas, espaços, sinais < >) e, no caso do Supabase,
// se a chave é a "anon" ou a "service_role" — é o engano mais comum.
function conferirFormatos() {
  const laudo = {};

  function sujeira(valor) {
    const problemas = [];
    if (/^["']|["']$/.test(valor)) problemas.push("está entre aspas");
    if (/^<|>$/.test(valor)) problemas.push("tem os sinais < >");
    if (valor !== valor.trim()) problemas.push("tem espaço sobrando");
    if (/\s/.test(valor.trim())) problemas.push("tem espaço no meio");
    if (/cole-aqui|escolha-uma|SUA_|AQUI/i.test(valor)) problemas.push("ainda é o texto de exemplo");
    return problemas;
  }

  // O miolo de um JWT diz para que serve a chave. Só o campo "role" é lido.
  function papelDoJWT(valor) {
    const partes = valor.split(".");
    if (partes.length !== 3) return null;
    try {
      const miolo = JSON.parse(Buffer.from(partes[1], "base64").toString("utf8"));
      return miolo.role || null;
    } catch (e) { return null; }
  }

  ["SUPABASE_SERVICE_KEY", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET",
   "CLOUDINARY_CLOUD_NAME", "SUPABASE_URL"].forEach((nome) => {
    const valor = process.env[nome];
    if (!valor) { laudo[nome] = "FALTANDO"; return; }

    const problemas = sujeira(valor);
    const partes = [valor.length + " caracteres"];

    if (nome === "SUPABASE_URL") {
      partes.length = 0;
      partes.push(valor);   // o endereço não é segredo
      if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(valor.trim())) {
        problemas.push("devia ser https://xxxx.supabase.co, sem barra no fim");
      }
    }

    if (nome === "SUPABASE_SERVICE_KEY") {
      const papel = papelDoJWT(valor.trim().replace(/^["']|["']$/g, ""));
      if (papel) {
        partes.push("é a chave \"" + papel + "\"");
        if (papel !== "service_role") problemas.push("PRECISA ser a service_role, não a " + papel);
      } else if (/^sb_secret_/.test(valor)) {
        partes.push("chave nova (sb_secret_)");
      } else {
        problemas.push("não parece uma chave do Supabase (devia começar com eyJ ou sb_secret_)");
      }
    }

    if (nome === "CLOUDINARY_API_KEY" && !/^\d+$/.test(valor.trim())) {
      problemas.push("a API Key do Cloudinary é só números");
    }

    if (nome === "CLOUDINARY_CLOUD_NAME") {
      if (/cloudinary:|@|:|=/.test(valor)) {
        problemas.push("PERIGO: parece que colaram a linha CLOUDINARY_URL inteira aqui — " +
                       "deve ser só o apelido da nuvem. Troque o segredo no Cloudinary, ele pode ter vazado");
      } else if (!/^[a-z0-9_-]+$/i.test(valor.trim())) {
        problemas.push("só letras, números, - e _");
      }
    }

    laudo[nome] = partes.join(", ") + (problemas.length ? "  >>> " + problemas.join("; ") : "  (formato ok)");
  });

  return laudo;
}

exports.handler = async (event) => {
  const laudo = { armazenamento: onde(), variaveis: {}, banco: {}, arquivos: "" };
  const pediu = (event && event.queryStringParameters) || {};

  ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "PAINEL_KEY",
   "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].forEach((nome) => {
    laudo.variaveis[nome] = process.env[nome] ? "ok" : "FALTANDO";
  });

  // O detalhe das chaves só sai para quem tem a chave do painel:
  //   /api/diagnostico?chave=SUA-CHAVE-DO-PAINEL
  if (chaveConfere(pediu.chave)) {
    laudo.formato = conferirFormatos();
  } else {
    laudo.formato = "escondido — abra /api/diagnostico?chave=SUA-CHAVE-DO-PAINEL para ver";
  }

  for (const tabela of ["albuns", "fotos"]) {
    try {
      await banco(tabela + "?select=id&limit=1");
      laudo.banco[tabela] = "ok";
    } catch (e) {
      laudo.banco[tabela] = "FALHOU — rode o supabase.sql (" + e.message.slice(0, 120) + ")";
    }
  }

  try {
    laudo.arquivos = "ok — " + (await testar());
  } catch (e) {
    laudo.arquivos = "FALHOU — " + e.message.slice(0, 160);
  }

  // Só estas três são obrigatórias. As do Cloudinary são opcionais: sem elas
  // o site usa o Supabase Storage, e isso não é defeito.
  const essenciais = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "PAINEL_KEY"];
  const tudoOk = essenciais.every((nome) => laudo.variaveis[nome] === "ok") &&
                 Object.values(laudo.banco).every((v) => v === "ok") &&
                 laudo.arquivos.indexOf("ok") === 0;

  return resposta(tudoOk ? 200 : 500, Object.assign({ tudo_certo: tudoOk }, laudo));
};
