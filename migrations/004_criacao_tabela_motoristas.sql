CREATE TABLE motoristas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cpf VARCHAR(14) NOT NULL UNIQUE,
  nome VARCHAR(100) NOT NULL,
  foto_documento VARCHAR(255),
  foto_formulario VARCHAR(255),
  data_ultimo_formulario DATE NOT NULL
);
