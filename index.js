const express = require('express');
const path = require('path');
const session = require('express-session');
const app = express();
const port = 3000;

const connection = require('./db'); // conexão com banco

// Middleware para usar sessão
app.use(session({
  secret: 'proliczsecret',
  resave: false,
  saveUninitialized: false
}));

// Middlewares para JSON e form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname)));
app.use('/uploads/tickets', express.static(path.join(__dirname, 'uploads/tickets')));

// ⚠️ BLOQUEIO DE ROTAS DESATIVADO TEMPORARIAMENTE ⚠️
// Se quiser ativar depois, é só remover os comentários abaixo.
/*
app.use((req, res, next) => {
  if (!req.session.usuarioLogado &&
      req.path !== '/login' &&
      !req.path.endsWith('.html') &&
      !req.path.startsWith('/api/')
  ) {
    return res.redirect('/login.html');
  }
  next();
});
*/

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
app.use('/api/motoristas', require('./routes/motoristas'));

// Rota de login (mantida, mas sem obrigatoriedade de uso)
app.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  try {
    const [rows] = await connection.execute(
      'SELECT id, nome, email, tipo, permissoes FROM usuarios WHERE email = ? AND senha = ?',
      [email, senha]
    );

    if (rows.length === 1) {
      const usuario = rows[0];
      req.session.usuarioLogado = usuario;
      res.json({ usuario });
    } else {
      res.status(401).json({ erro: 'Usuário ou senha inválidos' });
    }
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ erro: 'Erro interno no servidor' });
  }
});

// Rotas HTML
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
