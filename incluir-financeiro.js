function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR');
}

async function carregarPedidosFinanceiro() {
  const [resPendentes, resAnteriores] = await Promise.all([
    fetch('/api/pedidos?status=Em%20An%C3%A1lise%20pelo%20Financeiro'),
    fetch('/api/pedidos?status=Aguardando%20Confer%C3%AAncia%20do%20Peso')
  ]);

  let pedidos = [];

  try {
    const pendentes = await resPendentes.json();
    const anteriores = await resAnteriores.json();
    pedidos = [...pendentes, ...anteriores];
    if (!Array.isArray(pedidos)) throw new Error('Resposta inválida');
  } catch (erro) {
    console.error('Erro ao carregar pedidos:', erro);
    document.getElementById('lista-pedidos').innerHTML = "<p style='padding: 0 25px;'>Erro ao carregar tarefas financeiras.</p>";
    return;
  }

  const lista = document.getElementById('lista-pedidos');
  const filtro = document.getElementById('filtro-cliente')?.value.toLowerCase() || '';
  const ordenar = document.getElementById('ordenar')?.value || 'data';

  let filtrados = pedidos.filter(p => p.cliente.toLowerCase().includes(filtro));

  if (ordenar === 'cliente') {
    filtrados.sort((a, b) => a.cliente.localeCompare(b.cliente));
  } else {
    filtrados.sort((a, b) => new Date(a.data_coleta) - new Date(b.data_coleta));
  }

  lista.innerHTML = '';

  if (!filtrados.length) {
    lista.innerHTML = "<p style='padding: 0 25px;'>Nenhum pedido disponível no momento.</p>";
    return;
  }

  filtrados.forEach(pedido => {
    const id = pedido.pedido_id || pedido.id;
    const card = document.createElement('div');
    card.className = 'card';

    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `
      <div class="info">
        <h3>${pedido.cliente}</h3>
        <p>Empresa: ${pedido.empresa ? (pedido.empresa.charAt(0).toUpperCase() + pedido.empresa.slice(1)) : '—'}</p>
      </div>
      <div class="status-badge status-amarelo">
        <i class="fa fa-money-bill"></i> ${pedido.status}
      </div>
    `;
    card.appendChild(header);

    const form = document.createElement('div');
    form.className = 'formulario';
    form.style.display = 'none';

    const containerCinza = document.createElement('div');
    containerCinza.style.background = '#f8f9fa';
    containerCinza.style.padding = '20px';
    containerCinza.style.borderRadius = '8px';
    containerCinza.style.marginBottom = '20px';

    const totalVenda = (pedido.materiais || []).reduce((soma, item) => {
      return soma + (Number(item.valor_total) || 0);
    }, 0);

    const valorParcela = totalVenda / (pedido.prazos_pagamento?.length || 1);
    const vencimentosHTML = (pedido.prazos_pagamento || []).map((data, index) => {
      const dataFormatada = new Date(data);
      const dataValida = !isNaN(dataFormatada.getTime());
      return `
        <p style="margin-bottom: 6px;">
          <span style="background:#eee; color:#555; padding:5px 10px; border-radius:20px; font-size:13px; margin-right:6px; font-weight: 500;">
            Vencimento ${index + 1}
          </span>
          ${dataValida ? formatarData(dataFormatada) : 'Data inválida'} - Valor: R$ ${valorParcela.toFixed(2)}
          <button class="btn-confirmar-vencimento" data-pedido="${id}" data-parcela="${index}" style="margin-left:10px; padding: 2px 8px; font-size: 12px; cursor:pointer;">✓ Confirmar</button>
          <input type="number" step="0.01" value="${valorParcela.toFixed(2)}" class="input-vencimento" data-pedido="${id}" data-parcela="${index}" style="width:100px; margin-left:5px;">
        </p>
      `;
    }).join('');

    containerCinza.innerHTML = `
      <p style="margin-bottom: 10px;"><strong>Código Interno do Pedido:</strong> ${pedido.codigo_interno || '—'}</p>
      ${vencimentosHTML}
      <p style="margin-bottom: 10px; font-weight:bold;">Valor Total da Venda: R$ ${totalVenda.toFixed(2)}</p>
      <div style="background:#fff3cd; padding:10px; border-radius:6px; margin-top:20px;">
        <strong>Observações:</strong> ${pedido.observacoes || '—'}
      </div>
    `;
    form.appendChild(containerCinza);

    const tituloMateriais = document.createElement('h4');
    tituloMateriais.textContent = 'Materiais da Venda';
    tituloMateriais.style.margin = '30px 0 10px';
    form.appendChild(tituloMateriais);

    (pedido.materiais || []).forEach(item => {
      const cardMaterial = document.createElement('div');
      cardMaterial.style.background = '#f5f5f5';
      cardMaterial.style.border = '1px dashed #ccc';
      cardMaterial.style.borderRadius = '8px';
      cardMaterial.style.padding = '16px';
      cardMaterial.style.marginBottom = '16px';

      // Peso previsto - exato ou aproximado (igual conferência)
      const pesoPrevistoTexto = item.tipo_peso === 'Exato' ?
        `Peso Previsto para Carregamento (Exato): ${item.peso} Kg` :
        `Peso Previsto para Carregamento (Aproximado): ${item.peso} Kg`;

      // Descontos aplicados (com ícone igual conferência)
      const descontosHTML = (item.descontos && item.descontos.length > 0) ? `
        <div class="descontos-aplicados" style="background-color: #fff9e6; border: 1px solid #ffe08a; padding: 12px; border-radius: 6px; margin-top: 14px;">
          <p style="font-weight: 600; margin: 0 0 6px; color: #000;">
            <i class="fa fa-tag" aria-hidden="true" style="margin-right: 8px;"></i> Descontos Aplicados:
          </p>
          <ul>
            ${item.descontos.map(d => `<li>${d.motivo}: ${d.quantidade} UNIDADES (${d.peso_calculado} Kg)</li>`).join('')}
          </ul>
        </div>
      ` : '';

      cardMaterial.innerHTML = `
        <p><strong>MATERIAL: ${item.nome_produto}</strong></p>
        <p>${pesoPrevistoTexto}</p>
        <p>Peso Registrado na Carga: ${item.peso_carregado || '—'} Kg</p>
        ${descontosHTML}
        <p style="margin-top: 10px; font-weight: bold;">Valor do Item: R$ ${item.valor_total.toFixed(2)}</p>
      `;
      form.appendChild(cardMaterial);
    });

    const blocoObservacao = document.createElement('div');
    blocoObservacao.style.marginTop = '30px';

    const labelObs = document.createElement('label');
    labelObs.textContent = 'Observações do Financeiro:';
    labelObs.style.display = 'block';
    labelObs.style.marginBottom = '6px';
    labelObs.style.fontWeight = '500';

    const textareaObs = document.createElement('textarea');
    textareaObs.placeholder = 'Digite suas observações aqui...';
    textareaObs.style.width = '100%';
    textareaObs.style.padding = '10px';
    textareaObs.style.border = '1px solid #ccc';
    textareaObs.style.borderRadius = '6px';
    textareaObs.style.fontSize = '14px';
    textareaObs.style.minHeight = '80px';

    blocoObservacao.appendChild(labelObs);
    blocoObservacao.appendChild(textareaObs);
    form.appendChild(blocoObservacao);

    const btnContainer = document.createElement('div');
    btnContainer.style.marginTop = '20px';

    const botao = document.createElement('button');
    botao.textContent = 'Confirmar Liberação do Cliente';
    botao.className = 'btn btn-registrar';
    botao.onclick = () => confirmarFinanceiro(id, textareaObs.value);
    btnContainer.appendChild(botao);

    form.appendChild(btnContainer);
    card.appendChild(form);

    header.addEventListener('click', () => {
      form.style.display = form.style.display === 'block' ? 'none' : 'block';
    });

    lista.appendChild(card);
  });

  // Event delegation para confirmação de vencimentos editáveis
  lista.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-confirmar-vencimento')) {
      const pedidoId = e.target.dataset.pedido;
      const parcelaIndex = parseInt(e.target.dataset.parcela);
      const input = lista.querySelector(`input.input-vencimento[data-pedido="${pedidoId}"][data-parcela="${parcelaIndex}"]`);
      if (input) {
        const novoValor = parseFloat(input.value);
        if (isNaN(novoValor) || novoValor < 0) {
          alert('Valor inválido para a parcela.');
          return;
        }
        // Aqui você pode implementar lógica para salvar a alteração no backend se desejar
        alert(`Parcela ${parcelaIndex + 1} do pedido ${pedidoId} confirmada com valor: R$ ${novoValor.toFixed(2)}`);
        // Desabilitar o input após confirmação
        input.disabled = true;
        // Alterar o botão para indicar confirmação
        e.target.textContent = '✔ Confirmado';
        e.target.disabled = true;
      }
    }
  });
}

async function confirmarFinanceiro(pedidoId, observacoes) {
  try {
    const res = await fetch(`/api/pedidos/${pedidoId}/financeiro`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ observacoes_financeiro: observacoes })
    });

    const data = await res.json();

    if (res.ok) {
      alert('Cliente liberado com sucesso!');
      carregarPedidosFinanceiro();
    } else {
      alert(data.erro || 'Erro ao confirmar liberação.');
    }
  } catch (error) {
    console.error('Erro ao confirmar liberação:', error);
    alert('Erro de comunicação com o servidor.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  carregarPedidosFinanceiro();
  document.getElementById('filtro-cliente')?.addEventListener('input', carregarPedidosFinanceiro);
  document.getElementById('ordenar')?.addEventListener('change', carregarPedidosFinanceiro);
});

