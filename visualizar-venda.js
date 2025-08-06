document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const idPedido = urlParams.get('id');

  if (!idPedido) return alert('ID do pedido não informado.');

  try {
    const resposta = await fetch(`/api/pedidos/${idPedido}`);
    if (!resposta.ok) throw new Error('Erro ao buscar dados do pedido.');
    const pedido = await resposta.json();
    console.log("🔎 Pedido recebido:", pedido);

    window.pedidoGlobal = pedido; // ✅ usado no card "Pedido Criado"

    preencherCabecalho(pedido);
    preencherInformacoesPrincipais(pedido);
    preencherHistorico(pedido.historico || []);
  } catch (error) {
    console.error(error);
    alert('Erro ao carregar informações da venda.');
  }
});

function preencherCabecalho(pedido) {
  const clienteNome = pedido.cliente?.trim() || '—';
  const empresa = pedido.empresa?.trim() || '—';

  const partes = clienteNome.split(/\s+/).filter(Boolean);
  const iniciais = partes.slice(0, 2).map(p => p[0].toUpperCase()).join('');

  document.getElementById('cliente-inicial').textContent = iniciais || '—';
  document.getElementById('cliente-nome').textContent = clienteNome;
  document.getElementById('empresa-fornecedora').textContent = formatarEmpresa(empresa);
}

function preencherInformacoesPrincipais(pedido) {
  const produto = pedido.materiais && pedido.materiais[0];

  document.getElementById('data-coleta').textContent = formatarData(pedido.data_coleta);
  document.getElementById('pedido-para').textContent = pedido.tipo || '—';
  document.getElementById('prazo-pagamento').textContent = pedido.prazo_pagamento || '—';
  document.getElementById('codigo-venda').textContent = produto?.codigo_fiscal || '—';

  if (String(pedido.condicao_pagamento_avista).toLowerCase() === 'à vista') {
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

function gerarConteudoHistoricoCriacao() {
  const cliente = window.pedidoGlobal;

  if (!cliente) return '<em>Sem informações registradas.</em>';

  const produtos = cliente.materiais || [];

  return `
    <div class="grid-info-pedido">
      <div><strong>Data:</strong> ${formatarData(cliente.data_criacao)}</div>
      <div><strong>Pedido Para:</strong> ${cliente.tipo || '—'}</div>
      <div><strong>Prazo:</strong> ${cliente.prazo_pagamento || '—'}</div>
      <div><strong>Peso Previsto:</strong> ${formatarNumero(produtos.reduce((acc, p) => acc + (p.peso || 0), 0))}</div>
    </div>
    ${produtos.length ? gerarTabelaProdutos(produtos) : ''}
    ${cliente.observacoes ? `<p><strong>Observações:</strong> ${cliente.observacoes}</p>` : ''}
  `;
}

function gerarConteudoHistorico(dados) {
  const temProdutos = dados.produtos && dados.produtos.length > 0;
  const temFotoPlaca = dados.foto_placa;

  return `
    <div class="historico-grid">
      <p><strong>Data:</strong> ${formatarData(dados.data)}</p>
      <p><strong>Usuário:</strong> ${dados.usuario || '—'}</p>
      <p><strong>Empresa:</strong> ${formatarEmpresa(dados.empresa)}</p>
      <p><strong>Pedido Para:</strong> ${dados.tipo_entrega || '—'}</p>
      <p><strong>Prazo:</strong> ${dados.prazo_pagamento || '—'}</p>
      <p><strong>Peso Previsto:</strong> ${formatarNumero(dados.peso_previsto)}</p>
      ${temFotoPlaca ? `
        <p><strong>Placa do Caminhão:</strong></p>
        <div style="margin: 10px 0;">
          <img src="${dados.foto_placa}" alt="Foto da Placa" style="max-width: 100%; max-height: 200px; border-radius: 6px; border: 1px solid #ccc;">
        </div>
      ` : ''}
    </div>
    ${temProdutos ? gerarTabelaProdutos(dados.produtos) : ''}
    ${dados.observacao ? `<p><strong>Observações:</strong> ${dados.observacao}</p>` : ''}
  `;
}

function gerarTabelaProdutos(lista) {
  let linhas = lista.map(p => `
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

function mostrarAba(qual) {
  document.querySelectorAll('.conteudo-aba').forEach(el => el.classList.remove('ativo'));
  document.querySelectorAll('.aba').forEach(el => el.classList.remove('ativa'));

  document.getElementById(`conteudo-${qual}`).classList.add('ativo');
  document.getElementById(`aba-${qual}`).classList.add('ativa');
}

function formatarData(data) {
  if (!data) return '—';
  return new Date(data).toLocaleDateString('pt-BR');
}

function formatarValor(valor) {
  if (!valor) return '—';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarNumero(num) {
  if (!num) return '—';
  return Number(num).toLocaleString('pt-BR');
}

function formatarEmpresa(nome) {
  if (!nome) return '—';
  const nomeFormatado = nome.toLowerCase();
  if (nomeFormatado === 'mellicz') return 'Mellicz Ambiental';
  if (nomeFormatado === 'pronasa') return 'Pronasa';
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}
