// editar-venda.js (com prazos: pré-preenchidos e edição só com autorizados)

let pedidoAtual = null;
let produtosAutorizados = [];
let observacoes = [];
let materiais = [];
let editandoIndex = null;

// >>> novo: prazos que aparecem apenas para informação (não-autorizados)
let prazosSomenteExibicao = [];

function parseMask(str) {
  if (typeof str === "number") return str;
  if (!str) return 0;
  const limpo = str.toString().replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(limpo) || 0;
}
function formatarNumero(valor, inteiro = false) {
  if (isNaN(valor) || valor === null) valor = 0;
  const partes = inteiro
    ? [Math.floor(valor).toString()]
    : Number(valor).toFixed(2).replace(".", ",").split(",");
  partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return inteiro ? partes[0] : partes.join(",");
}

// ---------- helpers de fallback/normalização ----------
function normalizeTxt(s) {
  return (s || "")
    .toString()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
function trySetSelectByExact($sel, value) {
  if (!value) return false;
  const val = value.toString();
  const found = $sel.find(`option[value="${val}"]`).length > 0;
  if (found) $sel.val(val);
  return found;
}
function trySetSelectByText($sel, value) {
  if (!value) return false;
  const v = normalizeTxt(value);
  let matched = null;
  $sel.find("option").each(function () {
    const text = normalizeTxt($(this).text());
    if (text === v) matched = $(this).attr("value");
  });
  if (matched !== null) {
    $sel.val(matched);
    return true;
  }
  return false;
}
function warnSelectMismatch(nomeCampo, valor, $sel) {
  const opts = $sel.find("option").map((_, o) => $(o).text().trim()).get().join(" | ");
  console.warn(`[editar-venda] Valor inesperado para ${nomeCampo}: "${valor}". Opções: ${opts}`);
}
function ensureSelect($sel, valor, nomeCampo) {
  if (trySetSelectByExact($sel, valor)) return true;
  if (trySetSelectByText($sel, valor)) return true;
  if (valor) warnSelectMismatch(nomeCampo, valor, $sel);
  $sel.val("");
  return false;
}

$(function () {
  flatpickr("#data-coleta", { locale: "pt", dateFormat: "Y-m-d", allowInput: true });

  $("#prazo-pagamento").select2({
    width: '100%',
    placeholder: 'Selecione os prazos',
    allowClear: true,
    multiple: true
  });

  const urlParams = new URLSearchParams(window.location.search);
  const pedidoId = urlParams.get("id");

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
    const usados = $(".produto-bloco").map((_, el) => $(el).find(".select-produto").val()).get();
    const nomesPermitidos = [...new Set(produtosAutorizados.map(p => p.nome_produto))];
    const dispon = nomesPermitidos.filter(n => !usados.includes(n));
    $("#adicionar-produto").prop("disabled", dispon.length === 0);
  }

  function adicionarProduto(produto = {}) {
    const usados = $(".produto-bloco").map((i, el) => $(el).find(".select-produto").val()).get();
    const nomesPermitidos = [...new Set(produtosAutorizados.map(p => p.nome_produto))];
    const disponiveis = nomesPermitidos.filter(n => !usados.includes(n) || n === produto.nome_produto);
    if (!disponiveis.length) return;

    const bloco = $('<div class="produto-bloco"></div>');
    const btnRemove = $('<button type="button" class="btn-remove">×</button>').on('click', () => {
      bloco.remove();
      atualizarTotal();
      updateAddButton();
      updateRemoveButtons();
    });
    bloco.append(btnRemove);

    const selProd = $('<select class="select-produto" required><option value="">Produto</option></select>');
    disponiveis.forEach(nome => {
      const p = produtosAutorizados.find(x => x.nome_produto === nome);
      const valor = p ? Number(p.valor_unitario) : 0;
      selProd.append(`<option value="${nome}" data-valor="${valor}">${nome}</option>`);
    });
    bloco.append('<div class="form-group"><label>Produto</label></div>').children().last().append(selProd);

    bloco.append('<div class="form-group"><label>Valor por Quilo</label><input readonly class="valor-por-quilo input-nao-editavel"></div>');
    bloco.append('<div class="form-group"><label>Peso (Kg)</label><input type="text" class="peso"></div>');
    bloco.append(`
      <div class="form-group">
        <label>Tipo de Peso</label>
        <select class="tipo-peso" required>
          <option value="">Selecione</option>
          <option value="Exato">Exato</option>
          <option value="Aproximado">Aproximado</option>
        </select>
      </div>
    `);
    bloco.append('<div class="form-group"><label>Subtotal</label><input readonly class="subtotal input-nao-editavel"></div>');

    const selCodigo = $('<select class="select-codigo" required><option value="">Selecione</option></select>');
    bloco.append('<div class="form-group"><label>Código</label></div>').children().last().append(selCodigo);

    const divPersonalizado = $(`
      <div class="personalizado-campos" style="display:none;">
        <div class="form-group"><label>Valor com Nota</label><input type="text" class="valor-com-nota"></div>
        <div class="form-group"><label>Valor sem Nota</label><input readonly class="valor-sem-nota input-nao-editavel"></div>
      </div>
    `);
    bloco.append(divPersonalizado);

    $("#produtos").append(bloco);

    const getValorKg = () => parseMask(bloco.find('.valor-por-quilo').val());
    const getPeso = () => parseMask(bloco.find('.peso').val());
    const formatMoney = (n) => 'R$ ' + formatarNumero(n || 0);

    function atualizarSub() {
      bloco.find('.subtotal').val(formatMoney(getValorKg() * getPeso()));
    }
    function montarCodigosFiscais(selecionado) {
      const codigos = [...new Set(pedidoAtual?.codigos_fiscais || [])];
      selCodigo.empty().append('<option value="">Selecione</option>');
      codigos.forEach(c => {
        const label = (c === 'Personalizar') ? 'GAP' : c;
        selCodigo.append(`<option value="${c}">${label}</option>`);
      });
      if (selecionado) selCodigo.val(selecionado);
      else selCodigo.val(codigos[0] || '');
      selCodigo.trigger('change');
    }
    function ligarPersonalizar() {
      const inputComNota = bloco.find('.valor-com-nota');
      const inputSemNota = bloco.find('.valor-sem-nota');

      function reformatarComNota() {
        let raw = inputComNota.val().replace(/\D/g, '');
        raw = raw.replace(/^0+/, '');
        if (raw.length < 3) raw = raw.padStart(3, '0');
        const formatado = raw.replace(/(\d+)(\d{2})$/, '$1,$2');
        inputComNota.val(formatado);
      }
      function recalcularSemNota() {
        const vKg = getValorKg();
        const vNota = parseMask(inputComNota.val());
        inputSemNota.val(formatarNumero(Math.max(0, vKg - vNota)));
      }
      inputComNota.off('input blur').on('input', () => {
        reformatarComNota();
        recalcularSemNota();
      }).on('blur', () => {
        const vKg = getValorKg();
        let vNota = parseMask(inputComNota.val());
        vNota = Math.min(vNota, Math.max(vKg - 0.01, 0));
        inputComNota.val(formatarNumero(vNota));
        recalcularSemNota();
      });
    }

    selProd.on('change', function () {
      const nome = $(this).val();
      if (!nome) {
        bloco.find('.valor-por-quilo').val('');
        bloco.find('.subtotal').val('');
        divPersonalizado.hide();
        atualizarTotal();
        return;
      }
      let p = (materiais || []).find(x => x.nome_produto === nome);
      if (!p) p = produtosAutorizados.find(x => x.nome_produto === nome);

      const valorQuilo = Number(p?.valor_unitario || 0);
      bloco.find('.valor-por-quilo').val(formatarNumero(valorQuilo));

      montarCodigosFiscais(produto.codigo_fiscal);

      if (selCodigo.val() === 'Personalizar') {
        divPersonalizado.show();
        const inputComNota = bloco.find('.valor-com-nota');
        const inputSemNota = bloco.find('.valor-sem-nota');
        if (produto && produto.valor_com_nota != null) inputComNota.val(formatarNumero(Number(produto.valor_com_nota)));
        else inputComNota.val('');
        inputSemNota.val(formatarNumero(Math.max(0, valorQuilo - parseMask(inputComNota.val()))));
        ligarPersonalizar();
      } else {
        divPersonalizado.hide();
        bloco.find('.valor-com-nota').val('');
        bloco.find('.valor-sem-nota').val('');
      }

      atualizarSub();
      atualizarTotal();
    });

    bloco.find('.peso').on('input', function () {
      const val = parseMask($(this).val());
      $(this).val(formatarNumero(val, true));
      atualizarSub();
      atualizarTotal();
    });

    selCodigo.on('change', function () {
      const isPers = $(this).val() === 'Personalizar';
      divPersonalizado.toggle(isPers);
      if (isPers) ligarPersonalizar();
      atualizarSub();
      atualizarTotal();
    });

    const veioDoPedido = !!Object.keys(produto || {}).length;
    if (veioDoPedido) {
      if (produto.valor_unitario != null) bloco.find('.valor-por-quilo').val(formatarNumero(Number(produto.valor_unitario)));
      if (produto.peso != null) bloco.find('.peso').val(formatarNumero(Number(produto.peso), true));
      if (produto.tipo_peso) bloco.find('.tipo-peso').val(produto.tipo_peso);
    }

    if (produto.nome_produto) selProd.val(produto.nome_produto);
    selProd.trigger('change');

    if (produto.codigo_fiscal === 'Personalizar') {
      const inputComNota = bloco.find('.valor-com-nota');
      const inputSemNota = bloco.find('.valor-sem-nota');
      if (produto.valor_com_nota != null) inputComNota.val(formatarNumero(Number(produto.valor_com_nota)));
      const vKg = parseMask(bloco.find('.valor-por-quilo').val());
      inputSemNota.val(formatarNumero(Math.max(0, vKg - parseMask(inputComNota.val()))));
      ligarPersonalizar();
    }

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
        if (!existente.setores.includes(obs.setor)) existente.setores.push(obs.setor);
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

      if (ehReset) {
        div.className = 'obs-item';
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
        div.className = 'obs-item';
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
    const relacionados = observacoes.map((o, idx) => ({ ...o, idx })).filter(o => o.texto === obs.texto);
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
      const todosSetores = ['Portaria', 'Carga e Descarga', 'Conferência de Peso', 'Financeiro', 'Emissão de NF'];
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

  // Resetar tarefa
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
    const etapaAtual = mapaStatus[pedidoAtual?.status] || '';
    $("#nome-etapa-atual").text(etapaAtual);
    const indexAtual = fluxoSetores.indexOf(etapaAtual);
    $("#setor-resetar option").each(function () {
      const setor = $(this).val();
      const indexSetor = fluxoSetores.indexOf(setor);
      $(this).prop('disabled', indexSetor >= indexAtual);
    });
    $("#modal-resetar-tarefa").fadeIn();
  });
  $("#btn-cancelar-reset").on('click', function () { $("#modal-resetar-tarefa").fadeOut(); });
  $("#btn-confirmar-reset").on('click', function () {
    const setor = $("#setor-resetar").val();
    const motivo = $("#motivo-reset").val().trim();
    if (!setor) return alert('Selecione um setor para resetar a tarefa.');
    if (!motivo) return alert('Explique o motivo da correção.');
    if (!confirm(`Tem certeza que deseja resetar esta tarefa para o setor ${setor}? Esta ação é irreversível.`)) return;

    const urlParams = new URLSearchParams(window.location.search);
    const pedidoId = urlParams.get("id");

    fetch(`/api/pedidos/${pedidoId}/resetar-tarefa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setor, motivo })
    })
      .then(res => res.json())
      .then(() => { alert('Tarefa resetada com sucesso!'); location.reload(); })
      .catch(err => { console.error(err); alert('Erro ao resetar tarefa.'); });
  });

  // Carregar pedido
  if (pedidoId) {
    fetch(`/api/pedidos/${pedidoId}`)
      .then(res => res.json())
      .then(pedido => {
        pedidoAtual = pedido;

        // Empresa
        const $empresa = $("#empresa");
        const okEmpresa = ensureSelect($empresa, pedido.empresa, "empresa");
        if (!okEmpresa && pedido.empresa) {
          const empN = normalizeTxt(pedido.empresa);
          if (empN.includes('mellicz')) $empresa.val("Mellicz Ambiental");
          if (empN.includes('pronasa')) $empresa.val("Pronasa");
        }

        $("#cliente_nome").val(pedido.cliente || pedido.cliente_nome || '');
        $("#data-coleta").val((pedido.data_coleta || '').substring(0, 10));

        // Tipo Retirar/Entregar
        const $tipo = $("#pedido-para");
        const okTipo = ensureSelect($tipo, pedido.tipo, "tipo_pedido");
        if (!okTipo && pedido.tipo) {
          const t = normalizeTxt(pedido.tipo);
          if (t.includes('retir')) $tipo.val("Retirar");
          if (t.includes('entreg')) $tipo.val("Entregar");
        }

        // Produtos autorizados / itens
        produtosAutorizados = Array.isArray(pedido.produtos_autorizados) ? pedido.produtos_autorizados : [];
        materiais = Array.isArray(pedido.materiais) ? pedido.materiais : [];

        // ----------- PRAZOS -----------
        // selecionados no pedido (texto "Descrição (X dias)")
        const prazosSelecionados = Array.isArray(pedido.prazo_pagamento)
          ? pedido.prazo_pagamento.map(p => `${p.descricao} (${p.dias} dias)`)
          : Array.isArray(pedido.prazos_pagamento)
            ? pedido.prazos_pagamento.map(p => `${p.descricao} (${p.dias} dias)`)
            : [];

        // autorizados para o cliente
        const prazosPermitidosArr = Array.isArray(pedido.prazos_permitidos) ? pedido.prazos_permitidos : [];

        // limpa e reconstrói opções
        prazosSomenteExibicao = [];
        $("#prazo-pagamento").empty();

        if (prazosPermitidosArr.length === 0) {
          const avisoId = "aviso-sem-prazos";
          $("#" + avisoId).remove();
          const $aviso = $(`<small id="${avisoId}" style="display:block;margin-top:6px;color:#a94442">Cliente sem prazos cadastrados.</small>`);
          $("#prazo-pagamento").parent().append($aviso);
          console.warn("[editar-venda] Cliente sem prazos_permitidos.");
        } else {
          // adiciona apenas opções autorizadas
          prazosPermitidosArr.forEach(texto => {
            const opt = $("<option>").val(texto).text(texto);
            if (prazosSelecionados.includes(texto)) opt.prop('selected', true);
            $("#prazo-pagamento").append(opt);
          });
        }

        // selecionados que NÃO estão mais autorizados → mostrar desabilitados
        const naoPermitidosSelecionados = prazosSelecionados.filter(t => !prazosPermitidosArr.includes(t));
        if (naoPermitidosSelecionados.length) {
          prazosSomenteExibicao = naoPermitidosSelecionados.slice();
          naoPermitidosSelecionados.forEach(texto => {
            $("#prazo-pagamento").append(
              $(`<option disabled selected></option>`).val(texto).text(`${texto} (não autorizado)`)
            );
          });
          const avisoId = "aviso-prazo-nao-aut";
          $("#" + avisoId).remove();
          const $aviso = $(`<small id="${avisoId}" style="display:block;margin-top:6px;color:#8a6d3b">Alguns prazos usados neste pedido não estão mais autorizados. Eles serão mantidos ao salvar, a menos que você os substitua pelos prazos autorizados.</small>`);
          $("#prazo-pagamento").parent().append($aviso);
        }

        $("#prazo-pagamento").trigger('change');

        const textoNorm = prazosSelecionados
          .join(' ')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();

        if (textoNorm.includes('avista') || textoNorm.includes('a vista')) {
          $("#condicao-a-vista").show();
          $("#condicao_pagamento_a_vista").val(pedido.condicao_pagamento_avista || '').prop('required', true);
        } else {
          $("#condicao-a-vista").hide();
          $("#condicao_pagamento_a_vista").val('').prop('required', false);
        }
        // -------- fim prazos ---------

        // Render itens
        if (materiais.length) {
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
        } else {
          adicionarProduto();
        }

        // Observações
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
        updateAddButton();
        updateRemoveButtons();
      })
      .catch(err => {
        console.error('Erro ao carregar pedido', err);
        alert('Erro ao carregar o pedido.');
      });
  }

  // Condição à vista
  $("#prazo-pagamento").on('change', function () {
    const textos = ($(this).val() || []).join(' ').toLowerCase();
    const temAvista = textos.includes('à vista') || textos.includes('a vista');
    $("#condicao-a-vista").toggle(temAvista);
    $("#condicao_pagamento_a_vista").prop('required', temAvista);
  });

  $('#adicionar-produto').on('click', function () { adicionarProduto(); });

  $('#setor-observacao').on('select2:open', function () {
    $("#texto-observacao").css('margin-top', '150px');
  });
  $('#setor-observacao').on('select2:close', function () {
    $("#texto-observacao").css('margin-top', '0');
  });
});

// Envio (PUT /api/pedidos/:id)
document.querySelector('#form-editar-pedido').addEventListener('submit', async (e) => {
  e.preventDefault();
  const urlParams = new URLSearchParams(window.location.search);
  const pedidoId = urlParams.get('id');
  if (!pedidoId) return alert('ID do pedido não encontrado.');

  const cliente_id = pedidoAtual?.cliente_id || '';
  const empresa = document.querySelector('#empresa')?.value || '';
  const tipo_pedido = document.querySelector('#pedido-para')?.value || '';
  const data_prevista = document.querySelector('#data-coleta')?.value || '';

  const tipo_peso_global = $(".produto-bloco").length ? $(".produto-bloco").first().find('.tipo-peso').val() || '' : '';

  const itens = [...document.querySelectorAll('.produto-bloco')].map((bloco) => {
    const nome_produto = bloco.querySelector('.select-produto')?.value || '';
    const valor_unitario = parseFloat(parseMask(bloco.querySelector('.valor-por-quilo')?.value)) || 0;
    const peso = parseFloat(parseMask(bloco.querySelector('.peso')?.value)) || 0;
    const tipo_peso = bloco.querySelector('.tipo-peso')?.value || '';
    const codigo_fiscal = bloco.querySelector('.select-codigo')?.value || '';
    const valor_com_nota = bloco.querySelector('.valor-com-nota') ? parseFloat(parseMask(bloco.querySelector('.valor-com-nota').value)) || null : null;
    const valor_sem_nota = bloco.querySelector('.valor-sem-nota') ? parseFloat(parseMask(bloco.querySelector('.valor-sem-nota').value)) || null : null;

    return {
      nome_produto,
      valor_unitario,
      peso,
      tipo_peso,
      unidade: '',
      codigo_fiscal,
      valor_com_nota,
      valor_sem_nota
    };
  });

  // Prazos selecionáveis + legados (não-autorizados, apenas exibição)
  const selecionadosPermitidos = $('#prazo-pagamento').val() || [];
  const todosSelecionados = Array.from(new Set([...selecionadosPermitidos, ...prazosSomenteExibicao]));

  const prazos = todosSelecionados.map((descricao) => {
    let dias = 0;
    const lower = (descricao || '').toLowerCase();
    if (lower.includes('à vista') || lower.includes('a vista')) {
      dias = 0;
    } else {
      const match = (descricao || '').match(/\d+/);
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
    data_coleta: data_prevista || null,
    tipo_peso: tipo_peso_global,
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
