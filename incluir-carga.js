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
        produtos_autorizados: p.produtos_autorizados || [],
        produtos_venda: p.produtos_venda || []
      };
    }

    pedidosAgrupados[p.id].materiais.push({
      item_id: p.item_id,
      nome_produto: p.produto,
      quantidade: parseFloat(p.peso_previsto),
      unidade: 'Kg',
      tipo_peso: p.tipo_peso,
      peso_carregado: p.peso_carregado || 0
    });
  });

  const listaTodos = Object.values(pedidosAgrupados);
pedidos = listaTodos;
renderizarPedidos(listaTodos);
}

function gerarBadgeStatus(status) {
  const statusComPesoRegistrado = [
    'Aguardando Conferência do Peso',
    'Em Análise pelo Financeiro',
    'Aguardando Emissão de NF'
  ];

  if (statusComPesoRegistrado.includes(status)) {
    return `<div class="status-badge status-verde"><i class="fa fa-check"></i> Peso Registrado</div>`;
  } else if (status === 'Coleta Iniciada') {
    return `<div class="status-badge status-amarelo"><i class="fa fa-truck"></i> ${status}</div>`;
  } else if (status === 'Aguardando Início da Coleta') {
    return `<div class="status-badge status-amarelo"><i class="fa fa-truck"></i> ${status}</div>`;
  } else {
    return `<div class="status-badge status-cinza"><i class="fa fa-clock"></i> ${status}</div>`;
  }
}
function renderizarPedidos(lista) {
  const listaEl = document.getElementById('lista-pedidos');
  listaEl.innerHTML = '';

  const pendentes = lista.filter(p =>
    p.status === 'Coleta Iniciada' &&
    p.materiais.every(m => !m.peso_carregado || parseFloat(m.peso_carregado) === 0)
  );

  const concluidos = lista.filter(p =>
    !(p.status === 'Coleta Iniciada' &&
    p.materiais.every(m => !m.peso_carregado || parseFloat(m.peso_carregado) === 0))
  );

  const pedidosOrdenados = [...pendentes, ...concluidos];

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

    const podeExecutar = ['Coleta Iniciada', 'Carga e Descarga'].includes(p.status);
    const form = document.createElement('div');
    form.className = 'formulario';
    form.id = `form-${p.id}`;
    form.style.display = tarefasAbertas[p.id] && podeExecutar ? 'block' : 'none';

    p.materiais.forEach((item, index) => {
      const itemId = item.item_id;
      if (!descontosPorItem[itemId]) descontosPorItem[itemId] = [];

      const tipoPeso = (item.tipo_peso || '').toLowerCase().includes('aproximado') ? 'Aproximado' : 'Exato';
      const textoPeso = tipoPeso === 'Aproximado' ? 'Peso Aproximado' : 'Peso Exato';
      const icone = tipoPeso === 'Exato' ? '<i class="fa fa-check check-exato"></i>' : '';

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

function adicionarDescontoMaterial(itemId, pedidoId) {
  const container = document.getElementById(`grupo-descontos-${itemId}`);
  const index = container.querySelectorAll('.grupo-desconto').length;
  if (index >= 3) return alert("Limite de 3 tipos de desconto atingido.");

  const idMotivo = `motivo-${itemId}-${index}`;
  const idCampoExtra = `campo-extra-${itemId}-${index}`;
  const div = document.createElement('div');
  div.className = 'grupo-desconto';
  div.id = `grupo-desconto-${itemId}-${index}`;
  div.innerHTML = `
    <div style="text-align: right;">
      <button class="fechar-desconto" onclick="removerDescontoMaterial(${itemId}, ${index})" title="Remover desconto">&times;</button>
    </div>
    <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px; padding-right: 10px;">
      <label for="${idMotivo}" style="min-width: 150px;">Motivo do Desconto:</label>
      <select id="${idMotivo}" onchange="atualizarDescontoItem(${itemId}, ${index}, ${pedidoId})" style="flex: 1; padding: 6px;">
        <option value="">Selecione</option>
        <option value="Palete Pequeno">Palete Pequeno</option>
        <option value="Palete Grande">Palete Grande</option>
        <option value="Devolução de Material">Devolução de Material</option>
        <option value="Compra de Material">Compra de Material</option>
      </select>
    </div>
    <div id="${idCampoExtra}"></div>
  `;
  container.appendChild(div);
}

function atualizarDescontoItem(itemId, index, pedidoId) {
  const pedido = pedidos.find(p => p.id === pedidoId);
  const materiais = pedido?.produtos_autorizados || [];
  const materiaisCompra = pedido?.produtos_venda || [];

  const motivo = document.getElementById(`motivo-${itemId}-${index}`).value;
  const containerExtra = document.getElementById(`campo-extra-${itemId}-${index}`);
  if (!motivo) return;

  let htmlExtra = '';

  if (motivo === 'Palete Pequeno' || motivo === 'Palete Grande') {
    htmlExtra = `
      <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px;">
        <label for="quantidade-${itemId}-${index}" style="min-width: 150px;">Qtd. ${motivo}s:</label>
        <input type="text" id="quantidade-${itemId}-${index}" placeholder="Digite a quantidade" class="input-sem-seta" style="flex: 1; padding: 6px;">
      </div>
    `;
    containerExtra.innerHTML = htmlExtra;
    aplicarMascaraMilhar(document.getElementById(`quantidade-${itemId}-${index}`));
  } else if (motivo === 'Devolução de Material' || motivo === 'Compra de Material') {
    const selectId = `material-${itemId}-${index}`;
    const pesoId = `peso-${itemId}-${index}`;
    const uploadId = `upload-${itemId}-${index}`;

    const opcoes = (motivo === 'Devolução de Material' ? materiais : materiaisCompra)
      .map(m => `<option value="${m.nome}">${m.nome}</option>`).join('');

    htmlExtra = `
      <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px;">
        <label style="min-width: 150px;">Material ${motivo === 'Compra de Material' ? 'comprado' : 'devolvido'}:</label>
        <select id="${selectId}" style="flex: 1; padding: 6px;">
          <option value="">Selecione</option>
          ${opcoes}
        </select>
      </div>
      <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px;">
        <label for="${pesoId}" style="min-width: 150px;">Peso ${motivo === 'Compra de Material' ? 'comprado' : 'devolvido'} (Kg):</label>
        <input type="text" id="${pesoId}" placeholder="Digite o peso" class="input-sem-seta" style="flex: 1; padding: 6px;">
      </div>
      <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px;">
        <label for="${uploadId}" style="min-width: 150px;">Foto do Ticket (${motivo === 'Compra de Material' ? 'Compra' : 'Devolução'}):</label>
        <input type="file" id="${uploadId}" accept="image/*" style="flex: 1;">
      </div>
    `;
    containerExtra.innerHTML = htmlExtra;
    aplicarMascaraMilhar(document.getElementById(pesoId));
  }
}

function removerDescontoMaterial(itemId, index) {
  const div = document.getElementById(`grupo-desconto-${itemId}-${index}`);
  if (div) div.remove();
  if (descontosPorItem[itemId]) {
    descontosPorItem[itemId] = descontosPorItem[itemId].filter((_, i) => i !== index);
  }
}

async function registrarPeso(pedidoId) {
  if (!confirm("Tem certeza que deseja registrar o peso?")) return;

  const pedido = pedidos.find(p => p.id === pedidoId);
  const form = document.getElementById(`form-${pedidoId}`);
  const itens = [];
  const blocos = form.querySelectorAll('.material-bloco');
  const arquivosExtras = [];

  blocos.forEach(bloco => {
  const itemId = parseInt(bloco.getAttribute('data-item-id'));
  const input = bloco.querySelector('input[type="text"]');
  const valor = parseFloat(input.value.replace(/\./g, '').replace(',', '.'));

  const grupos = bloco.querySelectorAll('.grupo-desconto');
  for (let i = 0; i < grupos.length; i++) {
    const grupo = grupos[i];
    const motivo = grupo.querySelector('select')?.value;

    if (motivo === 'Palete Pequeno' || motivo === 'Palete Grande') {
      const campoQtd = grupo.querySelector(`#quantidade-${itemId}-${i}`);
      const qtd = parseFloat(campoQtd?.value.replace(/\./g, '').replace(',', '.'));
      if (!campoQtd || isNaN(qtd) || qtd <= 0) {
        alert("Preencha a quantidade de todos os descontos aplicados antes de finalizar.");
        return;
      }
    }

    if (motivo === 'Devolução de Material' || motivo === 'Compra de Material') {
      const campoMaterial = grupo.querySelector(`#material-${itemId}-${i}`);
      const materialSelecionado = campoMaterial?.value;
      const campoPeso = grupo.querySelector(`#peso-${itemId}-${i}`);
      const peso = parseFloat(campoPeso?.value.replace(/\./g, '').replace(',', '.'));
      const campoArquivo = grupo.querySelector(`#upload-${itemId}-${i}`);
      const arquivo = campoArquivo?.files?.[0];

      if (!materialSelecionado) {
        alert("Preencha todos os campos obrigatórios dos descontos de material antes de finalizar.\n(Material não selecionado)");
        return;
      }

      if (!campoPeso || isNaN(peso) || peso <= 0) {
        alert("Preencha todos os campos obrigatórios dos descontos de material antes de finalizar.\n(Peso inválido)");
        return;
      }

      if (!arquivo) {
        alert("Preencha todos os campos obrigatórios dos descontos de material antes de finalizar.\n(Foto do ticket ausente)");
        return;
      }
    }
  }

  if (!isNaN(valor)) {

      const descontos = [];
      const grupos = bloco.querySelectorAll('.grupo-desconto');
      grupos.forEach((grupo, i) => {
        const motivo = grupo.querySelector('select')?.value;
        if (!motivo) return;

        let pesoCalculado = 0;
        let infoExtra = {};

        if (motivo.includes('Palete')) {
          const campoQtd = grupo.querySelector(`#quantidade-${itemId}-${i}`);
          const qtd = parseFloat(campoQtd?.value.replace(/\./g, '').replace(',', '.'));
          if (!isNaN(qtd)) {
            pesoCalculado = motivo === 'Palete Pequeno' ? qtd * 6 : qtd * 14.37;
            infoExtra = { quantidade: qtd };
          }
        } else {
          const campoPeso = grupo.querySelector(`#peso-${itemId}-${i}`);
          const peso = parseFloat(campoPeso?.value.replace(/\./g, '').replace(',', '.'));
          const material = grupo.querySelector(`#material-${itemId}-${i}`)?.value;
          const arquivo = grupo.querySelector(`#upload-${itemId}-${i}`)?.files?.[0];
          if (!isNaN(peso)) {
            pesoCalculado = peso;
            const fieldName = `${motivo === 'Compra de Material' ? 'ticket_compra' : 'ticket_devolucao'}_${itemId}_${i}`;
            if (arquivo) {
              arquivosExtras.push({ file: arquivo, field: fieldName });
              infoExtra[motivo === 'Compra de Material' ? 'ticket_compra' : 'ticket_devolucao'] = fieldName;
            }
            infoExtra.material = material;
          }
        }

        if (pesoCalculado > 0) {
          descontos.push({ motivo, peso_calculado: pesoCalculado, ...infoExtra });
        }
      });

      itens.push({ item_id: itemId, peso_carregado: valor, descontos });
    }
  });

  const ticketInput = document.getElementById(`ticket-${pedidoId}`);
  const ticketFile = ticketInput?.files[0];
  if (!ticketFile) return alert("Por favor, selecione a foto do ticket da balança.");

  const formData = new FormData();
  formData.append('itens', JSON.stringify(itens));
  formData.append('ticket_balanca', ticketFile);

  arquivosExtras.forEach(({ field, file }) => {
    formData.append(field, file);
  });

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
});
