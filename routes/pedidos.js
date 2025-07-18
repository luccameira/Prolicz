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
        p.data_conferencia_peso,
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

    // 🔽 NOVO TRECHO: buscar observações por setor
    for (const pedido of pedidos) {
      const [obs] = await db.query(
        `SELECT texto FROM observacoes_pedido WHERE pedido_id = ? AND setor = 'Portaria'`,
        [pedido.pedido_id]
      );
      pedido.observacoes_setor = obs.map(o => o.texto);
    }

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
      i.tipo_peso,
      p.data_coleta,
      p.data_coleta_iniciada,
      p.data_carga_finalizada,
      p.data_conferencia_peso,
      SUM(i.peso) AS peso_previsto,
      p.status,
      c.id AS cliente_id
    FROM pedidos p
    INNER JOIN clientes c ON p.cliente_id = c.id
    INNER JOIN itens_pedido i ON p.id = i.pedido_id
    WHERE DATE(p.data_coleta) = CURDATE() AND p.status != 'Aguardando Início da Coleta'
    GROUP BY 
      p.id, i.id, p.data_criacao, c.nome_fantasia, i.nome_produto, i.tipo_peso,
      p.data_coleta, p.data_coleta_iniciada, p.data_carga_finalizada, 
      p.data_conferencia_peso, p.status, c.id
    ORDER BY p.data_coleta ASC
  `;

  try {
    const [results] = await db.query(sql);

    for (const pedido of results) {
      // Observações do setor
      const [obs] = await db.query(
        `SELECT texto FROM observacoes_pedido WHERE pedido_id = ? AND setor = 'Carga e Descarga'`,
        [pedido.id]
      );
      pedido.observacoes_setor = obs.map(o => o.texto);

      // Produtos autorizados do cliente
      const [produtos] = await db.query(
        `SELECT p.nome AS nome FROM produtos p
         INNER JOIN produtos_autorizados pa ON pa.produto_id = p.id
         WHERE pa.cliente_id = ?`,
        [pedido.cliente_id]
      );
      pedido.produtos_autorizados = produtos;

      // Produtos autorizados a vender
      const [produtosVenda] = await db.query(
        `SELECT p.nome AS nome
         FROM produtos_a_vender pv
         INNER JOIN produtos p ON pv.produto_id = p.id
         WHERE pv.cliente_id = ?`,
        [pedido.cliente_id]
      );
      pedido.produtos_venda = produtosVenda;
    }

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
      c.nome_fantasia AS cliente,
      c.documento AS cnpj,
      c.situacao_tributaria,
      c.inscricao_estadual,
      CONCAT(c.logradouro, ', ', c.numero, ' / ', c.bairro, ' / ', c.cidade, ' - ', c.estado) AS endereco
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
      const [obs] = await db.query(
  `SELECT texto FROM observacoes_pedido WHERE pedido_id = ? AND setor = 'Emissão de NF'`,
  [pedido.pedido_id]
);
pedido.observacoes_setor = obs.map(o => o.texto);

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
      `SELECT 
         p.nome AS nome_produto, 
         p.valor_unitario, 
         p.unidade,
         p.codigo_fiscal
       FROM produtos_autorizados pa
       INNER JOIN produtos p ON pa.produto_id = p.id
       WHERE pa.cliente_id = ?`,
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
  const { cliente_id, empresa, tipo, data_coleta, status, prazos, itens, condicao_pagamento_a_vista, observacoes } = req.body;
const observacao = ''; // não usamos mais campo único, deixamos vazio
  const dataISO = formatarDataBRparaISO(data_coleta);

  try {
    // Inserir pedido na tabela pedidos
    const [pedidoResult] = await db.query(
  `INSERT INTO pedidos (cliente_id, empresa, tipo, data_coleta, observacao, condicao_pagamento_avista, status, data_criacao)
   VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
  [cliente_id, empresa || null, tipo, dataISO, observacao, condicao_pagamento_a_vista || null, status || 'Aguardando Início da Coleta']
);

    const pedido_id = pedidoResult.insertId;

    // Inserir itens do pedido
    if (Array.isArray(itens)) {
      for (const item of itens) {
        await db.query(
  `INSERT INTO itens_pedido (
     pedido_id, nome_produto, valor_unitario, peso, tipo_peso, unidade, codigo_fiscal, valor_com_nota, valor_sem_nota
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    pedido_id,
    item.nome_produto,
    item.valor_unitario,
    item.peso,
    item.tipo_peso,
    item.unidade || '',
    item.codigo_fiscal || '',
    item.valor_com_nota || null,
    item.valor_sem_nota || null
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

// Inserir observações por setor (agora pode ter múltiplos setores para a mesma observação)
if (Array.isArray(observacoes)) {
  for (const obs of observacoes) {
    const setores = Array.isArray(obs.setor) ? obs.setor : [obs.setor];
    const texto = obs.texto || '';
    for (const setor of setores) {
      await db.query(
        `INSERT INTO observacoes_pedido (pedido_id, setor, texto) VALUES (?, ?, ?)`,
        [pedido_id, setor, texto]
      );
    }
  }
}

    res.status(201).json({ mensagem: 'Pedido criado com sucesso', pedido_id });
  } catch (error) {
    console.error('Erro ao criar pedido:', error);
    res.status(500).json({ erro: 'Erro ao criar pedido.' });
  }
});

// POST /api/pedidos/:id/observacoes - Adicionar nova observação a um pedido
router.post('/:id/observacoes', async (req, res) => {
  const pedidoId = req.params.id;
  const { texto_observacao, usuario_nome = 'Usuário' } = req.body; // recebe usuário do frontend

  if (!texto_observacao || texto_observacao.trim() === '') {
    return res.status(400).json({ erro: 'Texto da observação é obrigatório.' });
  }

  try {
    // Inserir observação para o setor 'Geral' ou outro que desejar
    const [result] = await db.query(
      `INSERT INTO observacoes_pedido (pedido_id, setor, texto, usuario_nome) VALUES (?, ?, ?, ?)`,
      [pedidoId, 'Geral', texto_observacao.trim(), usuario_nome]
    );

    // Retornar a observação criada para o frontend
    res.status(201).json({
      id: result.insertId,
      pedido_id: pedidoId,
      texto_observacao: texto_observacao.trim(),
      usuario_nome,
      data_criacao: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao salvar observação:', error);
    res.status(500).json({ erro: 'Erro ao salvar observação.' });
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

const uploadMultiplosTickets = uploadTicket.any(); // permite múltiplos arquivos com qualquer nome

// Rota PUT /api/pedidos/:id/carga
router.put('/:id/carga', uploadTicket.any(), async (req, res) => {
  const pedidoId = req.params.id;
  const arquivos = req.files || [];
  let materiais;

  try {
    materiais = JSON.parse(req.body.itens);
  } catch (err) {
    return res.status(400).json({ erro: 'Materiais inválidos.' });
  }

  if (!Array.isArray(materiais) || materiais.length === 0) {
    return res.status(400).json({ erro: 'Materiais inválidos.' });
  }

  try {
    for (const mat of materiais) {
      if (!mat.item_id) continue;

      await db.query('DELETE FROM descontos_item_pedido WHERE item_id = ?', [mat.item_id]);

      if (Array.isArray(mat.descontos)) {
        for (const desc of mat.descontos) {
          if (!desc.motivo || isNaN(desc.peso_calculado)) continue;

          let arquivoCompra = null;
          let arquivoDevolucao = null;

          if (desc.ticket_compra && typeof desc.ticket_compra === 'string') {
            const arquivo = arquivos.find(f => f.fieldname === desc.ticket_compra);
            if (arquivo) arquivoCompra = arquivo.filename;
          }

          if (desc.ticket_devolucao && typeof desc.ticket_devolucao === 'string') {
            const arquivo = arquivos.find(f => f.fieldname === desc.ticket_devolucao);
            if (arquivo) arquivoDevolucao = arquivo.filename;
          }

          await db.query(
            `INSERT INTO descontos_item_pedido
             (item_id, motivo, material, quantidade, peso_calculado, ticket_compra, ticket_devolucao)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              mat.item_id,
              desc.motivo || '',
              desc.material || '',
              desc.quantity || desc.quantidade || 0,
              desc.peso_calculado || 0,
              arquivoCompra,
              arquivoDevolucao
            ]
          );
        }
      }

      await db.query(
        'UPDATE itens_pedido SET peso_carregado = ? WHERE id = ?',
        [mat.peso_carregado || 0, mat.item_id]
      );
    }

    const ticketBalanca = arquivos.find(f => f.fieldname === 'ticket_balanca')?.filename || null;

    await db.query(
      `UPDATE pedidos 
       SET 
         ticket_balanca = ?, 
         status = 'Aguardando Conferência do Peso',
         data_carga_finalizada = NOW()
       WHERE id = ?`,
      [ticketBalanca, pedidoId]
    );

    res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao registrar carga:', error);
    res.status(500).json({ erro: 'Erro ao registrar carga.' });
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

