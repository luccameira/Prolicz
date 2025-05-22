document.addEventListener('DOMContentLoaded', carregarPedidosPortaria);

function aplicarMascaraCPF(input) {
  input.addEventListener('input', () => {
    let v = input.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    input.value = v;

    if (v.length === 14) {
      const id = input.id.split('-')[1];
      if (input.id.startsWith("cpf-ajudante")) return;
      verificarCPF(id);
    }
  });
}

function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR');
}

async function carregarPedidosPortaria() {
  const [resPendentes, resIniciados] = await Promise.all([
    fetch('/api/pedidos?status=Aguardando%20In%C3%ADcio%20da%20Coleta'),
    fetch('/api/pedidos?status=Coleta%20Iniciada')
  ]);

  const pendentes = await resPendentes.json();
  const iniciados = await resIniciados.json();
  const lista = document.getElementById('lista-pedidos');
  lista.innerHTML = '';

  const todos = [...pendentes, ...iniciados];
  if (!todos.length) {
    lista.innerHTML = "<p style='padding: 0 25px;'>Nenhum pedido encontrado.</p>";
    return;
  }

  todos.forEach(pedido => {
    const idPedido = pedido.pedido_id || pedido.id;
    const finalizado = pedido.status === 'Coleta Iniciada';

    const card = document.createElement('div');
    card.className = 'card';
    if (finalizado) card.classList.add('finalizado');

    const dataFormatada = formatarData(pedido.data_coleta || new Date());

    const statusHtml = finalizado
      ? `<div class="status-badge status-verde"><i class="fa fa-check"></i> Coleta Iniciada</div>`
      : `<div class="status-badge status-amarelo"><i class="fa fa-truck"></i> ${pedido.status}</div>`;

    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `
      <div class="info">
        <h3>${pedido.cliente}</h3>
        <p>Data Prevista: ${dataFormatada}</p>
      </div>
      ${statusHtml}
    `;
    card.appendChild(header);

    const form = document.createElement('div');
    form.className = 'formulario';
    form.style.display = 'none';

    form.innerHTML = `
      <div style="display: flex; align-items: flex-end; gap: 12px;">
        <div style="flex: 1;">
          <label>CPF do Motorista</label>
          <input type="text" placeholder="Digite o CPF" id="cpf-${idPedido}" required>
        </div>
        <div id="status-cadastro-${idPedido}" style="display: none; min-width: 220px;"></div>
      </div>

      <div id="bloco-form-${idPedido}" style="display: none;">
        <div style="display: flex; gap: 20px;">
          <div style="flex: 1;">
            <label>Nome do Motorista</label>
            <input type="text" id="nome-${idPedido}" placeholder="Nome completo do motorista">
          </div>
          <div style="flex: 1;">
            <label>Placa do Veículo</label>
            <input type="text" id="placa-${idPedido}" placeholder="Digite a placa do caminhão">
          </div>
        </div>

        <label>Foto do Caminhão</label>
        <input type="file" id="foto-caminhao-${idPedido}" accept="image/*">

        <label>Ficha de Integração Assinada (motorista)</label>
        <input type="file" id="ficha-${idPedido}" accept="image/*">

        <label for="tem-ajudante-${idPedido}" style="margin-top: 12px;">Tem Ajudante?</label>
        <select id="tem-ajudante-${idPedido}">
          <option value="">Selecione</option>
          <option value="sim">Sim</option>
          <option value="nao">Não</option>
        </select>

        <div id="bloco-ajudante-${idPedido}" style="display: none; margin-top: 20px;">
          <label>CPF do Ajudante</label>
          <input type="text" id="cpf-ajudante-${idPedido}" placeholder="Digite o CPF do ajudante">

          <div id="campos-ajudante-${idPedido}" style="display: none;">
            <label>Nome do Ajudante</label>
            <input type="text" id="nome-ajudante-${idPedido}" placeholder="Nome completo do ajudante">

            <label>Foto do Documento (ajudante)</label>
            <input type="file" id="doc-ajudante-${idPedido}" accept="image/*">

            <label>Ficha de Integração Assinada (ajudante)</label>
            <input type="file" id="ficha-ajudante-${idPedido}" accept="image/*">
          </div>
        </div>

        <button class="btn btn-registrar" onclick="registrarColeta(${idPedido}, this)">Iniciar Coleta</button>
      </div>
    `;

    if (!finalizado) {
      header.addEventListener('click', () => {
        form.style.display = form.style.display === 'block' ? 'none' : 'block';
        aplicarMascaraCPF(form.querySelector(`#cpf-${idPedido}`));

        const select = form.querySelector(`#tem-ajudante-${idPedido}`);
        const blocoAjudante = form.querySelector(`#bloco-ajudante-${idPedido}`);
        const camposAjudante = form.querySelector(`#campos-ajudante-${idPedido}`);
        const cpfAjudante = form.querySelector(`#cpf-ajudante-${idPedido}`);

        aplicarMascaraCPF(cpfAjudante);

        select.addEventListener('change', () => {
          const temAjudante = select.value === 'sim';
          blocoAjudante.style.display = temAjudante ? 'block' : 'none';
          camposAjudante.style.display = 'none';
        });

        cpfAjudante.addEventListener('input', () => {
          const cpf = cpfAjudante.value.replace(/\D/g, '');
          if (cpf.length === 11) {
            camposAjudante.style.display = 'block';
          }
        });
      });
    }

    card.appendChild(form);
    lista.appendChild(card);
  });
}

