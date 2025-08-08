document.addEventListener('DOMContentLoaded', () => {
  carregarPedidosPortaria();
  monitorarUploads();
});

function aplicarMascaraCPF(input) {
  input.addEventListener('input', () => {
    let v = input.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    input.value = v;

    if (v.length === 14) {
      const isAjudante = input.id.startsWith("cpf-ajudante");
      const pedidoId = input.dataset.pedido || '';
      const index = input.dataset.index || '0';
      verificarCPF(pedidoId, isAjudante, index);
    }
  });
}

function aplicarMascaraPlaca(input) {
  input.addEventListener('input', () => {
    let v = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (v.length > 7) v = v.slice(0, 7);
    if (v.length > 3) v = v.slice(0, 3) + '-' + v.slice(3);
    input.value = v;
  });
}

function formatarData(data) {
  if (!data) return '—';
  try {
    const dt = new Date(data);
    if (isNaN(dt)) return '—';
    return dt.toLocaleDateString('pt-BR').slice(0, 5) + ' ' +
      String(dt.getHours()).padStart(2, '0') + ':' +
      String(dt.getMinutes()).padStart(2, '0');
  } catch {
    return data;
  }
}

async function verificarCPF(pedidoId, isAjudante = false, index = '0') {
  const cpfInput = isAjudante
    ? document.getElementById(`cpf-ajudante-${pedidoId}-${index}`)
    : document.getElementById(`cpf-${pedidoId}`);

  const cpf = cpfInput?.value?.replace(/\D/g, '');
  if (!cpf || cpf.length < 11) return;

  const statusDiv = document.getElementById(
    isAjudante
      ? `status-cadastro-ajudante-${index}`
      : `status-cadastro-${pedidoId}`
  );

  try {
    const res = await fetch(`/api/motoristas/${cpf}`);
    const data = await res.json();

    let html = '';
    if (!data.encontrado) {
      html = `<span class="badge-status badge-nao-cadastrado">🟠 Motorista não cadastrado</span>`;
    } else if (data.cadastroVencido) {
      html = `<span class="badge-status badge-vencido">🔴 Cadastro vencido - necessário reenvio da ficha</span>`;
    } else {
      html = `<span class="badge-status badge-ok">🟢 Motorista já cadastrado</span>`;
    }

    statusDiv.innerHTML = html;
    statusDiv.style.display = 'block';
    statusDiv.style.marginTop = '6px'; // alinhamento com o campo de CPF

    if (!isAjudante) {
      const nomeInput = document.getElementById(`nome-${pedidoId}`);
      const placaInput = document.getElementById(`placa-${pedidoId}`);
      nomeInput.value = data.nome || '';
      nomeInput.readOnly = !!data.encontrado;
      placaInput.value = data.placa || '';
      placaInput.readOnly = false;

      const bloco = document.getElementById(`bloco-form-${pedidoId}`);
      if (bloco) bloco.style.display = 'block';

      const grupoFicha = document.getElementById(`grupo-ficha-${pedidoId}`);
      const grupoDoc = document.getElementById(`grupo-doc-${pedidoId}`);
      if (!data.encontrado || data.cadastroVencido) {
        grupoFicha.style.display = 'block';
        grupoDoc.style.display = !data.cadastroVencido ? 'block' : 'none';
      } else {
        grupoFicha.style.display = 'none';
        grupoDoc.style.display = 'none';
      }

      const seletor = document.getElementById(`tem-ajudante-${pedidoId}`);
      if (seletor) {
        seletor.addEventListener('change', () => {
          exibirCardAjudante(pedidoId, seletor.value);
        });
      }

    } else {
      const nomeAj = document.getElementById(`nome-ajudante-${index}`);
      const grupoFichaAj = document.getElementById(`grupo-ficha-ajudante-${index}`);
      const grupoDocAj = document.getElementById(`grupo-doc-ajudante-${index}`);

      nomeAj.value = data.nome || '';
      nomeAj.readOnly = !!data.encontrado;

      if (!data.encontrado) {
        grupoFichaAj.style.display = 'block';
        grupoDocAj.style.display = 'block';
      } else if (data.cadastroVencido) {
        grupoFichaAj.style.display = 'block';
        grupoDocAj.style.display = 'none';
      } else {
        grupoFichaAj.style.display = 'none';
        grupoDocAj.style.display = 'none';
      }
    }

  } catch (error) {
    console.error('Erro na verificação de CPF:', error);
    statusDiv.innerHTML = `<span style="color: red;">Erro ao verificar CPF</span>`;
    statusDiv.style.display = 'block';
  }
}

