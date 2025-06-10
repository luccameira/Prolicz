// incluir-layout.js
document.addEventListener("DOMContentLoaded", () => {
  console.log("🟡 Iniciando carregamento do layout...");
  const layoutPath = "layout.html";
  console.log("📁 Buscando:", layoutPath);

  fetch(layoutPath)
    .then(res => res.text())
    .then(layout => {
      console.log("🟢 layout.html carregado com sucesso");

      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = layout;

      const topbar = tempDiv.querySelector(".topbar");
      const sidebar = tempDiv.querySelector(".sidebar");

      if (topbar) {
        const topbarContainer =
          document.querySelector("#topbar") || document.querySelector(".topbar");
        if (topbarContainer) {
          topbarContainer.innerHTML = topbar.innerHTML;
          console.log("🔵 Topbar inserida");
        }
      }

      if (sidebar) {
        const sidebarContainer =
          document.querySelector("#sidebar") || document.querySelector(".sidebar");
        if (sidebarContainer) {
          sidebarContainer.innerHTML = sidebar.innerHTML;
          console.log("🔵 Sidebar inserida");
        }

        // Ativar o link da sidebar correspondente à página atual
        const path = window.location.pathname;
        const links = document.querySelectorAll(".sidebar a");
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



