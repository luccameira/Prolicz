const express = require('express');
const path = require('path');
const cors = require('cors'); // Importe o pacote cors
const app = express();
const port = 3000;

// Importe as rotas
const produtosRoutes = require('./routes/produtos');
const pedidosRoutes = require('./routes/pedidos');
const usuariosRoutes = require('./routes/usuarios');
// NOVA LINHA ADICIONADA: Importa as rotas de clientes
const clientesRoutes = require('./routes/clientes'); 

// Configura o CORS para permitir requisições de outras origens (se necessário, ajuste a origem)
app.use(cors());

// Middleware para parsear JSON no corpo das requisições
app.use(express.json());

// Servir arquivos estáticos (HTML, CSS, JS do frontend)
app.use(express.static(path.join(__dirname)));

// Rotas da API
app.use('/api/produtos', produtosRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/usuarios', usuariosRoutes);
// NOVA LINHA ADICIONADA: Usa as rotas de clientes para /api/clientes
app.use('/api/clientes', clientesRoutes); 


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