function exibirCardAjudante(pedidoId, valor) {
  const container = document.getElementById(`card-ajudante-container-${pedidoId}`);
  container.innerHTML = '';
  if (valor !== 'sim') return;

  const index = 0;
  const html = `
    <div class="card-ajudante" id="card-ajudante-${pedidoId}-${index}">
      <h4>Dados do Ajudante</h4>
      <div class="linha-cpf-status">
        <div class="cpf-input">
          <label for="cpf-ajudante-${pedidoId}-${index}">CPF do Ajudante</label>
          <input type="text" id="cpf-ajudante-${pedidoId}-${index}" data-pedido="${pedidoId}" data-index="${index}" placeholder="000.000.000-00" required>
        </div>
        <div class="status-label" id="status-cadastro-ajudante-${index}" style="display:none;"></div>
      </div>
      <div>
        <label for="nome-ajudante-${index}">Nome do Ajudante</label>
        <input type="text" id="nome-ajudante-${index}" placeholder="Nome completo" required>
      </div>
      <div id="grupo-ficha-ajudante-${index}" style="margin-top:22px;display:none;">
        <label>Ficha de Integração Assinada</label>
        <div class="upload-wrapper"><input type="file" id="ficha-ajudante-${index}" accept="image/*"></div>
      </div>
      <div id="grupo-doc-ajudante-${index}" style="margin-top:22px;display:none;">
        <label>Foto do Documento com Foto</label>
        <div class="upload-wrapper"><input type="file" id="doc-ajudante-${index}" accept="image/*"></div>
      </div>
    </div>
  `;

  container.innerHTML = html;
  aplicarMascaraCPF(document.getElementById(`cpf-ajudante-${pedidoId}-${index}`));
}

