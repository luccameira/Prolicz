Mapeamento de Problemas / BUGs

1 PÁGINA / 2- ARQUIVO / 3- SEÇÃO / 4- DESCRIÇÃO

1nova venda - 2nova-venda.html - 3observação - 4quando temos uma obs geral (ou seja, para todos os setores) e clicamos em editar observação, ele edita apenas para um setor / FEITO;

1várias páginas - 2vários arquivos - 3tarefas operacionais - 4remover os títulos e campos de busca/filtros das páginas de tarefas operacionais / FEITO;
 
1tarefas financeiro - 2tarefas-financeiro.html - 3valor total da venda - 4valor total da venda aumenta quando confirmamos e desfazemos a confirmação, por que isso acontece? Outra coisa, o segundo desconto não possui o "certinho" amarelo para confirmar, por que? Ticket da pesagem do pedido aparece repetido? /N/A;

1carga e descarga - 2tarefas-carga.html - 3descontos - 4são limitados a 3 por produto ou pedido? ou este limite não deveria existir? /N/A;

1novo pedido - 2nova-venda.html - 3campos Data Prevista da Coleta e Valor com note/sem nota - 4o problema aqui é que está sendo possível clicar e avançar a pergunta de confirmação "Vc tem certeza que deseja criar este pedido" com estes campos em branco. Não é possível criar o pedido sem preencher a data, mas é possível sem preencher o valor com nota e sem nota. / FEITO;

1portaria - 2tarefas-portaria.html - 3dados do motorista - 4não é possível prosseguir com os campos em branco porém não há nenhum aviso ou direcionamento para saber qual é o campo, só diz para preencher os campos obrigatórios / FEITO;

1carga e descarga - 2tarefas-carga.html - 3descontos - 4atualmente é possível seguir com a finalização da tarefa carga selecionando o tipo de desconto (exemplo palete grande), sem dizer a quantidade de paletes a ser descontado / FEITO;

1duas páginas - 2dois arquivos - 3tarefas operacionais - 4atualmente acontece dos card das tarefas sumirem para o financeiro e para o carga após o "reset" / FEITO;

1portaria - 2tarefas-portaria.html - 3dados do ajudante - 4atualmente é possível seguir com a finalização da tarefa portaria sem colocar os dados do ajudante. / FEITO;

1editar venda - 2editar-venda.html - 3adicionar observação - 4os campos estão colidindo, não é possível identificar corretamente os campos, visualmente quase inlegível, além disso, mesmo após adicionar uma obs e confirmar, não está aparecendo, ou seja, não está funcional. / FEITO;

1editar venda - 2editar-venda.html - 3adicionar outro produto - 4atualmente não está sendo possível adicionar um novo produto no editar venda. / PENDENTE;

1portaria - 2tarefas-portaria.html - 3card da tarefa - 4atualmente, após o encerramento de sua tarefa, o card não está exibindo o horário somente a data, o horário está como 00:00. devemos retirar esse horário, ele não deve existir / FEITO;

1portaria - 2tarefas-portaria.html - 3dados do motorista e do ajudante - 4atualmente não está sendo possível finalizar uma tarefa portaria quando o motorista/ajudante é novo no sistema. / PENDENTE.





LOGINS - USUÁRIOS TESTES
ADMINISTRADOR
localStorage.setItem('nomeUsuario', 'administrador@teste.com');
localStorage.setItem('usuarioLogado', JSON.stringify({
  nome: 'Administrador Teste',
  email: 'administrador@teste.com',
  tipo: 'administrador',
  permissions: [
    "Visualizar Clientes","Adicionar Cliente","Editar Cliente","Excluir Cliente",
    "Visualizar Vendas","Adicionar Venda","Editar Venda","Excluir Venda",
    "Visualizar Produtos","Adicionar Produto","Editar Produto","Excluir Produto",
    "Visualizar Tarefas - Portaria","Executar Tarefas - Portaria","Editar Tarefas - Portaria",
    "Visualizar Tarefas - Carga e Descarga","Executar Tarefas - Carga e Descarga","Editar Tarefas - Carga e Descarga",
    "Visualizar Tarefas - Conferência de Peso","Executar Tarefas - Conferência de Peso","Editar Tarefas - Conferência de Peso",
    "Visualizar Tarefas - Financeiro","Executar Tarefas - Financeiro","Editar Tarefas - Financeiro",
    "Visualizar Tarefas - Emissão de NF","Executar Tarefas - Emissão de NF","Editar Tarefas - Emissão de NF",
    "Visualizar Usuários","Adicionar Usuário","Editar Usuário","Excluir Usuário"
  ]
}));
window.location.reload();


