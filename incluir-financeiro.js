/*
 * Este arquivo contém a lógica de exibição e cálculo financeiro do módulo
 * “incluir financeiro” do sistema Prolicz. Ele foi reestruturado para
 * aplicar corretamente as regras fiscais da empresa para valores com
 * nota fiscal (NF), sem nota fiscal (SN) ou parcialmente com nota.
 * Foi adicionada a lógica para o código fiscal que termina em "X",
 * tratando-o como "GX" (sem nota) conforme as regras de negócios:
 * todo o valor do item é considerado sem nota, sem discriminação entre
 * partes com e sem nota na interface. Isso corrige a interpretação
 * anterior que dividia o valor igualmente entre com nota e sem nota.
 */

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
  return numero.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

/**
 * Retorna o código fiscal formatado para exibição na interface. Se o valor
 * técnico for "Personalizar" (ou qualquer capitalização), exibe "GAP".
 * Caso contrário, retorna o código original. Isso permite manter o valor
 * real salvo no banco de dados enquanto mostra a nomenclatura desejada
 * pelo usuário.
 *
 * @param {string} codigo Código fiscal original
 * @returns {string} Código a ser exibido
 */
function formatarCodigoExibicao(codigo) {
  if (!codigo) return '';
  // Compara ignorando diferenciação de maiúsculas e minúsculas
  return codigo.toUpperCase() === 'PERSONALIZAR' ? 'GAP' : codigo;
}

/**
 * Calcula os valores por quilo com e sem nota fiscal para um item.
 * Regras:
 *  - Se o código fiscal for “PERSONALIZAR”, utiliza os campos valor_com_nota e valor_sem_nota do item.
 *  - Se o código terminar em 1: todo o valor é com nota (nota cheia).
 *  - Se terminar em 2 ou P: é “meia nota” (50% com nota e 50% sem nota), salvo PERSONALIZAR.
 *  - Se terminar em X: é “sem nota” (100% sem nota, 0% com nota).
 *  - Qualquer outra terminação será considerada nota cheia.
 * Esta função foi atualizada para tratar corretamente os códigos fiscais que terminam em “X” (GX),
 * garantindo que o valor seja considerado integralmente sem nota.
 * @param {Object} item Objeto do material com propriedades valor_unitario, valor_com_nota,
 *        valor_sem_nota e codigo_fiscal
 * @returns {{valorComNota: number, valorSemNota: number}} Valores unitários separados
 */
function calcularValoresFiscais(item) {
  const valorUnitario = Number(item.valor_unitario) || 0;
  let valorComNota = 0;
  let valorSemNota = 0;
  const tipoCodigo = (item.codigo_fiscal || '').toUpperCase();

  // PERSONALIZAR: utiliza campos específicos se existirem
  if (tipoCodigo === 'PERSONALIZAR' && item.valor_com_nota != null && item.valor_sem_nota != null) {
    valorComNota = Number(item.valor_com_nota);
    valorSemNota = Number(item.valor_sem_nota);
  } else if (tipoCodigo.endsWith('1')) {
    // Nota cheia: tudo vai para a parte com nota
    valorComNota = valorUnitario;
    valorSemNota = 0;
  } else if (tipoCodigo.endsWith('2') || tipoCodigo.endsWith('P')) {
    // Meia nota (50/50) para códigos terminados em 2 ou P
    valorComNota = valorUnitario / 2;
    valorSemNota = valorUnitario / 2;
  } else if (tipoCodigo.endsWith('X')) {
    // Código GX (terminado em X): totalmente sem nota
    valorComNota = 0;
    valorSemNota = valorUnitario;
  } else {
    // Default: considera nota cheia
    valorComNota = valorUnitario;
    valorSemNota = 0;
  }
  return { valorComNota, valorSemNota };
}

/**
 * Remove acentuação e formata texto para comparação.
 * @param {string} texto
 * @returns {string}
 */
