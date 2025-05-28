const express = require('express');
const router = express.Router();
const db = require('../db').promise();

// POST /api/produtos/novo - Cadastrar novo produto
router.post('/novo', async (req, res) => {
  const { nome_produto, unidade } = req.body;

  if (!nome_produto || !unidade) {
    return res.status(400).json({ erro: 'Nome e unidade são obrigatórios.' });
  }

  try {
    const sql = `INSERT INTO produtos (nome_produto, unidade, data_cadastro) VALUES (?, ?, NOW())`;
    await db.execute(sql, [nome_produto, unidade]);
    res.status(201).json({ mensagem: 'Produto cadastrado com sucesso.' });
  } catch (erro) {
    console.error('Erro ao cadastrar produto:', erro);
    res.status(500).json({ erro: 'Erro ao cadastrar produto.' });
  }
});

// GET /api/produtos - Listar produtos com ordenação
router.get('/', async (req, res) => {
  const { ordenar } = req.query;
  let orderBy = 'data_cadastro DESC';

  if (ordenar === 'mais_antigo') orderBy = 'data_cadastro ASC';
  else if (ordenar === 'nome_az') orderBy = 'nome_produto ASC';
  else if (ordenar === 'nome_za') orderBy = 'nome_produto DESC';

  try {
    const [produtos] = await db.execute(`SELECT * FROM produtos ORDER BY ${orderBy}`);
    res.json(produtos);
  } catch (erro) {
    console.error('Erro ao buscar produtos:', erro);
    res.status(500).json({ erro: 'Erro ao buscar produtos.' });
  }
});

module.exports = router;

