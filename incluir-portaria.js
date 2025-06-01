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
    if (v.length > 3) {
      v = v.slice(0, 3) + '-' + v.slice(3);
    }
    input.value = v;
  });
}

function formatarDataHora(data) {
  if (!data) return '';
  const d = new Date(data);
  const dia = d.getDate().toString().padStart(2, '0');
  const mes = (d.getMonth() + 1).toString().padStart(2, '0');
  const ano = d.getFullYear();
  const horas = d.getHours().toString().padStart(2, '0');
  const minutos = d.getMinutes().toString().padStart(2, '0');
  return `${dia}/${mes} ${horas}:${minutos}`;
}
function formatarData(data) {
  if (!data) return '';
  const d = new Date(data);
  return d.toLocaleDateString('pt-BR');
}

// Timeline igual ao modelo da imagem
function gerarLinhaTempoStatus(pedido) {
  // Lista de etapas
  const etapas = [
    { chave: 'Aguardando Início da Coleta', nome: 'Aguardando Coleta', data: pedido.data_criacao },
    { chave: 'Coleta Iniciada', nome: 'Coleta Iniciada', data: pedido.data_coleta_iniciada },
    { chave: 'Aguardando Conferência do Peso', nome: 'Conferência do Peso', data: pedido.data_conferencia },
    { chave: 'Em Análise pelo Financeiro', nome: 'Financeiro', data: pedido.data_financeiro },
    { chave: 'Finalizado', nome: 'Finalizado', data: pedido.data_finalizado }
  ];
  // Status atual
  const statusAtual = pedido.status;
  let etapaAtualIdx = etapas.findIndex(e => statusAtual === e.chave);
  if (etapaAtualIdx === -1 && statusAtual === 'Aguardando Início da Coleta') etapaAtualIdx = 0;
  if (etapaAtualIdx === -1 && statusAtual === 'Coleta Iniciada') etapaAtualIdx = 1;
  if (etapaAtualIdx === -1) etapaAtualIdx = 0;

  let html = `
  <div class="timeline-tracking" style="margin: 24px 32px 0 32px;">
    <div style="display: flex; align-items: flex-start; gap:0;">
      ${etapas.map((etapa, idx) => {
        // Cores e ícones das bolinhas
        let bolinhaCor = '#e0e0e0';
        let icone = '';
        if (idx < etapaAtualIdx) { bolinhaCor = '#228b22'; icone = '<i class="fa fa-check" style="color:white;font-size:13px;"></i>'; }
        else if (idx === etapaAtualIdx) { bolinhaCor = '#2563eb'; icone = ''; }
        let linhaCor = idx < etapaAtualIdx ? '#228b22' : '#e0e0e0';

        return `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;position:relative;">
          <div style="display:flex;align-items:center;justify-content:center;">
            <div style="
              width:28px;height:28px;border-radius:50%;background:${bolinhaCor};
              display:flex;align-items:center;justify-content:center;
              border: 2px solid ${idx === etapaAtualIdx ? '#2563eb' : idx < etapaAtualIdx ? '#228b22' : '#d1d1d1'};
              position:relative;z-index:2;">
              ${icone}
              ${idx === etapaAtualIdx ? '<span style="width:12px;height:12px;background:#fff;border-radius:50%;display:block;"></span>' : ''}
            </div>
            ${idx < etapas.length-1
              ? `<div style="height:4px;width:60px;background:${linhaCor};margin-left:-2px;margin-right:-2px;z-index:1;"></div>`
              : ''}
          </div>
          <div style="margin-top:6px;text-align:center;font-size:14px;color:#222;font-weight:${idx===etapaAtualIdx?'bold':'normal'};">${etapa.nome}</div>
          <div style="font-size:12px;color:#686868;margin-top:2px;">${formatarDataHora(etapa.data) || ''}</div>
        </div>
        `;
      }).join('')}
    </div>
  </div>
  `;
  return html;
}

