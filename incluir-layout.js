document.addEventListener("DOMContentLoaded", () => {
  console.log("🟡 Iniciando carregamento do layout...");

  fetch("layout.html")
    .then(res => res.text())
    .then(layout => {
      console.log("🟢 layout.html carregado com sucesso");

      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = layout;

      const topbar = tempDiv.querySelector(".topbar");
      const sidebar = tempDiv.querySelector(".sidebar");

      const topbarContainer = document.querySelector(".topbar");
      const sidebarContainer = document.querySelector(".sidebar");

      if (window.location.pathname.endsWith("/login.html")) {
        // Para login.html, remover sidebar e customizar topbar
        if (sidebarContainer) {
          sidebarContainer.style.display = "none";
        }
        if (topbarContainer) {
          topbarContainer.innerHTML = `<div style="color:#ffc107; font-weight:bold; font-size:28px; padding:10px 40px; user-select:none;">PRONASA</div>`;
          topbarContainer.style.backgroundColor = "#000";
          topbarContainer.style.boxShadow = "0 2px 5px rgba(0,0,0,0.3)";
          topbarContainer.style.display = "flex";
          topbarContainer.style.justifyContent = "flex-start";
          topbarContainer.style.alignItems = "center";
        }
      } else {
        // Para as demais páginas, carrega topbar e sidebar normalmente
        if (topbar && topbarContainer) topbarContainer.innerHTML = topbar.innerHTML;
        if (sidebar && sidebarContainer) sidebarContainer.innerHTML = sidebar.innerHTML;

        // Corrigir link do menu "Usuários"
        const linkUsuarios = sidebarContainer.querySelector('a[href="login.html"]');
        if (linkUsuarios) {
          linkUsuarios.setAttribute('href', 'usuarios.html');
        }

        // Ativar link da sidebar correspondente à página atual
        const path = window.location.pathname;
        const links = sidebarContainer.querySelectorAll("a");
        links.forEach(link => {
          if (path.includes(link.getAttribute("href"))) {
            link.classList.add("active");
          }
        });
      }

      // Disparar evento global indicando que o layout foi carregado
      document.dispatchEvent(new Event("layoutCarregado"));
    })
    .catch(err => {
      console.error("🔴 Erro ao carregar layout.html:", err);
    });
});
