function formatarPeso(valor) {
  if (typeof valor !== 'number') valor = parseFloat(valor);
  if (isNaN(valor)) return '0';
  return Math.round(valor).toLocaleString('pt-BR');
}

let pedidos = [];
let contadorDescontos = {};

async function carregarPedidos() {
  const [resPendentes, resFinalizados] = await Promise.all([
    fetch('/api/pedidos?status=Coleta%20Iniciada'),
    fetch('/api/pedidos?status=Aguardando%20Conferência%20do%20Peso')
  ]);

  const pendentes = await resPendentes.json();
  const finalizados = await resFinalizados.json();

  pedidos = [...pendentes, ...finalizados];
  renderizarPedidosSeparados(pendentes, finalizados);
}

function renderizarPedidosSeparados(pendentes, finalizados) {
  const lista = document.getElementById('lista-pedidos');
  const filtro = document.getElementById('filtro-cliente').value.toLowerCase();
  const ordenar = document.getElementById('ordenar').value;

  let ativos = pendentes.filter(p => p.cliente.toLowerCase().includes(filtro));
  let encerrados = finalizados.filter(p => p.cliente.toLowerCase().includes(filtro));

  if (ordenar === 'cliente') {
    ativos.sort((a, b) => a.cliente.localeCompare(b.cliente));
    encerrados.sort((a, b) => a.cliente.localeCompare(b.cliente));
  } else {
    ativos.sort((a, b) => new Date(a.data_coleta) - new Date(b.data_coleta));
    encerrados.sort((a, b) => new Date(a.data_coleta) - new Date(b.data_coleta));
  }

  lista.innerHTML = '';

  [...ativos, ...encerrados].forEach(p => {
    const div = document.createElement('div');
    div.className = 'card';
    if (p.status === 'Aguardando Conferência do Peso') div.classList.add('finalizado');

    const dataFormatada = new Date(p.data_coleta).toLocaleDateString('pt-BR');

    const statusHtml = p.status === 'Aguardando Conferência do Peso'
      ? `<div class="status-badge status-verde">
           <i class="fa fa-check"></i> Peso Registrado
         </div>`
      : `<div class="status-badge status-amarelo">
           <i class="fa fa-truck"></i> ${p.status}
         </div>`;

    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `
      <div class="info">
        <h3>${p.cliente}</h3>
        <p>Data Prevista: ${dataFormatada}</p>
      </div>
      ${statusHtml}
    `;
    div.appendChild(header);

    const form = document.createElement('div');
    form.className = 'formulario';
    form.id = `form-${p.pedido_id}`;

    if (p.status === 'Coleta Iniciada') {
      if (Array.isArray(p.materiais) && p.materiais.length > 0) {
        p.materiais.forEach((item, index) => {
          const textoPeso = item.tipo_peso === 'Aproximado' ? 'Peso Aproximado' : 'Peso Exato';
          const icone = item.tipo_peso === 'Exato' ? '<i class="fa fa-check check-exato"></i>' : '';

          form.innerHTML += `
            <div class="material-bloco">
              <h4>${item.nome_produto}</h4>
              <p>
                <strong>${textoPeso}:</strong> ${formatarPeso(item.quantidade)} ${item.unidade || 'kg'}
                ${icone}
              </p>
              <label for="peso-${p.pedido_id}-${index}">Peso Carregado (kg):</label>
              <input type="number" id="peso-${p.pedido_id}-${index}" placeholder="Insira o peso carregado aqui">
            </div>
          `;
        });

        form.innerHTML += `
          <div class="grupo-descontos" id="grupo-descontos-${p.pedido_id}"></div>
          <button type="button" class="btn btn-desconto" onclick="adicionarDesconto(${p.pedido_id})">Adicionar Desconto</button>
          <button class="btn btn-registrar" onclick="registrarPeso(${p.pedido_id})">Registrar Peso</button>
        `;
      } else {
        form.innerHTML = `<p style="padding: 15px; color: #555;">Este pedido ainda não possui materiais vinculados para registro de peso.</p>`;
      }

      form.style.display = 'none';
      header.addEventListener('click', () => {
        form.style.display = form.style.display === 'block' ? 'none' : 'block';
      });

      div.appendChild(form);
    }

    lista.appendChild(div);
  });
}

