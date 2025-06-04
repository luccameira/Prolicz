function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR');
}

async function carregarPedidosNotaFiscal() {
  const [resPendentes, resLiberados] = await Promise.all([
    fetch('/api/pedidos?status=Aguardando%20Emiss%C3%A3o%20de%20NF'),
    fetch('/api/pedidos?status=Cliente%20Liberado')
  ]);

  let pedidos = [];

  try {
    const pendentes = await resPendentes.json();
    const liberados = await resLiberados.json();
    pedidos = [...pendentes, ...liberados];
    if (!Array.isArray(pedidos)) throw new Error('Resposta inválida');
  } catch (erro) {
    console.error('Erro ao carregar pedidos:', erro);
    document.getElementById('lista-pedidos').innerHTML = "<p style='padding: 0 25px;'>Erro ao carregar tarefas de emissão de NF.</p>";
    return;
  }

  const lista = document.getElementById('lista-pedidos');
  const filtro = document.getElementById('filtro-cliente')?.value.toLowerCase() || '';
  const ordenar = document.getElementById('ordenar')?.value || 'data';

  let filtrados = pedidos.filter(p => p.cliente.toLowerCase().includes(filtro));

  if (ordenar === 'cliente') {
    filtrados.sort((a, b) => a.cliente.localeCompare(b.cliente));
  } else {
    filtrados.sort((a, b) => new Date(a.data_coleta) - new Date(b.data_coleta));
  }

  lista.innerHTML = '';

  if (!filtrados.length) {
    lista.innerHTML = "<p style='padding: 0 25px;'>Nenhum pedido disponível para emissão de nota.</p>";
    return;
  }

  filtrados.forEach(pedido => {
    const card = document.createElement('div');
    card.className = 'card';

    card.innerHTML = `
      <h3>${pedido.cliente}</h3>
      <p><strong>Tipo:</strong> ${pedido.tipo}</p>
      <p><strong>Data:</strong> ${formatarData(pedido.data_criacao)}</p>
      <p><strong>Status:</strong> ${pedido.status}</p>
      <button class="btn" onclick="emitirNota(${pedido.pedido_id || pedido.id})">Nota Fiscal Emitida</button>
    `;

    lista.appendChild(card);
  });
}

async function emitirNota(pedidoId) {
  const confirmado = confirm('Deseja confirmar a emissão da Nota Fiscal para este pedido?');
  if (!confirmado) return;

  try {
    const res = await fetch(`/api/pedidos/${pedidoId}/emitir-nf`, {
      method: 'PUT'
    });

    const data = await res.json();
    alert(data.mensagem || 'Status atualizado.');
    carregarPedidosNotaFiscal();
  } catch (error) {
    console.error('Erro ao emitir nota:', error);
    alert('Erro de comunicação com o servidor.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  carregarPedidosNotaFiscal();
  document.getElementById('filtro-cliente')?.addEventListener('input', carregarPedidosNotaFiscal);
  document.getElementById('ordenar')?.addEventListener('change', carregarPedidosNotaFiscal);
});
