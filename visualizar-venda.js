const seletorTabs = '.tabs-menu a';
const seletorConteudos = '.tab-content';
const camposProduto = ['nome-produto', 'valor-quilo', 'peso', 'tipo-peso', 'subtotal', 'codigo-fiscal'];

function mostrarAba(abaId) {
  document.querySelectorAll(seletorConteudos).forEach(tab => {
    tab.style.display = (tab.id === abaId) ? 'block' : 'none';
  });
  document.querySelectorAll(seletorTabs).forEach(link => {
    link.classList.toggle('active', link.dataset.tab === abaId);
  });
}

document.querySelectorAll(seletorTabs).forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    mostrarAba(link.dataset.tab);
  });
});

mostrarAba('info-pedido');

function extrairIniciais(nome) {
  if (!nome) return '--';
  const nomes = nome.trim().split(' ');
  return nomes.length >= 2 ? nomes[0][0] + nomes[1][0] : nomes[0][0];
}

const urlParams = new URLSearchParams(window.location.search);
const pedidoId = urlParams.get('id');

function formatarData(dataStr) {
  if (!dataStr) return '—';
  const data = new Date(dataStr);
  if (isNaN(data)) return '—';
  return data.toLocaleDateString('pt-BR');
}

function criarElementoObservacao(obs) {
  const div = document.createElement('div');
  div.className = 'observacao-item';

  const data = new Date(obs.data_criacao);
  const dataFormatada = data.toLocaleDateString('pt-BR') + ' às ' + data.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

  div.innerHTML = `
    <div class="observacao-cabecalho">
      <span class="observacao-data">${dataFormatada}</span>
      <strong class="observacao-usuario">${obs.usuario_nome || 'Usuário'}</strong>
    </div>
    <div class="observacao-texto">${obs.texto_observacao}</div>
  `;
  return div;
}

async function carregarObservacoes(pedido) {
  const container = document.getElementById('lista-observacoes');
  if (!container) return;

  container.innerHTML = '';

  if (!pedido.observacoes || pedido.observacoes.length === 0) {
    container.innerHTML = '<p style="color:#666;">Nenhuma observação registrada.</p>';
    return;
  }

  pedido.observacoes
    .sort((a,b) => new Date(a.data_criacao) - new Date(b.data_criacao))
    .forEach(obs => container.appendChild(criarElementoObservacao(obs)));
}

// Novo: criar elemento para registro (separado da observação)
function criarElementoRegistro(registro) {
  const div = document.createElement('div');
  div.className = 'observacao-item';

  const data = new Date(registro.data_criacao);
  const dataFormatada = data.toLocaleDateString('pt-BR') + ' às ' + data.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

  div.innerHTML = `
    <div class="observacao-cabecalho">
      <span class="observacao-data">${dataFormatada}</span>
      <strong class="observacao-usuario">${registro.usuario_nome || 'Usuário'}</strong>
    </div>
    <div class="observacao-texto">${registro.texto_registro || registro.texto || '---'}</div>
  `;
  return div;
}

// Novo: carregar registros da rota separada
async function carregarRegistros() {
  const container = document.getElementById('lista-registros');
  container.innerHTML = '';

  try {
    const res = await fetch(`/api/pedidos/${pedidoId}/registros`);
    if (!res.ok) throw new Error('Erro ao carregar registros');
    const registros = await res.json();

    if (!registros.length) {
      container.innerHTML = '<p style="color:#666;">Nenhum registro cadastrado.</p>';
      return;
    }

    registros
      .sort((a,b) => new Date(a.data_criacao) - new Date(b.data_criacao))
      .forEach(reg => container.appendChild(criarElementoRegistro(reg)));

  } catch (err) {
    container.innerHTML = `<p style="color:#c00;">Erro ao carregar registros: ${err.message}</p>`;
  }
}

