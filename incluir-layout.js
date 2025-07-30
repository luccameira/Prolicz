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

          const botaoToggle = document.createElement("button");
          botaoToggle.textContent = "☰";
          botaoToggle.style.background = "transparent";
          botaoToggle.style.color = "white";
          botaoToggle.style.border = "none";
          botaoToggle.style.fontSize = "24px";
          botaoToggle.style.cursor = "pointer";
          botaoToggle.style.marginRight = "20px";
          botaoToggle.style.outline = "none";

          const containerLogo = topbarContainer.querySelector(".logo");
          if (containerLogo) containerLogo.prepend(botaoToggle);

          botaoToggle.addEventListener("click", () => {
            const sidebar = document.querySelector(".sidebar");
            const mainContent = document.querySelector(".main-content");

            if (sidebar && mainContent) {
              if (sidebar.classList.contains("oculta")) {
                sidebar.classList.remove("oculta");
                mainContent.classList.remove("expandida");
              } else {
                sidebar.classList.add("oculta");
                mainContent.classList.add("expandida");
              }
            }
          });

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

          const linkUsuarios = sidebarContainer.querySelector('a[href="login.html"]');
          if (linkUsuarios) {
            linkUsuarios.setAttribute('href', 'usuarios.html');
          }

          const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));
          if (usuario) {
            const normalizar = texto => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const permissoes = Array.isArray(usuario.permissoes)
              ? usuario.permissoes.map(p => normalizar(p))
              : [];

            const menus = [
              { href: "clientes.html", permissoes: ["visualizar clientes"], nome: "Clientes" },
              { href: "vendas.html", permissoes: ["visualizar vendas"], nome: "Vendas" },
              { href: "produtos.html", permissoes: ["visualizar produtos"], nome: "Produtos" },
              { href: "usuarios.html", permissoes: ["visualizar usuarios"], nome: "Usuários" },
              { href: "tarefas-portaria.html", permissoes: ["visualizar tarefas - portaria", "executar tarefas - portaria"], nome: "Portaria" },
              { href: "tarefas-carga.html", permissoes: ["visualizar tarefas - carga e descarga", "executar tarefas - carga e descarga"], nome: "Carga e Descarga" },
              { href: "tarefas-conferencia.html", permissoes: ["visualizar tarefas - conferencia de peso", "executar tarefas - conferencia de peso"], nome: "Conferência de Peso" },
              { href: "tarefas-financeiro.html", permissoes: ["visualizar tarefas - financeiro", "executar tarefas - financeiro"], nome: "Financeiro" },
              { href: "tarefas-nf.html", permissoes: ["visualizar tarefas - emissao de nf", "executar tarefas - emissao de nf"], nome: "Emissão de NF" }
            ];

            menus.forEach(menu => {
              const link = sidebarContainer.querySelector(`a[href="${menu.href}"]`);
              const temPermissao = menu.permissoes.some(p => permissoes.includes(p));
              if (!temPermissao && link) {
                link.remove();
                console.log(`🔒 Menu '${menu.nome}' ocultado por falta das permissões: ${menu.permissoes.join(" ou ")}`);
              }
            });
          }

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
