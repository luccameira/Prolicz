const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

const connection = require('./db');

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// ✅ Torna pública a pasta onde os tickets da balança são salvos
app.use('/uploads/tickets', express.static(path.join(__dirname, 'uploads', 'tickets')));

// Rotas com conexão injetada
function withConnection(routePath) {
  const router = require(routePath);
  router.connection = connection;
  return router;
}

app.use('/api/clientes', withConnection('./routes/clientes'));
app.use('/api/pedidos', withConnection('./routes/pedidos'));
app.use('/api/produtos', withConnection('./routes/produtos')); // se necessário
app.use('/api/usuarios', withConnection('./routes/usuarios')); // se necessário

// Nova rota para motoristas (sem conexão manual, pois não é necessário)
app.use('/api/motoristas', require('./routes/motoristas'));

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
