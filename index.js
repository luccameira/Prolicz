// index.js
const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

const connection = require('./db'); // conexão com banco

// Middlewares para JSON e form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname)));

// Permitir acesso à pasta uploads
app.use('/uploads/tickets', express.static(path.join(__dirname, 'uploads/tickets')));

// Função para injetar conexão nas rotas
function withConnection(routePath) {
  const router = require(routePath);
  router.connection = connection;
  return router;
}

// Rotas da API
app.use('/api/clientes', withConnection('./routes/clientes'));
app.use('/api/pedidos', withConnection('./routes/pedidos'));
app.use('/api/produtos', withConnection('./routes/produtos'));
app.use('/api/usuarios', withConnection('./routes/usuarios'));
app.use('/api/motoristas', require('./routes/motoristas')); // esta rota não usa conexão

// Rotas de páginas HTML
app.get('/visualizar-venda', (req, res) => {
  res.sendFile(path.join(__dirname, 'visualizar-venda.html'));
});
app.get('/nova-venda', (req, res) => {
  res.sendFile(path.join(__dirname, 'nova-venda.html'));
});
app.get('/editar-venda', (req, res) => {
  res.sendFile(path.join(__dirname, 'editar-venda.html'));
});
app.get('/vendas', (req, res) => {
  res.sendFile(path.join(__dirname, 'vendas.html'));
});
app.get('/usuarios.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'usuarios.html'));
});
app.get('/tarefas-portaria.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'tarefas-portaria.html'));
});
app.get('/tarefas-carga.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'tarefas-carga.html'));
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

// Rota padrão
app.get('/', (req, res) => {
  res.redirect('/vendas');
});

// Inicializa servidor
app.listen(port, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});
