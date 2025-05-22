const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// CORRIGIDO: Importa o db.js da raiz do projeto, que é o correto
const connection = require('./db');

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve arquivos estáticos da raiz do projeto
app.use(express.static(path.join(__dirname)));

// Rotas com conexão injetada
function withConnection(routePath) {
    const router = require(routePath);
    router.connection = connection;
    return router;
}

app.use('/api/clientes', withConnection('./routes/clientes'));
app.use('/api/pedidos', withConnection('./routes/pedidos'));
app.use('/api/produtos', withConnection('./routes/produtos'));
app.use('/api/usuarios', withConnection('./routes/usuarios'));

// Redirecionamentos para páginas HTML (existentes)
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

// Rota EXPLICITA para a página de clientes - ISSO DEVE RESOLVER O "CANNOT GET"
app.get('/clientes', (req, res) => {
    res.sendFile(path.join(__dirname, 'clientes.html'));
});

// Redirecionamentos para novas páginas de tarefas
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

// Redirecionamento padrão
app.get('/', (req, res) => {
    res.redirect('/vendas');
});

// Iniciar servidor
app.listen(port, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});
