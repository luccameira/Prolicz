// visualizar-venda.js
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const idPedido = urlParams.get('id');

  if (!idPedido) return alert('ID do pedido não informado.');

  try {
    const resposta = await fetch(`/api/pedidos/${idPedido}`);
    if (!resposta.ok) throw new Error('Erro ao buscar dados do pedido.');
    const pedido = await resposta.json();
    console.log("🔎 Pedido recebido:", pedido);

    // Guarda para uso nos cards do histórico (ex.: Coleta Iniciada - Portaria)
    window.pedidoGlobal = pedido;

    preencherCabecalho(pedido);
    preencherInformacoesPrincipais(pedido);
    preencherHistorico(pedido.historico || []);
  } catch (error) {
    console.error(error);
    alert('Erro ao carregar informações da venda.');
  }
});

/* ------------------------------ CABEÇALHO ------------------------------ */
function preencherCabecalho(pedido) {
  const clienteNome = (pedido.cliente || '—').toString().trim() || '—';
  const empresa = (pedido.empresa || '—').toString().trim() || '—';

  const partes = clienteNome.split(/\s+/).filter(Boolean);
  const iniciais = partes.slice(0, 2).map(p => p[0].toUpperCase()).join('');

  document.getElementById('cliente-inicial').textContent = iniciais || '—';
  document.getElementById('cliente-nome').textContent = clienteNome;
  document.getElementById('empresa-fornecedora').textContent = formatarEmpresa(empresa);
}

/* ---------------------- INFORMAÇÕES PRINCIPAIS ------------------------ */
function preencherInformacoesPrincipais(pedido) {
  const produto = Array.isArray(pedido.materiais) && pedido.materiais.length
    ? pedido.materiais[0]
    : null;

  document.getElementById('data-coleta').textContent = formatarData(pedido.data_coleta);
  document.getElementById('pedido-para').textContent = pedido.tipo || '—';

  // prazo_pagamento pode vir como array de strings ou string única
  const prazo = Array.isArray(pedido.prazo_pagamento)
    ? pedido.prazo_pagamento.join(', ')
    : (pedido.prazo_pagamento || '—');
  document.getElementById('prazo-pagamento').textContent = prazo || '—';

  document.getElementById('codigo-venda').textContent = produto?.codigo_fiscal || '—';

  // Condição à vista (mostrar somente quando realmente for "à vista")
  if (String(pedido.condicao_pagamento_avista || '').trim().toLowerCase() === 'à vista') {
    document.getElementById('condicao-vista').style.display = 'block';
  } else {
    document.getElementById('condicao-vista').style.display = 'none';
  }

  if (produto) {
    document.getElementById('produto-nome').textContent = produto.nome_produto || '—';
    document.getElementById('produto-valor-quilo').textContent = formatarValor(produto.valor_unitario);
    document.getElementById('produto-peso').textContent = formatarNumero(produto.peso);
    document.getElementById('produto-tipo-peso').textContent = produto.tipo_peso || '—';
    document.getElementById('produto-subtotal').textContent = formatarValor(produto.valor_total);
  }
}

/* ------------------------------ HISTÓRICO ------------------------------ */
function preencherHistorico(historico) {
  const container = document.getElementById('historico-cards');
  container.innerHTML = '';

  const eventos = [
    'Pedido Criado',
    'Entrada na Portaria',
    'Coleta Iniciada',
    'Peso Conferido',
    'Cliente Liberado',
    'Emissão de NF',
    'Saída na Portaria'
  ];

  eventos.forEach(evento => {
    // Render especial para Coleta Iniciada (cópia visual do card da Portaria)
    if (evento === 'Coleta Iniciada') {
      container.insertAdjacentHTML('beforeend', renderCardPortariaColeta(window.pedidoGlobal || {}));
      return;
    }

    const card = document.createElement('div');
    card.className = 'card card-historico';

    const tituloHtml = `
      <div class="card-titulo" onclick="this.parentNode.classList.toggle('aberto')">
        ${evento}
      </div>
    `;

    const conteudoHtml = (evento === 'Pedido Criado')
      ? gerarConteudoHistoricoCriacao()
      : (() => {
          const dados = historico.find(h =>
            (h.titulo || '').toLowerCase().replace(/\s/g, '') === evento.toLowerCase().replace(/\s/g, '')
          );
          return dados ? gerarConteudoHistorico(dados) : '<em>Sem informações registradas.</em>';
        })();

    card.innerHTML = `
      ${tituloHtml}
      <div class="card-conteudo">
        ${conteudoHtml}
      </div>
    `;

    container.appendChild(card);
  });
}

/* ------------ CARD ESPECÍFICO: COLETA INICIADA (PORTARIA) ------------- */
function renderCardPortariaColeta(pedido) {
  const data = formatarDataHora(pedido.data_coleta_iniciada);
  const motorista = pedido.nome_motorista || '—';
  const placa = pedido.placa_veiculo || '—';
  const ajudante = pedido.nome_ajudante || '';

  return `
    <div class="card-historico card-setor portaria aberto">
      <div class="card-titulo">
        <span>Coleta Iniciada</span>
        <span class="badge-setor">Portaria</span>
      </div>
      <div class="card-conteudo">
        <div class="bloco-motorista-visu">
          <div class="linha-info">
            <span class="rotulo">Data:</span>
            <span class="valor">${data}</span>
          </div>
          <div class="linha-info">
            <span class="rotulo">Motorista:</span>
            <span class="valor">${motorista}</span>
          </div>
          <div class="linha-info">
            <span class="rotulo">Placa do Veículo:</span>
            <span class="valor">${placa}</span>
          </div>
          ${ajudante ? `
          <div class="linha-info">
            <span class="rotulo">Ajudante:</span>
            <span class="valor">${ajudante}</span>
          </div>` : ''}
        </div>
      </div>
    </div>
  `;
}

