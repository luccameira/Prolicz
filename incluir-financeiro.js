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

    // ---- Materiais da venda ----
    pedido.materiais?.forEach(item => {
      const bloco = document.createElement('div');
      bloco.className = 'material-bloco';

      // dados do item
      const tipoPeso = item.tipo_peso === 'Aproximado' ? 'Aproximado' : 'Exato';
      const pesoPrevisto = formatarPesoSemDecimal(item.quantidade);
      const pesoCarregado = formatarPesoSemDecimal(item.peso_carregado);
      let descontosKg = 0;
      if (item.descontos?.length) {
        descontosKg = item.descontos.reduce((sum, d) => sum + Number(d.peso_calculado || 0), 0);
      }
      const pesoFinalNum = (Number(item.peso_carregado) || 0) - descontosKg;
      const pesoFinal = formatarPesoSemDecimal(pesoFinalNum);

      // descontos aplicados (motivo, quantidade e peso)
      let descontosHTML = '';
      if (item.descontos?.length) {
        descontosHTML = `
          <div class="descontos-aplicados" style="margin-top:16px;">
            <p><i class="fa fa-tags"></i> Descontos Aplicados:</p>
            <ul>
              ${item.descontos.map(d =>
                `<li>${d.motivo}: ${formatarPesoSemDecimal(d.quantidade)} UNIDADES (${formatarPesoSemDecimal(d.peso_calculado)} Kg)</li>`
              ).join('')}
            </ul>
          </div>
        `;
      }

      bloco.innerHTML = `
        <h4>${item.nome_produto} (${formatarMoeda(Number(item.valor_unitario))}/Kg)</h4>
        <p>Peso Previsto para Carregamento (${tipoPeso}): ${pesoPrevisto} Kg</p>
        <p>Peso Registrado na Carga: ${pesoCarregado} Kg</p>
        ${descontosHTML}
        <p style="margin-top:16px;"><strong>Peso Final com Desconto:</strong> ${pesoFinal} Kg</p>
        <div style="margin-top:12px; margin-bottom:4px;">
          <strong>Valor Total do Item:</strong>
          <span style="color: green;">${formatarMoeda((Number(pesoFinalNum) || 0) * (Number(item.valor_unitario) || 0))}</span>
        </div>
      `;
      form.appendChild(bloco);
    });

    // separador visual
    const separador = document.createElement('div');
    separador.className = 'divider-financeiro';
    form.appendChild(separador);

    // resumo financeiro
    const containerCinza = document.createElement('div');
    containerCinza.className = 'resumo-financeiro';

    // --- NOVO BLOCO: códigos fiscais e valores por kg de cada material ---
    let codigosFiscaisResumo = '';
    let totalComNota = 0;
    let totalSemNota = 0;
    if (pedido.materiais && pedido.materiais.length) {
      codigosFiscaisResumo = pedido.materiais.map(item => {
        const { valorComNota, valorSemNota } = calcularValoresFiscais(item);
        let cod = (item.codigo_fiscal || '').toUpperCase();
        if (cod === "PERSONALIZAR") cod = "Personalizado";
        const nomeProduto = item.nome_produto ? ` (${item.nome_produto})` : '';
        // calcula totais
        let descontosKg = 0;
        if (item.descontos?.length) {
          descontosKg = item.descontos.reduce((sum, d) => sum + Number(d.peso_calculado || 0), 0);
        }
        const pesoFinalNum = (Number(item.peso_carregado) || 0) - descontosKg;
        totalComNota += pesoFinalNum * valorComNota;
        totalSemNota += pesoFinalNum * valorSemNota;

        return `
          <div style="margin-bottom:3px;">
            <span class="etiqueta-codigo-fiscal"><strong>Código Fiscal:</strong> ${cod}</span>
            <span style="margin-left:10px;color:#3e4a66;">
              <strong>Com nota:</strong> ${formatarMoeda(valorComNota)}/kg |
              <strong>Sem nota:</strong> ${formatarMoeda(valorSemNota)}/kg
            </span>
            <span style="margin-left:10px;color:#777;font-size:14px;">${nomeProduto}</span>
          </div>
        `;
      }).join('');
    }
    containerCinza.innerHTML = `
      <div style="background:#eef2f7;padding:10px 16px 10px 10px; border-radius:6px; margin-bottom:10px;">
        ${codigosFiscaisResumo}
      </div>
      <div style="background:#f7fbe7;padding:10px 14px; border-radius:6px; margin-bottom:14px;">
        <span style="font-size:16px; color:#353; font-weight:600;">
          Resumo Fiscal do Pedido:
        </span>
        <div style="margin-top:7px; margin-left:10px;">
          <span style="color:#225c20; font-weight:500;">
            <i class="fa fa-file-invoice"></i> Total com nota:
            <span style="font-size:18px;">${formatarMoeda(totalComNota)}</span>
          </span>
          &nbsp;|&nbsp;
          <span style="color:#b12e2e; font-weight:500;">
            <i class="fa fa-ban"></i> Total sem nota:
            <span style="font-size:18px;">${formatarMoeda(totalSemNota)}</span>
          </span>
        </div>
      </div>
      <p><strong>Valor Total da Venda:</strong> <span class="etiqueta-valor-item">${formatarMoeda(totalComNota + totalSemNota)}</span></p>
      <div class="vencimentos-container"></div>
      <p class="venc-soma-error" style="color:red;"></p>
      <div class="obs-pedido"><strong>Observações:</strong> ${pedido.observacoes || '—'}</div>
    `;

    // vencimentos com máscara e confirmação
    const vencContainer = containerCinza.querySelector('.vencimentos-container');
    const inputs = [];
    pedido.prazos_pagamento?.forEach((iso, i) => {
      const dt = new Date(iso);
      const ok = !isNaN(dt.getTime());
      const valorSug = (totalComNota + totalSemNota) / (pedido.prazos_pagamento.length || 1);
      const valorSugFmt = valorSug.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const row = document.createElement('div');
      row.className = 'vencimento-row';
      row.dataset.confirmado = 'false';
      row.innerHTML = `
        <span class="venc-label">Vencimento ${i + 1}</span>
        <span class="venc-data">${ok ? formatarData(dt) : 'Data inválida'}</span>
        <input type="text" value="${valorSugFmt}" />
        <button type="button">✓</button>
      `;

      const inp = row.querySelector('input');
      const btn = row.querySelector('button');
      inputs.push(inp);

      // elemento de confirmação alternável
      const etiquetaConfirmado = document.createElement('span');
      etiquetaConfirmado.className = 'etiqueta-valor-item';
      etiquetaConfirmado.textContent = 'CONFIRMADO';
      etiquetaConfirmado.style.cursor = 'pointer';

      inp.addEventListener('blur', () => {
        const raw = inp.value.replace(/\./g, '').replace(',', '.');
        const num = parseFloat(raw);
        if (!isNaN(num)) {
          inp.value = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        const lastIndex = inputs.length - 1;
        const curIndex = inputs.indexOf(inp);
        if (curIndex !== lastIndex) {
          const somaExcUlt = inputs.slice(0, lastIndex)
            .map(iEl => parseFloat(iEl.value.replace(/\./g, '').replace(',', '.')) || 0)
            .reduce((s, v) => s + v, 0);
          const restante = (totalComNota + totalSemNota) - somaExcUlt;
          let rowErr = row.querySelector('.row-error');
          if (restante < 0) {
            if (!rowErr) {
              rowErr = document.createElement('div');
              rowErr.className = 'row-error';
              rowErr.style.color = 'red';
              rowErr.style.fontSize = '13px';
              rowErr.textContent = 'Parcela excede o valor total da venda.';
              row.appendChild(rowErr);
            }
          } else {
            if (rowErr) row.removeChild(rowErr);
            inputs[lastIndex].value = restante.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
          }
        }
        atualizarBotaoLiberar();
      });

      function toggleConfirmacao() {
        const isConf = row.dataset.confirmado === 'true';
        if (!isConf) {
          const raw = inp.value.replace(/\./g, '').replace(',', '.');
          const num = parseFloat(raw);
          if (isNaN(num) || num < 0) {
            let rowErr = row.querySelector('.row-error');
            if (!rowErr) {
              rowErr = document.createElement('div');
              rowErr.className = 'row-error';
              rowErr.style.color = 'red';
              rowErr.style.fontSize = '13px';
              rowErr.textContent = 'Valor inválido.';
              row.appendChild(rowErr);
            }
            inp.focus();
            return;
          }
          pedido.vencimentosValores = pedido.vencimentosValores || [];
          pedido.vencimentosValores[i] = num;
          row.dataset.confirmado = 'true';
          inp.disabled = true;
          btn.replaceWith(etiquetaConfirmado);
        } else {
          row.dataset.confirmado = 'false';
          inp.disabled = false;
          etiquetaConfirmado.replaceWith(btn);
        }
        atualizarBotaoLiberar();
      }

      btn.addEventListener('click', toggleConfirmacao);
      etiquetaConfirmado.addEventListener('click', toggleConfirmacao);
      vencContainer.appendChild(row);
    });

    form.appendChild(containerCinza);

    // Observações do Financeiro e botão
    const blocoFin = document.createElement('div');
    blocoFin.className = 'bloco-fin';
    blocoFin.innerHTML = `
      <label>Observações do Financeiro:</label>
      <textarea placeholder="Digite suas observações aqui..."></textarea>
      <button class="btn btn-registrar" disabled>Confirmar Liberação do Cliente</button>
    `;
    const taFin = blocoFin.querySelector('textarea');
    const btnFin = blocoFin.querySelector('button');
    btnFin.addEventListener('click', () => confirmarFinanceiro(id, taFin.value));
    form.appendChild(blocoFin);

    function atualizarBotaoLiberar() {
      const rows = containerCinza.querySelectorAll('.vencimento-row');
      let soma = 0;
      rows.forEach(r => {
        const val = parseFloat(r.querySelector('input').value.replace(/\./g, '').replace(',', '.'));
        if (!isNaN(val)) soma += val;
      });
      const erroEl = containerCinza.querySelector('.venc-soma-error');
      if (Math.abs(soma - (totalComNota + totalSemNota)) > 0.005) {
        erroEl.textContent = `A soma dos vencimentos (R$ ${soma.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}) difere do total R$ ${(formatarMoeda(totalComNota + totalSemNota))}.`;
      } else {
        erroEl.textContent = '';
      }
      btnFin.disabled = Math.abs(soma - (totalComNota + totalSemNota)) > 0.005;
    }

    atualizarBotaoLiberar();

    // toggle form visibility
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
