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

    // === Substituído para seguir padrão visual correto ===
    const linhaTempo = gerarLinhaTempoCompleta(pedido);
    const divTimeline = document.createElement('div');
    divTimeline.innerHTML = linhaTempo;
    card.appendChild(divTimeline);
    setTimeout(() => animarLinhaProgresso(divTimeline), 100);

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

      // Dados principais
    const info = document.createElement('div');
    info.className = 'dados-pedido';
    info.innerHTML = `
      <p><strong>Data Prevista da Coleta:</strong> ${formatarData(pedido.data_coleta)}</p>
      <p><strong>Tipo de Pedido:</strong> ${pedido.tipo_pedido || '—'}</p>
      <p><strong>Observações do Pedido:</strong> ${pedido.observacoes || '—'}</p>
    `;
    form.appendChild(info);

    // Bloco com os materiais
    if (!pedido.materiais || !pedido.materiais.length) {
      const aviso = document.createElement('p');
      aviso.textContent = 'Nenhum material cadastrado neste pedido.';
      aviso.style.margin = '12px 0';
      form.appendChild(aviso);
    } else {
      const materiaisTitulo = document.createElement('h4');
      materiaisTitulo.textContent = 'Materiais do Pedido';
      materiaisTitulo.style.marginTop = '20px';
      form.appendChild(materiaisTitulo);

      pedido.materiais.forEach(item => {
        const bloco = document.createElement('div');
        bloco.className = 'material-financeiro';

        const tipoPeso = item.tipo_peso === 'Aproximado' ? 'Aproximado' : 'Exato';
        const pesoPrevisto = formatarPesoSemDecimal(item.quantidade);
        const pesoCarregado = formatarPesoSemDecimal(item.peso_carregado);
        let descontosKg = item.descontos?.reduce((s, d) => s + Number(d.peso_calculado || 0), 0) || 0;
        const pesoFinalNum = (Number(item.peso_carregado) || 0) - descontosKg;
        const pesoFinal = formatarPesoSemDecimal(pesoFinalNum);
        const valorTotal = pesoFinalNum * (Number(item.valor_unitario) || 0);

        bloco.innerHTML = `
          <p><strong>${item.nome_produto}</strong> (${formatarMoeda(item.valor_unitario)}/Kg)</p>
          <p>Peso Previsto (${tipoPeso}): ${pesoPrevisto} Kg</p>
          <p>Peso Registrado na Carga: ${pesoCarregado} Kg</p>
          ${item.descontos?.length ? `
            <div class="descontos-aplicados">
              <p><i class="fa fa-tags"></i> Descontos:</p>
              <ul>
                ${item.descontos.map(d =>
                  `<li>${d.motivo}: ${formatarPesoSemDecimal(d.quantidade)} UNIDADES (${formatarPesoSemDecimal(d.peso_calculado)} Kg)</li>`
                ).join('')}
              </ul>
            </div>
          ` : ''}
          <p><strong>Peso Final:</strong> ${pesoFinal} Kg</p>
          <p><strong>Valor do Item:</strong> <span class="etiqueta-valor-item">${formatarMoeda(valorTotal)}</span></p>
        `;
        form.appendChild(bloco);
      });
    }

    // Separador visual
    const linha = document.createElement('hr');
    linha.className = 'linha-divisoria';
    form.appendChild(linha);

    // Bloco de vencimentos
    const containerVenc = document.createElement('div');
    containerVenc.className = 'vencimentos-bloco';

    const totalFinal = pedido.materiais.reduce((soma, item) => {
      let descontosKg = item.descontos?.reduce((s, d) => s + Number(d.peso_calculado || 0), 0) || 0;
      const pesoFinalNum = (Number(item.peso_carregado) || 0) - descontosKg;
      return soma + pesoFinalNum * (Number(item.valor_unitario) || 0);
    }, 0);

    const prazos = pedido.prazos_pagamento || [];
    const valores = [];
    const base = Math.floor((totalFinal * 100) / prazos.length) / 100;
    let acumulado = 0;

    for (let i = 0; i < prazos.length; i++) {
      valores[i] = i < prazos.length - 1 ? base : (totalFinal - acumulado);
      acumulado += valores[i];
    }

    const camposVencimentos = valores.map((valor, i) => {
      const data = new Date(prazos[i]);
      const dataFormatada = formatarData(data);
      return `
        <div class="vencimento-linha">
          <span class="badge-venc">Vencimento ${i + 1}</span>
          <span class="data-venc">${dataFormatada}</span>
          <input type="text" class="valor-venc" value="${valor.toFixed(2).replace('.', ',')}" />
        </div>
      `;
    }).join('');

    containerVenc.innerHTML = `
      <h4>Resumo Financeiro</h4>
      <p><strong>Valor Total do Pedido:</strong> <span class="etiqueta-valor-item">${formatarMoeda(totalFinal)}</span></p>
      <div class="vencimentos-container">${camposVencimentos}</div>
    `;
    form.appendChild(containerVenc);

      // Observações do financeiro
    const obsFinanceiro = document.createElement('div');
    obsFinanceiro.className = 'obs-financeiro';
    obsFinanceiro.innerHTML = `
      <label for="obs-fin-${id}">Observações do Financeiro:</label>
      <textarea id="obs-fin-${id}" rows="3" placeholder="Digite aqui as observações...">${pedido.obs_financeiro || ''}</textarea>
    `;
    form.appendChild(obsFinanceiro);

    // Botão de liberação
    const btn = document.createElement('button');
    btn.textContent = 'Confirmar Liberação Financeira';
    btn.className = 'btn-confirmar';
    btn.disabled = true;
    form.appendChild(btn);

    // Evento para verificar vencimentos válidos
    const inputs = form.querySelectorAll('.valor-venc');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        const valores = Array.from(inputs).map(inp => parseFloat(inp.value.replace(',', '.')) || 0);
        const soma = valores.reduce((acc, val) => acc + val, 0);
        const labelTotal = form.querySelector('.etiqueta-valor-item');
        const esperado = parseFloat(labelTotal.textContent.replace(/[^\d,]/g, '').replace(',', '.'));

        if (Math.abs(soma - esperado) < 0.05) {
          btn.disabled = false;
          btn.classList.remove('btn-desativado');
        } else {
          btn.disabled = true;
          btn.classList.add('btn-desativado');
        }
      });
    });

    // Clique do botão para confirmar
    btn.addEventListener('click', async () => {
      const valores = Array.from(inputs).map(inp => parseFloat(inp.value.replace(',', '.')) || 0);
      const prazos = pedido.prazos_pagamento || [];

      const vencimentos = valores.map((valor, i) => ({
        data: prazos[i],
        valor: valor
      }));

      const dados = {
        id: pedido.pedido_id || pedido.id,
        vencimentos,
        obs_financeiro: document.getElementById(`obs-fin-${id}`).value,
        status: 'Aguardando Emissão de NF',
        data_financeiro: new Date().toISOString().slice(0, 19).replace('T', ' ')
      };

      try {
        const res = await fetch(`/api/pedidos/${dados.id}/financeiro`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dados)
        });

        if (res.ok) {
          alert('Liberação financeira registrada com sucesso!');
          location.reload();
        } else {
          throw new Error('Erro ao salvar');
        }
      } catch (erro) {
        alert('Erro ao registrar liberação financeira.');
        console.error(erro);
      }
    });

    card.appendChild(form);

    // Clique no cabeçalho do card para abrir/fechar
    header.addEventListener('click', () => {
      const estaAberto = form.style.display === 'block';
      document.querySelectorAll('.formulario').forEach(f => f.style.display = 'none');
      form.style.display = estaAberto ? 'none' : 'block';
    });

    lista.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  carregarPedidosFinanceiro();

  const filtroInput = document.getElementById('filtro-cliente');
  const ordenarSelect = document.getElementById('ordenar');

  if (filtroInput) {
    filtroInput.addEventListener('input', carregarPedidosFinanceiro);
  }

  if (ordenarSelect) {
    ordenarSelect.addEventListener('change', carregarPedidosFinanceiro);
  }
});
