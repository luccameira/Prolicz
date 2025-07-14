
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

function normalizarTexto(texto) {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
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

    let descontosPedido = [];

    pedido.materiais?.forEach((item) => {
      const descontosComerciais = item.descontos?.filter(d =>
        d.motivo === 'Compra de Material' || d.motivo === 'Devolução de Material'
      ) || [];

      descontosComerciais.forEach(desc => {
        const nomeMat = normalizarTexto(desc.material);
        let listaProdutos;

        if (desc.motivo === 'Compra de Material') {
          listaProdutos = pedido.produtos_autorizados_venda || [];
        } else if (desc.motivo === 'Devolução de Material') {
          listaProdutos = pedido.produtos_autorizados_devolucao || [];
        }

        const produtoReal = listaProdutos.find(p => {
          const nomeProd = normalizarTexto(p.nome_produto);
          return nomeProd === nomeMat;
        });

        descontosPedido.push({
          ...desc,
          nome_produto: produtoReal?.nome_produto || desc.material || 'Produto não informado',
          valor_unitario: produtoReal?.valor_unitario || 0,
          ticket_devolucao: desc.ticket_devolucao || null,
          ticket_compra: desc.ticket_compra || null,
          confirmado_valor_kg: false
        });
      });
    });

    // Exibe materiais
    pedido.materiais?.forEach((item) => {
      const bloco = document.createElement('div');
      bloco.className = 'material-bloco';

      const tipoPeso = item.tipo_peso === 'Aproximado' ? 'Aproximado' : 'Exato';
      const pesoPrevisto = formatarPesoComMilhar(item.quantidade);
      const pesoCarregado = formatarPesoComMilhar(item.peso_carregado);

      const descontosPalete = item.descontos?.filter(d =>
        d.motivo === 'Palete Pequeno' || d.motivo === 'Palete Grande'
      ) || [];

      const totalDescontoPalete = descontosPalete.reduce((sum, d) => sum + Number(d.peso_calculado || 0), 0);
      const pesoFinalNum = (Number(item.peso_carregado) || 0) - totalDescontoPalete;
      const pesoFinal = formatarPesoComMilhar(pesoFinalNum);

      let blocoAmareloHTML = '';
      if (descontosPalete.length) {
        const linhas = descontosPalete.map(desc => {
          return `<li>${desc.motivo}: ${formatarPesoComMilhar(desc.quantidade)} UN (${formatarPesoComMilhar(desc.peso_calculado)} Kg)</li>`;
        }).join('');

        blocoAmareloHTML = `
          <div class="descontos-aplicados">
            <p><i class="fa fa-tags"></i> Descontos Aplicados:</p>
            <ul>${linhas}</ul>
          </div>
        `;
      }

      const valorTotal = formatarMoeda(pesoFinalNum * (Number(item.valor_unitario) || 0));

      bloco.innerHTML = `
        <h4>${item.nome_produto} (${formatarMoeda(Number(item.valor_unitario))}/Kg)</h4>
        <p>Peso Previsto para Carregamento (${tipoPeso}): ${pesoPrevisto} Kg</p>
        <p>Peso Registrado na Carga: ${pesoCarregado} Kg</p>
        ${blocoAmareloHTML}
        <p style="margin-top:16px;"><strong>${totalDescontoPalete > 0 ? 'Peso Final com Desconto' : 'Peso Final'}:</strong> ${pesoFinal} Kg</p>
        <div style="margin-top:12px; margin-bottom:4px;">
          <strong>Valor Total do Item:</strong>
          <span style="color: green;">${valorTotal}</span>
        </div>
      `;

      form.appendChild(bloco);
    });

    // BLOCO — Descontos Comerciais reorganizados
    if (descontosPedido.length) {
      descontosPedido.forEach((desc, idx) => {
        const blocoDesc = document.createElement('div');
        blocoDesc.className = 'bloco-desconto-vermelho';
        const nomeProduto = desc.nome_produto || desc.material || 'Produto não informado';
        const qtd = formatarPesoComMilhar(desc.peso_calculado);
        let valorKg = Number(desc.valor_unitario || 0);
        let totalCompra = valorKg * Number(desc.peso_calculado || 0);

        blocoDesc.innerHTML = `
          <p class="titulo-desconto"><i class="fa fa-exclamation-triangle"></i> ${desc.motivo}:</p>
          <p><strong>Produto:</strong> ${nomeProduto}</p>
          <p><strong>Quantidade:</strong> ${qtd} Kg</p>
        `;

            const valorInputId = `valor-kg-${id}-${idx}`;
        const confirmarBtnId = `confirmar-kg-${id}-${idx}`;

        if (desc.motivo === 'Devolução de Material') {
          const row = document.createElement('div');
          row.className = 'vencimento-row';
          row.dataset.confirmado = 'false';

          const valorInput = document.createElement('input');
          valorInput.type = 'text';
          valorInput.id = valorInputId;
          valorInput.value = valorKg.toFixed(2).replace('.', ',');

          valorInput.addEventListener('input', () => {
            let valor = valorInput.value.replace(/\D/g, '');
            valor = (parseInt(valor, 10) / 100).toFixed(2);
            valorInput.value = parseFloat(valor).toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            });
          });

          const btnConfirmar = document.createElement('button');
          btnConfirmar.type = 'button';
          btnConfirmar.id = confirmarBtnId;
          btnConfirmar.textContent = '✓';

          const valorTotalDesc = document.createElement('p');
          const calcularValorTotal = (valorKgAtual) => {
            const novoTotal = Number(desc.peso_calculado || 0) * valorKgAtual;
            valorTotalDesc.innerHTML = `<strong>Valor total:</strong> <span style="color:#b12e2e; font-weight: bold;">${formatarMoeda(novoTotal)}</span>`;
          };

          function toggleConfirmacaoDevolucao(row, input, btn, desc) {
            const raw = input.value.replace(/\./g, '').replace(',', '.');
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
              input.focus();
              return;
            }

            if (row.contains(rowErr)) row.removeChild(rowErr);

            const isConfirmado = row.dataset.confirmado === 'true';

            if (!isConfirmado) {
              row.dataset.confirmado = 'true';
              input.disabled = true;
              const etiqueta = document.createElement('span');
              etiqueta.className = 'etiqueta-valor-item';
              etiqueta.textContent = 'CONFIRMADO';
              etiqueta.style.cursor = 'pointer';
              etiqueta.addEventListener('click', () => {
                toggleConfirmacaoDevolucao(row, input, btn, desc);
              });
              row.replaceChild(etiqueta, btn);
              desc.valor_unitario = num;
              desc.confirmado_valor_kg = true;
              calcularValorTotal(num);
              atualizarResumoFinanceiro();
            } else {
              row.dataset.confirmado = 'false';
              input.disabled = false;
              const novoBtn = document.createElement('button');
              novoBtn.id = confirmarBtnId;
              novoBtn.textContent = '✓';
              novoBtn.type = 'button';
              novoBtn.addEventListener('click', () => {
                toggleConfirmacaoDevolucao(row, input, novoBtn, desc);
              });
              const etiquetaAtual = row.querySelector('.etiqueta-valor-item');
              if (etiquetaAtual) {
                row.replaceChild(novoBtn, etiquetaAtual);
              }
              desc.confirmado_valor_kg = false;
            }

            atualizarBotaoLiberar();
          }

          btnConfirmar.addEventListener('click', () => {
            toggleConfirmacaoDevolucao(row, valorInput, btnConfirmar, desc);
          });

          row.innerHTML = `<span class="venc-label">Valor por Kg:</span>`;
          row.appendChild(valorInput);
          row.appendChild(btnConfirmar);

          blocoDesc.appendChild(row);
          calcularValorTotal(valorKg);
          blocoDesc.appendChild(valorTotalDesc);
        } else if (desc.motivo === 'Compra de Material') {
          const row = document.createElement('div');
          row.className = 'vencimento-row';
          row.innerHTML = `
            <span class="venc-label">Valor por Kg:</span>
            <span style="font-weight: bold;">${formatarMoeda(valorKg)}</span>
          `;
          blocoDesc.appendChild(row);

          const valorTotalDesc = document.createElement('p');
          const total = Number(desc.peso_calculado || 0) * valorKg;
          valorTotalDesc.innerHTML = `<strong>Valor total:</strong> <span style="color:#b12e2e; font-weight: bold;">${formatarMoeda(total)}</span>`;
          blocoDesc.appendChild(valorTotalDesc);
        }

        blocoDesc.style.marginTop = '20px';
        blocoDesc.style.padding = '12px 16px';
        blocoDesc.style.borderRadius = '8px';
        blocoDesc.style.background = '#fde4e1';
        blocoDesc.style.border = '1px solid #e66';
        form.appendChild(blocoDesc);

        const blocoImagens = document.createElement('div');
        blocoImagens.className = 'bloco-tickets-comerciais';
        blocoImagens.style.margin = '12px 0 20px 0';
        blocoImagens.style.display = 'flex';
        blocoImagens.style.flexWrap = 'wrap';
        blocoImagens.style.gap = '20px';

        if (desc.ticket_devolucao || desc.ticket_compra) {
          const idImg = `ticket-desc-${id}-${idx}`;
          const tipo = desc.ticket_devolucao ? 'Devolução' : 'Compra';
          const ticket = desc.ticket_devolucao || desc.ticket_compra;
          const imgDiv = document.createElement('div');
          imgDiv.innerHTML = `
            <label style="font-weight:bold;">Ticket ${tipo}:</label><br>
            <img id="${idImg}" src="/uploads/tickets/${ticket}" alt="Ticket ${tipo}" class="ticket-balanca">
          `;
          blocoImagens.appendChild(imgDiv);
          setTimeout(() => adicionarZoomImagem(idImg), 100);
        }

        if (pedido.ticket_balanca) {
          const idImgPedido = `ticket-pedido-${id}-${idx}`;
          const imgDivPedido = document.createElement('div');
          imgDivPedido.innerHTML = `
            <label style="font-weight:bold;">Ticket Pesagem do Pedido:</label><br>
            <img id="${idImgPedido}" src="/uploads/tickets/${pedido.ticket_balanca}" alt="Ticket Pedido" class="ticket-balanca">
          `;
          blocoImagens.appendChild(imgDivPedido);
          setTimeout(() => adicionarZoomImagem(idImgPedido), 100);
        }

        form.appendChild(blocoImagens);
      });
    }

      const separador = document.createElement('div');
    separador.className = 'divider-financeiro';
    form.appendChild(separador);

    const containerCinza = document.createElement('div');
    containerCinza.className = 'resumo-financeiro';

    if (
      pedido.condicao_pagamento_avista &&
      pedido.prazos_pagamento?.length &&
      pedido.prazos_pagamento.some((dataVencimento, index) => {
        const prazoOriginal = pedido.prazos_pagamento[index];
        const dataColeta = new Date(pedido.data_coleta).toDateString();
        const dataVenc = new Date(prazoOriginal).toDateString();
        return dataVenc === dataColeta;
      })
    ) {
      const blocoCondicao = document.createElement('div');
      blocoCondicao.className = 'obs-pedido';
      blocoCondicao.innerHTML = `
        <strong>Condição para pagamento à vista:</strong> ${pedido.condicao_pagamento_avista}
      `;
      containerCinza.appendChild(blocoCondicao);
    }

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

        const descontosPalete = item.descontos?.filter(d =>
          d.motivo === 'Palete Pequeno' || d.motivo === 'Palete Grande'
        ) || [];

        const descontoKg = descontosPalete.reduce((sum, d) => sum + Number(d.peso_calculado || 0), 0);
        const pesoFinal = (Number(item.peso_carregado) || 0) - descontoKg;

        const totalCom = pesoFinal * valorComNota;
        const totalSem = pesoFinal * valorSemNota;
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

    // 🔧 Cálculo de total de descontos comerciais (compra e devolução)
