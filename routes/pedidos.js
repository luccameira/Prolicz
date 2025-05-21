const express = require('express');
const router = express.Router();
const db = require('./db').callback;

// Função utilitária para converter data de dd/mm/yyyy para yyyy-mm-dd
function formatarDataBRparaISO(dataBR) {
  const [dia, mes, ano] = dataBR.split('/');
  return `${ano}-${mes}-${dia}`;
}

// GET /api/pedidos/carga - Listar pedidos com coleta hoje ou amanhã para carga e descarga
router.get('/carga', (req, res) => {
  const sql = `
    SELECT 
      p.id,
      c.nome_fantasia AS cliente,
      i.nome_produto AS produto,
      p.data_coleta,
      SUM(i.peso) AS peso_previsto
    FROM pedidos p
    INNER JOIN clientes c ON p.cliente_id = c.id
    INNER JOIN itens_pedido i ON p.id = i.pedido_id
    WHERE p.status = 'Coleta Iniciada'
      AND DATE(p.data_coleta) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 1 DAY)
    GROUP BY p.id, c.nome_fantasia, i.nome_produto, p.data_coleta
    ORDER BY p.data_coleta ASC
  `;

  connection.query(sql, (err, results) => {
    if (err) {
      console.error('Erro ao buscar pedidos de carga:', err);
      return res.status(500).json({ erro: 'Erro ao buscar pedidos de carga' });
    }
    res.json(results);
  });
});

// GET /api/clientes/:id/produtos - Listar produtos autorizados de um cliente
router.get('/clientes/:id/produtos', async (req, res) => {
  const clienteId = req.params.id;
  try {
    const [produtos] = await connection.promise().query(
      `SELECT nome_produto, valor_unitario, unidade FROM produtos_autorizados WHERE cliente_id = ?`,
      [clienteId]
    );
    res.json(produtos);
  } catch (error) {
    console.error('Erro ao buscar produtos do cliente:', error);
    res.status(500).json({ erro: 'Erro ao buscar produtos do cliente.' });
  }
});

