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
      pedido.materiais.forEach(material => {
        const pesoCarregado = formatarPeso(material.peso_carregado);
        const pesoOriginal = formatarPeso(material.quantidade);
        const unidade = material.unidade || 'kg';
        const tipoPeso = material.tipo_peso === 'Exato' ? 'Peso Exato' : 'Peso Aproximado';
        const icone = material.tipo_peso === 'Exato' ? '<i class="fa fa-check check-exato"></i>' : '';

        let descontoHtml = '';
        let pesoDescontadoTotal = 0;

        if (Array.isArray(material.descontos) && material.descontos.length > 0) {
          descontoHtml += `<div class="descontos-lista">`;
          material.descontos.forEach(desc => {
            pesoDescontadoTotal += Number(desc.peso_calculado || 0);
            descontoHtml += `
              <div class="linha-desconto-item">
                <span class="badge-motivo">${desc.motivo}</span>
                <span class="quantidade-desconto">${desc.quantidade} ${desc.motivo.includes('Palete') ? 'un' : 'kg'}</span>
                <span class="peso-calculado">(-${formatarPeso(desc.peso_calculado)} kg)</span>
              </div>
            `;
          });
          descontoHtml += `</div>`;
        }

        const pesoFinal = Math.max(0, Number(material.peso_carregado || 0) - pesoDescontadoTotal);
        const pesoFinalFormatado = formatarPeso(pesoFinal);

        form.innerHTML += `
          <div class="material-bloco">
            <h4>${material.nome_produto}</h4>
            <p><strong>${tipoPeso}:</strong> ${pesoOriginal} ${unidade} ${icone}</p>
            <p><strong>Peso Carregado:</strong> ${pesoCarregado} kg</p>
            ${descontoHtml}
            <p class="peso-final">
              <strong>Peso Final Considerado:</strong> <span class="badge-final">${pesoFinalFormatado} kg</span>
            </p>
          </div>
        `;
      });

      if (!finalizado) {
        form.innerHTML += `
          <button class="btn btn-registrar" onclick="confirmarPeso(${idPedido})">Confirmar Peso</button>
        `;
      }
    }

        form.style.display = 'none';
    header.addEventListener('click', () => {
      form.style.display = form.style.display === 'block' ? 'none' : 'block';
    });

    div.appendChild(form);
    lista.appendChild(div);
  });
}

async function confirmarPeso(pedidoId) {
  if (!confirm('Tem certeza que deseja confirmar o peso deste pedido?')) return;

  try {
    const res = await fetch(`/api/pedidos/${pedidoId}/confirmar-peso`, {
      method: 'PUT'
    });

    const data = await res.json();
    if (res.ok) {
      alert('Peso confirmado com sucesso!');
      carregarPedidos();
    } else {
      alert(data.erro || 'Erro ao confirmar peso.');
    }
  } catch (error) {
    console.error('Erro ao confirmar peso:', error);
    alert('Erro de conexão ao confirmar peso.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  carregarPedidosConferencia();
});

document.getElementById('filtro-cliente')?.addEventListener('input', carregarPedidosConferencia);
document.getElementById('ordenar')?.addEventListener('change', carregarPedidosConferencia);