COORDENADOR
localStorage.setItem('nomeUsuario', 'coordenador@teste.com');
localStorage.setItem('usuarioLogado', JSON.stringify({
  nome: 'Coordenador Teste',
  email: 'coordenador@teste.com',
  tipo: 'coordenador',
  permissions: [
    "Visualizar Clientes", "Adicionar Cliente", "Editar Cliente",
    "Visualizar Vendas", "Adicionar Venda", "Editar Venda",
    "Visualizar Produtos", "Adicionar Produto",
    "Visualizar Tarefas - Portaria", "Editar Tarefas - Portaria",
    "Visualizar Tarefas - Carga e Descarga", "Editar Tarefas - Carga e Descarga",
    "Visualizar Tarefas - Conferência de Peso", "Editar Tarefas - Conferência de Peso",
    "Visualizar Tarefas - Financeiro", "Editar Tarefas - Financeiro",
    "Visualizar Tarefas - Emissão de NF", "Editar Tarefas - Emissão de NF"
  ]
}));
window.location.reload();


CADASTRADOR
localStorage.setItem('nomeUsuario', 'cadastrador@teste.com');
localStorage.setItem('usuarioLogado', JSON.stringify({
  nome: 'Cadastrador Teste',
  email: 'cadastrador@teste.com',
  tipo: 'cadastrador',
  permissions: [
    "Visualizar Clientes", "Adicionar Cliente", "Editar Cliente",
    "Visualizar Produtos", "Adicionar Produto", "Editar Produto", "Excluir Produto"
  ]
}));
window.location.reload();


VENDEDOR
localStorage.setItem('usuarioLogado', JSON.stringify({
  nome: 'Vendedor Teste',
  email: 'vendedor@teste.com',
  tipo: 'vendedor',
  permissoes: ["Visualizar Vendas", "Adicionar Venda", "Editar Venda"]
}));
localStorage.setItem('nomeUsuario', 'vendedor@teste.com');
window.location.reload();


PORTARIA
localStorage.setItem("nomeUsuario", "portaria@teste.com");
localStorage.setItem("usuarioLogado", JSON.stringify({
  nome: "Portaria Teste",
  email: "portaria@teste.com",
  tipo: "portaria",
  permissoes: [
    "Visualizar Tarefas - Portaria",
    "Executar Tarefas - Portaria"
  ]
}));
window.location.reload();


CARGA E DESCARGA
localStorage.setItem("usuarioLogado", JSON.stringify({
  nome: "Carga e Descarga Teste",
  email: "cargadescarga@teste.com",
  tipo: "carga e descarga",
  permissoes: [
    "Visualizar Tarefas - Portaria",
    "Visualizar Tarefas - Carga e Descarga",
    "Executar Tarefas - Carga e Descarga",
    "Visualizar Tarefas - Conferência de Peso",
    "Visualizar Tarefas - Financeiro",
    "Visualizar Tarefas - Emissão de NF"
  ]
}));
window.location.reload();


CONFERÊNCIA DE PESO
localStorage.setItem("usuarioLogado", JSON.stringify({
  nome: "Conferência de Peso Teste",
  email: "conferencia@teste.com",
  tipo: "conferência de peso",
  permissoes: [
    "Visualizar Tarefas - Portaria",
    "Visualizar Tarefas - Carga e Descarga",
    "Visualizar Tarefas - Conferência de Peso",
    "Executar Tarefas - Conferência de Peso",
    "Visualizar Tarefas - Financeiro",
    "Visualizar Tarefas - Emissão de NF"
  ]
}));
window.location.reload();


FINANCEIRO
localStorage.setItem('usuarioLogado', JSON.stringify({
  nome: "Financeiro Teste",
  email: "financeiro@teste.com",
  tipo: "financeiro",
  permissoes: [
    "Visualizar Tarefas - Portaria",
    "Visualizar Tarefas - Carga e Descarga",
    "Visualizar Tarefas - Conferência de Peso",
    "Visualizar Tarefas - Financeiro",
    "Executar Tarefas - Financeiro",
    "Visualizar Tarefas - Emissão de NF"
  ]
}));
localStorage.setItem('nomeUsuario', "Financeiro Teste");
window.location.reload();


EMISSÃO DE NF
localStorage.setItem("usuarioLogado", JSON.stringify({
  nome: "Emissão de NF Teste",
  email: "emissaonf@teste.com",
  tipo: "emissão de nf",
  permissoes: [
    "Visualizar Tarefas - Portaria",
    "Visualizar Tarefas - Carga e Descarga",
    "Visualizar Tarefas - Conferência de Peso",
    "Visualizar Tarefas - Financeiro",
    "Visualizar Tarefas - Emissão de NF",
    "Executar Tarefas - Emissão de NF"
  ]
}));
window.location.reload();
