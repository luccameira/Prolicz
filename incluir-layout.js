// incluir-layout.js
document.addEventListener("DOMContentLoaded", () => {
  console.log("🟡 Iniciando carregamento do layout...");

  if (window.location.pathname.endsWith("login.html")) {
    console.log("Página login.html detectada, não carregando topbar/layout.");
    return;
  }

  fetch("layout.html")
    .then(res => res.text())
    .then(layout => {
      console.log("🟢 layout.html carregado com sucesso");

      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = layout;

      const topbar = tempDiv.querySelector(".topbar");
      const sidebar = tempDiv.querySelector(".sidebar");

      if (topbar) {
        const topbarContainer = document.querySelector(".topbar");
        if (topbarContainer) topbarContainer.innerHTML = topbar.innerHTML;

        // ✅ INSERIR NOME DO USUÁRIO NA TOPOBAR
        const nomeUsuario = localStorage.getItem("nomeUsuario");
        if (nomeUsuario) {
          const spanNome = document.createElement("span");
          spanNome.textContent = nomeUsuario;
          spanNome.style.marginRight = "12px";
          spanNome.style.fontWeight = "bold";

          const containerUsuario = topbarContainer.querySelector("div:last-child");
          if (containerUsuario) {
            containerUsuario.insertBefore(spanNome, containerUsuario.querySelector("a"));
          }
        }
      }

      if (sidebar) {
        const sidebarContainer = document.querySelector(".sidebar");
        if (sidebarContainer) {
          sidebarContainer.innerHTML = sidebar.innerHTML;

          // Corrigir link do menu "Usuários" se estiver errado
          const linkUsuarios = sidebarContainer.querySelector('a[href="login.html"]');
          if (linkUsuarios) {
            linkUsuarios.setAttribute('href', 'usuarios.html');
          }

          // Marcar como ativo o menu correspondente à página atual
          const path = window.location.pathname;
          sidebarContainer.querySelectorAll("a").forEach(link => {
            if (path.includes(link.getAttribute("href"))) {
              link.classList.add("active");
            }
          });
        }
      }

      document.dispatchEvent(new Event("layoutCarregado"));
    })
    .catch(err => {
      console.error("🔴 Erro ao carregar layout.html:", err);
    });
});
