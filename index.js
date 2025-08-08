const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

const connection = require('./db'); // ✅ conexão com callback

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// ✅ Permite acesso à pasta uploads/tickets (para visualizar imagens do ticket da balança)
app.use('/uploads/tickets', express.static(path.join(__dirname, 'uploads/tickets')));

// Rotas com conexão injetada
function withConnection(routePath) {
  const router = require(routePath);
  router.connection = connection; // ✅ conexão callback
  return router;
}

app.use('/api/clientes', withConnection('./routes/clientes'));
app.use('/api/pedidos', withConnection('./routes/pedidos'));
app.use('/api/produtos', withConnection('./routes/produtos'));
app.use('/api/usuarios', withConnection('./routes/usuarios'));
app.use('/api/motoristas', require('./routes/motoristas')); // rota sem injeção
app.use('/api/login', require('./routes/login'));

// Redirecionamentos para páginas HTML
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

// Redirecionamento padrão
app.get('/', (req, res) => {
  res.redirect('/vendas');
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});
