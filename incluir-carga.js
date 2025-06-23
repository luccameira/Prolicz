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
let tarefasAbertas = {};

async function carregarPedidos() {
  const res = await fetch('/api/pedidos/carga');
  const listaPedidos = await res.json();

  const pedidosAgrupados = {};

  listaPedidos.forEach(p => {
    if (!pedidosAgrupados[p.id]) {
      pedidosAgrupados[p.id] = {
        id: p.id,
        cliente: p.cliente,
        data_coleta: p.data_coleta,
        status: p.status,
        materiais: [],
        data_criacao: p.data_criacao,
        data_coleta_iniciada: p.data_coleta_iniciada,
        data_carga_finalizada: p.data_carga_finalizada,
        data_conferencia_peso: p.data_conferencia_peso,
        data_financeiro: p.data_financeiro,
        data_nf_emitida: p.data_nf_emitida,
        data_finalizado: p.data_finalizado,
        observacoes_setor: p.observacoes_setor || [],
        produtos_autorizados: p.produtos_autorizados || []
      };
    }

    pedidosAgrupados[p.id].materiais.push({
      item_id: p.item_id,
      nome_produto: p.produto,
      quantidade: parseFloat(p.peso_previsto),
      unidade: 'Kg',
      tipo_peso: p.tipo_peso
    });
  });

  const listaFiltrada = Object.values(pedidosAgrupados).filter(p => p.status !== 'Aguardando Início da Coleta');
  pedidos = listaFiltrada;
  renderizarPedidos(listaFiltrada);
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

  const pendentes = pedidosFiltrados.filter(p =>
    p.status === 'Coleta Iniciada' &&
    p.materiais.every(m => !m.peso_carregado || parseFloat(m.peso_carregado) === 0)
  );

  const concluidos = pedidosFiltrados.filter(p =>
    !(p.status === 'Coleta Iniciada' &&
    p.materiais.every(m => !m.peso_carregado || parseFloat(m.peso_carregado) === 0))
  );

  const pedidosOrdenados = [...pendentes, ...concluidos];
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

    p.materiais.forEach((item, index) => {
      const itemId = item.item_id;
      if (!descontosPorItem[itemId]) descontosPorItem[itemId] = [];

      const textoPeso = item.tipo_peso === 'Aproximado' ? 'Peso Aproximado' : 'Peso Exato';
      const icone = item.tipo_peso === 'Exato' ? '<i class="fa fa-check check-exato"></i>' : '';

      form.innerHTML += `
        <div class="material-bloco" data-item-id="${itemId}" data-pedido-id="${p.id}">
          <h4>${item.nome_produto || '—'}</h4>
          <p><strong>${textoPeso}:</strong> ${formatarPeso(item.quantidade)} Kg ${icone}</p>
          <div class="linha-peso">
            <label for="peso-${p.id}-${index}">Peso Carregado (Kg):</label>
            <input type="text" id="peso-${p.id}-${index}" class="input-sem-seta" placeholder="Insira o peso carregado aqui">
          </div>
          <div id="grupo-descontos-${itemId}"></div>
          <button type="button" class="btn btn-desconto" onclick="adicionarDescontoMaterial(${itemId}, ${p.id})">Adicionar Desconto</button>
        </div>
      `;
    });

    const observacoesHTML = (p.observacoes_setor?.length)
      ? `<div style="background: #fff3cd; padding: 12px; border-left: 5px solid #ffc107; border-radius: 4px; margin-top: 20px; margin-bottom: 20px;">
           <strong>Observações para Carga e Descarga:</strong><br>
           ${p.observacoes_setor.map(o => `<div>${o}</div>`).join('')}
         </div>`
      : '';

    form.innerHTML += `
      <div class="upload-ticket">
        <label for="ticket-${p.id}">Foto do Ticket da Balança:</label>
        <input type="file" id="ticket-${p.id}" accept="image/*">
      </div>
      ${observacoesHTML}
      <button class="btn btn-registrar" onclick="registrarPeso(${p.id})">Registrar Peso</button>
    `;

    card.appendChild(form);
    listaEl.appendChild(card);

    form.querySelectorAll('input[type="text"]').forEach(input => aplicarMascaraMilhar(input));
  });
}

