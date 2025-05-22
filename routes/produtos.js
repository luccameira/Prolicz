const express = require('express');
const router = express.Router();
// Importa o pool de conexões com suporte a Promises.
// Certifique-se de que seu arquivo '../db.js' exporta um pool configurado para Promises.
const db = require('../db'); 

function formatarDataBRparaISO(dataBR) {
    const [dia, mes, ano] = dataBR.split('/');
    // CORREÇÃO: Usando template literal com crases (`) e interpolação ${}
    return `<span class="math-inline">\{ano\}\-</span>{mes}-${dia}`;
}

// GET /api/pedidos - Listagem com filtros e ordenações agrupada por pedido
router.get('/', async (req, res) => { // Tornando a rota async para usar await
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
        // Se status puder ser uma lista, você precisará tratar como no seu código anterior
        // const statusList = status.split(',').map(s => s.trim());
        // sql += ` AND p.status IN (${statusList.map(() => '?').join(',')})`;
        // params.push(...statusList);
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

    try {
        // CORREÇÃO: Usando await com db.query
        const [results] = await db.query(sql, params);
        res.json(results);
    } catch (err) {
        console.error('Erro ao buscar pedidos:', err);
        res.status(500).json({ erro: 'Erro ao buscar pedidos' });
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
        // CORREÇÃO: Usando await com db.query diretamente
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

// PUT /api/pedidos/:id/registrar-peso - Registro do peso carregado na etapa de carga e descarga
router.put('/:id/registrar-peso', async (req, res) => {
    const pedidoId = req.params.id;
    const { peso, desconto, motivo } = req.body;

    if (!peso || isNaN(peso) || peso <= 0) {
        return res.status(400).json({ erro: 'Peso inválido.' });
    }

    try {
        // CORREÇÃO: Usando await com db.query diretamente
        await db.query(
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
// ATENÇÃO: Esta rota /carga está duplicada. Você já tem uma no início do arquivo.
// Recomendo remover uma delas ou garantir que elas tenham finalidades diferentes.
router.get('/carga', async (req, res) => { // Tornando a rota async para usar await
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
        // CORREÇÃO: Usando await com db.query
        const [results] = await db.query(sql);
        res.json(results);
    } catch (err) {
        console.error('Erro ao buscar pedidos de carga:', err);
        res.status(500).json({ erro: 'Erro ao buscar pedidos de carga' });
    }
});

// POST /api/pedidos - Cadastrar novo pedido (Adicionado com base no seu código anterior de pedidos.js)
router.post('/', async (req, res) => {
    const { cliente_id, empresa, tipo, data_coleta, observacao, status, prazo_pagamento, codigo_fiscal, itens = [] } = req.body;
    const dataISO = formatarDataBRparaISO(data_coleta);

    try {
        const [pedidoResult] = await db.query(
            `INSERT INTO pedidos (cliente_id, empresa, tipo, data_coleta, observacao, status, prazo_pagamento, codigo_fiscal, data_criacao)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [cliente_id, empresa || null, tipo, dataISO, observacao, status || 'Aguardando Início da Coleta', prazo_pagamento, codigo_fiscal || '']
        );

        const pedido_id = pedidoResult.insertId;

        for (const item of itens) {
            await db.query(
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

// GET /api/pedidos/produtos - Listar produtos disponíveis (rota de produtos, estava aqui em pedidos no seu arquivo)
router.get('/produtos', async (req, res) => {
    try {
        // CORREÇÃO: Envolvendo a query SQL em crases
        const [produtos] = await db.query(
            `SELECT nome AS nome_produto, unidade, criado_em AS data_cadastro FROM produtos ORDER BY criado_em DESC`
        );

        res.json(produtos);
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ erro: 'Erro ao buscar produtos.' });
    }
});

// PUT /api/pedidos/:id/conferencia - Confirmar peso e enviar para o financeiro
router.put('/:id/conferencia', async (req, res) => {
    const pedidoId = req.params.id;

    try {
        // CORREÇÃO: Envolvendo a query SQL em crases
        const [result] = await db.query(
            `UPDATE pedidos SET status = ? WHERE id = ?`,
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
