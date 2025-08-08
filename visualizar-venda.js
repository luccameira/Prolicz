// visualizar-venda.js
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const idPedido = urlParams.get('id');
  if (!idPedido) return alert('ID do pedido não informado.');

  try {
    const res = await fetch(`/api/pedidos/${idPedido}`);
    if (!res.ok) throw new Error('Erro ao buscar dados do pedido.');
    const pedido = await res.json();

    // Guarda global para uso pontual
    window.pedidoGlobal = pedido;

    preencherCabecalho(pedido);
    preencherInformacoesPrincipais(pedido);
    preencherHistoricoComTimeline(pedido.timeline || [], pedido);
  } catch (e) {
    console.error(e);
    alert('Erro ao carregar informações da venda.');
  }
});

/* ========= Preenchimento: Cabeçalho ========= */
function preencherCabecalho(pedido) {
  const clienteNome = (pedido.cliente || '—').trim();
  const empresa = formatarEmpresa(pedido.empresa);

  const iniciais = clienteNome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('');

  document.getElementById('cliente-inicial').textContent = iniciais || '—';
  document.getElementById('cliente-nome').textContent = clienteNome;
  document.getElementById('empresa-fornecedora').textContent = empresa || '—';
}

/* ========= Preenchimento: Informações Principais ========= */
function preencherInformacoesPrincipais(pedido) {
  const cab = pedido.cabecalho || {};
  const itens = pedido.itens || pedido.materiais || [];

  // Campos básicos
  setText('data-coleta', formatarData(cab.data_coleta || pedido.data_coleta));
  setText('pedido-para', cab.tipo || pedido.tipo || '—');

  // Prazo: junta descrições (sem “(x dias)” extra se não quiser)
  const prazosStr = (cab.prazos || [])
    .map(p => p.descricao)
    .filter(Boolean)
    .join(', ');
  setText('prazo-pagamento', prazosStr || '—');

  // Condição à vista
  const condVista = (cab.condicao_pagamento_avista || pedido.condicao_pagamento_avista || '').toString().toLowerCase();
  if (condVista === 'à vista' || condVista === 'a vista' || condVista === 'avista') {
    document.getElementById('condicao-vista').style.display = 'block';
  } else {
    document.getElementById('condicao-vista').style.display = 'none';
  }

  // Código fiscal (se houver em itens, pega do primeiro; se não, “—”)
  const cod = itens[0]?.codigo_fiscal || '—';
  setText('codigo-venda', cod);

  // Bloco de produto:
  //  - se houver 1 item, preenche os 5 campos como antes
  //  - se houver >1, mostra tabela de produtos dentro do card mantendo os spans (não quebra HTML)
  const cardProduto = document.querySelectorAll('.card')[1]; // segundo card é "Informações do Produto"
  if (!cardProduto) return;

  if (!itens.length) {
    // Nada: mantém placeholders
    setText('produto-nome', '—');
    setText('produto-valor-quilo', '—');
    setText('produto-peso', '—');
    setText('produto-tipo-peso', '—');
    setText('produto-subtotal', '—');
    return;
  }

  if (itens.length === 1) {
    const p = itens[0];
    setText('produto-nome', p.nome_produto || '—');
    setText('produto-valor-quilo', formatarValor(p.valor_unitario));
    setText('produto-peso', formatarNumero(p.peso));
    setText('produto-tipo-peso', p.tipo_peso || '—');
    setText('produto-subtotal', formatarValor(p.valor_total));
  } else {
    // Preenche com "vários" e injeta tabela
    setText('produto-nome', `${itens.length} produtos`);
    setText('produto-valor-quilo', '—');
    setText('produto-peso', '—');
    setText('produto-tipo-peso', '—');
    setText('produto-subtotal', '—');

    // Remove tabela anterior (se recarregar)
    const tabelaAntiga = cardProduto.querySelector('.tabela-produtos-informacoes');
    if (tabelaAntiga) tabelaAntiga.remove();

    const wrapper = document.createElement('div');
    wrapper.className = 'tabela-produtos-informacoes';
    wrapper.innerHTML = montarTabelaProdutos(itens);
    cardProduto.appendChild(wrapper);
  }
}