async function verificarCPF(pedidoId, isAjudante = false, indice = '0') {
  const prefix = isAjudante ? `cpf-ajudante-${pedidoId}-${indice}` : `cpf-${pedidoId}`;
  const nomePrefix = isAjudante ? `nome-ajudante-${indice}` : `nome-${pedidoId}`;
  const alertaPrefix = isAjudante ? `status-cadastro-ajudante-${indice}` : `status-cadastro-${pedidoId}`;
  const docId = isAjudante ? `doc-ajudante-${indice}` : `doc-${pedidoId}`;
  const fichaId = isAjudante ? `ficha-ajudante-${indice}` : `ficha-${pedidoId}`;
  const grupoFichaId = isAjudante ? `grupo-ficha-ajudante-${indice}` : `grupo-ficha-${pedidoId}`;
  const grupoDocId = isAjudante ? `grupo-doc-ajudante-${indice}` : `grupo-doc-${pedidoId}`;
  const cardId = isAjudante ? `card-ajudante-${pedidoId}-${indice}` : `bloco-form-${pedidoId}`;

  const cpf = document.getElementById(prefix)?.value.trim();
  const nomeInput = document.getElementById(nomePrefix);
  const alerta = document.getElementById(alertaPrefix);
  const docInput = document.getElementById(docId);
  const fichaInput = document.getElementById(fichaId);
  const grupoFicha = document.getElementById(grupoFichaId);
  const grupoDoc = document.getElementById(grupoDocId);
  const blocoForm = document.getElementById(cardId);

  if (!cpf || !nomeInput || !alerta || !docInput || !fichaInput || !grupoFicha || !grupoDoc || !blocoForm) return;
  blocoForm.style.display = 'block';

  try {
    const res = await fetch(`/api/motoristas/${cpf.replace(/\D/g, '')}`);
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

      let vencido = dados.cadastroVencido === true;

      if (vencido) {
        alerta.className = 'alerta-vencido';
        alerta.style.display = 'block';
        alerta.innerText = '⚠️ Permissão expirada. Reenvie a ficha de integração.';
        grupoFicha.style.display = 'block';
        fichaInput.required = true;
        grupoDoc.style.display = 'none';
        docInput.required = false;
      } else {
        alerta.className = 'alerta-sucesso';
        alerta.style.display = 'block';
        alerta.innerText = '✅ Já cadastrado';
        grupoFicha.style.display = 'none';
        fichaInput.required = false;
        grupoDoc.style.display = 'none';
        docInput.required = false;
      }
    }
  } catch (err) {
    console.error('Erro ao verificar CPF:', err);
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

  pedidos.forEach(pedido => {
    const pedidoId = pedido.pedido_id || pedido.id;
    const status = pedido.status;
    const podeIniciarColeta = status === 'Aguardando Início da Coleta';

    const card = document.createElement('div');
    card.className = 'card';

    // Timeline visual exata do print
    card.innerHTML = gerarLinhaTempoStatus(pedido);

    const dataFormatada = formatarData(pedido.data_coleta || new Date());
    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `
      <div class="info">
        <h3>${pedido.cliente}</h3>
        <p>Data Prevista: ${dataFormatada}</p>
      </div>
      <div class="status-badge status-${podeIniciarColeta ? 'amarelo' : 'verde'}">
        ${podeIniciarColeta ? '<i class="fa fa-truck"></i>' : '<i class="fa fa-check"></i>'}
        ${status}
      </div>
    `;
    card.appendChild(header);

    // Formulário somente se puder iniciar coleta
    if (podeIniciarColeta) {
      const form = document.createElement('div');
      form.className = 'formulario';
      form.style.display = 'block';

      form.innerHTML = `
        <div style="display: flex; align-items: flex-end; gap: 12px;">
          <div style="max-width: 300px; flex: none;">
            <label>CPF do Motorista</label>
            <input type="text" id="cpf-${pedidoId}" data-pedido="${pedidoId}" required placeholder="Digite o CPF">
          </div>
          <div id="status-cadastro-${pedidoId}" style="display: none; flex: 1;"></div>
        </div>
        <div id="bloco-form-${pedidoId}" class="subcard" style="display: none; margin-top: 25px; padding: 20px; background: #eaeaea; border: 1px solid #ccc; border-radius: 10px;">
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
          <label style="margin-top: 12px;">Foto do Caminhão</label>
          <div class="upload-wrapper" style="position: relative;">
            <input type="file" id="foto-caminhao-${pedidoId}" accept="image/*" required>
          </div>
          <div id="grupo-ficha-${pedidoId}" style="margin-top: 12px;">
            <label>Ficha de Integração Assinada (motorista)</label>
            <div class="upload-wrapper" style="position: relative;">
              <input type="file" id="ficha-${pedidoId}" accept="image/*" required>
            </div>
          </div>
          <div id="grupo-doc-${pedidoId}" style="margin-top: 12px;">
            <label>Foto do Documento (motorista)</label>
            <div class="upload-wrapper" style="position: relative;">
              <input type="file" id="doc-${pedidoId}" accept="image/*" required>
            </div>
          </div>
          <label style="margin-top: 12px;">Tem Ajudante?</label>
          <select id="tem-ajudante-${pedidoId}" data-pedido="${pedidoId}" required>
            <option value="">Selecione</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
          <div id="card-ajudante-container-${pedidoId}" style="margin-top: 25px;"></div>
          <button class="btn btn-registrar" style="margin-top: 20px;" onclick="registrarColeta(${pedidoId}, this)">Iniciar Coleta</button>
        </div>
      `;

      header.addEventListener('click', () => {
        form.style.display = form.style.display === 'block' ? 'none' : 'block';
        aplicarMascaraCPF(form.querySelector(`#cpf-${pedidoId}`));
        aplicarMascaraPlaca(form.querySelector(`#placa-${pedidoId}`));
      });

      card.appendChild(form);
    }

    lista.appendChild(card);
  });
}

document.addEventListener('change', function (e) {
  if (e.target.id.startsWith('tem-ajudante-')) {
    const pedidoId = e.target.dataset.pedido;
    const valor = e.target.value;
    const container = document.getElementById(`card-ajudante-container-${pedidoId}`);

    if (valor === 'sim') {
      const index = container.children.length;
      const idSuffix = `${pedidoId}-${index}`;
      const div = document.createElement('div');
      div.className = 'subcard';
      div.id = `card-ajudante-${idSuffix}`;
      div.style = "padding: 20px; background: #eaeaea; border: 1px solid #ccc; border-radius: 10px; margin-bottom: 20px;";

      div.innerHTML = `
        <label style="font-weight: bold; display: block; margin-bottom: 10px;">Ajudante ${index + 1}</label>
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
            <div class="upload-wrapper" style="position: relative;">
              <input type="file" id="ficha-ajudante-${index}" accept="image/*" required>
            </div>
          </div>
          <div id="grupo-doc-ajudante-${index}" style="margin-top: 12px;">
            <label>Foto do Documento (ajudante)</label>
            <div class="upload-wrapper" style="position: relative;">
              <input type="file" id="doc-ajudante-${index}" accept="image/*" required>
            </div>
          </div>
          <label style="margin-top: 12px;">Tem mais um ajudante?</label>
          <select id="tem-ajudante-${pedidoId}" data-pedido="${pedidoId}">
            <option value="">Selecione</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </div>
      `;

      container.appendChild(div);
      const cpfInput = div.querySelector(`#cpf-ajudante-${idSuffix}`);
      aplicarMascaraCPF(cpfInput);
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
    const res = await fetch('/api/motoristas', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error();

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
