const mysql = require('mysql2');
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'prolicz'
});

connection.connect(err => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
    return;
  }
  console.log('✅ Conectado ao banco de dados MySQL!');
});

module.exports = {
  callback: connection,
  promise: connection.promise()
};

