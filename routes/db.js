const mysql = require('mysql2');
require('dotenv').config({ path: __dirname + '/../.env' });

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

// Testa conexão (callback)
connection.connect((err) => {
  if (err) {
    console.error('❌ Erro ao conectar ao banco de dados:', err.message);
  } else {
    console.log('✅ Conectado ao banco de dados MySQL!');
  }
});

// Exporta versões para callback e promise
module.exports = {
  callback: connection,
  promise: connection.promise()
};
