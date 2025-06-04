function aplicarMascaraCPF(input) {
  input.addEventListener('input', () => {
    let v = input.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    input.value = v;

    if (v.length === 14) {
      const isAjudante = input.id.startsWith("cpf-ajudante");
      const pedidoId = input.dataset.pedido || '';
      const index = input.dataset.index || '0';
      verificarCPF(pedidoId, isAjudante, index);
    }
  });
}

function aplicarMascaraPlaca(input) {
  input.addEventListener('input', () => {
    let v = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (v.length > 7) v = v.slice(0, 7);
    if (v.length > 3) v = v.slice(0, 3) + '-' + v.slice(3);
    input.value = v;
  });
}

function formatarData(data) {
  if (!data) return '—';
  try {
    const dt = new Date(data);
    if (isNaN(dt)) return '—';
    return dt.toLocaleDateString('pt-BR').slice(0, 5) + ' ' +
      String(dt.getHours()).padStart(2, '0') + ':' +
      String(dt.getMinutes()).padStart(2, '0');
  } catch {
    return data;
  }
}

async function verificarCPF(pedidoId, isAjudante = false, index = '0') {
  const cpfInput = isAjudante
    ? document.getElementById(`cpf-ajudante-${pedidoId}-${index}`)
    : document.getElementById(`cpf-${pedidoId}`);

  const cpf = cpfInput?.value?.replace(/\D/g, '');
  if (!cpf || cpf.length < 11) return;

  const statusDiv = document.getElementById(
    isAjudante
      ? `status-cadastro-ajudante-${index}`
      : `status-cadastro-${pedidoId}`
  );

  try {
    const res = await fetch(`/api/motoristas/${cpf}`);
    const data = await res.json();

    let html = '';
    if (!data.encontrado) {
      html = `<span class="status-cadastro nao">🟠 Motorista não cadastrado</span>`;
    } else if (data.cadastroVencido) {
      html = `<span class="status-cadastro vencido">🔴 Cadastro vencido - necessário reenvio da ficha e foto</span>`;
    } else {
      html = `<span class="status-cadastro ok">🟢 Motorista já cadastrado</span>`;
    }

    statusDiv.innerHTML = html;
    statusDiv.style.display = 'block';

    if (!isAjudante) {
      const nomeInput = document.getElementById(`nome-${pedidoId}`);
      const placaInput = document.getElementById(`placa-${pedidoId}`);
      nomeInput.value = data.nome || '';
      nomeInput.readOnly = !!data.encontrado;
      placaInput.value = data.placa || '';
      placaInput.readOnly = !!data.encontrado;

      const bloco = document.getElementById(`bloco-form-${pedidoId}`);
      if (bloco) bloco.style.display = 'block';

      const grupoFicha = document.getElementById(`grupo-ficha-${pedidoId}`);
      const grupoDoc = document.getElementById(`grupo-doc-${pedidoId}`);
      if (!data.encontrado || data.cadastroVencido) {
        grupoFicha.style.display = 'block';
        grupoDoc.style.display = 'block';
      } else {
        grupoFicha.style.display = 'none';
        grupoDoc.style.display = 'none';
      }

    } else {
      const nomeAj = document.getElementById(`nome-ajudante-${index}`);
      nomeAj.value = data.nome || '';
      nomeAj.readOnly = !!data.encontrado;

      const grupoFichaAj = document.getElementById(`grupo-ficha-ajudante-${index}`);
      const grupoDocAj = document.getElementById(`grupo-doc-ajudante-${index}`);
      if (!data.encontrado || data.cadastroVencido) {
        grupoFichaAj.style.display = 'block';
        grupoDocAj.style.display = 'block';
      } else {
        grupoFichaAj.style.display = 'none';
        grupoDocAj.style.display = 'none';
      }
    }

  } catch (error) {
    console.error('Erro na verificação de CPF:', error);
    statusDiv.innerHTML = `<span class="status-cadastro nao">Erro ao verificar CPF</span>`;
    statusDiv.style.display = 'block';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  carregarPedidosPortaria();
});

