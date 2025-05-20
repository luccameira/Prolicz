// auth.js

// A função que carrega as permissões do usuário logado
function loadUsuarioLogado() {
  const usuarioLogado = JSON.parse(localStorage.getItem('usuarioLogado'));

  // Se não tiver usuário logado, redireciona para a página de login
  if (!usuarioLogado) {
    window.location.href = 'login.html';
    return null;  // Caso não haja usuário logado, retorna null
  }

  console.log("Usuário logado:", usuarioLogado);  // Mostra o usuário no console para depuração
  return usuarioLogado; // Retorna o objeto do usuário logado
}

// Função para carregar o menu lateral com base nas permissões
function carregarMenuLateral(usuarioLogado) {
  const menu = [
    {
      titulo: 'Menu Principal',
      itens: [
        { href: 'dashboard.html', icon: 'fa-chart-line', label: 'Dashboard', perm: 'dashboard' },
        { href: 'clientes.html', icon: 'fa-user', label: 'Clientes', perm: 'clientes' },
        { href: 'fornecedores.html', icon: 'fa-industry', label: 'Fornecedores', perm: 'fornecedores' },
        { href: 'vendas.html', icon: 'fa-cart-arrow-down', label: 'Vendas', perm: 'vendas' },
        { href: 'produtos.html', icon: 'fa-box', label: 'Produtos', perm: 'produtos' },
        { href: 'usuarios.html', icon: 'fa-users', label: 'Usuários', perm: 'usuarios' },
      ]
    },
    {
      titulo: 'Compras',
      itens: [
        { href: '#', icon: 'fa-file-contract', label: 'Contratos', perm: 'contratos' },
        { href: 'compras.html', icon: 'fa-shopping-bag', label: 'Compras', perm: 'compras' },
        { href: 'relatorios.html', icon: 'fa-chart-bar', label: 'Relatórios', perm: 'relatorios' },
      ]
    },
    {
      titulo: 'Logística',
      itens: [
        { href: 'logistica.html', icon: 'fa-truck', label: 'LOGÍSTICA', perm: 'logistica' },
      ]
    }
  ];

  // Verifica se há o elemento sidebar
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    // Limpa o conteúdo anterior
    sidebar.innerHTML = '';

    menu.forEach(secao => {
      // Título da seção
      const sectionTitle = document.createElement('div');
      sectionTitle.className = 'section-title';
      sectionTitle.textContent = secao.titulo;
      sidebar.appendChild(sectionTitle);

      // Adiciona os itens da seção no menu lateral
      secao.itens.forEach(item => {
        if (usuarioLogado.permissoes.includes(item.perm)) {
          const a = document.createElement('a');
          a.href = item.href;

          // Marca o item como ativo caso seja a página atual
          if (window.location.pathname.endsWith(item.href)) {
            a.classList.add('active');
          }

          const icon = document.createElement('i');
          icon.className = `fas ${item.icon}`;
          a.appendChild(icon);

          a.append(item.label);
          sidebar.appendChild(a);
        }
      });
    });
  }
}

// Função para carregar a lista de usuários
async function carregarUsuarios(usuarioLogado) {
  try {
    const response = await fetch('http://localhost:3000/api/usuarios');
    const usuarios = await response.json();

    const tbody = document.getElementById('lista-usuarios');
    tbody.innerHTML = '';

    usuarios.forEach(usuario => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${usuario.nome}</td>
        <td>${usuario.email}</td>
        <td>${usuario.tipo}</td>
        <td>
          ${usuarioLogado.permissoes.includes('editar_usuario') ? `<a href="editar-usuario.html?id=${usuario.id}" class="btn btn-success">Editar</a>` : ''}
          ${usuarioLogado.permissoes.includes('excluir_usuario') ? `<button onclick="excluirUsuario(${usuario.id})" class="btn btn-danger">Excluir</button>` : ''}
        </td>
      `;
      tbody.appendChild(tr);
    });

  } catch (error) {
    console.error('Erro ao carregar usuários:', error);
  }
}

// Função para excluir o usuário
async function excluirUsuario(id) {
  if (confirm('Tem certeza que deseja excluir este usuário?')) {
    try {
      const response = await fetch(`http://localhost:3000/api/usuarios/${id}`, { method: 'DELETE' });
      const result = await response.text();
      alert(result);
      carregarUsuarios();  // Recarrega a lista de usuários
    } catch (error) {
      alert('Erro ao excluir usuário.');
      console.error(error);
    }
  }
}

// Carrega o usuário logado e executa as ações
const usuarioLogado = loadUsuarioLogado();  // Obtém o usuário logado
if (usuarioLogado) {
  carregarMenuLateral(usuarioLogado);  // Carrega o menu lateral
  carregarUsuarios(usuarioLogado);  // Carrega a lista de usuários
}

