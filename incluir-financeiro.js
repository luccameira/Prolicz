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
      `<p style="padding: 0 25px;">Erro ao carregar tarefas financeiras.</p>`;
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
    lista.innerHTML = `<p style="padding: 0 25px;">Nenhum pedido disponível no momento.</p>`;
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

    // Formulário oculto
    const form = document.createElement('div');
    form.className = 'formulario';
    form.style.display = 'none';

    // ---- blocos de materiais ----
    (pedido.materiais || []).forEach(item => {
      const cardMaterial = document.createElement('div');
      cardMaterial.className = 'material-bloco';

      // Preparar dados
      const tipoPeso = item.tipo_peso === 'Aproximado' ? 'Aproximado' : 'Exato';
      const pesoPrevisto = formatarPesoSemDecimal(item.quantidade);
      const pesoCarregado = formatarPesoSemDecimal(item.peso_carregado);

      let totalDescontosKg = 0;
      if (item.descontos?.length) {
        totalDescontosKg = item.descontos.reduce(
          (sum, d) => sum + Number(d.peso_calculado || 0),
          0
        );
      }
      const pesoFinalNum = (Number(item.peso_carregado) || 0) - totalDescontosKg;
      const pesoFinal = formatarPesoSemDecimal(pesoFinalNum);

      const valorUnitarioNum = Number(item.valor_unitario) || 0;
      const valorUnitarioFmt = formatarMoeda(valorUnitarioNum);
      const valorTotalCalc = pesoFinalNum * valorUnitarioNum;
      const valorTotalFmt = formatarMoeda(valorTotalCalc);

      // Descontos HTML
      let descontosHTML = '';
      if (item.descontos?.length) {
        descontosHTML = `
          <div class="descontos-aplicados" style="margin-top: 16px;">
            <p><i class="fa fa-tags"></i> Descontos Aplicados:</p>
            <ul>
              ${item.descontos
                .map(d => `
                  <li>${formatarPesoSemDecimal(d.quantidade)} ${d.motivo.includes('Palete') ? 'UNIDADES' : 'Kg'} (${formatarPesoSemDecimal(d.peso_calculado)} Kg)</li>
                `)
                .join('')}
            </ul>
          </div>
        `;
      }

      // Montar bloco
      cardMaterial.innerHTML = `
        <h4>${item.nome_produto} (${valorUnitarioFmt}/Kg)</h4>
        <p>Peso Previsto para Carregamento (${tipoPeso}): ${pesoPrevisto} Kg</p>
        <p>Peso Registrado na Carga: ${pesoCarregado} Kg</p>
        ${descontosHTML}
        <p style="margin-top: 16px;"><strong>Peso Final com Desconto:</strong> ${pesoFinal} Kg</p>
        <p style="margin-top: 12px;"><strong>Valor Total do Item:</strong> <span class="etiqueta-valor-item">${valorTotalFmt}</span></p>
      `;
      form.appendChild(cardMaterial);
    });

    // ---- separador visual ----
    const separador = document.createElement('div');
    separador.className = 'divider-financeiro';
    form.appendChild(separador);

    // ---- resumo financeiro ----
    const containerCinza = document.createElement('div');
    containerCinza.className = 'resumo-financeiro';

    // Calcular total da venda
    const totalVenda = (pedido.materiais || []).reduce((sum, item) => {
      let dkg = 0;
      if (item.descontos?.length) {
        dkg = item.descontos.reduce((s, d) => s + Number(d.peso_calculado || 0), 0);
      }
      const pf = (Number(item.peso_carregado) || 0) - dkg;
      return sum + pf * (Number(item.valor_unitario) || 0);
    }, 0);
    const totalVendaFmt = formatarMoeda(totalVenda);

    containerCinza.innerHTML = `
      <p><strong>Código Interno do Pedido:</strong> ${pedido.codigo_interno || '—'}</p>
      <p><strong>Valor Total da Venda:</strong> ${totalVendaFmt}</p>
      <div class="obs-pedido"><strong>Observações:</strong> ${pedido.observacoes || '—'}</div>
      <div class="vencimentos-container"></div>
    `;

    // ---- vencimentos com máscara ----
    const vencContainer = containerCinza.querySelector('.vencimentos-container');
    (pedido.prazos_pagamento || []).forEach((iso, i) => {
      const dt = new Date(iso);
      const ok = !isNaN(dt.getTime());
      const valorSug = totalVenda / (pedido.prazos_pagamento.length || 1);

      const row = document.createElement('div');
      row.className = 'vencimento-row';
      row.innerHTML = `
        <span class="venc-label">Vencimento ${i + 1}</span>
        <span class="venc-data">${ok ? formatarData(dt) : 'Data inválida'}</span>
        <input type="text" value="${valorSug.toFixed(2).replace('.', ',')}" />
        <button type="button">✓</button>
      `;

      const inp = row.querySelector('input');
      const btn = row.querySelector('button');

      // Máscara ao perder foco
      inp.addEventListener('blur', () => {
        const raw = inp.value.replace(/\./g, '').replace(',', '.');
        const num = parseFloat(raw);
        if (!isNaN(num)) {
          inp.value = num.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });
        } else {
          inp.value = '';
        }
      });

      // Confirmar valor
      btn.addEventListener('click', () => {
        const raw = inp.value.replace(/\./g, '').replace(',', '.');
        const num = parseFloat(raw);
        if (isNaN(num) || num < 0) {
          alert('Digite um valor válido.');
          inp.focus();
          return;
        }
        pedido.vencimentosValores = pedido.vencimentosValores || [];
        pedido.vencimentosValores[i] = num;
      });

      vencContainer.appendChild(row);
    });

    form.appendChild(containerCinza);

    // ---- Observações do Financeiro e botão ----
    const blocoFin = document.createElement('div');
    blocoFin.className = 'bloco-fin';
    blocoFin.innerHTML = `
      <label>Observações do Financeiro:</label>
      <textarea placeholder="Digite suas observações aqui..."></textarea>
      <button class="btn btn-registrar">Confirmar Liberação do Cliente</button>
    `;
    const taFin = blocoFin.querySelector('textarea');
    const btnFin = blocoFin.querySelector('button');
    btnFin.addEventListener('click', () => confirmarFinanceiro(id, taFin.value));
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
    if (res.ok) {
      alert('Cliente liberado com sucesso!');
      carregarPedidosFinanceiro();
    } else {
      const data = await res.json();
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