/* ========= Histórico (Timeline) ========= */
function preencherHistoricoComTimeline(timeline, pedido) {
  const container = document.getElementById('historico-cards');
  container.innerHTML = '';

  if (!timeline.length) {
    container.innerHTML = '<div class="card card-historico"><div class="card-titulo">Histórico</div><div class="card-conteudo"><em>Sem informações registradas.</em></div></div>';
    return;
  }

  // Ordem natural já vem do backend, mas só por garantia:
  const ordem = [
    'pedido_criado',
    'carga',
    'carga_finalizada',
    'conferencia_peso',
    'financeiro',
    'nf',
    'saida'
  ];
  timeline.sort((a, b) => ordem.indexOf(a.etapa) - ordem.indexOf(b.etapa));

  timeline.forEach(evento => {
    const card = document.createElement('div');
    card.className = 'card card-historico';

    const titulo = document.createElement('div');
    titulo.className = 'card-titulo';
    titulo.textContent = evento.titulo || 'Etapa';
    titulo.onclick = () => card.classList.toggle('aberto');

    const conteudo = document.createElement('div');
    conteudo.className = 'card-conteudo';
    conteudo.innerHTML = montarConteudoEtapa(evento, pedido);

    card.appendChild(titulo);
    card.appendChild(conteudo);
    container.appendChild(card);
  });
}

function montarConteudoEtapa(ev, pedido) {
  const payload = ev.payload || {};
  const linhas = [];

  if (ev.data) linhas.push(linhaInfo('Data', formatarData(ev.data)));
  if (ev.usuario) linhas.push(linhaInfo('Usuário', ev.usuario));

  switch (ev.etapa) {
    case 'pedido_criado': {
      // Snapshot gerado no momento da criação pelo backend
      const prazos = (payload.snapshot_prazos || []).map(p => p.descricao).join(', ');
      if (prazos) linhas.push(linhaInfo('Prazos', prazos));

      const obs = formatarObservacoes(payload.observacoes_setor);
      if (obs) linhas.push(linhaBloco('Observações (Geral)', obs));

      let html = `<div class="historico-grid">${linhas.join('')}</div>`;
      if ((payload.snapshot_itens || []).length) {
        html += `<h4>Produtos do Pedido</h4>${montarTabelaProdutos(payload.snapshot_itens)}`;
      }
      return html;
    }

    case 'carga': {
      if (payload.nome_motorista) linhas.push(linhaInfo('Motorista', payload.nome_motorista));
      if (payload.placa) linhas.push(linhaInfo('Placa do Veículo', payload.placa));
      if (payload.nome_ajudante) linhas.push(linhaInfo('Ajudante(s)', payload.nome_ajudante));

      const obs = formatarObservacoes(payload.observacoes_setor);
      if (obs) linhas.push(linhaBloco('Observações - Carga e Descarga', obs));

      return `<div class="historico-grid">${linhas.join('')}</div>`;
    }

    case 'carga_finalizada': {
      if (payload.ticket_balanca) {
        linhas.push(linhaLink('Ticket da Balança', `/uploads/tickets/${payload.ticket_balanca}`));
      } else {
        linhas.push(linhaInfo('Ticket da Balança', '—'));
      }
      return `<div class="historico-grid">${linhas.join('')}</div>`;
    }

    case 'conferencia_peso': {
      const obs = formatarObservacoes(payload.observacoes_setor);
      if (obs) linhas.push(linhaBloco('Observações - Conferência de Peso', obs));
      return `<div class="historico-grid">${linhas.join('')}</div>`;
    }

    case 'financeiro': {
      const condVista = payload.condicao_pagamento_avista || pedido?.cabecalho?.condicao_pagamento_avista;
      if (condVista) linhas.push(linhaInfo('Condição para pagamento à vista', condVista));

      const obs = formatarObservacoes(payload.observacoes_setor);
      if (obs) linhas.push(linhaBloco('Observações - Financeiro', obs));
      return `<div class="historico-grid">${linhas.join('')}</div>`;
    }

    case 'nf': {
      if (payload && (payload.numero || payload.arquivo)) {
        if (payload.numero) linhas.push(linhaInfo('Número da NF', payload.numero));
        if (payload.arquivo) {
          linhas.push(linhaLink('Arquivo da NF', `/uploads/notas/${payload.arquivo}`));
        }
      } else {
        linhas.push(linhaInfo('Nota Fiscal', '—'));
      }
      return `<div class="historico-grid">${linhas.join('')}</div>`;
    }

    case 'saida': {
      return `<div class="historico-grid">${linhas.join('') || '<em>Saída registrada.</em>'}</div>`;
    }

    default:
      return `<div class="historico-grid">${linhas.join('') || '<em>Sem informações registradas.</em>'}</div>`;
  }
}