function adicionarDesconto(pedidoId) {
  if (!contadorDescontos[pedidoId]) contadorDescontos[pedidoId] = 0;
  const index = contadorDescontos[pedidoId]++;
  const container = document.getElementById(`grupo-descontos-${pedidoId}`);
  const botao = document.querySelector(`button.btn-desconto[onclick*="${pedidoId}"]`);

  const qtdCardsAtivos = container.querySelectorAll('.grupo-desconto').length;
  if (qtdCardsAtivos >= 2) {
    botao.disabled = true;
    botao.style.opacity = 0.5;
    return;
  }

  const div = document.createElement("div");
  div.className = "grupo-desconto";
  div.id = `grupo-desconto-${pedidoId}-${index}`;
  div.innerHTML = `
    <button class="fechar-desconto" onclick="removerDesconto(${pedidoId}, ${index})">&times;</button>
    <label for="motivo-${pedidoId}-${index}">Motivo do Desconto:</label>
    <select id="motivo-${pedidoId}-${index}" onchange="atualizarDescontoLabel(${pedidoId}, ${index})">
      <option value="">Selecione</option>
      <option value="Paletes">Paletes</option>
      <option value="Devolução de material">Devolução de material</option>
    </select>
    <label id="label-desconto-${pedidoId}-${index}" for="desconto-${pedidoId}-${index}">Desconto</label>
    <div class="desconto-container">
      <input type="number" id="desconto-${pedidoId}-${index}" placeholder="Informe o desconto">
      <span class="sufixo-unidade" id="sufixo-${pedidoId}-${index}">kg</span>
    </div>
  `;
  container.appendChild(div);

  atualizarDescontoLabel(pedidoId, index);

  const total = container.querySelectorAll('.grupo-desconto').length;
  if (total >= 2) {
    botao.disabled = true;
    botao.style.opacity = 0.5;
  }
}

function removerDesconto(pedidoId, index) {
  const div = document.getElementById(`grupo-desconto-${pedidoId}-${index}`);
  if (div) div.remove();

  const botao = document.querySelector(`button.btn-desconto[onclick*="${pedidoId}"]`);
  if (botao) {
    botao.disabled = false;
    botao.style.opacity = 1;
  }
}

function atualizarDescontoLabel(pedidoId, index) {
  const motivo = document.getElementById(`motivo-${pedidoId}-${index}`).value;
  const campo = document.getElementById(`desconto-${pedidoId}-${index}`);
  const sufixo = document.getElementById(`sufixo-${pedidoId}-${index}`);
  const label = document.getElementById(`label-desconto-${pedidoId}-${index}`);

  if (motivo === "Paletes") {
    campo.placeholder = "Desconto em unidades";
    campo.step = "1";
    sufixo.textContent = "unidade";
    label.textContent = "Desconto (quantidade de paletes)";
  } else if (motivo === "Devolução de material") {
    campo.placeholder = "Desconto em kg";
    campo.step = "0.01";
    sufixo.textContent = "kg";
    label.textContent = "Desconto (em quilos)";
  } else {
    campo.placeholder = "Desconto";
    campo.removeAttribute("step");
    sufixo.textContent = "";
    label.textContent = "Desconto";
  }
}

async function registrarPeso(id) {
  const pesoInput = document.getElementById(`peso-${id}-0`);
  if (!pesoInput || !pesoInput.value) {
    return alert("Informe o peso carregado.");
  }

  const peso = parseFloat(pesoInput.value);

  const descontoInput = document.querySelector(`#desconto-${id}-0`);
  const motivoSelect = document.querySelector(`#motivo-${id}-0`);

  const desconto = descontoInput ? parseFloat(descontoInput.value || 0) : 0;
  const motivo = motivoSelect ? motivoSelect.value || '' : '';

  try {
    const res = await fetch(`/api/pedidos/${id}/carga`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        peso_registrado: peso,
        desconto_peso: desconto,
        motivo_desconto: motivo
      })
    });

    const data = await res.json();

    if (res.ok) {
      alert('Peso registrado com sucesso!');
      carregarPedidos();
    } else {
      alert(data.erro || 'Erro ao registrar peso.');
    }
  } catch (error) {
    console.error('Erro ao registrar peso:', error);
    alert('Erro de conexão ao registrar peso.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  carregarPedidos();
  document.getElementById('filtro-cliente').addEventListener('input', () => carregarPedidos());
  document.getElementById('ordenar').addEventListener('change', () => carregarPedidos());
});

