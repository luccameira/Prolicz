function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR');
}

function formatarPeso(valor) {
  if (!valor) return '0 kg';
  const num = Number(valor);
  return Number.isInteger(num)
    ? `${num.toLocaleString('pt-BR')} kg`
    : `${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
}

async function carregarPedidosConferencia() {
  const res = await fetch('/api/pedidos/conferencia');
  let pedidos;

  try {
    const data = await res.json();
    if (!Array.isArray(data)) {
      console.error('Resposta inesperada da API:', data);
      document.getElementById('lista-pedidos').innerHTML = "<p style='padding: 0 25px;'>Erro ao carregar pedidos.</p>";
      return;
    }
    pedidos = data;
  } catch (error) {
    console.error('Erro ao interpretar resposta JSON:', error);
    document.getElementById('lista-pedidos').innerHTML = "<p style='padding: 0 25px;'>Erro ao carregar pedidos.</p>";
    return;
  }

  const lista = document.getElementById('lista-pedidos');
  lista.innerHTML = '';

  if (!pedidos.length) {
    lista.innerHTML = "<p style='padding: 0 25px;'>Nenhum pedido disponível para conferência.</p>";
    return;
  }

  pedidos.forEach(pedido => {
    const idPedido = pedido.pedido_id || pedido.id;

    const card = document.createElement('div');
    card.className = 'card';

    let statusHtml = '';
    if (pedido.status === 'Em Análise pelo Financeiro') {
      statusHtml = `
        <div class="status-badge status-verde">
          <i class="fa fa-check-circle"></i> Peso Conferido
        </div>
      `;
    } else {
      statusHtml = `
        <div class="status-badge status-amarelo">
          <i class="fa fa-balance-scale"></i> ${pedido.status}
        </div>
      `;
    }

    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `
      <div class="info">
        <h3>${pedido.cliente}</h3>
        <p>Data Prevista: ${formatarData(pedido.data_coleta || new Date())}</p>
      </div>
      ${statusHtml}
    `;
    card.appendChild(header);

    card.innerHTML += gerarLinhaTempoCompleta(pedido);
    setTimeout(() => {
      const timeline = card.querySelector('.timeline-simples');
      if (timeline) animarLinhaProgresso(timeline);
    }, 20);

    const form = document.createElement('div');
    form.className = 'formulario';
    form.style.display = 'none';

    let ticketsHTMLGeral = '';
    let blocoDescontosExtra = '';

    pedido.materiais.forEach((item, index) => {
      const pesoPrevisto = formatarPeso(item.quantidade);
      const pesoCarregado = formatarPeso(item.peso_carregado);
      const tipoPeso = item.tipo_peso === 'Aproximado' ? 'Aproximado' : 'Exato';

      let descontosHTML = '';
      let totalDescontos = 0;
      let descontosExtraHTML = '';

      const descontosPalete = item.descontos.filter(d =>
        d.motivo === 'Palete Pequeno' || d.motivo === 'Palete Grande'
      );
      const descontosMaterial = item.descontos.filter(d =>
        d.motivo === 'Compra de Material' || d.motivo === 'Devolução de Material'
      );

      if (descontosPalete.length > 0) {
        const linhas = descontosPalete.map((desc, idx) => {
          const qtdUnidades = parseInt(desc.quantidade || 0);
          const pesoTotal = formatarPeso(desc.peso_calculado);
          totalDescontos += Number(desc.peso_calculado || 0);
          return `<li>${desc.motivo}: ${qtdUnidades} unidades — ${pesoTotal}</li>`;
        }).join('');

        descontosHTML = `
          <div style="background-color: #fff9e6; padding: 12px; border-radius: 6px; border: 1px solid #ffe08a; margin-top: 14px;">
            <p style="font-weight: 600; margin: 0 0 6px;"><i class="fa fa-tags"></i> Descontos Aplicados:</p>
            <ul style="padding-left: 20px; margin: 0;">${linhas}</ul>
          </div>
        `;
      }

        if (descontosMaterial.length > 0) {
        descontosMaterial.forEach((desc, idx) => {
          const qtd = formatarPeso(desc.peso_calculado);
          const tipo = desc.motivo;
          const mat = desc.material || item.nome_produto;

          descontosExtraHTML += `<li>${tipo} — ${mat}: ${qtd}</li>`;

          if (desc.ticket_devolucao) {
            const ticketIdDev = `ticket-devolucao-${idPedido}-${index}-${idx}`;
            ticketsHTMLGeral += `
              <div style="display:inline-block;margin-right:12px;">
                <label style="font-weight:bold;">Ticket Devolução:</label><br>
                <img id="${ticketIdDev}" src="/uploads/tickets/${desc.ticket_devolucao}" alt="Ticket Devolução" style="width: 120px; border-radius: 6px; margin-top: 8px; cursor: pointer; object-fit: cover;">
              </div>
            `;
            setTimeout(() => adicionarZoomImagem(ticketIdDev), 100);
          }

          if (desc.ticket_compra) {
            const ticketIdCompra = `ticket-compra-${idPedido}-${index}-${idx}`;
            ticketsHTMLGeral += `
              <div style="display:inline-block;margin-right:12px;">
                <label style="font-weight:bold;">Ticket Compra:</label><br>
                <img id="${ticketIdCompra}" src="/uploads/tickets/${desc.ticket_compra}" alt="Ticket Compra" style="width: 120px; border-radius: 6px; margin-top: 8px; cursor: pointer; object-fit: cover;">
              </div>
            `;
            setTimeout(() => adicionarZoomImagem(ticketIdCompra), 100);
          }
        });
      }

      const pesoFinal = formatarPeso((item.peso_carregado || 0) - totalDescontos);
      const textoFinal = totalDescontos > 0 ? 'Peso Final com Desconto' : 'Peso Final';

      form.innerHTML += `
        <div class="material-bloco">
          <h4>${item.nome_produto}</h4>
          <p><strong>Peso Previsto para Carregamento (${tipoPeso}):</strong> ${pesoPrevisto}</p>
          <p><strong>Peso Registrado na Carga:</strong> ${pesoCarregado}</p>
          ${descontosHTML}
          <div style="margin-top: 14px;">
            <span class="etiqueta-peso-final">${textoFinal}: ${pesoFinal}</span>
          </div>
        </div>
      `;

      if (descontosExtraHTML) {
        blocoDescontosExtra += `
          <div class="bloco-desconto-vermelho">
            <p><strong><i class="fa fa-exclamation-triangle"></i> Descontos Aplicados:</strong></p>
            <ul style="padding-left: 20px; margin: 0;">${descontosExtraHTML}</ul>
          </div>
        `;
      }
    });

    if (blocoDescontosExtra) {
      form.innerHTML += blocoDescontosExtra;
    }

    if (pedido.ticket_balanca) {
      const ticketId = `ticket-balanca-${idPedido}`;
      ticketsHTMLGeral += `
        <div style="display:inline-block;margin-right:12px;">
          <label style="font-weight:bold;">Ticket Balança:</label><br>
          <img id="${ticketId}" src="/uploads/tickets/${pedido.ticket_balanca}" alt="Ticket da Balança" style="width: 120px; border-radius: 6px; margin-top: 8px; cursor: pointer; object-fit: cover;">
        </div>
      `;
      setTimeout(() => adicionarZoomImagem(ticketId), 100);
    }

    if (ticketsHTMLGeral) {
      form.innerHTML += `<div style="margin-top: 16px;">${ticketsHTMLGeral}</div>`;
    }

    if (pedido.observacoes_setor && pedido.observacoes_setor.length > 0) {
      const obsBloco = document.createElement('div');
      obsBloco.style.background = '#fff3cd';
      obsBloco.style.padding = '12px';
      obsBloco.style.borderLeft = '5px solid #ffc107';
      obsBloco.style.borderRadius = '4px';
      obsBloco.style.marginTop = '20px';
      obsBloco.innerHTML = `
        <strong>Observações para Conferência de Peso:</strong><br>
        ${pedido.observacoes_setor.map(o => `<div>${o}</div>`).join('')}
      `;
      form.appendChild(obsBloco);
    }

    const botaoConfirmar = document.createElement('button');
    if (pedido.status === 'Aguardando Conferência do Peso') {
      botaoConfirmar.className = 'btn btn-registrar';
      botaoConfirmar.innerText = 'Confirmar Peso';
      botaoConfirmar.onclick = () => confirmarPeso(idPedido, botaoConfirmar);
    } else {
      botaoConfirmar.className = 'btn btn-registrar btn-disabled';
      botaoConfirmar.innerText = 'Coleta ainda não foi finalizada';
      botaoConfirmar.disabled = true;
    }
    form.appendChild(botaoConfirmar);

    const timeline = document.createElement('div');
    timeline.className = 'area-clique-timeline';
    timeline.style.width = '100%';
    timeline.style.height = '110px';
    timeline.style.position = 'absolute';
    timeline.style.top = '0';
    timeline.style.left = '0';
    timeline.style.zIndex = '1';

    timeline.addEventListener('click', (e) => {
  if (pedido.status !== 'Aguardando Conferência do Peso') return;

  const usuarioLogado = JSON.parse(localStorage.getItem('usuarioLogado'));
  const permissoes = (usuarioLogado?.permissoes || []).map(p => p.toLowerCase());

  const podeExecutar = permissoes.includes('executar tarefas - conferência de peso');

  if (!podeExecutar) return;

  e.stopPropagation();
  form.style.display = form.style.display === 'block' ? 'none' : 'block';
});

    card.style.position = 'relative';
    card.appendChild(form);
    card.appendChild(timeline);
    lista.appendChild(card);
  });
}

async function confirmarPeso(pedidoId, botao) {
  const confirmar = confirm("Tem certeza que deseja confirmar o peso deste pedido?");
  if (!confirmar) return;

  botao.disabled = true;
  botao.innerText = 'Enviando...';

  try {
    const res = await fetch(`/api/pedidos/${pedidoId}/conferencia`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();

    if (res.ok) {
      alert('Peso confirmado com sucesso!');
      carregarPedidosConferencia();
    } else {
      alert(data.erro || 'Erro ao confirmar peso.');
      botao.disabled = false;
      botao.innerText = 'Confirmar Peso';
    }
  } catch (error) {
    console.error('Erro ao confirmar peso:', error);
    alert('Erro de comunicação com o servidor.');
    botao.disabled = false;
    botao.innerText = 'Confirmar Peso';
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
  carregarPedidosConferencia();
  document.getElementById('filtro-cliente')?.addEventListener('input', carregarPedidosConferencia);
  document.getElementById('ordenar')?.addEventListener('change', carregarPedidosConferencia);
});
