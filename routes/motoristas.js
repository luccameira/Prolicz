const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const db = require('../db');

// Cria a pasta de uploads, se necessário
const pastaUpload = path.join(__dirname, '..', 'uploads', 'motoristas');
if (!fs.existsSync(pastaUpload)) {
  fs.mkdirSync(pastaUpload, { recursive: true });
}

// Configuração do multer para salvar os arquivos com nome baseado no CPF
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, pastaUpload);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const cpf = req.body.cpf || req.params.cpf || 'desconhecido';
    const nome = `${cpf.replace(/\D/g, '')}-${file.fieldname}${ext}`;
    cb(null, nome);
  }
});

const upload = multer({ storage });

// Utilitário para verificar validade do formulário (90 dias)
function cadastroVencido(dataUltimoFormulario) {
  if (!dataUltimoFormulario) return true;
  const hoje = new Date();
  const validade = new Date(dataUltimoFormulario);
  validade.setDate(validade.getDate() + 90);
  return validade < hoje;
}

// GET /api/motoristas/:cpf → Busca motorista
router.get('/:cpf', async (req, res) => {
  try {
    const cpfLimpo = req.params.cpf.replace(/\D/g, '');

    const [resultado] = await db.query(`
      SELECT * FROM motoristas 
      WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?
    `, [cpfLimpo]);

    if (!resultado || resultado.length === 0) {
      return res.status(404).json({ encontrado: false });
    }

    const motorista = resultado[0];
    const vencido = cadastroVencido(motorista.data_ultimo_formulario);

    return res.status(200).json({
      encontrado: true,
      cpf: motorista.cpf,
      nome: motorista.nome,
      cadastroVencido: vencido,
      foto_documento: motorista.foto_documento,
      foto_formulario: motorista.foto_formulario,
      foto_caminhao: motorista.foto_caminhao
    });

  } catch (err) {
    console.error('Erro ao buscar motorista:', err);
    res.status(500).json({ erro: 'Erro ao buscar motorista' });
  }
});

// POST /api/motoristas → Cadastra motorista novo
router.post('/', upload.fields([
  { name: 'foto_documento', maxCount: 1 },
  { name: 'foto_formulario', maxCount: 1 },
  { name: 'foto_caminhao', maxCount: 1 }
]), async (req, res) => {
  const { cpf, nome } = req.body;
  const fotoDocumento = req.files['foto_documento']?.[0]?.filename || null;
  const fotoFormulario = req.files['foto_formulario']?.[0]?.filename || null;
  const fotoCaminhao = req.files['foto_caminhao']?.[0]?.filename || null;
  const dataFormulario = new Date().toISOString().slice(0, 10);

  if (!cpf || !nome || !fotoDocumento || !fotoFormulario || !fotoCaminhao) {
    return res.status(400).json({ erro: 'Campos obrigatórios faltando' });
  }

  try {
    await db.query(`
      INSERT INTO motoristas 
      (cpf, nome, foto_documento, foto_formulario, foto_caminhao, data_ultimo_formulario)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [cpf, nome, fotoDocumento, fotoFormulario, fotoCaminhao, dataFormulario]);

    res.json({ sucesso: true, mensagem: 'Motorista cadastrado com sucesso' });
  } catch (err) {
    console.error('Erro ao cadastrar motorista:', err);
    res.status(500).json({ erro: 'Erro ao cadastrar motorista' });
  }
});

// PUT /api/motoristas/:cpf/formulario → Atualiza ficha e caminhão
router.put('/:cpf/formulario', upload.fields([
  { name: 'foto_formulario', maxCount: 1 },
  { name: 'foto_caminhao', maxCount: 1 }
]), async (req, res) => {
  const fotoFormulario = req.files['foto_formulario']?.[0]?.filename || null;
  const fotoCaminhao = req.files['foto_caminhao']?.[0]?.filename || null;
  const dataFormulario = new Date().toISOString().slice(0, 10);

  if (!fotoFormulario || !fotoCaminhao) {
    return res.status(400).json({ erro: 'Fotos obrigatórias não enviadas' });
  }

  try {
    const [resultado] = await db.query('SELECT * FROM motoristas WHERE cpf = ?', [req.params.cpf]);
    if (resultado.length === 0) {
      return res.status(404).json({ erro: 'Motorista não encontrado' });
    }

    await db.query(`
      UPDATE motoristas 
      SET foto_formulario = ?, foto_caminhao = ?, data_ultimo_formulario = ? 
      WHERE cpf = ?
    `, [fotoFormulario, fotoCaminhao, dataFormulario, req.params.cpf]);

    res.json({ sucesso: true, mensagem: 'Formulário atualizado com sucesso' });
  } catch (err) {
    console.error('Erro ao atualizar formulário:', err);
    res.status(500).json({ erro: 'Erro ao atualizar formulário' });
  }
});

module.exports = router;
