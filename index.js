const express = require('express');
const path = require('path');
const cors = require('cors');
const app = express();
const port = 3000;

console.log('Iniciando index.js...');

// Importe as rotas
try {
    const produtosRoutes = require('./routes/produtos');
    console.log('Rotas de produtos carregadas com sucesso.');
    app.use('/api/produtos', produtosRoutes);
    console.log('Rota /api/produtos configurada.');
} catch (e) {
    console.error('ERRO ao carregar rotas de produtos:', e.message);
}

try {
    const pedidosRoutes = require('./routes/pedidos');
    console.log('Rotas de pedidos carregadas com sucesso.');
    app.use('/api/pedidos', pedidosRoutes);
    console.log('Rota /api/pedidos configurada.');
} catch (e) {
    console.error('ERRO ao carregar rotas de pedidos:', e.message);
}

try {
    const usuariosRoutes = require('./routes/usuarios');
    console.log('Rotas de usuários carregadas com sucesso.');
    app.use('/api/usuarios', usuariosRoutes);
    console.log('Rota /api/usuarios configurada.');
} catch (e) {
    console.error('ERRO ao carregar rotas de usuários:', e.message);
}

// Linhas para clientes - Adicionei logs para verificar se estão sendo carregadas
try {
    const clientesRoutes = require('./routes/clientes');
    console.log('Rotas de clientes carregadas com sucesso.'); // Log para clientes
    app.use('/api/clientes', clientesRoutes);
    console.log('Rota /api/clientes configurada.'); // Log para clientes
} catch (e) {
    console.error('ERRO CRÍTICO: Não foi possível carregar ou configurar as rotas de clientes:', e.message);
}

// Configura o CORS
app.use(cors());

// Middleware para parsear JSON
app.use(express.json());

// Servir arquivos estáticos (HTML, CSS, JS do frontend)
app.use(express.static(path.join(__dirname)));
console.log(`Servindo arquivos estáticos de: ${path.join(__dirname)}`);


// Rota para incluir layout (se você usa um script para isso)
app.get('/incluir-layout.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'incluir-layout.js'));
});

// Rotas para páginas HTML (se você as serve diretamente)
app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/clientes.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'clientes.html'));
});

app.get('/produtos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'produtos.html'));
});

app.get('/pedidos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'pedidos.html'));
});

app.get('/usuarios.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'usuarios.html'));
});

app.get('/novo-pedido.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'novo-pedido.html'));
});

app.get('/novo-produto.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'novo-produto.html'));
});

app.get('/novo-cliente.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'novo-cliente.html'));
});

app.get('/editar-cliente.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'editar-cliente.html'));
});

app.get('/visualizar-cliente.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'visualizar-cliente.html'));
});

app.get('/editar-produto.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'editar-produto.html'));
});

app.get('/editar-pedido.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'editar-pedido.html'));
});

// Tarefas Simuladas
app.get('/tarefas-simuladas.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'tarefas-simuladas.html'));
});

// Iniciar o servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
