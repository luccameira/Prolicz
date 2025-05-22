const mysql = require('mysql');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root', // Seu usuário do MySQL
    password: '', // Sua senha do MySQL (que você deixou vazia)
    database: 'meu_projeto_db' // <--- Mude para o nome do banco de dados que você criou!
});

// Tentar conectar ao banco de dados MySQL ao iniciar.
connection.connect(err => {
    if (err) {
        console.error('[ERRO FATAL DB] Erro ao conectar ao banco de dados MySQL: ' + err.stack);
        return; // Impede que o servidor inicie sem conexão com o DB
    }
    console.log('Conectado ao banco de dados MySQL!');
});

module.exports = connection;