// Remover controle para formulário de observação, manter controle para formulário de registro
function mostrarFormularioRegistro(show) {
  const form = document.getElementById('form-novo-registro');
  form.style.display = show ? 'block' : 'none';
  if (show) {
    const input = document.getElementById('input-novo-registro');
    input.value = '';
    input.focus();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btnAdicionarRegistro = document.getElementById('btn-adicionar-registro');
  const btnCancelarRegistro = document.getElementById('btn-cancelar-registro');
  const formRegistro = document.getElementById('form-novo-registro');
  const inputRegistro = document.getElementById('input-novo-registro');
  const containerRegistros = document.getElementById('lista-registros');

  btnAdicionarRegistro.addEventListener('click', () => {
    mostrarFormularioRegistro(true);
    btnAdicionarRegistro.style.display = 'none';
  });

  btnCancelarRegistro.addEventListener('click', () => {
    mostrarFormularioRegistro(false);
    btnAdicionarRegistro.style.display = 'inline-block';
  });

  formRegistro.addEventListener('submit', async e => {
    e.preventDefault();
    const texto = inputRegistro.value.trim();
    if (!texto) return alert('Digite um registro antes de salvar.');

    try {
      const res = await fetch(`/api/pedidos/${pedidoId}/registros`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ texto_registro: texto })
      });
      if (!res.ok) throw new Error('Erro ao salvar registro');
      const novoRegistro = await res.json();

      if (containerRegistros.querySelector('p')) containerRegistros.innerHTML = '';
      containerRegistros.appendChild(criarElementoRegistro(novoRegistro));

      mostrarFormularioRegistro(false);
      btnAdicionarRegistro.style.display = 'inline-block';
      inputRegistro.value = '';
    } catch (err) {
      alert('Erro ao salvar registro: ' + err.message);
    }
  });

  ativarToggleTimeline();
  carregarPedido();
  mostrarAba('info-pedido');

  // Botão desconto "Sim" funcionalidade
  const btnDescontoSim = document.getElementById('btn-desconto-sim');
  const detalhesDesconto = document.getElementById('detalhes-desconto');
  const selectTipoDesconto = document.getElementById('select-tipo-desconto');
  const blocoPaletes = document.getElementById('bloco-paletes');
  const blocoDevolucao = document.getElementById('bloco-devolucao');
  const blocoCompra = document.getElementById('bloco-compra');

  if (btnDescontoSim && detalhesDesconto && selectTipoDesconto) {
    btnDescontoSim.addEventListener('click', () => {
      const estaAtivo = btnDescontoSim.classList.contains('inativo');
      if (estaAtivo) {
        btnDescontoSim.classList.remove('inativo');
        detalhesDesconto.style.display = 'block';
      } else {
        btnDescontoSim.classList.add('inativo');
        detalhesDesconto.style.display = 'none';
        // Limpar seleção e esconder blocos
        selectTipoDesconto.value = '';
        atualizarBlocosDesconto();
      }
    });

    selectTipoDesconto.addEventListener('change', atualizarBlocosDesconto);
    // Inicializa ao carregar a página
    atualizarBlocosDesconto();
  }

  function atualizarBlocosDesconto() {
    const tipo = selectTipoDesconto.value;
    blocoPaletes.style.display = (tipo === 'paletes_grandes' || tipo === 'paletes_pequenos') ? 'block' : 'none';
    blocoDevolucao.style.display = (tipo === 'devolucao_material') ? 'block' : 'none';
    blocoCompra.style.display = (tipo === 'compra_material') ? 'block' : 'none';
  }
});

async function carregarPedido() {
  try {
    if (!pedidoId) { alert('Parâmetro id do pedido não fornecido na URL.'); return; }
    const res = await fetch(`/api/pedidos/${pedidoId}`);
    if (!res.ok) throw new Error('Pedido não encontrado');
    const pedido = await res.json();

    document.getElementById('cliente-inicial').textContent = extrairIniciais(pedido.cliente_nome || '').toUpperCase();
    document.getElementById('nome-cliente').textContent = pedido.cliente_nome || '—';
    document.getElementById('info-adicional').textContent = pedido.empresa || '—';
    document.getElementById('data-coleta').textContent = formatarData(pedido.data_coleta);
    document.getElementById('pedido-para').textContent = pedido.tipo || '—';
    document.getElementById('condicao-pagamento').textContent = pedido.condicao_pagamento_avista || '—';

    document.getElementById('prazo-pagamento').textContent = pedido.prazos_pagamento?.length
      ? pedido.prazos_pagamento.map(p => p.descricao).join(', ')
      : '—';

    if (pedido.materiais?.length) {
      const p = pedido.materiais[0];
      camposProduto.forEach(id => {
        let valor;
        switch(id) {
          case 'valor-quilo':
            valor = p.valor_unitario;
            break;
          case 'nome-produto':
            valor = p.nome_produto;
            break;
          case 'subtotal':
            valor = p.valor_total;
            break;
          case 'peso':
            valor = p.peso;
            break;
          case 'tipo-peso':
            valor = p.tipo_peso;
            break;
          case 'codigo-fiscal':
            valor = p.codigo_fiscal;
            break;
          default:
            valor = p[id.replace('-', '_')] || '—';
        }

        if (['valor-quilo', 'subtotal'].includes(id) && valor !== undefined && valor !== null && valor !== '—') {
          valor = `R$ ${Number(valor).toFixed(2).replace('.', ',')}`;
        }
        if (id === 'peso' && valor !== undefined && valor !== null && valor !== '—') {
          valor = Number(valor).toLocaleString('pt-BR');
        }
        const el = document.getElementById(id);
        el.textContent = valor ?? '—';
        el.style.textAlign = 'left';
      });
    } else {
      camposProduto.forEach(id => {
        const el = document.getElementById(id);
        el.textContent = '—';
        el.style.textAlign = 'left';
      });
    }

    // Preencher dados do Histórico do Pedido
    preencherHistoricoPedido(pedido);

    carregarObservacoes(pedido);
    carregarRegistros();
  } catch (error) {
    alert('Erro ao carregar pedido: ' + error.message);
  }
}

