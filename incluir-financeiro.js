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

function calcularValoresFiscais(item) {
  const valorUnitario = Number(item.valor_unitario) || 0;
  let valorComNota = 0;
  let valorSemNota = 0;
  let tipoCodigo = (item.codigo_fiscal || '').toUpperCase();

  if (tipoCodigo === "PERSONALIZAR" && item.valor_com_nota != null && item.valor_sem_nota != null) {
    valorComNota = Number(item.valor_com_nota);
    valorSemNota = Number(item.valor_sem_nota);
  } else if (tipoCodigo.endsWith("1")) {
    valorComNota = valorUnitario;
    valorSemNota = 0;
  } else if (tipoCodigo.endsWith("2")) {
    valorComNota = valorUnitario / 2;
    valorSemNota = valorUnitario / 2;
  } else if (tipoCodigo.endsWith("X")) {
    valorComNota = 0;
    valorSemNota = valorUnitario;
  } else {
    valorComNota = valorUnitario;
    valorSemNota = 0;
  }
  return { valorComNota, valorSemNota };
}

async function carregarPedidosFinanceiro() {
  const [resPendentes, resAnteriores] = await Promise.all([
    fetch('/api/pedidos?status=Em%20An%C3%A1lise%20pelo%20Financeiro'),
    fetch('/api/pedidos?status=Aguardando%20Confer%C3%AAncia%20do%20Peso')
  ]);
  let pedidos = [];
  try {
    pedidos = [...await resPendentes.json(), ...await resAnteriores.json()];
    if (!Array.isArray(pedidos)) throw new Error('Resposta inválida');
  } catch (erro) {
    console.error('Erro ao carregar pedidos:', erro);
    document.getElementById('lista-pedidos').innerHTML =
      `<p style="padding:0 25px;">Erro ao carregar tarefas financeiras.</p>`;
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
    lista.innerHTML = `<p style="padding:0 25px;">Nenhum pedido disponível no momento.</p>`;
    return;
  }

  filtrados.forEach(pedido => {
    const id = pedido.pedido_id || pedido.id;
    const card = document.createElement('div');
    card.className = 'card';

    const timelineElement = gerarLinhaTempoCompleta(pedido);
    animarLinhaProgresso(timelineElement);
    card.appendChild(timelineElement);

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

    const form = document.createElement('div');
    form.className = 'formulario';
    form.style.display = 'none';

    pedido.materiais?.forEach(item => {
      const bloco = document.createElement('div');
      bloco.className = 'material-bloco';

      const tipoPeso = item.tipo_peso === 'Aproximado' ? 'Aproximado' : 'Exato';
      const pesoPrevisto = formatarPesoSemDecimal(item.quantidade);
      const pesoCarregado = formatarPesoSemDecimal(item.peso_carregado);
      let descontosKg = 0;
      if (item.descontos?.length) {
        descontosKg = item.descontos.reduce((sum, d) => sum + Number(d.peso_calculado || 0), 0);
      }
      const pesoFinalNum = (Number(item.peso_carregado) || 0) - descontosKg;
      const pesoFinal = formatarPesoSemDecimal(pesoFinalNum);

      bloco.innerHTML = `
        <h4>${item.nome_produto} (${formatarMoeda(Number(item.valor_unitario))}/Kg)</h4>
        <p>Peso Previsto para Carregamento (${tipoPeso}): ${pesoPrevisto} Kg</p>
        <p>Peso Registrado na Carga: ${pesoCarregado} Kg</p>
        ${item.descontos?.length ? `
          <div class="descontos-aplicados">
            <p><i class="fa fa-tags"></i> Descontos Aplicados:</p>
            <ul>
              ${item.descontos.map(d =>
                `<li>${d.motivo}: ${formatarPesoSemDecimal(d.quantidade)} UNIDADES (${formatarPesoSemDecimal(d.peso_calculado)} Kg)</li>`
              ).join('')}
            </ul>
          </div>
        ` : ''}
        <p style="margin-top:16px;"><strong>Peso Final com Desconto:</strong> ${pesoFinal} Kg</p>
        <div style="margin-top:12px; margin-bottom:4px;">
          <strong>Valor Total do Item:</strong>
          <span style="color: green;">${formatarMoeda((Number(pesoFinalNum) || 0) * (Number(item.valor_unitario) || 0))}</span>
        </div>
      `;
      form.appendChild(bloco);
    });

    const separador = document.createElement('div');
    separador.className = 'divider-financeiro';
    form.appendChild(separador);

      // resumo financeiro
    const containerCinza = document.createElement('div');
    containerCinza.className = 'resumo-financeiro';

    let totalComNota = 0;
    let totalSemNota = 0;
    let codigosFiscaisBarraAzul = '';
    if (pedido.materiais && pedido.materiais.length) {
      codigosFiscaisBarraAzul = pedido.materiais.map(item => {
        const { valorComNota, valorSemNota } = calcularValoresFiscais(item);
        let cod = (item.codigo_fiscal || '').toUpperCase();
        if (!cod) cod = '(não informado)';
        if (cod === "PERSONALIZAR") cod = "Personalizado";
        const nomeProduto = item.nome_produto ? ` (${item.nome_produto})` : '';
        let descontosKg = 0;
        if (item.descontos?.length) {
          descontosKg = item.descontos.reduce((sum, d) => sum + Number(d.peso_calculado || 0), 0);
        }
        const pesoFinalNum = (Number(item.peso_carregado) || 0) - descontosKg;
        const totalCom = pesoFinalNum * valorComNota;
        const totalSem = pesoFinalNum * valorSemNota;
        totalComNota += totalCom;
        totalSemNota += totalSem;

        return `
          <div style="background:#eef2f7;padding:8px 16px 8px 10px; border-radius:6px; margin-top:8px; margin-bottom:2px; font-size:15px; color:#1e2637; font-weight:600;">
            <span class="etiqueta-codigo-fiscal">
              <strong>Código Fiscal: ${cod}</strong> |
              <strong>Com nota:</strong> ${formatarMoeda(valorComNota)}/kg |
              <strong>Sem nota:</strong> ${formatarMoeda(valorSemNota)}/kg |
              <i class="fa fa-file-invoice"></i> <strong>Total com nota:</strong> <span style="color:#225c20">${formatarMoeda(totalCom)}</span> |
              <i class="fa fa-ban"></i> <strong>Total sem nota:</strong> <span style="color:#b12e2e">${formatarMoeda(totalSem)}</span>
              <span style="margin-left:10px;color:#777;font-size:14px;">${nomeProduto}</span>
            </span>
          </div>
        `;
      }).join('');
    }

    const totalVenda = totalComNota + totalSemNota;
    const totalVendaFmt = formatarMoeda(totalVenda);

    containerCinza.innerHTML = `
      <p><strong>Valor Total da Venda:</strong> <span class="etiqueta-valor-item">${totalVendaFmt}</span></p>
      ${codigosFiscaisBarraAzul}
      <div class="obs-pedido"><strong>Observações:</strong> ${pedido.observacoes || '—'}</div>
    `;

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

    form.appendChild(containerCinza);
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
