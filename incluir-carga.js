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
let formularioAberto = {};

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

  listaEl.innerHTML = '';

  pedidosFiltrados.forEach(p => {
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
    form.style.display = formularioAberto[p.id] ? 'block' : 'none';
    card.appendChild(form);

    header.style.cursor = podeExecutar ? 'pointer' : 'default';

    if (podeExecutar) {
      header.addEventListener('click', () => {
        formularioAberto[p.id] = !formularioAberto[p.id];
        form.style.display = formularioAberto[p.id] ? 'block' : 'none';
      });

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

          const bloco = document.createElement('div');
          bloco.className = 'material-bloco';
          bloco.setAttribute('data-item-id', itemId);

          bloco.innerHTML = `
            <h4>${item.nome_produto}</h4>
            <p>
              <strong>${textoPeso}:</strong> ${formatarPeso(item.quantidade)} ${item.unidade}
              ${icone}
            </p>
            <div class="linha-peso">
              <label for="peso-${p.id}-${index}">Peso Carregado (Kg):</label>
              <input type="text" id="peso-${p.id}-${index}" class="input-sem-seta" placeholder="Insira o peso carregado aqui">
            </div>
            <div class="grupo-descontos" id="grupo-descontos-${itemId}"></div>
            <button type="button" class="btn btn-desconto" onclick="adicionarDescontoMaterial(${itemId})">Adicionar Desconto</button>
          `;

          form.appendChild(bloco);

          setTimeout(() => {
            const input = document.getElementById(`peso-${p.id}-${index}`);
            aplicarMascaraMilhar(input);
          }, 10);
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
    }

    listaEl.appendChild(card);
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
          <input type="number" id="${idQtd}" class="input-sem-seta" oninput="atualizarDescontoItem(${itemId}, ${index})">
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
  let placeholder = 'Digite o peso (kg)';
  let pesoPorUnidade = 1;

  if (motivo === 'Palete Pequeno') {
    unidade = 'unidade';
    labelTexto = 'Qtd. Paletes Pequenos';
    placeholder = 'Digite a quantidade de paletes pequenos';
    pesoPorUnidade = 6;
  } else if (motivo === 'Palete Grande') {
    unidade = 'unidade';
    labelTexto = 'Qtd. Paletes Grandes';
    placeholder = 'Digite a quantidade de paletes grandes';
    pesoPorUnidade = 14.37;
  } else if (motivo === 'Devolução de Material') {
    unidade = 'kg';
    labelTexto = 'Peso devolvido (kg)';
    placeholder = 'Digite o peso a ser descontado';
    pesoPorUnidade = 1;
  }

  label.textContent = labelTexto;
  input.placeholder = placeholder;

  const qtd = parseFloat(input.value);
  const sufixoTexto = unidade === 'unidade' && qtd > 1 ? 'unidade(s)' : unidade;
  sufixo.textContent = sufixoTexto;

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

  blocos.forEach((bloco) => {
    const itemId = parseInt(bloco.getAttribute('data-item-id'));
    const input = bloco.querySelector('input[type="text"]');
    const peso = parseFloat(input.value.replace(/\./g, ''));

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

