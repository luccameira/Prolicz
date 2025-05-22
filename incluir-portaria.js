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
    const pedidoId = pedido.pedido_id || pedido.id;
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
      form.innerHTML = `
  <div style="display: flex; align-items: flex-end; gap: 12px;">
    <div style="max-width: 300px; flex: none;">
      <label>CPF do Motorista</label>
      <input type="text" id="cpf-${pedidoId}" required placeholder="Digite o CPF">
    </div>
    <div id="status-cadastro-${pedidoId}" style="display: none; flex: 1;"></div>
  </div>

  <div id="bloco-form-${pedidoId}" class="subcard" style="display: none; margin-top: 25px; padding: 20px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 10px;">
    <h4 style="margin-bottom: 15px;">Motorista</h4>
    <div style="display: flex; gap: 20px;">
      <div style="flex: 1;">
        <label>Nome do Motorista</label>
        <input type="text" id="nome-${pedidoId}" placeholder="Nome completo do motorista" required>
      </div>
      <div style="flex: 1;">
        <label>Placa do Veículo</label>
        <input type="text" id="placa-${pedidoId}" placeholder="Digite a placa do caminhão" required>
      </div>
    </div>

    <label style="margin-top: 12px;">
      Foto do Caminhão
      <input type="file" id="foto-caminhao-${pedidoId}" accept="image/*" required>
    </label>

    <label style="margin-top: 12px;">
      Ficha de Integração Assinada (motorista)
      <input type="file" id="ficha-${pedidoId}" accept="image/*" required>
    </label>

    <label style="margin-top: 12px;">
      Foto do Documento (motorista)
      <input type="file" id="doc-${pedidoId}" accept="image/*" required>
    </label>

    <label style="margin-top: 12px;">Tem Ajudante?</label>
    <select id="tem-ajudante-${pedidoId}" required>
      <option value="">Selecione</option>
      <option value="sim">Sim</option>
      <option value="nao">Não</option>
    </select>

    <div id="card-ajudante-${pedidoId}" style="display: none; margin-top: 25px;"></div>

    <button class="btn btn-registrar" style="margin-top: 20px;" onclick="registrarColeta(${pedidoId}, this)">Iniciar Coleta</button>
  </div>
`;


    if (!finalizado) {
      header.addEventListener('click', () => {
        form.style.display = form.style.display === 'block' ? 'none' : 'block';
        aplicarMascaraCPF(form.querySelector(`#cpf-${pedidoId}`));
      });
    }

    card.appendChild(form);
    lista.appendChild(card);
  });
}

function exibirCardAjudante(pedidoId) {
  const card = document.getElementById(`card-ajudante-${pedidoId}`);
  card.style.display = 'block';
  card.innerHTML = `
    <div class="subcard" style="padding: 20px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 10px;">
      <h4 style="margin-bottom: 15px;">Ajudante</h4>
      <div style="display: flex; align-items: flex-end; gap: 12px;">
        <div style="max-width: 300px; flex: none;">
          <label>CPF do Ajudante</label>
          <input type="text" id="cpf-ajudante-${pedidoId}" required placeholder="Digite o CPF do ajudante">
        </div>
        <div id="status-cadastro-ajudante-${pedidoId}" style="display: none; flex: 1;"></div>
      </div>

      <div style="margin-top: 20px;">
        <label>Nome do Ajudante</label>
        <input type="text" id="nome-ajudante-${pedidoId}" placeholder="Nome completo do ajudante" required>

        <label style="margin-top: 12px;">Ficha de Integração Assinada (ajudante)</label>
        <input type="file" id="ficha-ajudante-${pedidoId}" accept="image/*" required>

        <label style="margin-top: 12px;">Foto do Documento (ajudante)</label>
        <input type="file" id="doc-ajudante-${pedidoId}" accept="image/*" required>
      </div>
    </div>
  `;

  const cpfInput = document.getElementById(`cpf-ajudante-${pedidoId}`);
  aplicarMascaraCPF(cpfInput);
  cpfInput.addEventListener('input', () => {
    const cpf = cpfInput.value.replace(/\D/g, '');
    if (cpf.length === 11) verificarCPF(pedidoId, true);
  });
}

