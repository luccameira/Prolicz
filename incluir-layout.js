// incluir-layout.js
document.addEventListener("DOMContentLoaded", () => {
  console.log("🟡 Iniciando carregamento do layout...");

  // Se estivermos na página login.html, não carregue o layout para topbar e sidebar
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
      }

      if (sidebar) {
        const sidebarContainer = document.querySelector(".sidebar");
        if (sidebarContainer) {
          sidebarContainer.innerHTML = sidebar.innerHTML;

          // Corrigir link do menu "Usuários" se estiver errado (apontando para login.html)
          const linkUsuarios = sidebarContainer.querySelector('a[href="login.html"]');
          if (linkUsuarios) {
            linkUsuarios.setAttribute('href', 'usuarios.html');
          }

          // Ativar o link da sidebar correspondente à página atual
          const path = window.location.pathname;
          const links = sidebarContainer.querySelectorAll("a");
          links.forEach(link => {
            if (path.includes(link.getAttribute("href"))) {
              link.classList.add("active");
            }
          });
        }
      }

      // Disparar evento global indicando que o layout foi carregado
      document.dispatchEvent(new Event("layoutCarregado"));
    })
    .catch(err => {
      console.error("🔴 Erro ao carregar layout.html:", err);
    });
});
