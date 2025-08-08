// visualizar-venda.js
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const idPedido = urlParams.get('id');

  if (!idPedido) return alert('ID do pedido não informado.');

  try {
    const resposta = await fetch(`/api/pedidos/${idPedido}`);
    if (!resposta.ok) throw new Error('Erro ao buscar dados do pedido.');
    const pedido = await resposta.json();

    // Disponibiliza globalmente para o histórico
    window.pedidoGlobal = pedido;

    preencherCabecalho(pedido);
    preencherInformacoesPrincipais(pedido);
    preencherHistorico(pedido.historico);
  } catch (error) {
    console.error(error);
    alert('Erro ao carregar informações da venda.');
  }
});

/* ========= CABEÇALHO & INFO PRINCIPAIS ========= */
function preencherCabecalho(pedido) {
  const clienteNome = (pedido.cliente || '').trim() || '—';
  const empresa = (pedido.empresa || '').trim() || '—';

  const partes = clienteNome.split(/\s+/).filter(Boolean);
  const iniciais = partes.slice(0, 2).map(p => p[0].toUpperCase()).join('');

  document.getElementById('cliente-inicial').textContent = iniciais || '—';
  document.getElementById('cliente-nome').textContent = clienteNome;
  document.getElementById('empresa-fornecedora').textContent = formatarEmpresa(empresa);
}

function preencherInformacoesPrincipais(pedido) {
  const produto = Array.isArray(pedido.materiais) ? pedido.materiais[0] : null;

  document.getElementById('data-coleta').textContent = formatarData(pedido.data_coleta);
  document.getElementById('pedido-para').textContent = pedido.tipo || '—';

  const prazosLegivel = Array.isArray(pedido.prazo_pagamento)
    ? pedido.prazo_pagamento.join(', ')
    : (pedido.prazo_pagamento || '—');
  document.getElementById('prazo-pagamento').textContent = prazosLegivel;

  document.getElementById('codigo-venda').textContent = produto?.codigo_fiscal || '—';

  if (String(pedido.condicao_pagamento_avista || '').toLowerCase().includes('vista')) {
    document.getElementById('condicao-vista').style.display = 'block';
  }

  if (produto) {
    document.getElementById('produto-nome').textContent = produto.nome_produto || '—';
    document.getElementById('produto-valor-quilo').textContent = formatarValor(produto.valor_unitario);
    document.getElementById('produto-peso').textContent = formatarNumero(produto.peso);
    document.getElementById('produto-tipo-peso').textContent = produto.tipo_peso || '—';
    document.getElementById('produto-subtotal').textContent = formatarValor(produto.valor_total);
  }
}

/* ================== HISTÓRICO =================== */
function normalizeHistorico(h) {
  if (Array.isArray(h)) return h;
  if (!h) return [];
  if (typeof h === 'object') return Object.values(h);
  return [];
}

function preencherHistorico(h) {
  const container = document.getElementById('historico-cards');
  container.innerHTML = '';

  const historico = normalizeHistorico(h);

  // 1) Pedido Criado — sempre mostra
  renderCard(container, {
    titulo: 'Pedido Criado',
    html: gerarConteudoHistoricoCriacao()
  });

  // 2) Entrada na Portaria — quando existir
  const entrada = historico.find(x =>
    (x.titulo || '').toLowerCase().replace(/\s+/g, '').includes('entradanaportaria')
  );
  if (entrada) {
    renderCard(container, {
      titulo: 'Entrada na Portaria',
      html: gerarConteudoHistorico(entrada),
      setor: 'Portaria'
    });
  } else {
    renderCard(container, {
      titulo: 'Entrada na Portaria',
      html: '<em>Sem informações registradas.</em>',
      setor: 'Portaria'
    });
  }

  // 3) Coleta Iniciada — cópia do card da Portaria (somente leitura)
  if (window.pedidoGlobal?.data_coleta_iniciada) {
    renderCard(container, {
      titulo: 'Coleta Iniciada Portaria',
      html: renderColetaIniciadaPortaria(window.pedidoGlobal),
      setor: 'Portaria',
      destaque: 'verde'
    });
  } else {
    renderCard(container, {
      titulo: 'Coleta Iniciada Portaria',
      html: '<em>Sem informações registradas.</em>',
      setor: 'Portaria'
    });
  }

  // 4) Peso Conferido
  const pesoConf = historico.find(x =>
    (x.titulo || '').toLowerCase().replace(/\s+/g, '').includes('pesoconferido')
  );
  renderCard(container, {
    titulo: 'Peso Conferido',
    html: pesoConf ? gerarConteudoHistorico(pesoConf) : '<em>Sem informações registradas.</em>'
  });

  // 5) Cliente Liberado (Financeiro)
  const liberado = historico.find(x =>
    (x.titulo || '').toLowerCase().includes('cliente liberado')
  );
  if (liberado) {
    renderCard(container, {
      titulo: 'Cliente Liberado',
      html: gerarConteudoHistorico(liberado),
      setor: 'Financeiro'
    });
  }

  // 6) Emissão de NF
  const nf = historico.find(x =>
    (x.titulo || '').toLowerCase().includes('nota fiscal')
  );
  if (nf) {
    renderCard(container, {
      titulo: 'Emissão de NF',
      html: gerarConteudoHistorico(nf),
      setor: 'Emissão de NF'
    });
  }

  // 7) Saída na Portaria
  const saida = historico.find(x =>
    (x.titulo || '').toLowerCase().includes('saída')
  );
  if (saida) {
    renderCard(container, {
      titulo: 'Saída na Portaria',
      html: gerarConteudoHistorico(saida),
      setor: 'Portaria'
    });
  }
}