function preencherHistoricoPedido(pedido) {
  // Pedido Criado
  document.getElementById('historico-data1').textContent = formatarData(pedido.data_criacao) + ' ' + (pedido.hora_criacao || '');
  document.getElementById('historico-usuario').textContent = pedido.usuario_nome || '—';
  document.getElementById('historico-data-coleta').textContent = formatarData(pedido.data_coleta);
  document.getElementById('historico-peso-previsto').textContent = pedido.peso_previsto ? Number(pedido.peso_previsto).toLocaleString('pt-BR') : '—';
  document.getElementById('historico-empresa').textContent = pedido.empresa || '—';
  document.getElementById('historico-pedido-para').textContent = pedido.tipo || '—';
  document.getElementById('historico-prazo-pagamento').textContent = pedido.prazos_pagamento?.length
    ? pedido.prazos_pagamento.map(p => p.descricao).join(', ')
    : '—';

  // Preencher a tabela de produtos na seção 'Pedido Criado'
  const corpoTabela = document.getElementById('corpo-tabela-produtos-historico');
  if (corpoTabela && Array.isArray(pedido.materiais)) {
    corpoTabela.innerHTML = '';
    pedido.materiais.forEach(mat => {
      const linha = document.createElement('tr');
      linha.innerHTML = `
        <td>${mat.nome_produto || '—'}</td>
        <td>${mat.peso ? Number(mat.peso).toLocaleString('pt-BR') : '—'}</td>
        <td>${mat.tipo_peso || '—'}</td>
        <td>${mat.valor_unitario != null ? 'R$ ' + Number(mat.valor_unitario).toFixed(2).replace('.', ',') : '—'}</td>
        <td>${mat.valor_total != null ? 'R$ ' + Number(mat.valor_total).toFixed(2).replace('.', ',') : '—'}</td>
        <td>${mat.codigo_fiscal || '—'}</td>
      `;
      corpoTabela.appendChild(linha);
    });
  }

  // Observações formatadas por setor (agrupando observações iguais)
  if (Array.isArray(pedido.observacoes) && pedido.observacoes.length > 0) {
    // Agrupar observações por texto
    const mapaObs = {};
    for (const obs of pedido.observacoes) {
      const texto = obs.texto_observacao.trim();
      if (!mapaObs[texto]) mapaObs[texto] = [];
      if (obs.setor) mapaObs[texto].push(obs.setor);
    }
    const linhas = Object.entries(mapaObs).map(([texto, setores]) => {
      const setoresFormatados = setores.join(', ');
      return `<strong>Observação (${setoresFormatados}):</strong> ${texto}`;
    });
    const elObs = document.getElementById('historico-observacao');
       if (elObs) {
      // envolve cada observação num <p>
      elObs.innerHTML = linhas.map(linha => `<p>${linha}</p>`).join('');
    }
  } else {
    document.getElementById('historico-observacao').textContent = '—';
  }
}

function ativarToggleTimeline() {
  document.querySelectorAll('.timeline-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const id = toggle.getAttribute('aria-controls');
      const content = document.getElementById(id);
      if (!content) return;
      const isHidden = content.hasAttribute('hidden');
      if (isHidden) {
        content.removeAttribute('hidden');
        toggle.setAttribute('aria-expanded', 'true');
      } else {
        content.setAttribute('hidden', '');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    toggle.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle.click();
      }
    });
  });
}

// =========== INÍCIO SCRIPT EDIÇÃO INLINE ===========

