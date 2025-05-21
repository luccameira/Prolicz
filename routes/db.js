const mysql = require('mysql2');

// Cria a conexão com o banco de dados
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // deixe vazio se não tiver senha
  database: 'prolicz'
});

// Conecta ao banco e exibe no terminal
connection.connect(err => {
  if (err) {
    console.error('❌ Erro ao conectar ao banco de dados:', err);
    return;
  }
  console.log('✅ Conectado ao banco de dados MySQL!');
});

// Exporta a conexão normal (callback) e em modo promise (async/await)
module.exports = {
  callback: connection,
  promise: connection.promise()
};

