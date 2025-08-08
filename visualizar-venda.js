document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const idPedido = urlParams.get('id');

  if (!idPedido) return alert('ID do pedido não informado.');

  try {
    const resposta = await fetch(`/api/pedidos/${idPedido}`);
    if (!resposta.ok) throw new Error('Erro ao buscar dados do pedido.');
    const pedido = await resposta.json();

    // deixa global pra usar no “Pedido Criado”
    window.pedidoGlobal = pedido;

    preencherCabecalho(pedido);
    preencherInformacoesPrincipais(pedido);
    preencherHistorico(pedido);
  } catch (error) {
    console.error(error);
    alert('Erro ao carregar informações da venda.');
  }
});

/* =========================
   CABEÇALHO (avatar + nomes)
   ========================= */
function preencherCabecalho(pedido) {
  const clienteNome = (pedido.cliente || '—').trim();
  const empresa = (pedido.empresa || '—').trim();

  const partes = clienteNome.split(/\s+/).filter(Boolean);
  const iniciais = partes.slice(0, 2).map(p => p[0].toUpperCase()).join('');

  document.getElementById('cliente-inicial').textContent = iniciais || '—';
  document.getElementById('cliente-nome').textContent = clienteNome;
  document.getElementById('empresa-fornecedora').textContent = formatarEmpresa(empresa);
}

/* ===================================
   INFORMAÇÕES PRINCIPAIS (cartões top)
   =================================== */
function preencherInformacoesPrincipais(pedido) {
  const produto = Array.isArray(pedido.materiais) ? pedido.materiais[0] : null;

  document.getElementById('data-coleta').textContent = formatarDataBR(pedido.data_coleta);
  document.getElementById('pedido-para').textContent = pedido.tipo || '—';

  const prazosTexto = Array.isArray(pedido.prazo_pagamento) && pedido.prazo_pagamento.length
    ? pedido.prazo_pagamento.join(', ')
    : '—';
  document.getElementById('prazo-pagamento').textContent = prazosTexto;

  if (String(pedido.condicao_pagamento_avista || '').toLowerCase() === 'à vista') {
    document.getElementById('condicao-vista').style.display = 'block';
  }

  document.getElementById('codigo-venda').textContent = produto?.codigo_fiscal || '—';

  if (produto) {
    document.getElementById('produto-nome').textContent = produto.nome_produto || '—';
    document.getElementById('produto-valor-quilo').textContent = formatarMoeda(produto.valor_unitario);
    document.getElementById('produto-peso').textContent = formatarNumero(produto.peso);
    document.getElementById('produto-tipo-peso').textContent = produto.tipo_peso || '—';
    document.getElementById('produto-subtotal').textContent = formatarMoeda(produto.valor_total);
  }
}

/* =======================
   HISTÓRICO – os cartões
   ======================= */
function preencherHistorico(pedido) {
  const historico = Array.isArray(pedido.historico) ? pedido.historico : [];
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

    // título + (quando for portaria) o chip de setor
    let tituloHtml = `<div class="card-titulo" onclick="this.parentNode.classList.toggle('aberto')">${evento}</div>`;

    // conteúdo por evento
    let conteudoHtml = '';

    if (evento === 'Pedido Criado') {
      conteudoHtml = gerarConteudoHistoricoCriacao();
    } else if (evento === 'Coleta Iniciada') {
      // ⚠️ copiar visual da Portaria
      conteudoHtml = gerarCardColetaIniciadaPortariaLike(pedido);
      // título com chip “Portaria”
      tituloHtml = `
        <div class="card-titulo" onclick="this.parentNode.classList.toggle('aberto')">
          ${evento}
          <span class="chip-setor">Portaria</span>
        </div>
      `;
    } else {
      const dados = historico.find(h =>
        (h.titulo || '').toLowerCase().replace(/\s/g, '') === evento.toLowerCase().replace(/\s/g, '')
      );
      conteudoHtml = dados ? gerarConteudoHistoricoGenerico(dados) : '<em>Sem informações registradas.</em>';
    }

    card.innerHTML = `
      ${tituloHtml}
      <div class="card-conteudo">
        ${conteudoHtml}
      </div>
    `;

    container.appendChild(card);
  });
}

/* =============================================================
   “Pedido Criado” – usa os campos do pedido e lista de materiais
   ============================================================= */
