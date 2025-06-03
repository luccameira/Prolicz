function renderizarPedidos(lista) {
  const listaEl = document.getElementById('lista-pedidos');
  const filtro = document.getElementById('filtro-cliente').value.toLowerCase();
  const ordenar = document.getElementById('ordenar').value;

  let pedidosFiltrados = lista.filter(p => (p.cliente || '').toLowerCase().includes(filtro));

  if (ordenar === 'cliente') {
    pedidosFiltrados.sort((a, b) => a.cliente.localeCompare(b.cliente));
  } else {
    pedidosFiltrados.sort((a, b) => new Date(a.data_coleta) - new Date(b.data_coleta));
  }

  listaEl.innerHTML = '';

  pedidosFiltrados.forEach(p => {
    const div = document.createElement('div');
    div.className = 'card';

    // 1. Header - título e subtítulo
    const dataFormatada = new Date(p.data_coleta).toLocaleDateString('pt-BR');
    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `
      <div class="info">
        <h3 style="font-size:19px; margin-bottom:2px;">${p.cliente}</h3>
        <p style="font-size:15px; color:#888;">Data Prevista: ${dataFormatada}</p>
      </div>
    `;
    div.appendChild(header);

    // 2. Linha do tempo padronizada
    // Adiciona a timeline DEPOIS do header
    div.innerHTML += gerarLinhaTempoCompleta(p);
    setTimeout(() => {
      const timeline = div.querySelector('.timeline-simples');
      if (timeline) animarLinhaProgresso(timeline);
    }, 20);

    // 3. Status visual (badge de status, igual antes)
    const statusHtml =
      p.status === 'Aguardando Conferência do Peso'
        ? `<div class="status-badge status-verde"><i class="fa fa-check"></i> Peso Registrado</div>`
        : p.status === 'Coleta Iniciada'
        ? `<div class="status-badge status-amarelo"><i class="fa fa-truck"></i> ${p.status}</div>`
        : `<div class="status-badge status-cinza"><i class="fa fa-clock"></i> ${p.status}</div>`;

    const statusDiv = document.createElement('div');
    statusDiv.innerHTML = statusHtml;
    statusDiv.style.textAlign = 'right';
    div.appendChild(statusDiv);

    // 4. Exibe formulário SOMENTE se status === 'Coleta Iniciada'
    if (p.status === 'Coleta Iniciada') {
      const form = document.createElement('div');
      form.className = 'formulario';
      form.id = `form-${p.id || p.pedido_id}`;

      if (Array.isArray(p.materiais) && p.materiais.length > 0) {
        p.materiais.forEach((item, index) => {
          const itemId = item.id;
          if (!descontosPorItem[itemId]) descontosPorItem[itemId] = [];

          const textoPeso = item.tipo_peso === 'Aproximado' ? 'Peso Aproximado' : 'Peso Exato';
          const icone = item.tipo_peso === 'Exato' ? '<i class="fa fa-check check-exato"></i>' : '';

          form.innerHTML += `
            <div class="material-bloco" data-item-id="${itemId}">
              <h4>${item.nome_produto}</h4>
              <p>
                <strong>${textoPeso}:</strong> ${formatarPeso(item.quantidade)} ${item.unidade || 'kg'}
                ${icone}
              </p>
              <div class="linha-peso">
                <label for="peso-${p.id || p.pedido_id}-${index}">Peso Carregado (kg):</label>
                <input type="number" id="peso-${p.id || p.pedido_id}-${index}" class="input-sem-seta" placeholder="Insira o peso carregado aqui" min="0">
              </div>
              <div class="grupo-descontos" id="grupo-descontos-${itemId}"></div>
              <button type="button" class="btn btn-desconto" onclick="adicionarDescontoMaterial(${itemId})">Adicionar Desconto</button>
            </div>
          `;
        });

        form.innerHTML += `
          <div class="upload-ticket">
            <label for="ticket-${p.id || p.pedido_id}">Foto do Ticket da Balança:</label>
            <input type="file" id="ticket-${p.id || p.pedido_id}" accept="image/*">
          </div>
          <button class="btn btn-registrar" onclick="registrarPeso(${p.id || p.pedido_id})">Registrar Peso</button>
        `;
      } else {
        form.innerHTML = `<p style="padding: 15px; color: #555;">Este pedido ainda não possui materiais vinculados para registro de peso.</p>`;
      }

      form.style.display = 'none';
      header.addEventListener('click', () => {
        form.style.display = form.style.display === 'block' ? 'none' : 'block';
      });

      div.appendChild(form);
    }

    listaEl.appendChild(div);
  });
}

