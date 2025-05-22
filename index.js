const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Conecta ao banco de dados MySQL.
const connection = require('./db');

// Permite que o servidor entenda informações enviadas de formulários (JSON e URL-encoded).
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Diz ao servidor para procurar arquivos HTML, CSS, JavaScript direto na pasta principal do projeto.
app.use(express.static(path.join(__dirname)));

// Esta parte conecta as "engrenagens" do seu sistema (as rotas API).
function conectarRotas(caminhoDoArquivo) {
    const rota = require(caminhoDoArquivo);
    rota.connection = connection;
    return rota;
}

app.use('/api/clientes', conectarRotas('./routes/clientes'));
app.use('/api/pedidos', conectarRotas('./routes/pedidos')); // <<--- AQUI ESTÁ A LINHA CORRIGIDA
app.use('/api/produtos', conectarRotas('./routes/produtos'));
app.use('/api/usuarios', conectarRotas('./routes/usuarios'));

// Estas são as rotas que servem as páginas HTML.
// A ordem é importante: as rotas mais específicas (como /clientes) vêm antes de rotas mais genéricas.
app.get('/clientes', (req, res) => {
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

// Se alguém acessar só http://localhost:3000/, ele vai para a página de vendas.
app.get('/', (req, res) => {
    res.redirect('/vendas');
});

// Inicia o servidor para que seu site funcione.
app.listen(port, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});
