const mysql = require('mysql');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // ou '123' se estiver diferente
  database: 'prolicz'
});

connection.connect(err => {
  if (err) throw err;
  console.log('✅ Conectado ao banco de dados MySQL!');
});

module.exports = connection;
