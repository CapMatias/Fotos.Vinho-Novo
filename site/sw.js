// Trabalhador de segundo plano: fica no aparelho e recebe os avisos mesmo
// com o site fechado. É exigência do navegador para notificação funcionar.

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener("push", function (evento) {
  var dado = { titulo: "Fotos novas na igreja", texto: "", endereco: "/" };
  try { dado = Object.assign(dado, evento.data.json()); } catch (e) { /* aviso sem conteúdo */ }

  evento.waitUntil(
    self.registration.showNotification(dado.titulo, {
      body: dado.texto,
      icon: "/icone-192.png",
      badge: "/icone-192.png",
      data: { endereco: dado.endereco },
      tag: "album-novo"
    })
  );
});

// Tocar no aviso abre o álbum — reaproveitando a janela, se já estiver aberta.
self.addEventListener("notificationclick", function (evento) {
  evento.notification.close();
  var destino = (evento.notification.data && evento.notification.data.endereco) || "/";

  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (janelas) {
      for (var i = 0; i < janelas.length; i++) {
        if ("focus" in janelas[i]) {
          janelas[i].navigate(destino);
          return janelas[i].focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
