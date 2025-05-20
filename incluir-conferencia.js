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
        const tipoPeso = item.tipo_peso === 'Aproximado' ? 'Peso Aproximado' : 'Peso Exato';
        form.innerHTML += `
          <div class="material-bloco">
            <h4>${item.nome_produto}</h4>
            <p><strong>Peso Previsto:</strong> ${formatarPeso(item.quantidade)} ${item.unidade || 'kg'}</p>
            <span class="tipo-peso">${tipoPeso}</span>
            <p><strong>Peso Carregado:</strong> ${formatarPeso(item.peso_carregado)} kg</p>
          </div>
        `;
      });
    }

    if (pedido.desconto_peso || pedido.motivo_desconto) {
      const sufixo = pedido.motivo_desconto === 'Paletes' ? 'unidade' : 'kg';
      const label = pedido.motivo_desconto === 'Paletes'
        ? 'Desconto (quantidade de paletes)'
        : 'Desconto (em quilos)';
      form.innerHTML += `
        <div class="grupo-desconto">
          <p><strong>Motivo do Desconto:</strong> ${pedido.motivo_desconto || '—'}</p>
          <p><strong>${label}:</strong> ${formatarPeso(pedido.desconto_peso)} ${sufixo}</p>
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

document.addEventListener('DOMContentLoaded', carregarPedidosConferencia);

