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
        if (topbarContainer) {
          topbarContainer.innerHTML = topbar.innerHTML;

          // Botão ☰ para abrir/fechar sidebar
          const botaoToggle = document.createElement("button");
          botaoToggle.textContent = "☰";
          botaoToggle.style.background = "transparent";
          botaoToggle.style.color = "white";
          botaoToggle.style.border = "none";
          botaoToggle.style.fontSize = "24px";
          botaoToggle.style.cursor = "pointer";
          botaoToggle.style.marginRight = "20px";
          botaoToggle.style.outline = "none";

          botaoToggle.addEventListener("click", () => {
            document.querySelector(".sidebar")?.classList.toggle("oculta");
            document.querySelector(".main-content")?.classList.toggle("expandida");
          });

          const logo = topbarContainer.querySelector(".logo");
          if (logo) logo.prepend(botaoToggle);

          // Mostrar nome do usuário
          const nomeUsuario = localStorage.getItem("nomeUsuario");
          if (nomeUsuario) {
            const span = document.getElementById("nomeUsuarioTopo");
            if (span) span.textContent = nomeUsuario;
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

          // ⚠️ OCULTAR MENUS DA SIDEBAR CONFORME O TIPO DO USUÁRIO
          const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));
          if (usuario) {
            const tipo = usuario.tipo.toLowerCase();

            const tiposSemClientes = ["vendedor", "portaria", "carga e descarga", "conferência de peso", "financeiro", "emissão de nf"];
            if (tiposSemClientes.includes(tipo)) {
              const menuClientes = sidebarContainer.querySelector('a[href="clientes.html"]');
              if (menuClientes) {
                menuClientes.remove();
                console.log(`🔒 Menu 'Clientes' ocultado para tipo '${tipo}'`);
              }
            }

            const tiposSemVendas = ["cadastrador", "portaria", "carga e descarga", "conferência de peso", "financeiro", "emissão de nf"];
            if (tiposSemVendas.includes(tipo)) {
              const menuVendas = sidebarContainer.querySelector('a[href="vendas.html"]');
              if (menuVendas) {
                menuVendas.remove();
                console.log(`🔒 Menu 'Vendas' ocultado para tipo '${tipo}'`);
}
  }

  // 👇 Bloquear menu 'Usuários' para todos, exceto administrador
  if (tipo !== 'administrador') {
    const menuUsuarios = sidebarContainer.querySelector('a[href="usuarios.html"]');
    if (menuUsuarios) {
      menuUsuarios.remove();
      console.log(`🔒 Menu 'Usuários' ocultado para tipo '${tipo}'`);

  // 👇 Ocultar menu 'Portaria' para quem não for administrador nem portaria
  if (tipo !== 'administrador' && tipo !== 'portaria') {
    const menuPortaria = sidebarContainer.querySelector('a[href="tarefas-portaria.html"]');
    if (menuPortaria) {
      menuPortaria.remove();
      console.log(`🔒 Menu 'Portaria' ocultado para tipo '${tipo}'`);
    }
  }

  // 👇 Ocultar menu 'Carga e Descarga' para quem não for administrador nem carga e descarga
  if (tipo !== 'administrador' && tipo !== 'carga e descarga') {
    const menuCarga = sidebarContainer.querySelector('a[href="tarefas-carga.html"]');
    if (menuCarga) {
      menuCarga.remove();
      console.log(`🔒 Menu 'Carga e Descarga' ocultado para tipo '${tipo}'`);
    }
  }

              }
            }
          }

          // Ativar menu atual
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

document.addEventListener("DOMContentLoaded", () => {
  document.body.addEventListener("click", function (e) {
    if (e.target.textContent === "☰") {
      setTimeout(() => {
        document.querySelectorAll(".timeline-simples").forEach(container => {
          animarLinhaProgresso(container);
        });
      }, 300);
    }
  });
});
