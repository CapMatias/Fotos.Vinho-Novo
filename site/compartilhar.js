// Compartilhar o link de um álbum. No celular abre a folha de compartilhar
// do aparelho (WhatsApp, Instagram...). Onde não existe, copia o link.
(function () {
  "use strict";

  function copiar(texto) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(texto);
    }
    return new Promise(function (ok, falha) {
      var campo = document.createElement("textarea");
      campo.value = texto;
      campo.setAttribute("readonly", "");
      campo.style.position = "fixed";
      campo.style.opacity = "0";
      document.body.appendChild(campo);
      campo.select();
      var deu = false;
      try { deu = document.execCommand("copy"); } catch (e) { /* sem cópia */ }
      document.body.removeChild(campo);
      deu ? ok() : falha(new Error("sem cópia"));
    });
  }

  function piscar(botao, texto) {
    if (!botao) return;
    var original = botao.getAttribute("data-texto") || botao.textContent;
    botao.setAttribute("data-texto", original);
    botao.textContent = texto;
    setTimeout(function () { botao.textContent = original; }, 2200);
  }

  window.compartilharLink = function (titulo, url, botao) {
    if (navigator.share) {
      navigator.share({ title: titulo, text: "Fotos: " + titulo, url: url }).catch(function (e) {
        // Fechou a folha sem escolher: não é erro.
        if (e && e.name === "AbortError") return;
        copiar(url).then(function () { piscar(botao, "Link copiado ✓"); });
      });
      return;
    }

    copiar(url)
      .then(function () { piscar(botao, "Link copiado ✓"); })
      .catch(function () { window.prompt("Copie o link do álbum:", url); });
  };
})();
