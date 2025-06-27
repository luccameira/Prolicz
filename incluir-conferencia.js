function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR');
}

function formatarDataHora(data) {
  if (!data) return '';
  const d = new Date(data);
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatarPeso(valor) {
  if (!valor) return '0';
  return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 0 });
}

function gerarLinhaTempoCompleta(pedido) {
  return `
    <div class="timeline-simples">
      <div class="linha-tempo-etapa ${pedido.data_coleta_iniciada ? 'concluida' : 'ativa'}">
        <div class="icone"><i class="fa fa-sign-in-alt"></i></div>
        <div class="texto">
          <strong>${pedido.data_coleta_iniciada ? 'Coleta Iniciada' : 'Aguardando Início da Coleta'}</strong><br>
          ${pedido.data_coleta_iniciada ? formatarDataHora(pedido.data_coleta_iniciada) : ''}
        </div>
      </div>

      <div class="linha-tempo-etapa ${pedido.data_carga_finalizada ? 'concluida' : ''}">
        <div class="icone"><i class="fa fa-truck-loading"></i></div>
        <div class="texto">
          <strong>${pedido.data_carga_finalizada ? 'Coleta Finalizada' : 'Aguardando Finalização da Coleta'}</strong><br>
          ${pedido.data_carga_finalizada ? formatarDataHora(pedido.data_carga_finalizada) : ''}
        </div>
      </div>

      <div class="linha-tempo-etapa ${pedido.data_conferencia_peso ? 'concluida' : ''}">
        <div class="icone"><i class="fa fa-balance-scale"></i></div>
        <div class="texto">
          <strong>${pedido.data_conferencia_peso ? 'Peso Conferido' : 'Aguardando Conferência do Peso'}</strong><br>
          ${pedido.data_conferencia_peso ? formatarDataHora(pedido.data_conferencia_peso) : ''}
        </div>
      </div>
    </div>
  `;
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
        item.descontos.forEach(desc => {
          if (desc.ticket_compra || desc.ticket_devolucao) {
            ticketsHTML += `
              <div style="margin-top: 8px; font-size: 13px;">
                ${desc.ticket_compra ? `<div><strong>Ticket de Compra:</strong><br><img src="/uploads/tickets/${desc.ticket_compra}" style="max-width:200px; border-radius:4px; margin-bottom:6px;" /></div>` : ''}
                ${desc.ticket_devolucao ? `<div><strong>Ticket de Devolução:</strong><br><img src="/uploads/tickets/${desc.ticket_devolucao}" style="max-width:200px; border-radius:4px;" /></div>` : ''}
              </div>
            `;
          }
        });

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
            overlay.style = `position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; z-index:9999;`;

            const modalImg = document.createElement('img');
            modalImg.src = img.src;
            modalImg.style = `max-width:90vw; max-height:90vh; object-fit:contain; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.3); cursor:zoom-in; transition:transform 0.3s ease;`;

            let zoomed = false;
            modalImg.addEventListener('click', (e) => {
              e.stopPropagation();
              if (!zoomed) {
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
            closeBtn.style = `position:absolute; top:20px; right:30px; font-size:40px; color:#fff; cursor:pointer;`;
            closeBtn.onclick = () => document.body.removeChild(overlay);

            overlay.appendChild(modalImg);
            overlay.appendChild(closeBtn);
            document.body.appendChild(overlay);
          });
        }
      }, 100);
    }

    if (pedido.observacoes_setor && pedido.observacoes_setor.length > 0) {
      const obsBloco = document.createElement('div');
      obsBloco.style = 'background:#fff3cd; padding:12px; border-left:5px solid #ffc107; border-radius:4px; margin-top:20px;';
      obsBloco.innerHTML = `
        <strong>Observações para Conferência de Peso:</strong><br>
        ${pedido.observacoes_setor.map(o => `<div>${o}</div>`).join('')}
      `;
      form.appendChild(obsBloco);
    }

    const botaoConfirmar = document.createElement('button');
    botaoConfirmar.className = 'btn btn-registrar';
    if (pedido.status === 'Aguardando Conferência do Peso') {
      botaoConfirmar.innerText = 'Confirmar Peso';
      botaoConfirmar.onclick = () => confirmarPeso(idPedido, botaoConfirmar);
    } else {
      botaoConfirmar.innerText = 'Coleta ainda não foi finalizada';
      botaoConfirmar.disabled = true;
      botaoConfirmar.classList.add('btn-disabled');
    }
    form.appendChild(botaoConfirmar);

    const timeline = document.createElement('div');
    timeline.className = 'area-clique-timeline';
    timeline.style = 'width:100%; height:110px; position:absolute; top:0; left:0; z-index:1;';
    timeline.addEventListener('click', (e) => {
      if (pedido.status !== 'Aguardando Conferência do Peso') return;
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
