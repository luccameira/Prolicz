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
        <p>Empresa: ${pedido.empresa ? capitalizeEmpresa(pedido.empresa) : '—'}</p>
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

    // Vencimentos com campos editáveis e confirmação
    const vencimentosHTML = (pedido.prazos_pagamento || []).map((data, index) => {
      const dataFormatada = new Date(data);
      const dataValida = !isNaN(dataFormatada.getTime());
      return `
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
          <span style="background:#eee; color:#555; padding:5px 10px; border-radius:20px; font-size:13px; font-weight: 500;">
            Vencimento ${index + 1}
          </span>
          <span>${dataValida ? formatarData(dataFormatada) : 'Data inválida'}</span>
          <input type="text" value="${(totalVenda / (pedido.prazos_pagamento.length || 1)).toFixed(2)}" style="width: 100px; padding: 3px 8px; border-radius: 4px; border: 1px solid #ccc;" id="input-venc-${id}-${index}" />
          <button type="button" style="background: #28a745; border: none; color: white; border-radius: 4px; padding: 4px 8px; cursor: pointer;" onclick="confirmarValorVencimento(${id}, ${index})">
            ✓
          </button>
        </div>
      `;
    }).join('');

    containerCinza.innerHTML = `
      <p style="margin-bottom: 10px;"><strong>Código Interno do Pedido:</strong> ${pedido.codigo_interno || '—'}</p>
      ${vencimentosHTML}
      <p style="margin-bottom: 10px;"><strong>Valor Total da Venda:</strong> R$ ${totalVenda.toFixed(2)}</p>
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
      cardMaterial.className = 'material-bloco';
      cardMaterial.style.background = '#f5f5f5';
      cardMaterial.style.border = '1px dashed #ccc';
      cardMaterial.style.borderRadius = '8px';
      cardMaterial.style.padding = '16px';
      cardMaterial.style.marginBottom = '16px';

      let descontosHTML = '';
      if (item.descontos && item.descontos.length > 0) {
        descontosHTML = `
          <div class="descontos-aplicados">
            <p>Descontos Aplicados:</p>
            <ul>
              ${item.descontos.map(desc => `
                <li>${desc.motivo}: ${desc.quantidade} UNIDADES (-${desc.peso_calculado.toFixed(2)} Kg)</li>
              `).join('')}
            </ul>
          </div>
        `;
      }

      cardMaterial.innerHTML = `
        <p><strong>MATERIAL: ${item.nome_produto}</strong></p>
        <p>Peso Carregado: ${item.quantidade || item.peso_carregado || '—'} kg</p>
        <p>Valor do Item: R$ ${!isNaN(item.valor_total) ? Number(item.valor_total).toFixed(2) : '—'}</p>
        ${descontosHTML}
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
}

async function confirmarFinanceiro(pedidoId, observacoes) {
  try {
    // Aqui você pode capturar os valores dos vencimentos editados para enviar ao backend
    const vencimentosElementos = document.querySelectorAll(`[id^="input-venc-${pedidoId}-"]`);
    const valoresVencimentos = [];
    vencimentosElementos.forEach((input, idx) => {
      valoresVencimentos[idx] = input.value;
    });

    // Aqui você pode montar o corpo da requisição para incluir os valores editados,
    // além das observações, e enviar para o backend. Vou enviar só as observações por enquanto.

    const res = await fetch(`/api/pedidos/${pedidoId}/financeiro`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ observacoes_financeiro: observacoes /*, valoresVencimentos */ })
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

function capitalizeEmpresa(nome) {
  if (!nome) return '';
  // Ajusta para o texto esperado, só exemplos possíveis, pode expandir aqui
  if (nome.toLowerCase() === 'mellicz') return 'Mellicz Ambiental';
  if (nome.toLowerCase() === 'pronasa') return 'Pronasa';
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

document.addEventListener('DOMContentLoaded', () => {
  carregarPedidosFinanceiro();
  document.getElementById('filtro-cliente')?.addEventListener('input', carregarPedidosFinanceiro);
  document.getElementById('ordenar')?.addEventListener('change', carregarPedidosFinanceiro);
});
