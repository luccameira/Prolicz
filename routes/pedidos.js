// (todo o conteúdo anterior permanece inalterado)

router.get('/', async (req, res) => {
  const { cliente, status, tipo, ordenar, de, ate } = req.query;

  let sqlPedidos = `
    SELECT 
      p.id AS pedido_id, p.data_criacao, p.tipo, p.status, p.data_coleta,
      p.codigo_interno, p.observacao, p.empresa,
      c.nome_fantasia AS cliente
    FROM pedidos p
    INNER JOIN clientes c ON p.cliente_id = c.id
    WHERE 1 = 1
  `;
  const params = [];

  if (cliente) {
    sqlPedidos += " AND c.id = ?";
    params.push(cliente);
  }
  if (status) {
    sqlPedidos += " AND p.status = ?";
    params.push(status);
  }
  if (tipo) {
    sqlPedidos += " AND p.tipo = ?";
    params.push(tipo);
  }
  if (de && ate) {
    sqlPedidos += " AND DATE(p.data_criacao) BETWEEN ? AND ?";
    params.push(de, ate);
  }

  // ✅ ALTERADO AQUI — ordenação por data_coleta DESC
  sqlPedidos += " ORDER BY p.data_coleta DESC";

  try {
    const [pedidos] = await db.query(sqlPedidos, params);

    for (const pedido of pedidos) {
      const [materiais] = await db.query(
        `SELECT id, nome_produto, peso AS quantidade, tipo_peso, unidade, peso_carregado, valor_unitario, codigo_fiscal, (valor_unitario * peso) AS valor_total
         FROM itens_pedido
         WHERE pedido_id = ?`,
        [pedido.pedido_id]
      );

      for (const item of materiais) {
        const [descontos] = await db.query(
          `SELECT motivo, quantidade, peso_calculado
           FROM descontos_item_pedido
           WHERE item_id = ?`,
          [item.id]
        );
        item.descontos = descontos || [];
      }

      pedido.materiais = materiais;
      pedido.observacoes = pedido.observacao || '';

      const [prazosPedido] = await db.query(
        `SELECT descricao, dias FROM prazos_pedido WHERE pedido_id = ?`,
        [pedido.pedido_id]
      );
      pedido.prazos_pagamento = prazosPedido.map(prazo => {
        let dataVencimento = null;
        if (pedido.data_coleta) {
          const dataColeta = new Date(pedido.data_coleta);
          dataColeta.setDate(dataColeta.getDate() + prazo.dias);
          dataVencimento = dataColeta.toISOString();
        }
        return dataVencimento;
      });
    }

    res.json(pedidos);
  } catch (err) {
    console.error('Erro ao buscar pedidos:', err);
    res.status(500).json({ erro: 'Erro ao buscar pedidos' });
  }
});

// (restante do arquivo permanece igual)

module.exports = router;
