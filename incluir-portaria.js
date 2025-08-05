function usuarioTemPermissao(chave) {
  const permissoesJSON = sessionStorage.getItem('permissoes');
  if (!permissoesJSON) return false;
  try {
    const permissoes = JSON.parse(permissoesJSON);
    return permissoes.includes(chave);
  } catch {
    return false;
  }
}

const estiloErro = document.createElement('style');
estiloErro.textContent = `
  .campo-invalido {
    border: 2px solid red !important;
    background-color: #fff5f5;
  }
`;
document.head.appendChild(estiloErro);

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
    return dt.toLocaleDateString('pt-BR');
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
    const tipoPessoa = isAjudante ? 'Ajudante' : 'Motorista';

if (!data.encontrado) {
      html = `<span class="badge-status badge-nao-cadastrado">🟠 ${tipoPessoa} não cadastrado</span>`;
      html = `<span class="badge-status badge-nao-cadastrado">🟠 Motorista não cadastrado</span>`;
} else if (data.cadastroVencido) {
html = `<span class="badge-status badge-vencido">🔴 Cadastro vencido - necessário reenvio da ficha</span>`;
} else {
      html = `<span class="badge-status badge-ok">🟢 ${tipoPessoa} já cadastrado</span>`;
      html = `<span class="badge-status badge-ok">🟢 Motorista já cadastrado</span>`;
}

statusDiv.innerHTML = html;
statusDiv.style.display = 'block';
    statusDiv.style.marginTop = '6px';
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
const res = await fetch(`/api/pedidos/portaria?data=${hoje}`);
const pedidos = await res.json();

const lista = document.getElementById('lista-pedidos');
lista.innerHTML = '';

if (!pedidos.length) {
lista.innerHTML = "<p style='padding: 0 25px;'>Nenhum pedido encontrado.</p>";
return;
}

pedidos.sort((a, b) => {
const prioridade = status => status === 'Finalizado' ? 1 : 0;
return prioridade(a.status) - prioridade(b.status);
});

