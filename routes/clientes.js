const express = require('express');
const router = express.Router();

// Rota para obter todos os clientes
router.get('/', (req, res) => {
    // A conexão com o banco de dados é injetada via index.js
    const connection = router.connection;

    if (!connection) {
        console.error('[ERRO FATAL API CLIENTES] Conexão com o banco de dados não estabelecida.');
        return res.status(500).json({ error: 'Erro interno do servidor: conexão com o banco de dados ausente.' });
    }

    const query = 'SELECT * FROM clientes';
    connection.query(query, (err, results) => {
        if (err) {
            console.error(`[ERRO API CLIENTES] Erro ao executar a query: ${err.message}`);
            console.error(`[ERRO API CLIENTES] Detalhes do erro:`, err); // Imprime o erro completo
            return res.status(500).json({ error: 'Erro ao buscar clientes no banco de dados.', details: err.message });
        }
        if (results.length === 0) {
            console.log('[DEBUG API CLIENTES] Nenhum cliente encontrado no banco de dados.');
            return res.status(200).json([]); // Retorna um array vazio se não houver clientes
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