async function verificarCPF(pedidoId) {
  const cpf = document.getElementById(`cpf-${pedidoId}`).value.trim();
  const nomeInput = document.getElementById(`nome-${pedidoId}`);
  const alerta = document.getElementById(`status-cadastro-${pedidoId}`);
  const blocoForm = document.getElementById(`bloco-form-${pedidoId}`);

  if (!cpf) return;

  try {
    const res = await fetch(`/api/motoristas/${cpf}`);
    blocoForm.style.display = 'block';

    if (res.status === 404) {
      alerta.className = 'alerta-vencido';
      alerta.style.display = 'block';
      alerta.innerText = '🚫 Motorista não possui cadastro.';
      nomeInput.disabled = false;
      nomeInput.value = '';
    } else {
      const dados = await res.json();
      nomeInput.value = dados.nome;
      nomeInput.disabled = true;

      if (dados.cadastroVencido) {
        alerta.className = 'alerta-vencido';
        alerta.style.display = 'block';
        alerta.innerText = '⚠️ Cadastro vencido. Reenvie a ficha de integração e a foto do caminhão.';
      } else {
        alerta.className = 'alerta-sucesso';
        alerta.style.display = 'block';
        alerta.innerText = '✅ Motorista já cadastrado.';
      }
    }
  } catch (err) {
    console.error('Erro ao verificar CPF:', err);
  }
}

async function registrarColeta(pedidoId, botao) {
  const cpf = document.getElementById(`cpf-${pedidoId}`).value.trim();
  const nome = document.getElementById(`nome-${pedidoId}`)?.value.trim();
  const placa = document.getElementById(`placa-${pedidoId}`)?.value.trim();
  const caminhaoInput = document.getElementById(`foto-caminhao-${pedidoId}`);
  const fichaInput = document.getElementById(`ficha-${pedidoId}`);

  const temAjudante = document.getElementById(`tem-ajudante-${pedidoId}`)?.value === 'sim';
  const cpfAjudante = document.getElementById(`cpf-ajudante-${pedidoId}`)?.value.trim();
  const nomeAjudante = document.getElementById(`nome-ajudante-${pedidoId}`)?.value.trim();
  const docAjudante = document.getElementById(`doc-ajudante-${pedidoId}`);
  const fichaAjudante = document.getElementById(`ficha-ajudante-${pedidoId}`);

  if (!cpf || !placa || !caminhaoInput.files.length) {
    alert('Preencha todos os campos obrigatórios.');
    return;
  }

  if (temAjudante && document.getElementById(`tem-ajudante-${pedidoId}`).value === "") {
    alert('Por favor, selecione se há ajudante.');
    return;
  }

  botao.disabled = true;
  botao.innerText = 'Enviando...';

  const formData = new FormData();
  formData.append('cpf', cpf);
  formData.append('placa', placa);
  formData.append('foto_caminhao', caminhaoInput.files[0]);
  if (nome) formData.append('nome', nome);
  if (fichaInput?.files.length) formData.append('ficha_integracao', fichaInput.files[0]);

  if (temAjudante && cpfAjudante && nomeAjudante) {
    formData.append('cpf_ajudante', cpfAjudante);
    formData.append('nome_ajudante', nomeAjudante);
    if (docAjudante?.files.length) formData.append('documento_ajudante', docAjudante.files[0]);
    if (fichaAjudante?.files.length) formData.append('ficha_ajudante', fichaAjudante.files[0]);
  }

  try {
    const res = await fetch('/api/motoristas', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error();

    await fetch(`/api/pedidos/${pedidoId}/coleta`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placa, motorista: nome, ajudante: nomeAjudante || '' })
    });

    alert('Coleta iniciada com sucesso!');
    carregarPedidosPortaria();
  } catch (err) {
    console.error('Erro ao registrar coleta:', err);
    alert('Erro ao registrar coleta.');
    botao.disabled = false;
    botao.innerText = 'Iniciar Coleta';
  }
}
