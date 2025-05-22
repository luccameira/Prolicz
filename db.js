const mysql = require('mysql');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root', // Seu usuário do MySQL
    password: '', // Sua senha do MySQL (provavelmente vazia se for padrão)
    database: 'prolicz' // Seu banco de dados
});

// Tentar conectar e logar o resultado
connection.connect(err => {
    if (err) {
        console.error('[ERRO DB.JS] Erro ao conectar ao banco de dados MySQL:');
        console.error(err); // Imprime o erro completo
        console.error(`[ERRO DB.JS] Código do erro: ${err.code}`);
        console.error(`[ERRO DB.JS] Mensagem de erro: ${err.sqlMessage || err.message}`);
        return;
    }
    console.log('Conectado ao banco de dados MySQL com sucesso via db.js!');
    // Se a conexão for bem-sucedida, tente uma query simples
    connection.query('SELECT 1 + 1 AS solution', (error, results) => {
        if (error) {
            console.error('[ERRO DB.JS] Erro ao executar query de teste:', error);
        } else {
            console.log('[DEBUG DB.JS] Query de teste executada com sucesso. Solução:', results[0].solution);
        }
        connection.end(); // Fechar a conexão após o teste
    });
});

module.exports = connection; // 
