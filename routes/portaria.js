const express = require('express');
const router = express.Router();
const db = require('../db');

// Exemplo de rota básica
router.get('/', (req, res) => {
  res.send('Rota de portaria funcionando.');
});

// PUT /api/tarefas-portaria/:id/saida - Confirma a saída do cliente
router.put('/:id/saida', async (req, res) => {
  const idTarefa = req.params.id;

  try {
    await db.query('UPDATE tarefas_portaria SET status = ? WHERE id = ?', ['finalizado', idTarefa]);
    res.json({ mensagem: 'Saída registrada com sucesso.' });
  } catch (erro) {
    console.error('Erro ao registrar saída:', erro);
    res.status(500).json({ erro: 'Erro ao registrar saída.' });
  }
});

module.exports = router;