async function verificarCPF(pedidoId, isAjudante = false) {
  const prefix = isAjudante ? 'cpf-ajudante' : 'cpf';
  const nomePrefix = isAjudante ? 'nome-ajudante' : 'nome';
  const alertaPrefix = isAjudante ? 'status-cadastro-ajudante' : 'status-cadastro';
  const docId = isAjudante ? 'doc-ajudante' : 'doc';
  const fichaId = isAjudante ? 'ficha-ajudante' : 'ficha';
  const cardId = isAjudante ? `card-ajudante-${pedidoId}` : `bloco-form-${pedidoId}`;

  const cpf = document.getElementById(`${prefix}-${pedidoId}`).value.trim();
  const nomeInput = document.getElementById(`${nomePrefix}-${pedidoId}`);
  const alerta = document.getElementById(`${alertaPrefix}-${pedidoId}`);
  const docInput = document.getElementById(`${docId}-${pedidoId}`);
  const fichaInput = document.getElementById(`${fichaId}-${pedidoId}`);
  const blocoForm = document.getElementById(cardId);

  const docLabel = docInput?.closest('label');
  const fichaLabel = fichaInput?.closest('label');

  if (!cpf) return;

  try {
    const res = await fetch(`/api/motoristas/${cpf}`);
    blocoForm.style.display = 'block';

    if (res.status === 404) {
      alerta.className = 'alerta-vencido';
      alerta.style.display = 'block';
      alerta.innerText = '🚫 Não possui cadastro.';
      nomeInput.disabled = false;
      nomeInput.value = '';
      docInput.required = true;
      fichaInput.required = true;
      docLabel.style.display = 'block';
      fichaLabel.style.display = 'block';
    } else {
      const dados = await res.json();
      nomeInput.value = dados.nome;
      nomeInput.disabled = true;

      if (dados.cadastroVencido) {
        alerta.className = 'alerta-vencido';
        alerta.style.display = 'block';
        alerta.innerText = '⚠️ Cadastro vencido. Reenvie a ficha de integração.';
        fichaInput.required = true;
        docInput.required = false;
        fichaLabel.style.display = 'block';
        docLabel.style.display = 'none';
      } else {
        alerta.className = 'alerta-sucesso';
        alerta.style.display = 'block';
        alerta.innerText = '✅ Já cadastrado.';
        fichaInput.required = false;
        docInput.required = false;
        fichaLabel.style.display = 'none';
        docLabel.style.display = 'none';
      }
    }
  } catch (err) {
    console.error('Erro ao verificar CPF:', err);
  }
}

document.addEventListener('change', function (e) {
  if (e.target.id.startsWith('tem-ajudante-')) {
    const pedidoId = e.target.id.split('-')[2];
    const valor = e.target.value;
    const card = document.getElementById(`card-ajudante-${pedidoId}`);
    if (valor === 'sim') {
      exibirCardAjudante(pedidoId);
    } else {
      card.style.display = 'none';
      card.innerHTML = '';
    }
  }
});

async function registrarColeta(pedidoId, botao) {
  const cpf = document.getElementById(`cpf-${pedidoId}`)?.value.trim();
  const nome = document.getElementById(`nome-${pedidoId}`)?.value.trim();
  const placa = document.getElementById(`placa-${pedidoId}`)?.value.trim();
  const caminhaoInput = document.getElementById(`foto-caminhao-${pedidoId}`);
  const fichaInput = document.getElementById(`ficha-${pedidoId}`);
  const docInput = document.getElementById(`doc-${pedidoId}`);

  const temAjudante = document.getElementById(`tem-ajudante-${pedidoId}`)?.value === 'sim';
  const cpfAjudante = document.getElementById(`cpf-ajudante-${pedidoId}`)?.value.trim();
  const nomeAjudante = document.getElementById(`nome-ajudante-${pedidoId}`)?.value.trim();
  const fichaAjudante = document.getElementById(`ficha-ajudante-${pedidoId}`);
  const docAjudante = document.getElementById(`doc-ajudante-${pedidoId}`);

  if (!cpf || !placa || !caminhaoInput.files.length) {
    alert('Preencha todos os campos obrigatórios.');
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
  if (docInput?.files.length) formData.append('documento', docInput.files[0]);

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
