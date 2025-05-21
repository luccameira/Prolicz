const express = require('express');
const router = express.Router();
const db = require('./db');

// Rota para cadastrar um novo usuário
router.post('/', (req, res) => {
  const { nome, email, senha, tipo, permissoes } = req.body;

  if (!nome || !email || !senha || !tipo) {
    return res.status(400).send('Campos obrigatórios ausentes.');
  }

  // Garantir permissões para usuários do tipo 'master'
  let permissoesFormatadas = Array.isArray(permissoes) ? permissoes : [];

  if (tipo === 'master') {
    // Se o tipo for master, adiciona permissões 'editar_usuario' e 'excluir_usuario'
    permissoesFormatadas.push('editar_usuario', 'excluir_usuario');
  }

  // Transformar as permissões em JSON (caso seja um array de permissões)
  permissoesFormatadas = JSON.stringify(permissoesFormatadas);

  const sql = 'INSERT INTO usuarios (nome, email, senha, tipo, permissoes) VALUES (?, ?, ?, ?, ?)';
  const values = [nome, email, senha, tipo, permissoesFormatadas];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Erro ao inserir usuário:', err);
      return res.status(500).send('Erro ao tentar cadastrar usuário.');
    }
    res.send('Usuário cadastrado com sucesso!');
  });
});

module.exports = router;