async function carregarPedidosPortaria() {
  const dataAtual = new Date().toISOString().split('T')[0];
  const url = `/api/pedidos/portaria?data=${dataAtual}`;
  try {
    const resposta = await fetch(url);
    const pedidos = await resposta.json();
    const container = document.getElementById('lista-pedidos');
    container.innerHTML = '';

    pedidos.forEach(pedido => {
      const card = document.createElement('div');
      card.className = 'card';
      if (pedido.status === 'Coleta Iniciada') {
        card.classList.add('finalizado');
      }

      const statusClasse = pedido.status === 'Coleta Iniciada' ? 'status-verde' : 'status-amarelo';
      const statusTexto = pedido.status === 'Coleta Iniciada' ? 'Coleta Iniciada' : 'Aguardando Início da Coleta';

      card.innerHTML = `
        <div class="card-header" onclick="toggleFormulario('${pedido.id}')">
          <div class="info">
            <h3>${pedido.nome_cliente}</h3>
            <p>Previsão de coleta: ${formatarData(pedido.data_prevista_coleta)}</p>
          </div>
          <div class="status-badge ${statusClasse}">${statusTexto}</div>
        </div>

        ${gerarLinhaTempoCompleta(pedido)}

        <div class="formulario" id="formulario-${pedido.id}">
          <div class="bloco-motorista" id="bloco-form-${pedido.id}" style="display: none;">
            <h3><i class="fas fa-truck"></i> Dados do Motorista</h3>

            <div class="linha-cpf-status">
              <div class="cpf-input">
                <label for="cpf-${pedido.id}">CPF do Motorista:</label>
                <input type="text" id="cpf-${pedido.id}" maxlength="14" data-pedido="${pedido.id}">
              </div>
              <div class="status-label" id="status-cadastro-${pedido.id}" style="display: none;"></div>
            </div>

            <div class="linha-motorista">
              <div>
                <label for="nome-${pedido.id}">Nome do Motorista:</label>
                <input type="text" id="nome-${pedido.id}">
              </div>
              <div>
                <label for="placa-${pedido.id}">Placa do Veículo:</label>
                <input type="text" id="placa-${pedido.id}">
              </div>
            </div>

            <div class="linha-form">
              <div>
                <label for="ajudante-${pedido.id}">Tem Ajudante?</label>
                <select id="ajudante-${pedido.id}" onchange="mostrarAjudante(this, '${pedido.id}')">
                  <option value="">Selecione</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>
            </div>

            <div id="ajudantes-container-${pedido.id}"></div>

            <div class="linha-form" id="grupo-doc-${pedido.id}" style="display: none;">
              <div class="upload-wrapper">
                <label>Foto do Documento:</label>
                <input type="file" name="documento_motorista">
              </div>
              <div class="upload-wrapper">
                <label>Foto da Ficha Assinada:</label>
                <input type="file" name="ficha_motorista">
              </div>
            </div>

            <div class="linha-form" id="grupo-ficha-${pedido.id}" style="display: none;">
              <div class="upload-wrapper">
                <label>Foto do Caminhão:</label>
                <input type="file" name="foto_caminhao">
              </div>
            </div>

            <button class="botao-iniciar-coleta" onclick="iniciarColeta('${pedido.id}')">
              <i class="fas fa-play"></i> Iniciar Coleta
            </button>
          </div>
        </div>
      `;

      container.appendChild(card);

      aplicarMascaraCPF(document.getElementById(`cpf-${pedido.id}`));
      aplicarMascaraPlaca(document.getElementById(`placa-${pedido.id}`));
    });
  } catch (erro) {
    console.error('Erro ao carregar pedidos:', erro);
  }
}

function toggleFormulario(id) {
  const formulario = document.getElementById(`formulario-${id}`);
  const blocoForm = document.getElementById(`bloco-form-${id}`);
  if (formulario.style.display === 'block') {
    formulario.style.display = 'none';
  } else {
    formulario.style.display = 'block';
    blocoForm.style.display = 'block';
  }
}