router.get('/conferencia', async (req, res) => {
  try {
    const [pedidos] = await db.query(`
      SELECT 
        p.id AS pedido_id,
        p.data_criacao,
        p.tipo,
        p.data_coleta,
        p.status,
        p.ticket_balanca,
        c.nome_fantasia AS cliente,
        p.data_coleta_iniciada,
        p.data_carga_finalizada, -- ✅ ESTA LINHA FALTAVA
        p.data_conferencia_peso,
        p.data_financeiro,
        p.data_nota_fiscal,
        p.data_finalizado
      FROM pedidos p
      JOIN clientes c ON p.cliente_id = c.id
      WHERE p.data_coleta_iniciada IS NOT NULL
      ORDER BY p.data_coleta ASC
    `);

    for (const pedido of pedidos) {
      // 👇 Aqui está a correção
      const [materiais] = await db.query(
        `SELECT 
          id, nome_produto, peso AS quantidade, tipo_peso, unidade, 
          peso_carregado, valor_unitario, codigo_fiscal
         FROM itens_pedido
         WHERE pedido_id = ?`,
        [pedido.pedido_id]
      );
      pedido.materiais = materiais || [];

      // Buscar descontos vinculados aos itens do pedido
      for (const item of materiais) {
        const [descontos] = await db.query(
          'SELECT * FROM descontos_item_pedido WHERE item_id = ?',
          [item.id]
        );
        item.descontos = descontos || [];
      }
    }

    res.json(pedidos);
  } catch (error) {
    console.error('Erro ao buscar pedidos para conferência:', error);
    res.status(500).json({ error: 'Erro ao buscar pedidos para conferência' });
  }
});