async function registrarPeso(pedidoId) {
  const pedido = pedidos.find(p => p.id === pedidoId);
  const formEl = document.getElementById(`form-${pedidoId}`);
  const materiaisEl = formEl.querySelectorAll('.material-bloco');
  const ticketFile = formEl.querySelector(`#ticket-${pedidoId}`).files[0];

  const itens = [];
  let erro = false;

  materiaisEl.forEach((material, index) => {
    const itemId = material.getAttribute('data-item-id');
    const inputPeso = material.querySelector(`#peso-${pedidoId}-${index}`);
    const pesoCarregado = parseFloat(inputPeso.value.replace(/\./g, '').replace(',', '.')) || 0;

    if (pesoCarregado <= 0) {
      alert(`Por favor, insira o peso carregado para o material ${material.querySelector('h4').innerText}`);
      erro = true;
      return;
    }

    const descontosDoItem = descontosPorItem[itemId] || [];

    const descontosValidos = descontosDoItem.filter(d => {
      const motivo = d.motivo;
      const peso = d.peso_calculado;
      const material = d.material;

      if (!motivo) return false;

      if (motivo === 'Devolução de Material') {
        return material && material.trim() !== '';
      }

      return peso && peso > 0;
    });

    itens.push({
      item_id: itemId,
      peso_carregado: pesoCarregado,
      descontos: descontosValidos
    });
  });

  if (erro) return;

  const formData = new FormData();
  formData.append('itens', JSON.stringify(itens));

  if (ticketFile) {
    formData.append('ticket_balanca', ticketFile);
  }

  // Upload de tickets de devolução, se houver
  itens.forEach((item, index) => {
    if (!item.descontos) return;
    item.descontos.forEach((desc, i) => {
      if (desc.ticket_devolucao) {
        formData.append(`ticket_devolucao_${item.item_id}_${i}`, desc.ticket_devolucao);
      }
    });
  });

  const confirmacao = confirm('Tem certeza que deseja registrar os pesos e descontos?');
  if (!confirmacao) return;

  try {
    const res = await fetch(`/api/pedidos/${pedidoId}/carga`, {
      method: 'PUT',
      body: formData
    });

    if (res.ok) {
      alert('Peso registrado com sucesso!');
      await carregarPedidos();
    } else {
      alert('Erro ao registrar peso.');
    }
  } catch (err) {
    console.error(err);
    alert('Erro na comunicação com o servidor.');
  }
}

function adicionarDescontoMaterial(itemId, pedidoId) {
  const grupoEl = document.getElementById(`grupo-descontos-${itemId}`);
  const index = descontosPorItem[itemId].length;

  const desconto = { motivo: '', quantidade: 0, peso_calculado: 0, material: '', ticket_devolucao: null };
  descontosPorItem[itemId].push(desconto);

  const container = document.createElement('div');
  container.className = 'bloco-desconto';

  container.innerHTML = `
    <label>Motivo do Desconto:</label>
    <select onchange="atualizarMotivo(${itemId}, ${index}, this.value)">
      <option value="">Selecione</option>
      <option value="Palete Pequeno">Palete Pequeno</option>
      <option value="Palete Grande">Palete Grande</option>
      <option value="Devolução de Material">Devolução de Material</option>
    </select>
    <div id="bloco-material-${itemId}-${index}" style="display:none; margin-top: 5px;">
      <label>Material Devolvido:</label>
      <input type="text" oninput="atualizarMaterial(${itemId}, ${index}, this.value)" placeholder="Descreva o material">
      <label>Peso Devolvido (Kg):</label>
      <input type="text" oninput="atualizarPeso(${itemId}, ${index}, this.value)" class="input-milhar">
      <label>Foto do Ticket:</label>
      <input type="file" onchange="atualizarTicket(${itemId}, ${index}, this.files[0])" accept="image/*">
    </div>
  `;

  grupoEl.appendChild(container);

  // aplicar máscara ao novo campo de peso devolvido
  const inputPeso = container.querySelector('.input-milhar');
  if (inputPeso) aplicarMascaraMilhar(inputPeso);
}

function atualizarMotivo(itemId, index, valor) {
  descontosPorItem[itemId][index].motivo = valor;

  const blocoMaterial = document.getElementById(`bloco-material-${itemId}-${index}`);
  if (valor === 'Devolução de Material') {
    blocoMaterial.style.display = 'block';
  } else {
    blocoMaterial.style.display = 'none';
    const peso = valor === 'Palete Pequeno' ? 6 : valor === 'Palete Grande' ? 14.37 : 0;
    descontosPorItem[itemId][index].peso_calculado = peso;
  }
}

function atualizarPeso(itemId, index, valor) {
  const peso = parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0;
  descontosPorItem[itemId][index].peso_calculado = peso;
}

function atualizarMaterial(itemId, index, valor) {
  descontosPorItem[itemId][index].material = valor;
}

function atualizarTicket(itemId, index, file) {
  descontosPorItem[itemId][index].ticket_devolucao = file;
}

document.getElementById('filtro-cliente').addEventListener('input', () => renderizarPedidos(pedidos));
document.getElementById('ordenar').addEventListener('change', () => renderizarPedidos(pedidos));

carregarPedidos();
