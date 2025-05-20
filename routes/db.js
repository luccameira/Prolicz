// /Prolicz/routes/db.js
const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'prolicz_user',       // novo usuário que você criou
  password: 'senha123',       // senha definida no HeidiSQL
  database: 'prolicz'         // nome do seu banco de dados
});

// Conectar e exibir erros se houver
connection.connect((err) => {
  if (err) {
    console.error('❌ Erro ao conectar ao banco de dados:', err.message);
  } else {
    console.log('✅ Conectado ao banco de dados MySQL!');
  }
});

module.exports = connection;
