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
      html = `<span style="background:#ff9800;color:#000;padding:6px 12px;border-radius:6px;font-weight:600;display:inline-block;">🟠 Motorista não cadastrado</span>`;
    } else if (data.cadastroVencido) {
      html = `<span style="background:#dc3545;color:#fff;padding:6px 12px;border-radius:6px;font-weight:600;display:inline-block;">🔴 Cadastro vencido - necessário reenvio da ficha e foto</span>`;
    } else {
      html = `<span style="background:#28a745;color:#fff;padding:6px 12px;border-radius:6px;font-weight:600;display:inline-block;">🟢 Motorista já cadastrado</span>`;
    }

    statusDiv.innerHTML = html;
    statusDiv.style.display = 'flex';

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
    statusDiv.innerHTML = `<span style="color: red;">Erro ao verificar CPF</span>`;
    statusDiv.style.display = 'flex';
  }
}

async function carregarPedidosPortaria() {
  const hoje = new Date().toISOString().split('T')[0];
  const res = await fetch(`/api/pedidos/portaria?data=${hoje}`);
  const pedidos = await res.json();

  const lista = document.getElementById('lista-pedidos');
  lista.innerHTML = '';

  if (!pedidos.length) {
    lista.innerHTML = "<p style='padding: 0 25px;'>Nenhum pedido encontrado.</p>";
    return;
  }

  pedidos.sort((a, b) => {
    const prioridade = status => status === 'Finalizado' ? 1 : 0;
    return prioridade(a.status) - prioridade(b.status);
  });

  pedidos.forEach(pedido => {
    const pedidoId = pedido.pedido_id || pedido.id;
    const status = pedido.status;

    const card = document.createElement('div');
    card.className = 'card';

    const header = document.createElement('div');
    header.className = 'card-header';

    const info = document.createElement('div');
    info.className = 'info';
    info.innerHTML = `
      <h3>${pedido.cliente}</h3>
      <p>Data prevista: ${formatarData(pedido.data_coleta)}</p>
    `;

    const statusTag = document.createElement('div');
    statusTag.className = 'status-badge';
    if (status === 'Aguardando Início da Coleta') {
      statusTag.classList.add('status-amarelo');
      statusTag.textContent = 'Aguardando Início da Coleta';
    } else {
      statusTag.classList.add('status-verde');
      statusTag.textContent = 'Coleta Iniciada';
    }

    header.appendChild(info);
    header.appendChild(statusTag);
    card.appendChild(header);

    const linhaTempo = document.createElement('div');
    linhaTempo.innerHTML = gerarLinhaTempoCompleta(pedido);
    card.appendChild(linhaTempo);

    setTimeout(() => {
      const timeline = card.querySelector('.timeline-simples');
      if (timeline) animarLinhaProgresso(timeline);
    }, 20);

    if (status === 'Aguardando Início da Coleta') {
      renderizarFormularioColeta(pedido, card);
    }

    lista.appendChild(card);
  });
}

function renderizarFormularioColeta(pedido, card) {
  const pedidoId = pedido.pedido_id || pedido.id;

  const container = document.createElement('div');
  container.className = 'formulario';
  container.innerHTML = `
    <div class="bloco-motorista">
      <h3><i class="fas fa-id-card"></i> Dados do Motorista</h3>
      <div class="linha-cpf-status">
        <div class="cpf-input">
          <label for="cpf-${pedidoId}">CPF do Motorista</label>
          <input type="text" id="cpf-${pedidoId}" data-pedido="${pedidoId}" placeholder="000.000.000-00" required>
        </div>
        <div class="status-label" id="status-cadastro-${pedidoId}" style="display: none;"></div>
      </div>

      <div id="bloco-form-${pedidoId}" style="display: none;">
        <div class="linha-motorista">
          <div>
            <label for="nome-${pedidoId}">Nome do Motorista</label>
            <input type="text" id="nome-${pedidoId}" placeholder="Nome completo" required>
          </div>
          <div>
            <label for="placa-${pedidoId}">Placa do Veículo</label>
            <input type="text" id="placa-${pedidoId}" placeholder="AAA-0000" required>
          </div>
        </div>

        <div class="linha-motorista">
          <div style="flex: 1 1 100%;">
            <label for="foto-caminhao-${pedidoId}">Foto do Caminhão</label>
            <div class="upload-wrapper">
              <input type="file" id="foto-caminhao-${pedidoId}" accept="image/*" required>
            </div>
          </div>
        </div>

        <div id="grupo-ficha-${pedidoId}" style="margin-top: 22px; display: none;">
          <label>Ficha de Integração Assinada</label>
          <div class="upload-wrapper"><input type="file" id="ficha-${pedidoId}" accept="image/*"></div>
        </div>

        <div id="grupo-doc-${pedidoId}" style="margin-top: 22px; display: none;">
          <label>Foto do Documento com Foto</label>
          <div class="upload-wrapper"><input type="file" id="doc-${pedidoId}" accept="image/*"></div>
        </div>

        <div style="margin-top: 22px;">
          <label>Tem ajudante?</label>
          <select id="tem-ajudante-${pedidoId}" data-pedido="${pedidoId}" required>
            <option value="">Selecione</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </div>

        <div id="card-ajudante-container-${pedidoId}" style="margin-top: 20px;"></div>

        <div style="margin-top: 28px;">
          <button onclick="registrarColeta('${pedidoId}', this)" class="botao-iniciar-coleta" style="padding: 10px 20px; font-size: 15px;">
            <i class="fas fa-truck"></i> Iniciar Coleta
          </button>
        </div>
      </div>
    </div>
  `;

  card.appendChild(container);
  aplicarMascaraCPF(container.querySelector(`#cpf-${pedidoId}`));
  aplicarMascaraPlaca(container.querySelector(`#placa-${pedidoId}`));
  container.style.display = 'block';
}

function monitorarUploads() {
  document.body.addEventListener('change', function (e) {
    if (e.target.type === 'file') {
      const wrapper = e.target.closest('.upload-wrapper');
      if (!wrapper) return;

      let checkIcon = wrapper.querySelector('.check-icon');
      if (!checkIcon) {
        checkIcon = document.createElement('i');
        checkIcon.className = 'fa fa-check check-icon';
        checkIcon.style.position = 'absolute';
        checkIcon.style.right = '16px';
        checkIcon.style.top = '50%';
        checkIcon.style.transform = 'translateY(-50%)';
        checkIcon.style.color = '#28a745';
        checkIcon.style.fontSize = '18px';
        wrapper.appendChild(checkIcon);
      }
      checkIcon.style.display = e.target.files.length ? 'block' : 'none';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  carregarPedidosPortaria();
  monitorarUploads();
});
