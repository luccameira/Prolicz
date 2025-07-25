const express = require('express');
const router = express.Router();
const db = require('../db');

// Cadastrar novo usuário
router.post('/', async (req, res) => {
  const { nome, email, senha, tipo, permissoes } = req.body;
  const usuarioLogado = req.headers['usuario-logado'] ? JSON.parse(req.headers['usuario-logado']) : null;

  if (!nome || !email || !senha || !tipo) {
    return res.status(400).send('Campos obrigatórios ausentes.');
  }

  if (usuarioLogado?.tipo === 'coordenador' && (tipo === 'coordenador' || tipo === 'administrador')) {
    return res.status(403).send('Coordenador não pode criar esse tipo de usuário.');
  }

  try {
    const [emailCheck] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);

    if (emailCheck.length > 0) {
      return res.status(409).send('Este e-mail já está em uso. Por favor, utilize outro.');
    }

    let permissoesFormatadas = [];

    if (Array.isArray(permissoes) && permissoes.length > 0) {
      permissoesFormatadas = permissoes;
    }

    if (tipo === 'master') {
      permissoesFormatadas.push('editar_usuario', 'excluir_usuario');
    }

    permissoesFormatadas = JSON.stringify(permissoesFormatadas);

    const sql = 'INSERT INTO usuarios (nome, email, senha, tipo, permissoes) VALUES (?, ?, ?, ?, ?)';
    const values = [nome, email, senha, tipo, permissoesFormatadas];

    await db.query(sql, values);

    res.send('Usuário cadastrado com sucesso!');
  } catch (err) {
    console.error('Erro ao cadastrar usuário:', err);
    res.status(500).send('Erro ao tentar cadastrar usuário.');
  }
});

// Listar todos os usuários
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, nome, email, tipo FROM usuarios ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).send('Erro ao buscar usuários.');
  }
});

// Excluir usuário
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const usuarioLogado = req.headers['usuario-logado'] ? JSON.parse(req.headers['usuario-logado']) : null;

  try {
    // Verifica se o usuário a ser excluído existe e qual o tipo
    const [rows] = await db.query('SELECT tipo FROM usuarios WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).send('Usuário não encontrado.');
    }

    const tipoAlvo = rows[0].tipo;

    // Regra: Coordenador não pode excluir outro coordenador nem administrador
    if (usuarioLogado?.tipo === 'coordenador' && (tipoAlvo === 'coordenador' || tipoAlvo === 'administrador')) {
      return res.status(403).send('Você não tem permissão para excluir esse tipo de usuário.');
    }

    const [resultado] = await db.query('DELETE FROM usuarios WHERE id = ?', [id]);

    if (resultado.affectedRows === 0) {
      return res.status(404).send('Usuário não encontrado.');
    }

    res.send('Usuário excluído com sucesso.');
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    res.status(500).send('Erro ao tentar excluir usuário.');
  }
});

module.exports = router;
