// Arquivo modificado: editar-venda.js
//
// Esta versão corrige o problema de comportamentos automáticos
// ao adicionar um novo produto na edição de pedidos. O bug era
// causado por ouvintes (`change`) duplicados que sobrescreviam
// o valor por quilo e não atualizavam subtotal/total. A lógica foi
// centralizada em um único handler de mudança e os duplicados foram
// removidos.

let pedidoAtual = null;
let produtosAutorizados = [];
let observacoes = [];
let materiais = [];
let editandoIndex = null;

function parseMask(str) {
  if (typeof str === "number") return str;
  if (!str) return 0;
  const limpo = str.toString().replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(limpo) || 0;
}

$(function () {
  flatpickr("#data-coleta", {
    locale: "pt",
    dateFormat: "Y-m-d",
    minDate: "today",
    allowInput: true
  });

  const urlParams = new URLSearchParams(window.location.search);
  const pedidoId = urlParams.get("id");

  function formatarNumero(valor, inteiro = false) {
    const partes = inteiro
      ? [Math.floor(valor).toString()]
      : valor.toFixed(2).replace(".", ",").split(",");
    partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return inteiro ? partes[0] : partes.join(",");
  }

  function atualizarTotal() {
    let tot = 0;
    $(".produto-bloco").each(function () {
      tot += parseMask($(this).find(".subtotal").val());
    });
    $("#valor-total").text("R$ " + formatarNumero(tot));
  }

  function updateRemoveButtons() {
    const cnt = $(".produto-bloco").length;
    $(".btn-remove").prop("disabled", cnt <= 1);
  }

  function updateAddButton() {
    const count = $(".produto-bloco").length;
    $("#adicionar-produto").prop("disabled", count >= produtosAutorizados.length);
  }

  // Função responsável por criar um bloco de produto e anexar todos os handlers
  function adicionarProduto(produto = {}) {
    // Verifica quais produtos já foram usados para montar as opções
    const usados = $(".produto-bloco")
      .map((i, el) => $(el).find(".select-produto").val())
      .get();
    const produtosPermitidos = [...new Set(produtosAutorizados.map(p => p.nome_produto))];
    const dispon = produtosPermitidos.filter(nome => !usados.includes(nome) || nome === produto.nome_produto);
    if (!dispon.length) return;

    const bloco = $('<div class="produto-bloco"></div>');
    const btnRemove = $('<button type="button" class="btn-remove">×</button>').click(function () {
      bloco.remove();
      atualizarTotal();
      updateAddButton();
      updateRemoveButtons();
    });
    bloco.append(btnRemove);

    // Select de produtos
    const selProd = $('<select class="select-produto" required><option value="">Produto</option></select>');
    dispon.forEach(nome => {
      const valor = produtosAutorizados.find(p => p.nome_produto === nome)?.valor_unitario || 0;
      selProd.append(`<option value="${nome}" data-valor="${valor}">${nome}</option>`);
    });
    bloco.append('<div class="form-group"><label>Produto</label></div>').children().last().append(selProd);

    // Campos de valor por quilo, peso e tipo de peso
    bloco.append('<div class="form-group"><label>Valor por Quilo</label><input readonly class="valor-por-quilo input-nao-editavel"></div>');
    bloco.append('<div class="form-group"><label>Peso (Kg)</label><input type="text" class="peso"></div>');
    bloco.append(`<div class="form-group"><label>Tipo de Peso</label>
      <select class="tipo-peso" required>
        <option value="">Selecione</option>
        <option value="Exato">Exato</option>
        <option value="Aproximado">Aproximado</option>
      </select>
    </div>`);
    bloco.append('<div class="form-group"><label>Subtotal</label><input readonly class="subtotal input-nao-editavel"></div>');

    // Select de código fiscal
    const selCodigo = $('<select class="select-codigo" required><option value="">Selecione</option></select>');
    bloco.append('<div class="form-group"><label>Código</label></div>').children().last().append(selCodigo);

    // Campos extras para Personalizar (valor com e sem nota)
    const divPersonalizado = $(`  
      <div class="personalizado-campos" style="display:none;">
        <div class="form-group"><label>Valor com Nota</label><input type="text" class="valor-com-nota"></div>
        <div class="form-group"><label>Valor sem Nota</label><input readonly class="valor-sem-nota input-nao-editavel"></div>
      </div>`);
    bloco.append(divPersonalizado);

    $("#produtos").append(bloco);

    // Handler de mudança do produto
    selProd.on('change', function () {
      const nome = $(this).val();

      // Preenche campos se este produto for parte de um pedido já salvo
      if (produto.peso) {
        bloco.find(".peso").val(formatarNumero(produto.peso, true));
      }
      if (produto.tipo_peso) {
        bloco.find(".tipo-peso").val(produto.tipo_peso);
      }
      if (produto.codigo_fiscal) {
        bloco.find(".select-codigo").val(produto.codigo_fiscal).trigger("change");
      }
      if (produto.valor_com_nota) {
        bloco.find(".valor-com-nota").val(formatarNumero(produto.valor_com_nota));
        const valorUnit = parseMask(produto.valor_unitario || 0);
        const valorNota = parseMask(produto.valor_com_nota);
        bloco.find(".valor-sem-nota").val(formatarNumero(Math.max(0, valorUnit - valorNota)));
      }

      // Procura o produto na lista de materiais ou de autorizados
      let prodSel = materiais.find(p => p.nome_produto === nome);
      if (!prodSel) {
        prodSel = produtosAutorizados.find(p => p.nome_produto === nome);
      }

      // Calcula o valor unitário em reais (divide por 100 se necessário)
      const unitRaw = parseFloat(prodSel?.valor_unitario || 0);
      const valorQuilo = unitRaw / 100;
      bloco.find(".valor-por-quilo").val(formatarNumero(valorQuilo));

      // Atualiza lista de códigos fiscais
      const codigos = [...new Set((pedidoAtual?.codigos_fiscais || []))];
      const selectCodigo = bloco.find(".select-codigo");
      selectCodigo.empty().append('<option value="">Selecione</option>');
      codigos.forEach(c => {
        const textoExibido = c === "Personalizar" ? "GAP" : c;
        selectCodigo.append(`<option value="${c}">${textoExibido}</option>`);
      });
      // Seleciona o primeiro código como padrão e dispara mudança
      selectCodigo.val(codigos[0] || "").trigger('change');

      // Lógica para campos Personalizar
      const inputComNota = bloco.find('.valor-com-nota');
      const inputSemNota = bloco.find('.valor-sem-nota');
      if (selectCodigo.val() === 'Personalizar') {
        divPersonalizado.show();
        let valorNota = parseMask(inputComNota.val());
        inputSemNota.val(formatarNumero(Math.max(0, valorQuilo - valorNota)));
        // Listeners para atualizar valores com/sem nota
        inputComNota.off('input blur');
        inputComNota.on('input', function () {
          let raw = $(this).val().replace(/\D/g, '');
          raw = raw.replace(/^0+/, '');
          if (raw.length < 3) raw = raw.padStart(3, '0');
          const formatado = raw.replace(/(\d+)(\d{2})$/, '$1,$2');
          $(this).val(formatado);
          const novoValorNota = parseMask($(this).val());
          inputSemNota.val(formatarNumero(Math.max(0, valorQuilo - novoValorNota)));
        });
        inputComNota.on('blur', function () {
          let raw = parseMask($(this).val());
          raw = Math.min(raw, Math.max(valorQuilo - 0.01, 0));
          $(this).val(formatarNumero(raw));
          inputSemNota.val(formatarNumero(Math.max(0, valorQuilo - raw)));
        });
      } else {
        divPersonalizado.hide();
        inputComNota.val('');
        inputSemNota.val('');
      }

      // Recalcula subtotal e total
      atualizarSub();
      atualizarTotal();
    });

    // Listener do campo de peso
    bloco.find('.peso').on('input', function () {
      const val = parseMask($(this).val());
      $(this).val(formatarNumero(val, true));
      atualizarSub();
      atualizarTotal();
    });

    // Função interna para atualizar o subtotal
    function atualizarSub() {
      const v = parseMask(bloco.find('.valor-por-quilo').val());
      const p = parseMask(bloco.find('.peso').val());
      bloco.find('.subtotal').val('R$ ' + formatarNumero(v * p));
    }

    // Se o produto possui nome pré‑definido, seleciona e dispara o change
    if (produto.nome_produto) {
      selProd.val(produto.nome_produto).trigger('change');
    }

    // Se houver código fiscal definido no objeto, seleciona e dispara mudança
    if (produto.codigo_fiscal) {
      selCodigo.val(produto.codigo_fiscal).trigger('change');
    }

    // Ajuste de valores iniciais quando carregado de um pedido salvo
    const valorInicial = parseMask(produto.valor_unitario) / 100;
    const pesoInicial = parseMask(produto.peso) / 1000;
    const tipoPesoInicial = produto.tipo_peso || '';
    bloco.find('.valor-por-quilo').val(formatarNumero(valorInicial));
    bloco.find('.peso').val(formatarNumero(pesoInicial, true));
    bloco.find('.tipo-peso').val(tipoPesoInicial);
    bloco.find('.subtotal').val('R$ ' + formatarNumero(valorInicial * pesoInicial));

    // Lógica de Personalizar se código já está definido no carregamento
    if (produto.codigo_fiscal === 'Personalizar') {
      divPersonalizado.show();
      const inputComNota = bloco.find('.valor-com-nota');
      const inputSemNota = bloco.find('.valor-sem-nota');
      const inputValorQuilo = bloco.find('.valor-por-quilo');
      const valorKg = parseMask(inputValorQuilo.val());
      let valorNota = parseMask(produto.valor_com_nota) / 100;
      inputComNota.val(formatarNumero(valorNota));
      inputSemNota.val(formatarNumero(Math.max(0, valorKg - valorNota)));
      inputComNota.off('input blur');
      inputComNota.on('input', function () {
        let raw = $(this).val().replace(/\D/g, '');
        raw = raw.replace(/^0+/, '');
        if (raw.length < 3) raw = raw.padStart(3, '0');
        const formatado = raw.replace(/(\d+)(\d{2})$/, '$1,$2');
        $(this).val(formatado);
        const novoValorNota = parseMask($(this).val());
        const valorAtual = parseMask(inputValorQuilo.val());
        inputSemNota.val(formatarNumero(Math.max(0, valorAtual - novoValorNota)));
      });
      inputComNota.on('blur', function () {
        const vUnit = parseMask(inputValorQuilo.val());
        let raw = parseMask($(this).val());
        raw = Math.min(raw, Math.max(vUnit - 0.01, 0));
        $(this).val(formatarNumero(raw));
        inputSemNota.val(formatarNumero(Math.max(0, vUnit - raw)));
      });
    }

    // Mostra ou oculta campos de Personalizar ao mudar o código
    selCodigo.on('change', function () {
      const isPersonalizar = $(this).val() === 'Personalizar';
      divPersonalizado.toggle(isPersonalizar);
    });

    // Atualiza botões após adicionar
    updateAddButton();
    updateRemoveButtons();
  }

  function renderizarObservacoes() {
    const containerComum = document.getElementById('observacoes-comuns');
    const containerReset = document.getElementById('resets-confirmados');
    containerComum.innerHTML = '';
    containerReset.innerHTML = '';
    const agrupadas = [];
    observacoes.forEach((obs, index) => {
      const key = `${obs.texto}__${obs.usuario_nome || 'Sistema'}__${obs.data_criacao || ''}`;
      const existente = agrupadas.find(item => item.chave === key);
      if (existente && !obs.texto.trim().startsWith('[RESET]')) {
        if (!existente.setores.includes(obs.setor)) {
          existente.setores.push(obs.setor);
        }
        existente.indices.push(index);
      } else {
        agrupadas.push({
          chave: key,
          texto: obs.texto,
          setores: [obs.setor],
          indices: [index],
          usuario: obs.usuario_nome || 'Sistema',
          data: obs.data_criacao || ''
        });
      }
    });
    agrupadas.forEach(item => {
      const setores = item.setores.join(', ');
      const primeiroIndex = item.indices[0];
      const ehReset = item.texto.trim().startsWith('[RESET]');
      const textoLimpo = item.texto.replace('[RESET]', '').trim();
      const usuario = item.usuario;
      const data = item.data ? new Date(item.data).toLocaleString('pt-BR') : '';
      const div = document.createElement('div');
      div.className = 'obs-item';
      if (ehReset) {
        const match = item.texto.match(/\[RESET\] Etapa anterior: (.+?)\. Nova etapa: (.+?)\. Justificativa: (.+)/);
        let etapaAntes = '';
        let etapaDepois = '';
        let justificativa = textoLimpo;
        if (match) {
          etapaAntes = match[1];
          etapaDepois = match[2];
          justificativa = match[3];
        }
        div.innerHTML = `
          <div class="obs-resetada">
            <div class="obs-reset-header">
              <strong class="titulo-reset">Justificativa da Correção</strong>
              <span class="data-reset">${data}</span>
            </div>
            <div class="texto-reset">
              <p>${justificativa}</p>
              <span class="usuario-reset">Usuário: ${usuario}</span>
              ${etapaAntes && etapaDepois ? `
                <div class="usuario-reset" style="margin-top: 5px;">
                  Estava na etapa → ${etapaAntes}<br>
                  Retornado para → ${etapaDepois}
                </div>
              ` : ''}
            </div>
          </div>
        `;
        containerReset.appendChild(div);
      } else {
        div.innerHTML = `
          <div class="obs-normal">
            <strong>🔸 ${setores}:</strong><br>
            <span>${item.texto}</span>
            <div class="obs-acoes">
              <button onclick="editarObservacao(${primeiroIndex}, event)">✏️</button>
              <button onclick="excluirObservacao(${primeiroIndex})">🗑️</button>
            </div>
          </div>
        `;
        containerComum.appendChild(div);
      }
    });
  }

  window.editarObservacao = function (i, event) {
    if (event) event.preventDefault();
    const obs = observacoes[i];
    const relacionados = observacoes
      .map((o, idx) => ({ ...o, idx }))
      .filter(o => o.texto === obs.texto);
    const setores = relacionados.map(o => o.setor);
    $("#setor-observacao").val(setores).trigger('change');
    $("#texto-observacao").val(obs.texto).prop('disabled', false);
    $("#observacao-bloco").slideDown();
    $("#btn-adicionar-observacao").hide();
    $("#btn-confirmar-observacao").text('Editar Observação');
    editandoIndex = relacionados.map(o => o.idx);
  };

  window.excluirObservacao = function (i) {
    if (!confirm("Você tem certeza que deseja excluir esta observação?")) return;
    const textoReferencia = observacoes[i].texto;
    observacoes = observacoes.filter(obs => obs.texto !== textoReferencia);
    renderizarObservacoes();
  };

  $("#btn-adicionar-observacao").click(function () {
    $("#setor-observacao").val(null).trigger('change');
    $("#texto-observacao").val('').prop('disabled', true);
    $("#observacao-bloco").slideDown();
    $(this).hide();
    $("#btn-confirmar-observacao").text('Confirmar Observação');
    editandoIndex = null;
  });

  $("#btn-fechar-observacao").click(function () {
    $("#observacao-bloco").slideUp();
    $("#btn-adicionar-observacao").show();
    $("#setor-observacao").val('');
    $("#texto-observacao").val('').prop('disabled', true);
    editandoIndex = null;
  });

  $("#setor-observacao").on('change', function () {
    let valores = $(this).val();
    if (valores && valores.includes('Todos')) {
      const todosSetores = [
        'Portaria',
        'Carga e Descarga',
        'Conferência de Peso',
        'Financeiro',
        'Emissão de NF'
      ];
      $("#setor-observacao").val(todosSetores).trigger('change');
      valores = todosSetores;
    }
    $("#texto-observacao").prop('disabled', !valores || valores.length === 0);
  });

  $("#btn-confirmar-observacao").click(function () {
    const setores = $("#setor-observacao").val();
    const texto = $("#texto-observacao").val().trim();
    if (!setores || !texto) return alert('Selecione um setor e digite a observação.');
    if (editandoIndex !== null) {
      observacoes = observacoes.filter((_, idx) => !editandoIndex.includes(idx));
      setores.forEach(s => observacoes.push({ setor: s, texto }));
    } else {
      setores.forEach(s => observacoes.push({ setor: s, texto }));
    }
    renderizarObservacoes();
    $("#setor-observacao").val('');
    $("#texto-observacao").val('').prop('disabled', true);
    $("#observacao-bloco").slideUp();
    $("#btn-adicionar-observacao").text('Adicionar outra observação').show();
    editandoIndex = null;
  });

  $("#prazo-pagamento").select2({
    width: '100%',
    placeholder: 'Selecione os prazos',
    allowClear: true,
    multiple: true
  });

  // Carrega os dados do pedido existente
  if (pedidoId) {
    fetch(`/api/pedidos/${pedidoId}`)
      .then(res => res.json())
      .then(pedido => {
        pedidoAtual = pedido;
        $("#empresa").val(pedido.empresa || '');
        // Nome do cliente pode vir como 'cliente' no JSON retornado
        $("#cliente_nome").val(pedido.cliente || pedido.cliente_nome || '');
        $("#data-coleta").val(pedido.data_coleta?.substring(0, 10) || '');
        $("#pedido-para").val(pedido.tipo || '');
        produtosAutorizados = pedido.produtos_autorizados || [];
        materiais = pedido.materiais || [];
        const prazosSelecionadosTexto = Array.isArray(pedido.prazo_pagamento)
          ? pedido.prazo_pagamento
          : typeof pedido.prazo_pagamento === 'string'
          ? [pedido.prazo_pagamento]
          : [];
        const todosTextos = Array.isArray(pedido.prazos_permitidos)
          ? pedido.prazos_permitidos
          : [];
        $("#prazo-pagamento").empty();
        todosTextos.forEach(texto => {
          const opt = $("<option>").val(texto).text(texto);
          if (prazosSelecionadosTexto.includes(texto)) {
            opt.prop('selected', true);
          }
          $("#prazo-pagamento").append(opt);
        });
        $("#prazo-pagamento").trigger('change');
        const textoNormalizado = prazosSelecionadosTexto
          .join(' ')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
        if (textoNormalizado.includes('avista') || textoNormalizado.includes('a vista')) {
          $("#condicao-a-vista").show();
          $("#condicao_pagamento_a_vista").val(pedido.condicao_pagamento_avista || '').prop('required', true);
        } else {
          $("#condicao-a-vista").hide();
          $("#condicao_pagamento_a_vista").val('').prop('required', false);
        }
        materiais.forEach(prod => {
          adicionarProduto({
            nome_produto: prod.nome_produto,
            valor_unitario: prod.valor_unitario,
            peso: prod.peso,
            tipo_peso: prod.tipo_peso,
            codigo_fiscal: prod.codigo_fiscal,
            valor_com_nota: prod.valor_com_nota
          });
        });
        if (pedido.observacoes) {
          observacoes = pedido.observacoes.map(obs => ({
            setor: obs.setor,
            texto: obs.texto_observacao || obs.texto,
            usuario_nome: obs.usuario_nome || 'Sistema',
            data_criacao: obs.data_criacao || ''
          }));
          renderizarObservacoes();
        }
        atualizarTotal();
      });
  }

  // Implementação do botão de resetar tarefa (mantida sem alterações)
  $("#btn-resetar-tarefa").on('click', function () {
    const mapaStatus = {
      'Aguardando Início da Coleta': 'Portaria',
      'Coleta Iniciada': 'Carga e Descarga',
      'Coleta Finalizada': 'Carga e Descarga',
      'Aguardando Conferência do Peso': 'Conferência de Peso',
      'Em Análise pelo Financeiro': 'Financeiro',
      'Aguardando Emissão de NF': 'Emissão de NF'
    };
    const fluxoSetores = ['Portaria', 'Carga e Descarga', 'Conferência de Peso', 'Financeiro', 'Emissão de NF'];
    const etapaAtual = mapaStatus[pedidoAtual.status] || '';
    $("#nome-etapa-atual").text(etapaAtual);
    const indexAtual = fluxoSetores.indexOf(etapaAtual);
    $("#setor-resetar option").each(function () {
      const setor = $(this).val();
      const indexSetor = fluxoSetores.indexOf(setor);
      if (indexSetor >= indexAtual) {
        $(this).prop('disabled', true);
      } else {
        $(this).prop('disabled', false);
      }
    });
    $("#modal-resetar-tarefa").fadeIn();
  });
  $("#btn-cancelar-reset").on('click', function () {
    $("#modal-resetar-tarefa").fadeOut();
  });
  $("#btn-confirmar-reset").on('click', function () {
    const setor = $("#setor-resetar").val();
    const motivo = $("#motivo-reset").val().trim();
    if (!setor) {
      alert('Selecione um setor para resetar a tarefa.');
      return;
    }
    if (!motivo) {
      alert('Explique o motivo da correção.');
      return;
    }
    if (!confirm(`Tem certeza que deseja resetar esta tarefa para o setor ${setor}? Esta ação é irreversível.`)) {
      return;
    }
    fetch(`/api/pedidos/${pedidoId}/resetar-tarefa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ setor, motivo })
    })
      .then(res => res.json())
      .then(data => {
        alert('Tarefa resetada com sucesso!');
        location.reload();
      })
      .catch(err => {
        console.error(err);
        alert('Erro ao resetar tarefa.');
      });
  });
  $('#setor-observacao').on('select2:open', function () {
    $("#texto-observacao").css('margin-top', '150px');
  });
  $('#setor-observacao').on('select2:close', function () {
    $("#texto-observacao").css('margin-top', '0');
  });
  // Clique para adicionar um novo produto (sem duplicar handlers)
  $('#adicionar-produto').on('click', function () {
    adicionarProduto();
  });
});

// Envio do formulário de edição
const formulario = document.querySelector('#form-editar-pedido');
formulario.addEventListener('submit', async (e) => {
  e.preventDefault();
  const urlParams = new URLSearchParams(window.location.search);
  const pedidoId = urlParams.get('id');
  if (!pedidoId) return alert('ID do pedido não encontrado.');
  const cliente_id = pedidoAtual?.cliente_id || '';
  const empresa = document.querySelector('#empresa')?.value || '';
  const tipo_pedido = document.querySelector('#pedido-para')?.value || '';
  const data_prevista = document.querySelector('#data-coleta')?.value || '';
  const tipo_peso = $(".produto-bloco").length ? $(".produto-bloco").first().find('.tipo-peso').val() || '' : '';
  const itens = [...document.querySelectorAll('.produto-bloco')].map((bloco) => {
    const nome_produto = bloco.querySelector('.select-produto')?.value || '';
    const valor_unitario = parseFloat(parseMask(bloco.querySelector('.valor-por-quilo')?.value)) || 0;
    const peso = parseFloat(parseMask(bloco.querySelector('.peso')?.value)) || 0;
    const tipo_peso = bloco.querySelector('.tipo-peso')?.value || '';
    const codigo_fiscal = bloco.querySelector('.select-codigo')?.value || '';
    const valor_com_nota = parseFloat(parseMask(bloco.querySelector('.valor-com-nota')?.value)) || null;
    const valor_sem_nota = parseFloat(parseMask(bloco.querySelector('.valor-sem-nota')?.value)) || null;
    return {
      nome_produto,
      valor_unitario,
      peso,
      tipo_peso,
      codigo_fiscal,
      valor_com_nota,
      valor_sem_nota
    };
  });
  const prazosSelecionados = $('#prazo-pagamento').val() || [];
  const prazos = prazosSelecionados.map((descricao) => {
    let dias = 0;
    if (descricao.toLowerCase().includes('à vista') || descricao.toLowerCase().includes('a vista')) {
      dias = 0;
    } else {
      const match = descricao.match(/\d+/);
      dias = match ? parseInt(match[0], 10) : 0;
    }
    return { descricao, dias };
  });
  const observacoesPayload = observacoes.map(obs => ({
    setor: obs.setor,
    texto: obs.texto_observacao || obs.texto || ''
  }));
  const payload = {
    cliente_id,
    empresa,
    tipo: tipo_pedido,
    data_coleta: document.getElementById('data-coleta')?.value || null,
    tipo_peso,
    itens,
    prazos,
    observacoes: observacoesPayload,
    condicao_pagamento_a_vista: document.querySelector('#condicao_pagamento_a_vista')?.value || ''
  };
  try {
    const resposta = await fetch(`/api/pedidos/${pedidoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resposta.ok) throw new Error('Erro ao salvar alterações.');
    alert('Pedido atualizado com sucesso!');
    window.location.href = `visualizar-venda.html?id=${pedidoId}`;
  } catch (erro) {
    console.error(erro);
    alert('Erro ao atualizar pedido.');
  }
});
