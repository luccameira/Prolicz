function formatarData(data) {
  if (!data) return '–';
  const dt = new Date(data);
  return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatarNomeEmpresa(nome) {
  if (!nome) return '–';
  if (nome.toLowerCase() === 'pronasa') return 'PRONASA';
  if (nome.toLowerCase() === 'mellicz') return 'Mellicz';
  return nome;
}

function gerarMateriais(pedido) {
  if (!pedido.materiais || !pedido.materiais.length) return '';

  return pedido.materiais.map(mat => `
    <div class="material-bloco" style="margin-bottom: 20px;">
      <h4>${mat.nome_produto} (${mat.codigo_fiscal || '–'})</h4>
      <p><strong>Unidade:</strong> ${mat.unidade || '–'}</p>
      <p><strong>Peso Carregado:</strong> ${parseFloat(mat.peso_carregado || 0).toLocaleString('pt-BR')} kg</p>
      <p><strong>Tipo de Peso:</strong> ${mat.tipo_peso || '–'}</p>
      <p><strong>Valor Unitário:</strong> R$ ${parseFloat(mat.valor_unitario || 0).toLocaleString('pt-BR')}</p>
      <p><strong>Subtotal:</strong> R$ ${parseFloat(mat.valor_total || 0).toLocaleString('pt-BR')}</p>
    </div>
  `).join('');
}

function montarCard(pedido) {
  const timeline = gerarLinhaTempoCompleta(pedido);
  const empresaFormatada = formatarNomeEmpresa(pedido.empresa);

  return `
    <div class="card">
      <div class="card-header" onclick="alternarCard(this)">
        <div class="info">
          <h3>${pedido.cliente}</h3>
          <p><strong>Empresa:</strong> ${empresaFormatada}</p>
        </div>
        <div class="status-badge status-amarelo">
          <i class="fa-solid fa-receipt"></i> ${pedido.status}
        </div>
      </div>

      ${timeline}

      <div class="card-body" style="display: none; padding: 20px 32px 32px;">
        <div style="margin-bottom: 16px;">
  <p><strong>Nome Fantasia:</strong> ${pedido.cliente}</p>
  <p><strong>CNPJ:</strong> ${pedido.cnpj || '–'}</p>
  <p><strong>Situação Tributária:</strong> ${pedido.situacao_tributaria || '–'}</p>
  <p><strong>Inscrição Estadual:</strong> ${pedido.inscricao_estadual || '–'}</p>
  <p><strong>Endereço:</strong> ${pedido.endereco || '–'}</p>
</div>

        <div style="margin-bottom: 16px;">
  ${gerarMateriais(pedido)}
</div>

${['Aguardando Emissão de NF', 'Cliente Liberado'].includes(pedido.status) ? `
  <form class="formulario-nf" enctype="multipart/form-data">
    <label for="numero_nf_${pedido.pedido_id}">Número da Nota Fiscal</label>
    <input type="text" id="numero_nf_${pedido.pedido_id}" name="numero_nf" maxlength="15" required>

    <label for="arquivo_nf_${pedido.pedido_id}">Arquivo da NF (PDF)</label>
    <input type="file" id="arquivo_nf_${pedido.pedido_id}" name="arquivo_nf" accept="application/pdf" required>

    ${pedido.observacoes_setor?.length ? `
  <div style="display: flex; align-items: stretch; margin: 20px 0; border-radius: 6px; overflow: hidden;">
    <div style="width: 6px; background-color: #f4b400;"></div>
    <div style="background: #fff3cd; padding: 16px 20px; flex: 1;">
      <p style="font-weight: bold; margin: 0 0 8px;">Observações para Emissão de Nota Fiscal:</p>
      <div style="font-size: 14px; line-height: 1.5; color: #000;">
        ${pedido.observacoes_setor.map(obs => `<div>${obs}</div>`).join('')}
      </div>
    </div>
  </div>
` : ''}

    <button class="btn btn-registrar-nf" onclick="emitirNota(${pedido.pedido_id}, this)">Registrar Nota Fiscal</button>
  </form>
  </div>
  ` : `
    <div style="margin-top: 16px;">
      <p style="color: #888;">Este pedido ainda não está disponível para emissão de nota fiscal.</p>
    </div>
  `}
  </div> <!-- card-body -->
</div> <!-- card -->
`;
} // <-- ESTA CHAVE FECHA A FUNÇÃO montarCard CORRETAMENTE

function alternarCard(headerElement) {
  const card = headerElement.closest('.card');
  const status = card.querySelector('.status-badge')?.textContent?.trim();

  // Permitir abrir o card somente se o status estiver entre os permitidos
  const statusPermitidos = ['Aguardando Emissão de NF', 'Cliente Liberado'];
  if (!statusPermitidos.includes(status)) return;

  // Verificar se o usuário logado é do tipo administrador ou emissão de nf
  const usuarioStr = localStorage.getItem('usuarioLogado');
  let tipoUsuario = '';
  try {
    tipoUsuario = JSON.parse(usuarioStr)?.tipo?.toLowerCase() || '';
  } catch (error) {
    console.error('Erro ao analisar usuarioLogado:', error);
  }
  const tiposPermitidos = ['administrador', 'emissão de nf'];
  if (!tiposPermitidos.includes(tipoUsuario)) return;

  // Alternar exibição do card
  const corpo = card.querySelector('.card-body');
  corpo.style.display = corpo.style.display === 'none' ? 'block' : 'none';
}

async function carregarPedidosNotaFiscal() {
  try {
    const res = await fetch('/api/pedidos');
    const pedidos = await res.json();

    if (!Array.isArray(pedidos)) throw new Error('Formato inválido');

    const pedidosFiltrados = pedidos; // Exibe todos os pedidos, como nas outras telas

    const lista = document.getElementById('lista-pedidos');
    const filtro = document.getElementById('filtro-cliente')?.value.toLowerCase() || '';
    const ordenar = document.getElementById('ordenar')?.value || 'data';

    let filtrados = pedidosFiltrados.filter(p => p.cliente.toLowerCase().includes(filtro));

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
      lista.innerHTML += montarCard(pedido);
    });

    document.querySelectorAll('.timeline-simples').forEach(animarLinhaProgresso);
  } catch (erro) {
    console.error('Erro ao carregar pedidos:', erro);
    document.getElementById('lista-pedidos').innerHTML = "<p style='padding: 0 25px;'>Erro ao carregar tarefas de emissão de NF.</p>";
  }
}

async function emitirNota(pedidoId, btn) {
  btn.disabled = true;
  const card = btn.closest('.card');
  const numero = card.querySelector('input[name="numero_nf"]').value.trim();
  const arquivo = card.querySelector('input[name="arquivo_nf"]').files[0];

  if (!numero || !arquivo) {
    alert('Preencha o número da NF e selecione o arquivo PDF.');
    btn.disabled = false;
    return;
  }

  const formData = new FormData();
  formData.append('numero_nf', numero);
  formData.append('arquivo_nf', arquivo);

  try {
    const res = await fetch(`/api/pedidos/${pedidoId}/emitir-nf`, {
      method: 'PUT',
      body: formData
    });

    const data = await res.json();
    alert(data.mensagem || 'Nota fiscal registrada com sucesso.');
    carregarPedidosNotaFiscal();
  } catch (error) {
    console.error('Erro ao emitir nota:', error);
    alert('Erro ao registrar nota fiscal.');
  } finally {
    btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  carregarPedidosNotaFiscal();
  document.getElementById('filtro-cliente')?.addEventListener('input', carregarPedidosNotaFiscal);
  document.getElementById('ordenar')?.addEventListener('change', carregarPedidosNotaFiscal);
});
