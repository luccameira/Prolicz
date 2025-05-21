const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'prolicz'
});

// Conecta ao banco (para debug e garantir conectividade)
connection.connect(err => {
  if (err) {
    console.error('❌ Erro ao conectar ao banco de dados:', err);
    return;
  }
  console.log('✅ Conectado ao banco de dados MySQL!');
});

// Exporta conexão normal e modo promise
module.exports = {
  callback: connection,
  promise: connection.promise()
};
