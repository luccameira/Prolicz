document.addEventListener('DOMContentLoaded', () => {
  const usuarioLogado = JSON.parse(localStorage.getItem('usuarioLogado'));
  if (usuarioLogado && document.getElementById('usuario-nome')) {
    document.getElementById('usuario-nome').textContent = usuarioLogado.nome;
  }

  const tipoSelect = document.getElementById('tipo');
  const permissoesContainer = document.getElementById('permissoes-container');

  const permissoesPorTipo = {};

[
  ['Cadastrador', [
    'Visualizar Clientes', 'Adicionar Cliente', 'Editar Cliente',
    'Visualizar Produtos', 'Adicionar Produto'
  ]],
  ['Vendedor', [
    'Visualizar Vendas', 'Adicionar Venda', 'Editar Venda'
  ]],
  ['Emissão de NF', [
    'Visualizar Tarefas - Portaria',
    'Visualizar Tarefas - Carga e Descarga',
    'Visualizar Tarefas - Conferência de Peso',
    'Visualizar Tarefas - Financeiro',
    'Visualizar Tarefas - Emissão de NF',
    'Executar Tarefas - Emissão de NF'
  ]],
  ['Financeiro', [
    'Visualizar Tarefas - Portaria',
    'Visualizar Tarefas - Carga e Descarga',
    'Visualizar Tarefas - Conferência de Peso',
    'Visualizar Tarefas - Emissão de NF',
    'Visualizar Tarefas - Financeiro',
    'Executar Tarefas - Financeiro'
  ]],
  ['Conferência de Peso', [
    'Visualizar Tarefas - Portaria',
    'Visualizar Tarefas - Carga e Descarga',
    'Visualizar Tarefas - Financeiro',
    'Visualizar Tarefas - Emissão de NF',
    'Visualizar Tarefas - Conferência de Peso',
    'Executar Tarefas - Conferência de Peso'
  ]],
  ['Carga e Descarga', [
    'Visualizar Tarefas - Portaria',
    'Visualizar Tarefas - Conferência de Peso',
    'Visualizar Tarefas - Financeiro',
    'Visualizar Tarefas - Emissão de NF',
    'Visualizar Tarefas - Carga e Descarga',
    'Executar Tarefas - Carga e Descarga'
  ]],
  ['Portaria', [
    'Visualizar Tarefas - Carga e Descarga',
    'Visualizar Tarefas - Conferência de Peso',
    'Visualizar Tarefas - Financeiro',
    'Visualizar Tarefas - Emissão de NF',
    'Visualizar Tarefas - Portaria',
    'Executar Tarefas - Portaria'
  ]],
  ['Coordenador', [
    'Visualizar Clientes', 'Adicionar Cliente', 'Editar Cliente',
    'Visualizar Vendas', 'Adicionar Venda', 'Editar Venda',
    'Visualizar Produtos', 'Adicionar Produto',
    'Visualizar Tarefas - Portaria', 'Editar Tarefas - Portaria',
    'Visualizar Tarefas - Carga e Descarga', 'Editar Tarefas - Carga e Descarga',
    'Visualizar Tarefas - Conferência de Peso', 'Editar Tarefas - Conferência de Peso',
    'Visualizar Tarefas - Financeiro', 'Editar Tarefas - Financeiro',
    'Visualizar Tarefas - Emissão de NF', 'Editar Tarefas - Emissão de NF'
  ]],
  ['Administrador', [
    'Visualizar Clientes', 'Adicionar Cliente', 'Editar Cliente', 'Excluir Cliente',
    'Visualizar Vendas', 'Adicionar Venda', 'Editar Venda', 'Excluir Venda',
    'Visualizar Produtos', 'Adicionar Produto',
    'Visualizar Tarefas - Portaria', 'Executar Tarefas - Portaria', 'Editar Tarefas - Portaria',
    'Visualizar Tarefas - Carga e Descarga', 'Executar Tarefas - Carga e Descarga', 'Editar Tarefas - Carga e Descarga',
    'Visualizar Tarefas - Conferência de Peso', 'Executar Tarefas - Conferência de Peso', 'Editar Tarefas - Conferência de Peso',
    'Visualizar Tarefas - Financeiro', 'Executar Tarefas - Financeiro', 'Editar Tarefas - Financeiro',
    'Visualizar Tarefas - Emissão de NF', 'Executar Tarefas - Emissão de NF', 'Editar Tarefas - Emissão de NF',
    'Visualizar Usuários', 'Adicionar Usuário', 'Editar Usuário', 'Excluir Usuário'
  ]]
].forEach(([tipoOriginal, permissoes]) => {
  const chaveNormalizada = tipoOriginal.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  permissoesPorTipo[chaveNormalizada] = permissoes;
});

  tipoSelect.addEventListener('change', () => {
    const tipoSelecionado = tipoSelect.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    permissoesContainer.innerHTML = '';
    if (!tipoSelecionado) {
      permissoesContainer.style.display = 'none';
      return;
    }

    permissoesContainer.style.display = 'block';

    const permissoesPrimarias = [
      'Visualizar Clientes',
      'Visualizar Vendas',
      'Visualizar Produtos',
      'Visualizar Tarefas - Portaria',
      'Visualizar Tarefas - Carga e Descarga',
      'Visualizar Tarefas - Conferência de Peso',
      'Visualizar Tarefas - Financeiro',
      'Visualizar Tarefas - Emissão de NF',
      'Visualizar Usuários'
    ];

    const titulo = document.createElement('h3');
    titulo.textContent = 'Permissões';
    permissoesContainer.appendChild(titulo);

    permissoesPrimarias.forEach(permissao => {
      const permissoesSecundarias = {
        'Visualizar Clientes': ['Adicionar Cliente', 'Editar Cliente', 'Excluir Cliente'],
        'Visualizar Vendas': ['Adicionar Venda', 'Editar Venda', 'Excluir Venda'],
        'Visualizar Produtos': ['Adicionar Produto'],
        'Visualizar Usuários': ['Adicionar Usuário', 'Editar Usuário', 'Excluir Usuário'],
        'Visualizar Tarefas - Portaria': ['Executar Tarefas - Portaria', 'Editar Tarefas - Portaria'],
        'Visualizar Tarefas - Carga e Descarga': ['Executar Tarefas - Carga e Descarga', 'Editar Tarefas - Carga e Descarga'],
        'Visualizar Tarefas - Conferência de Peso': ['Executar Tarefas - Conferência de Peso', 'Editar Tarefas - Conferência de Peso'],
        'Visualizar Tarefas - Financeiro': ['Executar Tarefas - Financeiro', 'Editar Tarefas - Financeiro'],
        'Visualizar Tarefas - Emissão de NF': ['Executar Tarefas - Emissão de NF', 'Editar Tarefas - Emissão de NF']
      };

      const bloco = document.createElement('div');
      bloco.classList.add('permissao-bloco');

      const labelPrimaria = document.createElement('label');
      labelPrimaria.classList.add('permissao-primaria');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = permissao;
      checkbox.id = `perm-${permissao}`;
      checkbox.name = 'permissoes';

      const spanTexto = document.createElement('span');
      spanTexto.textContent = permissao;
      spanTexto.classList.add('primaria-texto');

      labelPrimaria.appendChild(checkbox);
      labelPrimaria.appendChild(spanTexto);

      const secundariasContainer = document.createElement('div');
      secundariasContainer.classList.add('permissoes-secundarias');
      secundariasContainer.style.display = 'none';

      checkbox.addEventListener('change', () => {
        secundariasContainer.innerHTML = '';

        if (checkbox.checked && permissoesSecundarias[permissao]) {
          permissoesSecundarias[permissao].forEach(sec => {
            const secCheckbox = document.createElement('input');
            secCheckbox.type = 'checkbox';
            secCheckbox.value = sec;
            secCheckbox.name = 'permissoes';
            secCheckbox.id = `sec-${sec}`;

            const secLabel = document.createElement('label');
            secLabel.setAttribute('for', secCheckbox.id);
            secLabel.classList.add('secundaria-label');
            secLabel.appendChild(secCheckbox);

            const spanSec = document.createElement('span');
            spanSec.textContent = sec;
            secLabel.appendChild(spanSec);

            secundariasContainer.appendChild(secLabel);
          });
          secundariasContainer.style.display = 'flex';
        } else {
          secundariasContainer.style.display = 'none';
        }
      });

      bloco.appendChild(labelPrimaria);
      bloco.appendChild(secundariasContainer);
      permissoesContainer.appendChild(bloco);

      // Aplica marcações automáticas com base no tipo selecionado
      if (permissoesPorTipo[tipoSelecionado]?.includes(permissao)) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change'));
        if (permissoesSecundarias[permissao]) {
          permissoesSecundarias[permissao].forEach(sec => {
            const secCheckbox = document.getElementById(`sec-${sec}`);
            if (secCheckbox && permissoesPorTipo[tipoSelecionado].includes(sec)) {
              secCheckbox.checked = true;
            }
          });
        }
      }
    });
  });

  document.getElementById('form-novo-usuario').addEventListener('submit', async (e) => {
    e.preventDefault();

    const nome = document.getElementById('nome').value.trim();
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;
    const confirmarSenha = document.getElementById('confirmarSenha').value;
    const tipo = tipoSelect.value;

    const permissoes = Array.from(permissoesContainer.querySelectorAll('input[name="permissoes"]:checked'))
      .map(cb => cb.value);

    if (!nome || !email || !senha || !confirmarSenha || !tipo) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (senha !== confirmarSenha) {
      alert('As senhas não coincidem.');
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/usuarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'usuario-logado': JSON.stringify(usuarioLogado || '')
        },
        body: JSON.stringify({ nome, email, senha, tipo, permissoes })
      });

      const texto = await response.text();

      if (response.ok) {
        alert('Usuário cadastrado com sucesso!');
        window.location.href = 'usuarios.html';
      } else {
        alert('Erro ao cadastrar: ' + texto);
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao cadastrar usuário.');
    }
  });
});

function logout() {
  localStorage.removeItem('usuarioLogado');
  window.location.href = 'login.html';
}
