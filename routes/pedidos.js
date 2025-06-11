const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/pedidos - lista de pedidos
router.get('/', async (req, res) => {
  const { cliente, status, tipo, ordenar, de, ate } = req.query;

  let sqlPedidos = `
    SELECT 
      p.id AS pedido_id, p.data_criacao, p.tipo, p.status, p.data_coleta,
      p.codigo_interno, p.observacao, p.empresa, p.nota_fiscal,
      c.nome_fantasia AS cliente
    FROM pedidos p
    INNER JOIN clientes c ON p.cliente_id = c.id
    WHERE 1 = 1
  `;

  const params = [];

  if (cliente) {
    sqlPedidos += ` AND (c.nome_fantasia LIKE ? OR p.nota_fiscal LIKE ?)`;
    params.push(`%${cliente}%`, `%${cliente}%`);
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

// GET /api/pedidos/:id - busca pedido individual com itens e prazos
router.get('/:id', async (req, res) => {
  const pedidoId = req.params.id;

  try {
    const [pedidos] = await db.query(
      `
      SELECT 
        p.id AS pedido_id, p.data_criacao, p.tipo, p.status, p.data_coleta,
        p.codigo_interno, p.observacao, p.empresa, p.nota_fiscal,
        c.nome_fantasia AS cliente_nome,
        p.codigo_fiscal, p.prazo_pagamento
      FROM pedidos p
      INNER JOIN clientes c ON p.cliente_id = c.id
      WHERE p.id = ?
      LIMIT 1
      `,
      [pedidoId]
    );

    if (pedidos.length === 0) {
      return res.status(404).json({ erro: 'Pedido não encontrado' });
    }

    const pedido = pedidos[0];

    // Buscar itens do pedido
    const [itens] = await db.query(
      `SELECT id, nome_produto, valor_unitario, peso, tipo_peso, unidade, codigo_fiscal
       FROM itens_pedido
       WHERE pedido_id = ?`,
      [pedidoId]
    );

    // Buscar prazos de pagamento
    const [prazosPedido] = await db.query(
      `SELECT descricao, dias FROM prazos_pedido WHERE pedido_id = ?`,
      [pedidoId]
    );

    pedido.itens = itens;
    pedido.prazos_pagamento = prazosPedido.map(prazo => {
      let dataVencimento = null;
      if (pedido.data_coleta) {
        const dataColeta = new Date(pedido.data_coleta);
        dataColeta.setDate(dataColeta.getDate() + prazo.dias);
        dataVencimento = dataColeta.toISOString();
      }
      return dataVencimento;
    });

    res.json(pedido);

  } catch (err) {
    console.error('Erro ao buscar pedido:', err);
    res.status(500).json({ erro: 'Erro ao buscar pedido' });
  }
});

// GET /api/pedidos/:id/historico - histórico operacional do pedido
router.get('/:id/historico', async (req, res) => {
  const pedidoId = req.params.id;

  const sql = `
    SELECT ho.id, ho.acao, ho.observacao, ho.data_hora,
           u.nome AS usuario_nome
    FROM historico_operacional ho
    INNER JOIN usuarios u ON ho.usuario_id = u.id
    WHERE ho.pedido_id = ?
    ORDER BY ho.data_hora ASC
  `;

  try {
    const [rows] = await db.query(sql, [pedidoId]);
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar histórico operacional:', err);
    res.status(500).json({ erro: 'Erro ao buscar histórico operacional' });
  }
});

// POST /api/pedidos - cria novo pedido
router.post('/', async (req, res) => {
  const { cliente_id, empresa, tipo, data_coleta, observacao, status, prazos, itens, nota_fiscal } = req.body;

  const formatarDataBRparaISO = (dataBR) => {
    const [dia, mes, ano] = data_coleta.split('/');
    return `${ano}-${mes}-${dia}`;
  };

  const dataISO = formatarDataBRparaISO(data_coleta);

  try {
    const [pedidoResult] = await db.query(
      `INSERT INTO pedidos (cliente_id, empresa, tipo, data_coleta, observacao, status, data_criacao, nota_fiscal)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [cliente_id, empresa || null, tipo, dataISO, observacao, status || 'Aguardando Início da Coleta', nota_fiscal || null]
    );

    const pedido_id = pedidoResult.insertId;

    if (Array.isArray(itens)) {
      for (const item of itens) {
        await db.query(
          `INSERT INTO itens_pedido (pedido_id, nome_produto, valor_unitario, peso, tipo_peso, unidade, codigo_fiscal)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            pedido_id,
            item.nome_produto,
            item.valor_unitario,
            item.peso,
            item.tipo_peso,
            item.unidade || '',
            item.codigo_fiscal || ''
          ]
        );
      }
    }

    if (Array.isArray(prazos)) {
      for (const prazo of prazos) {
        let descricao = '';
        let dias = 0;

        if (typeof prazo === 'string') {
          descricao = prazo;
          if (prazo.toLowerCase() === 'à vista') {
            dias = 0;
          } else {
            const match = prazo.match(/\d+/);
            dias = match ? parseInt(match[0], 10) : 0;
          }
        } else if (typeof prazo === 'object' && prazo !== null) {
          descricao = prazo.descricao || '';
          dias = prazo.dias || 0;
        }

        await db.query(
          `INSERT INTO prazos_pedido (pedido_id, descricao, dias) VALUES (?, ?, ?)`,
          [pedido_id, descricao.trim(), dias]
        );
      }
    }

    res.status(201).json({ mensagem: 'Pedido criado com sucesso', pedido_id });
  } catch (error) {
    console.error('Erro ao criar pedido:', error);
    res.status(500).json({ erro: 'Erro ao criar pedido.' });
  }
});

