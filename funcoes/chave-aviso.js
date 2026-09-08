// GET /api/chave-aviso — devolve a chave pública dos avisos.
// É pública de propósito: o navegador precisa dela para se inscrever.
const { resposta } = require("./lib/comum");
const { chavePublica, temChaves } = require("./lib/aviso");

exports.handler = async () => {
  if (!temChaves()) return resposta(200, { ligado: false });
  return resposta(200, { ligado: true, chave: chavePublica() });
};
