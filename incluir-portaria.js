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
  const dt = new Date(data);
  if (isNaN(dt)) return '—';
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
}

function formatarDataTimeline(data) {
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

function gerarLinhaTempoCompleta(pedido) {
  const etapas = [
    { key: 'Aguardando Início da Coleta', nome: 'Aguardando Coleta', campoData: 'data_criacao' },
    { key: 'Coleta Iniciada', nome: 'Coleta Iniciada', campoData: 'data_coleta_iniciada' },
    { key: 'Coleta Finalizada', nome: 'Coleta Finalizada', campoData: 'data_coleta_finalizada' },
    { key: 'Aguardando Conferência do Peso', nome: 'Conferência do Peso', campoData: 'data_conferencia_peso' },
    { key: 'Em Análise pelo Financeiro', nome: 'Financeiro', campoData: 'data_financeiro' },
    { key: 'Aguardando Emissão de NF', nome: 'Emissão de Nota Fiscal', campoData: 'data_emissao_nf' },
    { key: 'Finalizado', nome: 'Finalizado', campoData: 'data_finalizado' }
  ];

  let idxAtivo = etapas.findIndex(et => et.key === pedido.status);
  if (pedido.status === 'Aguardando Início da Coleta') idxAtivo = 1;

  let html = `<div class="timeline-simples"><div class="timeline-bar-bg"></div><div class="timeline-bar-fg"></div>`;
  etapas.forEach((etapa, idx) => {
    const isConcluded = idx < idxAtivo;
    const isActive = idx === idxAtivo;
    let statusClass = isConcluded ? 'done' : isActive ? 'active' : '';
    html += `
      <div class="timeline-step ${statusClass}">
        <div class="dot">${isConcluded ? '<span style="font-size:20px;">&#10003;</span>' : ''}</div>
        <div class="label">${etapa.nome}</div>
        <div class="data">${formatarDataTimeline(pedido[etapa.campoData])}</div>
      </div>`;
  });
  html += `</div>`;
  return html;
}

function animarLinhaProgresso(container) {
  const steps = container.querySelectorAll('.timeline-step');
  const fg = container.querySelector('.timeline-bar-fg');
  const bg = container.querySelector('.timeline-bar-bg');
  let ultimoFeito = -1;

  steps.forEach((step, idx) => {
    if (step.classList.contains('done') || step.classList.contains('active')) ultimoFeito = idx;
  });

  if (steps.length > 1 && fg && bg) {
    const firstDot = steps[0].querySelector('.dot').getBoundingClientRect();
    const lastDot = steps[steps.length - 1].querySelector('.dot').getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const start = (firstDot.left + firstDot.width / 2) - containerRect.left;
    const end = (lastDot.left + lastDot.width / 2) - containerRect.left;
    bg.style.left = `${start}px`;
    bg.style.width = `${end - start}px`;

    if (ultimoFeito > 0) {
      const doneDot = steps[ultimoFeito].querySelector('.dot').getBoundingClientRect();
      const done = (doneDot.left + doneDot.width / 2) - containerRect.left;
      fg.style.left = `${start}px`;
      fg.style.width = `${done - start}px`;
    } else {
      fg.style.width = '0';
    }
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
    let corStatus = '#ffc107', corTexto = '#222', textoStatus = 'Aguardando Início da Coleta';
    if (status === 'Coleta Iniciada') {
      corStatus = '#28a745'; corTexto = '#fff'; textoStatus = 'Coleta Iniciada';
    }

    btnStatus.innerHTML = `
      <div style="background:${corStatus};color:${corTexto};padding:4px 14px;font-weight:600;border-radius:6px;font-size:14px;display:flex;align-items:center;gap:8px;">
        <i class="fa fa-truck"></i> ${textoStatus}
      </div>`;

    header.appendChild(info);
    header.appendChild(btnStatus);
    card.appendChild(header);

    const linhaTempo = document.createElement('div');
    linhaTempo.innerHTML = gerarLinhaTempoCompleta(pedido);
    card.appendChild(linhaTempo);
    setTimeout(() => {
      const timelineEl = linhaTempo.querySelector('.timeline-simples');
      if (timelineEl) animarLinhaProgresso(timelineEl);
    }, 20);

    lista.appendChild(card);
  });
}

async function verificarCPF(pedidoId, isAjudante = false, index = '0') {
  const prefix = isAjudante ? `cpf-ajudante-${pedidoId}-${index}` : `cpf-${pedidoId}`;
  const nomePrefix = isAjudante ? `nome-ajudante-${index}` : `nome-${pedidoId}`;
  const alertaPrefix = isAjudante ? `status-cadastro-ajudante-${index}` : `status-cadastro-${pedidoId}`;
  const docId = isAjudante ? `doc-ajudante-${index}` : `doc-${pedidoId}`;
  const fichaId = isAjudante ? `ficha-ajudante-${index}` : `ficha-${pedidoId}`;
  const grupoFichaId = isAjudante ? `grupo-ficha-ajudante-${index}` : `grupo-ficha-${pedidoId}`;
  const grupoDocId = isAjudante ? `grupo-doc-ajudante-${index}` : `grupo-doc-${pedidoId}`;
  const blocoFormId = isAjudante ? `card-ajudante-${pedidoId}-${index}` : `bloco-form-${pedidoId}`;

  const cpf = document.getElementById(prefix)?.value?.replace(/\D/g, '');
  const nomeInput = document.getElementById(nomePrefix);
  const alerta = document.getElementById(alertaPrefix);
  const docInput = document.getElementById(docId);
  const fichaInput = document.getElementById(fichaId);
  const grupoFicha = document.getElementById(grupoFichaId);
  const grupoDoc = document.getElementById(grupoDocId);
  const blocoForm = document.getElementById(blocoFormId);

  if (!cpf || !nomeInput || !alerta || !docInput || !fichaInput || !grupoFicha || !grupoDoc || !blocoForm) return;
  blocoForm.style.display = 'block';

  try {
    const res = await fetch(`/api/motoristas/${cpf}`);
    grupoFicha.style.display = 'block';
    grupoDoc.style.display = 'block';
    fichaInput.required = true;
    docInput.required = true;

    if (res.status === 404) {
      alerta.className = 'alerta-vencido';
      alerta.style.display = 'block';
      alerta.innerText = '🚫 Não possui cadastro.';
      nomeInput.disabled = false;
      nomeInput.value = '';
    } else {
      const dados = await res.json();
      nomeInput.value = dados.nome;
      nomeInput.disabled = true;

      if (dados.cadastroVencido) {
        alerta.className = 'alerta-vencido';
        alerta.style.display = 'block';
        alerta.innerText = '⚠️ Cadastro vencido. Reenvie a ficha de integração.';
        grupoFicha.style.display = 'block';
        grupoDoc.style.display = 'none';
        docInput.required = false;
      } else {
        alerta.className = 'alerta-sucesso';
        alerta.style.display = 'block';
        alerta.innerText = '✅ Já cadastrado.';
        grupoFicha.style.display = 'none';
        grupoDoc.style.display = 'none';
        fichaInput.required = false;
        docInput.required = false;
      }
    }
  } catch (err) {
    console.error('Erro ao verificar CPF:', err);
  }
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
            <div class="upload-wrapper"><input type="file" id="ficha-ajudante-${index}" accept="image/*" required></div>
          </div>
          <div id="grupo-doc-ajudante-${index}" style="margin-top: 12px;">
            <label>Foto do Documento (ajudante)</label>
            <div class="upload-wrapper"><input type="file" id="doc-ajudante-${index}" accept="image/*" required></div>
          </div>
        </div>`;
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
