const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Conecta ao banco de dados MySQL.
const connection = require('./db');

// Permite que o servidor entenda informações enviadas de formulários (JSON e URL-encoded).
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração para servir arquivos estáticos (HTML, CSS, JS)
const staticPath = path.join(__dirname);
console.log(`[DEBUG] Caminho dos arquivos estáticos configurado para: ${staticPath}`);
app.use(express.static(staticPath));

// Esta parte conecta as "engrenagens" do seu sistema (as rotas API).
function conectarRotas(caminhoDoArquivo) {
    const rota = require(caminhoDoArquivo);
    rota.connection = connection;
    return rota;
}

app.use('/api/clientes', conectarRotas('./routes/clientes'));
app.use('/api/pedidos', conectarRotas('./routes/pedidos'));
app.use('/api/produtos', conectarRotas('./routes/produtos'));
app.use('/api/usuarios', conectarRotas('./routes/usuarios'));

// Rotas que servem as páginas HTML.
app.get('/clientes', (req, res) => {
    const filePath = path.join(__dirname, 'clientes.html');
    console.log(`[DEBUG] Requisição recebida para /clientes.`);
    console.log(`[DEBUG] Tentando enviar o arquivo: ${filePath}`);
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`[ERROR] Erro ao enviar clientes.html: ${err.message}`);
            console.error(`[ERROR] Detalhes do erro (código): ${err.code}`);
            // Se o erro for 'ENOENT' (arquivo não encontrado), é crucial.
            if (err.code === 'ENOENT') {
                console.error(`[ERROR] O arquivo clientes.html NÃO FOI ENCONTRADO no caminho especificado: ${filePath}`);
            }
            res.status(500).send('Erro interno do servidor ao carregar a página de clientes.');
        } else {
            console.log(`[DEBUG] clientes.html enviado com sucesso para ${req.url}`);
        }
    });
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

app.get('/', (req, res) => {
    res.redirect('/vendas');
});

// Inicia o servidor.
app.listen(port, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});