// Componente base do card + badge do setor
function renderCard(container, { titulo, html, setor = '', destaque = '' }) {
  const card = document.createElement('div');
  card.className = 'card card-historico';
  if (destaque === 'verde') card.classList.add('hist-portaria'); // borda/realce opcional

  card.innerHTML = `
    <div class="card-titulo">
      <span>${titulo}</span>
      ${setor ? `<span class="badge-setor">${setor}</span>` : ''}
    </div>
    <div class="card-conteudo">
      ${html || '<em>Sem informações registradas.</em>'}
    </div>
  `;
  container.appendChild(card);
}

// Card de "Coleta Iniciada" idêntico ao da Portaria (somente leitura)
function renderColetaIniciadaPortaria(pedido) {
  const dt = formatarDataHora(pedido.data_coleta_iniciada);
  const motorista = pedido.nome_motorista || '—';
  const placa = pedido.placa_veiculo || '—';

  return `
    <div class="portaria-card readonly">
      <div class="linha-motorista">
        <div class="campo">
          <div class="rotulo">Data:</div>
          <div class="valor">${dt}</div>
        </div>
      </div>
      <div class="linha-motorista">
        <div class="campo">
          <div class="rotulo">Motorista:</div>
          <div class="valor">${motorista}</div>
        </div>
      </div>
      <div class="linha-motorista">
        <div class="campo">
          <div class="rotulo">Placa do Veículo:</div>
          <div class="valor">${placa}</div>
        </div>
      </div>
    </div>
  `;
}

/* ======== CONTEÚDOS AUXILIARES ======== */
function gerarConteudoHistoricoCriacao() {
  const pedido = window.pedidoGlobal;
  if (!pedido) return '<em>Sem informações registradas.</em>';

  const produtos = Array.isArray(pedido.materiais) ? pedido.materiais : [];

  return `
    <div class="grid-info-pedido">
      <div><strong>Data:</strong> ${formatarData(pedido.data_criacao)}</div>
      <div><strong>Pedido Para:</strong> ${pedido.tipo || '—'}</div>
      <div><strong>Prazo:</strong> ${Array.isArray(pedido.prazo_pagamento) ? pedido.prazo_pagamento.join(', ') : (pedido.prazo_pagamento || '—')}</div>
      <div><strong>Peso Previsto:</strong> ${formatarNumero(produtos.reduce((acc, p) => acc + (p.peso || 0), 0))}</div>
    </div>
    ${produtos.length ? gerarTabelaProdutos(produtos) : ''}
    ${pedido.observacoes ? `<p><strong>Observações:</strong> ${pedido.observacoes}</p>` : ''}
  `;
}

function gerarConteudoHistorico(dados) {
  if (!dados || typeof dados !== 'object') return '<em>Sem informações registradas.</em>';

  const partes = [];
  if (dados.data) partes.push(`<p><strong>Data:</strong> ${formatarDataHora(dados.data)}</p>`);
  if (dados.usuario) partes.push(`<p><strong>Usuário:</strong> ${dados.usuario}</p>`);
  if (dados.empresa) partes.push(`<p><strong>Empresa:</strong> ${formatarEmpresa(dados.empresa)}</p>`);
  if (dados.tipo_entrega) partes.push(`<p><strong>Pedido Para:</strong> ${dados.tipo_entrega}</p>`);
  if (dados.prazo_pagamento) partes.push(`<p><strong>Prazo:</strong> ${dados.prazo_pagamento}</p>`);
  if (dados.peso_previsto) partes.push(`<p><strong>Peso Previsto:</strong> ${formatarNumero(dados.peso_previsto)}</p>`);
  if (dados.observacao) partes.push(`<p><strong>Observações:</strong> ${dados.observacao}</p>`);

  if (!partes.length) return '<em>Sem informações registradas.</em>';
  return partes.join('');
}

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

/* =============== ABA =============== */
function mostrarAba(qual) {
  document.querySelectorAll('.conteudo-aba').forEach(el => el.classList.remove('ativo'));
  document.querySelectorAll('.aba').forEach(el => el.classList.remove('ativa'));
  document.getElementById(`conteudo-${qual}`).classList.add('ativo');
  document.getElementById(`aba-${qual}`).classList.add('ativa');
}

/* ============= FORMATADORES ============= */
function formatarData(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return '—';
  return dt.toLocaleDateString('pt-BR');
}

function formatarDataHora(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return '—';
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${dt.toLocaleDateString('pt-BR')} ${hh}:${mm}`;
}

function formatarValor(valor) {
  if (valor === null || valor === undefined || valor === '') return '—';
  const n = Number(valor);
  if (isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarNumero(num) {
  if (num === null || num === undefined || num === '') return '—';
  const n = Number(num);
  if (isNaN(n)) return '—';
  return n.toLocaleString('pt-BR');
}

function formatarEmpresa(nome) {
  if (!nome) return '—';
  const n = (nome + '').toLowerCase();
  if (n === 'mellicz') return 'Mellicz Ambiental';
  if (n === 'pronasa') return 'Pronasa';
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}
