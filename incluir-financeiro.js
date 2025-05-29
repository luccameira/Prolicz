function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR');
}

function formatarEmpresa(nomeEmpresa) {
  if (!nomeEmpresa) return '—';
  const nome = nomeEmpresa.toLowerCase();
  if (nome === 'mellicz') return 'Mellicz Ambiental';
  if (nome === 'pronasa') return 'Pronasa';
  // Caso queira outros nomes, pode adicionar aqui
  return nomeEmpresa.charAt(0).toUpperCase() + nomeEmpresa.slice(1);
}

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

    // Header com cliente e empresa formatada
    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `
      <div class="info">
        <h3>${pedido.cliente}</h3>
        <p>Empresa: ${formatarEmpresa(pedido.empresa)}</p>
      </div>
      <div class="status-badge status-amarelo">
        <i class="fa fa-money-bill"></i> ${pedido.status}
      </div>
    `;
    card.appendChild(header);

    // Formulário escondido
    const form = document.createElement('div');
    form.className = 'formulario';
    form.style.display = 'none';

    // Container cinza com código interno, valor total, vencimentos editáveis e observações
    const containerCinza = document.createElement('div');
    containerCinza.style.background = '#f8f9fa';
    containerCinza.style.padding = '20px';
    containerCinza.style.borderRadius = '8px';
    containerCinza.style.marginBottom = '20px';

    // Total da venda
    const totalVenda = (pedido.materiais || []).reduce((soma, item) => {
      return soma + (Number(item.valor_total) || 0);
    }, 0);

    // Monta a área de vencimentos com inputs e botão confirmar
    const vencimentosContainer = document.createElement('div');

    pedido.vencimentosValores = []; // para armazenar os valores confirmados por vencimento

    pedido.prazos_pagamento = pedido.prazos_pagamento || []; // proteção

    pedido.prazos_pagamento.forEach((dataVencimentoISO, index) => {
      const dataVencimento = new Date(dataVencimentoISO);
      const dataValida = !isNaN(dataVencimento.getTime());
      const valorSugerido = totalVenda / pedido.prazos_pagamento.length;

      // Criar div para cada vencimento
      const vencimentoDiv = document.createElement('div');
      vencimentoDiv.style.display = 'flex';
      vencimentoDiv.style.alignItems = 'center';
      vencimentoDiv.style.marginBottom = '6px';
      vencimentoDiv.style.gap = '8px';

      // Label Vencimento 1, 2...
      const label = document.createElement('span');
      label.style.background = '#eee';
      label.style.color = '#555';
      label.style.padding = '5px 10px';
      label.style.borderRadius = '20px';
      label.style.fontSize = '13px';
      label.style.fontWeight = '500';
      label.textContent = `Vencimento ${index + 1}`;

      // Data do vencimento
      const spanData = document.createElement('span');
      spanData.style.minWidth = '105px';
      spanData.textContent = dataValida ? formatarData(dataVencimento) : 'Data inválida';

      // Input valor editável
      const inputValor = document.createElement('input');
      inputValor.type = 'text';
      inputValor.value = valorSugerido.toFixed(2).replace('.', ',');
      inputValor.style.width = '80px';
      inputValor.style.padding = '4px 8px';
      inputValor.style.border = '1px solid #ccc';
      inputValor.style.borderRadius = '4px';
      inputValor.style.textAlign = 'right';
      inputValor.pattern = '^[0-9]+([,\\.][0-9]{1,2})?$';
      inputValor.title = 'Digite um valor válido';

      // Botão confirmar
      const btnConfirmar = document.createElement('button');
      btnConfirmar.type = 'button';
      btnConfirmar.textContent = '✓';
      btnConfirmar.title = 'Confirmar valor';
      btnConfirmar.style.backgroundColor = '#28a745';
      btnConfirmar.style.color = 'white';
      btnConfirmar.style.border = 'none';
      btnConfirmar.style.borderRadius = '4px';
      btnConfirmar.style.padding = '5px 10px';
      btnConfirmar.style.cursor = 'pointer';

      // Evento botão confirmar: valida valor e salva no array pedido.vencimentosValores
      btnConfirmar.onclick = () => {
        let val = inputValor.value.replace(',', '.').trim();
        const valNum = parseFloat(val);
        if (isNaN(valNum) || valNum < 0) {
          alert('Por favor, digite um valor válido maior ou igual a zero.');
          inputValor.focus();
          return;
        }
        pedido.vencimentosValores[index] = valNum;
        btnConfirmar.textContent = '✓';
        btnConfirmar.style.backgroundColor = '#28a745';
        alert(`Valor do vencimento ${index + 1} confirmado: R$ ${valNum.toFixed(2)}`);
      };

      vencimentoDiv.appendChild(label);
      vencimentoDiv.appendChild(spanData);
      vencimentoDiv.appendChild(inputValor);
      vencimentoDiv.appendChild(btnConfirmar);

      vencimentosContainer.appendChild(vencimentoDiv);
    });

    // Monta o HTML do container cinza, com código interno, total, vencimentos e observações
    containerCinza.innerHTML = `
      <p style="margin-bottom: 10px;"><strong>Código Interno do Pedido:</strong> ${pedido.codigo_interno || '—'}</p>
      <p style="margin-bottom: 10px;"><strong>Valor Total da Venda:</strong> R$ ${totalVenda.toFixed(2)}</p>
    `;
    containerCinza.appendChild(vencimentosContainer);

    // Observações
    const observacoesDiv = document.createElement('div');
    observacoesDiv.style.background = '#fff3cd';
    observacoesDiv.style.padding = '10px';
    observacoesDiv.style.borderRadius = '6px';
    observacoesDiv.style.marginTop = '20px';
    observacoesDiv.innerHTML = `<strong>Observações:</strong> ${pedido.observacoes || '—'}`;
    containerCinza.appendChild(observacoesDiv);

    form.appendChild(containerCinza);

    // Título Materiais da Venda
    const tituloMateriais = document.createElement('h4');
    tituloMateriais.textContent = 'Materiais da Venda';
    tituloMateriais.style.margin = '30px 0 10px';
    form.appendChild(tituloMateriais);

    // Materiais e descontos no estilo conferência
    (pedido.materiais || []).forEach(item => {
      const cardMaterial = document.createElement('div');
      cardMaterial.className = 'material-bloco'; // Para aplicar o CSS do print

      let descontosHTML = '';
      if (item.descontos && item.descontos.length > 0) {
        descontosHTML = `
          <div class="descontos-aplicados">
            <p>Descontos Aplicados:</p>
            <ul>
              ${item.descontos.map(desc => `
                <li>${desc.motivo}: ${desc.quantidade} UNIDADES (${parseFloat(desc.peso_calculado).toFixed(2)} Kg)</li>
              `).join('')}
            </ul>
          </div>
        `;
      }

      cardMaterial.innerHTML = `
        <p><strong>MATERIAL: ${item.nome_produto}</strong></p>
        <p>Peso Carregado: ${item.peso_carregado || item.quantidade || '—'} kg</p>
        <p>Valor do Item: R$ ${!isNaN(item.valor_total) ? Number(item.valor_total).toFixed(2) : '—'}</p>
        ${descontosHTML}
      `;
      form.appendChild(cardMaterial);
    });

    // Observações do Financeiro
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

    // Botão confirmar liberação
    const btnContainer = document.createElement('div');
    btnContainer.style.marginTop = '20px';

    const botao = document.createElement('button');
    botao.textContent = 'Confirmar Liberação do Cliente';
    botao.className = 'btn btn-registrar';
    botao.onclick = () => {
      // Aqui deve coletar os valores confirmados de vencimentos para enviar ao backend,
      // por enquanto, só enviando as observações
      confirmarFinanceiro(id, textareaObs.value);
    };
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
