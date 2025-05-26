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

// Configuração do multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, pastaUpload);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const cpfBase = req.body.cpf || req.body.cpf_ajudante || req.params.cpf || 'desconhecido';
    const nome = `${cpfBase.replace(/\D/g, '')}-${file.fieldname}${ext}`;
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
      ficha_integracao: motorista.ficha_integracao,
      foto_caminhao: motorista.foto_caminhao
    });

  } catch (err) {
    console.error('Erro ao buscar motorista:', err);
    res.status(500).json({ erro: 'Erro ao buscar motorista' });
  }
});

// POST /api/motoristas → Cadastra motorista e opcionalmente o ajudante
router.post('/', upload.fields([
  { name: 'foto_documento', maxCount: 1 },
  { name: 'ficha_integracao', maxCount: 1 },
  { name: 'foto_caminhao', maxCount: 1 },
  { name: 'documento_ajudante', maxCount: 1 },
  { name: 'ficha_ajudante', maxCount: 1 }
]), async (req, res) => {
  const { cpf, nome, placa, cpf_ajudante, nome_ajudante } = req.body;

  const fotoDocumento = req.files['foto_documento']?.[0]?.filename || null;
  const fichaMotorista = req.files['ficha_integracao']?.[0]?.filename || null;
  const fotoCaminhao = req.files['foto_caminhao']?.[0]?.filename || null;
  const dataFormulario = new Date().toISOString().slice(0, 10);

  const docAjudante = req.files['documento_ajudante']?.[0]?.filename || null;
  const fichaAjudante = req.files['ficha_ajudante']?.[0]?.filename || null;

  try {
    const [motoristaExistente] = await db.query('SELECT * FROM motoristas WHERE cpf = ?', [cpf]);

    if (!motoristaExistente.length) {
      // Novo motorista → todos os campos obrigatórios
      if (!cpf || !nome || !placa || !fotoDocumento || !fichaMotorista || !fotoCaminhao) {
        return res.status(400).json({ erro: 'Campos obrigatórios do motorista faltando (novo cadastro)' });
      }

      await db.query(`
        INSERT INTO motoristas 
        (cpf, nome, placa, foto_documento, ficha_integracao, foto_caminhao, data_ultimo_formulario)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [cpf, nome, placa, fotoDocumento, fichaMotorista, fotoCaminhao, dataFormulario]);

    } else {
      // Motorista já existe → apenas atualiza placa e foto do caminhão
      if (!placa || !fotoCaminhao) {
        return res.status(400).json({ erro: 'Campos obrigatórios faltando para motorista existente' });
      }

      await db.query(`
        UPDATE motoristas 
        SET placa = ?, foto_caminhao = ?, data_ultimo_formulario = ?
        WHERE cpf = ?
      `, [placa, fotoCaminhao, dataFormulario, cpf]);
    }

    // Cadastro do ajudante (opcional)
    if (cpf_ajudante && nome_ajudante) {
      await db.query(`
        INSERT INTO ajudantes (cpf, nome, documento, ficha_integracao)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          nome = VALUES(nome),
          documento = VALUES(documento),
          ficha_integracao = VALUES(ficha_integracao)
      `, [cpf_ajudante, nome_ajudante, docAjudante, fichaAjudante]);
    }

    res.json({ sucesso: true, mensagem: 'Cadastro realizado com sucesso' });

  } catch (err) {
    console.error('Erro ao cadastrar motorista ou ajudante:', err);
    res.status(500).json({ erro: 'Erro ao salvar os dados' });
  }
});
