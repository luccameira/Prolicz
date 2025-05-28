const express = require('express');
const router = express.Router();

// POST /api/produtos/novo
router.post('/novo', async (req, res) => {
  const { nome, unidade } = req.body;

  if (!nome || !unidade) {
    return res.status(400).json({ erro: 'Nome e unidade são obrigatórios.' });
  }

  try {
    const sql = `INSERT INTO produtos (nome, unidade, data_cadastro) VALUES (?, ?, NOW())`;
    await router.connection.query(sql, [nome, unidade]);
    res.status(201).json({ mensagem: 'Produto cadastrado com sucesso.' });
  } catch (err) {
    console.error('Erro ao cadastrar produto:', err);
    res.status(500).json({ erro: 'Erro ao cadastrar produto.' });
  }
});

// GET /api/produtos
router.get('/', async (req, res) => {
  const { ordenar } = req.query;
  let orderBy = 'data_cadastro DESC';

  if (ordenar === 'mais_antigo') orderBy = 'data_cadastro ASC';
  else if (ordenar === 'nome_az') orderBy = 'nome ASC';
  else if (ordenar === 'nome_za') orderBy = 'nome DESC';

  try {
    const [produtos] = await router.connection.query(`SELECT id, nome, unidade, data_cadastro FROM produtos ORDER BY ${orderBy}`);
    res.json(produtos);
  } catch (err) {
    console.error('Erro ao buscar produtos:', err);
    res.status(500).json({ erro: 'Erro ao buscar produtos.' });
  }
});

module.exports = router;


