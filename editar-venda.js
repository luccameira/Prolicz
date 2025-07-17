// editar-venda.js
$(function () {
  flatpickr("#data-coleta", {
    locale: "pt",
    dateFormat: "Y-m-d",
    minDate: "today",
    allowInput: true
  });

  const urlParams = new URLSearchParams(window.location.search);
  const pedidoId = urlParams.get("id");

  let produtosAutorizados = [];
  let observacoes = [];
  let materiais = [];
  let editandoIndex = null;
let pedidoAtual = null;


  function formatarNumero(valor, inteiro = false) {
    const partes = inteiro
      ? [Math.floor(valor).toString()]
      : valor.toFixed(2).replace(".", ",").split(",");
    partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return inteiro ? partes[0] : partes.join(",");
  }

  function parseMask(str) {
    if (typeof str === "number") return str;
    if (!str) return 0;
    const limpo = str.toString().replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
    return parseFloat(limpo) || 0;
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

  function adicionarProduto(produto = {}) {
    const usados = $(".produto-bloco").map((i, el) => $(el).find(".select-produto").val()).get();
    const dispon = produtosAutorizados.filter(p => !usados.includes(p.nome_produto) || p.nome_produto === produto.nome_produto);
    if (!dispon.length) return;

    const bloco = $('<div class="produto-bloco"></div>');
    const btnRemove = $('<button type="button" class="btn-remove">×</button>').click(function () {
      bloco.remove();
      atualizarTotal();
      updateAddButton();
      updateRemoveButtons();
    });
    bloco.append(btnRemove);

    const selProd = $('<select class="select-produto" required><option value="">Produto</option></select>');
    dispon.forEach(p => {
      selProd.append(`<option value="${p.nome_produto}" data-valor="${p.valor_unitario}">${p.nome_produto}</option>`);
    });
    bloco.append('<div class="form-group"><label>Produto</label></div>').children().last().append(selProd);

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

    const selCodigo = $('<select class="select-codigo" required><option value="">Selecione</option></select>');
    const nomeProduto = produto.nome_produto || "";
    const codigosPermitidos = [...new Set(
      materiais
        .filter(m => m.nome_produto === nomeProduto && m.codigo_fiscal)
        .map(m => m.codigo_fiscal)
    )];

    codigosPermitidos.forEach(c => {
      selCodigo.append(`<option value="${c}">${c}</option>`);
    });

    if (produto.codigo_fiscal && !codigosPermitidos.includes(produto.codigo_fiscal)) {
      selCodigo.append(`<option value="${produto.codigo_fiscal}" selected>${produto.codigo_fiscal}</option>`);
    }

    if (produto.codigo_fiscal) {
      selCodigo.val(produto.codigo_fiscal);
    }

    bloco.append('<div class="form-group"><label>Código</label></div>').children().last().append(selCodigo);
    setTimeout(() => selCodigo.select2({ width: '100%' }), 0);

    const divPersonalizado = $(`  
      <div class="personalizado-campos" style="display:none;">
        <div class="form-group"><label>Valor com Nota</label><input type="text" class="valor-com-nota"></div>
        <div class="form-group"><label>Valor sem Nota</label><input readonly class="valor-sem-nota input-nao-editavel"></div>
      </div>`);
    bloco.append(divPersonalizado);

    const valorInicial = parseMask(produto.valor_unitario) / 100;
    const pesoInicial = parseMask(produto.peso) / 1000;
    const tipoPesoInicial = produto.tipo_peso || "";

    if (produto.nome_produto) selProd.val(produto.nome_produto);
    bloco.find(".valor-por-quilo").val(formatarNumero(valorInicial));
    bloco.find(".peso").val(formatarNumero(pesoInicial, true));
    bloco.find(".tipo-peso").val(tipoPesoInicial);
    bloco.find(".subtotal").val("R$ " + formatarNumero(valorInicial * pesoInicial));

    if (produto.codigo_fiscal === "Personalizar") {
      divPersonalizado.show();

      const inputComNota = bloco.find(".valor-com-nota");
      const inputSemNota = bloco.find(".valor-sem-nota");
      const inputValorQuilo = bloco.find(".valor-por-quilo");

      const valorKg = parseMask(inputValorQuilo.val());
      let valorNota = parseMask(produto.valor_com_nota) / 100;
      inputComNota.val(formatarNumero(valorNota));
      inputSemNota.val(formatarNumero(Math.max(0, valorKg - valorNota)));

      inputComNota.off("input blur");

      inputComNota.on("input", function () {
        let raw = $(this).val().replace(/\D/g, "");
        raw = raw.replace(/^0+/, "");
        if (raw.length < 3) raw = raw.padStart(3, "0");
        const formatado = raw.replace(/(\d+)(\d{2})$/, "$1,$2");
        $(this).val(formatado);

        const novoValorNota = parseMask($(this).val());
        const valorAtual = parseMask(inputValorQuilo.val());
        inputSemNota.val(formatarNumero(Math.max(0, valorAtual - novoValorNota)));
      });

      inputComNota.on("blur", function () {
        const vUnit = parseMask(inputValorQuilo.val());
        let raw = parseMask($(this).val());
        raw = Math.min(raw, Math.max(vUnit - 0.01, 0));
        $(this).val(formatarNumero(raw));
        inputSemNota.val(formatarNumero(Math.max(0, vUnit - raw)));
      });
    }

    selCodigo.on("change", function () {
      const isPersonalizar = $(this).val() === "Personalizar";
      divPersonalizado.toggle(isPersonalizar);
    });

    selProd.change(function () {
      const nome = $(this).val();
      const prod = produtosAutorizados.find(p => p.nome_produto === nome);
      const v = parseFloat(prod?.valor_unitario) / 100;

      const codigos = [...new Set(
        materiais
          .filter(m => m.nome_produto === nome && m.codigo_fiscal)
          .map(m => m.codigo_fiscal)
      )];

      const selectCodigo = bloco.find(".select-codigo");
      selectCodigo.empty().append('<option value="">Selecione</option>');
      codigos.forEach(c => {
        selectCodigo.append(`<option value="${c}">${c}</option>`);
      });
      selectCodigo.val(codigos[0] || "").trigger("change");

      bloco.find(".valor-por-quilo").val(formatarNumero(v));
      atualizarSub();
      atualizarTotal();
    });

    bloco.find(".peso").on("input", function () {
      const val = parseMask($(this).val());
      $(this).val(formatarNumero(val, true));
      atualizarSub();
      atualizarTotal();
    });

    function atualizarSub() {
      const v = parseMask(bloco.find(".valor-por-quilo").val());
      const p = parseMask(bloco.find(".peso").val());
      bloco.find(".subtotal").val("R$ " + formatarNumero(v * p));
    }

    $("#produtos").append(bloco);
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
    const existente = agrupadas.find(item => item.texto === obs.texto);
    if (existente) {
      existente.setores.push(obs.setor);
      existente.indices.push(index);
      existente.usuarios.push(obs.usuario_nome || 'Sistema');
      existente.datas.push(obs.data_criacao || '');
    } else {
      agrupadas.push({
        texto: obs.texto,
        setores: [obs.setor],
        indices: [index],
        usuarios: [obs.usuario_nome || 'Sistema'],
        datas: [obs.data_criacao || '']
      });
    }
  });

  agrupadas.forEach(item => {
    const setores = item.setores.join(", ");
    const primeiroIndex = item.indices[0];
    const ehReset = item.texto.trim().startsWith("[RESET]");
    const textoLimpo = item.texto.replace("[RESET]", "").trim();
    const usuario = item.usuarios[0];
    const data = item.datas[0] ? new Date(item.datas[0]).toLocaleString("pt-BR") : "";

    const div = document.createElement("div");
    div.className = "obs-item";

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
}

 else {
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
    $("#setor-observacao").val(obs.setor).trigger("change");
    $("#texto-observacao").val(obs.texto).prop("disabled", false);
    $("#observacao-bloco").slideDown();
    $("#btn-adicionar-observacao").hide();
    $("#btn-confirmar-observacao").text("Editar Observação");
    editandoIndex = i;
  };

  window.excluirObservacao = function (i) {
    if (!confirm("Você tem certeza que deseja excluir esta observação?")) return;
    const textoReferencia = observacoes[i].texto;
    observacoes = observacoes.filter(obs => obs.texto !== textoReferencia);
    renderizarObservacoes();
  };

  $("#btn-adicionar-observacao").click(function () {
    $("#setor-observacao").val(null).trigger("change");
    $("#texto-observacao").val("").prop("disabled", true);
    $("#observacao-bloco").slideDown();
    $(this).hide();
    $("#btn-confirmar-observacao").text("Confirmar Observação");
    editandoIndex = null;
  });

  $("#btn-fechar-observacao").click(function () {
    $("#observacao-bloco").slideUp();
    $("#btn-adicionar-observacao").show();
    $("#setor-observacao").val("");
    $("#texto-observacao").val("").prop("disabled", true);
    editandoIndex = null;
  });

  $("#setor-observacao").on("change", function () {
    let valores = $(this).val();
    if (valores && valores.includes("Todos")) {
      const todosSetores = ["Portaria", "Carga e Descarga", "Conferência de Peso", "Financeiro", "Emissão de NF"];
      $("#setor-observacao").val(todosSetores).trigger("change");
      valores = todosSetores;
    }
    $("#texto-observacao").prop("disabled", !valores || valores.length === 0);
  });

  $("#btn-confirmar-observacao").click(function () {
    const setor = $("#setor-observacao").val();
    const texto = $("#texto-observacao").val().trim();
    if (!setor || !texto) return alert("Selecione um setor e digite a observação.");
    if (editandoIndex !== null) {
      observacoes[editandoIndex] = { setor, texto };
    } else {
      setor.forEach(s => observacoes.push({ setor: s, texto }));
    }
    renderizarObservacoes();
    $("#setor-observacao").val("");
    $("#texto-observacao").val("").prop("disabled", true);
    $("#observacao-bloco").slideUp();
    $("#btn-adicionar-observacao").text("Adicionar outra observação").show();
    editandoIndex = null;
  });

  $("#prazo-pagamento").select2({
    width: '100%',
    placeholder: "Selecione os prazos",
    allowClear: true,
    multiple: true
  });

  if (pedidoId) {
    fetch(`/api/pedidos/${pedidoId}`)
      .then(res => res.json())
      .then(pedido => {
     pedidoAtual = pedido;
        $("#empresa").val(pedido.empresa || "");
        $("#cliente_nome").val(pedido.cliente_nome || "");
        $("#data-coleta").val(pedido.data_coleta?.substring(0, 10) || "");
        $("#pedido-para").val(pedido.tipo || "");

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
            opt.prop("selected", true);
          }
          $("#prazo-pagamento").append(opt);
        });
        $("#prazo-pagamento").trigger("change");

        const textoNormalizado = prazosSelecionadosTexto.join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        if (textoNormalizado.includes("avista") || textoNormalizado.includes("a vista")) {
          $("#condicao-a-vista").show();
          $("#condicao_pagamento_a_vista").val(pedido.condicao_pagamento_avista || "").prop("required", true);
        } else {
          $("#condicao-a-vista").hide();
          $("#condicao_pagamento_a_vista").val("").prop("required", false);
        }

        materiais.forEach(adicionarProduto);

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

  // ========== IMPLEMENTAÇÃO DO BOTÃO "RESETAR TAREFA" ==========

$("#btn-resetar-tarefa").on("click", function () {
  const mapaStatus = {
    "Aguardando Início da Coleta": "Portaria",
    "Coleta Iniciada": "Carga e Descarga",
    "Coleta Finalizada": "Carga e Descarga",
    "Aguardando Conferência do Peso": "Conferência de Peso",
    "Em Análise pelo Financeiro": "Financeiro",
    "Aguardando Emissão de NF": "Emissão de NF"
  };

  const fluxoSetores = [
    "Portaria",
    "Carga e Descarga",
    "Conferência de Peso",
    "Financeiro",
    "Emissão de NF"
  ];

  const etapaAtual = mapaStatus[pedidoAtual.status] || "";
  $("#nome-etapa-atual").text(etapaAtual);

  const indexAtual = fluxoSetores.indexOf(etapaAtual);

  $("#setor-resetar option").each(function () {
    const setor = $(this).val();
    const indexSetor = fluxoSetores.indexOf(setor);
    if (indexSetor >= indexAtual) {
  $(this).prop("disabled", true); // desativa setores futuros E o atual
} else {
  $(this).prop("disabled", false); // mantém setores anteriores ativos
}
  });

  $("#modal-resetar-tarefa").fadeIn();
});

$("#btn-cancelar-reset").on("click", function () {
  $("#modal-resetar-tarefa").fadeOut();
});

$("#btn-confirmar-reset").on("click", function () {
  const setor = $("#setor-resetar").val();
  const motivo = $("#motivo-reset").val().trim();

  if (!setor) {
    alert("Selecione um setor para resetar a tarefa.");
    return;
  }

  if (!motivo) {
  alert("Explique o motivo da correção.");
  return;
}

  if (!confirm(`Tem certeza que deseja resetar esta tarefa para o setor ${setor}? Esta ação é irreversível.`)) {
    return;
  }

  fetch(`/api/pedidos/${pedidoId}/resetar-tarefa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ setor, motivo })
  })
    .then(res => res.json())
    .then(data => {
      alert("Tarefa resetada com sucesso!");
      location.reload();
    })
    .catch(err => {
      console.error(err);
      alert("Erro ao resetar tarefa.");
    });
});
});