// GET /api/pedidos/nf
router.get('/nf', async (req, res) => {
  const sql = `
    SELECT 
  p.id AS pedido_id, p.data_criacao, p.tipo, p.status, p.data_coleta,
  p.codigo_interno, p.observacao, p.empresa,
  c.nome_fantasia AS cliente,
  c.documento AS cnpj,
  c.situacao_tributaria,
  c.inscricao_estadual,
  CONCAT(c.logradouro, ', ', c.numero, ' / ', c.bairro, ' / ', c.cidade, ' - ', c.estado) AS endereco
FROM pedidos p
INNER JOIN clientes c ON p.cliente_id = c.id
WHERE p.status = 'Aguardando Emissão de NF'
ORDER BY p.data_coleta ASC
  `;
  try {
    const [pedidos] = await db.query(sql);

for (const pedido of pedidos) {
  const [obs] = await db.query(
  `SELECT texto FROM observacoes_pedido WHERE pedido_id = ? AND setor = 'Emissão de NF' LIMIT 1`,
  [pedido.pedido_id]
);
pedido.observacoes = obs.length ? obs[0].texto : '';
}

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
        p.ticket_balanca,
        p.condicao_pagamento_avista,
        c.nome_fantasia AS cliente,
        c.documento AS cnpj,
        c.situacao_tributaria,
        c.inscricao_estadual,
        c.id AS cliente_id,
        CONCAT(c.logradouro, ', ', c.numero, ' / ', c.bairro, ' / ', c.cidade, ' - ', c.estado) AS endereco
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
      // Observações do setor Financeiro
      const [obs] = await db.query(
        `SELECT texto FROM observacoes_pedido WHERE pedido_id = ? AND setor = 'Financeiro'`,
        [pedido.pedido_id]
      );
      pedido.observacoes_setor = obs.map(o => o.texto);

     // Materiais do pedido — agora com campos de personalização fiscal
const [materiais] = await db.query(
  `SELECT 
     id, 
     nome_produto, 
     peso AS quantidade, 
     tipo_peso, 
     unidade, 
     peso_carregado, 
     valor_unitario, 
     codigo_fiscal,
     valor_com_nota,
     valor_sem_nota,
     (COALESCE(valor_unitario, 0) * COALESCE(peso, 0)) AS valor_total
   FROM itens_pedido
   WHERE pedido_id = ?`,
  [pedido.pedido_id]
);

      // Descontos por item
      for (const item of materiais) {
        const [descontos] = await db.query(
          `SELECT motivo, quantidade, peso_calculado, material, ticket_compra, ticket_devolucao
           FROM descontos_item_pedido
           WHERE item_id = ?`,
          [item.id]
        );
        item.descontos = descontos || [];
      }

      pedido.materiais = materiais;
      pedido.observacoes = pedido.observacao || '';

      // Prazos de pagamento
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

      // Produtos autorizados a vender
      const [autorizadosVenda] = await db.query(
        `SELECT 
          pav.produto_id AS id,
          p.nome AS nome_produto,
          pav.valor_unitario
         FROM produtos_a_vender pav
         INNER JOIN produtos p ON pav.produto_id = p.id
         WHERE pav.cliente_id = ?`,
        [pedido.cliente_id]
      );
      pedido.produtos_autorizados_venda = autorizadosVenda || [];

      // Produtos autorizados a devolver
      const [autorizadosDevolucao] = await db.query(
        `SELECT 
          pa.produto_id AS id,
          p.nome AS nome_produto,
          pa.valor_unitario
         FROM produtos_autorizados pa
         INNER JOIN produtos p ON pa.produto_id = p.id
         WHERE pa.cliente_id = ?`,
        [pedido.cliente_id]
      );
      pedido.produtos_autorizados_devolucao = autorizadosDevolucao || [];
    }

    res.json(pedidos);
  } catch (err) {
    console.error('Erro ao buscar pedidos para o financeiro:', err);
    res.status(500).json({ erro: 'Erro ao buscar pedidos para o financeiro' });
  }
});

