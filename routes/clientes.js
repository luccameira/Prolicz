const express = require('express');
const router = express.Router();
let connection;

// POST /api/clientes
router.post('/', async (req, res) => {
  const {
    tipo_pessoa, documento, nome_fantasia, situacao_tributaria,
    cep, logradouro, numero, bairro, cidade, estado,
    meio_pagamento, codigosFiscais = [], contatos = [], produtos = [], prazos = []
  } = req.body;

  const sql = `
    INSERT INTO clientes (
      tipo_pessoa, documento, nome_fantasia, situacao_tributaria,
      cep, logradouro, numero, bairro, cidade, estado,
      meio_pagamento, codigos_fiscais
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    tipo_pessoa, documento, nome_fantasia, situacao_tributaria,
    cep, logradouro, numero, bairro, cidade, estado,
    meio_pagamento, JSON.stringify(codigosFiscais)
  ];

  try {
    const [resultado] = await connection.query(sql, values);
    const clienteId = resultado.insertId;

    // inserir contatos
    for (const c of contatos) {
      await connection.query(
        'INSERT INTO contatos_cliente (cliente_id, nome, telefone, email) VALUES (?, ?, ?, ?)',
        [clienteId, c.nome, c.telefone, c.email]
      );
    }

    // inserir produtos autorizados
    for (const p of produtos) {
      const raw = p.valor_unitario != null ? p.valor_unitario : p.valor;
      const valor = parseFloat(
        typeof raw === "string"
          ? raw.replace(/[^\d,-]/g, '').replace(',', '.')
          : raw
      ) || 0;
      await connection.query(
        'INSERT INTO produtos_autorizados (cliente_id, produto_id, valor_unitario) VALUES (?, ?, ?)',
        [clienteId, p.id, valor]
      );
    }

    // inserir prazos de pagamento
    for (const p of prazos) {
      await connection.query(
        'INSERT INTO prazos_pagamento (cliente_id, descricao, dias) VALUES (?, ?, ?)',
        [clienteId, p.descricao, p.dias]
      );
    }

    res.status(201).json({ mensagem: 'Cliente cadastrado com sucesso!', id: clienteId });
  } catch (err) {
    console.error('Erro ao cadastrar cliente:', err);
    // trata duplicidade de CPF/CNPJ
    if (err.code === 'ER_DUP_ENTRY') {
      const campo = tipo_pessoa === 'fisica' ? 'CPF' : 'CNPJ';
      return res
        .status(400)
        .json({ erro: `Não foi possível criar este cliente pois o ${campo} digitado já foi cadastrado para outro cliente.` });
    }
    res.status(500).json({ erro: 'Erro ao cadastrar cliente.', detalhes: err.message });
  }
});

// GET /api/clientes
router.get('/', (req, res) => {
  const sql = 'SELECT id, nome_fantasia, documento FROM clientes ORDER BY nome_fantasia';
  connection.query(sql)
    .then(([results]) => res.json(results))
    .catch(err => {
      console.error('Erro ao buscar clientes:', err);
      res.status(500).json({ error: 'Erro ao buscar clientes' });
    });
});

// DELETE /api/clientes/:id
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await connection.query('DELETE FROM contatos_cliente WHERE cliente_id = ?', [id]);
    await connection.query('DELETE FROM produtos_autorizados WHERE cliente_id = ?', [id]);
    await connection.query('DELETE FROM prazos_pagamento WHERE cliente_id = ?', [id]);
    const [result] = await connection.query('DELETE FROM clientes WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    res.status(200).json({ mensagem: 'Cliente excluído com sucesso.' });
  } catch (err) {
    console.error('Erro ao excluir cliente:', err);
    res.status(500).json({ erro: 'Erro ao excluir cliente.' });
  }
});

// GET /api/clientes/produtos
router.get('/produtos', (req, res) => {
  connection.query('SELECT id, nome, unidade FROM produtos ORDER BY nome ASC')
    .then(([resultados]) => res.json(resultados))
    .catch(err => {
      console.error('Erro ao buscar produtos:', err);
      res.status(500).json({ erro: 'Erro ao buscar produtos.' });
    });
});

// GET /api/clientes/:id/produtos
router.get('/:id/produtos', (req, res) => {
  const clienteId = req.params.id;
  const sql = `
    SELECT p.id, p.nome AS nome, COALESCE(pa.valor_unitario, 0) AS valor_unitario
    FROM produtos_autorizados pa
    JOIN produtos p ON p.id = pa.produto_id
    WHERE pa.cliente_id = ?
  `;
  connection.query(sql, [clienteId])
    .then(([resultados]) => res.json(resultados))
    .catch(err => {
      console.error('Erro ao buscar produtos autorizados:', err);
      res.status(500).json({ erro: 'Erro ao buscar produtos autorizados.' });
    });
});

// GET /api/clientes/:id
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const [clienteRes] = await connection.query('SELECT * FROM clientes WHERE id = ?', [id]);
    if (clienteRes.length === 0) return res.status(404).json({ erro: 'Cliente não encontrado.' });

    const cliente = clienteRes[0];
    // parse dos códigos fiscais
    const rawCodigos = cliente.codigos_fiscais;
    let codigosArray = [];
    if (Array.isArray(rawCodigos)) {
      codigosArray = rawCodigos;
    } else if (typeof rawCodigos === 'string') {
      try {
        codigosArray = JSON.parse(rawCodigos);
        if (!Array.isArray(codigosArray)) codigosArray = [codigosArray];
      } catch {
        codigosArray = rawCodigos.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    cliente.codigosFiscais = codigosArray;
    delete cliente.codigos_fiscais;

    // buscar contatos, produtos e prazos
    const [contatosRes] = await connection.query(
      'SELECT nome, telefone, email FROM contatos_cliente WHERE cliente_id = ?',
      [id]
    );
    const [produtosRes] = await connection.query(
      `SELECT p.id, p.nome, COALESCE(pa.valor_unitario,0) AS valor_unitario
       FROM produtos_autorizados pa
       JOIN produtos p ON p.id = pa.produto_id
       WHERE pa.cliente_id = ?`,
      [id]
    );
    const [prazosRes] = await connection.query(
      'SELECT descricao, dias FROM prazos_pagamento WHERE cliente_id = ?',
      [id]
    );

    cliente.contatos = contatosRes;
    cliente.produtos_autorizados = produtosRes;
    cliente.prazos_pagamento = prazosRes;

    res.json(cliente);
  } catch (err) {
    console.error('Erro ao buscar cliente:', err);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// PUT /api/clientes/:id
router.put('/:id', async (req, res) => {
  const id = req.params.id;
  const {
    tipo_pessoa, documento, nome_fantasia, situacao_tributaria,
    cep, logradouro, numero, bairro, cidade, estado,
    meio_pagamento, codigosFiscais = [], contatos = [], produtos = [], prazos = []
  } = req.body;

  try {
    // atualiza dados principais
    await connection.query(`
      UPDATE clientes SET
        tipo_pessoa = ?, documento = ?, nome_fantasia = ?, situacao_tributaria = ?,
        cep = ?, logradouro = ?, numero = ?, bairro = ?, cidade = ?, estado = ?,
        meio_pagamento = ?, codigos_fiscais = ?
      WHERE id = ?
    `, [
      tipo_pessoa, documento, nome_fantasia, situacao_tributaria,
      cep, logradouro, numero, bairro, cidade, estado,
      meio_pagamento, JSON.stringify(codigosFiscais), id
    ]);

    // contatos: limpa e reinsere
    await connection.query('DELETE FROM contatos_cliente WHERE cliente_id = ?', [id]);
    for (const c of contatos) {
      await connection.query(
        'INSERT INTO contatos_cliente (cliente_id, nome, telefone, email) VALUES (?, ?, ?, ?)',
        [id, c.nome, c.telefone, c.email]
      );
    }

    // produtos autorizados: limpa e reinsere
    if (produtos.length) {
      await connection.query('DELETE FROM produtos_autorizados WHERE cliente_id = ?', [id]);
      for (const p of produtos) {
        const raw = p.valor_unitario != null ? p.valor_unitario : p.valor;
        const valor = parseFloat(
          typeof raw === "string"
            ? raw.replace(/[^\d,-]/g, '').replace(',', '.')
            : raw
        ) || 0;
        await connection.query(
          'INSERT INTO produtos_autorizados (cliente_id, produto_id, valor_unitario) VALUES (?, ?, ?)',
          [id, p.id, valor]
        );
      }
    }

    // prazos: limpa e reinsere
    if (prazos.length) {
      await connection.query('DELETE FROM prazos_pagamento WHERE cliente_id = ?', [id]);
      for (const p of prazos) {
        await connection.query(
          'INSERT INTO prazos_pagamento (cliente_id, descricao, dias) VALUES (?, ?, ?)',
          [id, p.descricao, p.dias]
        );
      }
    }

    res.json({ mensagem: 'Cliente atualizado com sucesso!' });
  } catch (err) {
    console.error('Erro ao atualizar cliente:', err);
    // trata duplicidade de CPF/CNPJ
    if (err.code === 'ER_DUP_ENTRY') {
      const campo = tipo_pessoa === 'fisica' ? 'CPF' : 'CNPJ';
      return res
        .status(400)
        .json({ erro: `Não foi possível atualizar este cliente pois o ${campo} digitado já está cadastrado para outro cliente.` });
    }
    res.status(500).json({ erro: 'Erro ao atualizar cliente.' });
  }
});

// injeta conexão
Object.defineProperty(router, 'connection', {
  set(conn) {
    connection = conn;
  }
});

module.exports = router;
