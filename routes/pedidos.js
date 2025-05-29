const express = require('express');
const router = express.Router();
const db = require('../db');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const pastaTickets = path.join(__dirname, '..', 'uploads', 'tickets');
if (!fs.existsSync(pastaTickets)) {
  fs.mkdirSync(pastaTickets, { recursive: true });
}

const storageTickets = multer.diskStorage({
  destination: (req, file, cb) => cb(null, pastaTickets),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const nome = `ticket_${Date.now()}${ext}`;
    cb(null, nome);
  }
});
const uploadTicket = multer({ storage: storageTickets });

// Função para formatar data do formato BR (dd/mm/yyyy) para ISO (yyyy-mm-dd)
function formatarDataBRparaISO(dataBR) {
  const [dia, mes, ano] = dataBR.split('/');
  return `${ano}-${mes}-${dia}`;
}

// Rota GET /api/pedidos/portaria
router.get('/portaria', async (req, res) => {
  const sql = `
    SELECT 
      p.id AS pedido_id, p.data_criacao, p.tipo, p.status, p.data_coleta,
      p.codigo_interno, p.observacao, p.empresa, p.prazo_pagamento,
      p.ticket_balanca,
      c.nome_fantasia AS cliente
    FROM pedidos p
    INNER JOIN clientes c ON p.cliente_id = c.id
    WHERE DATE(p.data_coleta) = CURDATE()
    ORDER BY p.data_coleta ASC
  `;
  try {
    const [pedidos] = await db.query(sql);
    res.json(pedidos);
  } catch (err) {
    console.error('Erro ao buscar pedidos da portaria:', err);
    res.status(500).json({ erro: 'Erro ao buscar pedidos da portaria' });
  }
});

// ROTA CARGA
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
    const [results] = await db.query(sql);
    res.json(results);
  } catch (err) {
    console.error('Erro ao buscar pedidos de carga:', err);
    res.status(500).json({ erro: 'Erro ao buscar pedidos de carga' });
  }
});

// GET /api/pedidos - listagem com filtros e prazos de pagamento incluídos
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

  sqlPedidos += " ORDER BY p.data_criacao DESC";

  try {
    const [pedidos] = await db.query(sqlPedidos, params);

    for (const pedido of pedidos) {
      // Materiais do pedido
      const [materiais] = await db.query(
        `SELECT id, nome_produto, peso AS quantidade, tipo_peso, unidade, peso_carregado, valor_unitario, (valor_unitario * peso) AS valor_total
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

      // Prazos de pagamento do pedido
      const [prazos] = await db.query(
        `SELECT descricao, dias FROM prazos_pedido WHERE pedido_id = ? ORDER BY id ASC`,
        [pedido.pedido_id]
      );

      // Montar um array com as datas de vencimento calculadas com base na data_coleta + dias
      pedido.prazos_pagamento = prazos.map(p => {
        const dataColeta = new Date(pedido.data_coleta);
        dataColeta.setDate(dataColeta.getDate() + p.dias);
        return dataColeta.toISOString();
      });
    }

    res.json(pedidos);
  } catch (err) {
    console.error('Erro ao buscar pedidos:', err);
    res.status(500).json({ erro: 'Erro ao buscar pedidos' });
  }
});

// GET produtos autorizados por cliente
router.get('/clientes/:id/produtos', async (req, res) => {
  const clienteId = req.params.id;
  try {
    const [produtos] = await db.query(
      `SELECT nome_produto, valor_unitario, unidade FROM produtos_autorizados WHERE cliente_id = ?`,
      [clienteId]
    );
    res.json(produtos);
  } catch (error) {
    console.error('Erro ao buscar produtos do cliente:', error);
    res.status(500).json({ erro: 'Erro ao buscar produtos do cliente.' });
  }
});

// POST /api/pedidos - criar pedido
router.post('/', async (req, res) => {
  const { cliente_id, empresa, tipo, data_coleta, observacao, status, prazos, codigo_fiscal, itens } = req.body;
  const dataISO = formatarDataBRparaISO(data_coleta);

  try {
    const [pedidoResult] = await db.query(
      `INSERT INTO pedidos (cliente_id, empresa, tipo, data_coleta, observacao, status, codigo_fiscal, data_criacao)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [cliente_id, empresa || null, tipo, dataISO, observacao, status || 'Aguardando Início da Coleta', codigo_fiscal || '']
    );

    const pedido_id = pedidoResult.insertId;

    if (Array.isArray(itens)) {
      for (const item of itens) {
        await db.query(
          `INSERT INTO itens_pedido (pedido_id, nome_produto, valor_unitario, peso, tipo_peso, unidade)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [pedido_id, item.nome_produto, item.valor_unitario, item.peso, item.tipo_peso, item.unidade]
        );
      }
    }

    if (Array.isArray(prazos)) {
      for (const prazo of prazos) {
        await db.query(
          `INSERT INTO prazos_pedido (pedido_id, descricao, dias) VALUES (?, ?, ?)`,
          [pedido_id, prazo.descricao.trim(), prazo.dias]
        );
      }
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
         status = 'Aguardando Conferência do Peso'
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

// GET /api/pedidos/conferencia
router.get('/conferencia', async (req, res) => {
  const sql = `
    SELECT 
      p.id AS pedido_id, p.data_criacao, p.tipo, p.status, p.data_coleta,
      p.codigo_interno, p.observacao, p.empresa,
      c.nome_fantasia AS cliente
    FROM pedidos p
    INNER JOIN clientes c ON p.cliente_id = c.id
    WHERE p.status = 'Aguardando Conferência do Peso'
    ORDER BY p.data_coleta ASC
  `;
  try {
    const [pedidos] = await db.query(sql);
    res.json(pedidos);
  } catch (err) {
    console.error('Erro ao buscar pedidos para conferência:', err);
    res.status(500).json({ erro: 'Erro ao buscar pedidos para conferência' });
  }
});

// GET /api/pedidos/financeiro
router.get('/financeiro', async (req, res) => {
  const sql = `
    SELECT 
      p.id AS pedido_id, p.data_criacao, p.tipo, p.status, p.data_coleta,
      p.codigo_interno, p.observacao, p.empresa,
      c.nome_fantasia AS cliente
    FROM pedidos p
    INNER JOIN clientes c ON p.cliente_id = c.id
    WHERE p.status = 'Em Análise pelo Financeiro'
    ORDER BY p.data_coleta ASC
  `;
  try {
    const [pedidos] = await db.query(sql);
    res.json(pedidos);
  } catch (err) {
    console.error('Erro ao buscar pedidos para financeiro:', err);
    res.status(500).json({ erro: 'Erro ao buscar pedidos para financeiro' });
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


// DELETE /api/pedidos/:id - Excluir pedido
router.delete('/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const [result] = await db.query('DELETE FROM pedidos WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ erro: 'Pedido não encontrado' });
    }

    res.json({ mensagem: 'Pedido excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir pedido:', error);
    res.status(500).json({ erro: 'Erro ao excluir pedido' });
  }
});


module.exports = router;


