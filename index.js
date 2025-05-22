const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Importa o db.js da raiz do projeto. Isso está correto.
const connection = require('./db');

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// *** ATENÇÃO AQUI: Servir arquivos estáticos de uma pasta 'public' (vamos criá-la) ***
// Isso é uma prática comum para arquivos HTML, CSS, JS do frontend.
// Primeiro tentamos na raiz da pasta. Se não funcionar, tentaremos com uma pasta 'public'.
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

// Rotas explícitas para as páginas HTML
// Estas rotas SEMPRE devem vir ANTES de qualquer rota 'catch-all' ou de erro.
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


// Redirecionamento padrão (quando acessar http://localhost:3000/)
app.get('/', (req, res) => {
    res.redirect('/vendas');
});

// Iniciar servidor
app.listen(port, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});
