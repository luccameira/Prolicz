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
  const d = new Date(data);
  if (isNaN(d)) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function gerarLinhaTempoCompleta(pedido) {
  const status = pedido.status;
  const etapas = [
    "Aguardando Coleta",
    "Coleta Iniciada",
    "Coleta Finalizada",
    "Conferência do Peso",
    "Financeiro",
    "Emissão de Nota Fiscal",
    "Finalizado"
  ];
  const indexAtual = etapas.indexOf(status);

  let linha = `<div class="timeline-prolicz"><div class="timeline-prolicz-track"></div>`;
  etapas.forEach((etapa, i) => {
    const statusClasse = i < indexAtual ? 'verde' : i === indexAtual ? 'atual' : '';
    linha += `
      <div class="timeline-prolicz-step ${statusClasse}">
        <div class="circle"></div>
        <div class="step-title">${etapa}</div>
      </div>
    `;
  });
  linha += `</div>`;
  return linha;
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
    if (a.status === 'Finalizado') return 1;
    if (b.status === 'Finalizado') return -1;
    return 0;
  });

  pedidos.forEach(pedido => {
    const pedidoId = pedido.pedido_id || pedido.id;
    const status = pedido.status;
    const podeIniciar = status === 'Aguardando Início da Coleta';

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
    } else {
      corStatus = '#ffc107';
      corTexto = '#222';
      textoStatus = 'Aguardando Início da Coleta';
    }

    btnStatus.innerHTML = `
      <div style="background:${corStatus};color:${corTexto};padding:4px 14px;font-weight:600;border-radius:6px;font-size:14px;display:flex;align-items:center;gap:8px;">
        <i class="fa fa-truck"></i> ${textoStatus}
      </div>
    `;

    header.appendChild(info);
    header.appendChild(btnStatus);
    card.appendChild(header);

    card.innerHTML += gerarLinhaTempoCompleta(pedido);

    if (podeIniciar) {
      const form = document.createElement('div');
      form.className = 'formulario';
      form.style = 'padding: 20px 22px 22px; border-top: 1px solid #eee;';

      form.innerHTML = `
        <div style="margin-bottom: 12px;">
          <label>CPF do Motorista</label>
          <input type="text" id="cpf-${pedidoId}" data-pedido="${pedidoId}" required>
          <div id="status-cadastro-${pedidoId}" style="margin-top: 6px;"></div>
        </div>
        <div id="bloco-form-${pedidoId}" style="display:none;">
          <div style="display:flex;gap:20px;">
            <div style="flex:1;">
              <label>Nome do Motorista</label>
              <input type="text" id="nome-${pedidoId}" required>
            </div>
            <div style="flex:1;">
              <label>Placa do Veículo</label>
              <input type="text" id="placa-${pedidoId}" required>
            </div>
          </div>
          <label style="margin-top:12px;">Foto do Caminhão</label>
          <div class="upload-wrapper"><input type="file" id="foto-caminhao-${pedidoId}" accept="image/*" required></div>
          <div id="grupo-ficha-${pedidoId}" style="margin-top:12px;">
            <label>Ficha de Integração Assinada</label>
            <div class="upload-wrapper"><input type="file" id="ficha-${pedidoId}" accept="image/*" required></div>
          </div>
          <div id="grupo-doc-${pedidoId}" style="margin-top:12px;">
            <label>Foto do Documento (CNH)</label>
            <div class="upload-wrapper"><input type="file" id="doc-${pedidoId}" accept="image/*" required></div>
          </div>
          <label style="margin-top:12px;">Tem Ajudante?</label>
          <select id="tem-ajudante-${pedidoId}" data-pedido="${pedidoId}">
            <option value="">Selecione</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
          <div id="card-ajudante-container-${pedidoId}" style="margin-top: 20px;"></div>
          <div style="text-align: right; margin-top: 20px;">
            <button onclick="registrarColeta('${pedidoId}', this)" class="btn-amarelo">Iniciar Coleta</button>
          </div>
        </div>
      `;

      card.appendChild(form);
      aplicarMascaraCPF(form.querySelector(`#cpf-${pedidoId}`));
      aplicarMascaraPlaca(form.querySelector(`#placa-${pedidoId}`));
    }

    lista.appendChild(card);
  });
}