document.addEventListener('DOMContentLoaded', () => {
  // Seleciona o botão editar
  const botaoEditar = document.getElementById('botao-editar');
  if (botaoEditar) {
    botaoEditar.addEventListener('click', () => {
      // Todos os campos editáveis: NÃO inclui o campo "Usuário"
      const camposEditaveis = [
        { id: 'historico-data-coleta', tipo: 'date' },
        { id: 'historico-empresa', tipo: 'text' },
        { id: 'historico-pedido-para', tipo: 'text' },
        { id: 'historico-prazo-pagamento', tipo: 'text' }
      ];
      camposEditaveis.forEach(campo => {
        const el = document.getElementById(campo.id);
        if (el && !el.classList.contains('ja-editando')) {
          const valorAtual = el.textContent;
          let input;
          if(campo.tipo === 'date'){
            // Converter data exibida para formato yyyy-mm-dd
            let valorDate = '';
            if(valorAtual && valorAtual !== '—'){
              const partes = valorAtual.trim().split('/');
              if(partes.length === 3){
                valorDate = `${partes[2]}-${partes[1].padStart(2,'0')}-${partes[0].padStart(2,'0')}`;
              }
            }
            input = document.createElement('input');
            input.type = 'date';
            input.value = valorDate;

            // Define data mínima como hoje
            const hoje = new Date();
            const ano = hoje.getFullYear();
            const mes = (hoje.getMonth() + 1).toString().padStart(2, '0');
            const dia = hoje.getDate().toString().padStart(2, '0');
            input.min = `${ano}-${mes}-${dia}`;
          } else {
            input = document.createElement('input');
            input.type = campo.tipo;
            input.value = valorAtual.trim() === '—' ? '' : valorAtual;
          }
          input.className = 'input-edicao-historico';
          input.style.width = Math.max(120, valorAtual.length * 10) + 'px';
          input.setAttribute('data-campo-original', valorAtual);
          el.innerHTML = '';
          el.appendChild(input);
          el.classList.add('ja-editando');
        }
      });
    });
  }
});

// Torna todos os campos editáveis ao clicar em EDITAR (exceto Usuário)
document.getElementById('botao-editar').addEventListener('click', function() {
  // Todos os spans exceto os de usuário
  const spansEditaveis = [
    'historico-data-coleta',
    'historico-empresa',
    'historico-pedido-para',
    'historico-prazo-pagamento'
  ];
  spansEditaveis.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('contenteditable', 'true');
  });

  // Torna todas as células da tabela de produtos editáveis
  const corpoTabela = document.getElementById('corpo-tabela-produtos-historico');
  if (corpoTabela) {
    Array.from(corpoTabela.querySelectorAll('td')).forEach(td => {
      td.setAttribute('contenteditable', 'true');
    });
  }
});

