// ... (outros requires no topo)
const express = require('express');
const pedidosRoutes = require('./routes/pedidos'); // Certifique-se que o caminho está correto

const app = express();
const port = 3000;

app.use(express.json()); // Para parsear JSON do corpo das requisições

// Configura o Express para servir arquivos estáticos da pasta raiz do seu projeto
app.use(express.static(__dirname)); // Isso faz com que arquivos como tarefas-nf.html, layout.css, etc., sejam acessíveis.

// Rotas da API
app.use('/api/pedidos', pedidosRoutes);
// ... (outras rotas)

// ... (início do servidor)
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
