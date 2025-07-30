// routes/login.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// Login
router.post('/', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).send('E-mail e senha são obrigatórios.');
  }

  try {
    const [rows] = await db.query('SELECT id, nome, email, tipo, permissoes FROM usuarios WHERE email = ? AND senha = ?', [email, senha]);

    if (rows.length === 0) {
      return res.status(401).send('E-mail ou senha incorretos.');
    }

    const usuario = rows[0];
    usuario.permissoes = JSON.parse(usuario.permissoes || '[]');

    res.json(usuario);
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).send('Erro no servidor durante o login.');
  }
});

module.exports = router;