async function carregarPedidosPortaria() {
  const hoje = new Date().toISOString().split('T')[0];
  const podeExecutar = status => ['Aguardando Início da Coleta', 'Portaria'].includes(status);

  const [resPedidos, resSaidas] = await Promise.all([
    fetch(`/api/pedidos/portaria?data=${hoje}`),
    fetch('/api/pedidos/portaria/saida')
  ]);

  const pedidos = await resPedidos.json();
  const saidas = await resSaidas.json();

  const lista = document.getElementById('lista-pedidos');
  lista.innerHTML = '';

  if (!pedidos.length && !saidas.length) {
    lista.innerHTML = "<p style='padding: 0 25px;'>Nenhum pedido encontrado.</p>";
    return;
  }

  // Agrupar tarefas de saída por pedido_id
  const saidasPorPedido = {};
  saidas.forEach(saida => {
    saidasPorPedido[saida.pedido_id] = saida;
  });

  pedidos.forEach(pedido => {
  const pedidoId = pedido.pedido_id || pedido.id;
  console.log("🟢 Pedido renderizado:", pedidoId);
  const tarefaSaida = saidasPorPedido[pedidoId];
console.log("🔎 Tarefa de saída encontrada para pedido", pedidoId, tarefaSaida);

  const card = document.createElement('div');
  card.className = 'card';

  const header = document.createElement('div');
  header.className = 'card-header';
  header.innerHTML = `
    <div class="info">
      <h3>${pedido.cliente}</h3>
      <p>Data prevista: ${formatarData(pedido.data_coleta)}</p>
      ${pedido.observacoes?.portaria ? `<p style="margin-top: 6px;"><strong>Obs:</strong> ${pedido.observacoes.portaria}</p>` : ''}
    </div>
    <div class="status-badge ${pedido.status === 'Aguardando Início da Coleta' ? 'status-amarelo' : 'status-verde'}">
      ${pedido.status === 'Aguardando Início da Coleta' ? 'Aguardando Início da Coleta' : 'Coleta Iniciada'}
    </div>
  `;
  card.appendChild(header);

  const linhaTempo = document.createElement('div');
  linhaTempo.innerHTML = gerarLinhaTempoCompleta(pedido);
  card.appendChild(linhaTempo);

  setTimeout(() => {
    const timeline = card.querySelector('.timeline-simples');
    if (timeline) animarLinhaProgresso(timeline);
  }, 20);

  // ENTRADA
  const podeExecutar = status => ['Aguardando Início da Coleta', 'Portaria'].includes(status);
  if (podeExecutar(pedido.status)) {
    renderizarFormularioColeta(pedido, card);
  }

  // SAÍDA
  if (tarefaSaida && tarefaSaida.status === 'pendente') {
    const formularioSaida = document.createElement('div');
    formularioSaida.className = 'formulario';
    formularioSaida.style.display = 'block';

    formularioSaida.innerHTML = `
      <p style="margin-bottom: 14px;">Esta tarefa representa a <strong>saída do cliente</strong> após a emissão da nota fiscal.</p>

      <div class="bloco-motorista">
        <h3><i class="fas fa-id-card"></i> Dados do Motorista</h3>
        <div class="linha-motorista">
          <div>
            <label>Nome do Motorista</label>
            <input type="text" value="${tarefaSaida.nome_motorista || ''}" readonly>
          </div>
          <div>
            <label>Placa do Veículo</label>
            <input type="text" value="${tarefaSaida.placa_veiculo || ''}" readonly>
          </div>
        </div>
      </div>

      ${tarefaSaida.nome_ajudante ? `
      <div class="bloco-ajudante" style="margin-top: 22px;">
        <h3><i class="fas fa-user-friends"></i> Dados do Ajudante</h3>
        <div class="linha-motorista">
          <div>
            <label>Nome do Ajudante</label>
            <input type="text" value="${tarefaSaida.nome_ajudante}" readonly>
          </div>
        </div>
      </div>` : ''}

      <div style="margin-top: 28px;">
        <button class="botao-confirmar-saida" onclick="confirmarSaida(${pedidoId}, this)">
          <i class="fas fa-sign-out-alt"></i> Confirmar Saída do Cliente
        </button>
      </div>
    `;

    card.appendChild(formularioSaida);
  }

  lista.appendChild(card);
});
}

async function carregarTarefasSaida() {
  try {
    const res = await fetch('/api/pedidos/portaria/saida');
    const tarefas = await res.json();

    const cardsContainer = document.getElementById('cards-pedidos');
    cardsContainer.innerHTML = '';

    if (!tarefas.length) {
      cardsContainer.innerHTML = "<p style='padding: 0 25px;'>Nenhuma tarefa de saída encontrada.</p>";
      return;
    }

    tarefas.forEach(tarefa => {
  console.log("🟡 Tarefa saída recebida:", tarefa);
      const card = document.createElement('div');
      card.className = 'card saida';

      card.innerHTML = `
        <div class="card-header">
          <div class="info">
            <h3>${tarefa.cliente_nome || 'Cliente'}</h3>
            <p>Saída do cliente autorizada</p>
          </div>
          <div class="status-badge status-azul">Aguardando Saída</div>
        </div>

        <div class="formulario">
          <p style="margin-bottom: 14px;">Esta tarefa representa a <strong>saída do cliente</strong> após a emissão da nota fiscal.</p>

          <div class="bloco-motorista">
            <h3><i class="fas fa-id-card"></i> Dados do Motorista</h3>
            <div class="linha-motorista">
              <div>
                <label>Nome do Motorista</label>
                <input type="text" value="${tarefa.nome_motorista || ''}" readonly>
              </div>
              <div>
                <label>Placa do Veículo</label>
                <input type="text" value="${tarefa.placa_veiculo || ''}" readonly>
              </div>
            </div>
          </div>

          ${tarefa.nome_ajudante ? `
          <div class="bloco-ajudante" style="margin-top: 22px;">
            <h3><i class="fas fa-user-friends"></i> Dados do Ajudante</h3>
            <div class="linha-motorista">
              <div>
                <label>Nome do Ajudante</label>
                <input type="text" value="${tarefa.nome_ajudante}" readonly>
              </div>
            </div>
          </div>` : ''}

          <div style="margin-top: 28px;">
            <button class="botao-confirmar-saida" onclick="confirmarSaida(${tarefa.pedido_id}, this)">
              <i class="fas fa-sign-out-alt"></i> Confirmar Saída do Cliente
            </button>
          </div>
        </div>
      `;

      cardsContainer.appendChild(card);
    });

  } catch (error) {
    console.error('Erro ao carregar tarefas de saída:', error);
  }
}

