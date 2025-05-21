const express = require('express');
const router = express.Router();
const connection = require('../db');

// Função utilitária para converter data de dd/mm/yyyy para yyyy-mm-dd
function formatarDataBRparaISO(dataBR) {
  const [dia, mes, ano] = dataBR.split('/');
  return `${ano}-${mes}-${dia}`;
}

// GET /api/pedidos/carga
router.get('/carga', async (req, res) => {
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

  try {
    const [results] = await connection.query(sql);
    res.json(results);
  } catch (err) {
    console.error('Erro ao buscar pedidos de carga:', err);
    res.status(500).json({ erro: 'Erro ao buscar pedidos de carga' });
  }
});

// GET /api/clientes/:id/produtos
router.get('/clientes/:id/produtos', async (req, res) => {
  const clienteId = req.params.id;
  try {
    const [produtos] = await connection.query(
      `SELECT nome_produto, valor_unitario, unidade FROM produtos_autorizados WHERE cliente_id = ?`,
      [clienteId]
    );
    res.json(produtos);
  } catch (error) {
    console.error('Erro ao buscar produtos do cliente:', error);
    res.status(500).json({ erro: 'Erro ao buscar produtos do cliente.' });
  }
});

// GET /api/pedidos
router.get('/', async (req, res) => {
  const { cliente, status, tipo, ordenar, de, ate } = req.query;

  let sqlPedidos = `
    SELECT 
      p.id AS pedido_id, p.data_criacao, p.tipo, p.status, p.data_coleta,
      c.nome_fantasia AS cliente,
      p.placa_veiculo, p.nome_motorista, p.nome_ajudante
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
    const [pedidos] = await connection.query(sqlPedidos, params);

    for (const pedido of pedidos) {
      const [materiais] = await connection.query(
        `SELECT nome_produto, peso AS quantidade, unidade, tipo_peso
         FROM itens_pedido
         WHERE pedido_id = ?`,
        [pedido.pedido_id]
      );
      pedido.materiais = materiais.map(m => ({
        ...m,
        texto_formatado: `${m.nome_produto} - ${Number(m.quantidade).toFixed(3)} ${m.unidade} (${m.tipo_peso})`
      }));
      pedido.nome_produto = materiais.map(m => m.nome_produto).join(', ');
    }

    res.json(pedidos);
  } catch (err) {
    console.error('Erro ao buscar pedidos:', err);
    res.status(500).json({ erro: 'Erro ao buscar pedidos' });
  }
});

// POST /api/pedidos
router.post('/', async (req, res) => {
  const { cliente_id, empresa, tipo, data_coleta, observacao, status, prazo_pagamento, codigo_fiscal } = req.body;
  const dataISO = formatarDataBRparaISO(data_coleta);

  try {
    const [pedidoResult] = await connection.query(
      `INSERT INTO pedidos (cliente_id, empresa, tipo, data_coleta, observacao, status, prazo_pagamento, codigo_fiscal, data_criacao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [cliente_id, empresa || null, tipo, dataISO, observacao, status || 'Aguardando Início da Coleta', prazo_pagamento, codigo_fiscal || '']
    );

    const pedido_id = pedidoResult.insertId;
    const itens = req.body.itens || [];

    for (const item of itens) {
      await connection.query(
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

// PUT /api/pedidos/:id/coleta
router.put('/:id/coleta', async (req, res) => {
  const pedidoId = req.params.id;
  const { placa, motorista, ajudante } = req.body;

  if (!placa || !motorista) {
    return res.status(400).json({ erro: 'Placa e nome do motorista são obrigatórios.' });
  }

  try {
    await connection.query(
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
    await connection.query(
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

// POST /api/pedidos/produtos/novo
router.post('/produtos/novo', async (req, res) => {
  const { nome_produto, unidade } = req.body;

  if (!nome_produto || !unidade) {
    return res.status(400).json({ erro: 'Nome do produto e unidade são obrigatórios.' });
  }

  try {
    await connection.query(
      `INSERT INTO produtos (nome, unidade) VALUES (?, ?)`,
      [nome_produto, unidade]
    );

    res.status(201).json({ mensagem: 'Produto cadastrado com sucesso!' });
  } catch (error) {
    console.error('Erro ao cadastrar produto:', error);
    res.status(500).json({ erro: 'Erro ao cadastrar produto.' });
  }
});

// GET /api/pedidos/produtos
router.get('/produtos', async (req, res) => {
  try {
    const [produtos] = await connection.query(
      `SELECT nome AS nome_produto, unidade, criado_em AS data_cadastro FROM produtos ORDER BY criado_em DESC`
    );

    res.json(produtos);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ erro: 'Erro ao buscar produtos.' });
  }
});

// PUT /api/pedidos/:id/carga
router.put('/:id/carga', async (req, res) => {
  const { id } = req.params;
  const { peso_registrado, desconto_peso, motivo_desconto } = req.body;

  try {
    await connection.query(
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

// PUT /api/pedidos/:id/conferencia
router.put('/:id/conferencia', async (req, res) => {
  const pedidoId = req.params.id;

  try {
    const [result] = await connection.query(
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

