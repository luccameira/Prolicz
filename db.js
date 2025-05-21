// db.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // ajuste se necessário
  database: 'prolicz',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection()
  .then(() => {
    console.log('✅ Conectado ao banco de dados MySQL!');
  })
  .catch((err) => {
    console.error('❌ Erro ao conectar no banco de dados:', err);
  });

module.exports = pool;
