document.addEventListener('DOMContentLoaded', async () => {
  const usuarioLogado = JSON.parse(localStorage.getItem('usuarioLogado'));
  if (!usuarioLogado || usuarioLogado.tipo.toLowerCase() !== 'administrador') {
    alert('Apenas administradores podem editar usuários.');
    window.location.href = 'login.html';
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const usuarioId = params.get('id');
  if (!usuarioId) {
    alert('Usuário inválido.');
    window.location.href = 'usuarios.html';
    return;
  }

  const nomeInput = document.getElementById('nome');
  const emailInput = document.getElementById('email');
  const senhaInput = document.getElementById('senha');
  const permissoesContainer = document.getElementById('permissoes-container');

  const trocaSenhaDiv = document.getElementById('troca-senha');
  document.getElementById('btn-trocar-senha').addEventListener('click', () => {
    trocaSenhaDiv.style.display = trocaSenhaDiv.style.display === 'none' ? 'block' : 'none';
  });

  const mostrarBtn = document.getElementById('mostrar-senha');
const icone = mostrarBtn.querySelector('i');

mostrarBtn.title = 'exibir senha';

mostrarBtn.addEventListener('click', () => {
  const mostrando = senhaInput.type === 'text';
  senhaInput.type = mostrando ? 'password' : 'text';
  icone.className = mostrando ? 'fa fa-eye' : 'fa fa-eye-slash';
  mostrarBtn.title = mostrando ? 'exibir senha' : 'ocultar senha';
  mostrarBtn.style.color = '#ffc107';
});

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

  const permissoesSecundarias = {
    'Visualizar Clientes': ['Adicionar Cliente', 'Editar Cliente', 'Excluir Cliente'],
    'Visualizar Vendas': ['Adicionar Venda', 'Editar Venda', 'Excluir Venda'],
    'Visualizar Produtos': ['Adicionar Produto', 'Editar Produto', 'Excluir Produto'],
    'Visualizar Usuários': ['Adicionar Usuário', 'Editar Usuário', 'Excluir Usuário'],
    'Visualizar Tarefas - Portaria': ['Executar Tarefas - Portaria', 'Editar Tarefas - Portaria'],
    'Visualizar Tarefas - Carga e Descarga': ['Executar Tarefas - Carga e Descarga', 'Editar Tarefas - Carga e Descarga'],
    'Visualizar Tarefas - Conferência de Peso': ['Executar Tarefas - Conferência de Peso', 'Editar Tarefas - Conferência de Peso'],
    'Visualizar Tarefas - Financeiro': ['Executar Tarefas - Financeiro', 'Editar Tarefas - Financeiro'],
    'Visualizar Tarefas - Emissão de NF': ['Executar Tarefas - Emissão de NF', 'Editar Tarefas - Emissão de NF']
  };

  try {
    const res = await fetch(`/api/usuarios/${usuarioId}`);
    const usuario = await res.json();

    nomeInput.value = usuario.nome;
    emailInput.value = usuario.email;
    senhaInput.value = usuario.senha || '';

    const permissoesUsuario = usuario.permissoes || [];

    const titulo = document.createElement('h3');
    titulo.textContent = 'Permissões';
    permissoesContainer.appendChild(titulo);

    permissoesPrimarias.forEach(permissao => {
      const bloco = document.createElement('div');
      bloco.classList.add('permissao-bloco');

      const labelPrimaria = document.createElement('label');
      labelPrimaria.classList.add('permissao-primaria');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = permissao;
      checkbox.name = 'permissoes';
      checkbox.id = `perm-${permissao}`;
      if (permissoesUsuario.includes(permissao)) checkbox.checked = true;

      const spanTexto = document.createElement('span');
      spanTexto.textContent = permissao;
      spanTexto.classList.add('primaria-texto');

      labelPrimaria.appendChild(checkbox);
      labelPrimaria.appendChild(spanTexto);

      const secundariasContainer = document.createElement('div');
      secundariasContainer.classList.add('permissoes-secundarias');
      secundariasContainer.style.display = checkbox.checked ? 'flex' : 'none';

      checkbox.addEventListener('change', () => {
        secundariasContainer.style.display = checkbox.checked ? 'flex' : 'none';
      });

      if (permissoesSecundarias[permissao]) {
        permissoesSecundarias[permissao].forEach(sec => {
          const secCheckbox = document.createElement('input');
          secCheckbox.type = 'checkbox';
          secCheckbox.value = sec;
          secCheckbox.name = 'permissoes';
          secCheckbox.id = `sec-${sec}`;
          if (permissoesUsuario.includes(sec)) secCheckbox.checked = true;

          const secLabel = document.createElement('label');
          secLabel.setAttribute('for', secCheckbox.id);
          secLabel.classList.add('secundaria-label');
          secLabel.appendChild(secCheckbox);

          const spanSec = document.createElement('span');
          spanSec.textContent = sec;
          secLabel.appendChild(spanSec);

          secundariasContainer.appendChild(secLabel);
        });
      }

      bloco.appendChild(labelPrimaria);
      bloco.appendChild(secundariasContainer);
      permissoesContainer.appendChild(bloco);
    });

  } catch (error) {
    alert('Erro ao carregar dados do usuário.');
    console.error(error);
  }

  document.getElementById('form-editar-usuario').addEventListener('submit', async (e) => {
    e.preventDefault();

    const novaSenha = document.getElementById('novaSenha')?.value || '';
    const confirmar = document.getElementById('confirmarNovaSenha')?.value || '';

    if (novaSenha && novaSenha !== confirmar) {
      alert('As senhas não coincidem.');
      return;
    }

    const permissoesSelecionadas = Array.from(document.querySelectorAll('input[name="permissoes"]:checked')).map(cb => cb.value);

    const payload = {
      nome: nomeInput.value.trim(),
      email: emailInput.value.trim(),
      senha: novaSenha || senhaInput.value,
      permissoes: permissoesSelecionadas
    };

    try {
      const res = await fetch(`/api/usuarios/${usuarioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const msg = await res.text();
      if (res.ok) {
        alert('Usuário atualizado com sucesso!');
        window.location.href = 'usuarios.html';
      } else {
        alert('Erro ao atualizar: ' + msg);
      }
    } catch (err) {
      alert('Erro ao enviar dados.');
      console.error(err);
    }
  });
});