const totalDescontosComerciais = descontosPedido.reduce((soma, d) => {
  const peso = Number(d.peso_calculado || 0);
  const valorKg = Number(d.valor_unitario || 0);
  return soma + (peso * valorKg);
}, 0);

// 🔧 Valor total da venda com desconto aplicado
const totalVenda = totalComNota + totalSemNota - totalDescontosComerciais;
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

    containerCinza.innerHTML += `
      <p><strong>Valor Total da Venda:</strong> <span class="etiqueta-valor-item" id="reset-vencimentos">${totalVendaFmt}</span></p>
      <div class="vencimentos-container"></div>
      <p class="venc-soma-error" style="color:red;"></p>
      ${codigosFiscaisBarraAzul}
      ${pedido.observacoes && pedido.observacoes.trim() !== '' ? `<div class="obs-pedido"><strong>Observações:</strong> ${pedido.observacoes}</div>` : ''}
    `;

    const vencContainer = containerCinza.querySelector('.vencimentos-container');
    const inputs = [];
    let valoresPadrao = calcularValoresVencimentos();

    function atualizarResumoFinanceiro() {
  let totalComNotaNovo = 0;
  let totalSemNotaNovo = 0;

  pedido.materiais?.forEach(item => {
    const { valorComNota, valorSemNota } = calcularValoresFiscais(item);

    const descontosPalete = item.descontos?.filter(d =>
      d.motivo === 'Palete Pequeno' || d.motivo === 'Palete Grande'
    ) || [];

    const descontoKg = descontosPalete.reduce((sum, d) => sum + Number(d.peso_calculado || 0), 0);
    const pesoFinal = (Number(item.peso_carregado) || 0) - descontoKg;

    totalComNotaNovo += pesoFinal * valorComNota;
    totalSemNotaNovo += pesoFinal * valorSemNota;
  });

  const totalDescontos = descontosPedido.reduce((soma, d) => {
    const peso = Number(d.peso_calculado || 0);
    const valorKg = Number(d.valor_unitario || 0);
    return soma + (peso * valorKg);
  }, 0);

  const totalFinalVenda = totalComNotaNovo + totalSemNotaNovo - totalDescontos;
  const totalFinalVendaFmt = formatarMoeda(totalFinalVenda);

  const tagTotalVenda = containerCinza.querySelector('#reset-vencimentos');
  if (tagTotalVenda) tagTotalVenda.textContent = totalFinalVendaFmt;

  valoresPadrao = (() => {
    let parcelas = [];
    let base = Math.floor((totalFinalVenda * 100) / numVencimentos) / 100;
    let totalParcial = 0;
    for (let i = 0; i < numVencimentos; i++) {
      if (i < numVencimentos - 1) {
        parcelas.push(base);
        totalParcial += base;
      } else {
        let ultima = (totalFinalVenda - totalParcial);
        parcelas.push(ultima);
      }
    }
    return parcelas;
  })();

  renderizarVencimentos(valoresPadrao);
  atualizarBotaoLiberar();
}

    function renderizarVencimentos(valores) {
  vencContainer.innerHTML = '';
  inputs.length = 0;

  for (let i = 0; i < numVencimentos; i++) {
    const dt = new Date(pedido.prazos_pagamento[i]);
    const ok = !isNaN(dt.getTime());
    const valorRaw = Number(valores[i] || 0);
    const valorFmt = valorRaw.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    const row = document.createElement('div');
    row.className = 'vencimento-row';
    row.dataset.confirmado = 'false';
    row.innerHTML = `
      <span class="venc-label">Vencimento ${i + 1}</span>
      <span class="venc-data">${ok ? formatarData(dt) : 'Data inválida'}</span>
      <input type="text" value="${valorFmt}" />
      <button type="button">✓</button>
    `;

    const inp = row.querySelector('input');
    const btn = row.querySelector('button');
    inputs[i] = inp;

    inp.addEventListener('input', () => {
      let valor = inp.value.replace(/\D/g, '');
      valor = (parseInt(valor, 10) / 100).toFixed(2);
      inp.value = parseFloat(valor).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    });

    inp.addEventListener('blur', () => {
  // Verifica se o campo atual foi confirmado
  if (row.dataset.confirmado === 'true') return;

  const valores = inputs.map((input, idx) => {
    const val = parseFloat(input.value.replace(/\./g, '').replace(',', '.'));
    return isNaN(val) ? 0 : val;
  });

  const totalConfirmado = valores.reduce((soma, val, idx) => {
    const r = vencContainer.querySelectorAll('.vencimento-row')[idx];
    return r.dataset.confirmado === 'true' ? soma + val : soma;
  }, 0);

  const naoConfirmados = [];
  inputs.forEach((input, idx) => {
    const r = vencContainer.querySelectorAll('.vencimento-row')[idx];
    if (r.dataset.confirmado !== 'true') naoConfirmados.push(idx);
  });

  const restante = totalVenda - totalConfirmado;

  if (naoConfirmados.length > 0) {
    const base = Math.floor((restante * 100) / naoConfirmados.length) / 100;
    let parcial = 0;

    naoConfirmados.forEach((idx, i) => {
      let valorFinal = base;
      if (i === naoConfirmados.length - 1) {
        valorFinal = restante - parcial;
      } else {
        parcial += base;
      }

      inputs[idx].value = valorFinal.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    });
  }

  atualizarBotaoLiberar();

        btn.addEventListener('click', toggleConfirmacao);
        etiquetaConfirmado.addEventListener('click', toggleConfirmacao);
        vencContainer.appendChild(row);
      }
    }

   function resetarVencimentosPadrao() {
  atualizarResumoFinanceiro(); // isso já chama renderizarVencimentos internamente
}

   function atualizarBotaoLiberar() {
  let soma = 0;
  for (let i = 0; i < numVencimentos; i++) {
    let valor = inputs[i].value.replace(/\D/g, '');
    valor = parseInt(valor, 10) / 100;
    soma += valor;
  }

  // Usa o novo total atualizado pela função atualizarResumoFinanceiro
  const totalVendaAtual = containerCinza.querySelector('#reset-vencimentos')?.textContent || '';
  const totalVendaNum = parseFloat(totalVendaAtual.replace(/\./g, '').replace(',', '.')) || 0;

  const erro = document.querySelector('.erro-vencimentos');
  const liberador = document.querySelector('#liberar-btn');

  if (Math.abs(soma - totalVendaNum) > 0.02) {
    erro.style.display = 'block';
    erro.textContent = `A soma dos vencimentos (R$ ${formatarMoeda(soma)}) difere do total R$ ${formatarMoeda(totalVendaNum)}.`;
    liberador.disabled = true;
  } else {
    erro.style.display = 'none';
    erro.textContent = '';
    liberador.disabled = false;
  }
}

    renderizarVencimentos(valoresPadrao);
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

function adicionarZoomImagem(idImagem) {
  const img = document.getElementById(idImagem);
  if (!img) return;

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

document.addEventListener('DOMContentLoaded', () => {
  carregarPedidosFinanceiro();
  const filtro = document.getElementById('filtro-cliente');
  const ordenar = document.getElementById('ordenar');
  if (filtro) filtro.addEventListener('input', carregarPedidosFinanceiro);
  if (ordenar) ordenar.addEventListener('change', carregarPedidosFinanceiro);
});
