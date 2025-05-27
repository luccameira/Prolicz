document.addEventListener('DOMContentLoaded', () => {
  carregarPedidosPortaria();
  monitorarUploads();
});

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

function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR');
}

function diferencaDias(dataInicial, dataFinal) {
  const umDia = 24 * 60 * 60 * 1000;
  return Math.floor((dataFinal - dataInicial) / umDia);
}

async function verificarCPF(pedidoId, isAjudante = false, indice = '0') {
  const prefix = isAjudante ? `cpf-ajudante-${indice}` : `cpf-${pedidoId}`;
  const nomePrefix = isAjudante ? `nome-ajudante-${indice}` : `nome-${pedidoId}`;
  const alertaPrefix = isAjudante ? `status-cadastro-ajudante-${indice}` : `status-cadastro-${pedidoId}`;
  const docId = isAjudante ? `doc-ajudante-${indice}` : `doc-${pedidoId}`;
  const fichaId = isAjudante ? `ficha-ajudante-${indice}` : `ficha-${pedidoId}`;
  const grupoFichaId = isAjudante ? `grupo-ficha-ajudante-${indice}` : `grupo-ficha-${pedidoId}`;
  const grupoDocId = isAjudante ? `grupo-doc-ajudante-${indice}` : `grupo-doc-${pedidoId}`;
  const cardId = isAjudante ? `card-ajudante-${indice}` : `bloco-form-${pedidoId}`;

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

      let vencido = false;
      if (dados.data_permissao) {
        const dataPermissao = new Date(dados.data_permissao);
        const dias = diferencaDias(dataPermissao, new Date());
        vencido = dias > 90;
      }

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

    if (!finalizado) {
      header.addEventListener('click', () => {
        form.style.display = form.style.display === 'block' ? 'none' : 'block';
        const cpfInput = form.querySelector(`#cpf-${pedidoId}`);
        aplicarMascaraCPF(cpfInput);
      });
    }

    card.appendChild(form);
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
      exibirCardAjudante(pedidoId, 0);
    }
  }
});

function exibirCardAjudante(pedidoId, indice) {
  const container = document.getElementById(`card-ajudante-container-${pedidoId}`);
  const novoCard = document.createElement('div');
  novoCard.className = 'subcard';
  novoCard.style.cssText = 'padding: 20px; background: #eaeaea; border: 1px solid #ccc; border-radius: 10px; margin-top: 20px;';
  novoCard.id = `card-ajudante-${indice}`;

  novoCard.innerHTML = `
    <div style="display: flex; align-items: flex-end; gap: 12px;">
      <div style="max-width: 300px; flex: none;">
        <label>CPF do Ajudante</label>
        <input type="text" id="cpf-ajudante-${indice}" data-pedido="${pedidoId}" data-index="${indice}" placeholder="Digite o CPF do ajudante" required>
      </div>
      <div id="status-cadastro-ajudante-${indice}" style="display: none; flex: 1;"></div>
    </div>

    <div style="margin-top: 20px;">
      <label>Nome do Ajudante</label>
      <input type="text" id="nome-ajudante-${indice}" placeholder="Nome completo do ajudante" required>

      <div id="grupo-ficha-ajudante-${indice}" style="margin-top: 12px;">
        <label>Ficha de Integração Assinada (ajudante)</label>
        <div class="upload-wrapper" style="position: relative;">
          <input type="file" id="ficha-ajudante-${indice}" accept="image/*" required>
        </div>
      </div>

      <div id="grupo-doc-ajudante-${indice}" style="margin-top: 12px;">
        <label>Foto do Documento (ajudante)</label>
        <div class="upload-wrapper" style="position: relative;">
          <input type="file" id="doc-ajudante-${indice}" accept="image/*" required>
        </div>
      </div>
    </div>

    <div class="mais-ajudante" style="margin-top: 20px;">
      <label>Tem mais um ajudante?</label>
      <select id="tem-mais-ajudante-${indice}" data-pedido="${pedidoId}" data-indice="${indice}" required>
        <option value="">Selecione</option>
        <option value="sim">Sim</option>
        <option value="nao">Não</option>
      </select>
    </div>
  `;

  container.appendChild(novoCard);

  aplicarMascaraCPF(novoCard.querySelector(`#cpf-ajudante-${indice}`));

  const dropdownMais = novoCard.querySelector(`#tem-mais-ajudante-${indice}`);
  dropdownMais.addEventListener('change', e => {
    const valor = e.target.value;
    const proximoIndice = parseInt(indice) + 1;

    if (valor === 'sim') {
      exibirCardAjudante(pedidoId, proximoIndice);
    } else if (valor === 'nao') {
      // Remove todos os ajudantes após este índice
      let atual = proximoIndice;
      while (document.getElementById(`card-ajudante-${atual}`)) {
        document.getElementById(`card-ajudante-${atual}`).remove();
        atual++;
      }
    }
  });
}

async function registrarColeta(pedidoId, botao) {
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

  if (!confirm('Tem certeza que deseja iniciar a coleta?')) return;

  botao.disabled = true;
  botao.innerText = 'Enviando...';

  const formData = new FormData();
  formData.append('cpf', cpf);
  formData.append('placa', placa);
  formData.append('foto_caminhao', caminhaoInput.files[0]);
  if (nome) formData.append('nome', nome);
  if (fichaInput?.files.length) formData.append('ficha_integracao', fichaInput.files[0]);
  if (docInput?.files.length) formData.append('documento', docInput.files[0]);

  const container = document.getElementById(`card-ajudante-container-${pedidoId}`);
  const ajudantes = container.querySelectorAll('[id^="card-ajudante-"]');
  ajudantes.forEach((card, i) => {
    const cpfAj = card.querySelector(`#cpf-ajudante-${i}`)?.value.trim();
    const nomeAj = card.querySelector(`#nome-ajudante-${i}`)?.value.trim();
    const fichaAj = card.querySelector(`#ficha-ajudante-${i}`)?.files[0];
    const docAj = card.querySelector(`#doc-ajudante-${i}`)?.files[0];
    if (cpfAj && nomeAj) {
      formData.append(`cpf_ajudante_${i}`, cpfAj);
      formData.append(`nome_ajudante_${i}`, nomeAj);
      if (fichaAj) formData.append(`ficha_ajudante_${i}`, fichaAj);
      if (docAj) formData.append(`documento_ajudante_${i}`, docAj);
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
      body: JSON.stringify({ placa, motorista: nome, ajudante: '' })
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
