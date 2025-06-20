CREATE DATABASE IF NOT EXISTS prolicz;
USE prolicz;

CREATE TABLE IF NOT EXISTS clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo_pessoa VARCHAR(20),
  documento VARCHAR(30),
  nome_fantasia VARCHAR(100),
  situacao_tributaria VARCHAR(50),
  codigo_fiscal VARCHAR(10),
  cep VARCHAR(10),
  endereco VARCHAR(100),
  numero VARCHAR(10),
  complemento VARCHAR(100),
  bairro VARCHAR(50),
  cidade VARCHAR(50),
  estado VARCHAR(2)
);

CREATE TABLE IF NOT EXISTS contatos_cliente (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT,
  nome VARCHAR(100),
  telefone VARCHAR(20),
  email VARCHAR(100),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS produtos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100),
  unidade_medida ENUM('Kg', 'Unidade')
);

CREATE TABLE IF NOT EXISTS produtos_autorizados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT,
  produto_id INT,
  valor_unitario DECIMAL(10,2),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prazos_pagamento (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT,
  dias INT,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100),
  email VARCHAR(100),
  senha VARCHAR(255),
  tipo_usuario VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo_pedido ENUM('Venda', 'Coleta'),
  cliente_id INT,
  empresa VARCHAR(100),
  codigo_fiscal VARCHAR(10),
  valor_total DECIMAL(10,2),
  status VARCHAR(50),
  data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
  data_coleta DATE,
  observacoes TEXT,
  placa_veiculo VARCHAR(20),
  motorista VARCHAR(100),
  ajudante VARCHAR(100),
  peso_total DECIMAL(10,2),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

CREATE TABLE IF NOT EXISTS itens_pedido (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT,
  produto_id INT,
  peso DECIMAL(10,2),
  valor_unitario DECIMAL(10,2),
  valor_total DECIMAL(10,2),
  peso_registrado DECIMAL(10,2),
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  FOREIGN KEY (produto_id) REFERENCES produtos(id)
);
