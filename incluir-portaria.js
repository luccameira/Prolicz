document.addEventListener('DOMContentLoaded', carregarPedidosPortaria);

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
      <input type="text" id="cpf-${idPedido}" placeholder="Digite o CPF" required>
      <div id="mensagem-status-${idPedido}" style="margin-top: 10px;"></div>
      <div id="form-dinamico-${idPedido}" style="display: none;"></div>
    `;

    if (!finalizado) {
      header.addEventListener('click', () => {
        form.style.display = form.style.display === 'block' ? 'none' : 'block';

        const cpfInput = form.querySelector(`#cpf-${idPedido}`);
        cpfInput.addEventListener('blur', () => verificarCPF(idPedido));
      });
    }

    card.appendChild(form);
    lista.appendChild(card);
  });
}

async function verificarCPF(pedidoId) {
  const cpf = document.getElementById(`cpf-${pedidoId}`).value.trim();
  const mensagemDiv = document.getElementById(`mensagem-status-${pedidoId}`);
  const formDinamico = document.getElementById(`form-dinamico-${pedidoId}`);

  formDinamico.innerHTML = '';
  formDinamico.style.display = 'none';
  mensagemDiv.innerHTML = '';

  if (!cpf) return;

  try {
    const res = await fetch(`/api/motoristas/${cpf}`);
    if (res.status === 404) {
      // Motorista novo
      mensagemDiv.innerHTML = `<div class="status-info status-novo">🟡 Motorista não possui cadastro. Preencha os dados abaixo.</div>`;
      formDinamico.innerHTML = gerarCamposFormulario(pedidoId, { novo: true });
      formDinamico.style.display = 'block';
    } else {
      const dados = await res.json();
      if (dados.cadastroVencido) {
        mensagemDiv.innerHTML = `<div class="status-info status-vencido">🔴 Cadastro vencido. Reenvie o formulário assinado.</div>`;
        formDinamico.innerHTML = gerarCamposFormulario(pedidoId, { nome: dados.nome, vencido: true });
      } else {
        mensagemDiv.innerHTML = `<div class="status-info status-valido">🟢 Motorista já cadastrado. Cadastro em dia.</div>`;
        formDinamico.innerHTML = gerarCamposFormulario(pedidoId, { nome: dados.nome });
      }
      formDinamico.style.display = 'block';
    }
  } catch (err) {
    console.error('Erro ao verificar CPF:', err);
  }
}

function gerarCamposFormulario(pedidoId, status) {
  const nomeInput = status.nome
    ? `<input type="text" id="nome-${pedidoId}" value="${status.nome}" disabled>`
    : `<input type="text" id="nome-${pedidoId}" placeholder="Nome completo do motorista">`;

  const docField = !status.nome ? `
    <label>Foto do Documento (frente)</label>
    <input type="file" id="doc-${pedidoId}" accept="image/*">` : '';

  const formField = `
    <label>Foto do Formulário Assinado</label>
    <input type="file" id="form-${pedidoId}" accept="image/*">
  `;

  return `
    <label>Nome do Motorista</label>
    ${nomeInput}

    <label>Placa do Veículo</label>
    <input type="text" id="placa-${pedidoId}" placeholder="Digite a placa do caminhão">

    <label>Nome do Ajudante (opcional)</label>
    <input type="text" id="ajudante-${pedidoId}" placeholder="Nome do ajudante">

    ${docField}
    ${formField}

    <label>Foto do Caminhão</label>
    <input type="file" id="caminhao-${pedidoId}" accept="image/*">

    <button class="btn btn-registrar" onclick="registrarColeta(${pedidoId}, this)">Iniciar Coleta</button>
  `;
}

async function registrarColeta(pedidoId, botao) {
  const cpf = document.getElementById(`cpf-${pedidoId}`).value.trim();
  const nome = document.getElementById(`nome-${pedidoId}`)?.value.trim();
  const placa = document.getElementById(`placa-${pedidoId}`).value.trim();
  const ajudante = document.getElementById(`ajudante-${pedidoId}`).value.trim();
  const docInput = document.getElementById(`doc-${pedidoId}`);
  const formInput = document.getElementById(`form-${pedidoId}`);
  const caminhaoInput = document.getElementById(`caminhao-${pedidoId}`);

  if (!cpf || !placa || !nome || !caminhaoInput?.files.length) {
    alert('Preencha todos os campos obrigatórios.');
    return;
  }

  botao.disabled = true;
  botao.innerText = 'Enviando...';

  const formData = new FormData();
  formData.append('cpf', cpf);
  formData.append('placa', placa);
  formData.append('ajudante', ajudante);
  formData.append('foto_caminhao', caminhaoInput.files[0]);

  // Motorista novo
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
  }

  // Motorista vencido
  else if (formInput && formInput.files.length) {
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
    }
  } catch (err) {
    console.error('Erro ao registrar coleta:', err);
    alert('Erro na comunicação com o servidor.');
  } finally {
    botao.disabled = false;
    botao.innerText = 'Iniciar Coleta';
  }
}