// GET /api/pedidos/:id - retorna os dados completos de um pedido específico
router.get('/:id', async (req, res) => {
  const pedidoId = req.params.id;

  try {
    const [pedidos] = await db.query(
      `SELECT 
        p.id AS pedido_id,
        p.cliente_id,
        p.empresa,
        p.tipo,
        p.status,
        p.data_coleta,
        p.data_criacao,
        p.observacao,
        p.prazo_pagamento,
        p.condicao_pagamento_avista,
        p.codigo_interno,
        p.desconto_peso,
        p.motivo_desconto,
        c.nome_fantasia AS cliente,
        c.documento,
        c.situacao_tributaria,
        c.inscricao_estadual,
        CONCAT(c.logradouro, ', ', c.numero, ' / ', c.bairro, ' / ', c.cidade, ' - ', c.estado) AS endereco
       FROM pedidos p
       INNER JOIN clientes c ON p.cliente_id = c.id
       WHERE p.id = ?`,
      [pedidoId]
    );

    if (pedidos.length === 0) {
      return res.status(404).json({ erro: 'Pedido não encontrado' });
    }

    const pedido = pedidos[0];

    // Itens
    const [materiais] = await db.query(
      `SELECT 
         id, 
         nome_produto, 
         peso, 
         tipo_peso, 
         unidade, 
         peso_carregado, 
         valor_unitario, 
         codigo_fiscal, 
         valor_com_nota, 
         valor_sem_nota, 
         (valor_unitario * peso) AS valor_total
       FROM itens_pedido
       WHERE pedido_id = ?`,
      [pedidoId]
    );
    pedido.materiais = materiais;

    // Prazos usados
    const [prazosPedido] = await db.query(
      `SELECT descricao, dias FROM prazos_pedido WHERE pedido_id = ?`,
      [pedidoId]
    );
    pedido.prazos_pagamento = prazosPedido;
    pedido.prazo_pagamento = prazosPedido.map(p => `${p.descricao} (${p.dias} dias)`);

    // Prazos permitidos
    const [prazosPermitidos] = await db.query(
      `SELECT descricao, dias FROM prazos_pagamento WHERE cliente_id = ?`,
      [pedido.cliente_id]
    );
    pedido.prazos_permitidos = prazosPermitidos.map(p => `${p.descricao} (${p.dias} dias)`);

    // Histórico
    const [historico] = await db.query(
      `SELECT titulo, descricao, data
       FROM historico_pedido
       WHERE pedido_id = ? 
       ORDER BY data ASC`,
      [pedidoId]
    );
    pedido.historico = historico;

    // Observações
    const [observacoes] = await db.query(
      `SELECT id, setor, texto AS texto_observacao, usuario_nome, data_criacao
       FROM observacoes_pedido
       WHERE pedido_id = ?
       ORDER BY data_criacao ASC`,
      [pedidoId]
    );
    pedido.observacoes = observacoes;

    // Produtos autorizados
    const [produtosAutorizados] = await db.query(
      `SELECT 
         p.nome AS nome_produto, 
         p.valor_unitario, 
         p.unidade, 
         p.codigo_fiscal
       FROM produtos_autorizados pa
       INNER JOIN produtos p ON pa.produto_id = p.id
       WHERE pa.cliente_id = ?`,
      [pedido.cliente_id]
    );
    pedido.produtos_autorizados = produtosAutorizados;

    res.json(pedido);
  } catch (error) {
    console.error('Erro ao buscar pedido:', error);
    res.status(500).json({ erro: 'Erro ao buscar pedido' });
  }
});