async function confirmarSaida(pedidoId, botao) {
  const confirmar = confirm("Deseja realmente confirmar a saída do cliente?");
  if (!confirmar) return;

  botao.disabled = true;
  botao.innerText = 'Confirmando...';

  try {
    await fetch(`/api/tarefas-portaria/${pedidoId}/saida`, {
      method: 'PUT'
    });

    alert("Saída confirmada com sucesso!");
    carregarTarefasSaida(); // Atualiza os cards
  } catch (error) {
    console.error('Erro ao confirmar saída:', error);
    alert("Erro ao confirmar saída.");
  } finally {
    botao.disabled = false;
    botao.innerText = 'Confirmar Saída do Cliente';
  }
}

function renderizarFormularioColeta(pedido, card) {
  const pedidoId = pedido.pedido_id || pedido.id;

  const container = document.createElement('div');
  container.className = 'formulario';
  container.innerHTML = `
${pedido.observacoes && pedido.observacoes.length
  ? `<div class="bloco-observacao">
      <h3><i class="fas fa-comment-dots"></i> Observação para Portaria</h3>
      <div class="box-observacao">${pedido.observacoes}</div>
    </div>`
  : ''
}

    <div class="bloco-motorista">
      <h3><i class="fas fa-id-card"></i> Dados do Motorista</h3>

      <div class="linha-cpf-status" style="display: flex; align-items: flex-end; gap: 10px;">
  <div class="cpf-input">
    <label for="cpf-${pedidoId}">CPF do Motorista</label>
    <input type="text" id="cpf-${pedidoId}" data-pedido="${pedidoId}" placeholder="000.000.000-00" required>
  </div>
  <div class="status-label" id="status-cadastro-${pedidoId}" style="display: none;"></div>
</div>

      <div id="bloco-form-${pedidoId}" style="display: none;">
        <div class="linha-motorista">
          <div>
            <label for="nome-${pedidoId}">Nome do Motorista</label>
            <input type="text" id="nome-${pedidoId}" placeholder="Nome completo" required>
          </div>
          <div>
            <label for="placa-${pedidoId}">Placa do Veículo</label>
            <input type="text" id="placa-${pedidoId}" placeholder="AAA-0000" required>
          </div>
        </div>

        <div class="linha-motorista">
          <div style="flex: 1 1 100%;">
            <label for="foto-caminhao-${pedidoId}">Foto do Caminhão</label>
            <div class="upload-wrapper">
              <input type="file" id="foto-caminhao-${pedidoId}" accept="image/*" required>
            </div>
          </div>
        </div>

        <div id="grupo-ficha-${pedidoId}" style="margin-top: 22px; display: none;">
          <label>Ficha de Integração Assinada</label>
          <div class="upload-wrapper"><input type="file" id="ficha-${pedidoId}" accept="image/*"></div>
        </div>

        <div id="grupo-doc-${pedidoId}" style="margin-top: 22px; display: none;">
          <label>Foto do Documento com Foto</label>
          <div class="upload-wrapper"><input type="file" id="doc-${pedidoId}" accept="image/*"></div>
        </div>

        <div style="margin-top: 22px;">
          <label>Tem ajudante?</label>
          <select id="tem-ajudante-${pedidoId}" data-pedido="${pedidoId}" required>
            <option value="">Selecione</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </div>

        <div id="card-ajudante-container-${pedidoId}" style="margin-top: 20px;"></div>

${(pedido.observacoes_setor?.length)
  ? `<div style="background: #fff3cd; padding: 12px; border-left: 5px solid #ffc107; border-radius: 4px; margin-top: 20px;">
        <strong>Observações para Portaria:</strong><br>${pedido.observacoes_setor.join('<br>')}
     </div>`
  : ''}

<div style="margin-top: 28px;">
  <button onclick="registrarColeta('${pedidoId}', this)" class="botao-iniciar-coleta btn-reduzido">
    <i class="fas fa-truck"></i> Iniciar Coleta
  </button>
</div>
      </div>
    </div>
  `;

  card.appendChild(container);
  aplicarMascaraCPF(container.querySelector(`#cpf-${pedidoId}`));
  aplicarMascaraPlaca(container.querySelector(`#placa-${pedidoId}`));
  container.style.display = 'block';
}