<<<<<<< HEAD
=======
// PUT /api/pedidos/:id/coleta
router.put('/:id/coleta', async (req, res) => {
  const pedidoId = req.params.id;
  const { placa, motorista, ajudante } = req.body;

  if (!placa || !motorista) {
    return res.status(400).json({ erro: 'Placa e nome do motorista são obrigatórios.' });
  }

  try {
    await db.query(
      `UPDATE pedidos 
       SET status = 'Coleta Iniciada', 
           placa_veiculo = ?, 
           nome_motorista = ?, 
           nome_ajudante = ?, 
           data_coleta_iniciada = NOW() 
       WHERE id = ?`,
      [placa, motorista, ajudante || '', pedidoId]
    );

    res.status(200).json({ mensagem: 'Coleta iniciada com sucesso!' });
  } catch (error) {
    console.error('Erro ao iniciar coleta:', error);
    res.status(500).json({ erro: 'Erro ao iniciar coleta.' });
  }
});

// PUT /api/pedidos/:id/carga
router.put('/:id/carga', uploadTicket.single('ticket_balanca'), async (req, res) => {
  const { id } = req.params;
  const { itens } = req.body;
  const nomeArquivo = req.file?.filename || null;

  try {
    await db.query(
      `UPDATE pedidos
       SET 
         ticket_balanca = ?, 
         status = 'Aguardando Conferência do Peso',
         data_carga_finalizada = NOW()
       WHERE id = ?`,
      [nomeArquivo, id]
    );

    const listaItens = JSON.parse(itens || '[]');

    if (Array.isArray(listaItens)) {
      for (const item of listaItens) {
        await db.query(
          `UPDATE itens_pedido 
           SET peso_carregado = ? 
           WHERE id = ?`,
          [item.peso_carregado, item.item_id]
        );

        await db.query(
          `DELETE FROM descontos_item_pedido WHERE item_id = ?`,
          [item.item_id]
        );

        if (Array.isArray(item.descontos)) {
          for (const desc of item.descontos) {
            await db.query(
              `INSERT INTO descontos_item_pedido (item_id, motivo, quantidade, peso_calculado)
               VALUES (?, ?, ?, ?)`,
              [item.item_id, desc.motivo, desc.quantidade, desc.peso_calculado]
            );
          }
        }
      }
    }

    res.status(200).json({ mensagem: 'Tarefa de carga finalizada com sucesso!' });
  } catch (error) {
    console.error('Erro ao finalizar tarefa de carga:', error);
    res.status(500).json({ erro: 'Erro ao finalizar tarefa de carga.' });
  }
});

