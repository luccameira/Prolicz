// incluir-financeiro.js

function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR');
}

function formatarEmpresa(nomeEmpresa) {
  if (!nomeEmpresa) return '—';
  const nome = nomeEmpresa.toLowerCase();
  if (nome === 'mellicz') return 'Mellicz Ambiental';
  if (nome === 'pronasa') return 'Pronasa';
  return nomeEmpresa.charAt(0).toUpperCase() + nomeEmpresa.slice(1);
}

function formatarPesoSemDecimal(valor) {
  if (valor == null) return '—';
  const numero = Number(valor);
  if (Number.isInteger(numero)) return numero.toString();
  return numero.toFixed(2).replace('.', ',');
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
    document.getElementById('lista-pedidos').innerHTML =
      "<p style='padding: 0 25px;'>Erro ao carregar tarefas financeiras.</p>";
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

    // Header
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

    // Form oculto
    const form = document.createElement('div');
    form.className = 'formulario';
    form.style.display = 'none';

    // 1) Materiais da Venda
    const tituloMateriais = document.createElement('h4');
    tituloMateriais.textContent = 'Materiais da Venda';
    tituloMateriais.style.margin = '30px 0 10px';
    form.appendChild(tituloMateriais);

    (pedido.materiais || []).forEach(item => {
      const cardMaterial = document.createElement('div');
      cardMaterial.className = 'material-bloco';

      const tipoPeso = item.tipo_peso === 'Aproximado' ? 'Aproximado' : 'Exato';
      const pesoPrevisto = formatarPesoSemDecimal(item.quantidade);
      const pesoCarregado = formatarPesoSemDecimal(item.peso_carregado);

      let totalDescontosKg = 0;
      if (item.descontos && item.descontos.length > 0) {
        totalDescontosKg = item.descontos.reduce(
          (soma, desc) => soma + Number(desc.peso_calculado || 0),
          0
        );
      }
      const pesoFinalNum = (Number(item.peso_carregado) || 0) - totalDescontosKg;
      const pesoFinal = formatarPesoSemDecimal(pesoFinalNum);

      // Calcular valor total do item
      const valorUnitarioNum = Number(item.valor_unitario) || 0;
      const valorTotalCalculado = pesoFinalNum * valorUnitarioNum;
      const valorTotalFormatado = valorTotalCalculado.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });

      let descontosHTML = '';
      if (item.descontos && item.descontos.length > 0) {
        descontosHTML = `
          <div class="descontos-aplicados" style="margin-top: 14px;">
            <p><i class="fa fa-tags"></i> Descontos Aplicados:</p>
            <ul>
              ${item.descontos
                .map(desc => `
                <li>${formatarPesoSemDecimal(desc.quantidade)} ${
                  desc.motivo.includes('Palete') ? 'UNIDADES' : 'Kg'
                } (${formatarPesoSemDecimal(desc.peso_calculado)} Kg)</li>
              `)
                .join('')}
            </ul>
          </div>
        `;
      }

      cardMaterial.innerHTML = `
        <h4>${item.nome_produto}</h4>
        <p><strong>Peso Previsto para Carregamento (${tipoPeso}):</strong> ${pesoPrevisto} kg</p>
        <p><strong>Peso Registrado na Carga:</strong> ${pesoCarregado} kg</p>
        ${descontosHTML}
        <p style="margin-top: 14px;"><strong>Peso Final com Desconto:</strong> ${pesoFinal} kg</p>
        <p><strong>Valor Total do Item:</strong> <span class="etiqueta-peso-final">${valorTotalFormatado}</span></p>
      `;

      form.appendChild(cardMaterial);
    });

    // 2) Código interno, vencimentos e observações
    const containerCinza = document.createElement('div');
    containerCinza.style.background = '#f8f9fa';
    containerCinza.style.padding = '20px';
    containerCinza.style.borderRadius = '8px';
    containerCinza.style.marginTop = '20px';

    // Recalcular totalVenda pelo peso final
    const totalVenda = (pedido.materiais || []).reduce((soma, item) => {
      let desconto = 0;
      if (item.descontos && item.descontos.length > 0) {
        desconto = item.descontos.reduce(
          (sum, d) => sum + Number(d.peso_calculado || 0),
          0
        );
      }
      const pesoFinalItem = (Number(item.peso_carregado) || 0) - desconto;
      return soma + pesoFinalItem * (Number(item.valor_unitario) || 0);
    }, 0);

    containerCinza.innerHTML = `
      <p style="margin-bottom: 10px;"><strong>Código Interno do Pedido:</strong> ${
        pedido.codigo_interno || '—'
      }</p>
      <p style="margin-bottom: 10px;"><strong>Valor Total da Venda:</strong> R$ ${totalVenda.toFixed(
      2
    )}</p>
    `;

    // Vencimentos baseado no totalVenda recalculado
    const vencimentosContainer = document.createElement('div');
    pedido.vencimentosValores = [];
    pedido.prazos_pagamento = pedido.prazos_pagamento || [];

    pedido.prazos_pagamento.forEach((dataISO, idx) => {
      const dataVenc = new Date(dataISO);
      const ok = !isNaN(dataVenc.getTime());
      const valorSug = totalVenda / pedido.prazos_pagamento.length;

      const divV = document.createElement('div');
      divV.style.display = 'flex';
      divV.style.alignItems = 'center';
      divV.style.marginBottom = '6px';
      divV.style.gap = '8px';

      const lbl = document.createElement('span');
      lbl.style.background = '#eee';
      lbl.style.color = '#555';
      lbl.style.padding = '5px 10px';
      lbl.style.borderRadius = '20px';
      lbl.style.fontSize = '13px';
      lbl.style.fontWeight = '500';
      lbl.textContent = `Vencimento ${idx + 1}`;

      const spanD = document.createElement('span');
      spanD.style.minWidth = '105px';
      spanD.textContent = ok ? formatarData(dataVenc) : 'Data inválida';

      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = valorSug.toFixed(2).replace('.', ',');
      inp.style.width = '80px';
      inp.style.padding = '4px 8px';
      inp.style.border = '1px solid #ccc';
      inp.style.borderRadius = '4px';
      inp.style.textAlign = 'right';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = '✓';
      btn.style.backgroundColor = '#28a745';
      btn.style.color = 'white';
      btn.style.border = 'none';
      btn.style.borderRadius = '4px';
      btn.style.padding = '5px 10px';
      btn.style.cursor = 'pointer';
      btn.onclick = () => {
        const v = parseFloat(inp.value.replace(',', '.'));
        if (isNaN(v) || v < 0) {
          alert('Digite um valor válido.');
          inp.focus();
          return;
        }
        pedido.vencimentosValores[idx] = v;
        btn.innerHTML = '✓';
      };

      divV.append(lbl, spanD, inp, btn);
      vencimentosContainer.appendChild(divV);
    });

    containerCinza.appendChild(vencimentosContainer);

    // Observações
    const obsDiv = document.createElement('div');
    obsDiv.style.background = '#fff3cd';
    obsDiv.style.padding = '10px';
    obsDiv.style.borderRadius = '6px';
    obsDiv.style.marginTop = '20px';
    obsDiv.innerHTML = `<strong>Observações:</strong> ${pedido.observacoes || '—'}`;
    containerCinza.appendChild(obsDiv);

    form.appendChild(containerCinza);

    // 3) Botão de confirmação
    const btnCont = document.createElement('div');
    btnCont.style.marginTop = '20px';

    const botao = document.createElement('button');
    botao.textContent = 'Confirmar Liberação do Cliente';
    botao.className = 'btn btn-registrar';
    botao.onclick = () => confirmarFinanceiro(id, obsDiv.textContent);
    btnCont.appendChild(botao);

    form.appendChild(btnCont);
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
  } catch (err) {
    console.error('Erro ao confirmar liberação:', err);
    alert('Erro de comunicação com o servidor.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  carregarPedidosFinanceiro();
  document.getElementById('filtro-cliente')?.addEventListener('input', carregarPedidosFinanceiro);
  document.getElementById('ordenar')?.addEventListener('change', carregarPedidosFinanceiro);
});
