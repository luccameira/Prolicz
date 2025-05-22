const express = require('express');
const router = express.Router();

// Rota para obter todos os clientes
router.get('/', (req, res) => {
    const connection = router.connection; // A conexão com o banco de dados é injetada via index.js

    if (!connection) {
        console.error('[ERRO FATAL API CLIENTES] Conexão com o banco de dados não estabelecida. Verifique db.js e index.js');
        return res.status(500).json({ error: 'Erro interno do servidor: conexão com o banco de dados ausente.' });
    }

    const query = 'SELECT * FROM clientes';
    console.log(`[DEBUG API CLIENTES] Tentando executar a query: "${query}"`); // Novo log

    connection.query(query, (err, results) => {
        if (err) {
            // ESTA É A LINHA MAIS IMPORTANTE: IMPRIMIR O ERRO DETALHADO DO MYSQL
            console.error(`\n[ERRO MYSQL] Erro ao executar a query "${query}":`);
            console.error(err); // Isso vai imprimir o objeto de erro COMPLETO do MySQL
            console.error(`[ERRO MYSQL] Código do erro: ${err.code}`);
            console.error(`[ERRO MYSQL] Mensagem de erro: ${err.sqlMessage || err.message}`);
            console.error(`[ERRO MYSQL] Query problemática: ${err.sql}`);
            // FIM DAS LINHAS IMPORTANTES

            return res.status(500).json({ error: 'Erro ao buscar clientes no banco de dados. Consulte o console do servidor para mais detalhes.' });
        }
        if (results.length === 0) {
            console.log('[DEBUG API CLIENTES] Nenhum cliente encontrado no banco de dados.');
            return res.status(200).json([]);
        }
        console.log(`[DEBUG API CLIENTES] Clientes encontrados: ${results.length}`);
        res.status(200).json(results);
    });
});

// Rota para adicionar um novo cliente (apenas como exemplo, não vamos testar agora)
router.post('/', (req, res) => {
    const { nome, cnpj } = req.body; // Exemplo de dados
    res.status(201).json({ message: 'Cliente adicionado (simulado)', nome, cnpj });
});

module.exports = router;
