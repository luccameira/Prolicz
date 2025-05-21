document.addEventListener('DOMContentLoaded', carregarPedidosPortaria);

// Adiciona a máscara de CPF
function aplicarMascaraCPF(input) {
  input.addEventListener('input', () => {
    let v = input.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    input.value = v;

    // Quando completo, já dispara a verificação
    if (v.length === 14) {
      const id = input.id.split('-')[1];
      verificarCPF(id);
    }
  });
}

function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR');
}

async function carregarPedidosPortaria() {
  const [resPendentes, resIniciados] = await Promise.all([
    fetch('/api/pedidos?status=Aguardando%20In%C3%ADcio%20da%20Coleta'),
    fetch('/api/pedidos?status=Coleta%20Iniciada')
  ]);

  const pendentes = await resPendentes.json();
  const iniciados = await resIniciados.json();
  const lista = document.getElementById('lista-pedidos');
  lista.innerHTML = '';

  const todos = [...pendentes, ...iniciados];
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
      <label>CPF do Motorista</label>
      <input type="text" placeholder="Digite o CPF" id="cpf-${idPedido}" required>
      <div id="status-cadastro-${idPedido}" class="alerta-vencido" style="display: none;"></div>

      <div id="bloco-form-${idPedido}" style="display: none;">
        <label>Nome do Motorista</label>
        <input type="text" id="nome-${idPedido}" placeholder="Nome completo do motorista">

        <label>Placa do Veículo</label>
        <input type="text" id="placa-${idPedido}" placeholder="Digite a placa do caminhão">

        <label>Nome do Ajudante (opcional)</label>
        <input type="text" id="ajudante-${idPedido}" placeholder="Nome do ajudante">

        <div id="upload-documentos-${idPedido}" style="display: none;">
          <label>Foto do Documento (frente)</label>
          <input type="file" id="doc-${idPedido}" accept="image/*">

          <label>Foto do Formulário Assinado</label>
          <input type="file" id="form-${idPedido}" accept="image/*">
        </div>

        <label>Foto do Caminhão</label>
        <input type="file" id="foto-caminhao-${idPedido}" accept="image/*">

        <button class="btn btn-registrar" onclick="registrarColeta(${idPedido}, this)">Iniciar Coleta</button>
      </div>
    `;

    if (!finalizado) {
      header.addEventListener('click', () => {
        form.style.display = form.style.display === 'block' ? 'none' : 'block';

        const cpfInput = form.querySelector(`#cpf-${idPedido}`);
        aplicarMascaraCPF(cpfInput);
      });
    }

    card.appendChild(form);
    lista.appendChild(card);
  });
}

async function verificarCPF(pedidoId) {
  const cpf = document.getElementById(`cpf-${pedidoId}`).value.trim();
  const nomeInput = document.getElementById(`nome-${pedidoId}`);
  const alerta = document.getElementById(`status-cadastro-${pedidoId}`);
  const uploads = document.getElementById(`upload-documentos-${pedidoId}`);
  const blocoForm = document.getElementById(`bloco-form-${pedidoId}`);

  if (!cpf) return;

  try {
    const res = await fetch(`/api/motoristas/${cpf}`);
    blocoForm.style.display = 'block';

    if (res.status === 404) {
      alerta.style.display = 'block';
      alerta.style.backgroundColor = '#fff3cd';
      alerta.style.border = '1px solid #ffeeba';
      alerta.style.color = '#856404';
      alerta.innerText = '🚫 Motorista não possui cadastro. Preencha os dados abaixo.';
      uploads.style.display = 'block';
      nomeInput.disabled = false;
      nomeInput.value = '';
    } else {
      const dados = await res.json();
      nomeInput.value = dados.nome;
      nomeInput.disabled = true;

      if (dados.cadastroVencido) {
        alerta.style.display = 'block';
        alerta.style.backgroundColor = '#f8d7da';
        alerta.style.border = '1px solid #f5c6cb';
        alerta.style.color = '#721c24';
        alerta.innerText = '⚠️ Cadastro vencido. Reenvie o formulário e a foto do caminhão.';
        uploads.style.display = 'block';
        document.getElementById(`doc-${pedidoId}`).style.display = 'none';
      } else {
        alerta.style.display = 'block';
        alerta.style.backgroundColor = '#e2f0d9';
        alerta.style.border = '1px solid #c3e6cb';
        alerta.style.color = '#155724';
        alerta.innerText = '✅ Motorista já cadastrado.';
        uploads.style.display = 'none';
      }
    }
  } catch (err) {
    console.error('Erro ao verificar CPF:', err);
  }
}

async function registrarColeta(pedidoId, botao) {
  const cpf = document.getElementById(`cpf-${pedidoId}`).value.trim();
  const nome = document.getElementById(`nome-${pedidoId}`).value.trim();
  const placa = document.getElementById(`placa-${pedidoId}`).value.trim();
  const ajudante = document.getElementById(`ajudante-${pedidoId}`).value.trim();
  const docInput = document.getElementById(`doc-${pedidoId}`);
  const formInput = document.getElementById(`form-${pedidoId}`);
  const caminhaoInput = document.getElementById(`foto-caminhao-${pedidoId}`);

  if (!cpf || !placa || (!nome && !docInput)) {
    alert('Preencha todos os campos obrigatórios.');
    return;
  }

  if (!caminhaoInput.files.length) {
    alert('A foto do caminhão é obrigatória.');
    return;
  }

  botao.disabled = true;
  botao.innerText = 'Enviando...';

  const formData = new FormData();
  formData.append('cpf', cpf);
  formData.append('placa', placa);
  formData.append('ajudante', ajudante);
  formData.append('foto_caminhao', caminhaoInput.files[0]);

  if (docInput && docInput.files.length && formInput && formInput.files.length) {
    formData.append('nome', nome);
    formData.append('foto_documento', docInput.files[0]);
    formData.append('foto_formulario', formInput.files[0]);

    try {
      const res = await fetch('/api/motoristas', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error();
    } catch {
      alert('Erro ao cadastrar motorista.');
      botao.disabled = false;
      botao.innerText = 'Iniciar Coleta';
      return;
    }
  } else if (formInput && formInput.files.length) {
    const formAtualiza = new FormData();
    formAtualiza.append('foto_formulario', formInput.files[0]);
    formAtualiza.append('foto_caminhao', caminhaoInput.files[0]);

    try {
      const res = await fetch(`/api/motoristas/${cpf}/formulario`, {
        method: 'PUT',
        body: formAtualiza
      });
      if (!res.ok) throw new Error();
    } catch {
      alert('Erro ao atualizar formulário.');
      botao.disabled = false;
      botao.innerText = 'Iniciar Coleta';
      return;
    }
  }

  try {
    const res = await fetch(`/api/pedidos/${pedidoId}/coleta`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placa, motorista: nome, ajudante })
    });

    if (res.ok) {
      alert('Coleta iniciada com sucesso!');
      carregarPedidosPortaria();
    } else {
      alert('Erro ao registrar coleta.');
      botao.disabled = false;
      botao.innerText = 'Iniciar Coleta';
    }
  } catch (err) {
    console.error('Erro ao registrar coleta:', err);
    alert('Erro na comunicação com o servidor.');
    botao.disabled = false;
    botao.innerText = 'Iniciar Coleta';
  }
}