pedidos.forEach(pedido => {
const pedidoId = pedido.pedido_id || pedido.id;
const status = pedido.status;

const card = document.createElement('div');
card.className = 'card';

const header = document.createElement('div');
header.className = 'card-header';

const info = document.createElement('div');
info.className = 'info';
info.innerHTML = `
 <h3>${pedido.cliente}</h3>
 <p>Data prevista: ${formatarData(pedido.data_coleta)}</p>
 ${pedido.observacoes?.portaria ? `<p style="margin-top: 6px;"><strong>Obs:</strong> ${pedido.observacoes.portaria}</p>` : ''}
`;

const statusTag = document.createElement('div');
statusTag.className = 'status-badge';
if (status === 'Aguardando Início da Coleta') {
statusTag.classList.add('status-amarelo');
statusTag.textContent = 'Aguardando Início da Coleta';
} else {
statusTag.classList.add('status-verde');
statusTag.textContent = 'Coleta Iniciada';
}

header.appendChild(info);
header.appendChild(statusTag);
card.appendChild(header);

const linhaTempo = document.createElement('div');
linhaTempo.innerHTML = gerarLinhaTempoCompleta(pedido);
card.appendChild(linhaTempo);

setTimeout(() => {
const timeline = card.querySelector('.timeline-simples');
if (timeline) animarLinhaProgresso(timeline);
}, 20);

    if (podeExecutar(pedido.status) && usuarioTemPermissao('executar tarefa portaria')) {
  renderizarFormularioColeta(pedido, card);
    if (status === 'Aguardando Início da Coleta') {
  const usuarioLogado = JSON.parse(localStorage.getItem('usuarioLogado'));
  const tipo = usuarioLogado?.tipo?.toLowerCase() || '';

  // Apenas administrador e portaria podem ver o formulário de execução
  if (tipo === 'administrador' || tipo === 'portaria') {
    renderizarFormularioColeta(pedido, card);
  }
}

// Inserir observações da portaria se existirem

lista.appendChild(card);
});
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
  if (!usuarioTemPermissao('executar tarefa portaria')) {
    alert("Você não tem permissão para executar esta tarefa.");
    return;
  }

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

  let camposInvalidos = [];

if (!cpf) {
  camposInvalidos.push('CPF');
  document.getElementById(`cpf-${pedidoId}`).classList.add('campo-invalido');
}
if (!placa) {
  camposInvalidos.push('Placa');
  document.getElementById(`placa-${pedidoId}`).classList.add('campo-invalido');
}
if (!caminhaoInput.files.length) {
  camposInvalidos.push('Foto do Caminhão');
  caminhaoInput.classList.add('campo-invalido');
}

if (camposInvalidos.length > 0) {
  alert(`Preencha os seguintes campos obrigatórios: ${camposInvalidos.join(', ')}`);
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

// Se tem ajudante, os campos do ajudante devem ser obrigatórios
if (temAjudante === 'sim' && ajudantes.length === 0) {
  alert('Você informou que tem ajudante, mas os dados do ajudante não foram preenchidos.');
  botao.disabled = false;
  botao.innerText = 'Iniciar Coleta';
  return;
}

let camposAjudanteInvalidos = false;
  const nomeAjudante = [];

ajudantes.forEach((card, index) => {
  const cpfAjInput = card.querySelector(`#cpf-ajudante-${pedidoId}-${index}`);
  const nomeAjInput = card.querySelector(`#nome-ajudante-${index}`);
  const fichaAjInput = card.querySelector(`#ficha-ajudante-${index}`);
  const docAjInput = card.querySelector(`#doc-ajudante-${index}`);
  const ajudantes = Array.from(document.querySelectorAll(`[id^="card-ajudante-${pedidoId}-"]`));
  ajudantes.forEach((card, index) => {
    const cpfAj = card.querySelector(`#cpf-ajudante-${pedidoId}-${index}`)?.value;
    const nomeAj = card.querySelector(`#nome-ajudante-${index}`)?.value;
    const fichaAj = card.querySelector(`#ficha-ajudante-${index}`)?.files?.[0];
    const docAj = card.querySelector(`#doc-ajudante-${index}`)?.files?.[0];

  const cpfAj = cpfAjInput?.value?.trim();
  const nomeAj = nomeAjInput?.value?.trim();
  const fichaAj = fichaAjInput?.files?.[0];
  const docAj = docAjInput?.files?.[0];

  if (temAjudante === 'sim') {
    if (!cpfAj) {
      cpfAjInput?.classList.add('campo-invalido');
      camposInvalidos.push(`CPF do Ajudante`);
      camposAjudanteInvalidos = true;
    }
    if (!nomeAj) {
      nomeAjInput?.classList.add('campo-invalido');
      camposInvalidos.push(`Nome do Ajudante`);
      camposAjudanteInvalidos = true;
    }
    if (!fichaAj) {
      fichaAjInput?.classList.add('campo-invalido');
      camposInvalidos.push(`Ficha de Integração do Ajudante`);
      camposAjudanteInvalidos = true;
    }
    if (!docAj) {
      docAjInput?.classList.add('campo-invalido');
      camposInvalidos.push(`Documento com Foto do Ajudante`);
      camposAjudanteInvalidos = true;
    }

    if (!camposAjudanteInvalidos) {
    if (cpfAj && nomeAj) {
formData.append('cpf_ajudante', cpfAj);
formData.append('nome_ajudante', nomeAj);
      formData.append('ficha_ajudante', fichaAj);
      formData.append('documento_ajudante', docAj);
      if (fichaAj) formData.append('ficha_ajudante', fichaAj);
      if (docAj) formData.append('documento_ajudante', docAj);
nomeAjudante.push(nomeAj);
}
  }
});
  });

if (temAjudante === 'sim' && camposAjudanteInvalidos) {
  alert(`Preencha todos os dados do ajudante corretamente: ${camposInvalidos.join(', ')}`);
  botao.disabled = false;
  botao.innerText = 'Iniciar Coleta';
  return;
}
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
