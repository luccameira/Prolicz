const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Conecta ao banco de dados MySQL.
const connection = require('./db');

// Permite que o servidor entenda informações enviadas de formulários (JSON e URL-encoded).
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// *** ATENÇÃO AQUI: Esta linha é CRÍTICA para servir seus arquivos HTML, CSS, JS. ***
// Ela diz ao servidor: "Qualquer arquivo HTML, CSS ou JavaScript que estiver
// na mesma pasta onde este 'index.js' está, pode ser acessado diretamente."
// Isso é o que permite que 'clientes.html' seja encontrado.
app.use(express.static(path.join(__dirname)));

// Esta parte conecta as "engrenagens" do seu sistema (as rotas API, como /api/clientes).
function conectarRotas(caminhoDoArquivo) {
    const rota = require(caminhoDoArquivo);
    rota.connection = connection;
    return rota;
}

app.use('/api/clientes', conectarRotas('./routes/clientes'));
app.use('/api/pedidos', conectarRotas('./routes/pedidos'));
app.use('/api/produtos', conectarRotas('./routes/produtos'));
app.use('/api/usuarios', conectarRotas('./routes/usuarios'));

// ESTAS SÃO AS LINHAS QUE DIZEM AO SERVIDOR ONDE ENCONTRAR AS PÁGINAS HTML.
// Elas são importantes porque permitem que você acesse, por exemplo,
// http://localhost:3000/clientes (sem o .html no final).
app.get('/clientes', (req, res) => {
    // Manda o arquivo 'clientes.html' que está na mesma pasta do 'index.js'.
    res.sendFile(path.join(__dirname, 'clientes.html'));
});

app.get('/visualizar-venda', (req, res) => {
    res.sendFile(path.join(__dirname, 'visualizar-venda.html'));
});
app.get('/vendas', (req, res) => {
    res.sendFile(path.join(__dirname, 'vendas.html'));
});
app.get('/nova-venda', (req, res) => {
    res.sendFile(path.join(__dirname, 'nova-venda.html'));
});
app.get('/editar-venda', (req, res) => {
    res.sendFile(path.join(__dirname, 'editar-venda.html'));
});
app.get('/tarefas-portaria.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'tarefas-portaria.html'));
});
app.get('/tarefas-conferencia.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'tarefas-conferencia.html'));
});
app.get('/tarefas-financeiro.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'tarefas-financeiro.html'));
});
app.get('/tarefas-nf.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'tarefas-nf.html'));
});
app.get('/tarefas-liberacao.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'tarefas-liberacao.html'));
});

// Se alguém acessar só http://localhost:3000/ (sem nada depois), ele vai para a página de vendas.
app.get('/', (req, res) => {
    res.redirect('/vendas');
});

// Inicia o servidor para que seu site funcione.
app.listen(port, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});
