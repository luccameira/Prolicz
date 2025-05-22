const express = require('express');
const router = express.Router();
let connection;

// Código para cadastrar um novo cliente (permanece o mesmo)
router.post('/', (req, res) => {
    const {
        tipo_pessoa, documento, nome_fantasia, situacao_tributaria, codigo_fiscal,
        cep, logradouro, numero, bairro, cidade, estado, meio_pagamento
    } = req.body;

    const sql = `
        INSERT INTO clientes (
            tipo_pessoa, documento, nome_fantasia, situacao_tributaria,
            codigo_fiscal, cep, logradouro, numero, bairro, cidade, estado, meio_pagamento
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [tipo_pessoa, documento, nome_fantasia, situacao_tributaria,
        codigo_fiscal, cep, logradouro, numero, bairro, cidade, estado, meio_pagamento
    ];

    connection.query(sql, values, (err, resultado) => {
        if (err) return res.status(500).json({ erro: 'Erro ao salvar cliente.' });
        const clienteId = resultado.insertId;

        const { contatos = [], produtos = [], prazos = [] } = req.body;
        const promises = [];

        contatos.forEach(c => {
            promises.push(connection.promise().query(
                'INSERT INTO contatos_cliente (cliente_id, nome, telefone, email) VALUES (?, ?, ?, ?)',
                [clienteId, c.nome, c.telefone, c.email]
            ));
        });

        produtos.forEach(p => {
            promises.push(connection.promise().query(
                'INSERT INTO produtos_autorizados (cliente_id, produto_id, valor_unitario) VALUES (?, ?, ?)',
                [clienteId, p.id, parseFloat(p.valor.replace(/[^\d,-]/g, '').replace(',', '.')) || 0]
            ));
        });

        prazos.forEach(p => {
            promises.push(connection.promise().query(
                'INSERT INTO prazos_pagamento (cliente_id, descricao) VALUES (?, ?)',
                [clienteId, p]
            ));
        });

        Promise.all(promises)
            .then(() => res.status(201).json({ mensagem: 'Cliente cadastrado com sucesso!', id: clienteId }))
            .catch(() => res.status(500).json({ erro: 'Erro ao salvar dados adicionais.' }));
    });
});

// ESTA É A PARTE QUE BUSCA OS CLIENTES DO BANCO DE DADOS
// Ela pega o ID, Nome, CNPJ e Status para mostrar na sua tabela.
router.get('/', (req, res) => {
    const sql = 'SELECT id, nome_fantasia, documento, situacao_tributaria FROM clientes ORDER BY nome_fantasia';
    connection.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: 'Erro ao buscar clientes' });
        res.json(results);
    });
});

// Outros códigos que buscam produtos, contatos, etc., que já estavam no arquivo.
router.get('/produtos', (req, res) => {
    connection.query(`SELECT id, nome, unidade FROM produtos ORDER BY nome ASC`, (err, resultados) => {
        if (err) return res.status(500).json({ erro: 'Erro ao buscar produtos.' });
        res.status(200).json(resultados);
    });
});

router.get('/:id/produtos', (req, res) => {
    const clienteId = req.params.id;
    const sql = `
        SELECT p.id, p.nome AS nome, pa.valor_unitario
        FROM produtos_autorizados pa
        JOIN produtos p ON p.id = pa.produto_id
        WHERE pa.cliente_id = ?
    `;
    connection.query(sql, [clienteId], (err, resultados) => {
        if (err) {
            console.error('Erro ao buscar produtos autorizados:', err);
            return res.status(500).json({ erro: 'Erro ao buscar produtos autorizados.' });
        }
        res.status(200).json(resultados);
    });
});

router.get('/:id', (req, res) => {
    const id = req.params.id;

    const queryCliente = `SELECT * FROM clientes WHERE id = ?`;
    const queryContatos = `SELECT nome, telefone, email FROM contatos_cliente WHERE cliente_id = ?`;
    const queryProdutos = `
        SELECT p.id, p.nome AS nome, pa.valor_unitario
        FROM produtos_autorizados pa
        JOIN produtos p ON p.id = pa.produto_id
        WHERE pa.cliente_id = ?`;
    const queryPrazos = `SELECT descricao FROM prazos_pagamento WHERE cliente_id = ?`;

    Promise.all([
        connection.promise().query(queryCliente, [id]),
        connection.promise().query(queryContatos, [id]),
        connection.promise().query(queryProdutos, [id]),
        connection.promise().query(queryPrazos, [id])
    ]).then(([clienteRes, contatosRes, produtosRes, prazosRes]) => {
        if (clienteRes[0].length === 0) return res.status(404).json({ erro: 'Cliente não encontrado.' });

        const cliente = clienteRes[0][0];
        cliente.contatos = contatosRes[0];
        cliente.produtos_autorizados = produtosRes[0];
        cliente.prazos_pagamento = prazosRes[0];

        res.status(200).json(cliente);
    }).catch(err => {
        console.error("Erro ao buscar cliente:", err);
        res.status(500).json({ erro: 'Erro interno.' });
    });
});

router.put('/:id', async (req, res) => {
    const id = req.params.id;
    const {
        tipo_pessoa, documento, nome_fantasia, situacao_tributaria, codigo_fiscal,
        cep, logradouro, numero, bairro, cidade, estado, meio_pagamento,
        contatos = [], produtos = [], prazos = []
    } = req.body;

    try {
        await connection.promise().query(`
            UPDATE clientes SET
            tipo_pessoa = ?, documento = ?, nome_fantasia = ?, situacao_tributaria = ?,
            codigo_fiscal = ?, cep = ?, logradouro = ?, numero = ?, bairro = ?, cidade = ?, estado = ?, meio_pagamento = ?
            WHERE id = ?
        `, [tipo_pessoa, documento, nome_fantasia, situacao_tributaria, codigo_fiscal, cep,
            logradouro, numero, bairro, cidade, estado, meio_pagamento, id
        ]);

        await connection.promise().query('DELETE FROM contatos_cliente WHERE cliente_id = ?', [id]);
        await connection.promise().query('DELETE FROM produtos_autorizados WHERE cliente_id = ?', [id]);
        await connection.promise().query('DELETE FROM prazos_pagamento WHERE cliente_id = ?', [id]);

        const promises = [];

        contatos.forEach(c => {
            promises.push(connection.promise().query(
                'INSERT INTO contatos_cliente (cliente_id, nome, telefone, email) VALUES (?, ?, ?, ?)',
                [id, c.nome, c.telefone, c.email]
            ));
        });

        produtos.forEach(p => {
            const valor = parseFloat(p.valor.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
            promises.push(connection.promise().query(
                'INSERT INTO produtos_autorizados (cliente_id, produto_id, valor_unitario) VALUES (?, ?, ?)',
                [id, p.id, valor]
            ));
        });

        prazos.forEach(p => {
            promises.push(connection.promise().query(
                'INSERT INTO prazos_pagamento (cliente_id, descricao) VALUES (?, ?)',
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

// Conecta as "engrenagens" do banco de dados a este arquivo.
Object.defineProperty(router, 'connection', {
    set(conn) {
        connection = conn;
    }
});

module.exports = router;