// GET /api/pedidos - Listar pedidos com dados completos para tarefas
router.get('/', async (req, res) => {
  const { cliente, status, tipo, ordenar, de, ate } = req.query;

  let sqlPedidos = `
    SELECT 
      p.id AS pedido_id, p.data_criacao, p.tipo, p.status, p.data_coleta,
      p.codigo_interno, p.observacao, p.empresa, p.prazo_pagamento,
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
    const statusList = status.split(',').map(s => s.trim());
    sqlPedidos += ` AND p.status IN (${statusList.map(() => '?').join(',')})`;
    params.push(...statusList);
  }

  if (tipo) {
    sqlPedidos += " AND p.tipo = ?";
    params.push(tipo);
  }

  if (de && ate) {
    sqlPedidos += " AND DATE(p.data_criacao) BETWEEN ? AND ?";
    params.push(de, ate);
  }

  sqlPedidos += " ORDER BY p.data_criacao DESC";

  try {
    const [pedidos] = await connection.promise().query(sqlPedidos, params);

    for (const pedido of pedidos) {
      const [itens] = await connection.promise().query(
        `SELECT nome_produto, peso, valor_unitario, (peso * valor_unitario) AS valor_total
         FROM itens_pedido
         WHERE pedido_id = ?`,
        [pedido.pedido_id]
      );

      pedido.itens = itens;
      pedido.valor_total = itens.reduce((acc, item) => acc + Number(item.valor_total || 0), 0);
      pedido.observacoes = pedido.observacao || '';
      pedido.prazos_pagamento = (pedido.prazo_pagamento || '')
        .split('|')
        .map(str => str.trim())
        .filter(str => str.length > 0);
    }

    res.json(pedidos);
  } catch (err) {
    console.error('Erro ao buscar pedidos:', err);
    res.status(500).json({ erro: 'Erro ao buscar pedidos' });
  }
});

// POST /api/pedidos - Criar novo pedido
router.post('/', async (req, res) => {
  const { cliente_id, empresa, tipo, data_coleta, observacao, status, prazo_pagamento, codigo_fiscal } = req.body;
  const dataISO = formatarDataBRparaISO(data_coleta);

  try {
    const [pedidoResult] = await connection.promise().query(
      `INSERT INTO pedidos (cliente_id, empresa, tipo, data_coleta, observacao, status, prazo_pagamento, codigo_fiscal, data_criacao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [cliente_id, empresa || null, tipo, dataISO, observacao, status || 'Aguardando Início da Coleta', prazo_pagamento, codigo_fiscal || '']
    );

    const pedido_id = pedidoResult.insertId;
    const itens = req.body.itens || [];

    for (const item of itens) {
      await connection.promise().query(
        `INSERT INTO itens_pedido (pedido_id, nome_produto, valor_unitario, peso, tipo_peso, unidade)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [pedido_id, item.nome_produto, item.valor_unitario, item.peso, item.tipo_peso, item.unidade]
      );
    }

    res.status(201).json({ mensagem: 'Pedido criado com sucesso', pedido_id });
  } catch (error) {
    console.error('Erro ao criar pedido:', error);
    res.status(500).json({ erro: 'Erro ao criar pedido.' });
  }
});

// PUT /api/pedidos/:id/coleta - Portaria inicia a coleta
router.put('/:id/coleta', async (req, res) => {
  const pedidoId = req.params.id;
  const { placa, motorista, ajudante } = req.body;

  if (!placa || !motorista) {
    return res.status(400).json({ erro: 'Placa e nome do motorista são obrigatórios.' });
  }

  try {
    await connection.promise().query(
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

// PUT /api/pedidos/:id/registrar-peso
router.put('/:id/registrar-peso', async (req, res) => {
  const pedidoId = req.params.id;
  const { peso, desconto, motivo } = req.body;

  if (!peso || isNaN(peso) || peso <= 0) {
    return res.status(400).json({ erro: 'Peso inválido.' });
  }

  try {
    await connection.promise().query(
      `UPDATE pedidos 
       SET peso_registrado = ?, 
           desconto_peso = ?, 
           motivo_desconto = ?,
           data_peso_registrado = NOW(), 
           status = 'Aguardando Conferência do Peso' 
       WHERE id = ?`,
      [peso, desconto || 0, motivo || '', pedidoId]
    );

    res.status(200).json({ mensagem: 'Peso registrado com sucesso!' });
  } catch (error) {
    console.error('Erro ao registrar peso:', error);
    res.status(500).json({ erro: 'Erro ao registrar peso.' });
  }
});

// POST /api/pedidos/produtos/novo - Cadastrar novo produto
router.post('/produtos/novo', async (req, res) => {
  const { nome_produto, unidade } = req.body;

  if (!nome_produto || !unidade) {
    return res.status(400).json({ erro: 'Nome do produto e unidade são obrigatórios.' });
  }

  try {
    await connection.promise().query(
      `INSERT INTO produtos (nome, unidade) VALUES (?, ?)`,
      [nome_produto, unidade]
    );

    res.status(201).json({ mensagem: 'Produto cadastrado com sucesso!' });
  } catch (error) {
    console.error('Erro ao cadastrar produto:', error);
    res.status(500).json({ erro: 'Erro ao cadastrar produto.' });
  }
});

// GET /api/pedidos/produtos - Listar produtos com nomes corretos
router.get('/produtos', async (req, res) => {
  try {
    const [produtos] = await connection.promise().query(
      `SELECT nome AS nome_produto, unidade, criado_em AS data_cadastro FROM produtos ORDER BY criado_em DESC`
    );

    res.json(produtos);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ erro: 'Erro ao buscar produtos.' });
  }
});

// PUT /api/pedidos/:id/carga - Finalizar tarefa de carga
router.put('/:id/carga', async (req, res) => {
  const { id } = req.params;
  const { peso_registrado, desconto_peso, motivo_desconto } = req.body;

  try {
    await connection.promise().query(
      `UPDATE pedidos
       SET 
         peso_registrado = ?, 
         desconto_peso = ?, 
         motivo_desconto = ?, 
         status = 'Aguardando Conferência do Peso'
       WHERE id = ?`,
      [peso_registrado || 0, desconto_peso || 0, motivo_desconto || '', id]
    );

    res.status(200).json({ mensagem: 'Tarefa de carga finalizada com sucesso!' });
  } catch (error) {
    console.error('Erro ao finalizar tarefa de carga:', error);
    res.status(500).json({ erro: 'Erro ao finalizar tarefa de carga.' });
  }
});

// PUT /api/pedidos/:id/conferencia - Atualiza status para "Em Análise pelo Financeiro"
router.put('/:id/conferencia', async (req, res) => {
  const pedidoId = req.params.id;

  try {
    const [result] = await connection.promise().query(
      'UPDATE pedidos SET status = ? WHERE id = ?',
      ['Em Análise pelo Financeiro', pedidoId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }

    res.json({ sucesso: true, mensagem: 'Peso confirmado e enviado para o financeiro.' });
  } catch (error) {
    console.error('Erro ao confirmar peso:', error);
    res.status(500).json({ erro: 'Erro ao confirmar peso.' });
  }
});

module.exports = router;

