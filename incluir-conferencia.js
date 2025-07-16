function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR');
}

function formatarPeso(valor) {
  if (!valor) return '0';
  return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 0 });
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

  let podeExecutar = ['Aguardando Conferência do Peso', 'Conferência de Peso'].includes(pedido.status);

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

    pedido.materiais.forEach(item => {
  const pesoPrevisto = formatarPeso(item.quantidade);
  const pesoCarregado = formatarPeso(item.peso_carregado);
  const tipoPeso = item.tipo_peso === 'Aproximado' ? 'Aproximado' : 'Exato';

  let descontosHTML = '';
  let totalDescontos = 0;

  if (Array.isArray(item.descontos) && item.descontos.length > 0) {
    const linhas = item.descontos.map(desc => {
      const qtd = formatarPeso(desc.quantidade);
      const peso = formatarPeso(desc.peso_calculado);
      totalDescontos += Number(desc.peso_calculado || 0);
      const sufixo = desc.motivo && desc.motivo.toLowerCase().includes('palete') ? 'UNIDADES' : 'Kg';
      return `<li>${desc.motivo}: ${qtd} ${sufixo} (-${peso} Kg)</li>`;
    }).join('');

let ticketsHTML = '';
if (item.descontos) {
  item.descontos.forEach((desc, idx) => {
    if (desc.ticket_compra || desc.ticket_devolucao) {
      ticketsHTML += `
        <div style="margin-top: 8px; font-size: 13px;">
          ${desc.ticket_compra ? `<div><strong>Ticket de Compra:</strong><br><img src="/uploads/tickets/${desc.ticket_compra}" style="max-width:200px; border-radius:4px; margin-bottom:6px;" /></div>` : ''}
          ${desc.ticket_devolucao ? `<div><strong>Ticket de Devolução:</strong><br><img src="/uploads/tickets/${desc.ticket_devolucao}" style="max-width:200px; border-radius:4px;" /></div>` : ''}
        </div>
      `;
    }
  });
}

    descontosHTML = `
      <div style="background-color: #fff9e6; padding: 12px; border-radius: 6px; border: 1px solid #ffe08a; margin-top: 14px;">
        <p style="font-weight: 600; margin: 0 0 6px;"><i class="fa fa-tags"></i> Descontos Aplicados:</p>
        <ul style="padding-left: 20px; margin: 0;">${linhas}</ul>
${ticketsHTML}
      </div>
    `;
  }

  const pesoFinal = formatarPeso((item.peso_carregado || 0) - totalDescontos);
  const textoFinal = totalDescontos > 0 ? 'Peso Final com Desconto' : 'Peso Final';

  form.innerHTML += `
    <div class="material-bloco">
      <h4>${item.nome_produto}</h4>
      <p><strong>Peso Previsto para Carregamento (${tipoPeso}):</strong> ${pesoPrevisto} ${item.unidade || 'Kg'}</p>
      <p><strong>Peso Registrado na Carga:</strong> ${pesoCarregado} ${item.unidade || 'Kg'}</p>
      ${descontosHTML}
      <div style="margin-top: 14px;">
        <span class="etiqueta-peso-final">${textoFinal}: ${pesoFinal} ${item.unidade || 'Kg'}</span>
      </div>
    </div>
  `;
});

    if (pedido.ticket_balanca) {
      const ticketId = `ticket-${idPedido}`;
      form.innerHTML += `
        <div style="margin-top: 20px;">
          <label style="font-weight: bold;">Ticket da Balança:</label><br>
          <img id="${ticketId}" src="/uploads/tickets/${pedido.ticket_balanca}" alt="Ticket da Balança" style="max-width: 300px; border-radius: 6px; margin-top: 8px; cursor: pointer;">
        </div>
      `;

      setTimeout(() => {
        const img = document.getElementById(ticketId);
        if (img) {
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
      }, 100);
    }

    // Adiciona observações do setor, se houver
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

    // Botão de confirmar peso

const botaoConfirmar = document.createElement('button');
botaoConfirmar.className = podeExecutar ? 'btn btn-registrar' : 'btn btn-registrar btn-disabled';
botaoConfirmar.innerText = podeExecutar ? 'Confirmar Peso' : 'Coleta ainda não foi finalizada';
botaoConfirmar.disabled = !podeExecutar;

if (podeExecutar) {
  botaoConfirmar.onclick = () => confirmarPeso(idPedido, botaoConfirmar);
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
  podeExecutar = ['Aguardando Conferência do Peso', 'Conferência de Peso'].includes(pedido.status);
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

document.addEventListener('DOMContentLoaded', () => {
  carregarPedidosConferencia();
  document.getElementById('filtro-cliente')?.addEventListener('input', carregarPedidosConferencia);
  document.getElementById('ordenar')?.addEventListener('change', carregarPedidosConferencia);
});
