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

function adicionarDescontoMaterial(itemId) {
  const container = document.getElementById(`grupo-descontos-${itemId}`);
  const index = descontosPorItem[itemId].length;

  const bloco = document.createElement('div');
  bloco.className = 'bloco-desconto';
  bloco.style.marginTop = '20px';

  bloco.innerHTML = `
    <div class="linha-peso">
      <label for="motivo-${itemId}-${index}">Motivo do Desconto:</label>
      <select id="motivo-${itemId}-${index}" onchange="atualizarDescontoItem(${itemId}, ${index})">
        <option value="">Selecione</option>
        <option value="Palete Grande">Palete Grande</option>
        <option value="Palete Pequeno">Palete Pequeno</option>
        <option value="Devolução de Material">Devolução de Material</option>
      </select>
    </div>
    <div class="linha-peso" id="campo-quantidade-${itemId}-${index}" style="display:none; flex-wrap: wrap; align-items: flex-end;">
      <label id="label-quantidade-${itemId}-${index}" for="quantidade-${itemId}-${index}" style="margin-top: 14px;">Quantidade:</label>
      <input type="text" id="quantidade-${itemId}-${index}" class="input-sem-seta" style="margin-top: 8px; max-width: 220px;" placeholder="">
      <span id="sufixo-${itemId}-${index}" style="margin-left: 8px;">Kg</span>
    </div>
  `;

  container.appendChild(bloco);
  descontosPorItem[itemId].push({ motivo: '', quantidade: 0 });

  const inputQtd = bloco.querySelector(`#quantidade-${itemId}-${index}`);
  aplicarMascaraMilhar(inputQtd);
}

function atualizarDescontoItem(itemId, index) {
  const motivo = document.getElementById(`motivo-${itemId}-${index}`).value;
  const campo = document.getElementById(`campo-quantidade-${itemId}-${index}`);
  const label = document.getElementById(`label-quantidade-${itemId}-${index}`);
  const input = document.getElementById(`quantidade-${itemId}-${index}`);
  const sufixo = document.getElementById(`sufixo-${itemId}-${index}`);

  campo.style.display = motivo ? 'flex' : 'none';

  if (motivo === 'Palete Grande') {
    label.textContent = 'Qtd. Paletes Grandes:';
    input.placeholder = 'Insira a quantidade de paletes grandes';
    sufixo.textContent = 'unidade(s)';
  } else if (motivo === 'Palete Pequeno') {
    label.textContent = 'Qtd. Paletes Pequenos:';
    input.placeholder = 'Insira a quantidade de paletes pequenos';
    sufixo.textContent = 'unidade(s)';
  } else if (motivo === 'Devolução de Material') {
    label.textContent = 'Peso Devolvido: (Kg)';
    input.placeholder = 'Insira o peso do material devolvido';
    sufixo.textContent = 'Kg';
  }

  descontosPorItem[itemId][index].motivo = motivo;
}

async function registrarPeso(pedidoId) {
  const form = document.getElementById(`form-${pedidoId}`);
  const blocos = form.querySelectorAll('.material-bloco');
  const materiais = [];

  blocos.forEach(bloco => {
    const itemId = bloco.dataset.itemId;
    const peso = bloco.querySelector(`#peso-${pedidoId}-0`).value.replace(/\./g, '');
    const pesoNum = parseFloat(peso);
    const descontos = [];

    const descontosBlocos = bloco.querySelectorAll('.bloco-desconto');
    descontosBlocos.forEach((blocoDesconto, index) => {
      const motivo = blocoDesconto.querySelector(`#motivo-${itemId}-${index}`).value;
      let quantidade = blocoDesconto.querySelector(`#quantidade-${itemId}-${index}`).value;
      quantidade = quantidade.replace(/\./g, '');
      descontos.push({ motivo, quantidade: parseFloat(quantidade) || 0 });
    });

    materiais.push({ itemId, peso: pesoNum, descontos });
  });

  const ticketInput = document.getElementById(`ticket-${pedidoId}`);
  const formData = new FormData();
  formData.append('materiais', JSON.stringify(materiais));

  if (ticketInput && ticketInput.files.length > 0) {
    formData.append('ticket', ticketInput.files[0]);
  }

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
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('filtro-cliente').addEventListener('input', () => renderizarPedidos(pedidos));
  document.getElementById('ordenar').addEventListener('change', () => renderizarPedidos(pedidos));
  carregarPedidos();
});

