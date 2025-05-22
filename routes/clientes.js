const express = require('express');
const router = express.Router();

// Importe o pool de conexões diretamente aqui
// Certifique-se de que o caminho para 'db.js' está correto.
const connection = require('../db'); // O 'connection' aqui é na verdade o 'pool'

// POST /api/clientes - Cadastrar novo cliente
router.post('/', async (req, res) => {
    const {
        tipo_pessoa, documento, nome_fantasia, situacao_tributaria, codigo_fiscal,
        cep, logradouro, numero, bairro, cidade, estado, meio_pagamento,
        contatos = [], produtos = [], prazos = []
    } = req.body;

    const sql = `
        INSERT INTO clientes (
            tipo_pessoa, documento, nome_fantasia, situacao_tributaria,
            codigo_fiscal, cep, logradouro, numero, bairro, cidade, estado, meio_pagamento
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
        tipo_pessoa, documento, nome_fantasia, situacao_tributaria,
        codigo_fiscal, cep, logradouro, numero, bairro, cidade, estado, meio_pagamento
    ];

    try {
        const [resultado] = await connection.query(sql, values);
        const clienteId = resultado.insertId;

        const promises = [];

        contatos.forEach(c => {
            promises.push(connection.query(
                `INSERT INTO contatos_cliente (cliente_id, nome, telefone, email) VALUES (?, ?, ?, ?)`,
                [clienteId, c.nome, c.telefone, c.email]
            ));
        });

        produtos.forEach(p => {
            promises.push(connection.query(
                `INSERT INTO produtos_autorizados (cliente_id, produto_id, valor_unitario) VALUES (?, ?, ?)`,
                [clienteId, p.id, parseFloat(p.valor.replace(/[^\d,-]/g, '').replace(',', '.')) || 0]
            ));
        });

        prazos.forEach(p => {
            promises.push(connection.query(
                `INSERT INTO prazos_pagamento (cliente_id, descricao) VALUES (?, ?)`,
                [clienteId, p]
            ));
        });

        await Promise.all(promises);

        res.status(201).json({ mensagem: 'Cliente cadastrado com sucesso!', id: clienteId });
    } catch (err) {
        console.error('Erro ao cadastrar cliente:', err);
        res.status(500).json({ erro: 'Erro ao cadastrar cliente.' });
    }
});

// GET /api/clientes - Para filtros e dropdowns
router.get('/', (req, res) => {
    const sql = `SELECT id, nome_fantasia FROM clientes ORDER BY nome_fantasia`; // Usando crases

    connection.query(sql)
        .then(([results]) => res.json(results))
        .catch(err => {
            console.error('Erro ao buscar clientes:', err);
            res.status(500).json({ error: 'Erro ao buscar clientes' });
        });
});

// GET /api/clientes/produtos - Listar produtos disponíveis
router.get('/produtos', (req, res) => {
    // Já estava correto, mantendo aspas duplas ou poderia ser crases
    connection.query("SELECT id, nome, unidade FROM produtos ORDER BY nome ASC")
        .then(([resultados]) => res.status(200).json(resultados))
        .catch(err => {
            console.error('Erro ao buscar produtos:', err);
            res.status(500).json({ erro: 'Erro ao buscar produtos.' });
        });
});

// GET /api/clientes/:id/produtos - Buscar produtos autorizados por cliente
router.get('/:id/produtos', (req, res) => {
    const clienteId = req.params.id;
    const sql = `
        SELECT p.id, p.nome AS nome, pa.valor_unitario
        FROM produtos_autorizados pa
        JOIN produtos p ON p.id = pa.produto_id
        WHERE pa.cliente_id = ?
    `;
    connection.query(sql, [clienteId])
        .then(([resultados]) => res.status(200).json(resultados))
        .catch(err => {
            console.error('Erro ao buscar produtos autorizados:', err);
            res.status(500).json({ erro: 'Erro ao buscar produtos autorizados.' });
        });
});

// GET /api/clientes/:id - Buscar cliente completo
router.get('/:id', async (req, res) => {
    const id = req.params.id;

    // Correção: Adicionado aspas/crases para as strings SQL
    const queryCliente = `SELECT * FROM clientes WHERE id = ?`;
    const queryContatos = `SELECT nome, telefone, email FROM contatos_cliente WHERE cliente_id = ?`;
    const queryProdutos = `
        SELECT p.id, p.nome AS nome, pa.valor_unitario
        FROM produtos_autorizados pa
        JOIN produtos p ON p.id = pa.produto_id
        WHERE pa.cliente_id = ?`;
    const queryPrazos = `SELECT descricao FROM prazos_pagamento WHERE cliente_id = ?`;

    try {
        const [clienteRes] = await connection.query(queryCliente, [id]);
        if (clienteRes.length === 0) {
            return res.status(404).json({ erro: 'Cliente não encontrado.' });
        }

        const [contatosRes] = await connection.query(queryContatos, [id]);
        const [produtosRes] = await connection.query(queryProdutos, [id]);
        const [prazosRes] = await connection.query(queryPrazos, [id]);

        const cliente = clienteRes[0];
        cliente.contatos = contatosRes;
        cliente.produtos_autorizados = produtosRes;
        cliente.prazos_pagamento = prazosRes;

        res.status(200).json(cliente);
    } catch (err) {
        console.error("Erro ao buscar cliente:", err);
        res.status(500).json({ erro: 'Erro interno.' });
    }
});

// PUT /api/clientes/:id - Atualizar cliente
router.put('/:id', async (req, res) => {
    const id = req.params.id;
    const {
        tipo_pessoa, documento, nome_fantasia, situacao_tributaria, codigo_fiscal,
        cep, logradouro, numero, bairro, cidade, estado, meio_pagamento,
        contatos = [], produtos = [], prazos = []
    } = req.body;

    try {
        await connection.query(`
            UPDATE clientes SET
                tipo_pessoa = ?, documento = ?, nome_fantasia = ?, situacao_tributaria = ?,
                codigo_fiscal = ?, cep = ?, logradouro = ?, numero = ?, bairro = ?, cidade = ?, estado = ?, meio_pagamento = ?
            WHERE id = ?
        `, [tipo_pessoa, documento, nome_fantasia, situacao_tributaria, codigo_fiscal, cep,
            logradouro, numero, bairro, cidade, estado, meio_pagamento, id]);

        // Usando template literals para consistência
        await connection.query(`DELETE FROM contatos_cliente WHERE cliente_id = ?`, [id]);
        await connection.query(`DELETE FROM produtos_autorizados WHERE cliente_id = ?`, [id]);
        await connection.query(`DELETE FROM prazos_pagamento WHERE cliente_id = ?`, [id]);

        const promises = [];

        contatos.forEach(c => {
            promises.push(connection.query(
                `INSERT INTO contatos_cliente (cliente_id, nome, telefone, email) VALUES (?, ?, ?, ?)`,
                [id, c.nome, c.telefone, c.email]
            ));
        });

        produtos.forEach(p => {
            const valor = parseFloat(p.valor.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
            promises.push(connection.query(
                `INSERT INTO produtos_autorizados (cliente_id, produto_id, valor_unitario) VALUES (?, ?, ?)`,
                [id, p.id, valor]
            ));
        });

        prazos.forEach(p => {
            promises.push(connection.query(
                `INSERT INTO prazos_pagamento (cliente_id, descricao) VALUES (?, ?)`,
                [id, p]
            ));
        });

        await Promise.all(promises);
        res.status(200).json({ mensagem: 'Cliente atualizado com sucesso!' });
    } catch (err) {
        console.error("Erro ao atualizar cliente:", err);
        res.status(500).json({ erro: 'Erro ao atualizar cliente.' });
    }
});

// Removendo a injeção de conexão via Object.defineProperty
// pois estamos importando diretamente no topo do arquivo.
// Object.defineProperty(router, 'connection', {
//   set(conn) {
//     connection = conn;
//   }
// });

module.exports = router;
