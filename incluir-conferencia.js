function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR');
}

function formatarPeso(valor) {
  if (!valor) return '0';
  return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 0 });
}

async function carregarPedidosConferencia() {
  const [resPendentes, resFinalizados] = await Promise.all([
    fetch('/api/pedidos?status=Aguardando%20Confer%C3%AAncia%20do%20Peso'),
    fetch('/api/pedidos?status=Em%20An%C3%A1lise%20pelo%20Financeiro')
  ]);

  const pendentes = await resPendentes.json();
  const finalizados = await resFinalizados.json();

  const lista = document.getElementById('lista-pedidos');
  lista.innerHTML = '';

  const todos = [...pendentes, ...finalizados];

  if (!todos.length) {
    lista.innerHTML = "<p style='padding: 0 25px;'>Nenhum pedido disponível para conferência.</p>";
    return;
  }

  todos.forEach(pedido => {
    const idPedido = pedido.pedido_id || pedido.id;
    const finalizado = pedido.status === 'Em Análise pelo Financeiro';

    const card = document.createElement('div');
    card.className = 'card';
    if (finalizado) card.classList.add('finalizado');

    const statusHtml = finalizado
      ? `<div class="status-badge status-verde"><i class="fa fa-check"></i> Peso Confirmado</div>`
      : `<div class="status-badge status-amarelo"><i class="fa fa-balance-scale"></i> ${pedido.status}</div>`;

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

    const form = document.createElement('div');
    form.className = 'formulario';
    form.style.display = 'none';

        if (Array.isArray(pedido.materiais)) {
      pedido.materiais.forEach(item => {
        const pesoPrevisto = formatarPeso(item.quantidade);
        const pesoCarregado = formatarPeso(item.peso_carregado);
        let descontosHTML = '';
        let totalDescontos = 0;

        if (item.descontos && item.descontos.length > 0) {
          const linhas = item.descontos.map(desc => {
            const qtd = formatarPeso(desc.quantidade);
            const peso = formatarPeso(desc.peso_calculado);
            totalDescontos += Number(desc.peso_calculado || 0);

            const sufixo = desc.motivo.includes('Palete') ? 'UNIDADES' : 'KG';
            return `<li>${desc.motivo}: ${qtd} ${sufixo} (-${peso} KG)</li>`;
          }).join('');

          descontosHTML = `
            <div style="background-color: #fff9e6; padding: 12px; border-radius: 6px; border: 1px solid #ffe08a; margin-top: 14px;">
              <p style="font-weight: 600; margin: 0 0 6px;"><i class="fa fa-tags"></i> Descontos Aplicados:</p>
              <ul style="padding-left: 20px; margin: 0;">${linhas}</ul>
            </div>
          `;
        }

        const pesoFinal = formatarPeso((item.peso_carregado || 0) - totalDescontos);

        form.innerHTML += `
          <div class="material-bloco">
            <h4>${item.nome_produto}</h4>
            <p><strong><i class="fa fa-scale-balanced"></i> Peso Previsto para Carregamento:</strong> ${pesoPrevisto} ${item.unidade || 'KG'}</p>
            <p><strong><i class="fa fa-truck"></i> Peso Registrado na Carga:</strong> ${pesoCarregado} ${item.unidade || 'KG'}</p>
            ${descontosHTML}
            <p style="margin-top: 12px;"><strong><i class="fa fa-equals"></i> Peso Final:</strong> ${pesoFinal} ${item.unidade || 'KG'}</p>
          </div>
        `;
      });
    }

    if (pedido.ticket_balanca) {
      form.innerHTML += `
        <div style="margin-top: 20px;">
          <label style="font-weight: bold;">Ticket da Balança:</label><br>
          <img src="/uploads/tickets/${pedido.ticket_balanca}" alt="Ticket da Balança" style="max-width: 300px; border-radius: 6px; margin-top: 8px;">
        </div>
      `;
    }

    if (!finalizado) {
      form.innerHTML += `
        <button class="btn btn-registrar" onclick="confirmarPeso(${idPedido}, this)">Confirmar Peso</button>
      `;
    }

    if (!finalizado) {
      header.addEventListener('click', () => {
        form.style.display = form.style.display === 'block' ? 'none' : 'block';
      });
    }

    card.appendChild(form);
    lista.appendChild(card);
  });
}

async function confirmarPeso(pedidoId, botao) {
  if (!confirm("Tem certeza que deseja confirmar o peso deste pedido?")) return;

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

