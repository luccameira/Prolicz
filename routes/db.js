const mysql = require('mysql2/promise'); // Importa a versão com suporte a Promises

// Cria um pool de conexões com suporte nativo a async/await
const connection = mysql.createPool({
  host: 'localhost',         // Endereço do servidor MySQL
  user: 'root',              // Usuário do MySQL (ajuste se necessário)
  password: '',              // Senha do MySQL (preencha se você usa senha)
  database: 'prolicz',       // Nome do banco que você está usando
  waitForConnections: true,  // Espera na fila se todas as conexões estiverem em uso
  connectionLimit: 10,       // Máximo de conexões simultâneas
  queueLimit: 0              // Sem limite de fila (0 = infinito)
});

module.exports = connection; // Exporta para uso nos outros arquivos


