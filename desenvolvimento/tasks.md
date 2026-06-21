# Checklist de Desenvolvimento - Autenticação por Planilha (Sem Firebase)

- [x] Atualizar o script da planilha (`google-apps-script.js`):
  - [x] Adicionar `email` e `senha` ao esquema de pessoas e dados iniciais
  - [x] Implementar verificação de login e função `handleLogin` no `doPost`
  - [x] Atualizar a versão de inicialização para `'v0.3.7'` para migração automática
- [x] Atualizar a interface do frontend (`index.html`):
  - [x] Remover o dropdown `session-user-select` antigo
  - [x] Criar tela de login com formulário (`#login-screen`)
  - [x] Adicionar exibição do usuário logado e botão "Sair" no cabeçalho
- [x] Atualizar a lógica do frontend (`src/main.js`):
  - [x] Implementar função para gerar hash SHA-256 da senha
  - [x] Adaptar o `loadData` para gerenciar sessão ativa
  - [x] Implementar lógica de validação de login (online via POST, offline via cache local)
- [x] Validar a autenticação local e simular cenários:
  - [x] Confirmar migração de colunas e dados iniciais
  - [x] Validar bloqueio com senha errada
  - [x] Validar login offline
