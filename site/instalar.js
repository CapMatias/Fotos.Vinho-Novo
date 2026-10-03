// Botão "Instalar aplicativo".
//
// Android e computador: o navegador avisa que dá para instalar
// (beforeinstallprompt) e o botão só abre a janela oficial dele.
// iPhone: o Safari não tem essa janela. O botão mostra o passo a passo
// (Compartilhar e depois Adicionar à Tela de Início).
// Aberto pelo ícone da tela de início: já está instalado, o botão nem aparece.
(function () {
  "use strict";

  var botao = document.getElementById("instalarApp");
  if (!botao) return;

  var instalado = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
                  window.navigator.standalone === true;
  if (instalado) return;

  // O Chrome só oferece instalar em página com trabalhador registrado.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(function () { /* sem instalação, tudo bem */ });
  }

  var ua = navigator.userAgent || "";

  // Desenhos do guia do iPhone (antes do desvio abaixo, que sai cedo).
  var ICONE_COMPARTILHAR =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8"/></svg>';
  var ICONE_ADICIONAR =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>';

  // iPad novo se apresenta como Mac; o toque denuncia.
  var ios = /iphone|ipad|ipod/i.test(ua) ||
            (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (ios) {
    botao.hidden = false;
    botao.addEventListener("click", abrirGuia);
    return;
  }

  // ------------------------------------------------ Android e computador
  var pedido = null;

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();          // segura a faixa automática; quem decide é o botão
    pedido = e;
    botao.hidden = false;
  });

  botao.addEventListener("click", function () {
    if (!pedido) return;
    pedido.prompt();
    pedido.userChoice.catch(function () { /* fechou */ }).then(function () {
      // A janela só pode ser usada uma vez. Se a pessoa recusar, o navegador
      // oferece de novo numa próxima visita e o botão volta.
      pedido = null;
      botao.hidden = true;
    });
  });

  window.addEventListener("appinstalled", function () {
    pedido = null;
    botao.hidden = true;
  });

  // ------------------------------------------------------------ iPhone
  function qualNavegador() {
    if (/Instagram|FBAN|FBAV|FB_IAB|Line\/|Snapchat|TikTok/i.test(ua)) return "dentro-de-app";
    if (/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)) return "outro";
    return "safari";
  }

  function passos(tipo) {
    if (tipo === "dentro-de-app") {
      return [
        "Toque nos <b>três pontinhos</b> (••• ou ⋯) no canto da tela.",
        "Escolha <b>Abrir no navegador</b> (ou <b>Abrir no Safari</b>).",
        "No Safari, toque de novo em <b>Instalar aplicativo</b> para ver o resto."
      ];
    }
    var ondeFica = tipo === "outro"
      ? "Fica no alto, ao lado do endereço do site."
      : "Fica na barra de baixo. No iOS mais novo, toque antes em <b>•••</b>.";
    return [
      "Toque em <b>Compartilhar</b> <span class=\"guia__simbolo\">" + ICONE_COMPARTILHAR + "</span>" +
        "<span class=\"guia__dica\">" + ondeFica + "</span>",
      "Role a lista e toque em <b>Adicionar à Tela de Início</b> <span class=\"guia__simbolo\">" + ICONE_ADICIONAR + "</span>",
      "Toque em <b>Adicionar</b>, no canto de cima. Pronto: o ícone <b>Vinho Novo</b> aparece na sua tela."
    ];
  }

  var guia = null;
  var voltarFoco = null;

  function montarGuia() {
    var tipo = qualNavegador();
    guia = document.createElement("div");
    guia.className = "guia";
    guia.setAttribute("role", "dialog");
    guia.setAttribute("aria-modal", "true");
    guia.setAttribute("aria-labelledby", "guiaTitulo");
    guia.innerHTML =
      '<div class="guia__caixa">' +
        '<div class="guia__topo">' +
          '<img class="guia__icone" src="/icone-180.png" alt="">' +
          '<div>' +
            '<h2 class="guia__titulo" id="guiaTitulo">Instalar no iPhone</h2>' +
            '<p class="guia__sub">' + (tipo === "dentro-de-app"
              ? "Primeiro abra o site no Safari."
              : "Leva 10 segundos e fica igual a um aplicativo.") + '</p>' +
          '</div>' +
        '</div>' +
        '<ol class="guia__passos">' +
          passos(tipo).map(function (texto, i) {
            return '<li><span class="guia__num">' + (i + 1) + '</span><span>' + texto + '</span></li>';
          }).join("") +
        '</ol>' +
        '<button class="botao botao--ouro botao--largo" type="button" data-fechar>Entendi</button>' +
        (tipo === "safari" ? '<div class="guia__seta" aria-hidden="true">&#8595;</div>' : '') +
      '</div>';

    guia.addEventListener("click", function (e) {
      if (e.target === guia || e.target.hasAttribute("data-fechar")) fecharGuia();
    });
    document.body.appendChild(guia);
  }

  function abrirGuia() {
    if (!guia) montarGuia();
    voltarFoco = document.activeElement;
    // um quadro de atraso para a transição de entrada funcionar
    requestAnimationFrame(function () {
      guia.classList.add("aberta");
      guia.querySelector("[data-fechar]").focus();
    });
    document.addEventListener("keydown", teclaGuia);
  }

  function fecharGuia() {
    guia.classList.remove("aberta");
    document.removeEventListener("keydown", teclaGuia);
    if (voltarFoco && voltarFoco.focus) voltarFoco.focus();
  }

  function teclaGuia(e) {
    if (e.key === "Escape") fecharGuia();
  }
})();
