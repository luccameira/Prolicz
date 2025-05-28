const express = require('express');
const router = express.Router();

// POST /api/produtos/novo
router.post('/novo', (req, res) => {
  const { nome_produto, unidade } = req.body;

  if (!nome_produto || !unidade) {
    return res.status(400).json({ erro: 'Nome e unidade são obrigatórios.' });
  }

  const sql = `INSERT INTO produtos (nome_produto, unidade, data_cadastro) VALUES (?, ?, NOW())`;
  router.connection.query(sql, [nome_produto, unidade], (err, result) => {
    if (err) {
      console.error('Erro ao cadastrar produto:', err);
      return res.status(500).json({ erro: 'Erro ao cadastrar produto.' });
    }
    res.status(201).json({ mensagem: 'Produto cadastrado com sucesso.' });
  });
});

// GET /api/produtos
router.get('/', (req, res) => {
  const { ordenar } = req.query;
  let orderBy = 'data_cadastro DESC';

  if (ordenar === 'mais_antigo') orderBy = 'data_cadastro ASC';
  else if (ordenar === 'nome_az') orderBy = 'nome_produto ASC';
  else if (ordenar === 'nome_za') orderBy = 'nome_produto DESC';

  const sql = `SELECT * FROM produtos ORDER BY ${orderBy}`;
  router.connection.query(sql, (err, results) => {
    if (err) {
      console.error('Erro ao buscar produtos:', err);
      return res.status(500).json({ erro: 'Erro ao buscar produtos.' });
    }
    res.json(results);
  });
});

module.exports = router;

