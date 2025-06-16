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

function formatarDataBRparaISO(dataBR) {
  const [dia, mes, ano] = dataBR.split('/');
  return `${ano}-${mes}-${dia}`;
}

// Rota GET /api/pedidos/portaria
router.get('/portaria', async (req, res) => {
  try {
    const sql = `
      SELECT 
        p.id AS pedido_id,
        p.data_criacao,
        p.tipo,
        p.status,
        p.data_coleta,
        p.data_coleta_iniciada,
        p.data_carga_finalizada,
        p.data_conferencia_peso,     -- ✅ Adicionado
        p.codigo_interno,
        p.observacao,
        p.empresa,
        p.prazo_pagamento,
        p.ticket_balanca,
        c.nome_fantasia AS cliente
      FROM pedidos p
      INNER JOIN clientes c ON p.cliente_id = c.id
      WHERE DATE(p.data_coleta) = CURDATE()
      ORDER BY 
        CASE 
          WHEN p.status = 'Aguardando Início da Coleta' THEN 1
          WHEN p.status = 'Coleta Iniciada' THEN 2
          WHEN p.status = 'Coleta Finalizada' THEN 3
          WHEN p.status = 'Aguardando Conferência do Peso' THEN 4
          WHEN p.status = 'Em Análise pelo Financeiro' THEN 5
          WHEN p.status = 'Aguardando Emissão de NF' THEN 6
          WHEN p.status = 'Finalizado' THEN 7
          ELSE 99
        END,
        p.data_coleta ASC
    `;

    const [pedidos] = await db.query(sql);
    res.json(pedidos);
  } catch (err) {
    console.error('Erro ao buscar pedidos da portaria:', err);
    res.status(500).json({ erro: 'Erro ao buscar pedidos da portaria' });
  }
});

// ROTA CARGA - Corrigida: apenas pedidos com coleta iniciada ou posterior
router.get('/carga', async (req, res) => {
  const sql = `
    SELECT 
      p.id,
      i.id AS item_id,
      p.data_criacao,
      c.nome_fantasia AS cliente,
      i.nome_produto AS produto,
      p.data_coleta,
      p.data_coleta_iniciada,
      p.data_carga_finalizada,
      p.data_conferencia_peso,       -- ✅ Adicionado
      SUM(i.peso) AS peso_previsto,
      p.status
    FROM pedidos p
    INNER JOIN clientes c ON p.cliente_id = c.id
    INNER JOIN itens_pedido i ON p.id = i.pedido_id
    WHERE DATE(p.data_coleta) = CURDATE() AND p.status != 'Aguardando Início da Coleta'
    GROUP BY 
      p.id, i.id, p.data_criacao, c.nome_fantasia, i.nome_produto, 
      p.data_coleta, p.data_coleta_iniciada, p.data_carga_finalizada, p.data_conferencia_peso, p.status
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

// GET /api/pedidos - listagem com filtros
router.get('/', async (req, res) => {
  const { cliente, status, tipo, ordenar, de, ate } = req.query;

  let sqlPedidos = `
    SELECT 
      p.id AS pedido_id,
      p.data_criacao,
      p.tipo,
      p.status,
      p.data_coleta,
      p.data_coleta_iniciada,
      p.data_carga_finalizada,
      p.data_conferencia_peso,
      p.data_financeiro,
      p.data_emissao_nf,
      p.data_finalizado,
      p.codigo_interno,
      p.observacao,
      p.empresa,
      p.nota_fiscal,
      c.nome_fantasia AS cliente
    FROM pedidos p
    INNER JOIN clientes c ON p.cliente_id = c.id
    WHERE 1 = 1
  `;
  const params = [];

  if (cliente) {
    sqlPedidos += " AND (c.nome_fantasia LIKE ? OR p.nota_fiscal LIKE ?)";
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

  sqlPedidos += " ORDER BY p.data_criacao DESC";

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

// POST /api/pedidos - criar pedido (sem codigo_fiscal global!)
router.post('/', async (req, res) => {
  const { cliente_id, empresa, tipo, data_coleta, observacao, status, prazos, itens } = req.body;
  const dataISO = formatarDataBRparaISO(data_coleta);

  try {
    // Inserir pedido na tabela pedidos
    const [pedidoResult] = await db.query(
      `INSERT INTO pedidos (cliente_id, empresa, tipo, data_coleta, observacao, status, data_criacao)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [cliente_id, empresa || null, tipo, dataISO, observacao, status || 'Aguardando Início da Coleta']
    );

    const pedido_id = pedidoResult.insertId;

    // Inserir itens do pedido
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

    // Inserir prazos do pedido na tabela prazos_pedido
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
      `UPDATE pedidos 
       SET status = ?, data_conferencia_peso = NOW() 
       WHERE id = ?`,
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
      p.data_conferencia_peso,          -- ✅ AGORA USA O CAMPO REAL
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
    WHERE p.status IN ('Coleta Iniciada', 'Aguardando Conferência do Peso', 'Em Análise pelo Financeiro')
    ORDER BY 
      CASE 
        WHEN p.status = 'Coleta Iniciada' THEN 1
        WHEN p.status = 'Aguardando Conferência do Peso' THEN 2
        WHEN p.status = 'Em Análise pelo Financeiro' THEN 3
        ELSE 99
      END,
      p.data_coleta ASC
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

// GET /api/pedidos/financeiro
router.get('/financeiro', async (req, res) => {
  try {
    const sql = `
      SELECT 
        p.id AS pedido_id,
        p.data_criacao,
        p.tipo,
        p.status,
        p.data_coleta,
        p.data_coleta_iniciada,
        p.data_carga_finalizada,
        p.data_conferencia_peso,
        p.data_financeiro,
        p.data_emissao_nf,
        p.data_finalizado,
        p.codigo_interno,
        p.observacao,
        p.empresa,
        p.nota_fiscal,
        c.nome_fantasia AS cliente
      FROM pedidos p
      INNER JOIN clientes c ON p.cliente_id = c.id
      WHERE DATE(p.data_coleta) = CURDATE()
        AND p.status IN (
          'Coleta Iniciada',
          'Coleta Finalizada',
          'Aguardando Conferência do Peso',
          'Em Análise pelo Financeiro',
          'Aguardando Emissão de NF',
          'Cliente Liberado',
          'Finalizado'
        )
      ORDER BY 
        CASE 
          WHEN p.status = 'Coleta Iniciada' THEN 1
          WHEN p.status = 'Coleta Finalizada' THEN 2
          WHEN p.status = 'Aguardando Conferência do Peso' THEN 3
          WHEN p.status = 'Em Análise pelo Financeiro' THEN 4
          WHEN p.status = 'Aguardando Emissão de NF' THEN 5
          WHEN p.status = 'Cliente Liberado' THEN 6
          WHEN p.status = 'Finalizado' THEN 7
          ELSE 99
        END,
        p.data_coleta ASC
    `;

    const [pedidos] = await db.query(sql);

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
    console.error('Erro ao buscar pedidos para o financeiro:', err);
    res.status(500).json({ erro: 'Erro ao buscar pedidos para o financeiro' });
  }
});

module.exports = router;