async function registrarColeta(pedidoId, botao) {
  const confirmar = confirm("Tem certeza que deseja iniciar a coleta?");
  if (!confirmar) return;

  const cpf = document.getElementById(`cpf-${pedidoId}`)?.value.trim();
  const nome = document.getElementById(`nome-${pedidoId}`)?.value.trim();
  const placa = document.getElementById(`placa-${pedidoId}`)?.value.trim();
  const caminhaoInput = document.getElementById(`foto-caminhao-${pedidoId}`);
  const fichaInput = document.getElementById(`ficha-${pedidoId}`);
  const docInput = document.getElementById(`doc-${pedidoId}`);
  const temAjudante = document.getElementById(`tem-ajudante-${pedidoId}`)?.value;
if (!temAjudante) {
  alert('Você precisa informar se há ajudante ou não.');
  return;
}

  if (!cpf || !placa || !caminhaoInput.files.length) {
    alert('Preencha todos os campos obrigatórios.');
    return;
  }

  botao.disabled = true;
  botao.innerText = 'Enviando...';

  const formData = new FormData();
  formData.append('cpf', cpf);
  formData.append('placa', placa);
  if (nome) formData.append('nome', nome);
  if (fichaInput?.files.length) formData.append('ficha_integracao', fichaInput.files[0]);
  if (docInput?.files.length) formData.append('foto_documento', docInput.files[0]);
  formData.append('foto_caminhao', caminhaoInput.files[0]);

  const nomeAjudante = [];

  const ajudantes = Array.from(document.querySelectorAll(`[id^="card-ajudante-${pedidoId}-"]`));
  ajudantes.forEach((card, index) => {
    const cpfAj = card.querySelector(`#cpf-ajudante-${pedidoId}-${index}`)?.value;
    const nomeAj = card.querySelector(`#nome-ajudante-${index}`)?.value;
    const fichaAj = card.querySelector(`#ficha-ajudante-${index}`)?.files?.[0];
    const docAj = card.querySelector(`#doc-ajudante-${index}`)?.files?.[0];

    if (cpfAj && nomeAj) {
      formData.append('cpf_ajudante', cpfAj);
      formData.append('nome_ajudante', nomeAj);
      if (fichaAj) formData.append('ficha_ajudante', fichaAj);
      if (docAj) formData.append('documento_ajudante', docAj);
      nomeAjudante.push(nomeAj);
    }
  });

  try {
    const res = await fetch('/api/motoristas', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error();

    await fetch(`/api/pedidos/${pedidoId}/coleta`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placa, motorista: nome, ajudante: nomeAjudante.join(', ') })
    });

    alert('Coleta iniciada com sucesso!');
    carregarPedidosPortaria();
  } catch (err) {
    console.error('Erro ao registrar coleta:', err);
    alert('Erro ao registrar coleta.');
    botao.disabled = false;
    botao.innerText = 'Iniciar Coleta';
  }
}

function monitorarUploads() {
  document.body.addEventListener('change', function (e) {
    if (e.target.type === 'file') {
      const wrapper = e.target.closest('.upload-wrapper');
      if (!wrapper) return;

      let checkIcon = wrapper.querySelector('.check-icon');
      if (!checkIcon) {
        checkIcon = document.createElement('i');
        checkIcon.className = 'fa fa-check check-icon';
        checkIcon.style.position = 'absolute';
        checkIcon.style.right = '16px';
        checkIcon.style.top = '50%';
        checkIcon.style.transform = 'translateY(-50%)';
        checkIcon.style.color = '#28a745';
        checkIcon.style.fontSize = '18px';
        wrapper.appendChild(checkIcon);
      }
      checkIcon.style.display = e.target.files.length ? 'block' : 'none';
    }
  });
}
