function formatarPeso(valor) {
  if (typeof valor !== 'number') valor = parseFloat(valor);
  if (isNaN(valor)) return '0';
  return Math.round(valor).toLocaleString('pt-BR');
}

function aplicarMascaraMilhar(input) {
  input.addEventListener('input', () => {
    let valor = input.value.replace(/\D/g, '');
    valor = valor.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    input.value = valor;
  });
}

let pedidos = [];
let descontosPorItem = {};
let tarefasAbertas = {}; // controle de visibilidade por ID

async function carregarPedidos() {
  const res = await fetch('/api/pedidos/carga');
  const listaPedidos = await res.json();
  pedidos = listaPedidos;
  renderizarPedidos(listaPedidos);
}

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

  const naoFinalizados = pedidosFiltrados.filter(p => p.status !== 'Aguardando Conferência do Peso');
  const finalizados = pedidosFiltrados.filter(p => p.status === 'Aguardando Conferência do Peso');
  const pedidosOrdenados = [...naoFinalizados, ...finalizados];

  listaEl.innerHTML = '';

  pedidosOrdenados.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card';

    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `
      <div class="info">
        <h3 style="font-size: 19px; margin-bottom: 2px;">${p.cliente}</h3>
        <p style="font-size: 15px; color: #888;">Data Prevista: ${new Date(p.data_coleta).toLocaleDateString('pt-BR')}</p>
      </div>
      <div class="status-box">
        ${gerarBadgeStatus(p.status)}
      </div>
    `;
    header.addEventListener('click', (e) => {
      e.stopPropagation();
      tarefasAbertas[p.id] = !tarefasAbertas[p.id];
      renderizarPedidos(pedidos);
    });

    card.appendChild(header);

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = gerarLinhaTempoCompleta(p);
    const timeline = tempDiv.firstElementChild;
    card.appendChild(timeline);
    setTimeout(() => {
      if (timeline) animarLinhaProgresso(timeline);
    }, 10);

      const podeExecutar = p.status === 'Coleta Iniciada';

    const form = document.createElement('div');
    form.className = 'formulario';
    form.id = `form-${p.id}`;
    form.style.display = tarefasAbertas[p.id] && podeExecutar ? 'block' : 'none';

    const materiais = [];

    if (p.produto && p.peso_previsto) {
      materiais.push({
        id: p.id,
        nome_produto: p.produto,
        quantidade: parseFloat(p.peso_previsto),
        unidade: 'Kg',
        tipo_peso: 'Aproximado'
      });
    }

    if (materiais.length > 0) {
      materiais.forEach((item, index) => {
        const itemId = item.id;
        if (!descontosPorItem[itemId]) descontosPorItem[itemId] = [];

        const textoPeso = item.tipo_peso === 'Aproximado' ? 'Peso Aproximado' : 'Peso Exato';
        const icone = item.tipo_peso === 'Exato' ? '<i class="fa fa-check check-exato"></i>' : '';

        form.innerHTML += `
          <div class="material-bloco" data-item-id="${itemId}">
            <h4>${item.nome_produto}</h4>
            <p><strong>${textoPeso}:</strong> ${formatarPeso(item.quantidade)} Kg ${icone}</p>
            <div class="linha-peso">
              <label for="peso-${p.id}-${index}">Peso Carregado (Kg):</label>
              <input type="text" id="peso-${p.id}-${index}" class="input-sem-seta" placeholder="Insira o peso carregado aqui">
            </div>
            <div id="grupo-descontos-${itemId}"></div>
            <button type="button" class="btn btn-desconto" onclick="adicionarDescontoMaterial(${itemId})">Adicionar Desconto</button>
          </div>
        `;
      });

      form.innerHTML += `
        <div class="upload-ticket">
          <label for="ticket-${p.id}">Foto do Ticket da Balança:</label>
          <input type="file" id="ticket-${p.id}" accept="image/*">
        </div>
        <button class="btn btn-registrar" onclick="registrarPeso(${p.id})">Registrar Peso</button>
      `;
    } else {
      form.innerHTML = `<p style="padding: 15px; color: #555;">Este pedido ainda não possui materiais vinculados para registro de peso.</p>`;
    }

    card.appendChild(form);
    listaEl.appendChild(card);

    form.querySelectorAll('input[type="text"]').forEach(input => aplicarMascaraMilhar(input));
  });
}

