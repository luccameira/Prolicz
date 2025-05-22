const mysql = require('mysql');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'usuario_projeto', // <--- Use o usuário que você criou
    password: 'MinhaSenhaSegura123!', // <--- Use a senha forte que você definiu para 'usuario_projeto'
    database: 'meu_projeto_db' // <--- O banco de dados do seu projeto
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
