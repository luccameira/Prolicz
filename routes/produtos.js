const express = require('express');
const router = express.Router();
const connection = require('./db');

// GET /api/pedidos - Listagem com filtros e ordenações agrupada por pedido
router.get('/', (req, res) => {
  const { cliente, status, tipo, ordenar, de, ate } = req.query;

  let sql = `
    SELECT 
      p.id AS pedido_id, p.data_criacao, p.tipo, p.status, p.data_coleta,
      c.nome_fantasia AS cliente,
      GROUP_CONCAT(i.nome_produto SEPARATOR ', ') AS nome_produto,
      SUM(i.peso) AS peso_total
    FROM pedidos p
    INNER JOIN clientes c ON p.cliente_id = c.id
    INNER JOIN itens_pedido i ON p.id = i.pedido_id
    WHERE 1 = 1
  `;

  const params = [];

  if (cliente) {
    sql += " AND c.id = ?";
    params.push(cliente);
  }

  if (status) {
    sql += " AND p.status = ?";
    params.push(status);
  }

  if (tipo) {
    sql += " AND p.tipo = ?";
    params.push(tipo);
  }

  if (de && ate) {
    sql += " AND DATE(p.data_criacao) BETWEEN ? AND ?";
    params.push(de, ate);
  }

  sql += " AND (p.status = 'Aguardando Início da Coleta' OR (p.status = 'Coleta Iniciada' AND DATE(p.data_coleta_iniciada) = CURDATE())) GROUP BY p.id ";

  switch (ordenar) {
    case 'data_asc':
      sql += " ORDER BY p.data_criacao ASC";
      break;
    case 'cliente_az':
      sql += " ORDER BY c.nome_fantasia ASC";
      break;
    case 'cliente_za':
      sql += " ORDER BY c.nome_fantasia DESC";
      break;
    default:
      sql += " ORDER BY p.data_criacao DESC";
  }

  connection.query(sql, params, (err, results) => {
    if (err) {
      console.error('Erro ao buscar pedidos:', err);
      return res.status(500).json({ erro: 'Erro ao buscar pedidos' });
    }
    res.json(results);
  });
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

// PUT /api/pedidos/:id/registrar-peso - Registro do peso carregado na etapa de carga e descarga
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
           peso_descontado = ?, 
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

// (continua normalmente com as rotas existentes...)

module.exports = router;