// ✅ ROTA RESETAR TAREFA (corrigida com status conforme setor)
router.post('/:id/resetar-tarefa', async (req, res) => {
  const pedidoId = req.params.id;
  const { setor, motivo, usuario_nome } = req.body;

  if (!setor || !motivo) {
    return res.status(400).json({ erro: 'Setor e motivo são obrigatórios.' });
  }

  const statusPorSetor = {
    'Portaria': 'Aguardando Início da Coleta',
    'Carga e Descarga': 'Coleta Iniciada',
    'Conferência de Peso': 'Aguardando Conferência do Peso',
    'Financeiro': 'Em Análise pelo Financeiro',
    'Emissão de NF': 'Aguardando Emissão de NF'
  };

  const novoStatus = statusPorSetor[setor] || setor;

  try {
    const [resultado] = await db.query(
      `SELECT status FROM pedidos WHERE id = ?`,
      [pedidoId]
    );

    const pedidoAtual = resultado[0];
    const etapaAnterior = pedidoAtual?.status || 'Desconhecido';

    await db.query(
      `UPDATE pedidos SET status = ? WHERE id = ?`,
      [novoStatus, pedidoId]
    );

    const textoObservacao = `[RESET] Etapa anterior: ${etapaAnterior}. Nova etapa: ${setor}. Justificativa: ${motivo}`;

    await db.query(
      `INSERT INTO observacoes_pedido (pedido_id, setor, texto, usuario_nome, data_criacao)
       VALUES (?, ?, ?, ?, NOW())`,
      [pedidoId, setor, textoObservacao, usuario_nome || 'Sistema']
    );

    await db.query(
      `INSERT INTO historico_pedido (pedido_id, titulo, descricao, data)
       VALUES (?, ?, ?, NOW())`,
      [pedidoId, 'Reset de Tarefa', `Pedido resetado para o setor "${setor}" com motivo: ${motivo}`]
    );

    res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao resetar tarefa:', error);
    res.status(500).json({ erro: 'Erro ao resetar tarefa' });
  }
});

module.exports = router;