function normalizarTexto(texto) {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Alterna a exibição do corpo de um card, respeitando permissões do usuário.
 * @param {HTMLElement} headerElement
 */
function alternarCard(headerElement) {
  const card = headerElement.closest('.card');
  const body = card.querySelector('.card-body');
  const usuario = JSON.parse(localStorage.getItem('usuarioLogado'));
  const permissoes = usuario?.permissoes?.map(p => p.toLowerCase()) || [];
  const podeExecutar = permissoes.includes('executar tarefas - financeiro');
  if (!podeExecutar) {
    console.warn('Usuário sem permissão para executar tarefas - financeiro.');
    return;
  }
  body.style.display = body.style.display === 'none' ? 'block' : 'none';
}

/**
 * Carrega os pedidos pendentes no módulo financeiro e monta a interface.
 * A lógica de descontos e barras fiscais foi ajustada para atender às
 * regras do código GX (sem nota).
 */
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

    // Timeline
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

    // Lista de descontos comerciais (compra/devolução) associados ao pedido
    let descontosPedido = [];
    pedido.materiais?.forEach(item => {
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
        let valorKgDesconto;
        if (desc.motivo === 'Compra de Material' || desc.motivo === 'Devolução de Material') {
          valorKgDesconto = Number(produtoReal?.valor_unitario) || 0;
        } else {
          valorKgDesconto = Number(item.valor_unitario) || 0;
        }
        descontosPedido.push({
          ...desc,
          nome_produto: produtoReal?.nome_produto || desc.material || 'Produto não informado',
          valor_unitario: valorKgDesconto,
          ticket_devolucao: desc.ticket_devolucao || null,
          ticket_compra: desc.ticket_compra || null,
          confirmado_valor_kg: false
        });
      });
    });

    /**
     * BARRA FISCAL
     * A partir deste ponto, calculamos os totais com e sem nota e aplicamos descontos comerciais
     * de forma centralizada pela função aplicarDescontosGlobais. Para GX (sem nota), a interface
     * não deve exibir a discriminação entre partes com e sem nota; por isso, a geração da barra
     * fiscal foi ajustada para omitir esses valores quando o código fiscal termina em X.
     */
    let totalComNota = 0;
    let totalSemNota = 0;
    let codigosFiscaisBarraAzul = '';

    /**
     * Esta função aplica os descontos comerciais globais nos itens do pedido,
     * calcula valores fiscais e financeiros e gera o HTML da barra fiscal. A
     * lógica interna foi ajustada para tratar códigos GX (terminados em X) como
     * totalmente sem nota: os valores são calculados corretamente (100% sem nota)
     * e, na interface, os valores individuais são omitidos.
     *
     * @param {Object} pedidoAtual Objeto do pedido atual
     * @param {Array} listaDescontos Lista de descontos comerciais
     * @returns {Object} Totais e HTML gerado para a barra fiscal
     */
    function aplicarDescontosGlobais(pedidoAtual, listaDescontos) {
      const itensCalculados = [];
      let somaDescontoAplicadoFinanceiro = 0;
      const totalDescontosGlobais = listaDescontos.reduce((soma, d) => {
        const pesoDesc = Number(d.peso_calculado || d.quantidade || 0);
        return soma + (pesoDesc * Number(d.valor_unitario || 0));
      }, 0);

      pedidoAtual.materiais?.forEach(mat => {
        const { valorComNota, valorSemNota } = calcularValoresFiscais(mat);
        // Paletes reduzem o peso final
        const descontosPalete = mat.descontos?.filter(d => d.motivo === 'Palete Pequeno' || d.motivo === 'Palete Grande') || [];
        const descontoKg = descontosPalete.reduce((sum, d) => sum + Number(d.peso_calculado || 0), 0);
        const pesoFinal = (Number(mat.peso_carregado) || 0) - descontoKg;
        const totalComBruto = pesoFinal * valorComNota;
        const totalSemBruto = pesoFinal * valorSemNota;
        // Desconto individual por produto usando valor_unitario do desconto
        const descontoIndividual = listaDescontos
          .filter(d => normalizarTexto(d.nome_produto) === normalizarTexto(mat.nome_produto))
          .reduce((acc, d) => {
            const pesoDesc = Number(d.peso_calculado || d.quantidade || 0);
            return acc + (pesoDesc * Number(d.valor_unitario || 0));
          }, 0);
        // Totais fiscais (barra) e financeiros (venda)
        let totalComFiscal = totalComBruto;
        let totalSemFiscal = totalSemBruto;
        let totalComFinanceiro = totalComBruto;
        let totalSemFinanceiro = totalSemBruto;
        let descontoAplicadoFin = 0;
        if (valorSemNota > 0) {
          // Item parcial ou sem nota: aplica desconto somente na parte sem nota
          const descontoUsado = Math.min(totalSemFinanceiro, descontoIndividual);
          totalSemFinanceiro -= descontoUsado;
          totalSemFiscal -= descontoUsado;
          descontoAplicadoFin += descontoUsado;
        } else {
          // Nota cheia (terminação 1): aplica desconto tanto no valor fiscal quanto no financeiro
          const descontoUsado = Math.min(totalComFinanceiro, descontoIndividual);
          totalComFinanceiro -= descontoUsado;
          totalComFiscal -= descontoUsado;
          descontoAplicadoFin += descontoUsado;
        }
        somaDescontoAplicadoFinanceiro += descontoAplicadoFin;
        itensCalculados.push({
          item: mat,
          valorComNota,
          valorSemNota,
          totalComFiscal,
          totalSemFiscal,
          totalComFinanceiro,
          totalSemFinanceiro
        });
      });

      // Distribui desconto restante: primeiro na parte sem nota dos itens parciais,
      // depois na parte com nota dos itens de nota cheia (financeiro).
      let descontoRestante = totalDescontosGlobais - somaDescontoAplicadoFinanceiro;
      if (descontoRestante > 0) {
        // Parte sem nota (parciais)
        for (const ic of itensCalculados) {
          if (descontoRestante <= 0) break;
          if (ic.valorSemNota > 0 && ic.totalSemFinanceiro > 0) {
            const reducible = Math.min(ic.totalSemFinanceiro, descontoRestante);
            ic.totalSemFinanceiro -= reducible;
            ic.totalSemFiscal -= reducible;
            descontoRestante -= reducible;
          }
        }
      }
      // Se ainda restar desconto, aplica nos itens de nota cheia (reduzindo tanto o valor fiscal quanto o financeiro)
      if (descontoRestante > 0) {
        for (const ic of itensCalculados) {
          if (descontoRestante <= 0) break;
          if (ic.valorSemNota === 0 && ic.totalComFinanceiro > 0) {
            const reducible = Math.min(ic.totalComFinanceiro, descontoRestante);
            ic.totalComFinanceiro -= reducible;
            ic.totalComFiscal -= reducible;
            descontoRestante -= reducible;
          }
        }
      }

      // Soma finais fiscais e financeiros
      const somaTotalComNotaFiscal = itensCalculados.reduce((acc, ic) => acc + ic.totalComFiscal, 0);
      const somaTotalSemNotaFiscal = itensCalculados.reduce((acc, ic) => acc + ic.totalSemFiscal, 0);
      const somaTotalComNotaFinanceiro = itensCalculados.reduce((acc, ic) => acc + ic.totalComFinanceiro, 0);
      const somaTotalSemNotaFinanceiro = itensCalculados.reduce((acc, ic) => acc + ic.totalSemFinanceiro, 0);

      // Constrói HTML da barra fiscal
      const htmlBarra = itensCalculados.map(ic => {
        const mat = ic.item;
        const codigoFmt = (mat.codigo_fiscal || '').toUpperCase();
        const totalCom = ic.totalComFiscal;
        const totalSem = ic.totalSemFiscal;
        const totalComFmt = formatarMoeda(totalCom);
        const totalSemFmt = formatarMoeda(totalSem);
        const valorKgComNotaFmt = formatarMoeda(ic.valorComNota || 0);
        let linhas = '';

        // Para código GX (terminado em X), não exibir linhas com valores discriminados
        if (!codigoFmt.endsWith('X')) {
          if (totalCom > 0) {
            linhas += `<span style="color:#2e7d32;">${totalComFmt} (${valorKgComNotaFmt}/kg)</span>`;
          }
          if (ic.valorSemNota > 0) {
            if (linhas) linhas += '<br />';
            const valorSemFmtFinal = totalSem > 0 ? totalSemFmt : formatarMoeda(0);
            linhas += `<span style="color:#c62828;">${valorSemFmtFinal}</span>`;
          } else {
            // Nota cheia: calcula o peso fiscal (peso na NF) com base no valor financeiro do item
            const pesoNF = Number(mat.valor_unitario) > 0 ? (ic.totalComFinanceiro / Number(mat.valor_unitario)) : 0;
            if (linhas) linhas += '<br />';
            linhas += `<span style="color:#c62828;">Peso NF: ${formatarPesoComMilhar(pesoNF)} Kg</span>`;
          }
        }
        // Usa formatarCodigoExibicao para exibir "GAP" no lugar de "Personalizar"
        return `
          <div class="barra-fiscal" style="font-weight:600; padding:4px 10px; font-size:15px;">
            ${mat.nome_produto}: <span style="color:black;">(${formatarCodigoExibicao(codigoFmt)})</span><br />
            ${linhas}
          </div>
        `;
      }).join('');

      return {
        itensCalculados,
        totalComNota: somaTotalComNotaFinanceiro,
        totalSemNota: somaTotalSemNotaFinanceiro,
        totalComNotaFiscal: somaTotalComNotaFiscal,
        totalSemNotaFiscal: somaTotalSemNotaFiscal,
        codigosFiscaisBarraAzul: htmlBarra
      };
    }

    // Calcula valores iniciais e a barra fiscal
    const resultadoFiscal = aplicarDescontosGlobais(pedido, descontosPedido);
    // Valores financeiros após descontos (base para venda e vencimentos)
    totalComNota = resultadoFiscal.totalComNota;
    totalSemNota = resultadoFiscal.totalSemNota;
    // Valores fiscais (para resumo consolidado)
    const totalComNotaFiscal = resultadoFiscal.totalComNotaFiscal;
    const totalSemNotaFiscal = resultadoFiscal.totalSemNotaFiscal;
    codigosFiscaisBarraAzul = resultadoFiscal.codigosFiscaisBarraAzul;

    // Exibição dos materiais (peso, palete, valores brutos)
    pedido.materiais?.forEach(item => {
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
                toggleConfirmacaoDevolucao(row, input, etiqueta, desc);
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

    // Exibe observações específicas do setor financeiro (definidas no momento da venda)
    // utilizando a propriedade `observacoes_setor` retornada pela API. Este bloco segue
    // o mesmo padrão de apresentação de observações utilizado em outras etapas,
    // como conferência de peso, garantindo uniformidade na interface. Se não
    // houver observações registradas para o financeiro, nada será exibido.
    if (pedido.observacoes_setor && pedido.observacoes_setor.length > 0) {
      const obsFin = document.createElement('div');
      // Estilos semelhantes ao aviso utilizado em conferência e outras páginas
      obsFin.style.background = '#fff3cd';
      obsFin.style.padding = '12px';
      obsFin.style.borderLeft = '5px solid #ffc107';
      obsFin.style.borderRadius = '4px';
      obsFin.style.marginTop = '20px';
      obsFin.innerHTML = `
        <strong>Observações para Financeiro:</strong><br>
        ${pedido.observacoes_setor.map(o => `<div>${o}</div>`).join('')}
      `;
      form.appendChild(obsFin);
    }

    const separador = document.createElement('div');
    separador.className = 'divider-financeiro';
    form.appendChild(separador);

    const containerCinza = document.createElement('div');
    containerCinza.className = 'resumo-financeiro';

    // Condição de pagamento à vista
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

    /**
     * Cálculo do total de descontos comerciais (compra e devolução).
     * Este valor não é diretamente subtraído novamente do total,
     * pois os descontos já foram aplicados na parte sem nota durante
     * o cálculo de totalSemNota. Mantemos a variável para auditorias futuras.
     */
    const totalDescontosComerciais = descontosPedido.reduce((soma, d) => {
      const peso = Number(d.peso_calculado || 0);
      const valorKg = Number(d.valor_unitario || 0);
      return soma + (peso * valorKg);
    }, 0);

    // Valor total da venda já com descontos aplicados na parte sem nota
    const totalVenda = totalComNota + totalSemNota;
    const totalVendaFmt = formatarMoeda(totalVenda);
    const numVencimentos = pedido.prazos_pagamento?.length || 1;

    // Função auxiliar para dividir valor total igualmente pelas parcelas,
    // com ajuste na última parcela para fechar o total corretamente.
    function calcularValoresVencimentos(valorTotal) {
      let parcelas = [];
      let base = Math.floor((valorTotal * 100) / numVencimentos) / 100;
      let totalParcial = 0;
      for (let i = 0; i < numVencimentos; i++) {
        if (i < numVencimentos - 1) {
          parcelas.push(base);
          totalParcial += base;
        } else {
          let ultima = (valorTotal - totalParcial);
          parcelas.push(ultima);
        }
      }
      return parcelas;
    }

    // Constrói um resumo fiscal consolidado se houver mais de um produto no pedido
    let resumoFiscalHtml = '';
    if (pedido.materiais && pedido.materiais.length > 1) {
      const totComFmt = formatarMoeda(totalComNotaFiscal);
      const totSemFmt = formatarMoeda(totalSemNotaFiscal);
      resumoFiscalHtml = `
        <div class="resumo-fiscal-consolidado" style="font-weight:600; padding:4px 10px;">
          <span style="color:#2e7d32;">Total com Nota: ${totComFmt}</span><br/>
          <span style="color:#c62828;">Total sem Nota: ${totSemFmt}</span>
        </div>
      `;
    }
    containerCinza.innerHTML += `
      <p><strong>Valor Total da Venda:</strong> <span class="etiqueta-valor-item" id="reset-vencimentos">${totalVendaFmt}</span></p>
      <div class="vencimentos-container"></div>
      <p class="erro-vencimentos" style="color:red;"></p>
      ${codigosFiscaisBarraAzul}
      ${resumoFiscalHtml}
      ${pedido.observacoes && pedido.observacoes.trim() !== '' ? `<div class="obs-pedido"><strong>Observações:</strong> ${pedido.observacoes}</div>` : ''}
    `;
    const vencContainer = containerCinza.querySelector('.vencimentos-container');
    const inputs = [];
    let valoresPadrao = calcularValoresVencimentos(totalVenda);

    /**
     * Recalcula totais com e sem nota e aplica descontos. Após o recálculo,
     * atualiza o valor total exibido, re-renderiza os vencimentos com os novos
     * valores padrão e atualiza o estado do botão de liberação.
     */
    function atualizarResumoFinanceiro() {
      // Recalcula valores e barra fiscal
      const resultadoFiscalNovo = aplicarDescontosGlobais(pedido, descontosPedido);
      const totalFinalVenda = resultadoFiscalNovo.totalComNota + resultadoFiscalNovo.totalSemNota;
      const totalFinalVendaFmt = formatarMoeda(totalFinalVenda);
      // Atualiza a exibição do total da venda
      const tagTotalVenda = containerCinza.querySelector('#reset-vencimentos');
      if (tagTotalVenda) tagTotalVenda.textContent = totalFinalVendaFmt;
      // Atualiza o resumo fiscal consolidado, se existir
      const resumoElem = containerCinza.querySelector('.resumo-fiscal-consolidado');
      if (resumoElem) {
        const totComFmt = formatarMoeda(resultadoFiscalNovo.totalComNotaFiscal);
        const totSemFmt = formatarMoeda(resultadoFiscalNovo.totalSemNotaFiscal);
        resumoElem.innerHTML = `<span style="color:#2e7d32;">Total com Nota: ${totComFmt}</span><br/><span style="color:#c62828;">Total sem Nota: ${totSemFmt}</span>`;
      }
      // Atualiza a barra fiscal existente com os novos valores por item
      const barras = containerCinza.querySelectorAll('.barra-fiscal');
      resultadoFiscalNovo.itensCalculados.forEach((ic, idx) => {
        const elem = barras[idx];
        if (!elem) return;
        const mat = ic.item;
        const codigoFmt = (mat.codigo_fiscal || '').toUpperCase();
        const totalCom = ic.totalComFiscal;
        const totalSem = ic.totalSemFiscal;
        const totalComFmt = formatarMoeda(totalCom);
        const totalSemFmt = formatarMoeda(totalSem);
        const valorKgComNotaFmt = formatarMoeda(ic.valorComNota || 0);
        let linhas = '';
        // Omitir linhas para códigos terminados em X (GX)
        if (!codigoFmt.endsWith('X')) {
          if (totalCom > 0) {
            linhas += `<span style="color:#2e7d32;">${totalComFmt} (${valorKgComNotaFmt}/kg)</span>`;
          }
          if (ic.valorSemNota > 0) {
            if (linhas) linhas += '<br />';
            const valorSemFmtFinal = totalSem > 0 ? totalSemFmt : formatarMoeda(0);
            linhas += `<span style="color:#c62828;">${valorSemFmtFinal}</span>`;
          } else {
            // Nota cheia: calcula o peso fiscal (peso na NF) com base no valor financeiro do item
            const pesoNF = Number(mat.valor_unitario) > 0 ? (ic.totalComFinanceiro / Number(mat.valor_unitario)) : 0;
            if (linhas) linhas += '<br />';
            linhas += `<span style="color:#c62828;">Peso NF: ${formatarPesoComMilhar(pesoNF)} Kg</span>`;
          }
        }
        // Usa formatarCodigoExibicao para exibir "GAP" no lugar de "Personalizar"
        elem.innerHTML = `${mat.nome_produto}: <span style="color:black;">(${formatarCodigoExibicao(codigoFmt)})</span><br />${linhas}`;
      });
      // Recalcula parcelas padrão
      valoresPadrao = calcularValoresVencimentos(totalFinalVenda);
      renderizarVencimentos(valoresPadrao);
      atualizarBotaoLiberar();
    }

    /**
     * Monta a interface dos vencimentos com campos de valor e botões de confirmação.
     * Recebe um array de valores que serão exibidos como padrão.
     */
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
        inp.addEventListener('blur', atualizarBotaoLiberar);
        const etiquetaConfirmado = document.createElement('span');
        etiquetaConfirmado.className = 'etiqueta-valor-item';
        etiquetaConfirmado.textContent = 'CONFIRMADO';
        etiquetaConfirmado.style.cursor = 'pointer';
        vencContainer.appendChild(row);
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
          const isConf = row.dataset.confirmado === 'true';
          // Recupera o total da venda exibido atualmente
          const tagTotalVendaAtual = containerCinza.querySelector('#reset-vencimentos');
          const totalVendaAtual = tagTotalVendaAtual
            ? parseFloat(tagTotalVendaAtual.textContent.replace(/[^\d,]/g, '').replace(',', '.'))
            : 0;
          // Calcula a soma dos valores confirmados incluindo o que está sendo confirmado
          const indicesNaoConfirmados = [];
          let totalConfirmado = 0;
          for (let j = 0; j < inputs.length; j++) {
            const rowAtual = inputs[j].closest('.vencimento-row');
            const confirmado = rowAtual.dataset.confirmado === 'true';
            const valor = parseFloat(inputs[j].value.replace(/\./g, '').replace(',', '.')) || 0;
            if (row === rowAtual && !isConf) {
              totalConfirmado += num;
            } else if (confirmado) {
              totalConfirmado += valor;
            } else {
              indicesNaoConfirmados.push(j);
            }
          }
          if (!isConf && totalConfirmado > totalVendaAtual + 0.01) {
            rowErr.textContent = 'A soma dos vencimentos excede o valor total da venda.';
            if (!row.contains(rowErr)) row.appendChild(rowErr);
            inp.focus();
            return;
          }
          if (row.contains(rowErr)) row.removeChild(rowErr);
          if (!isConf) {
            row.dataset.confirmado = 'true';
            inp.disabled = true;
            btn.replaceWith(etiquetaConfirmado);
          } else {
            row.dataset.confirmado = 'false';
            inp.disabled = false;
            etiquetaConfirmado.replaceWith(btn);
          }
          // Recalcula os vencimentos restantes proporcionalmente ao valor ainda não confirmado
          const valorRestante = totalVendaAtual - totalConfirmado;
          const qtdNaoConfirmados = indicesNaoConfirmados.length;
          if (qtdNaoConfirmados > 0) {
            const base = Math.floor((valorRestante * 100) / qtdNaoConfirmados) / 100;
            let acumulado = 0;
            indicesNaoConfirmados.forEach((idx, i) => {
              let valorAtual;
              if (i < qtdNaoConfirmados - 1) {
                valorAtual = base;
                acumulado += base;
              } else {
                valorAtual = valorRestante - acumulado;
              }
              inputs[idx].value = valorAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            });
          }
          atualizarBotaoLiberar();
        }
        btn.addEventListener('click', toggleConfirmacao);
        etiquetaConfirmado.addEventListener('click', toggleConfirmacao);
      }
    }

    /**
     * Restaura as parcelas para o padrão com base no total recalculado através
     * da função atualizarResumoFinanceiro().
     */
    function resetarVencimentosPadrao() {
      atualizarResumoFinanceiro();
    }

    /**
     * Verifica se a soma dos vencimentos é igual ao valor total atual da venda.
     * Caso não seja, exibe mensagem de erro e desabilita o botão de liberação.
     */
    function atualizarBotaoLiberar() {
      let soma = 0;
      for (let i = 0; i < numVencimentos; i++) {
        let valor = inputs[i].value.replace(/\D/g, '');
        valor = parseInt(valor, 10) / 100;
        soma += valor;
      }
      // Busca o total da venda atualizado
      const totalVendaAtualStr = containerCinza.querySelector('#reset-vencimentos')?.textContent || '';
      // Converte a string do total de venda em número decimal.
      // Remove qualquer caractere que não seja dígito ou vírgula, depois remove pontos
      // e converte a vírgula decimal para ponto. Isso evita problemas com prefixos como "R$".
      const totalVendaNum = parseFloat(
        totalVendaAtualStr
          .replace(/[^\d,]/g, '')
          .replace(/\./g, '')
          .replace(',', '.')
      ) || 0;
      // O elemento de erro pertence ao contêiner cinza deste formulário
      const erro = containerCinza.querySelector('.erro-vencimentos');
      // Seleciona o botão de liberação apenas dentro deste formulário
      const liberador = form.querySelector('#liberar-btn');
      // Se não houver botão de liberação ou elemento de erro, não há nada a atualizar
      if (!liberador || !erro) return;
      if (Math.abs(soma - totalVendaNum) > 0.02) {
        erro.style.display = 'block';
        // Exibe mensagem de validação sem duplicar o prefixo de moeda. A função
        // formatarMoeda já inclui "R$" na formatação.
        erro.textContent = `A soma dos vencimentos (${formatarMoeda(soma)}) difere do total ${formatarMoeda(totalVendaNum)}.`;
        liberador.disabled = true;
      } else {
        erro.style.display = 'none';
        erro.textContent = '';
        liberador.disabled = false;
      }
    }

    // Renderiza vencimentos iniciais
    renderizarVencimentos(valoresPadrao);
    // Após renderizar os vencimentos pela primeira vez, ajusta o estado do botão
    // de liberação conforme a soma das parcelas (evita que o botão permaneça
    // desabilitado sem motivo ao carregar a tela inicialmente)
    atualizarBotaoLiberar();
    form.appendChild(containerCinza);
    const valorTotalTag = containerCinza.querySelector('#reset-vencimentos');
    if (valorTotalTag) {
      valorTotalTag.style.cursor = 'pointer';
      valorTotalTag.title = 'Clique para redefinir os vencimentos para o padrão';
      valorTotalTag.onclick = resetarVencimentosPadrao;
    }
    // Bloco final para observações do financeiro
    const blocoFin = document.createElement('div');
    blocoFin.className = 'bloco-fin';
    blocoFin.innerHTML = `
      <label>Observações do Financeiro:</label>
      <textarea placeholder="Digite suas observações aqui..."></textarea>
      <button id="liberar-btn" class="btn btn-registrar" disabled>Confirmar Liberação do Cliente</button>
    `;
    const taFin = blocoFin.querySelector('textarea');
    const btnFin = blocoFin.querySelector('button');
    btnFin.addEventListener('click', () => confirmarFinanceiro(id, taFin.value));
    form.appendChild(blocoFin);
    // Agora que o botão de liberação foi adicionado ao formulário, atualiza seu estado
    atualizarBotaoLiberar();

    card.appendChild(form);
    header.addEventListener('click', () => {
      if (pedido.status !== 'Em Análise pelo Financeiro') return;
      form.style.display = form.style.display === 'block' ? 'none' : 'block';
    });
    lista.appendChild(card);
  });
}

/**
 * Envia a confirmação de liberação financeira do cliente.
 * @param {string} pedidoId
 * @param {string} observacoes
 */
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

/**
 * Adiciona zoom clicável para imagens de tickets.
 * @param {string} idImagem
 */
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

// Configura o carregamento inicial e filtros
document.addEventListener('DOMContentLoaded', () => {
  carregarPedidosFinanceiro();
  const filtro = document.getElementById('filtro-cliente');
  const ordenar = document.getElementById('ordenar');
  if (filtro) filtro.addEventListener('input', carregarPedidosFinanceiro);
  if (ordenar) ordenar.addEventListener('change', carregarPedidosFinanceiro);
});
