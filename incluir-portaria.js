function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR');
}

async function carregarPedidosPortaria() {
  const [resPendentes, resFinalizados] = await Promise.all([
    fetch('/api/pedidos?status=Aguardando%20In%C3%ADcio%20da%20Coleta'),
    fetch('/api/pedidos?status=Coleta%20Iniciada')
  ]);

  const pendentes = await resPendentes.json();
  const finalizados = await resFinalizados.json();

  const lista = document.getElementById('lista-pedidos');
  lista.innerHTML = '';

  const todos = [...pendentes, ...finalizados];

  if (!todos.length) {
    lista.innerHTML = "<p style='padding: 0 25px;'>Nenhum pedido encontrado.</p>";
    return;
  }

  todos.forEach(pedido => {
    const idPedido = pedido.pedido_id || pedido.id;
    const finalizado = pedido.status === 'Coleta Iniciada';

    const card = document.createElement('div');
    card.className = 'card';
    if (finalizado) card.classList.add('finalizado');

    const dataFormatada = formatarData(pedido.data_coleta || new Date());

    const statusHtml = finalizado
      ? `<div class="status-badge status-verde"><i class="fa fa-check"></i> Coleta Iniciada</div>`
      : `<div class="status-badge status-amarelo"><i class="fa fa-truck"></i> ${pedido.status}</div>`;

    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `
      <div class="info">
        <h3>${pedido.cliente}</h3>
        <p>Data Prevista: ${dataFormatada}</p>
      </div>
      ${statusHtml}
    `;
    card.appendChild(header);

    const form = document.createElement('div');
    form.className = 'formulario';
    form.style.display = 'none';

    form.innerHTML = `
      <label for="placa-${idPedido}">Placa do Veículo</label>
      <input type="text" id="placa-${idPedido}" placeholder="Digite a placa do caminhão">

      <label for="motorista-${idPedido}">Nome do Motorista</label>
      <input type="text" id="motorista-${idPedido}" placeholder="Nome completo do motorista">

      <label for="ajudante-${idPedido}">Nome do Ajudante (opcional)</label>
      <input type="text" id="ajudante-${idPedido}" placeholder="Nome do ajudante">

      <button class="btn btn-registrar" onclick="registrarColeta(${idPedido}, this)">Iniciar Coleta</button>
    `;

    // Só adiciona funcionalidade de clique para abrir se for pendente
    if (!finalizado) {
      header.addEventListener('click', () => {
        form.style.display = form.style.display === 'block' ? 'none' : 'block';
      });
    }

    card.appendChild(form);
    lista.appendChild(card);
  });
}

async function registrarColeta(pedidoId, botao) {
  const placa = document.getElementById(`placa-${pedidoId}`).value.trim();
  const motorista = document.getElementById(`motorista-${pedidoId}`).value.trim();
  const ajudante = document.getElementById(`ajudante-${pedidoId}`).value.trim();

  if (!placa || !motorista) {
    alert('Placa e nome do motorista são obrigatórios.');
    return;
  }

  botao.disabled = true;
  botao.innerText = 'Enviando...';

  try {
    const res = await fetch(`/api/pedidos/${pedidoId}/coleta`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placa, motorista, ajudante })
    });

    const data = await res.json();

    if (res.ok) {
      alert('Coleta iniciada com sucesso!');
      carregarPedidosPortaria();
    } else {
      alert(data.erro || 'Erro ao iniciar coleta.');
      botao.disabled = false;
      botao.innerText = 'Iniciar Coleta';
    }
  } catch (error) {
    console.error('Erro ao iniciar coleta:', error);
    alert('Erro de comunicação com o servidor.');
    botao.disabled = false;
    botao.innerText = 'Iniciar Coleta';
  }
}

document.addEventListener('DOMContentLoaded', carregarPedidosPortaria);