// Função para transformar os campos em editáveis (com SELECT nos campos corretos)
async function ativarEdicaoHistoricoPedido(pedido) {
  // 1. EMPRESA FORNECEDORA (select fixo)
  const empresaEl = document.getElementById('historico-empresa');
  if (empresaEl) {
    const empresas = ['Mellicz', 'Pronasa'];
    const atual = (empresaEl.textContent || '').trim();
    empresaEl.innerHTML = '';
    const select = document.createElement('select');
    empresas.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      if (atual.toLowerCase() === opt.toLowerCase()) option.selected = true;
      select.appendChild(option);
    });
    empresaEl.appendChild(select);
  }

  // 2. PEDIDO PARA (select fixo)
  const pedidoParaEl = document.getElementById('historico-pedido-para');
  if (pedidoParaEl) {
    const opcoes = ['Entregar', 'Retirada'];
    const atual = (pedidoParaEl.textContent || '').trim();
    pedidoParaEl.innerHTML = '';
    const select = document.createElement('select');
    opcoes.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      if (atual.toLowerCase() === opt.toLowerCase()) option.selected = true;
      select.appendChild(option);
    });
    pedidoParaEl.appendChild(select);
  }

  // 3. PRAZO DE PAGAMENTO (puxar do pedido, pode ter múltiplos)
  const prazoPagamentoEl = document.getElementById('historico-prazo-pagamento');
  if (prazoPagamentoEl) {
    const prazos = (pedido && Array.isArray(pedido.prazos_pagamento))
      ? pedido.prazos_pagamento.map(p => p.descricao || p)
      : [];
    const atual = (prazoPagamentoEl.textContent || '').trim();
    prazoPagamentoEl.innerHTML = '';
    const select = document.createElement('select');
    prazos.forEach(prazo => {
      const option = document.createElement('option');
      option.value = prazo;
      option.textContent = prazo;
      if (atual === prazo) option.selected = true;
      select.appendChild(option);
    });
    prazoPagamentoEl.appendChild(select);
  }

  // 4. TABELA DE PRODUTOS (produto, o peso é, código)
  const corpoTabela = document.getElementById('corpo-tabela-produtos-historico');
  if (corpoTabela && Array.isArray(pedido.materiais)) {
    // Buscar listas permitidas
    let produtosPermitidos = [];
    let codigosPermitidos = [];
    try {
      // Busca produtos autorizados e códigos fiscais via API
      const resProdutos = await fetch(`/api/pedidos/clientes/${pedido.cliente_id}/produtos`);
if (resProdutos.ok) {
  const lista = await resProdutos.json();
  // agora temos nome_produto e codigo_fiscal vindo do back
  produtosPermitidos = lista.map(item => item.nome_produto);
  codigosPermitidos   = lista.map(item => item.codigo_fiscal).filter(Boolean);
}
    } catch {}

    // Define opções de peso
    const opcoesPeso = ['Aproximado', 'Exato'];

    // Limpa e monta as linhas editáveis
    corpoTabela.innerHTML = '';
    pedido.materiais.forEach((mat, idx) => {
      const linha = document.createElement('tr');

      // PRODUTO (dropdown)
      const tdProduto = document.createElement('td');
      const selectProduto = document.createElement('select');
      produtosPermitidos.forEach(prod => {
        const option = document.createElement('option');
        option.value = prod;
        option.textContent = prod;
        if ((mat.nome_produto || mat.nome || '').trim() === prod) option.selected = true;
        selectProduto.appendChild(option);
      });
      tdProduto.appendChild(selectProduto);

      // PESO PREVISTO (campo editável)
      const tdPesoPrevisto = document.createElement('td');
      const inputPeso = document.createElement('input');
      inputPeso.type = 'text';
      inputPeso.value = mat.peso ? Number(mat.peso).toLocaleString('pt-BR') : '';
      tdPesoPrevisto.appendChild(inputPeso);

      // O PESO É (dropdown)
      const tdTipoPeso = document.createElement('td');
      const selectTipoPeso = document.createElement('select');
      opcoesPeso.forEach(tipo => {
        const option = document.createElement('option');
        option.value = tipo;
        option.textContent = tipo;
        if ((mat.tipo_peso || '').toLowerCase() === tipo.toLowerCase()) option.selected = true;
        selectTipoPeso.appendChild(option);
      });
      tdTipoPeso.appendChild(selectTipoPeso);

      // VALOR UNITÁRIO (editável)
      const tdValorUnitario = document.createElement('td');
      const inputValor = document.createElement('input');
      inputValor.type = 'text';
      inputValor.value = mat.valor_unitario != null ? Number(mat.valor_unitario).toFixed(2).replace('.', ',') : '';
      tdValorUnitario.appendChild(inputValor);

      // SUBTOTAL (editável ou só leitura)
      const tdSubtotal = document.createElement('td');
      const inputSubtotal = document.createElement('input');
      inputSubtotal.type = 'text';
      inputSubtotal.value = mat.valor_total != null ? Number(mat.valor_total).toFixed(2).replace('.', ',') : '';
      inputSubtotal.readOnly = true;
      tdSubtotal.appendChild(inputSubtotal);

      // CÓDIGO (dropdown)
      const tdCodigo = document.createElement('td');
      const selectCodigo = document.createElement('select');
      codigosPermitidos.forEach(cod => {
        const option = document.createElement('option');
        option.value = cod;
        option.textContent = cod;
        if ((mat.codigo_fiscal || '').trim() === cod) option.selected = true;
        selectCodigo.appendChild(option);
      });
      tdCodigo.appendChild(selectCodigo);

      linha.appendChild(tdProduto);
      linha.appendChild(tdPesoPrevisto);
      linha.appendChild(tdTipoPeso);
      linha.appendChild(tdValorUnitario);
      linha.appendChild(tdSubtotal);
      linha.appendChild(tdCodigo);

      corpoTabela.appendChild(linha);
    });
  }
}

// Ativar edição ao clicar no botão
document.getElementById('botao-editar').addEventListener('click', async function () {
  let pedido;
  try {
    const res = await fetch(window.location.pathname.replace(/\/[^\/]+$/, '') + `/api/pedidos/${pedidoId}`);
    pedido = await res.json();
  } catch (e) {
    pedido = window.ultimoPedidoCarregado || {};
  }
  ativarEdicaoHistoricoPedido(pedido);
});
