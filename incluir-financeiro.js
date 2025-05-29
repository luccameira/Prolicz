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

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
      if (item.descontos?.length) {
        totalDescontosKg = item.descontos.reduce(
          (s, d) => s + Number(d.peso_calculado || 0),
          0
        );
      }
      const pesoFinalNum = (Number(item.peso_carregado) || 0) - totalDescontosKg;
      const pesoFinal = formatarPesoSemDecimal(pesoFinalNum);

      const valorUnitarioNum = Number(item.valor_unitario) || 0;
      const valorTotalCalc = pesoFinalNum * valorUnitarioNum;
      const valorTotalFormatado = valorTotalCalc.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });

      let descontosHTML = '';
      if (item.descontos?.length) {
        descontosHTML = `
          <div class="descontos-aplicados" style="margin-top: 14px;">
            <p><i class="fa fa-tags"></i> Descontos Aplicados:</p>
            <ul>
              ${item.descontos
                .map(d => `
                  <li>${formatarPesoSemDecimal(d.quantidade)} ${
                  d.motivo.includes('Palete') ? 'UNIDADES' : 'Kg'
                } (${formatarPesoSemDecimal(d.peso_calculado)} Kg)</li>
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
        <p style="margin-top: 8px;"><strong>Valor Total do Item:</strong> <span class="etiqueta-peso-final">${valorTotalFormatado}</span></p>
      `;
      form.appendChild(cardMaterial);
    });

    // 2) Código interno, total da venda, vencimentos e observações do pedido
    const containerCinza = document.createElement('div');
    containerCinza.style.background = '#f8f9fa';
    containerCinza.style.padding = '20px';
    containerCinza.style.borderRadius = '8px';
    containerCinza.style.marginTop = '20px';

    const totalVenda = (pedido.materiais || []).reduce((soma, item) => {
      let desc = 0;
      if (item.descontos?.length) {
        desc = item.descontos.reduce((sm, d) => sm + Number(d.peso_calculado || 0), 0);
      }
      const pf = (Number(item.peso_carregado) || 0) - desc;
      return soma + pf * (Number(item.valor_unitario) || 0);
    }, 0);

    containerCinza.innerHTML = `
      <p style="margin-bottom: 10px;"><strong>Código Interno do Pedido:</strong> ${
        pedido.codigo_interno || '—'
      }</p>
      <p style="margin-bottom: 10px;"><strong>Valor Total da Venda:</strong> R$ ${totalVenda.toFixed(2)}</p>
    `;

    // Observações do pedido (vendedor)
    const obsPedidoDiv = document.createElement('div');
    obsPedidoDiv.style.background = '#fff3cd';
    obsPedidoDiv.style.padding = '10px';
    obsPedidoDiv.style.borderRadius = '6px';
    obsPedidoDiv.style.marginTop = '20px';
    obsPedidoDiv.innerHTML = `<strong>Observações:</strong> ${pedido.observacoes || '—'}`;
    containerCinza.appendChild(obsPedidoDiv);

    // Vencimentos
    const vencContainer = document.createElement('div');
    pedido.vencimentosValores = [];
    pedido.prazos_pagamento = pedido.prazos_pagamento || [];

    pedido.prazos_pagamento.forEach((iso, i) => {
      const dt = new Date(iso);
      const ok = !isNaN(dt.getTime());
      const valSug = totalVenda / pedido.prazos_pagamento.length;

      const dv = document.createElement('div');
      dv.style.display = 'flex';
      dv.style.alignItems = 'center';
      dv.style.marginBottom = '6px';
      dv.style.gap = '8px';

      const lb = document.createElement('span');
      lb.style.background = '#eee';
      lb.style.color = '#555';
      lb.style.padding = '5px 10px';
      lb.style.borderRadius = '20px';
      lb.style.fontSize = '13px';
      lb.style.fontWeight = '500';
      lb.textContent = `Vencimento ${i + 1}`;

      const sp = document.createElement('span');
      sp.style.minWidth = '105px';
      sp.textContent = ok ? formatarData(dt) : 'Data inválida';

      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = valSug.toFixed(2).replace('.', ',');
      inp.style.width = '80px';
      inp.style.padding = '4px 8px';
      inp.style.border = '1px solid #ccc';
      inp.style.borderRadius = '4px';
      inp.style.textAlign = 'right';

      const bt = document.createElement('button');
      bt.type = 'button';
      bt.innerHTML = '✓';
      bt.style.backgroundColor = '#28a745';
      bt.style.color = 'white';
      bt.style.border = 'none';
      bt.style.borderRadius = '4px';
      bt.style.padding = '5px 10px';
      bt.style.cursor = 'pointer';
      bt.onclick = () => {
        const v = parseFloat(inp.value.replace(',', '.'));
        if (isNaN(v) || v < 0) {
          alert('Digite um valor válido.');
          inp.focus();
          return;
        }
        pedido.vencimentosValores[i] = v;
        bt.innerHTML = '✓';
      };

      dv.append(lb, sp, inp, bt);
      vencContainer.appendChild(dv);
    });

    containerCinza.appendChild(vencContainer);
    form.appendChild(containerCinza);

    // 3) Observações do Financeiro e botão
    const blocoFin = document.createElement('div');
    blocoFin.style.marginTop = '20px';

    const lblFin = document.createElement('label');
    lblFin.textContent = 'Observações do Financeiro:';
    lblFin.style.display = 'block';
    lblFin.style.marginBottom = '6px';
    lblFin.style.fontWeight = '500';

    const taFin = document.createElement('textarea');
    taFin.placeholder = 'Digite suas observações aqui...';
    taFin.style.width = '100%';
    taFin.style.padding = '10px';
    taFin.style.border = '1px solid #ccc';
    taFin.style.borderRadius = '6px';
    taFin.style.fontSize = '14px';
    taFin.style.minHeight = '80px';

    const btnWrap = document.createElement('div');
    btnWrap.style.marginTop = '20px';

    const btnFin = document.createElement('button');
    btnFin.textContent = 'Confirmar Liberação do Cliente';
    btnFin.className = 'btn btn-registrar';
    btnFin.onclick = () => confirmarFinanceiro(id, taFin.value);

    blocoFin.append(lblFin, taFin, btnWrap.appendChild(btnFin));
    form.appendChild(blocoFin);

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