/* --------- CONTEÚDO DOS OUTROS CARDS (GENÉRICO / EXISTENTE) ---------- */
function gerarConteudoHistoricoCriacao() {
  const pedido = window.pedidoGlobal;
  if (!pedido) return '<em>Sem informações registradas.</em>';

  const produtos = pedido.materiais || [];
  const prazo = Array.isArray(pedido.prazo_pagamento)
    ? pedido.prazo_pagamento.join(', ')
    : (pedido.prazo_pagamento || '—');

  return `
    <div class="grid-info-pedido">
      <div><strong>Data:</strong> ${formatarData(pedido.data_criacao)}</div>
      <div><strong>Pedido Para:</strong> ${pedido.tipo || '—'}</div>
      <div><strong>Prazo:</strong> ${prazo || '—'}</div>
      <div><strong>Peso Previsto:</strong> ${formatarNumero(produtos.reduce((acc, p) => acc + (p.peso || 0), 0))}</div>
    </div>
    ${produtos.length ? gerarTabelaProdutos(produtos) : ''}
    ${pedido.observacoes ? `<p><strong>Observações:</strong> ${pedido.observacoes}</p>` : ''}
  `;
}

function gerarConteudoHistorico(dados) {
  const temProdutos = dados.produtos && dados.produtos.length > 0;
  const temFotoPlaca = dados.foto_placa;
  const temUsuario = !!dados.usuario;
  const temData = dados.data || dados.criado_em;

  const conteudo = [];

  if (temData) {
    conteudo.push(`<p><strong>Data:</strong> ${formatarData(temData)}</p>`);
  }
  if (temUsuario) {
    conteudo.push(`<p><strong>Usuário:</strong> ${dados.usuario}</p>`);
  }
  if (dados.empresa) {
    conteudo.push(`<p><strong>Empresa:</strong> ${formatarEmpresa(dados.empresa)}</p>`);
  }
  if (dados.tipo_entrega) {
    conteudo.push(`<p><strong>Pedido Para:</strong> ${dados.tipo_entrega}</p>`);
  }
  if (dados.prazo_pagamento) {
    conteudo.push(`<p><strong>Prazo:</strong> ${dados.prazo_pagamento}</p>`);
  }
  if (dados.peso_previsto) {
    conteudo.push(`<p><strong>Peso Previsto:</strong> ${formatarNumero(dados.peso_previsto)}</p>`);
  }
  if (temFotoPlaca) {
    conteudo.push(`
      <p><strong>Placa do Caminhão:</strong></p>
      <div style="margin: 10px 0;">
        <img src="${dados.foto_placa}" alt="Foto da Placa" style="max-width: 100%; max-height: 200px; border-radius: 6px; border: 1px solid #ccc;">
      </div>
    `);
  }
  if (dados.observacao) {
    conteudo.push(`<p><strong>Observações:</strong> ${dados.observacao}</p>`);
  }

  if (!conteudo.length) {
    return '<em>Sem informações registradas.</em>';
  }

  return `
    <div class="historico-grid">
      ${conteudo.join('')}
    </div>
    ${temProdutos ? gerarTabelaProdutos(dados.produtos) : ''}
  `;
}

/* -------------------------- TABELA DE PRODUTOS ------------------------ */
function gerarTabelaProdutos(lista) {
  const linhas = (lista || []).map(p => `
    <tr>
      <td>${p.nome_produto || p.nome || '—'}</td>
      <td>${formatarNumero(p.peso)}</td>
      <td>${p.tipo_peso || '—'}</td>
      <td>${formatarValor(p.valor_unitario || p.valor_por_quilo)}</td>
      <td>${formatarValor(p.valor_total || p.subtotal)}</td>
      <td>${p.codigo_fiscal || '—'}</td>
    </tr>
  `).join('');

  return `
    <h4>Produtos do Pedido</h4>
    <table class="tabela-produtos">
      <thead>
        <tr>
          <th>Produto</th>
          <th>Peso</th>
          <th>Tipo de Peso</th>
          <th>Valor por Kg</th>
          <th>Subtotal</th>
          <th>Código</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
  `;
}

/* ------------------------------ ABAS/UI ------------------------------- */
function mostrarAba(qual) {
  document.querySelectorAll('.conteudo-aba').forEach(el => el.classList.remove('ativo'));
  document.querySelectorAll('.aba').forEach(el => el.classList.remove('ativa'));

  document.getElementById(`conteudo-${qual}`).classList.add('ativo');
  document.getElementById(`aba-${qual}`).classList.add('ativa');
}

/* ------------------------------ HELPERS ------------------------------- */
function formatarData(data) {
  if (!data) return '—';
  const dt = new Date(data);
  if (isNaN(dt)) return '—';
  return dt.toLocaleDateString('pt-BR');
}

function formatarDataHora(data) {
  if (!data) return '—';
  const dt = new Date(data);
  if (isNaN(dt)) return '—';
  const d = dt.toLocaleDateString('pt-BR');
  const h = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${d} ${h}`;
}

function formatarValor(valor) {
  if (valor === undefined || valor === null || valor === '') return '—';
  const n = Number(valor);
  if (isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarNumero(num) {
  if (num === undefined || num === null || num === '') return '—';
  const n = Number(num);
  if (isNaN(n)) return '—';
  return n.toLocaleString('pt-BR');
}

function formatarEmpresa(nome) {
  if (!nome) return '—';
  const lower = String(nome).toLowerCase();
  if (lower === 'mellicz') return 'Mellicz Ambiental';
  if (lower === 'pronasa') return 'Pronasa';
  return String(nome).charAt(0).toUpperCase() + String(nome).slice(1);
}