document.addEventListener('change', function (e) {
  if (e.target.id.startsWith('tem-ajudante-')) {
    const pedidoId = e.target.dataset.pedido;
    const valor = e.target.value;
    const container = document.getElementById(`card-ajudante-container-${pedidoId}`);

    container.innerHTML = '';
    if (valor === 'sim') {
      const index = 0;
      const idSuffix = `${pedidoId}-${index}`;
      const div = document.createElement('div');
      div.className = 'subcard';
      div.id = `card-ajudante-${idSuffix}`;
      div.style = "padding: 20px; background: #f9f9f9; border: 1px solid #ccc; border-radius: 10px; margin-bottom: 20px;";

      div.innerHTML = `
        <label style="font-weight: bold; display: block; margin-bottom: 10px;">Ajudante</label>
        <div style="display: flex; align-items: flex-end; gap: 12px;">
          <div style="max-width: 300px; flex: none;">
            <label>CPF do Ajudante</label>
            <input type="text" id="cpf-ajudante-${idSuffix}" data-pedido="${pedidoId}" data-index="${index}" required placeholder="Digite o CPF do ajudante">
          </div>
          <div id="status-cadastro-ajudante-${index}" style="display: none; flex: 1;"></div>
        </div>
        <div style="margin-top: 20px;">
          <label>Nome do Ajudante</label>
          <input type="text" id="nome-ajudante-${index}" placeholder="Nome completo do ajudante" required>

          <div id="grupo-ficha-ajudante-${index}" style="margin-top: 12px;">
            <label>Ficha de Integração Assinada (ajudante)</label>
            <div class="upload-wrapper">
              <input type="file" id="ficha-ajudante-${index}" accept="image/*" required>
            </div>
          </div>

          <div id="grupo-doc-ajudante-${index}" style="margin-top: 12px;">
            <label>Foto do Documento (ajudante)</label>
            <div class="upload-wrapper">
              <input type="file" id="doc-ajudante-${index}" accept="image/*" required>
            </div>
          </div>
        </div>
      `;

      container.appendChild(div);
      aplicarMascaraCPF(div.querySelector(`#cpf-ajudante-${idSuffix}`));
    }
  }
});

async function registrarColeta(pedidoId, botao) {
  const confirmar = confirm("Tem certeza que deseja iniciar a coleta?");
  if (!confirmar) return;

  const cpf = document.getElementById(`cpf-${pedidoId}`)?.value.trim();
  const nome = document.getElementById(`nome-${pedidoId}`)?.value.trim();
  const placa = document.getElementById(`placa-${pedidoId}`)?.value.trim();
  const caminhaoInput = document.getElementById(`foto-caminhao-${pedidoId}`);
  const fichaInput = document.getElementById(`ficha-${pedidoId}`);
  const docInput = document.getElementById(`doc-${pedidoId}`);

  if (!cpf || !placa || !caminhaoInput.files.length) {
    alert('Preencha todos os campos obrigatórios.');
    return;
  }

  botao.disabled = true;
  botao.innerText = 'Enviando...';

  const formData = new FormData();
  formData.append('cpf', cpf);
  formData.append('placa', placa);
  if (nome) formData.append('nome', nome);
  if (fichaInput?.files.length) formData.append('ficha_integracao', fichaInput.files[0]);
  if (docInput?.files.length) formData.append('foto_documento', docInput.files[0]);
  formData.append('foto_caminhao', caminhaoInput.files[0]);

  const ajudantes = Array.from(document.querySelectorAll(`[id^="card-ajudante-${pedidoId}-"]`));
  const nomeAjudante = [];

  ajudantes.forEach((card, index) => {
    const cpfAj = card.querySelector(`#cpf-ajudante-${pedidoId}-${index}`)?.value;
    const nomeAj = card.querySelector(`#nome-ajudante-${index}`)?.value;
    const fichaAj = card.querySelector(`#ficha-ajudante-${index}`)?.files?.[0];
    const docAj = card.querySelector(`#doc-ajudante-${index}`)?.files?.[0];

    if (cpfAj && nomeAj) {
      formData.append('cpf_ajudante', cpfAj);
      formData.append('nome_ajudante', nomeAj);
      if (fichaAj) formData.append('ficha_ajudante', fichaAj);
      if (docAj) formData.append('documento_ajudante', docAj);
      nomeAjudante.push(nomeAj);
    }
  });

  try {
    await fetch('/api/motoristas', { method: 'POST', body: formData });
    await fetch(`/api/pedidos/${pedidoId}/coleta`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placa, motorista: nome, ajudante: nomeAjudante.join(', ') })
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
        checkIcon.style.right = '12px';
        checkIcon.style.top = '50%';
        checkIcon.style.transform = 'translateY(-50%)';
        checkIcon.style.color = '#28a745';
        checkIcon.style.fontSize = '16px';
        wrapper.appendChild(checkIcon);
      }

      checkIcon.style.display = e.target.files.length ? 'block' : 'none';
    }
  });
}

