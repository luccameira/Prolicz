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

function formatarPesoComMilhar(valor) {
  if (valor == null) return '—';
  const numero = Number(valor);
  return numero.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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
  const res = await fetch('/api/pedidos/financeiro');
  let pedidos = [];
  try {
    pedidos = await res.json();
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

    const timelineHTML = gerarLinhaTempoCompleta(pedido);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = timelineHTML;
    const timelineElement = tempDiv.querySelector('.timeline-simples');
    if (timelineElement) {
      card.appendChild(timelineElement);
      setTimeout(() => animarLinhaProgresso(timelineElement), 0);
    }

    const form = document.createElement('div');
    form.className = 'formulario';
    form.style.display = 'none';

      pedido.materiais?.forEach(item => {
      const bloco = document.createElement('div');
      bloco.className = 'material-bloco';

      const tipoPeso = item.tipo_peso === 'Aproximado' ? 'Aproximado' : 'Exato';
      const pesoPrevisto = formatarPesoComMilhar(item.quantidade);
      const pesoCarregado = formatarPesoComMilhar(item.peso_carregado);
      let descontosKg = 0;
      if (item.descontos?.length) {
        descontosKg = item.descontos.reduce((sum, d) => sum + Number(d.peso_calculado || 0), 0);
      }
      const pesoFinalNum = (Number(item.peso_carregado) || 0) - descontosKg;
      const pesoFinal = formatarPesoComMilhar(pesoFinalNum);

      bloco.innerHTML = `
        <h4>${item.nome_produto} (${formatarMoeda(Number(item.valor_unitario))}/Kg)</h4>
        <p>Peso Previsto para Carregamento (${tipoPeso}): ${pesoPrevisto} Kg</p>
        <p>Peso Registrado na Carga: ${pesoCarregado} Kg</p>
        ${item.descontos?.length ? `
          <div class="descontos-aplicados" style="margin-top:16px;">
            <p><i class="fa fa-tags"></i> Descontos Aplicados:</p>
            <ul>
              ${item.descontos.map(d =>
                `<li>${d.motivo}: ${formatarPesoComMilhar(d.quantidade)} UNIDADES (${formatarPesoComMilhar(d.peso_calculado)} Kg)</li>`
              ).join('')}
            </ul>
          </div>
        ` : ''}
        <p style="margin-top:16px;"><strong>${item.descontos?.length ? 'Peso Final com Desconto' : 'Peso Final'}:</strong> ${pesoFinal} Kg</p>
        <div style="margin-top:12px; margin-bottom:4px;">
          <strong>Valor Total do Item:</strong>
          <span style="color: green;">${formatarMoeda((Number(pesoFinalNum) || 0) * (Number(item.valor_unitario) || 0))}</span>
        </div>
      `;
      form.appendChild(bloco);
    });

    if (pedido.ticket_balanca) {
      const ticketId = `ticket-${id}`;
      const blocoTicket = document.createElement('div');
      blocoTicket.style.marginTop = '25px';
      blocoTicket.innerHTML = `
        <label style="font-weight: bold;">Ticket da Balança:</label><br>
        <img id="${ticketId}" src="/uploads/tickets/${pedido.ticket_balanca}" alt="Ticket da Balança" class="ticket-balanca">
      `;
      form.appendChild(blocoTicket);

      setTimeout(() => {
        const img = document.getElementById(ticketId);
        if (img) {
          img.addEventListener('click', (event) => {
            event.stopPropagation();
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100vw';
            overlay.style.height = '100vh';
            overlay.style.background = 'rgba(0, 0, 0, 0.8)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.zIndex = '9999';

            const modalImg = document.createElement('img');
            modalImg.src = img.src;
            modalImg.style.maxWidth = '90vw';
            modalImg.style.maxHeight = '90vh';
            modalImg.style.objectFit = 'contain';
            modalImg.style.borderRadius = '8px';
            modalImg.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
            modalImg.style.cursor = 'zoom-in';
            modalImg.style.transition = 'transform 0.3s ease';

            let zoomed = false;
            modalImg.addEventListener('click', (e) => {
              e.stopPropagation();
              const rect = modalImg.getBoundingClientRect();
              const offsetX = e.clientX - rect.left;
              const offsetY = e.clientY - rect.top;
              const percentX = (offsetX / rect.width) * 100;
              const percentY = (offsetY / rect.height) * 100;

              if (!zoomed) {
                modalImg.style.transformOrigin = `${percentX}% ${percentY}%`;
                modalImg.style.transform = 'scale(2.5)';
                modalImg.style.cursor = 'zoom-out';
                zoomed = true;
              } else {
                modalImg.style.transform = 'scale(1)';
                modalImg.style.cursor = 'zoom-in';
                zoomed = false;
              }
            });

            const closeBtn = document.createElement('div');
            closeBtn.innerHTML = '&times;';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '20px';
            closeBtn.style.right = '30px';
            closeBtn.style.fontSize = '40px';
            closeBtn.style.color = '#fff';
            closeBtn.style.cursor = 'pointer';
            closeBtn.onclick = (e) => {
              e.stopPropagation();
              document.body.removeChild(overlay);
            };

            overlay.appendChild(modalImg);
            overlay.appendChild(closeBtn);
            document.body.appendChild(overlay);
          });
        }
      }, 200);
    }

    const separador = document.createElement('div');
    separador.className = 'divider-financeiro';
    form.appendChild(separador);

    const containerCinza = document.createElement('div');
    containerCinza.className = 'resumo-financeiro';

        const totalVenda = totalComNota + totalSemNota;
    const totalVendaFmt = formatarMoeda(totalVenda);
    const numVencimentos = pedido.prazos_pagamento?.length || 1;

    function calcularValoresVencimentos() {
      let parcelas = [];
      let base = Math.floor((totalVenda * 100) / numVencimentos) / 100;
      let totalParcial = 0;
      for (let i = 0; i < numVencimentos; i++) {
        if (i < numVencimentos - 1) {
          parcelas.push(base);
          totalParcial += base;
        } else {
          let ultima = (totalVenda - totalParcial);
          parcelas.push(ultima);
        }
      }
      return parcelas;
    }

    let valoresPadrao = calcularValoresVencimentos();
    renderizarVencimentos(valoresPadrao);

    // ✅ NOVO LOCAL DA CONDIÇÃO DE PAGAMENTO À VISTA (entre vencimentos e códigos)
    if (pedido.condicao_pagamento_avista) {
      const blocoCondicao = document.createElement('div');
      blocoCondicao.className = 'obs-pedido';
      blocoCondicao.style.marginTop = '16px';
      blocoCondicao.style.marginBottom = '10px';
      blocoCondicao.style.background = '#fff3cd';
      blocoCondicao.style.border = '1px solid #ffeeba';
      blocoCondicao.style.padding = '10px 16px';
      blocoCondicao.style.borderRadius = '6px';
      blocoCondicao.innerHTML = `
        <strong>Condição para pagamento à vista:</strong> ${pedido.condicao_pagamento_avista}
      `;
      containerCinza.appendChild(blocoCondicao);
    }

    containerCinza.innerHTML += `
      <p><strong>Valor Total da Venda:</strong> <span class="etiqueta-valor-item" id="reset-vencimentos">${totalVendaFmt}</span></p>
      <div class="vencimentos-container"></div>
      <p class="venc-soma-error" style="color:red;"></p>
      ${codigosFiscaisBarraAzul}
      ${pedido.observacoes && pedido.observacoes.trim() !== '' ? `<div class="obs-pedido"><strong>Observações:</strong> ${pedido.observacoes}</div>` : ''}
    `;

    const vencContainer = containerCinza.querySelector('.vencimentos-container');
    const inputs = [];

    function renderizarVencimentos(valores) {
      vencContainer.innerHTML = '';
      inputs.length = 0;

      for (let i = 0; i < numVencimentos; i++) {
        const dt = new Date(pedido.prazos_pagamento[i]);
        const ok = !isNaN(dt.getTime());
        const valorFmt = valores[i]?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00';

        const row = document.createElement('div');
        row.className = 'vencimento-row';
        row.dataset.confirmado = 'false';
        row.innerHTML = `
          <span class="venc-label">Vencimento ${i + 1}</span>
          <span class="venc-data">${ok ? formatarData(dt) : 'Data inválida'}</span>
          <input type="text" value="${valorFmt}" ${i === 2 ? 'disabled' : ''} />
          <button type="button">✓</button>
        `;

        const inp = row.querySelector('input');
        const btn = row.querySelector('button');
        inputs[i] = inp;

        // Máscara moeda
        inp.addEventListener('input', () => {
          let valor = inp.value.replace(/\D/g, '');
          valor = (parseInt(valor, 10) / 100).toFixed(2);
          inp.value = parseFloat(valor).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });
        });

        inp.addEventListener('blur', () => {
          const v1 = parseFloat(inputs[0].value.replace(/\./g, '').replace(',', '.')) || 0;
          const v2 = parseFloat(inputs[1]?.value.replace(/\./g, '').replace(',', '.')) || 0;

          if (i === 0 && numVencimentos === 3) {
            const restante = Math.max(0, totalVenda - v1);
            const metade = restante / 2;
            inputs[1].value = metade.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            inputs[2].value = metade.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          } else if (i === 1 && numVencimentos === 3) {
            const restante = Math.max(0, totalVenda - v1 - v2);
            inputs[2].value = restante.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          }

          atualizarBotaoLiberar();
        });

        const etiquetaConfirmado = document.createElement('span');
        etiquetaConfirmado.className = 'etiqueta-valor-item';
        etiquetaConfirmado.textContent = 'CONFIRMADO';
        etiquetaConfirmado.style.cursor = 'pointer';

          function toggleConfirmacao() {
          const raw = inp.value.replace(/\./g, '').replace(',', '.');
          const num = parseFloat(raw);

          let rowErr = row.querySelector('.row-error');
          if (!rowErr) {
            rowErr = document.createElement('div');
            rowErr.className = 'row-error';
            rowErr.style.color = 'red';
            rowErr.style.fontSize = '13px';
          }

          if (isNaN(num) || num <= 0) {
            rowErr.textContent = 'Valor inválido.';
            if (!row.contains(rowErr)) row.appendChild(rowErr);
            inp.focus();
            return;
          }

          if (num > totalVenda) {
            rowErr.textContent = 'Valor excede o total da venda.';
            if (!row.contains(rowErr)) row.appendChild(rowErr);
            inp.focus();
            return;
          }

          if (row.contains(rowErr)) row.removeChild(rowErr);

          const isConf = row.dataset.confirmado === 'true';
          if (!isConf) {
            row.dataset.confirmado = 'true';
            inp.disabled = true;
            btn.replaceWith(etiquetaConfirmado);
          } else {
            row.dataset.confirmado = 'false';
            if (i !== 2) inp.disabled = false;
            etiquetaConfirmado.replaceWith(btn);
          }

          atualizarBotaoLiberar();
        }

        btn.addEventListener('click', toggleConfirmacao);
        etiquetaConfirmado.addEventListener('click', toggleConfirmacao);
        vencContainer.appendChild(row);
      }
    }

    function resetarVencimentosPadrao() {
      valoresPadrao = calcularValoresVencimentos();
      renderizarVencimentos(valoresPadrao);
      atualizarBotaoLiberar();
    }

    function atualizarBotaoLiberar() {
      const rows = containerCinza.querySelectorAll('.vencimento-row');
      let soma = 0;
      rows.forEach((r) => {
        const val = parseFloat(r.querySelector('input').value.replace(/\./g, '').replace(',', '.'));
        if (!isNaN(val)) soma += val;
      });

      const erroEl = containerCinza.querySelector('.venc-soma-error');
      if (Math.abs(soma - totalVenda) > 0.005) {
        erroEl.textContent = `A soma dos vencimentos (R$ ${soma.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) difere do total R$ ${totalVendaFmt}.`;
      } else {
        erroEl.textContent = '';
      }

      const btnFin = form.querySelector('.btn-registrar');
      if (btnFin) btnFin.disabled = Math.abs(soma - totalVenda) > 0.005;
    }

    form.appendChild(containerCinza);

    const valorTotalTag = containerCinza.querySelector('#reset-vencimentos');
    if (valorTotalTag) {
      valorTotalTag.style.cursor = 'pointer';
      valorTotalTag.title = 'Clique para redefinir os vencimentos para o padrão';
      valorTotalTag.onclick = resetarVencimentosPadrao;
    }

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

    card.appendChild(form);

    header.addEventListener('click', () => {
      if (pedido.status !== 'Em Análise pelo Financeiro') return;
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

  const filtro = document.getElementById('filtro-cliente');
  const ordenar = document.getElementById('ordenar');
  if (filtro) filtro.addEventListener('input', carregarPedidosFinanceiro);
  if (ordenar) ordenar.addEventListener('change', carregarPedidosFinanceiro);
});