// ====== Desconto Material ======
function adicionarDescontoMaterial(itemId) {
  const container = document.getElementById(`grupo-descontos-${itemId}`);
  const existentes = descontosPorItem[itemId].map(d => d.motivo);
  if (existentes.length >= 3) return alert("Limite de 3 tipos de desconto atingido.");

  const index = container.querySelectorAll('.grupo-desconto').length;
  const idMotivo = `motivo-${itemId}-${index}`;
  const idQtd = `quantidade-${itemId}-${index}`;
  const idLabel = `label-${itemId}-${index}`;
  const idLinha = `linha-${itemId}-${index}`;

  const div = document.createElement('div');
  div.className = 'grupo-desconto';
  div.id = `grupo-desconto-${itemId}-${index}`;
  div.innerHTML = `
    <button class="fechar-desconto" onclick="removerDescontoMaterial(${itemId}, ${index})">&times;</button>
    <div class="linha-desconto" id="${idLinha}">
      <div class="coluna-motivo">
        <label for="${idMotivo}">Motivo do Desconto:</label>
        <select id="${idMotivo}" onchange="atualizarDescontoItem(${itemId}, ${index})">
          <option value="">Selecione</option>
          <option value="Palete Pequeno">Palete Pequeno</option>
          <option value="Palete Grande">Palete Grande</option>
          <option value="Devolução de Material">Devolução de Material</option>
        </select>
      </div>
      <div class="coluna-desconto" style="display:none;">
        <label id="${idLabel}" for="${idQtd}">Quantidade</label>
        <div class="desconto-container">
          <input type="number" id="${idQtd}" placeholder="" oninput="atualizarDescontoItem(${itemId}, ${index})" min="0" class="input-sem-seta">
          <span class="sufixo-unidade">-</span>
        </div>
      </div>
    </div>
  `;
  container.appendChild(div);
}

function removerDescontoMaterial(itemId, index) {
  const div = document.getElementById(`grupo-desconto-${itemId}-${index}`);
  if (div) div.remove();
  if (descontosPorItem[itemId]) {
    descontosPorItem[itemId] = descontosPorItem[itemId].filter((_, i) => i !== index);
  }
}

function atualizarDescontoItem(itemId, index) {
  const select = document.getElementById(`motivo-${itemId}-${index}`);
  const input = document.getElementById(`quantidade-${itemId}-${index}`);
  const label = document.getElementById(`label-${itemId}-${index}`);
  const coluna = input.closest('.coluna-desconto');
  const sufixo = coluna.querySelector('.sufixo-unidade');

  const motivo = select.value;
  if (!motivo) return (coluna.style.display = 'none');

  coluna.style.display = 'block';

  let unidade = 'kg';
  let labelTexto = 'Peso (kg)';
  let pesoPorUnidade = 1;

  if (motivo === 'Palete Pequeno') {
    unidade = 'unidade';
    labelTexto = 'Qtd. Paletes Pequenos';
    pesoPorUnidade = 6;
  } else if (motivo === 'Palete Grande') {
    unidade = 'unidade';
    labelTexto = 'Qtd. Paletes Grandes';
    pesoPorUnidade = 14.37;
  } else {
    pesoPorUnidade = 1;
  }

  label.textContent = labelTexto;
  sufixo.textContent = unidade;

  const qtd = parseFloat(input.value);
  const pesoCalculado = motivo.includes('Palete') && !isNaN(qtd) ? qtd * pesoPorUnidade : qtd;

  descontosPorItem[itemId][index] = {
    motivo,
    quantidade: qtd || 0,
    peso_calculado: isNaN(pesoCalculado) ? 0 : pesoCalculado
  };
}

async function registrarPeso(pedidoId) {
  const pedido = pedidos.find(p => (p.id || p.pedido_id) === pedidoId);
  if (!pedido) return alert("Pedido não encontrado.");

  const form = document.getElementById(`form-${pedidoId}`);
  if (!form) return alert("Formulário não encontrado.");

  const itens = [];
  const blocos = form.querySelectorAll('.material-bloco');

  blocos.forEach((bloco, index) => {
    const itemId = parseInt(bloco.getAttribute('data-item-id'));
    const input = bloco.querySelector('input[type="number"]');
    const peso = parseFloat(input.value);

    if (!isNaN(peso)) {
      itens.push({
        item_id: itemId,
        peso_carregado: peso,
        descontos: (descontosPorItem[itemId] || []).filter(d => d.motivo && d.peso_calculado > 0)
      });
    }
  });

  if (!itens.length) return alert("Informe ao menos um peso carregado.");

  const ticketFile = document.getElementById(`ticket-${pedidoId}`)?.files[0];
  if (!ticketFile) return alert("Por favor, selecione a foto do ticket da balança.");

  const formData = new FormData();
  formData.append('itens', JSON.stringify(itens));
  formData.append('ticket_balanca', ticketFile);

  try {
    const res = await fetch(`/api/pedidos/${pedidoId}/carga`, {
      method: 'PUT',
      body: formData
    });

    const data = await res.json();

    if (res.ok) {
      alert('Peso registrado com sucesso!');
      carregarPedidos();
    } else {
      alert(data.erro || 'Erro ao registrar peso.');
    }
  } catch (error) {
    console.error('Erro ao registrar peso:', error);
    alert('Erro de conexão ao registrar peso.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  carregarPedidos();
  document.getElementById('filtro-cliente').addEventListener('input', () => carregarPedidos());
  document.getElementById('ordenar').addEventListener('change', () => carregarPedidos());
});