// PUT /api/pedidos/:id/conferencia
router.put('/:id/conferencia', async (req, res) => {
  const { id } = req.params;

  try {
    const [resultado] = await db.query(
      'UPDATE pedidos SET status = ? WHERE id = ?',
      ['Em Análise pelo Financeiro', id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ erro: 'Pedido não encontrado' });
    }

    res.json({ mensagem: 'Peso confirmado com sucesso!' });
  } catch (erro) {
    console.error('Erro ao confirmar peso:', erro);
    res.status(500).json({ erro: 'Erro ao confirmar peso' });
  }
});

// PUT /api/pedidos/:id/financeiro
router.put('/:id/financeiro', async (req, res) => {
  const { id } = req.params;
  const { observacoes_financeiro } = req.body;

  try {
    await db.query(
      `UPDATE pedidos SET status = ?, observacoes_financeiro = ? WHERE id = ?`,
      ['Aguardando Emissão de NF', observacoes_financeiro, id]
    );

    res.json({ mensagem: 'Cliente liberado com sucesso!' });
  } catch (erro) {
    console.error('Erro ao atualizar status financeiro:', erro);
    res.status(500).json({ erro: 'Erro ao liberar cliente.' });
  }
});

// DELETE /api/pedidos/:id - Excluir pedido
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Apagar descontos relacionados
    await db.query('DELETE FROM descontos_item_pedido WHERE item_id IN (SELECT id FROM itens_pedido WHERE pedido_id = ?)', [id]);
    // Apagar itens do pedido
    await db.query('DELETE FROM itens_pedido WHERE pedido_id = ?', [id]);
    // Apagar prazos de pagamento do pedido
    await db.query('DELETE FROM prazos_pedido WHERE pedido_id = ?', [id]);
    // Apagar o pedido
    const [resultado] = await db.query('DELETE FROM pedidos WHERE id = ?', [id]);

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ erro: 'Pedido não encontrado' });
    }

    res.json({ mensagem: 'Pedido excluído com sucesso!' });
  } catch (erro) {
    console.error('Erro ao excluir pedido:', erro);
    res.status(500).json({ erro: 'Erro ao excluir pedido' });
  }
});

// GET /api/pedidos/conferencia
router.get('/conferencia', async (req, res) => {
  const sql = `
    SELECT 
      p.id AS pedido_id,
      p.data_criacao,
      p.tipo,
      p.status,
      p.data_coleta,
      p.data_coleta_iniciada,
      p.data_carga_finalizada,
      p.data_peso_confirmado AS data_conferencia_peso,
      p.data_financeiro,
      p.data_emissao_nf,
      p.data_finalizado,
      p.codigo_interno,
      p.observacao,
      p.empresa,
      p.ticket_balanca,
      c.nome_fantasia AS cliente
    FROM pedidos p
    INNER JOIN clientes c ON p.cliente_id = c.id
    WHERE p.status = 'Aguardando Conferência do Peso'
    ORDER BY p.data_coleta ASC
  `;

  try {
    const [pedidos] = await db.query(sql);

    for (const pedido of pedidos) {
      const [materiais] = await db.query(
        `SELECT 
            i.id, i.nome_produto, i.peso AS quantidade, i.tipo_peso, 
            i.unidade, i.peso_carregado
         FROM itens_pedido i
         WHERE i.pedido_id = ?`,
        [pedido.pedido_id]
      );

      console.log(`Materiais do pedido ${pedido.pedido_id}:`, materiais);

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
    }

    res.json(pedidos);
  } catch (err) {
    console.error('Erro ao buscar pedidos para conferência:', err);
    res.status(500).json({ erro: 'Erro ao buscar pedidos para conferência' });
  }
});

// GET /api/pedidos/nf
router.get('/nf', async (req, res) => {
  const sql = `
    SELECT 
      p.id AS pedido_id, p.data_criacao, p.tipo, p.status, p.data_coleta,
      p.codigo_interno, p.observacao, p.empresa,
      c.nome_fantasia AS cliente
    FROM pedidos p
    INNER JOIN clientes c ON p.cliente_id = c.id
    WHERE p.status = 'Aguardando Emissão de NF'
    ORDER BY p.data_coleta ASC
  `;
  try {
    const [pedidos] = await db.query(sql);
    res.json(pedidos);
  } catch (err) {
    console.error('Erro ao buscar pedidos para emissão de NF:', err);
    res.status(500).json({ erro: 'Erro ao buscar pedidos para emissão de NF' });
  }
});