function gerarBadgeStatus(status) {
  if (status === 'Aguardando Conferência do Peso') {
    return `<div class="status-badge status-verde"><i class="fa fa-check"></i> Peso Registrado</div>`;
  } else if (status === 'Coleta Iniciada') {
    return `<div class="status-badge status-amarelo"><i class="fa fa-truck"></i> ${status}</div>`;
  } else {
    return `<div class="status-badge status-cinza"><i class="fa fa-clock"></i> ${status}</div>`;
  }
}

function adicionarDescontoMaterial(itemId) {
  const container = document.getElementById(`grupo-descontos-${itemId}`);
  const existentes = descontosPorItem[itemId].map(d => d.motivo);
  if (existentes.length >= 3) return alert("Limite de 3 tipos de desconto atingido.");

  const index = container.querySelectorAll('.grupo-desconto').length;
  const idMotivo = `motivo-${itemId}-${index}`;
  const idQtd = `quantidade-${itemId}-${index}`;
  const idLabel = `label-${itemId}-${index}`;

  const div = document.createElement('div');
  div.className = 'grupo-desconto';
  div.id = `grupo-desconto-${itemId}-${index}`;
  div.innerHTML = `
    <div style="text-align: right;">
      <button class="fechar-desconto" onclick="removerDescontoMaterial(${itemId}, ${index})" style="margin-bottom: 6px;">&times;</button>
    </div>
    <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px;">
      <label for="${idMotivo}" style="min-width: 160px;">Motivo do Desconto:</label>
      <select id="${idMotivo}" onchange="atualizarDescontoItem(${itemId}, ${index})" style="flex: 1; padding: 6px;">
        <option value="">Selecione</option>
        <option value="Palete Pequeno">Palete Pequeno</option>
        <option value="Palete Grande">Palete Grande</option>
        <option value="Devolução de Material">Devolução de Material</option>
      </select>
    </div>
    <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px;">
      <label id="${idLabel}" for="${idQtd}" style="min-width: 160px;">Qtd. Paletes Grandes:</label>
      <input type="number" id="${idQtd}" placeholder="Digite a quantidade de paletes" oninput="atualizarDescontoItem(${itemId}, ${index})" min="0" class="input-sem-seta" style="flex: 1; padding: 6px;">
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

  const motivo = select.value;
  if (!motivo) return;

  let labelTexto = 'Peso devolvido (Kg)';
  let pesoPorUnidade = 1;
  let placeholder = 'Digite a quantidade de paletes';

  if (motivo === 'Palete Pequeno') {
    labelTexto = 'Qtd. Paletes Pequenos:';
    pesoPorUnidade = 6;
  } else if (motivo === 'Palete Grande') {
    labelTexto = 'Qtd. Paletes Grandes:';
    pesoPorUnidade = 14.37;
  }

  label.textContent = labelTexto;
  input.placeholder = placeholder;

  const valor = parseFloat(input.value);
  const pesoCalculado = motivo.includes('Palete') && !isNaN(valor) ? valor * pesoPorUnidade : valor;

  descontosPorItem[itemId][index] = {
    motivo,
    quantidade: valor || 0,
    peso_calculado: isNaN(pesoCalculado) ? 0 : pesoCalculado
  };
}

async function registrarPeso(pedidoId) {
  if (!confirm("Tem certeza que deseja registrar o peso?")) return;

  const pedido = pedidos.find(p => p.id === pedidoId);
  if (!pedido) return alert("Pedido não encontrado.");

  const form = document.getElementById(`form-${pedidoId}`);
  if (!form) return alert("Formulário não encontrado.");

  const itens = [];
  const blocos = form.querySelectorAll('.material-bloco');

  blocos.forEach((bloco) => {
    const itemId = parseInt(bloco.getAttribute('data-item-id'));
    const input = bloco.querySelector('input[type="text"]');
    const valor = parseFloat(input.value.replace(/\./g, '').replace(',', '.'));

    if (!isNaN(valor)) {
      itens.push({
        item_id: itemId,
        peso_carregado: valor,
        descontos: (descontosPorItem[itemId] || []).filter(d => d.motivo && d.peso_calculado > 0)
      });
    }
  });

  if (!itens.length) return alert("Informe ao menos um peso carregado.");

  const ticketInput = document.getElementById(`ticket-${pedidoId}`);
  const ticketFile = ticketInput?.files[0];
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
  document.getElementById('filtro-cliente').addEventListener('input', carregarPedidos);
  document.getElementById('ordenar').addEventListener('change', carregarPedidos);
});