function aplicarMascaraCPF(input) {
  input.addEventListener('input', () => {
    let v = input.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    input.value = v;

    if (v.length === 14) {
      const pedidoId = input.dataset.pedido || '';
      verificarCPF(pedidoId);
    }
  });
}

function aplicarMascaraPlaca(input) {
  input.addEventListener('input', () => {
    let v = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (v.length > 7) v = v.slice(0, 7);
    v = v.replace(/^([A-Z]{3})(\d{1,4})$/, '$1-$2');
    input.value = v;
  });
}

function mostrarAjudante(select, pedidoId) {
  const container = document.getElementById(`ajudantes-container-${pedidoId}`);
  container.innerHTML = '';

  if (select.value === 'sim') {
    const card = document.createElement('div');
    card.className = 'subcard';
    card.id = `ajudante-card-${pedidoId}`;

    card.innerHTML = `
      <h3>Ajudante</h3>
      <button class="btn-fechar-ajudante" onclick="removerAjudante('${pedidoId}')">Remover Ajudante</button>
      <div class="linha-form">
        <div>
          <label>Nome do Ajudante:</label>
          <input type="text" name="nome_ajudante">
        </div>
        <div>
          <label>CPF do Ajudante:</label>
          <input type="text" name="cpf_ajudante" maxlength="14" oninput="mascaraCPF(this)">
        </div>
      </div>
    `;

    container.appendChild(card);
  }
}

function removerAjudante(pedidoId) {
  const container = document.getElementById(`ajudantes-container-${pedidoId}`);
  container.innerHTML = '';
  const select = document.getElementById(`ajudante-${pedidoId}`);
  if (select) select.value = '';
}

function verificarCPF(pedidoId) {
  const cpfInput = document.getElementById(`cpf-${pedidoId}`);
  const statusDiv = document.getElementById(`status-cadastro-${pedidoId}`);
  const grupoDoc = document.getElementById(`grupo-doc-${pedidoId}`);
  const grupoFicha = document.getElementById(`grupo-ficha-${pedidoId}`);
  const nomeInput = document.getElementById(`nome-${pedidoId}`);

  const cpf = cpfInput.value.replace(/\D/g, '');

  // Simulação da verificação:
  statusDiv.style.display = 'block';

  if (cpf.endsWith('1')) {
    statusDiv.className = 'status-cadastro ok';
    statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> Motorista já cadastrado';
    grupoDoc.style.display = 'none';
    grupoFicha.style.display = 'block';
    nomeInput.value = 'João da Silva';
    nomeInput.disabled = true;
  } else if (cpf.endsWith('2')) {
    statusDiv.className = 'status-cadastro vencido';
    statusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Cadastro vencido - necessário reenvio';
    grupoDoc.style.display = 'block';
    grupoFicha.style.display = 'block';
    nomeInput.value = '';
    nomeInput.disabled = false;
  } else {
    statusDiv.className = 'status-cadastro nao';
    statusDiv.innerHTML = '<i class="fas fa-times-circle"></i> Motorista não cadastrado';
    grupoDoc.style.display = 'block';
    grupoFicha.style.display = 'block';
    nomeInput.value = '';
    nomeInput.disabled = false;
  }
}

function formatarData(data) {
  const d = new Date(data);
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function iniciarColeta(pedidoId) {
  const confirmado = confirm('Tem certeza que deseja iniciar a coleta deste pedido?');
  if (!confirmado) return;

  fetch(`/api/pedidos/${pedidoId}/coleta`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Coleta Iniciada' })
  })
    .then(res => {
      if (res.ok) {
        alert('Coleta iniciada com sucesso!');
        location.reload();
      } else {
        throw new Error('Erro ao iniciar coleta');
      }
    })
    .catch(err => {
      console.error(err);
      alert('Falha ao iniciar coleta.');
    });
}
