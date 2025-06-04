document.addEventListener('DOMContentLoaded', () => {
  carregarPedidosPortaria();
  monitorarUploads();
});

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
    statusDiv.style.display = 'block';

    if (!isAjudante) {
      const nomeInput = document.getElementById(`nome-${pedidoId}`);
      nomeInput.value = data.nome || '';
      nomeInput.readOnly = !!data.encontrado;
      document.getElementById(`placa-${pedidoId}`).value = data.placa || '';

      // Aqui o card será exibido APÓS verificação
      document.getElementById(`bloco-form-${pedidoId}`).style.display = 'block';

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
    statusDiv.style.display = 'block';
  }
}

async function carregarPedidosPortaria() {
  const hoje = new Date().toISOString().split('T')[0];
  const res = await fetch(`/api/pedidos/portaria?data=${hoje}`);
  let pedidos = await res.json();

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
    const podeIniciarColeta = status === 'Aguardando Início da Coleta';

    const card = document.createElement('div');
    card.className = 'card';

    const header = document.createElement('div');
    header.className = 'header-card';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'flex-start';
    header.style.padding = '18px 22px 0 22px';

    const info = document.createElement('div');
    info.innerHTML = `
      <div style="font-weight: bold; font-size: 19px; margin-bottom:2px;">${pedido.cliente}</div>
      <div style="font-size: 15px; color: #888;">Data Prevista: ${formatarData(pedido.data_coleta)}</div>
    `;

    const btnStatus = document.createElement('div');
    let corStatus, corTexto, textoStatus;

    if (status === 'Coleta Iniciada') {
      corStatus = '#28a745';
      corTexto = '#fff';
      textoStatus = 'Coleta Iniciada';
    } else if (status === 'Aguardando Início da Coleta') {
      corStatus = '#ffc107';
      corTexto = '#222';
      textoStatus = 'Aguardando Início da Coleta';
    }

    if (textoStatus) {
      btnStatus.innerHTML = `
        <div style="background:${corStatus};color:${corTexto};padding:4px 14px;font-weight:600;border-radius:6px;font-size:14px;display:flex;align-items:center;gap:8px;">
          <i class="fa fa-truck"></i> ${textoStatus}
        </div>
      `;
    }

    header.appendChild(info);
    if (textoStatus) header.appendChild(btnStatus);
    card.appendChild(header);

    card.innerHTML += gerarLinhaTempoCompleta(pedido);

    if (podeIniciarColeta) {
      const bloco = document.createElement('div');
      bloco.id = `bloco-form-${pedidoId}`;
      bloco.style = "padding: 20px 22px 22px; margin-top: 10px; border-top: 1px solid #eee; display: none;";

      bloco.innerHTML = `
        <div style="margin-bottom: 12px;">
          <label>CPF do Motorista</label>
          <input type="text" id="cpf-${pedidoId}" data-pedido="${pedidoId}" required>
          <div id="status-cadastro-${pedidoId}" style="margin-top: 6px;"></div>
        </div>
        <div>
          <label>Nome do Motorista</label>
          <input type="text" id="nome-${pedidoId}" required>
        </div>
        <div style="margin-top: 12px;">
          <label>Placa do Veículo</label>
          <input type="text" id="placa-${pedidoId}" required>
        </div>
        <div id="grupo-ficha-${pedidoId}" style="margin-top: 12px;">
          <label>Ficha de Integração Assinada</label>
          <div class="upload-wrapper"><input type="file" id="ficha-${pedidoId}" accept="image/*" required></div>
        </div>
        <div id="grupo-doc-${pedidoId}" style="margin-top: 12px;">
          <label>Foto do Documento (CNH)</label>
          <div class="upload-wrapper"><input type="file" id="doc-${pedidoId}" accept="image/*" required></div>
        </div>
        <div style="margin-top: 12px;">
          <label>Foto do Caminhão</label>
          <div class="upload-wrapper"><input type="file" id="foto-caminhao-${pedidoId}" accept="image/*" required></div>
        </div>
        <div style="margin-top: 20px;">
          <label>Tem Ajudante?</label>
          <select id="tem-ajudante-${pedidoId}" data-pedido="${pedidoId}">
            <option value="">Selecione</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </div>
        <div id="card-ajudante-container-${pedidoId}" style="margin-top: 16px;"></div>
        <div style="text-align: right; margin-top: 20px;">
          <button onclick="registrarColeta('${pedidoId}', this)" class="btn-amarelo">Iniciar Coleta</button>
        </div>
      `;

      card.appendChild(bloco);
      aplicarMascaraCPF(bloco.querySelector(`#cpf-${pedidoId}`));
      aplicarMascaraPlaca(bloco.querySelector(`#placa-${pedidoId}`));
    }

    setTimeout(() => {
      const timeline = card.querySelector('.timeline-simples');
      if (timeline) animarLinhaProgresso(timeline);
    }, 20);

    lista.appendChild(card);
  });
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