function gerarConteudoHistoricoCriacao() {
  const pedido = window.pedidoGlobal;
  if (!pedido) return '<em>Sem informações registradas.</em>';

  const produtos = Array.isArray(pedido.materiais) ? pedido.materiais : [];

  return `
    <div class="grid-info-pedido">
      <div><strong>Data:</strong> ${formatarDataBR(pedido.data_criacao)}</div>
      <div><strong>Pedido Para:</strong> ${pedido.tipo || '—'}</div>
      <div><strong>Prazo:</strong> ${
        Array.isArray(pedido.prazo_pagamento) && pedido.prazo_pagamento.length
          ? pedido.prazo_pagamento.join(', ')
          : '—'
      }</div>
      <div><strong>Peso Previsto:</strong> ${
        formatarNumero(produtos.reduce((acc, p) => acc + (Number(p.peso) || 0), 0))
      }</div>
    </div>
    ${produtos.length ? gerarTabelaProdutos(produtos) : ''}
    ${pedido.observacoes?.length ? `
      <div style="margin-top:10px">
        <strong>Observações:</strong>
        <ul style="margin:6px 0 0 18px;">
          ${pedido.observacoes.map(o => `<li>${o.texto_observacao || o.texto || ''}</li>`).join('')}
        </ul>
      </div>` : ''
    }
  `;
}

/* ===================================================================================
   “Coleta Iniciada” – **CÓPIA VISUAL DA PORTARIA** (subcard/bloco e linhas de dados)
   =================================================================================== */
function gerarCardColetaIniciadaPortariaLike(pedido) {
  const data = pedido.data_coleta_iniciada || null;
  const motorista = pedido.nome_motorista || '—';
  const placa = pedido.placa_veiculo || '—';

  if (!data && motorista === '—' && placa === '—') {
    return '<em>Sem informações registradas.</em>';
  }

  // Subcard/bloco no mesmo espírito do card da Portaria (somente leitura)
  return `
    <div class="subcard bloco-motorista bloco-motorista--readonly">
      <h3><i class="fas fa-id-card"></i> Dados do Motorista</h3>

      <div class="linha-motorista">
        <div>
          <label>Data</label>
          <input type="text" value="${formatarDataHoraCurta(data)}" readonly>
        </div>
        <div></div>
      </div>

      <div class="linha-motorista">
        <div>
          <label>Motorista</label>
          <input type="text" value="${motorista}" readonly>
        </div>
        <div>
          <label>Placa do Veículo</label>
          <input type="text" value="${placa}" readonly>
        </div>
      </div>
    </div>
  `;
}

/* ===========================================================
   Genérico para outros eventos quando vier do array histórico
   =========================================================== */
function gerarConteudoHistoricoGenerico(dados) {
  const partes = [];

  if (dados.data) partes.push(`<p><strong>Data:</strong> ${formatarDataBR(dados.data)}</p>`);
  if (dados.usuario) partes.push(`<p><strong>Usuário:</strong> ${dados.usuario}</p>`);
  if (dados.empresa) partes.push(`<p><strong>Empresa:</strong> ${formatarEmpresa(dados.empresa)}</p>`);
  if (dados.tipo_entrega) partes.push(`<p><strong>Pedido Para:</strong> ${dados.tipo_entrega}</p>`);
  if (dados.prazo_pagamento) partes.push(`<p><strong>Prazo:</strong> ${dados.prazo_pagamento}</p>`);
  if (dados.peso_previsto) partes.push(`<p><strong>Peso Previsto:</strong> ${formatarNumero(dados.peso_previsto)}</p>`);
  if (dados.observacao) partes.push(`<p><strong>Observações:</strong> ${dados.observacao}</p>`);

  return partes.length ? partes.join('') : '<em>Sem informações registradas.</em>';
}

/* ===========================
   Tabela de produtos (reuso)
   =========================== */
function gerarTabelaProdutos(lista) {
  const linhas = (lista || []).map(p => `
    <tr>
      <td>${p.nome_produto || p.nome || '—'}</td>
      <td>${formatarNumero(p.peso)}</td>
      <td>${p.tipo_peso || '—'}</td>
      <td>${formatarMoeda(p.valor_unitario || p.valor_por_quilo)}</td>
      <td>${formatarMoeda(p.valor_total || p.subtotal)}</td>
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

/* ==========
   Utilitários
   ========== */
function mostrarAba(qual) {
  document.querySelectorAll('.conteudo-aba').forEach(el => el.classList.remove('ativo'));
  document.querySelectorAll('.aba').forEach(el => el.classList.remove('ativa'));

  document.getElementById(`conteudo-${qual}`).classList.add('ativo');
  document.getElementById(`aba-${qual}`).classList.add('ativa');
}

function formatarDataBR(dataISO) {
  if (!dataISO) return '—';
  const d = new Date(dataISO);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('pt-BR');
}

function formatarDataHoraCurta(dataISO) {
  if (!dataISO) return '—';
  const d = new Date(dataISO);
  if (isNaN(d)) return '—';
  const data = d.toLocaleDateString('pt-BR');
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${data} ${hora}`;
}

function formatarMoeda(v) {
  const n = Number(v);
  if (!isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarNumero(n) {
  const v = Number(n);
  if (!isFinite(v)) return '—';
  return v.toLocaleString('pt-BR');
}

function formatarEmpresa(nome) {
  if (!nome) return '—';
  const low = nome.toLowerCase();
  if (low === 'mellicz') return 'Mellicz Ambiental';
  if (low === 'pronasa') return 'Pronasa';
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}