/* ========= Utilitários de montagem visual ========= */
function montarTabelaProdutos(lista) {
  const linhas = (lista || []).map(p => `
    <tr>
      <td>${esc(p.nome_produto || p.nome || '—')}</td>
      <td>${formatarNumero(p.peso)}</td>
      <td>${esc(p.tipo_peso || '—')}</td>
      <td>${formatarValor(p.valor_unitario || p.valor_por_quilo)}</td>
      <td>${formatarValor(p.valor_total || p.subtotal)}</td>
      <td>${esc(p.codigo_fiscal || '—')}</td>
    </tr>
  `).join('');

  return `
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

function formatarObservacoes(lista) {
  if (!Array.isArray(lista) || !lista.length) return '';
  return lista.map(o => {
    const cab = [];
    if (o.usuario_nome) cab.push(`<strong>${esc(o.usuario_nome)}</strong>`);
    if (o.data_criacao) cab.push(`<span style="color:#666">${formatarData(o.data_criacao)}</span>`);
    const header = cab.length ? `<div>${cab.join(' — ')}</div>` : '';
    return `<div style="margin:6px 0 10px;">
      ${header}
      <div>${esc(o.texto || o.texto_observacao || '')}</div>
    </div>`;
  }).join('');
}

function linhaInfo(label, valor) {
  return `<p><strong>${esc(label)}:</strong> ${valor ?? '—'}</p>`;
}

function linhaBloco(label, html) {
  if (!html) return '';
  return `<div style="margin-top:8px;">
    <strong>${esc(label)}:</strong>
    <div style="margin-top:6px;">${html}</div>
  </div>`;
}

function linhaLink(label, href) {
  return `<p><strong>${esc(label)}:</strong> <a href="${href}" target="_blank" rel="noopener">abrir</a></p>`;
}

/* ========= Abas ========= */
function mostrarAba(qual) {
  document.querySelectorAll('.conteudo-aba').forEach(el => el.classList.remove('ativo'));
  document.querySelectorAll('.aba').forEach(el => el.classList.remove('ativa'));

  document.getElementById(`conteudo-${qual}`).classList.add('ativo');
  document.getElementById(`aba-${qual}`).classList.add('ativa');
}
window.mostrarAba = mostrarAba; // deixar disponível no onclick do HTML

/* ========= Helpers ========= */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text ?? '—';
}

function formatarData(data) {
  if (!data) return '—';
  try {
    const d = new Date(data);
    if (isNaN(d)) return '—';
    // Se tiver hora, mostra dd/mm/aaaa hh:mm; senão, só data
    const base = d.toLocaleDateString('pt-BR');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return (d.getHours() || d.getMinutes()) ? `${base} ${hh}:${mm}` : base;
  } catch {
    return '—';
  }
}

function formatarValor(v) {
  if (v === undefined || v === null || v === '') return '—';
  const n = Number(v);
  if (isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarNumero(v) {
  if (v === undefined || v === null || v === '') return '—';
  const n = Number(v);
  if (isNaN(n)) return '—';
  return n.toLocaleString('pt-BR');
}

function formatarEmpresa(nome) {
  if (!nome) return '—';
  const n = (nome + '').toLowerCase();
  if (n === 'mellicz') return 'Mellicz Ambiental';
  if (n === 'pronasa') return 'Pronasa';
  // já vem “Mellicz Ambiental” na maioria dos casos
  return nome;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
