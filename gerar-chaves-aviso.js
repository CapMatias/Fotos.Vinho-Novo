/* Gera o par de chaves dos avisos. Rode uma vez só:
     node gerar-chaves-aviso.js
   Depois cadastre as duas na hospedagem (Vercel > Environment Variables).
   A privada é segredo: não vai para o GitHub nem para o navegador. */
const { gerarChaves } = require("./funcoes/lib/aviso");
const par = gerarChaves();
console.log("\n  VAPID_PUBLIC_KEY=" + par.publica);
console.log("  VAPID_PRIVATE_KEY=" + par.privada);
console.log("  VAPID_SUBJECT=mailto:seu-email@exemplo.com\n");
