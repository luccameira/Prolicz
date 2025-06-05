// ==== Gera a timeline padronizada ====
function gerarLinhaTempoCompleta(pedido) {
  const etapas = [
    {
      key: 'Aguardando Início da Coleta',
      nome: 'Aguardando Coleta',
      campoData: 'data_criacao'
    },
    {
      key: 'Coleta Iniciada',
      nome: 'Coleta Iniciada',
      campoData: 'data_coleta_iniciada'
    },
    {
      key: 'Coleta Finalizada',
      nome: 'Coleta Finalizada',
      campoData: 'data_coleta_finalizada'
    },
    {
      key: 'Aguardando Conferência do Peso',
      nome: 'Conferência do Peso',
      campoData: 'data_conferencia_peso'
    },
    {
      key: 'Em Análise pelo Financeiro',
      nome: 'Financeiro',
      campoData: 'data_financeiro'
    },
    {
      key: 'Aguardando Emissão de NF',
      nome: 'Emissão de Nota Fiscal',
      campoData: 'data_emissao_nf'
    },
    {
      key: 'Finalizado',
      nome: 'Finalizado',
      campoData: 'data_finalizado'
    }
  ];

  // === Regra principal de status ===
  let idxAtivo = etapas.findIndex(et => et.key === pedido.status);

  // ✅ Regra especial da portaria:
  // Sempre marcar "Aguardando Coleta" como concluído e ativar "Coleta Iniciada"
  if (pedido.status === 'Aguardando Início da Coleta') {
    idxAtivo = 1; // Marca "Aguardando Coleta" como done, e "Coleta Iniciada" como ativa
  }

  // Caso o status não exista, tenta usar o último com data registrada
  if (idxAtivo === -1) {
    for (let i = etapas.length - 1; i >= 0; i--) {
      if (pedido[etapas[i].campoData]) {
        idxAtivo = i;
        break;
      }
    }
  }

  let html = `<div class="timeline-simples">
      <div class="timeline-bar-bg"></div>
      <div class="timeline-bar-fg"></div>
  `;

  etapas.forEach((etapa, idx) => {
    const isConcluded = idx < idxAtivo;
    const isActive = idx === idxAtivo;

    let statusClass = '';
    if (isConcluded) statusClass = 'done';
    else if (isActive) statusClass = 'active';

    html += `
      <div class="timeline-step ${statusClass}">
        <div class="dot">
          ${isConcluded ? '<span style="font-size:20px;">&#10003;</span>' : ''}
        </div>
        <div class="label">${etapa.nome}</div>
        <div class="data">${formatarDataTimeline(pedido[etapa.campoData])}</div>
      </div>
    `;
  });

  html += `</div>`;
  return html;
}

// ==== Anima a barra de progresso ====
function animarLinhaProgresso(container) {
  const steps = container.querySelectorAll('.timeline-step');
  const fg = container.querySelector('.timeline-bar-fg');
  const bg = container.querySelector('.timeline-bar-bg');
  let ultimoFeito = -1;

  steps.forEach((step, idx) => {
    if (step.classList.contains('done') || step.classList.contains('active')) {
      ultimoFeito = idx;
    }
  });

  if (steps.length > 1 && fg && bg) {
    const firstDot = steps[0].querySelector('.dot').getBoundingClientRect();
    const lastDot = steps[steps.length - 1].querySelector('.dot').getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const start = (firstDot.left + firstDot.width / 2) - containerRect.left;
    const end = (lastDot.left + lastDot.width / 2) - containerRect.left;

    bg.style.left = `${start}px`;
    bg.style.width = `${end - start}px`;

    if (ultimoFeito >= 0) {
      const doneDot = steps[ultimoFeito].querySelector('.dot').getBoundingClientRect();
      const done = (doneDot.left + doneDot.width / 2) - containerRect.left;
      fg.style.left = `${start}px`;
      fg.style.width = `${done - start}px`;
    } else {
      fg.style.width = '0';
    }
  }
}

// ==== Formata a data da timeline ====
function formatarDataTimeline(data) {
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
